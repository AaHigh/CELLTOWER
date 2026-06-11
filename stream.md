# CELLTOWER Replay Stream Format

*Document authority: stream.md > platform.md. index.html is ground truth for implementation.*

-----

## Version History

|Version|Status                                            |Chars/piece|Notes                                                                                    |
|-------|--------------------------------------------------|-----------|-----------------------------------------------------------------------------------------|
|v2.0   |Legacy — display only, no cryptographic verify    |4          |Piece type in stream, raw ms timing, Math.random() pieces                                |
|v3.0   |**Current implementation** (as of game v0.6112026)|3          |Piece type from seeded PRNG (xoshiro128**), 256-slot timing table, quantized hash records|
|v4.20  |**Specified — not yet implemented**               |3          |Adds Green Minute timestamp, geolocation, hardens tournament claims                      |

-----

## Part I: v2.0 — The Original Format (Legacy)

v2.0 is documented here for historical reference and because the game’s parser still accepts
v2.0 streams for visual replay. v2.0 streams cannot be submitted as verified scores in v3.0+
tournament contexts. They are distinguished by a 5-character seed field (v3.0+ uses 6).

### v2.0 Stream Structure

```
stream = HEADER ; PLACEMENTS ; TERMINAL_HASH
```

**Header:** `seed5 , stats , player_name`

- `seed5`: 5 random B92 chars
- `stats`: 10 chars — score(4) + level(2) + lines(2) + pieces(2)
- `player_name`: 0-3 B92 chars

**Placements:** 4 chars per piece — `[posIdx: 2 chars][timing_ms: 2 chars]`

```
posIdx = type * 1160 + rot * 290 + x * 29 + (drop_y + 4)
```

Type embedded in stream (I=0 O=1 T=2 S=3 Z=4 J=5 L=6).
Timing: raw milliseconds, 2 B92 chars (0-8,463ms).
Piece sequence: `Math.random()` — not reproducible from seed.
Puzzle system: `Math.random()` — not seeded.

**Terminal hash:** SHA-256 of hash chain, 40 B92 chars.

**Hash chain:** `H_0 = SHA-256(UTF-8(seed5 + player_name))`. Each record:
typeIdx(1) + rot(1) + x(1) + drop_y(1) + raw_ms(2 BE) + board_words(50) = 56 bytes.

### Why v2.0 is Legacy

Piece type in stream means a forger can choose convenient pieces. Raw ms timing has no
bot-detection structure. Math.random() piece sequence is not reproducible from seed.

The built-in sample stream (million-point game) is v2.0. It plays for display.
It cannot be re-verified under v3.0. This is the Ken Thompson inheritance:
we trust it because we trust the session that produced it. See `hacker.md`.

-----

## Part II: v3.0 — Current Implementation

> **Implementation status (June 11, 2026):** v3.0 is now live in `index.html`
> v0.6112026. Prior revisions of this document labeled v3.0 “current” while the
> code still generated v2.0 streams (5-char seed, `Math.random()` pieces, raw-ms
> timing). That gap is closed. The parser accepts both: 5-char seed = v2.0
> (display-only replay), 6-char seed = v3.0 (verifiable).

### What Changed from v2.0

|Item                |v2.0                                     |v3.0                                   |
|--------------------|-----------------------------------------|---------------------------------------|
|Chars per placement |4                                        |**3**                                  |
|Piece type in stream|Yes                                      |**No — from seeded PRNG**              |
|Position encoding   |`type*1160 + rot*290 + x*29 + (drop_y+4)`|`rot*290 + x*29 + (drop_y+4)`          |
|Timing encoding     |2 chars raw ms                           |**1 char — 256-slot lookup table**     |
|Header seed field   |`seed5` 5 chars                          |**`seed6` = seed5 + modeChar, 6 chars**|
|Piece sequence      |`Math.random()`                          |**xoshiro128** PRNG seeded from seed5**|
|Puzzle system       |`Math.random()`                          |**PRNG seeded — deterministic**        |
|Stream (300 pieces) |1,262 chars                              |**963 chars (-24%)**                   |

**Why 3 char
