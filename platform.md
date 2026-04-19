# CELLTOWER Platform Architecture
## Multi-Game Score Space, Peer-Deployed Tournament Contracts, and Replay Verification

### Design document by Aaron Hightower with AI assistance (Claude, Anthropic)
### the High Tower District · Fresno, California
### Version 0.2 · April 2026

---

> **Implementation note (April 2026):** The stream format described in §1.4 reflects the
> intended platform design. The current CELLTOWER client implements a simplified variant of
> this format — see `stream.md §Known Conflicts` for the precise differences. This document
> describes the target architecture; `stream.md` describes what is actually running.

---

## Part I — The Multi-Game Score Space

### 1.1 Design Philosophy

Every score record in the CELLTOWER platform answers five orthogonal questions:

1. **What game?** — The title and its version-pinned physics
2. **What mode?** — The ruleset variant within that game
3. **How many players?** — The competitive/cooperative configuration
4. **What kind of session?** — Human, assisted, or automated
5. **What was the result?** — The verified score, replay stream, and terminal hash

These five axes define a point in a multi-dimensional score space. Leaderboards are simply projections of that space onto a subset of axes. "Top human scores in CELLTOWER marathon mode" is one projection. "All verified multiplayer runs in Asteroids co-op mode" is another. The same data structure supports all of them.

---

### 1.2 Score Record Schema

Every verified game produces a **Score Record** — a compact, self-describing object:

```
ScoreRecord {
  // Identity
  record_id:       hex32          // SHA-256 of (game_id + stream + timestamp)
  player_name:     string[3]      // 3-char B92 name (public routing address)
  player_count:    uint8          // 1 = solo, 2+ = multi

  // Game coordinates
  game_id:         string         // "CELLTOWER" | "ASTEROIDS" | ...
  game_version:    hex32          // SHA-256 of game file (version lock)
  mode_id:         string         // "STANDARD" | "MARATHON" | "PUZZLE" | ...
  session_type:    enum           // HUMAN | AUTO | ASSISTED

  // Result
  score:           uint32         // final score
  duration_ms:     uint32         // wall-clock game duration
  pieces/events:   uint16         // game-specific action count

  // Verification
  stream:          base92-string  // compact replay (see §1.4 and stream.md)
  terminal_hash:   b92[40]        // SHA-256 chain terminal value, B92-encoded (40 chars)
  game_version:    hex64          // SHA-256 of game file — server-side only, not in stream
  seed_commit:     b92[5]         // pre-game seed (5 B92 chars for casual; longer for provably-fair)
  verified:        bool           // local self-check passed

  // Context
  timestamp:       iso8601
  contract_id:     string?        // null for casual play
  admission_id:    string[3]?     // required player_name under an admission ticket
  chain_id:        uint32?        // EVM chain if tournament entry
}
```

The `record_id` is the primary key. It is deterministic: the same game played identically produces the same record_id. This makes deduplication trivial and fraud detectable (two records with the same stream but different scores cannot both be valid).

When `admission_id` is present on a Score Record, the player's displayed `player_name` during play MUST equal `admission_id`. The screen grab and the replay stream both bind to this value (see §2.4). Records whose player_name does not equal their admission_id are automatically rejected by the contract.

---

### 1.3 Game Registry

Each game registers a **Game Descriptor** that the platform uses to understand, replay, and verify its streams:

```
GameDescriptor {
  game_id:         string          // unique short identifier
  display_name:    string          // "CELLTOWER" | "ASTEROIDS" etc.
  version_hash:    hex32           // current live version
  max_duration_s:  uint16          // max expected game length (≤600 for platform)
  replay_format:   ReplayFormat    // see §1.4
  modes: [
    ModeDescriptor {
      mode_id:         string      // "STANDARD" | "MARATHON" | "CLASSIC" etc.
      display_name:    string
      player_counts:   uint8[]     // [1] | [1,2] | [2,4] etc.
      score_axis:      string      // "SCORE" | "TIME" | "DISTANCE" | "SURVIVAL"
      min_skill_proof: string?     // e.g. "TETRIS_BONUS_ONCE" for CELLTOWER
    }
  ]
  verify_fn:       string          // name of registered verification function
}
```

The **platform registry** is a static JSON file (or server endpoint) that maps `game_id → GameDescriptor`. Adding a new game is adding a new entry here plus shipping a game file whose hash matches `version_hash`.

---

### 1.4 Universal Replay Stream Format

All platform games use a common stream envelope. The game-specific action encoding lives inside the payload section; the envelope is identical across games.

```
Stream layout (base92-encoded, semicolon-delimited sections):

  HEADER ; PAYLOAD ; TERMINAL_HASH

HEADER (comma-delimited):
  seed_b92         — 5 B92 chars (casual play) or more for tournament seeds
  stats            — game-specific summary (score, duration, event count, etc.)
  admission_id?    — optional 3-char B92 admission name (if playing an admission-ticket contract)
  player_name      — 0–3 char B92 displayed name (must equal admission_id if present)

PAYLOAD:
  Variable-length sequence of action records.
  Format defined per game in its ReplayFormat descriptor.
  Each action record is a fixed number of base92 characters (typically 2–4).
  Actions are ordered chronologically.

TERMINAL_HASH:
  40 B92 chars — SHA-256 of the full hash chain, B92-encoded (saves 24 chars vs hex)
```

**Hash chain rule (universal):**
- H_0 = SHA-256( UTF-8( seed + admission_id + player_name ) )
- H_n = SHA-256( H_{n-1} || action_record_n || state_after_n )

**Notes on current implementation vs. this spec:**
- `version_hex` (game file SHA-256) has been removed from the stream. It belongs in the
  `ScoreRecord` server-side schema, not in the verifiable stream itself.
- `game_id` and `mode_id` are not yet in the casual stream header; they will be added when
  the server-side Score Record infrastructure is built.
- Snapshots have been removed. The hash chain is all-or-nothing — snapshots added stream
  bloat with no verification benefit. See `stream.md §Snapshot Removal Rationale`.
- For current casual play, `admission_id` is absent and `player_name` alone is mixed into H_0.
  When tournament admission tickets are implemented, `admission_id` will be added as a separate
  field upstream of `player_name` in the H_0 input.

Mixing `admission_id` and `player_name` into H_0 binds the replay to the identity under which it was played. Re-submitting the same replay under a different identity produces a different terminal hash — the stream cannot be laundered across tournaments.

**Stream size budget:**
For a 10-minute game at 1 action per second, a 4-char action record produces 2,400 base92 characters (~2.4KB). At 10 actions per second (fast arcade play): 24KB. Both fit comfortably in a clipboard paste, QR code (with compression), or single HTTP POST.

---

### 1.5 CELLTOWER Action Record

```
posIdx: uint16 (2 base92 chars)   — type*1160 + rot*290 + x*29 + (drop_y+4)
ms:     uint16 (2 base92 chars)   — spawn-to-lock milliseconds (bot detection)
Total:  4 base92 chars per piece placement
```

**Packing rationale:** drop_y ranges −4 to +24 (pieces may spawn partially above the visible
board). Stored as drop_y+4, giving 29 values (0–28). The base-29 factor propagates:
x(10) × 29 = 290, rot(4) × 290 = 1160, type(7) × 1160 = 8,120. Max posIdx = 8,119 < 8,464
(2-char B92 capacity). ✓

**Note:** An earlier version of this spec used `type*1000 + rot*250 + x*25 + drop_y` (base-25
for drop_y). This was incorrect — it cannot represent pieces partially above the board. Any
verifier must use the formula above.

---

### 1.6 ASTEROIDS Action Record (proposed)

Asteroids gameplay decomposes into per-event records. For a typical 3-minute game at ~10 events/second:

```
Event-based (sparse, human-readable):
  event_type: 4 bits               — THRUST_START|THRUST_END|LEFT|RIGHT|FIRE|KILL|LEVEL|DEATH
  event_data: 12 bits              — rotation (9 bits) + flags (3 bits)
  ms_delta:   16 bits              — ms since last event
  Total: 4 bytes per event → ~7KB for a typical game
```

The verifier reconstructs ship position, velocity, and asteroid field deterministically from the seed, then replays events. The terminal hash pins the result. Timing deltas enable bot detection via the same statistical analysis as CELLTOWER.

---

### 1.7 Multi-Player Score Records

For 2-player competitive play, each player produces an independent Score Record with a shared `contract_id`. The platform links them by `contract_id` rather than merging them into one record. This keeps the replay format simple (one player per stream) and allows each player's record to be independently verified.

For co-operative play (two players, one score), the stream contains interleaved action records tagged by player index. The state after each action is the joint state. Both players must sign the terminal hash for the record to count.

---

## Part II — The Peer Piggy-Bank Contract Model

### 2.1 Core Analogy: The California Cardroom

In a California cardroom:
- The **dealer** is paid a fee to move cards around — they do not play for the pot.
- The **players** stake money against each other — the outcome is between them.
- The **cardroom** provides the table, the rules, and the physical infrastructure — the cardroom is not a player.

On the CELLTOWER platform:
- The **verification oracle** (dealer) is paid a fee to verify replays — it does not win or lose.
- The **players** stake entry fees that distribute to the best performer(s) — the outcome is between them.
- The **High Tower District** (cardroom) provides the game client, registry, and optional oracle service — HTD is not a player and takes no share of the prize pool.

The critical legal fact in the cardroom analogy is that **no corporation stands between the players and the pot**. A player can deploy a contract that acts, in effect, as their own self-capitalized tournament — the contract is the piggy bank, not a corporate treasury.

### 2.2 The Piggy-Bank Contract

Any player can deploy a **piggy-bank contract**: a self-contained tournament that holds funds, admits entrants according to creator-specified terms, distributes prizes to verified winners, and **refunds any remainder to the creator on expiration**. Each contract is:

- **Single-purpose**: one tournament, one deployment, one lifecycle
- **Creator-bounded**: the creator sets every parameter at deploy time; nothing changes afterward
- **Self-refunding**: if the tournament expires without valid entries or valid winners, all funds return to the creator's wallet
- **Peer-symmetric**: the creator has no privileged role *during play* beyond what they disclosed at deploy time

The contract is the player's own piggy bank. They may seed it with their own funds (creating a free-entry bounty), require entry fees from others (creating a pool they may compete for), or structure it as a guaranteed prize with fixed admission (see §2.8). Each of these structures is legal under different framings — and the contract must declare its framing at deploy time so entrants know what they are entering.

### 2.3 Why Per-Tournament Deployment

Each tournament is a fresh contract deployment, not an entry in a shared registry. This choice is deliberate:

- **Legal isolation**: each tournament stands on its own terms. A flaw in one does not taint another.
- **Parameter immutability**: a deployed contract cannot be amended. Creators cannot silently change the rules after entries arrive.
- **Piggy-bank semantics**: the contract *is* the piggy bank. On expiration, it releases its contents to the creator and becomes inert. A registry model would couple lifecycles.
- **Creator accountability**: each creator's contracts are visibly tied to their deploying address. Bad actors build a public record; honest creators build reputation.

A future optimization layer may batch multiple related contracts behind a factory (gas efficiency) or a meta-contract (aggregated distribution), but the semantic unit remains one tournament = one contract.

### 2.4 Admission Tickets and Allowlists

Some tournaments are open to all. Others restrict entry. The platform supports three allowlist modes, in increasing order of restrictiveness:

**OPEN** — Anyone may enter by paying the entry fee. The player_name on the submitted Score Record may be any B92 3-char string.

**ENUMERATED** — The contract embeds a list of specific wallet addresses permitted to enter. Straightforward but requires the creator to know addresses in advance.

**ADMISSION-TICKET** — The creator specifies a seed and a participant count N. The seed deterministically samples N three-character B92 IDs from the full 92³ = 778,688 name space. These N IDs are the **admission tickets** for the tournament.

To enter an admission-ticket tournament, a player:
1. Pays the entry fee to the contract.
2. Receives an admission ticket — one of the N IDs, assigned by the contract via a password-and-ticket handshake (the creator may pre-distribute admission codes; the player redeems a code for their randomly-drawn ticket).
3. Plays qualifying games under that ticket's 3-character ID as their `player_name`.
4. Submits the replay stream with `admission_id` set to the ticket.

Because `admission_id` is mixed into H_0 of the hash chain and displayed on-screen during play (burned into the screen grab as the player's 3-letter name), a performance under ticket `XQ7` cannot be re-submitted under ticket `KKM` or under a non-tournament identity. The replay either verifies under `XQ7` or it doesn't verify at all.

**Grouped qualification.** Multiple sibling contracts may accept the same admission-ticket ID. A player who purchases ticket `XQ7` valid for a grouped event ("April sprint" + "April monthly" + "rookie bracket") can submit a single qualifying run to all three. This is not a loophole — it is how the creator designed the group.

### 2.5 Interview-Driven Contract Creation

Free-form contract text is a fraud vector: creators can write ambiguous rules, hide clauses, or trap entrants with adversarial language. Instead, the CELLTOWER client constructs contracts through a **structured interview**. The creator answers a sequence of questions; the client composes a well-formed contract from templated language.

The interview covers, at minimum:

```
  [GAME]           Which game? (CELLTOWER | ASTEROIDS | ...)
  [MODE]           Which mode? (STANDARD | MARATHON | CLASSIC | ...)
  [PLAYER_COUNT]   1 | 2 | more
  [DURATION]       Tournament open from/until. Entry window vs. play window.
  [ADMISSION]      OPEN | ENUMERATED | ADMISSION-TICKET. If ticket: seed, count,
                   distribution method.
  [ENTRY_FEE]      Amount and currency. Zero allowed (creator-funded bounty).
  [CREATOR_FUNDING] Amount creator seeds into the pool (can be zero).
  [MIN_ENTRIES]    Below this, entries refund and creator funding returns.
  [MAX_ENTRIES]    Cap on participants (relevant for admission-ticket mode).
  [CREATOR_PLAY]   May the creator enter their own tournament? (see §3.1)
  [DISTRIBUTION]   How is the pool split? (winner-take-all | top-3 | top-N | percentile)
  [TIEBREAK]       Earliest submission wins | most recent wins | split
  [ORACLE]         Which verification oracle? (HTD | independent | multi-oracle)
  [FEE_ORACLE_BPS] Oracle's per-verification fee, in basis points of pool
  [FEE_LISTING]    Flat fee paid to the server listing this tournament
  [EXPIRATION]     Hard deadline after which the creator can sweep refunds
  [AGE_GATE]       Is this tournament restricted to 18+? (see §3.9)
  [TAX_REPORTING]  Winners crossing US $600 must provide W-9 (see §3.8)
```

Each answer is bounded — enums where applicable, numeric limits where sensible, strings restricted to the B92 alphabet. The resulting contract is a deterministic composition of templates: no free text, no hidden fields.

The interview also produces a **plain-English summary** that appears on the entry screen. The creator cannot publish a tournament whose summary contradicts the contract bytecode — the summary is generated from the same answers.

### 2.6 The Creator as a Peer

By default, the creator **may** play their own tournament, but must disclose it. Three stances are available:

- **CREATOR_PLAYS_AS_PEER**: the creator enters under the same terms and fee as any other player. The contract treats their Score Record identically. This is the cleanest peer model.
- **CREATOR_DOES_NOT_PLAY**: the creator is excluded from entry. The tournament is between other players only. The creator may still earn a listing fee but takes no prize share.
- **CREATOR_BOUNTY**: the creator seeds the pool and does not compete. Other players vie for the creator's bounty. This edges close to sweepstakes territory and is subject to §3.2.

The chosen stance is part of the contract and appears prominently on the entry screen. A `CREATOR_PLAYS_AS_PEER` tournament where the creator finishes first still looks suspect to third parties — the only defense is cryptographic transparency: the replay is public, the bot-detection heuristics are public, and observers can audit the win.

### 2.7 Lifecycle: The Piggy-Bank Contract from Deploy to Sweep

```
t0: DEPLOY
    Creator signs deployment transaction.
    Contract parameters locked.
    Creator funds (if any) and listing fee deposited.
    Contract STATE = OPEN_FOR_ENTRY

t0 .. t1: ENTRY WINDOW
    Players pay entry fee, receive admission ticket (if applicable).
    Contract STATE = OPEN_FOR_ENTRY

t1 .. t2: PLAY WINDOW
    No more entries accepted.
    Players play qualifying games under their admission IDs.
    Streams are submitted to the contract with oracle signatures.
    Contract STATE = PLAY_OPEN

t2: PLAY_CLOSE
    No more submissions accepted.
    Verification grace period begins.
    Contract STATE = VERIFYING

t2 .. t2.5: VERIFICATION GRACE
    Oracle finishes verifying submitted streams (hash chain validity check).
    Valid Checksum confirmed for all qualifying submissions.
    Contract STATE = VERIFYING

t2.5 .. t3: ANTI-FRAUD AUDIT WINDOW
    Oracle computes Humanity Probability Scores for all verified streams (see §4.2).
    Streams below the contract's HPS threshold are placed in AUDIT_HOLD.
    Flagged holders are notified and have 48 hours to submit Human Attestation.
    Attestations that pass lift AUDIT_HOLD; failures or non-responses void the submission.
    Disputes may be raised by any party during this window.
    Contract STATE = AUDIT_HOLD (for flagged submissions) / VERIFYING (for clean submissions)

t3: DISTRIBUTE
    Any party may call distribute() and pay the gas.
    If min_entries met and verified winners exist:
      → Pool splits by creator's declared distribution.
      → Oracle fee and listing fee are disbursed.
    If min_entries NOT met:
      → All entry fees refunded to entrants.
      → Creator funding returned to creator.
    Contract STATE = DISTRIBUTED

t4: EXPIRATION SWEEP (t3 + sweep_delay)
    Any unclaimed balance (failed distributions, dust, unclaimed prizes)
    can be swept to the creator's address.
    Contract STATE = EXPIRED
```

The separation of **entry window** (t0..t1) from **play window** (t1..t2) is critical. It eliminates entry-sniping: nobody can see a leading score and then decide to enter. The roster is locked before anyone plays.

The grace period between play close and distribution (t2..t3) exists for oracle verification time and for dispute windows. This is a known pattern in optimistic rollups and escrow contracts.

`distribute()` is callable by anyone. The gas cost is charged to the caller. In practice the winner or the creator will typically call it; for small pools, a keeper or the oracle itself can be configured to call it in exchange for a gas rebate (declared in the contract).

### 2.8 Creator-Funded Bounties and Sweepstakes Framing

A tournament with **zero entry fee** and **creator-provided funding** is economically a bounty. Legally, depending on structure, it may read as:

- A **skill contest**: winner takes prize based on skill. Legal in all US states.
- A **sweepstakes**: free entry + prize + chance element. Governed by §17539 et seq. in California.
- A **gift**: creator unilaterally rewards a performance. Depends on formality.

To stay clearly on the skill-contest side:
- Entry must be open to anyone meeting declared skill-neutral criteria.
- The winner must be determined by performance, not by lottery.
- The creator must not retain discretion over the outcome.

The interview in §2.5 captures these criteria. Creators selecting `CREATOR_BOUNTY` receive a prompt explaining the sweepstakes boundary and are required to affirm skill-contest structure before deployment.

---

## Part III — Design Problems and Mitigations

This section catalogs the failure modes of the peer piggy-bank model and the mitigations baked into the design. The whole system rests on the premise that *every failure mode is publicly visible and publicly auditable* — transparency is the only real guarantee.

### 3.1 Creator Advantage in Own Tournament

**Problem.** If the creator plays their own `CREATOR_PLAYS_AS_PEER` tournament and wins, outside observers may suspect collusion, bot assistance, or rule-gaming.

**Mitigation.**
- Creator participation is mandatory-disclosed on the entry screen.
- All replay streams, including the creator's, are public and verifiable under the same rules.
- Bot-detection heuristics (timing statistics, input entropy) apply equally to the creator.
- The creator cannot change the tournament rules after deploy.
- Tournaments where the creator has a structural advantage (e.g., authored the mode-specific level seed) must disclose the relationship. A creator who also authored the mode bears reputational risk if they consistently win.
- Players who believe a tournament is rigged can simply not enter. Reputation is the primary filter.

### 3.2 Sweepstakes Framing for Creator-Funded Bounties

**Problem.** Zero-entry-fee tournaments with creator funding can look like sweepstakes and attract §17539 regulation.

**Mitigation.**
- The interview in §2.5 separates `CREATOR_BOUNTY` as its own stance with explicit affirmations:
  - Entry is open to all players meeting skill-neutral criteria.
  - Winner is determined solely by verified performance.
  - No chance element.
- Bounty tournaments carry a "SKILL CONTEST — NOT A SWEEPSTAKES" banner on the entry screen.
- Bounty contracts cannot use admission-ticket restrictions that are not skill-derived (e.g., a random drawing to select eligible players would be a sweepstakes; an admission ticket purchased with an entry fee is not).
- HTD publishes a short legal guidance note with the interview explaining where the skill/sweepstakes line sits.

### 3.3 Entry Sniping

**Problem.** A player who watches live scores could enter a tournament after the leader posts a strong score and attempt to beat it with infinite retries.

**Mitigation.** The strict separation of entry window and play window. Once the entry window closes, the roster is locked. No player can see any score and then decide to enter.

Additionally, for admission-ticket tournaments, all players are bound to a specific 3-letter ID for the duration of play. A player who wants multiple attempts would need multiple admission tickets, each requiring a separate paid entry.

### 3.4 Creator Withdrawal Before Entries Arrive

**Problem.** A creator could seed funding, wait to see if anyone enters, and then cancel if entry patterns look unfavorable.

**Mitigation.**
- Creator funding is locked in the contract at deploy time. The creator has no withdrawal function.
- The only withdrawal path is the **expiration sweep** at t4, which executes after the tournament has fully resolved. At that point, the only remaining funds are unclaimed dust or explicit refunds.
- If `min_entries` is met, the tournament proceeds regardless of the creator's wishes. The distribution runs and creator funding flows to winners.
- If `min_entries` is NOT met, all fees refund automatically, and the creator's own seed funds return to them. This is the only refund path — it is symmetric and automatic.

### 3.5 Allowlist of Unknown Identities

**Problem.** The creator wants to restrict entry but does not know the wallet addresses of the eligible participants.

**Mitigation.** The admission-ticket mechanism (§2.4). The contract commits to a seed at deploy; the seed deterministically generates N three-character IDs. These IDs are transferable admission tickets, sold or gifted by the creator through an out-of-band channel (email invites, in-person passwords, QR codes on a poster). Only players holding an admission ticket can submit a valid Score Record. The tickets never touch the wallet address — they bind to the `player_name` the player uses during qualifying play, which is cryptographically pinned into the hash chain.

This gives the creator full control over who participates without requiring advance knowledge of wallet addresses. It also gives participants pseudonymity — they play under the ticket's 3-letter ID, not under their wallet's public address.

### 3.6 Oracle as Single Point of Failure

**Problem.** If the verification oracle is compromised, offline, or malicious, the contract cannot determine winners.

**Mitigation.**
- Every contract specifies its oracle(s) at deploy time. Players see the oracle identity on the entry screen.
- The contract can require **multi-oracle** confirmation (e.g., 2-of-3 independent signatures) for high-stakes tournaments. Oracles are public keys registered on-chain; any party can run one.
- Oracles publish their verification logic as open source (it is just the portable `_verifyStream()` function from the game client).
- In the event an oracle becomes unavailable, the contract's grace period (t2..t3) extends. If no oracle signature arrives within the configured timeout, the contract enters **disputed state** and refunds all entries. This is a fail-safe default.
- Oracle malfeasance is publicly visible: any third party can run the same verification on the public stream and show that the oracle's attestation disagrees with the math. This is reputationally fatal for the oracle.

### 3.7 Gas Cost of Distribution

**Problem.** `distribute()` must be called by someone; that someone pays gas. For small pools, the gas cost can exceed any individual winner's share.

**Mitigation.**
- The contract tracks a configurable `distribution_gas_rebate` at deploy. The caller of `distribute()` receives this rebate from the pool before winners are paid.
- For small pools (below a configured threshold), the contract may specify a **keeper oracle** that calls `distribute()` as part of its normal operation, in exchange for a larger rebate declared at deploy time.
- Winners may call `distribute()` themselves — they have the strongest incentive.
- The grace period is bounded; after expiration, anyone (including non-entrants) may call `distribute()` with the rebate as their payment. In pathological edge cases where gas exceeds the rebate, the contract sits in VERIFYING indefinitely and all funds eventually return to the creator via the expiration sweep.

### 3.8 US $600+ Tax Reporting (1099)

**Problem.** US tax law requires payers who distribute $600 or more in prizes to file Form 1099-MISC with the IRS. A peer-deployed contract has no entity responsible for issuing the form.

**Mitigation.**
- Tournaments with a **maximum single prize** at or above US $600 must enable the `TAX_REPORTING` interview flag.
- When enabled, the admission process requires winners to provide a W-9 (US taxpayer info) before they can claim their prize. Non-US entrants provide a W-8BEN equivalent.
- The contract holds winning funds in an escrow sub-pool until tax documentation is collected, then releases funds along with metadata that the creator (or an appointed reporter) uses to file 1099s.
- HTD offers an optional **1099 service** (fee-for-service) that handles filing on behalf of creators whose tournaments trigger reporting thresholds. Creators electing this service pay a per-winner fee at distribution time.
- For pools whose maximum single prize is below US $600, the flag may be left off — but the creator must affirm they understand the threshold. The interview surfaces the requirement explicitly.
- Tournaments denominated in crypto are still subject to IRS reporting at USD-equivalent value at time of distribution. The interview notes this.

### 3.9 Age Verification (18+)

**Problem.** Skill-based cash-prize competitions in California and elsewhere are generally restricted to adults.

**Mitigation.**
- Every cash-prize tournament requires the creator to set an `AGE_GATE` value. The default is 18+.
- Players entering such a tournament must pass an age verification step before their wallet is connected to the contract. The verification provider is pluggable; HTD's default integration uses a third-party KYC-lite service that returns a zero-knowledge age attestation.
- The age attestation is tied to the entry transaction, not to the wallet. Each new cash-prize entry requires re-attestation (or a cached attestation within a reasonable window).
- Free-entry skill contests (CREATOR_BOUNTY with zero entry fee) may skip age gating if the creator affirms the prize is below regulatory thresholds — but the interview surfaces this and requires explicit confirmation.
- HTD does not store the underlying identity data. The attestation service does; HTD receives only a pass/fail flag for the age check.

### 3.10 Player-Name Collision in Admission Tickets

**Problem.** A player's preferred `player_name` (say, `ACE`) may collide with their assigned admission ticket. The Score Record would display the ticket name, not the preferred name, potentially confusing casual leaderboards.

**Mitigation.**
- Score Records carry both `player_name` and (when present) `admission_id`. They are the same string when an admission ticket is in use. The platform displays `admission_id` for tournament leaderboards and the casual name for casual leaderboards.
- A player can hold a top casual score under `ACE` and simultaneously hold a tournament winner slot under admission ticket `XQ7`. The two do not conflict.
- The DM routing system (see `tos.md`) routes to the holder of the name on the leaderboard being addressed. Casual DMs go to casual-ACE; tournament DMs go to tournament-XQ7.

---

---

## Part IV — Prize Qualification Framework

### 4.1 Tier Classification

CELLTOWER recognition operates at two distinct tiers:

**Tier 1 — Leaderboard Recognition**
Any game record with a valid terminal hash qualifies for leaderboard listing. Automated
play is not banned at this tier — the score is provably real, and the community decides
what it means. Tier 1 imposes no requirement on the identity of the player.

**Tier 2 — Cash Prize Eligibility**
A Valid Checksum is **necessary but not sufficient**. A stream must additionally receive
a passing Humanity Probability Score (§4.2) before the submitting holder becomes eligible
for cash prize disbursement from a tournament contract.

This two-tier structure is the formal expression of the platform's position: *the math
proves the game; the human proves the player.* A bot may appear on any leaderboard. It
may not collect a prize.

---

### 4.2 The Humanity Score — Proof of Human Effort

#### Rationale

The hash chain is a proof of record integrity, not a proof of human origin. These are
distinct claims. For Tier 2 prize eligibility, evidence of the second claim is required.

The platform does not claim to detect all automated play with certainty. It claims to
make a statistically rigorous, publicly documented, good-faith determination — and to
hold submitters contractually liable for misrepresentation regardless of detection outcome.

#### The Humanity Probability Score

The oracle computes a **Humanity Probability Score (HPS)** for every stream submitted to
a Tier 2 contract. HPS is a value in [0.0, 1.0] derived from statistical analysis of the
`timing_ms` field across all piece placements, correlated against board complexity at each
placement moment.

Board complexity factors used in the correlation:

| Factor | Description |
|--------|-------------|
| Stack height | Rows with any occupied cell above the playfield midpoint |
| Hole count | Occupied cells with empty cells directly above them |
| Column height variance | Standard deviation of per-column stack heights |
| Next-piece difficulty | Number of clean placement slots given current board topology |
| Current level | Tighter timing windows at higher levels; human reaction times do not scale linearly |

**The behavioral signal:** A human player under cognitive load — high stack, multiple
holes, a difficult next piece — exhibits measurably longer placement times and elevated
timing variance. On a clean board with an easy piece, the same player places quickly.
This **context-sensitivity** is the fingerprint of human cognition applied to a real
problem. It is not easy to fake, because faking it correctly requires solving the same
board-evaluation problem the human is solving.

Automated systems fail this test in one of two ways:

- **Uniform Bot-Jitter:** Timing is consistent regardless of board state. Fast on easy
  boards, fast on hard boards. No correlation with complexity.
- **Synthetic Bot-Jitter:** Variance is introduced deliberately but is not correlated with
  board complexity — random noise injected to look human, detectable because it does not
  track the actual difficulty of each placement decision.

Both patterns are statistically distinguishable from genuine human timing with sufficient
sample size. A 300-piece game provides approximately 300 timing samples — sufficient for
robust analysis.

#### Bot-Jitter Definition

> **Bot-Jitter** is defined as any timing distribution in a submitted game stream where
> the `timing_ms` values are either (a) statistically uniform across varying board
> complexity states, or (b) variable but with variance uncorrelated to board complexity
> metrics. Either pattern constitutes grounds for HPS failure.
>
> A Humanity Probability Score below the contract's declared threshold, attributed to
> Bot-Jitter detection, is grounds for **contract voidance** of that submission.

The HPS threshold is a contract parameter declared at deploy time. Default: **0.72**.
High-stakes contracts may require 0.85 or higher. Casual or exhibition contracts may
lower the threshold or disable HPS entirely — but that choice is disclosed to all entrants
on the entry screen (see §4.3).

#### Financial Liability and Breach of Contract

By submitting a game stream to any Tier 2 tournament contract, the submitting player
represents and warrants that the stream was produced by an unaided human player. This
representation is a **material term** of the entry agreement, accepted at the moment of
wallet connection and entry fee payment.

Submission of an automated or AI-assisted stream — regardless of whether its terminal
hash verifies correctly — constitutes **breach of contract**. The financial consequences
of that breach fall entirely on the player:

- Entry fee is forfeited.
- Prize eligibility is voided.
- Withheld prize funds are redistributed to the next eligible finisher.
- The voided stream and the basis for voidance are recorded on-chain and publicly visible.

**The High Tower District's liability is bounded.** The platform commits to operating
the HPS infrastructure in good faith, publishing its methodology and thresholds, and
providing a documented dispute path for false-positive claims. The platform does not
guarantee detection of all automated play, and its failure to detect a specific instance
of fraud does not make the platform liable for the fraud — the player who committed it is.

A player who uses automation and evades HPS detection has committed fraud. The platform's
failure to catch them does not reduce their legal exposure. It only delays the community's
awareness. When that awareness arrives — through social signals, community investigation,
or a future audit — the on-chain record of their submission is permanent evidence.

**In summary: the platform moves the financial and legal liability for bot-assisted play
from the infrastructure provider to the player, through explicit contractual representation
at entry. Detection is a tool. Contractual liability is the backstop.**

---

### 4.3 HPS Parameter Disclosure on Entry Screen

Tournament entry screens must display the following HPS parameters declared by the
contract creator, prior to entry fee payment:

- Whether HPS checking is enabled for this contract
- The HPS threshold in effect
- The consequence of HPS failure (submission voided, entry fee forfeited, next eligible
  finisher advances)
- The 48-hour attestation option available to flagged submissions
- The Board of Directors review path

A player who pays an entry fee after reading this disclosure has accepted the HPS terms.
No post-hoc claim of surprise about the HPS process is valid.

---

#### Dispute and Review Path

A player who believes their submission was incorrectly flagged may:

1. Request Board of Directors review within 48 hours of AUDIT_HOLD notification.
2. Submit evidence of human play (video, attestation session, device logs).
3. Receive a written determination within 5 business days.

If the Board overturns the flag, the submission is restored, AUDIT_HOLD is lifted, and
prize funds are released normally. If the Board upholds the flag, the submitter may seek
independent arbitration as specified in the entry agreement.

The Board's determination and its reasoning are published (anonymized where appropriate)
as part of the platform's transparency commitment.

---

## Part V — The High Tower District's Legal Position

### 5.1 HTD's Role

The High Tower District occupies a clearly bounded role:

**What HTD does:**
- Develops and publishes the game client software.
- Maintains the platform registry (game descriptors, mode descriptors, replay format specs).
- Operates optional infrastructure services for a fee: a verification oracle, a tournament listing server, a 1099 filing service.
- Hosts documentation, example contracts, and the interview templates.

**What HTD does not do:**
- Hold player funds at any time.
- Deploy or operate tournament contracts on behalf of players.
- Set or guarantee prize amounts.
- Determine winners.
- Adjudicate disputes between peers.

This structure is a **marketplace or exchange operator** role — closer to eBay's relationship to auction outcomes than to a casino's relationship to gambling results. HTD earns fees for infrastructure and services, not from the outcome of any contest.

### 5.2 California Legal Framework

#### The Dominant Factor Test (Reiterated)

California uses the dominant factor test to distinguish skill contests from gambling. CELLTOWER qualifies as skill-dominant (see `verification.md`). The peer piggy-bank layer does not change this — it changes only the payment and prize distribution mechanism.

#### Penal Code §337 — Banking and Percentage Games

§337 prohibits banking games (house against all players) and percentage games (house takes a cut of the action).

- HTD takes no share of any prize pool. The piggy-bank contract moves funds peer-to-peer.
- HTD's infrastructure fees are fixed, disclosed, and collected at contract creation or verification time — not computed as a percentage of losses.
- The creator is not the "house" in the cardroom sense. In `CREATOR_PLAYS_AS_PEER` mode, the creator is a player. In `CREATOR_BOUNTY` mode, the creator is an entrant-free-of-charge skill-contest sponsor, not a banker.

#### §330.5 — Skill-Based Amusement Exemption

§330.5 exempts legitimate skill competitions. CELLTOWER's peer tournaments fall within this exemption when structured as skill contests with no chance element in the prize determination.

#### AB 831 (Effective January 1, 2026)

AB 831 prohibits dual-currency casino-simulation sweepstakes. CELLTOWER is not a casino simulation, does not use a dual-currency model, and does not simulate any chance game. AB 831 does not apply.

#### B&P §17539 et seq. — Contests and Sweepstakes

Peer-funded skill contests with skill-based winner determination are skill contests, not sweepstakes. The interview in §2.5 enforces skill-contest structure for `CREATOR_BOUNTY` tournaments.

### 5.3 Informed Consent on Entry

When a player enters any tournament through the CELLTOWER client, they see:

```
YOU ARE ABOUT TO ENTER A SKILL COMPETITION.

GAME:          [game + mode]
ENTRY FEE:     [amount and currency]
PRIZE POOL:    [current pool amount]
DISTRIBUTION:  [how the pool splits]
CREATOR:       [wallet address — tap to view history]
CREATOR PLAYS: [YES / NO / BOUNTY]
ADMISSION:     [OPEN / ENUMERATED / ADMISSION-TICKET]
CONTRACT:      [blockchain address — tap to view on explorer]
ORACLE:        [oracle name(s) and public key hash(es)]
CHAIN:         [network name]
AGE GATE:      [18+ / NONE]
TAX NOTE:      [maximum prize and 1099 applicability]

THE HIGH TOWER DISTRICT BUILT THE GAME CLIENT.
HTD IS NOT THE CONTRACT CREATOR. HTD DOES NOT
HOLD YOUR FUNDS. HTD DOES NOT DECIDE WINNERS.

YOUR ENTRY FEE IS SENT DIRECTLY TO A SMART
CONTRACT. PRIZES ARE DISTRIBUTED AUTOMATICALLY
BY THE CONTRACT BASED ON VERIFIED SCORES.

THE GAME CLIENT IS A TOOL — LIKE A BROWSER.
THE BROWSER IS NOT LIABLE FOR WHAT WEBSITES DO.
YOU ARE ENTERING A CONTRACT BETWEEN YOU AND
THE CREATOR AND OTHER ENTRANTS.

[ I UNDERSTAND. CONNECT WALLET AND ENTER. ]
[ CANCEL ]
```

The disclosure is generated from the contract's parameters. It cannot be edited by the creator — the client composes it from the on-chain facts.

### 5.4 Dispute Resolution

Smart contracts execute deterministically. Inputs are: entry fees (on-chain, public), verified game scores (mathematically provable from replay streams), and the distribution formula (immutable from deploy time). There is nothing in a functioning contract to dispute.

For pathological cases — oracle malfeasance, contract bugs, chain reorganization — the dispute is between the parties to the contract: players and the contract creator. HTD is not a party and has no obligation to adjudicate or compensate.

The smart contract source code, the oracle's public key, the verification protocol, and the replay streams are all public. Any qualified attorney or blockchain expert can audit the system. This is the transparency guarantee that makes the legal position defensible: **the proof is public, the code is public, the math is public**.

---

## Part VI — Revenue Model for the High Tower District

HTD generates revenue from infrastructure, never from player losses.

1. **Oracle verification fee**: a per-verification fee paid to the oracle that signed a winning submission. Declared in the contract at deploy time in basis points.

2. **Listing fee**: a flat fee collected when a creator publishes a tournament on HTD's server. Paid at contract creation, independent of how the tournament resolves.

3. **1099 filing service** (US): per-winner fee for creators whose tournaments trigger reporting thresholds.

4. **Age-verification gateway**: per-attestation fee if the creator uses HTD's default age-verification partner.

5. **DM system** (see `tos.md`): future per-message fees for fan mail routing.

6. **Registry / licensing**: game developers who ship titles on the platform may pay a licensing fee for registry entry and oracle integration.

HTD does not:
- Take a percentage of any prize pool.
- Guarantee any prize.
- Hold or custody any player funds.

These are design principles, not just legal protections. A platform that profits from player losses has an incentive to make the game worse. A platform that profits from infrastructure provision has an incentive to make the infrastructure better.

---

## Part VII — Future Games and Platform Extension

### 6.1 ASTEROIDS Clone (Next Game)

The second platform game is an Asteroids-style shooter. Score dimensions:

| Axis | Values |
|------|--------|
| mode | CLASSIC (3 lives, waves) · SURVIVAL (one life, infinite) · TIMED (90-second sprint) |
| player_count | 1P · 2P cooperative |
| session_type | HUMAN · AUTO |

The replay stream uses the event-based format from §1.6. A typical 3-minute CLASSIC game produces approximately 1,800 event records × 4 bytes = 7.2KB uncompressed.

Score verification: the verifier reconstructs ship physics from the seed-derived asteroid field, replays player inputs, and confirms the terminal hash. The asteroid RNG is seeded and deterministic — the same seed produces the same field every time.

### 6.2 Leaderboard Query Model

Leaderboard queries are compound key lookups:

```
key: {game_id}/{mode_id}/{player_count}/{session_type}
     → sorted list of ScoreRecords by score (desc) or time (asc)

Examples:
  CELLTOWER/STANDARD/1/HUMAN        — solo human CELLTOWER leaderboard
  CELLTOWER/STANDARD/1/AUTO         — AI demo leaderboard (separate)
  ASTEROIDS/CLASSIC/1/HUMAN         — solo Asteroids classic
  ASTEROIDS/SURVIVAL/2/HUMAN        — 2P cooperative survival
  */*/1/HUMAN                       — all solo human records (cross-game)
```

Tournament leaderboards key on `contract_id` instead of the game/mode axes — each contract is its own micro-leaderboard.

### 6.3 Platform Score Identity

The player's 3-character name is the routing address across all games and modes. A player named `ACE` has one name but may appear on multiple leaderboards. The identity system does not need to change — the name is a label on the Score Record, and the Score Record carries the game/mode/count coordinates that place it in the right leaderboard.

For tournament play under admission tickets, the `admission_id` replaces the casual name for the duration of the tournament's leaderboard. The fan DM system routes messages to the holder of `{game_id}/{mode_id}/{name}` for casual play and `{contract_id}/{admission_id}` for tournament play.

---

## Summary

The platform provides:

- A **universal Score Record schema** that accommodates any game, any mode, any player count.
- A **universal replay stream format** with game-specific payload encoding inside a common envelope, cryptographically bound to the player's identity.
- A **game registry** for adding new titles without changing platform infrastructure.
- A **peer piggy-bank contract model** where any player can deploy a self-contained tournament that holds funds, admits entrants, pays winners, and refunds the remainder on expiration.
- **Interview-driven contract creation** that produces well-formed, auditable contracts from structured answers — never from free text.
- **Admission-ticket allowlists** that restrict entry to creator-chosen participants without requiring advance knowledge of wallet addresses, and cryptographically pin performances to their tournament of origin.
- **Nine design mitigations** for the predictable failure modes of peer-deployed tournaments: creator advantage, sweepstakes framing, entry sniping, creator withdrawal, unknown allowlist identities, oracle single-point-of-failure, distribution gas economics, US tax reporting, and age verification.
- **A legal structure** that places HTD in the infrastructure-provider role, not the gambling-operator role.
- **A revenue model** based on service fees — never on a percentage of any prize pool.

The whole system is designed so that the proof is always public, the code is always auditable, and the money always moves between consenting peers through transparent mechanisms — not through an opaque house.

---

*Platform Architecture v0.2 — Pre-implementation design document*
*CELLTOWER · the High Tower District · Fresno, California*
*AI design and drafting partner: Claude (Anthropic)*
*This document does not constitute legal advice. Consult qualified legal counsel before implementing any tournament or prize distribution system.*
