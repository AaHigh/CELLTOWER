# CELLTOWER Platform Architecture
## Multi-Game Score Space, Smart Contract Tournaments, and Replay Verification

### Design document by Aaron Hightower with AI assistance (Claude, Anthropic)
### the High Tower District · Fresno, California
### Version 0.1 · April 2026

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
  record_id:    hex32          // SHA-256 of (game_id + stream + timestamp)
  player_name:  string[3]      // 3-char B92 name (public routing address)
  player_count: uint8          // 1 = solo, 2+ = multi

  // Game coordinates
  game_id:      string         // "CELLTOWER" | "ASTEROIDS" | ...
  game_version: hex32          // SHA-256 of game file (version lock)
  mode_id:      string         // "STANDARD" | "MARATHON" | "PUZZLE" | "CLASSIC" | ...
  session_type: enum           // HUMAN | AUTO | ASSISTED

  // Result
  score:        uint32         // final score
  duration_ms:  uint32         // wall-clock game duration
  pieces/events: uint16        // game-specific action count

  // Verification
  stream:       base92-string  // compact replay (see §1.4)
  terminal_hash: hex64         // SHA-256 chain terminal value
  seed_commit:  hex64          // pre-game seed commitment
  seed_reveal:  hex32          // post-game seed (verifies commit)
  verified:     bool           // local self-check passed

  // Context
  timestamp:    iso8601
  tournament_id: string?       // null for casual play
  chain_id:     uint32?        // EVM chain if tournament entry
}
```

The `record_id` is the primary key. It is deterministic: the same game played identically produces the same record_id. This makes deduplication trivial and fraud detectable (two records with the same stream but different scores cannot both be valid).

---

### 1.3 Game Registry

Each game registers a **Game Descriptor** that the platform uses to understand, replay, and verify its streams:

```
GameDescriptor {
  game_id:        string          // unique short identifier
  display_name:   string          // "CELLTOWER" | "ASTEROIDS" etc.
  version_hash:   hex32           // current live version
  max_duration_s: uint16          // max expected game length (≤600 for platform)
  replay_format:  ReplayFormat    // see §1.4
  modes: [
    ModeDescriptor {
      mode_id:        string      // "STANDARD" | "MARATHON" | "CLASSIC" etc.
      display_name:   string
      player_counts:  uint8[]     // [1] | [1,2] | [2,4] etc.
      score_axis:     string      // "SCORE" | "TIME" | "DISTANCE" | "SURVIVAL"
      min_skill_proof: string?    // e.g. "TETRIS_BONUS_ONCE" for CELLTOWER
    }
  ]
  verify_fn:      string          // name of registered verification function
}
```

The **platform registry** is a static JSON file (or server endpoint) that maps `game_id → GameDescriptor`. Adding a new game is adding a new entry here plus shipping a game file whose hash matches `version_hash`.

---

### 1.4 Universal Replay Stream Format

All platform games use a common stream envelope. The game-specific action encoding lives inside the payload section; the envelope is identical across games.

```
Stream layout (base92-encoded, semicolon-delimited sections):

  HEADER ; PAYLOAD ; [SNAPSHOT ...] ; TERMINAL_HASH

HEADER (comma-delimited):
  seed_hex      — 32 hex bytes (256-bit commit/reveal seed)
  version_hex   — 32 hex bytes (game file SHA-256)
  stats         — game-specific summary (score, duration, event count, etc.)
  game_id       — ASCII game identifier
  mode_id       — ASCII mode identifier

PAYLOAD:
  Variable-length sequence of action records.
  Format defined per game in its ReplayFormat descriptor.
  Each action record is a fixed number of base92 characters (typically 2–4).
  Actions are ordered chronologically.

SNAPSHOT (one or more, emitted every N actions):
  piece_num     — 2 base92 chars (action index at snapshot time)
  state         — game-specific state encoding (board, positions, etc.)
  Minimum: 52 chars. Used for random-access verification.

TERMINAL_HASH:
  64 hex chars — SHA-256 of the full hash chain (H_final)
```

**Hash chain rule (universal):**
- H_0 = SHA-256(seed_bytes)
- H_n = SHA-256(H_{n-1} || action_record_n || state_after_n)

This rule is identical for every game. Only the definition of "action_record" and "state_after" differ.

**Stream size budget:**
For a 10-minute game at 1 action per second, a 4-char action record produces 2,400 base92 characters (~2.4KB). At 10 actions per second (fast arcade play): 24KB. Both fit comfortably in a clipboard paste, QR code (with compression), or single HTTP POST.

---

### 1.5 CELLTOWER Action Record (existing, for reference)

```
posIdx: uint16 (2 base92 chars)   — type*1160 + rot*290 + x*29 + (drop_y+4)
ms:     uint16 (2 base92 chars)   — spawn-to-lock milliseconds (bot detection)
Total:  4 base92 chars per piece placement
```

---

### 1.6 ASTEROIDS Action Record (proposed)

Asteroids gameplay decomposes into per-frame or per-event records. For a 10-minute game at ~30 events/second:

```
Option A — Frame-based (dense, exact replay):
  frame_idx:  uint24               — frame number since game start
  inputs:     uint8 bitmask        — bits: THRUST|LEFT|RIGHT|FIRE|SHIELD
  Total: 5 bytes per frame → 90KB for 10min@30fps (compress to ~15KB)

Option B — Event-based (sparse, human-readable):
  event_type: 4 bits               — THRUST_START|THRUST_END|LEFT|RIGHT|FIRE|KILL|LEVEL|DEATH
  event_data: 12 bits              — rotation (9 bits) + flags (3 bits)
  ms_delta:   16 bits              — ms since last event
  Total: 4 bytes per event → ~2KB for a typical game

Option B is preferred for the platform: smaller stream, same verifiability,
and timing deltas enable bot detection via the same statistical analysis as CELLTOWER.
```

The verifier reconstructs ship position, velocity, and asteroid field deterministically from the seed, then replays events. The terminal hash pins the result.

---

### 1.7 Multi-Player Score Records

For 2-player competitive play, each player produces an independent Score Record with a shared `tournament_id`. The platform links them by `tournament_id` rather than merging them into one record. This keeps the replay format simple (one player per stream) and allows each player's record to be independently verified.

For co-operative play (two players, one score), the stream contains interleaved action records tagged by player index. The state after each action is the joint state. Both players must sign the terminal hash (or both phone-verify) for the record to count.

---

## Part II — Smart Contract Tournament Layer

### 2.1 What the System Does

The CELLTOWER client can connect to any **Tournament Server** — a URL the player pastes in. The server publishes a list of available **Challenges**: skill-based competitions with entry fees and prize pools managed by smart contracts on a public blockchain.

The CELLTOWER client is a **UI intermediary only**. It:
- Displays available challenges and their terms
- Explains the legal landscape in plain language
- Guides the player through wallet connection and entry fee payment
- Submits the player's verified game stream to the contract after play
- Displays the outcome

The CELLTOWER client does **not**:
- Hold funds at any time
- Adjudicate disputes
- Guarantee prize delivery
- Act as a party to any contract

---

### 2.2 Tournament Server Protocol

The server exposes a simple REST API. Any party can run a compliant server.

```
GET  /challenges
     Returns: ChallengeList

GET  /challenges/{challenge_id}
     Returns: ChallengeDetail

POST /challenges/{challenge_id}/enter
     Body: { player_name, wallet_address, tx_hash }
     Returns: { entry_id, deadline, submit_url }

POST /challenges/{challenge_id}/submit
     Body: { entry_id, stream, terminal_hash, score }
     Returns: { accepted, verification_status }
```

**ChallengeDetail schema:**
```json
{
  "challenge_id":   "uuid",
  "title":          "CELLTOWER FRIDAY OPEN",
  "game_id":        "CELLTOWER",
  "mode_id":        "STANDARD",
  "player_count":   1,
  "entry_fee_wei":  "1000000000000000",    // 0.001 ETH
  "prize_pool_wei": "10000000000000000",   // 0.01 ETH (grows with entries)
  "distribution":   [60, 25, 15],         // % to 1st/2nd/3rd
  "contract_address": "0x...",
  "chain_id":       8453,                 // Base mainnet
  "deadline_iso":   "2026-04-25T23:59:59Z",
  "min_entries":    4,                    // cancel if fewer enter
  "operator_fee_bps": 500,               // 5% of pool to operator (pre-specified)
  "tos_hash":       "sha256:...",         // hash of terms accepted at entry
  "required_version": "sha256:..."        // game version lock
}
```

The `operator_fee_bps` field specifies the platform operator's take, expressed in basis points, baked into the contract at creation time. This is a **listing fee structure** — the operator is paid for providing the infrastructure, not for the outcome of play. This distinction matters legally (see Part III).

---

### 2.3 Smart Contract Architecture

The prize contract is a simple escrow with deterministic payout logic:

```solidity
// Pseudocode — not production-ready

contract SkillChallenge {
  address public operator;       // High Tower District or any operator
  uint256 public entryFee;
  uint256 public operatorFeeBps; // set at deploy, cannot change
  uint256 public deadline;
  uint256 public minEntries;
  bytes32 public gameVersionHash;
  bytes32 public modeId;
  uint8[3] public distribution;  // [60, 25, 15] = pct to top 3

  mapping(address => Entry) public entries;
  Entry[] public leaderboard;    // sorted by verified score

  struct Entry {
    address player;
    bytes32 terminalHash;        // submitted post-game
    uint32  score;               // submitted post-game
    bool    verified;            // set by on-chain or oracle verification
    uint256 paidIn;
  }

  // Player enters before deadline
  function enter(bytes32 playerName) external payable { ... }

  // Player submits verified stream after game
  // Verification: either on-chain (expensive) or via trusted oracle
  // Oracle is the Tournament Server — its signed attestation that
  // the stream replays to the claimed score.
  function submitScore(bytes32 terminalHash, uint32 score, bytes calldata oracleSig) external { ... }

  // Anyone can call after deadline + verification window
  function distribute() external {
    // Sort entries by score
    // Pay top 3 their distribution percentage
    // Pay operator operatorFeeBps of total pool
    // Refund if minEntries not met
  }
}
```

**Key properties:**
- Funds move directly from players to contract to winners
- Operator fee is fixed at deploy time, visible to all entrants before they pay
- If `minEntries` is not reached, all entry fees are refunded
- The contract is open-source and auditable; no party needs to trust the operator

---

### 2.4 Verification Oracle

Full on-chain replay verification of a Tetris game is computationally expensive. The platform uses a **lightweight oracle model**:

1. The Tournament Server acts as the verification oracle for challenges it lists
2. After a player submits a stream, the server runs `_verifyStream()` (the same portable verification core embedded in the game)
3. If valid, the server signs the result: `oracle_sig = ECDSA(server_privkey, hash(challenge_id + player_address + score + terminal_hash))`
4. The player submits `oracle_sig` to the smart contract
5. The contract verifies the oracle's signature (trusting the registered oracle for this challenge)

**Oracle trust model:**
The oracle's public key is embedded in the contract at deploy time. Anyone can run their own oracle and deploy their own challenges. The High Tower District's oracle is one option; it is not the only one. Disputes about oracle honesty are disputes between the operator of that oracle and the players who chose to enter that operator's challenge — not disputes involving the game client.

For high-stakes challenges, a **multi-oracle** model can require 2-of-3 independent verifiers to agree before a score is accepted. This is a future enhancement; the protocol supports it by making `oracleSig` an array.

---

## Part III — Legal Architecture and Liability

### 3.1 The High Tower District's Legal Position

The High Tower District (HTD) occupies a specific and limited role in the tournament ecosystem:

**What HTD does:**
- Develops and publishes the game client software
- Operates one instance of a Tournament Server (optionally)
- Charges operators a listing fee for publishing challenges on HTD's server (a flat or percentage fee paid at challenge creation, not from player losses)
- Provides the verification oracle service

**What HTD does not do:**
- Hold player funds
- Set or guarantee prize amounts
- Determine winners
- Serve as a party to any player-to-player or player-to-contract transaction

This structure is analogous to a **marketplace or exchange operator** rather than a gaming operator. The relevant legal precedent is closer to eBay's relationship to auction outcomes than to a casino's relationship to gambling results.

---

### 3.2 California Legal Framework

#### The Dominant Factor Test (Reiterated)

As described in `verification.md`, California uses the dominant factor test to distinguish skill contests from gambling. CELLTOWER qualifies as skill-dominant. The smart contract tournament layer does not change this analysis — it changes only the payment and prize distribution mechanism, not the nature of the underlying competition.

#### Entry Fees and Prize Pools

California permits entry-fee skill competitions under multiple frameworks:

- **Penal Code §337**: "Banking or percentage games" are prohibited. CELLTOWER tournaments are not banking games — no participant profits systematically from other players' losses. The house does not play.

- **Business & Professions Code §17539 et seq.**: Promotional contests and sweepstakes rules. CELLTOWER tournaments are skill contests, not promotions — the winner is determined by performance, not random selection.

- **AB 831 (effective January 1, 2026)**: Prohibits dual-currency casino-simulation sweepstakes. CELLTOWER is not a casino simulation and does not use a dual-currency model. AB 831 does not apply.

#### The Operator Fee

The HTD operator fee, collected at challenge creation time, is a **service fee for infrastructure provision** — comparable to a tournament entry platform charging a listing fee. It is not:
- A rake (percentage of losses)
- A house edge (built-in mathematical advantage)
- A percentage game (profit from player outcomes)

The fee is fixed, public, and collected before any player enters. All parties can see exactly what the operator earns before committing funds. This structure does not trigger §337's prohibition on percentage games.

#### Smart Contract Dispute Resolution

Smart contracts execute deterministically based on inputs. The inputs are:
- Entry fees (paid voluntarily, on-chain, public)
- Verified game scores (mathematically provable from replay streams)
- The distribution formula (specified at contract creation, immutable)

There is nothing to dispute in a properly functioning contract. The math runs. The prizes distribute.

**In the event of a genuine dispute** (oracle malfunction, contract bug, chain reorganization), the dispute is between the parties to the contract — the players and the contract operator. HTD, as the game client developer, is not a party to the contract and has no obligation to adjudicate or compensate.

The smart contract's source code, the oracle's public key, and the verification protocol are all public. Any qualified attorney or blockchain expert can audit the system without access to any private information held by HTD. This is the transparency guarantee that makes the legal position defensible: **the proof is public, the code is public, the math is public**.

---

### 3.3 Absolving HTD from Contract Disputes

When a player enters a tournament through the CELLTOWER client, they are presented with a confirmation screen that includes:

```
YOU ARE ABOUT TO ENTER A SKILL COMPETITION.

ENTRY FEE:     [amount and currency]
PRIZE POOL:    [current pool amount]
OPERATOR:      [operator name, not necessarily HTD]
CONTRACT:      [blockchain address — tap to view on explorer]
ORACLE:        [oracle operator name and public key hash]
CHAIN:         [network name]

THE HIGH TOWER DISTRICT BUILT THE GAME.
THE HIGH TOWER DISTRICT IS NOT THE OPERATOR
OF THIS COMPETITION AND IS NOT RESPONSIBLE
FOR PRIZE DISTRIBUTION OR DISPUTES.

YOUR ENTRY FEE IS SENT DIRECTLY TO A SMART
CONTRACT. IT IS NOT HELD BY ANY PERSON.
PRIZES ARE DISTRIBUTED AUTOMATICALLY BY
THE CONTRACT BASED ON VERIFIED SCORES.

DISPUTES ARE BETWEEN YOU AND THE CONTRACT
OPERATOR. THE GAME CLIENT IS A TOOL —
LIKE A BROWSER. THE BROWSER IS NOT LIABLE
FOR WHAT WEBSITES DO.

[ I UNDERSTAND. CONNECT WALLET AND ENTER. ]
[ CANCEL ]
```

This disclosure — combined with the public availability of all contract parameters — constitutes informed consent. The analogy to a browser is deliberately chosen: no court has held a browser developer liable for financial transactions conducted through websites the browser navigates to.

---

## Part IV — Revenue Model for the High Tower District

### 4.1 Sources of Revenue

HTD generates revenue through the following mechanisms, in increasing order of scale:

1. **Oracle service fee**: Challenges using HTD's verification oracle pay a per-verification fee. This is a pure service transaction — HTD does computational work (stream verification) and charges for it.

2. **Listing fee**: Challenges published on HTD's Tournament Server pay a flat listing fee or a percentage of the operator fee collected at challenge creation. HTD earns this at listing time, before any player enters.

3. **First-party tournaments**: HTD may operate its own challenges, earning the operator fee as the challenge operator (not as the game developer). When HTD wears this hat, it is subject to the same rules as any operator.

4. **DM system revenue** (see `tos.md`): Future per-message fees for the fan mail system.

5. **Smart contract licensing**: Other game developers who implement the platform's verification protocol and registry may pay a licensing fee to use HTD's oracle infrastructure and Tournament Server listing.

### 4.2 What HTD Does Not Do

HTD does not take a percentage of player losses. HTD does not operate as a "house." HTD does not hold player funds. These are not just legal protections — they are design principles. A platform that profits from player losses has an incentive to make the game worse. A platform that profits from infrastructure provision has an incentive to make the infrastructure better.

---

## Part V — Future Games and Platform Extension

### 5.1 ASTEROIDS Clone (Next Game)

The second platform game is an Asteroids-style shooter. Score dimensions:

| Axis | Values |
|------|--------|
| mode | CLASSIC (3 lives, waves) · SURVIVAL (one life, infinite) · TIMED (90-second sprint) |
| player_count | 1P · 2P cooperative |
| session_type | HUMAN · AUTO |

The replay stream uses the event-based format described in §1.6. A typical 3-minute CLASSIC game produces approximately 1,800 event records × 4 bytes = 7.2KB uncompressed. Well within the 10-minute platform budget.

Score verification: the verifier reconstructs ship physics from the seed-derived asteroid field, replays player inputs, and confirms the terminal hash. The asteroid RNG is seeded and deterministic — the same seed produces the same field every time.

### 5.2 Leaderboard Query Model

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

The wildcard axis enables cross-game rankings (who is the best overall platform player?) and cross-mode rankings within a game (who plays the most CELLTOWER regardless of mode?).

### 5.3 Platform Score Identity

The player's 3-character name is the routing address across all games and modes. A player named **ACE** has one name but may appear on multiple leaderboards. The identity system does not need to change — the name is just a label on the Score Record, and the Score Record carries the game/mode/count coordinates that place it in the right leaderboard.

The fan DM system routes messages to the holder of `{game_id}/{mode_id}/{name}` — the best ACE in CELLTOWER Standard, the best ACE in Asteroids Classic, and so on. A player who excels across multiple games can hold multiple routing addresses simultaneously.

---

## Summary

The platform architecture provides:

- A **universal Score Record schema** that accommodates any game, any mode, any player count
- A **universal replay stream format** with game-specific payload encoding inside a common envelope
- A **game registry** for adding new titles without changing the platform infrastructure
- A **tournament server protocol** that any operator can implement
- A **smart contract template** for skill-based cash-prize competitions
- A **legal structure** that places HTD in the infrastructure provider role, not the gambling operator role
- A **revenue model** based on service fees, not player losses

The whole system is designed so that the proof is always public, the code is always auditable, and the money always moves between consenting parties through transparent mechanisms — not through an opaque house.

---

*Platform Architecture v0.1 — Pre-implementation design document*
*CELLTOWER · the High Tower District · Fresno, California*
*AI design and drafting partner: Claude (Anthropic)*
*This document does not constitute legal advice. Consult qualified legal counsel before implementing any tournament or prize distribution system.*
