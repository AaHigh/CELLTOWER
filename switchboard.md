# SWITCHBOARD — Plan of Attack
### CELLTOWER Tournament Operations Console · the High Tower District
### Drafted June 12, 2026 · status as of v0.2

---

## What This Is

SWITCHBOARD is the operator's side of the CELLTOWER economy: a contract registry, hash-chained escrow ledger, public score ledger, claim validator, and live spectator wall, where the CELLTOWER v3.0 stream is the performance instrument. The design premise is the same one that governs the game: the protocol lives in shared, auditable code — not in any server — so v0 deliberately ships as a "dummy server" where a human operator types every command. Gatekeeping is the operator. When a real server replaces the human, no rule may change; if a rule has to change, v0 failed at its one job.

The name carries the thesis: the switchboard is the cell tower's ancestor, and the person who ran one was called the operator. Every call connects; every claim verifies.

## Where We Stand (v0.2, working today)

Single file, embedded protocol core (generated verbatim from ct-core.js, which is itself extracted verbatim from index.html — three copies, one sync doctrine). Working and headless-tested: contract lifecycle (POST / ATTEMPT / SUBMIT / PAYOUT / TAKEDOWN / WINDOW) with the degenerate free-shot case native; double-entry hash-chained money ledger with CSV export, zero-sum verified, tamper detection proven; public score ledger (hash-chained, JSON-extractable, seeded by the game's built-in scores via SAMPLES, grown by every valid SUBMIT including refused claims); full v2.0/v3.0 stream validation with HPS and NPF surfaced; THE WALL spectator renderer (auto-tiling 1–49 boards, live placement + timing display, deferred-verification doctrine implemented: no hashing during live play, one verification at completion, skipped entirely below threshold); registry/peer architecture with the wire protocol fixed (live frames carry the same 3-char B92 placement triples as the stream) and a loopback peer standing in for transport; operator persona, barker ticker, per-contract ambience song cues; and the legal placeholder PDF with counsel checklist. Hard v0 gates are enforced in software: PAYOUT requires typing CONFIRM-HEADER-SCORE, and the masthead says no real money.

## The Critical Path (priority order, big picture)

The ordering principle: nothing above an item on this list is honest until the items below it are done. Money is last on purpose.

**1. Canonical score recompute.** The single gate everything waits behind. The header score is not hash-bound; the chain proves placements, not points. The validator must replay scoring deterministically from the stream and ignore the header claim. This requires porting the pot/T-bonus scoring rules into the shared core as `rules=0, scoring=0` semantics — which is also the moment the rs enumerations acquire their first real definition. v3.0's quantized timing was built precisely so this can be exact. Until this lands, every claim is provisional and the software correctly refuses to pretend otherwise.

**2. Game-side tournament handshake.** The game must be able to set `_gameAuxVars.T`, the rs regime, and the GM window from a tournament invitation before reset, and display "TOURNAMENT PLAY" state. Smallest possible change to index.html: a URL-parameter or pasted-invite path that populates the three globals that already exist. Without this, no real claim can ever carry a tournament ID.

**3. Real peer transport.** Replace the loopback peer with WebRTC DataChannels. The frame format is already fixed, so this is transport work only. The honest unknown: WebRTC needs signaling, which means the first real server — a tiny one that brokers offers/answers and serves the registry JSON. Suggestion: one static-plus-websocket service doing both jobs (registry listing + signaling), kept so small it can be read in one sitting, because it must hold no authority — it introduces peers and lists boards, nothing more. If it lies, the chains still don't.

**4. Registry federation.** SEARCH currently queries the local board plus stub URLs. Define registry.json formally (operator identity, contracts, thresholds, pots, reachability), let any operator self-host one, and let consoles aggregate several. The name-server layer should be boring and replaceable on purpose.

**5. Live-wall ingestion from real peers.** Wire 'place' frames into wallAttempt incrementally instead of replaying complete streams. The completion frame closes the chain and triggers the deferred verification that already exists. Watch CPU at 49 boards on real hardware; the renderer was built to degrade (cap framerate, then cap boards) rather than fall over.

**6. Operator custody mechanics.** Payout rails, refund flows, the HOLD:DISPOSITION account's real policy. Deliberately late: it's the least protocol-like part and the most lawyer-shaped.

**7. Executed legal paper.** The placeholder PDF becomes counsel-approved, per-jurisdiction documents, and Exhibit A becomes machine-generated from POST parameters. Only after this does CONFIRM-HEADER-SCORE retire and real-money mode unlock — and by then it should be CONFIRM nothing, because item 1 made the score a theorem.

## Unknowns, Stated Honestly

The legal unknowns dominate: jurisdiction-by-jurisdiction skill/chance standards, whether escrowing player funds triggers money-transmitter licensing (the sharpest trap identified), bonding and registration regimes, and unclaimed-pot disposition versus escheat law. These are counsel questions, already itemized in the PDF checklist; the architecture treats jurisdiction as a contract parameter so the answers slot in without redesign.

The technical unknowns are smaller but real. Whether canonical scoring can be made perfectly deterministic depends on auditing every scoring input against what the stream encodes — the quantized timing closed the biggest gap, but the audit hasn't been done end to end. The two Towres fallback draws still require physics-aware piece derivation in the validator's stateless path (currently flagged, not silently passed — acceptable, but worth closing). WebRTC behavior on iPhone Safari under backgrounding needs field testing before any tournament relies on a live connection, which argues for keeping the rule that the stream, not the connection, is the claim: a dropped peer link must never invalidate a completed game. And the 49-board wall has only been proven in headless simulation; real-device profiling will set the practical ceiling.

One design unknown worth deciding early: whether the public score ledger is per-operator or global. The hash-chaining supports either; cross-operator aggregation (a ledger of ledgers) is the natural endgame but needs an identity story for operators — possibly nothing more than a published key and a signed terminal hash.

## Operating Doctrine (carry into every task)

The stream is the claim; connections are courtesy. Verification cost is paid once, at the end, and only when the answer matters. Every ledger is append-only and hash-chained, and the operator publishes the tape because being auditable is the product. The barker can promise entertainment; only the math promises money. And v0's gates come off one at a time, each removed by completed work, never by enthusiasm.

---
