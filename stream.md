# CELLTOWER Replay Stream Format

*Document authority: stream.md > platform.md. index.html is ground truth for implementation.*

-----

## Version History

|Version|Status                                        |Chars/piece|Notes                                                                                                                                                         |
|-------|----------------------------------------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
|v2.0   |Legacy — display only, no cryptographic verify|4          |Piece type in stream, raw ms timing, Math.random() pieces                                                                                                     |
|v3.0   |**Current implementation** (game v0.6112026)  |3          |Seeded PRNG pieces (xoshiro128**), 256-slot quantized timing packed with position, Green Minute + geolocation header, GM bound into H_0, 12-char terminal hash|
|~v4.20~|**Retired — folded into v3.0**                |—          |Green Minute and geolocation absorbed into v3.0 before any v3.0 stream existed in the wild. No separate v4.20 format will ship.                               |

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
> 
> **Consolidation note:** since no v3.0 stream existed in the wild, the v4.20
> spacetime fields (Green Minute, geolocation) were folded directly into v3.0
> and the terminal hash was shortened. v4.20 is retired as a version number.

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

**Why 3 chars, not 2:** posIdx max without type = 1,227. 1-char B92 cap = 92.
1,227 > 92. Position needs 2 chars. Timing = 1 char. Total = 3. Honest math.

### v3.0 Stream Structure

```
stream = HEADER ; PLACEMENTS ; TERMINAL_HASH
```

**Header:** `seed6 , stats , player_name , gm , lat , lon , rs`

|Field      |Length   |Description                                                   |
|-----------|---------|--------------------------------------------------------------|
|seed6      |6 chars  |seed5 (5 B92 chars) + modeChar                                |
|stats      |10 chars |score(4) + level(2) + lines(2) + pieces(2)                    |
|player_name|0-3 chars|Player name                                                   |
|gm         |4 chars  |Green Minute at game start — **bound into H_0**               |
|lat        |3 chars  |Latitude steps (sentinel 656,972 = AI/declined/unavailable)   |
|lon        |4 chars  |Longitude steps (sentinel 1,313,942 = AI/declined/unavailable)|
|rs         |2 chars  |Rules + scoring enumerations (0=default, 91=escape to aux)    |

modeChar `!` (B92 value 0) = Mode 0 seeded deterministic. Future values reserved.

**rs field — rules + scoring enumerations (2 chars, header field 7):**

One B92 char each: `[rules][scoring]`.

|Value   |Meaning                                                                    |
|--------|---------------------------------------------------------------------------|
|0 (`!`) |Current default rule set / scoring system (the one in place today)         |
|1-90    |Reserved — future enumerated rule sets / scoring systems                   |
|91 (`~`)|**ESCAPE** — the value is a named variable in the aux section (`R=` / `S=`)|

Default games cost exactly two characters (`!!`). Note 0-255-with-escape-at-255
does not fit B92: one char maxes at 91, so the escape lives at 91 and the
enumeration space is 0-90. Ninety future regimes per axis before a stream
version bump is required.

**Auxiliary section (optional, hash-bound):**

```
with aux:    header ; aux ; placements ; terminal_hash    (4 sections)
without:     header ; placements ; terminal_hash          (3 sections)
```

The aux section holds named variables: single-letter keys, `key=value` pairs
joined by commas, no whitespace. Reserved keys: `R` (escaped rules), `S`
(escaped scoring), `T` (tournament ID). Keys and values are B92 characters
excluding `=`. Emitted only when non-empty.

**Canonical serialization (normative):** keys sorted ascending, exactly one
`=` per pair, comma-joined, nothing else. There is exactly ONE legal encoding
of any variable set — the string is bound into H_0 verbatim, and hashing is
whitespace- and order-exact. `R=x,T=y` and `T=y,R=x` are different preimages;
only the sorted form is valid. Reference: `_canonAux()` in `index.html`.

Green Minute and geolocation definitions, encodings, epoch, and sentinel
semantics are unchanged from their original specification (formerly the v4.20
section, now Part III below for reference). The implementation captures
location only when the page already holds geolocation permission — it never
prompts — and falls back to sentinels. Location lives only in the stream
string the player controls; nothing is transmitted.

**Binding tiers:** `gm` is cryptographically bound — H_0 commits to it, so a
stream stored on ice cannot be re-dated without invalidating every hash in
the chain. `lat`/`lon` are header-attested only (geolocation is asynchronous
and must not block H_0); they raise evidentiary cost, not cryptographic cost,
exactly as the original analysis stated.

**Placements:** 3 chars per piece — position and timing packed together:

```
posIdx = rot * 290 + x * 29 + (drop_y + 4)    max = 1,159
triple = posIdx * 256 + timingSlot            max = 296,959 < 92^3 = 778,688 ✓
```

A bare 256-slot timing value cannot fit one B92 char (max 91) — the earlier
“2 chars position + 1 char timing” framing was a spec error caught by
round-trip testing. Packing position×256+slot into one 3-char triple keeps
the full 256-slot table at the same 3 chars/piece.

Piece type derived from PRNG replay during verification — not stored in stream.

**Timing lookup table (256 entries, non-uniform):**

|Zone|Slots  |Range      |Resolution|Purpose                                                                 |
|----|-------|-----------|----------|------------------------------------------------------------------------|
|A   |0-59   |0-150ms    |~2.5ms    |Physically impossible for humans. High resolution to fingerprint bots.  |
|B   |60-179 |150-800ms  |~5.4ms    |Full human performance range. High resolution for distribution analysis.|
|C   |180-219|800-3000ms |~55ms     |Thinking pause. Moderate resolution.                                    |
|D   |220-255|3000-8000ms|~139ms    |Long pause. Coarse — just need to know it was slow.                     |

**Exact table construction (normative):**

```
slot   0- 59:  t = round(slot * 2.5)                      // 0, 3, 5, ... 148
slot  60-179:  t = round(150 + (slot-60) * 650/120)       // 150 ... 795
slot 180-219:  t = 800 + (slot-180) * 55                  // 800 ... 2945
slot 220-255:  t = round(3000 + (slot-220) * 5000/36)     // 3000 ... 7861
```

Table maximum is 7,861ms — any raw interval at or above quantizes to slot 255.
Quantization is nearest-slot (ties round down). Reference: `TIMING_TABLE` and
`_msToSlot()` in `index.html`.

Quantization contract: game stores `TIMING_TABLE[slot]` into hash record, not raw ms.
Verifier decodes same value from slot. They always agree.

**Terminal hash:** 40 B92 chars.

### v3.0 Piece Sequence: xoshiro128**

Seeded from seed5. Identical call order in game and verifier — must not diverge.

**Seed derivation (normative):** fold seed5 into a 32-bit accumulator over its
B92 alphabet indices — `acc = acc*92 + idx(char)` (Math.imul semantics) — then
expand via splitmix32 into the four 32-bit xoshiro128** state words. All-zero
state is guarded to `s[0]=1`. Reference implementation: `_ctkRngSeed()` in
`index.html` — game and verifier must share it byte-for-byte.

Call sequence:

1. `seed(seed5)` once at game start, before any piece or puzzle generation
1. `next()*13|0` -> puzzle grid index (0-12). The grid count (currently 13)
   is a **protocol constant** — adding grids is a stream version bump
1. `next()<0.5` -> mirror flag
1. For each of 9 puzzle pieces (bottom-up pull order): `next()*avail.length|0`
1. 10th piece: always I, no call consumed
1. Post-puzzle pieces: `next()*7|0` -> type index (0=I 1=O 2=T 3=S 4=Z 5=J 6=L)

**Conditional calls (board-state dependent, normative):** two rare fallbacks
each consume exactly ONE `next()` call when triggered, drawing from the
canonical non-I order `O,T,S,Z,J,L` via `next()*6|0`:

- *Towres impossible* — the well column is out of bounds when the 10th piece
  would be queued (`buildPuzzleQueue`)
- *Towres blocked* — the player occupied the well column, forcing the queued
  I-piece to be swapped at preview time (`verifyTowresPiece`)

Both conditions are deterministic functions of board state, which the full
validator reconstructs by replaying physics — so the verifier consumes the
identical call sequence. Stateless piece derivation (visual replay) models
the common path only and is exact whenever neither fallback fires.

### v3.0 Hash Chain

```
H_0 = SHA-256( UTF-8( seed5 + player_name + gm4 + rs + aux ) )

    rs  = the 2-char rules+scoring field, exactly as in the header.
    aux = the canonical aux string, verbatim ('' when absent).
    H_0 thereby binds identity, time-of-play, AND the rules/scoring
    regime: a casual game cannot be re-labeled as tournament play, and
    a tournament ID cannot be added, removed, or altered after the fact.

    gm4 = the 4-char B92 encoding of the Green Minute, exactly as it
    appears in the header. H_0 binds identity AND time-of-play.

record_n = typeIdx(1) + rot(1) + x(1) + drop_y(1) + quantized_ms(2 BE) + board_words(50)
         = 56 bytes total

H_n = SHA-256( H_{n-1} || record_n )

Terminal hash = bytes_to_b92( first 9 bytes of H_N, 12 )
```

**Terminal hash is 12 B92 chars (72 bits), not 40.** Rationale: each B92 char
carries ~6.52 bits; 12 chars hold ~78 bits, so 9 bytes (72 bits) encode with
no modular bias. The governing attack is second-preimage — forging a
different physics-valid stream matching an honest player’s published hash —
costing ~2^72 full chain recomputations: unreachable. The hash is
tamper-evidence over a stream that must independently replay valid; it is
not the sole proof, so full 256-bit width bought nothing but length. 12 chars
fit one receipt line and read aloud in seconds. (5 chars ≈ 33 bits was
considered and rejected: brute-forceable on consumer hardware.)

H_0 binds identity and time. A stream submitted under `ACE` cannot verify
under `BOB`, and a stream recorded at Green Minute N cannot claim Green
Minute M. Identity and timestamp laundering are cryptographically impossible.

### v3.0 Size Budget

|Game                   |Header|Placements|Hash+delim|Total    |
|-----------------------|------|----------|----------|---------|
|300 pieces, 3-char name|21    |900       |42        |**963**  |
|600 pieces, 3-char name|21    |1800      |42        |**1,863**|

-----

## Part III: Spacetime Fields Reference (formerly v4.20 — now part of v3.0)

### Motivation

v3.0 proves physics and identity. It cannot prove presence or time.
A forger who implements the board physics correctly and waits real milliseconds
between hash chain advances produces a stream that passes v3.0 verification.
See `hacker.md` for the full analysis of why the forge attempt failed and what
would be needed to succeed.

v4.20 adds two real-world anchors that mathematics alone cannot provide:

1. **Green Minute timestamp** — when the game was played, to the minute
1. **Geolocation** — where the game was played, to ~30-meter resolution

These create a space-time footprint for every claimed human game. A stream produced
“on ice” and submitted later fails the tournament time window check. A stream claiming
to originate in New York but submitted from a Tor exit node in Romania is a discrepancy
the tournament can investigate. Neither field is cryptographically unforgeable in
isolation — a determined attacker can lie about both. What they do is raise the
evidentiary cost of forgery and create audit trails that honest players never trigger.

Combined with admission_id binding and narrow tournament windows, they close the
practical gap between “mathematically valid” and “authentically human.”

### The Green Minute

**Definition:** Integer count of minutes elapsed since the CELLTOWER epoch.

**Epoch:** `2026-04-20T04:20:00Z`
4:20 AM UTC, April 20, 2026 — the project’s ground zero.

```
green_minute = floor( (wall_clock_unix_ms - 1776658800000) / 60000 )
```

**Unit name: Green Minute (GM)**

This unit is hereby offered to the public domain. If you have a use for a minute
counter anchored to April 20, 2026 at 4:20 AM UTC, it’s yours.

**Encoding:** 4 B92 chars

- Capacity: 92^4 = 71,639,296 Green Minutes = **136 years** from epoch
- At time of writing (April 21, 2026): GM ~ 2,729

The game records GM when the first piece spawns (game clock starts).
Tournament verifiers check that GM falls within the declared competition window.
A stream with GM outside the window is rejected regardless of hash validity.
This makes “storing a replay for later submission” detectable without any server
infrastructure — the timestamp is self-reported and bound into the hash chain.

### Geolocation

**Resolution:** ~30 meters (~100 feet). Sufficient to place a player at a venue.
Not sufficient to identify a specific room or individual.

**Latitude encoding:** integer steps from south pole.

```
lat_steps = round( (latitude_degrees + 90.0) * (656971.0 / 180.0) )

Range:    0 (south pole, -90 deg) to 656,971 (north pole, +90 deg)
Encoding: 3 B92 chars  [92^3 = 778,688 > 656,971, fits]
Accuracy: 180 deg / 656,971 steps = 0.000274 deg = ~30.5 meters
```

**Longitude encoding:** integer steps from antimeridian (-180 deg).

```
lon_steps = round( (longitude_degrees + 180.0) * (1313941.0 / 360.0) )

Range:    0 (-180 deg) to 1,313,941 (+180 deg)
Encoding: 4 B92 chars  [92^4 = 71,639,296 > 1,313,941, fits]
Accuracy: 360 deg / 1,313,941 steps = 0.000274 deg = ~30.5 meters at equator
```

**Sentinel values — AI authored or location unavailable:**

```
lat_steps = 656,972   (encodes latitude > +90 deg — physically impossible)
lon_steps = 1,313,942  (encodes longitude > +180 deg — physically impossible)
```

Any stream where the player is an AI, geolocation was declined, or location is
unavailable uses these sentinel values. Out-of-range values are unambiguous —
they cannot occur from any real coordinate. Tournament rules determine whether
sentinel streams are accepted for scoring. Casual play always accepts them.

**Privacy note:** Geolocation is opt-in for casual play. For tournament play, the
tournament terms of service govern collection. The game never transmits location
data to any server — the value lives only in the stream string the player controls
and chooses to share. Players may always decline and receive sentinel encoding.

### v4.20 Stream Structure

```
stream = HEADER ; PLACEMENTS ; TERMINAL_HASH
```

**Header:**

```
seed6 , stats , player_name , gm , lat , lon
```

|Field      |Length   |Description                           |
|-----------|---------|--------------------------------------|
|seed6      |6 chars  |Unchanged from v3.0                   |
|stats      |10 chars |Unchanged from v3.0                   |
|player_name|0-3 chars|Unchanged from v3.0                   |
|gm         |4 chars  |Green Minutes since epoch             |
|lat        |3 chars  |Latitude steps (sentinel = 656,972)   |
|lon        |4 chars  |Longitude steps (sentinel = 1,313,942)|

Three new comma-delimited fields appended after player_name.
v3.0 parsers that split on comma and read fields 0-2 are unaffected —
they ignore the new trailing fields gracefully. Backward-compatible for display.

**Version detection:** v4.20 headers have 6 comma-delimited fields; v3.0 has 3.

**Placements:** unchanged from v3.0 — 3 chars per piece.

**Terminal hash:** unchanged — 40 B92 chars.

**Hash chain change for v4.20:**
gm, lat_steps, and lon_steps are appended to the H_0 input:

```
H_0 = SHA-256(
    UTF-8(seed5 + player_name)
    || uint32_BE(gm)
    || uint24_BE(lat_steps)
    || uint32_BE(lon_steps)
)
```

This binds the space-time claim cryptographically into the chain. A forger who
falsifies the GM or location in the header must also recompute the entire hash chain
from H_0 onward — not difficult with source access, but not retroactively editable.
The fields in the header and the fields in H_0 must agree or verification fails.

### v4.20 Size Budget

|Game                   |Header|Placements|Hash+delim|Total    |
|-----------------------|------|----------|----------|---------|
|300 pieces, 3-char name|32    |900       |42        |**974**  |
|600 pieces, 3-char name|32    |1800      |42        |**1,874**|

11 chars added to header vs v3.0 (4 gm + 3 lat + 4 lon). Negligible overhead
for the evidentiary value added.

### Video Recording Recommendation

Green Minute and geolocation provide machine-readable evidence anchors.
Video recording provides human-readable evidence that bridges the gap.

Players claiming competitive scores are encouraged to record:

- Screen capture showing the game running in real time
- System clock visible somewhere in frame
- For in-person tournaments: camera angle showing physical device and player hands

The stream is the cryptographic proof. Video is the human proof. Neither alone is
sufficient for high-stakes disputes. Together they are compelling and complementary.

-----

## Encoding Reference: Base-92

Alphabet: ASCII 33-126 excluding comma (44) and semicolon (59) = **92 symbols**.
Comma and semicolon are reserved as unambiguous structural delimiters.
They never appear in encoded data. Parsing is a simple split.

```
1 char  =       92 values
2 chars =    8,464 values
3 chars =  778,688 values
4 chars = 71,639,296 values
```

Big-endian, most-significant digit first. Zero-padded to declared width.

-----

## Receipt Code (all versions, unchanged)

Live display code updated after each placement:

```
receipt_code = base40_encode( H_n[0:4] )
Base-40 alphabet: 0-9 A-Z . - _ !
5 chars = 40^5 = 102,400,000 display values from 4 bytes
```

Display convenience only. Not cryptographically secure.
The receipt code changes every piece — it is a live fingerprint of game state,
not a persistent identifier.

-----

## Conflicts with platform.md

stream.md is ground truth for stream format. platform.md predates v3.0.

|Item             |platform.md says                     |Implemented                            |
|-----------------|-------------------------------------|---------------------------------------|
|Seed field       |`seed_hex` 64 hex chars              |`seed6`: 5 B92 + 1 mode char           |
|Version field    |`version_hex` in header              |Removed entirely                       |
|Snapshot sections|emitted every N pieces               |Removed entirely                       |
|Terminal hash    |`hex64` 64 hex chars                 |40 B92 chars                           |
|H_0 inputs       |`SHA-256(seed                                                               ||
|admission_id     |distinct field in H_0                |Not yet — player_name serves both roles|
|Position packing |`type*1000 + rot*250 + x*25 + drop_y`|`rot*290 + x*29 + (drop_y+4)`, no type |
|Timing encoding  |raw ms                               |256-slot quantized lookup table        |

The admission_id field is architecturally correct in platform.md. For tournament play,
the tournament entry ticket will be bound into H_0 exactly as described. The current
client uses player_name for both roles because casual play has no distinct admission_id.
When tournament mode is implemented, the field will be separated.

-----

## Transport

Current: plain text clipboard. Game copies stream at game-over. Paste back to replay
or verify. No server required for casual play or score verification.

QR codes and compressed transports are optional app-layer conveniences — like URL
shorteners, not specifications. The canonical format is the plain-text stream string.
Any transport that delivers the string intact to its destination is valid.
No player is ever required to use QR codes for any platform function.
open: stream is captured, replay starts immediately; pressing STOP
after replay returns to the identity screen exactly as it was.

- If a game is not in progress: replay starts immediately.
- Player identity during replay comes from the stream’s player_name field (displayed in badge).
- The human player’s stored identity is never modified by replay activity.
- After replay ends, the identity screen appears pre-filled with the last human-entered name.

-----

## Known Conflicts with platform.md

The following items are documented in `platform.md` but do not match the current implementation:

|Item                       |platform.md says                                  |Implemented                                                       |
|---------------------------|--------------------------------------------------|------------------------------------------------------------------|
|Seed field                 |`seed_hex` 64 hex chars                           |`seed_b92` 5 B92 chars                                            |
|Version field              |`version_hex` 64 hex chars (in header)            |Removed from stream entirely                                      |
|Snapshot sections          |emitted every N actions                           |Removed entirely                                                  |
|Terminal hash              |`hex64` (64 hex chars)                            |40 B92 chars                                                      |
|H_0 inputs                 |`SHA-256(seed_bytes ∥ admission_id ∥ player_name)`|`SHA-256(UTF-8(seed5 + player_name))`                             |
|admission_id               |distinct field mixed into H_0                     |Not yet implemented; player_name serves both roles for casual play|
|game_id / mode_id in header|present                                           |Not present in casual stream                                      |
|Position packing           |`type*1000 + rot*250 + x*25 + drop_y`             |`type*1160 + rot*290 + x*29 + (drop_y+4)`                         |

**Consequences for platform.md:**

`game_version` (SHA-256 of the game file) is stored in the `ScoreRecord` schema in platform.md
but is no longer present in the stream. This is appropriate — version tracking is a server-side
concern, not a stream concern. The client can report the version separately; it does not need to
be in the verifiable stream.

`admission_id` is architecturally correct — for tournament play, the admission ticket name will
be bound into H_0 exactly as platform.md describes. The current client uses player_name for both
roles because casual play has no distinct admission_id. When tournament mode is implemented, the
field will be separated.

The position-packing formula change is a correction: the v1.4 formula used base-25 for drop_y,
which cannot represent pieces partially above the board. The implemented formula uses base-29
with a +4 offset, supporting drop_y values from −4 (four rows above the board top) to +24.
Any verifier implemented from the old formula will produce wrong posIdx values and fail to
verify current streams. Verifiers must use the new formula.

-----

## In-Frame Visual Encoding (unchanged from v1.4)

The visual channels described in v1.4 (verification stripe, timing strip, board luminance
steganography) remain design goals. They are not yet fully implemented in the current single-file
client but are structurally compatible with the v2.0 stream format.

# CELLTOWER Replay Stream Format

## Specification v3.0 (50% placement compression)

**Key changes (apply these):**

- Piece type removed from every placement (deterministic from shared seed + identical index.html hash).
- Rotations reduced: O=1, S/Z/I=2 each, T/J/L=4 → total 21 slots instead of 28.
- posIdx multiplier now ~165 (1 type × ~3.0 avg rot × 10 x × 29 y adjusted).
- Timing: 8 bits (256-value lookup table, high resolution on human 150-800ms hotspots, coarser elsewhere).
- Each placement: **exactly 2 B92 chars** (`[1 char position] [1 char timing]`).
- Header and terminal hash unchanged.
- Placement block now ~50% shorter (2 chars × N pieces).

### Updated Position encoding (1 B92 char)

posIdx = rotation * (10 * 29) + x * 29 + (drop_y + 4)

- type eliminated (known from RNG seed simulation).
- rotation 0..max_for_type (0-3, but only valid values used).
- Max posIdx now well under 92 → fits 1 char.

### Updated Timing encoding (1 B92 char)

- 8-bit value (0-255) mapped via fixed lookup table (shared in code).
- Table focuses resolution on human reaction-time hotspots; log-like scaling outside.
- Sufficient for bot detection.

### New Placement block

All placements concatenated: exactly **2 characters each**.  
300-piece game → ~600 chars (was 1,200).  
600-piece ceiling → ~1,200 chars (was 2,400).

**To implement:**

1. Update posIdx calculation in encoder/decoder to drop type multiplier and use reduced rotation count.
1. Replace 2-char timing with 1-char lookup table value.
1. Adjust stream parser to read 2 chars per placement.
1. Keep header, delimiters, and terminal hash identical.
1. Both client and validator must share exact same seed→piece sequence and timing LUT.

Stream example structure remains: `HEADER;PLACEMENTS;TERMINAL_HASH`
Copy-paste ready. Update stream.md and matching JS encode/decode logic.

-----

*Format version: 2.0*
*April 2026*
*CELLTOWER · the High Tower District · Fresno, California*