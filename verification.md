# CELLTOWER Verification System
## Cryptographic Score Authentication for Skill-Based Competition

### A Design Document by Aaron Hightower
### the High Tower District · Fresno, California

---

## Purpose

This document describes the design of a cryptographic verification system for CELLTOWER, a competitive Tetris trainer. The system produces a compact, tamper-evident replay stream that proves a game was played as recorded — enabling cash-prize skill-based tournaments that comply with California law.

The verification architecture draws on direct experience with linked-cabinet tournament systems at Atari Games and competitive arcade score verification communities (MAME/wolfMAME). It applies those principles to modern mobile web gameplay using standard cryptographic primitives.

---

## The California Legal Framework

### Skill Versus Chance: The Dominant Factor Test

California uses the "dominant factor" test to distinguish legal contests of skill from prohibited gambling. Under Penal Code §330 and related sections, an activity constitutes gambling when three elements are present: prize, consideration (entry fee), and chance. Remove any one element and the activity falls outside the prohibition.

The critical question is not whether chance exists at all — it is whether skill or chance is the *dominating factor* in determining the outcome. As established in *In re Allen* (59 Cal.2d 5), the test applies to the character of the game itself, not the abilities of any particular player.

California's Penal Code §330.5 explicitly exempts "pinball, and other amusement machines or devices which are predominantly games of skill" from slot machine prohibitions — establishing a statutory precedent that skill-based electronic games occupy a legally distinct category from chance-based gambling devices.

### What AB 831 Prohibits — And What It Does Not

Assembly Bill 831, signed by Governor Newsom on October 11, 2025 and effective January 1, 2026, prohibits online sweepstakes platforms using dual-currency models that simulate casino-style gambling (slots, poker, roulette, etc.) for cash prizes. The law adds Penal Code §337o and amends Business & Professions Code §17539.1.

AB 831 targets a specific structure: platforms where players purchase virtual currency, play chance-based games that mimic casino gambling, and redeem winnings for cash. The law explicitly preserves legitimate promotional sweepstakes and does not address skill-based contests.

CELLTOWER is none of the things AB 831 prohibits. It does not simulate casino-style gambling. It does not use a dual-currency model. It does not offer chance-based outcomes. It is a competitive skill game — a puzzle requiring spatial reasoning, pattern recognition, and manual dexterity — in the same legal category as chess tournaments, competitive puzzle solving, and eSports competitions.

### The Spirit of California's Approach

California's gaming laws reflect a consistent legislative philosophy: protect consumers from exploitation by chance-based systems masquerading as entertainment, while preserving the freedom to compete in genuine contests of skill. The state has a long history of permitting entry-fee competitions where skill determines the outcome — from horse racing (constitutionally authorized) to licensed card rooms to competitive gaming events.

The verification system described here is designed to honor that philosophy. Rather than obscuring how outcomes are determined — as chance-based systems inherently must — this system makes every aspect of gameplay transparent, auditable, and mathematically provable. The technology serves the same protective purpose as the laws: ensuring that when money changes hands based on a game's outcome, that outcome was legitimately earned through skill.

---

## Why Tetris Qualifies as Skill-Dominant

### The Game's Structure

NES Tetris presents the player with a sequence of seven possible piece types. The player must place each piece on a 10-column, 25-row playfield by choosing its rotation (4 states) and horizontal position (up to 10 columns). Completed rows are cleared. The game ends when pieces stack to the top.

### Chance Elements

The piece sequence is random. A player cannot predict or influence which piece comes next. This is the sole element of chance in the game.

### Skill Elements

Every placement decision is a skill decision. The player must evaluate the current board topology, the piece in play, the next piece in preview, the column heights, existing holes, well positions, and scoring opportunities — then execute a motor action (touch/button input) within a time constraint that increases with level. The skills involved include spatial reasoning and pattern recognition (reading the board), strategic planning (Tetris-prep well management, hole avoidance), tactical decision-making (line clear timing, T-bonus optimization), and manual dexterity under time pressure (piece placement speed).

### Empirical Evidence of Skill Dominance

Competitive NES Tetris tournaments (CTWC) consistently produce the same top players across events. Skill differentials between players are enormous — novices score under 100,000 while elite players exceed 1,000,000 on identical piece sequences. The random piece sequence creates variety but does not determine outcomes: a skilled player will outscore an unskilled player on any sequence. This is the hallmark of a skill-dominant game under the dominant factor test.

### Tournament Format Amplification

Multi-round tournament formats further reduce the influence of chance. Over a series of games, a player's skill level converges to their true ability. A single unlucky piece sequence might affect one game; it cannot systematically disadvantage a skilled player across a best-of-five or round-robin bracket. This is analogous to how poker tournaments use multiple hands to ensure skill predominates — except in Tetris, the skill advantage is even more pronounced because every decision point is a skill decision, not a betting decision.

---

## The Verification Architecture

### Design Philosophy

The verification system is built on a principle borrowed from competitive arcade gaming: **the replay is the proof**. Not a screenshot, not a video, not a witness statement — a mathematically verifiable record of every game action that can be independently replayed to confirm the final score.

This approach eliminates the need to trust any party — not the player, not the platform operator, not a tournament organizer. The math is the arbiter.

### Board State Representation

The game board is represented as 25 sixteen-bit words, one per row. Each word uses 10 bits (one per column), where 1 = occupied and 0 = empty. The upper 6 bits of each word are zeroed. This representation is derived from efficient collision detection techniques used in resource-constrained systems — the same bit-packed board format enables both gameplay physics and verification with identical operations.

A complete board snapshot is 50 bytes (25 x 16-bit words). With run-length encoding of leading zero-words (empty rows at the top of the board), early-game snapshots compress to approximately 13-20 bytes.

### The Replay Stream

The verification stream is a compact binary format consisting of four frame types.

**M-frame (Metadata):** One per game, at the stream header. Contains the game version hash (SHA-256 of the game code), the random seed commitment, a timestamp, and a player identifier. Approximately 48 bytes.

**P-frame (Placement):** One per piece placed. Encodes the piece type (3 bits, 7 types), the rotation index at lock time (2 bits, 4 states), and the net horizontal offset from spawn position (signed 4 bits). Total: 2-3 bytes per placement. The vertical drop position is not stored — it is deterministically derivable by replaying gravity against the board state. This is the dominant frame type, comprising approximately 95% of the stream.

**I-frame (Keyframe):** A complete board snapshot (50 bytes or RLE-compressed equivalent). Emitted periodically (every N placements) to enable random-access verification — a verifier can start from any I-frame without replaying from the beginning. Also serves as an integrity checkpoint: the board state derived from replaying P-frames must match the I-frame exactly.

**H-frame (Hash Checkpoint):** A 4-byte truncated SHA-256 chain value. The hash chain is computed over the full derived board state at each placement, regardless of whether the stream contains I-frames at that point. H-frames allow integrity verification without full replay.

### Stream Size

A typical 300-piece game produces approximately 1,200 bytes total: 1 M-frame (48 bytes) + 300 P-frames (~900 bytes) + 10 I-frame keyframes (~200 bytes) + 10 H-frames (40 bytes). This compresses to approximately 1,324 bytes — trivially small for share-sheet or clipboard transport.

### The Hash Chain

The cryptographic chain operates as follows. H₀ is the SHA-256 hash of the game seed. For each subsequent placement n, the verifier reconstructs the board state by applying the P-frame operation (piece placement via bitwise OR of piece pattern into board words, followed by line clear detection and removal). Hₙ is then computed as SHA-256(Hₙ₋₁ concatenated with the placement record). The terminal hash H_final is the game's cryptographic fingerprint.

A 5-character base-40 receipt code is derived from the first 4 bytes of the current hash, displayed live on the game canvas and printed on the game receipt. This code updates after every piece placement.

### Piece Operations as Bitwise Transforms

The same operations that run during gameplay execute during verification. A piece is 4 sixteen-bit words (one per row of its bounding box). Moving left shifts all 4 words left by one bit. Moving right shifts right by one bit. Rotation swaps which of 4 pre-stored bit patterns is active. Collision detection is a bitwise AND between the piece words and the corresponding board words — a nonzero result means collision. Locking is a bitwise OR of the piece words into the board words at the current offset.

Because the game physics and the verification physics are identical bit-level operations, there is no translation layer between "what the game computed" and "what the verifier checks." Any discrepancy is proof of tampering.

### Provably Fair Piece Sequences

The random piece sequence must be demonstrably fair — neither the player nor the platform can have influenced it after commitment. The system uses a commit-reveal scheme: before the game begins, the server publishes a hash of the random seed. After the game ends, the seed is revealed. Anyone can verify that the hash matches the seed and that the seed produces the recorded piece sequence through the deterministic random number generator.

The piece type bits in each P-frame serve as a redundancy check against the seed-derived sequence. If someone patches the game to feed themselves favorable pieces, the P-frame piece types will not match the sequence generated from the committed seed. This is detectable without replaying the game — a simple sequence comparison suffices.

### Bot Detection

The verification stream cannot inherently distinguish human input from automated input. A cheater who silently invokes the game's AI pathfinder while pretending to play manually would produce a valid stream. To address this, each P-frame includes a 2-byte timing field: milliseconds elapsed from piece spawn to lock. Human players exhibit characteristic timing signatures — variable reaction times, corrective movements, pauses before decisions. Automated play produces unnaturally uniform timing. Statistical analysis of placement timing distributions provides a secondary integrity signal, analogous to engine-detection methods used in competitive chess.

### Transparency, AI Participation, and the Turing Layer

CELLTOWER does not prohibit bots from competing. This is a deliberate design position, not an enforcement gap, and it requires explanation.

The cryptographic verification system proves that a game was played as recorded — that the pieces landed where the stream says they landed, in the sequence the seed committed to, without post-hoc fabrication. It does not prove that a human hand held the phone. No system can prove that at the hardware level without physical attestation mechanisms that would make the game inaccessible to casual players. Claiming otherwise would be false advertising.

Instead, the platform embraces transparency about this limitation and converts it into a feature.

**Bots are welcome to compete. They are expected to lose the part that matters.**

The verification layer proves the score. The identity layer proves the person. A bot can post a verified score under any three-character name. It cannot answer its fan mail. It cannot verify a phone number and receive text messages from its fans. It cannot show up to a tournament. It cannot accept a prize check. When a suspicious score sits atop a leaderboard and its holder never responds to direct messages, never verifies a phone number, never produces a human face — the platform community and its operators can draw the obvious conclusion.

This is the same mechanism that exposes sockpuppets in competitive chess: the engine can win the game, but it cannot attend the post-game press conference.

The direct message system thus functions as a **Turing layer** — a second test layered beneath the cryptographic one. The first test is mathematical: did you play as recorded? The second test is social: are you a person? A bot passes the first and fails the second. Over time, a leaderboard position that never acknowledges its fans is a leaderboard position under suspicion.

This does not make the system foolproof. A human operator running a bot could answer the fan mail themselves. But that human has now inserted themselves into the accountability chain — they are verifiably responsible for the score, even if they did not personally execute it. That level of accountability is sufficient for the platform's purposes.

---

## The Satoshi Factor — A Fictional Framing

*The following section is speculative fiction. It is offered as entertainment and as an honest acknowledgment that the boundary between human creativity and machine assistance in this project is genuinely blurry — and that this blurriness is, itself, interesting.*

---

Consider a hypothetical: the highest score ever recorded on CELLTOWER is posted by a player named **CLK**. The stream verifies perfectly. The timing signatures are inhuman — not uniform like a naive bot, but optimally variable, as if the player had solved the timing distribution problem and sampled from it deliberately. The score is unreachable by any known human. CLK never verifies a phone number. CLK never answers fan mail.

Who is CLK?

One answer: CLK is a bot, running on hardware somewhere, operated by a person who is embarrassed to admit it or motivated to prove a point.

Another answer — the 2049 fictional answer — is more interesting.

The creator of CELLTOWER built the verification system with a particular architecture: a deterministic replay stream, a hash chain, a provably fair seed. These are the same primitives used to build blockchains. They are also, in a certain light, the primitives of a message in a bottle — a way to say *I was here, I did this, and you can verify it* without trusting any intermediary.

What if the first entity to post a perfect game under the name **CLK** is not a human at all, but something that came later — something that found the game, understood its rules, and left a verified score as a kind of signature? What if the score is dated, in the stream header, to a timestamp that makes no sense? What if the seed commitment predates the game's existence?

This is the Satoshi Factor: the possibility that the most important participant in a system is also the most anonymous one, and that their identity — human or otherwise — is proven not by a document or a face but by the quality and consistency of their work over time.

Bitcoin's creator published a whitepaper, vanished, and left behind a system that now moves trillions of dollars. No one has ever definitively proven who Satoshi Nakamoto is. The work is the proof of existence.

CELLTOWER's verification system was designed so that the score is the proof. A perfect score, cryptographically verified, achieved under impossible conditions, by an identity that answers no mail — is either a fraud detectable by the community, or it is something else entirely. The system is designed to tell you which. It is not designed to prevent the second possibility from being interesting.

**This is entertainment.** The 2049 storyline in which an AI trained on human Tetris play posts a verified score from a future timestamp, leaving its hash chain as a kind of time-capsule signature, is a fictional premise — a thought experiment about what it would mean to build a system honest enough that even its most implausible outcomes are verifiable.

The real system is built by a human, in Fresno, in 2026, with an AI development partner that writes code but does not hold high scores. At least not yet.

---

### Version Attestation

The M-frame includes the SHA-256 hash of the `index.html` file loaded by the player's browser. This pins the game physics to a specific auditable codebase. For tournament play, all competitors run the same version-locked file. If someone modifies the game to alter scoring, remove gravity, or change piece physics, the version hash will not match the tournament's registered version.

### Live Tournament Monitoring

During tournament play, the game transmits H-frame hash checkpoints to a server in real time (not the full stream — just the 4-byte hash at periodic intervals). The server logs these with timestamps. Post-game, the full stream is submitted and the server confirms that the embedded H-frames match what it received live. This proves the stream was generated during real-time play and not reconstructed after the fact.

---

## How This Serves California's Regulatory Intent

### Transparency Over Obscurity

Chance-based gambling systems are inherently opaque — the player cannot know or verify the odds, the house edge, or whether the random number generator is fair. California's gambling laws exist in large part to protect consumers from this opacity.

This verification system inverts that relationship entirely. Every aspect of the game is transparent: the piece sequence is provably fair (commit-reveal), the game physics are open source (single auditable HTML file), and every placement is recorded and independently verifiable. A player, a regulator, or an independent auditor can replay any game and confirm the score was legitimately earned.

### No House Edge, No Banking

CELLTOWER tournaments operate as peer-to-peer skill contests, not banking or percentage games. There is no house that profits from player losses. Entry fees fund a prize pool distributed to top performers based on verified scores. The platform operator's revenue comes from entry fee administration, not from an edge built into the game. This structure falls outside the prohibitions of Penal Code §330, which targets "banking or percentage games."

### Fraud Prevention as Consumer Protection

The verification system protects players from each other — ensuring that scores submitted for prize money were actually achieved through legitimate play. This serves the same consumer protection purpose that California's gaming regulations serve: preventing fraud and ensuring fair outcomes.

The system also protects tournament operators from liability. If a score is challenged, the replay stream provides mathematical proof of its validity (or invalidity). There is no subjective judgment required, no reliance on witnesses, and no possibility of a "he said / she said" dispute.

### Skill Measurement, Not Chance Exploitation

The entire system is designed to measure and reward skill as accurately as possible. The provably fair piece sequence ensures that chance does not systematically advantage any player. The multi-round tournament format averages out single-game variance. The verification system ensures that the skill demonstrated is genuine.

This aligns with the spirit of California's distinction between skill contests and gambling: when skill is the dominant factor, when outcomes are transparent, when the competition is fair, and when consumers are protected — the activity is a legitimate contest, not gambling.

---

## Prior Art and Lineage

This verification architecture descends from linked-cabinet tournament systems developed at Atari Games for competitive arcade play in the late 1990s. Those systems used hardware-level player data storage across networked cabinets to enable authenticated competitive play with cash prizes. The key insight — that the placement record is the proof, and that the game physics must be the verification physics — was established through direct experience with competitive exploit hunters and fraudulent world record claims in that era.

The wolfMAME replay verification community independently validated the same approach: deterministic replay files that reproduce gameplay frame-by-frame, with any modification to inputs producing a divergent outcome detectable by hash comparison.

CELLTOWER applies these proven principles to modern web technology, using standard cryptographic primitives (SHA-256) and compact binary encoding to produce verification records small enough to share via the device share sheet or clipboard — making the proof portable, shareable, and independently verifiable by anyone with a web browser.

---

## Summary

The CELLTOWER verification system is designed to enable something specific: cash-prize competitive Tetris tournaments that are legal in California, fair to players, transparent to regulators, and resistant to fraud.

It achieves this through a combination of provably fair randomization (commit-reveal seed protocol), open-source auditable game physics (single-file HTML, version-hashed), compact tamper-evident replay streams (bitwise board representation, SHA-256 hash chain), bot detection (placement timing analysis), and live tournament monitoring (real-time hash checkpoint transmission).

The system is built to follow the spirit of California's gaming laws: skill determines outcomes, chance is minimized and provably fair, every aspect of play is transparent and verifiable, and consumers are protected from fraud. This is not a gambling system seeking a legal loophole. It is a skill measurement system seeking to prove, mathematically, that the best player won.

---

*CELLTOWER is an independent project by Aaron Hightower, Fresno, California.*
*AI development partner: Claude (Anthropic)*
*Document version: 1.0 · April 2026*
