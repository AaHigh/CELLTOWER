# ck.html — What This File Is and What Happened to It

*Written for someone with zero context on this project.*

## What is `ck.html`?

`ck.html` lives in the `CELLTOWER` GitHub repo (`github.com/AaHigh/CELLTOWER`). It's a **single-file, self-contained web page** that recreates an authentic Commodore 64 terminal — right down to the pixel-exact 8×8 bitmap font, the C64 boot sequence, and a period-accurate BBS terminal program called CCGMS. Inside that C64 shell, it replays recorded games of NES Tetris (called "streams") and shows a scoring **receipt** — a forensic breakdown of the game that flags which piece placements look like "obvious/optimal" moves (labeled GHOST) versus placements that look more deliberate or strategic (labeled STRATEGIC). The receipt is meant to help a human reviewer judge whether a given Tetris performance shows signs of AI assistance, based on the pattern of choices made — not just the final score.

Think of it as: **a fake vintage computer, inside your browser, replaying a game and printing out an audit report on how it was played.**

## The Problem (today)

The file stopped working. Nothing rendered — because of a JavaScript scoping mistake, not a visible typo.

### How it happened

A collaborator (referred to in the commit log as "Grok") added a chunk of new code meant to live as global, top-level functions — a small memory-management system for tracking the screen's characters and colors (nicknamed "TOWRES" in the code comments). But that code got **pasted inside the body of an unrelated existing function** (`_bytesToB92`, which just converts bytes into a compact text encoding). 

In JavaScript, anything declared inside a function only exists inside that function — it's invisible everywhere else. So the new `poke()` function (which writes a character+color to the screen) was silently "trapped" inside `_bytesToB92`, and every other part of the program that tried to call `poke()` failed instantly with an error, because as far as the rest of the code was concerned, `poke` didn't exist.

### Why it wasn't caught quickly

Six commits were made trying to fix the symptoms — adjusting how `poke()` was called, fixing an unrelated typo, reordering some setup calls — but none of them addressed the actual problem, because the bug wasn't in *how* `poke()` was being called, it was in *where it was defined*. It looked broken from every angle except the right one.

## What Got Fixed (in order)

1. **Moved the trapped code out.** The entire block of new functions was relocated to the top level of the script, where it belongs, so it's actually reachable by the rest of the program.

2. **Added a real Commodore 64 color palette.** The C64 only has 16 official colors. A lookup table of those 16 exact colors was added, along with a function (`toC64Index`) that takes *any* color (even ones the game invents on its own) and finds the closest real C64 color to it. This means the underlying "memory" of the game can be compressed the same way a real C64 stores color data — 4 bits per color instead of a full text color name.

3. **Removed duplicate data, renamed the essentials.** The game used to track its on-screen picture in *three* separate arrays (characters, ink color, background color) *and* a second, newer copy (the TOWRES memory) — meaning every time something was drawn, it had to be written down twice. That duplication is gone. There are now exactly two "memory" variables, deliberately named with single letters to make them easy to spot when reading the code:
   - **`S`** — what character is in each of the 1,000 cells on screen (40 columns × 25 rows, just like a real C64 text screen)
   - **`C`** — the color of each of those same 1,000 cells, compressed into a single byte per cell (one nibble for the foreground color, one nibble for the background color — 4 bits each, matching the C64's real 16-color limit)

   A special placeholder character was introduced (`BLOCK`) to represent a solid, outlined Tetris block on screen, replacing a hacky text-based trick that was there before.

## Known Open Issue — colors look slightly different now

Before today's cleanup, the on-screen colors were the game's own custom palette (richer, more colorful than a real C64). After removing the duplicate arrays, the screen now renders using the **real, quantized 16-color C64 palette** — because that's the only color data left. The colors are *close* to the originals but not identical (for example, the old ink color was a custom violet-blue; it now renders as the nearest real C64 color, which is a slightly different shade of blue).

**This is likely the "it just looks wrong" feeling.** Two ways to resolve it, not yet decided:

- **Option A:** Keep it fully C64-authentic — the on-screen game matches the real hardware's 16 colors exactly, no exceptions. ("OG status," as originally requested.)
- **Option B:** Split the concerns back apart — keep the underlying memory (`S`/`C`) compressed to real C64 colors for compactness/audit purposes, but add back a separate, richer color for what's actually *drawn* on screen, so the visible game looks like it did before.

## Where This Might Go Next

There's an idea on the table to make the character set itself **swappable** — instead of `S` storing an actual character, it would store a number that's looked up in whatever character/glyph table is currently active. Swapping the active table (per scene, per game, per "node" in a larger directed graph of experiences) would let the exact same underlying data render as completely different visuals, without changing the compression at all — still one byte per cell, no matter what's being drawn. This is conceptually similar to how a real C64 could load a custom character set to redefine what its bytes look like on screen, and would let this same lightweight system model very different, more complex-looking games (the comparison used was a simplified, 2D version of something like *Minecraft*) while staying cheap to run and easy to store.

## Quick Glossary

| Term | Meaning |
|---|---|
| **Stream** | A recorded Tetris game, encoded as compact text, that this file can replay |
| **Receipt** | The forensic report printed after a replay — score, timing, and the GHOST/STRATEGIC placement breakdown |
| **GHOST placement** | A piece placement that matches one of the "obvious" optimal options |
| **STRATEGIC placement** | A piece placement that doesn't match an obvious option — flagged for human review |
| **Substrate** | The underlying "memory" of the on-screen picture — now just `S` (characters) and `C` (colors) |
| **TOWRES** | The nickname in the code comments for the substrate/memory system added today |
| **C64 nibble packing** | Storing two 4-bit values (foreground + background color) in a single 8-bit byte, the way real C64 color data could be compressed |
