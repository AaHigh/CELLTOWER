# AGENTS.md — CELLTOWER: Shared Context for AI Agents

**Purpose of this file:** Any AI agent working with Aaron Hightower on this project
should read this first. It exists so every agent — regardless of vendor — works from
the same facts, the same terminology, and the same legal framing. If something here
conflicts with the code, the code wins (see Document Hierarchy below). If something
here conflicts with Aaron's direct instructions, Aaron wins.

*Maintained by Aaron Hightower · the High Tower District · Fresno, California*
*This version: October 23, 2026*

---

## 1. Who Aaron Is

- **Aaron Michael Hightower**, Fresno, CA. Game developer since 1984.
- Former **lead programmer, Atari Games coin-op** — *San Francisco Rush 2049* (1999).
- Former **President of NanoTech Gaming**; developed the **BetCube** platform.
- His Tetris lineage runs back to **1991**: *Yet Another Tetris Clone (YATC)* on the Amiga.
- GitHub: `AAHIGH`. Live game: **celltower.ahightower.com** (GitHub Pages, this repo).

## 2. What CELLTOWER Is

A hardcore, NES-style falling-block **trainer** built for iPhone Safari — designed to
teach real NES Tetris technique (read the board, stack clean, manage the Tetris well),
not casual mobile habits.

- **Architecture:** a single self-contained `index.html` — pure HTML5 Canvas, zero
  dependencies, no build step, no framework. Game logic, rendering, audio synthesis,
  and layout all live in that one file. Preserve this architecture.
- NES-accurate piece set and rotation, NES speed curve into kill-screen territory.
- **Ghost system:** 4 computed look-ahead placements shown as outlines; tap one to place.
- **AUTO mode:** built-in AI demo play. AUTO scores are tracked separately and must
  **never** overwrite or qualify as human high scores.
- Every finished game prints a **Transaction Receipt** — a full scoring ledger of what
  was earned, when, and why.

## 3. Scoring Philosophy (do not casually change)

- **Clean pieces** (placements that create no new holes) build the **T-BONUS** multiplier.
- **Tetris clears** (4 lines at once) pay out big — but only reward players who have
  been stacking clean.
- **Holes** are counted live and penalized; a holey board kills the multiplier.
- Scoring semantics are part of the product's integrity. Any change to scoring,
  piece physics, or timing must be deliberate, documented, and approved by Aaron.

## 4. Verification Is the Product

CELLTOWER's reason to exist beyond training is **provable human skill**. A score is
only worth money if it can be proven. Key mechanisms (full detail: `verification.md`
and `stream.md`):

- **Replay stream:** every game produces a compact, tamper-evident stream of every
  placement. The replay *is* the proof — not a screenshot, not a video.
- **Hash chain:** SHA-256 chained over the derived board state at each placement
  (H₀ = hash of the seed; Hₙ = SHA-256(Hₙ₋₁ ‖ placement)). The terminal hash is the
  game's fingerprint. Game physics and verification physics are the *same* bit-level
  operations — any discrepancy is proof of tampering.
- **Commit-reveal seeds:** the seed hash is published before the game; the seed is
  revealed after. Nobody — player or platform — can steer the piece sequence.
- **Humanity Probability Score (HPS):** each placement records spawn-to-lock timing
  (`timing_ms`), correlated against **Decision-Path Conflict (DPC)** — how close the
  AI's top two placements were at that moment. Humans hesitate where decisions are
  actually hard; bots don't. A **Neural Processing Floor** (~150 ms) flags
  high-conflict placements resolved in neurologically impossible time.
- **HPS failure voids a prize submission by contract.** A perfectly valid hash chain
  from a bot still does not qualify for prize money. The liability for bot-assisted
  play falls on the submitter, not the platform.

## 5. Document Hierarchy — Read This Before Editing Anything

From `platform.md` (the repo's own conflict-resolution rule):

| Document | Role |
|---|---|
| `index.html` | **Ground truth** — the running code; authoritative for anything currently executing |
| `stream.md` | Current implementation spec — wire format, encoding, hash chain **as built today** |
| `platform.md` | Target architecture — forward-looking design for features **not yet built** |
| `verification.md` | Verification design + California legal framework |
| `vision.md` | Philosophy, legal posture, long-term direction |
| `monetization.md`, `cardroomlaw.md` | Business model and card-room legal structure |
| `why_aaron_builds.md` | Aaron's own statement of purpose — read it before proposing direction changes |
| Dated `.md` files | Dev log / working notes, newest thinking last |

Rules: `stream.md` beats `platform.md` for anything already in `index.html`.
`platform.md` governs features not yet built. Lines marked
`[TARGET — not yet implemented]` are plans, not facts about the running game.
Lines marked `[SUPERSEDED by stream.md]` are history.

## 6. Legal Framing (California) — Get This Right

- CELLTOWER is a **contest of pure skill**, designed to satisfy California's
  **dominant factor test** (*In re Allen*, 59 Cal.2d 5; Penal Code §330, §330.5).
  The only chance element is the piece sequence; every outcome-determining decision
  is the player's.
- **AB 831** (eff. Jan 1, 2026) bans dual-currency online sweepstakes casinos.
  CELLTOWER uses no dual currency, simulates no casino game, and offers no
  chance-based outcome — it is outside what AB 831 prohibits.
- **Neutral platform model:** the operator is never the house and never banks the
  game. Players stake against *each other*; the platform provides the game, the
  verification oracle, and the infrastructure for a small, transparent service fee,
  and takes **no share of the prize pool**. Payouts are conservatively capped
  (currently 2×) to stay clearly legal.
- **The card-room analogy** (`platform.md` Part II) is the structural template:
  dealer / cardroom / players stay separate, exactly as in a California card room —
  and any tournament contract is a per-event "piggy-bank": single-purpose,
  creator-bounded, self-refunding on expiration.
- **Terminology — "the corporation":** in the California card-room world Aaron works
  in, *the corporation* is the separate third-party banking entity (proposition
  player service) that pays winners and takes the gambling risk. The casino itself
  (e.g., Kyle Kirkland's Club One) only provides the room and dealers and earns
  per-hand collection fees and tips — it never banks games. The separation exists
  to prevent malfeasance: the business serving liquor has no profit interest in
  players losing. Do not conflate the casino and the corporation.

## 7. The Three-Leg Platform (Aaron's framing, Oct 2026)

CELLTOWER is leg three of one platform Aaron is assembling to present as a whole:

1. **Cooking** — "HOT & HAPPY PIZZA!": Aaron's mobile pizza operation (Ooni Karu 2
   on a wheeled cart) and the **Block Party Pizza Competition**, South Tower
   District, Fresno — judged categories, $10 entry, cash prizes, DIY cookers.
   Same pure-skill contest shape: judged on craft, not chance.
2. **Physical arcade** — **Asteroids**, and hopefully **Asteroids Deluxe**, as real
   cabinets on the same verification platform. (An Asteroids action-record format
   is already proposed in `platform.md` §1.6; `ASTEROIDS` is already a `game_id`
   in the score-space schema.)
3. **CELLTOWER** — the cell-phone game in this repo.

**Endgame:** present the platform to **Kyle Kirkland** (owner, Club One Casino,
Fresno; president, California Gaming Association; candidate for Congress, CA-21).
The intent is that Kirkland — or his own AI agent — can read this GitHub and see
the full record of how long Aaron has been building toward this, so the platform
can be monetized by both parties, within the law, inside the card room's existing
two-entity structure. This repo's history is part of the evidence. **Commit history
matters. Do not rewrite it.**

## 8. Proof-of-Concept History (facts, not plans)

- Repo created **February 28, 2026**; 222 commits by October 23, 2026.
- **v0.420** — first playable release, April 20, 2026. **v0.6112026** — second
  playable release (current per README).
- **$20 challenge:** offered to a player in need — $20 for a verified 100,000.
- **$10,000 Adrian Ludley challenge:** formal "Private Instrument of Skill
  Challenge" (Sept 2, 2026) — $10,000 to Adrian "Radar" Ludley (Aaron's lead
  artist on *Rush 2049*) for 1,000,000 points by his own hand by noon Sept 3,
  2026. Adrian did not reach it. Aaron himself has scored 1,000,000.
- **Thursday Night Skill Sessions:** invitational live CELLTOWER series planned
  for the Tower District, Fresno — 5 competitors, session window in the two hours
  before golden hour, prizes at sunset. Tagline: *"Verified Skill. Real Stakes.
  High Tower District."*

## 9. Working Rules for Agents

1. **Read before you write.** Start with `README.md`, `vision.md`,
   `why_aaron_builds.md`, then this file; go to `stream.md` / `platform.md` /
   `verification.md` for depth.
2. **Never present a `[TARGET]` feature as implemented.** Check `index.html` or
   `stream.md` first.
3. **Never weaken verification, HPS, or seed integrity** to make something easier.
   That machinery is the legal and commercial foundation of the whole platform.
4. **Preserve the single-file architecture** of the game unless Aaron directs
   otherwise.
5. **Aaron's facts about his own life and history are ground truth.** If a source
   disagrees with Aaron about Aaron, Aaron is right — note the discrepancy, don't
   "correct" him.
6. **Keep his hedges.** When Aaron says "as far as I know" or frames something as
   his interpretation, carry it that way.
7. Aaron values his time highly (his last contract rate was $1,250/hour). Be
   direct, verify before you claim something works, and never send him down a
   flow you haven't confirmed.
8. Faith matters to Aaron — he is a believer in the Lord Jesus Christ, and the
   platform is being built lawfully and humbly on purpose. Treat that as context
   for his decisions, not as decoration.

---

*Not affiliated with The Tetris Company or Nintendo. CELLTOWER is an independent
project by Aaron Hightower.*

