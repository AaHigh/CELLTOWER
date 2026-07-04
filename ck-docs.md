# ck.html: What This File Is, What Happened to It, and Why It Matters

## Plain-Language Summary

*This section is written for someone with zero context on this project.*

`ck.html` lives in the `CELLTOWER` GitHub repo (`github.com/AaHigh/CELLTOWER`). It's a **single-file, self-contained web page** that recreates an authentic Commodore 64 terminal, right down to the pixel-exact 8x8 bitmap font, the C64 boot sequence, and a period-accurate BBS terminal program called CCGMS. Inside that C64 shell, it replays recorded games of NES Tetris (called "streams") and shows a scoring **receipt**, a forensic breakdown of the game that flags which piece placements look like "obvious/optimal" moves (labeled GHOST) versus placements that look more deliberate or strategic (labeled STRATEGIC). The receipt is meant to help a human reviewer judge whether a given Tetris performance shows signs of AI assistance, based on the pattern of choices made, not just the final score.

Think of it as: **a fake vintage computer, inside your browser, replaying a game and printing out an audit report on how it was played.**

The file stopped working for a stretch today. Nothing rendered, because of a JavaScript scoping mistake, not a visible typo. A collaborator (referred to in the commit log as "Grok") added a chunk of new code meant to live as global, top-level functions, a small memory-management system for tracking the screen's characters and colors (nicknamed "TOWRES" in the code comments). That code got **pasted inside the body of an unrelated existing function** (`_bytesToB92`, which just converts bytes into a compact text encoding). In JavaScript, anything declared inside a function only exists inside that function, it's invisible everywhere else. So the new `poke()` function (which writes a character and color to the screen) was silently trapped inside `_bytesToB92`, and every other part of the program that tried to call `poke()` failed instantly, because as far as the rest of the code was concerned, `poke` didn't exist. Six commits tried to fix the symptoms (adjusting how `poke()` was called, fixing an unrelated typo, reordering setup calls) without touching the actual problem, because the bug wasn't in how `poke()` was being called, it was in where it was defined.

The fix, in plain terms: the trapped code was moved back out to the top level where it belongs; a real Commodore 64 color palette (all 16 official colors) was added along with a function that finds the closest real C64 color to whatever color the game asks for; and the old duplicated on-screen memory (three separate arrays for characters, ink color, and background color, running in parallel with a second, newer copy that nothing was even reading) was collapsed down to exactly two single-letter variables: `S` for what character is in each cell, and `C` for that cell's color, packed into a single byte.

The technical sections below go through all of this in full detail, including a still-open question about whether the on-screen colors should snap fully to real C64 hardware colors or keep the game's original richer palette, plus a glossary at the end.

## What ck.html Is (Technical)

`ck.html` is a single-file, dependency-free HTML page that emulates a Commodore 64 terminal session: pixel-exact 8x8 bitmap font, authentic boot sequence, and a period-accurate BBS terminal client (CCGMS, originally written by Craig Smith). Inside that emulated shell it replays recorded NES Tetris games ("streams") and renders a forensic receipt: a placement-by-placement breakdown of the game classifying each piece drop as GHOST (matches one of the deterministically-computed optimal placements) or STRATEGIC (does not match, flagged for human review). The receipt is a scoring instrument for a specific claim: that the *pattern* of choices across a game, not just the final score, carries a verifiable signal about whether a human or an assisted process played it.

## Today's Incident: Root Cause and Fix Sequence

A collaborator ("Grok," per commit message) contributed real functionality: a phase-1 "contemplation drop" model for ghost-piece animation (`phase1Contemplation`), a committed-path reconstructor (`ghostCommittedStates`), slide detection, and four-way GHOST/STRATEGIC x slide/no-slide receipt statistics. Alongside that, a small memory-substrate API (`poke`/`peek`/`clear`, nicknamed TOWRES in the source comments) was introduced as the intended foundation for a future well-defined interpreter layer.

The substrate code was pasted inside the body of an unrelated function (`_bytesToB92`, a byte-to-base92 encoder) instead of at module scope. JS function declarations are scoped to their enclosing function; `poke()` was therefore invisible to every caller outside `_bytesToB92`, including the core rendering primitive `put()`, which calls it on every character write. Six subsequent commits attempted fixes at the call site (typo correction, signature changes, execution-order changes to `clr()`/`boot()`) without touching the actual defect, because none of them were scoping errors. `git log --follow --stat -- ck.html` on a fresh `git clone https://github.com/AaHigh/CELLTOWER.git` was the diagnostic path: statically walking every commit's diff against `ck.html` for the day surfaced the misplaced block immediately once each commit was diffed against its predecessor rather than only inspecting HEAD.

Fix sequence:

1. Hoisted the entire TOWRES block out of `_bytesToB92` to module scope.
2. Added a 16-entry C64 palette table (VICE/Pepto reference hex values) and `toC64Index()`, an RGB-nearest-neighbor quantizer (memoized) that maps any index, PAL-key, or arbitrary hex string down to a real 0-15 C64 color code.
3. Collapsed the pre-existing dual state (`grid`/`colr`/`bgc` display arrays running in parallel with the new `SCR`/`COL` substrate, which was write-only and never read) into a single source of truth: two module-level arrays, `S` (character per cell) and `C` (`Uint8Array`, packed as `(bg << 4) | fg`, both real C64 indices). 1000 cells, 40x25, matching the real C64 text-mode geometry. A private-use sentinel character (`\uE000`, bound to `BLOCK`) replaced a prior string-prefix hack (`'CELL:'+col` smuggled through the background field) for rendering the delineated placed-piece block.

## Open Question: Display Fidelity vs. Substrate Compression

Collapsing to a single `S`/`C` source of truth means the canvas now renders exclusively through the quantized 16-color C64 palette rather than the game's original, richer custom hex palette (`PAL`). Visually close, not identical (e.g., the prior ink color `#7C70DA` now resolves to C64 index 14, `#6C5EB5`). This is the likely source of the "it just looks wrong" feeling reported after the refactor. Two resolutions on the table, not yet decided:

- **A: full fidelity to hardware.** Display and substrate both hard-locked to the real 16 colors. No exceptions, maximal "OG" claim.
- **B: layered separation.** Substrate (`S`/`C`) stays C64-compressed for audit/compression purposes; a thin display-side lookup restores the richer custom palette for what's actually painted to canvas, decoupling storage format from presentation format.

Note that B is a specific case of the more general architecture below, and probably the more defensible default once that architecture exists.

## The Thesis: Emulation as a Development Substrate, Not Just a Skin

What's happening here is bigger than a Tetris trainer. The C64 emulation isn't decoration wrapped around modern logic. It's functioning as a **constrained execution substrate**: a fixed 1000-cell grid, a fixed 16-color palette, one byte of character identity and one byte of color per cell. That constraint is precisely what makes it a good target for layered augmentation:

- **The visual interface of an old system is a small, well-defined contract.** Screen memory plus color memory plus character ROM is a complete description of everything the machine could ever show. Modern code (game logic, AI-driven behavior, whatever) can sit entirely outside that contract and simply write to it, the same way real C64 software did. This is why the `poke`/`peek` primitives exist at all: they're the connective tissue between arbitrary augmentation code and an authentically constrained presentation layer.
- **That constraint is a feature for AI-assisted development, not a limitation.** A byte-per-cell character/color model is small enough to be entirely legible to a language model in a single context window, deterministic enough to verify by inspection, and expressive enough (given a swappable character set, see below) to represent far more than text. This is a plausible answer to "vibecoding" games that feel like they have real history behind them: start from an authentic, constrained old-system substrate, and layer new mechanics on top of it in small, auditable increments, the same incremental loop already in use on this file (Claude produces, Aaron identifies the specific defect, Claude fixes exactly that).
- **The character set doesn't need to be fixed.** Real C64 software could redefine its character ROM to make identical screen bytes render as anything: sprites, custom fonts, entire alternate visual languages. The same move works here: `S` doesn't need to store a literal character, it can store an index into whichever glyph table is currently bound. Swapping the bound table (per scene, per game, per node in a larger directed graph of experiences) changes what an unmodified byte stream looks like on screen, at zero cost to the compression scheme; still one byte per cell regardless of what's rendering. This is the mechanism that would let a system like this scale from "Tetris trainer with a C64 skin" toward something closer to a simplified, 2D, tile-substrate analogue of a voxel world (Minecraft was the comparison raised), while keeping the underlying state trivially small, inspectable, and diffable, the exact properties that made the original scoping bug findable by walking commit history in the first place.
- **This reframes "old game, new coat of paint."** The usual move is: take an old game's assets, replace them, keep the logic. The move suggested here is closer to the reverse: keep the old system's *constraint* (the substrate, the palette, the byte economy) and let arbitrary new logic, including AI-generated logic, run against it. The nostalgia isn't cosmetic, it's structural: the thing that feels old is the actual rule set the new code has to respect.

## Historical Note: Provenance

This project's verification thesis (that a signed, non-repudiable record of a human's specific choices holds value that mass-produced synthetic output cannot) has a documented throughline back further than CELLTOWER or SF Rush 2049.

Aaron Hightower built the **Construction Set** for *Wizard*, the 1984 Commodore 64 game originally developed by Sean A. Moore and Steve Luedders-Dieckbrader for Progressive Peripherals and Software. When Electronic Arts published the expanded 1986 sequel, *Ultimate Wizard*, the level-editing tool that EA (including designer Paul Reiche III) used to build the new content was the Construction Set created by Aaron and Craig ("Craig" here matching Craig Smith, the CCGMS author whose terminal program this same file emulates today). EA's Ultimate Wizard release incorporated that Construction Set directly, alongside a combined and reordered set of levels drawn from the original release and its expansion pack. [Source: Wikipedia, "Wizard (1984 video game)"]

Two things worth stating plainly, for the record rather than for effect:

1. This is independently documented, not solely a personal recollection: credit for building the tool EA itself shipped is attributed by name.
2. The throughline from that construction set (built as a kid, later used by a major publisher) through the SF Rush 2049 cabinet-linked, SHA-based arcade score verification system (patented) to CELLTOWER's receipt and verification tooling today is a genuine 40-year pattern, not a retroactive narrative: build the tool that lets other people's work, or other pieces of your own work, be trusted, checked, or extended. *Ultimate Wizard*, independent of everything built after it, remains, by Aaron's own account, the most personally beloved credit among a list that includes several higher-profile titles, precisely because it was original, self-initiated, and predates every institutional affiliation that came after.

## Where This Might Go Next

There's an idea on the table to make the character set itself **swappable**: instead of `S` storing an actual character, it would store a number that's looked up in whatever character/glyph table is currently active. Swapping the active table (per scene, per game, per "node" in a larger directed graph of experiences) would let the exact same underlying data render as completely different visuals, without changing the compression at all, still one byte per cell, no matter what's being drawn. This is conceptually similar to how a real C64 could load a custom character set to redefine what its bytes look like on screen, and would let this same lightweight system model very different, more complex-looking games (the comparison used was a simplified, 2D version of something like *Minecraft*) while staying cheap to run and easy to store.

## Quick Glossary

| Term | Meaning |
|---|---|
| **Stream** | A recorded Tetris game, encoded as compact text, that this file can replay |
| **Receipt** | The forensic report printed after a replay, score, timing, and the GHOST/STRATEGIC placement breakdown |
| **GHOST placement** | A piece placement that matches one of the "obvious" optimal options |
| **STRATEGIC placement** | A piece placement that doesn't match an obvious option, flagged for human review |
| **Substrate** | The underlying memory of the on-screen picture, now just `S` (characters) and `C` (colors) |
| **TOWRES** | The nickname in the code comments for the substrate/memory system added today |
| **C64 nibble packing** | Storing two 4-bit values (foreground and background color) in a single 8-bit byte, the way real C64 color data could be compressed |
