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


*Updated April 2026 to reflect implemented format. Previous v1.4 described a planned format
that was revised during implementation. Conflicts with platform.md are noted explicitly in §Conflicts.*

---

## Design Ceiling: 600 Pieces

CELLTOWER ends at a kill screen at level 20. Level 20 requires clearing 200 lines. Each cleared
line is 10 cells wide, giving 2,000 cleared cells over the game's lifetime. The visible playfield
at game-over is 10 × 25 = 250 occupied cells. Total cell budget: 2,250 cells. At 4 cells per
piece, that is 562.5 pieces — rounded to **600 pieces** as the design ceiling.

---

## Design Constraints

1. **One stream, one checksum.** Valid or invalid. No partial recovery, no error correction.
   Any single bit change fails the terminal hash. The system is fail-or-pass by design.
2. **Text-based.** Human-inspectable. No raw binary in the wire format.
3. **Zero whitespace.** No spaces, tabs, newlines, or carriage returns. Every character is
   either data or a structural delimiter.
4. **Compression-friendly.** Designed to compress well under zlib (deflate).
5. **Self-contained.** Seed, placements, player identity, and terminal hash in one string.
6. **Minimum viable.** No data that does not contribute to verification. Snapshots were
   considered and removed — see §Snapshot Removal Rationale.

---

## Encoding: Base-92 Printable ASCII

All values are encoded using 92 printable ASCII symbols: characters 33 (`!`) through 126 (`~`),
excluding comma (44) and semicolon (59).

Comma and semicolon are reserved as unambiguous structural delimiters — they never appear in
encoded data. Parsing is a simple split operation.

```
Encoding capacity:
  1 char  =      92 values  (0–91)
  2 chars =   8,464 values  (0–8,463)
  3 chars = 778,688 values
  4 chars = 71,639,296 values
```

Encode function (big-endian, most-significant digit first):

```
ALPHABET = ASCII 33–126, excluding 44 (,) and 59 (;)  — 92 symbols

to_b92(value, width):
    chars = []
    for i in range(width):
        chars[width-1-i] = ALPHABET[value % 92]
        value = value // 92
    return chars joined

from_b92(string):
    n = 0
    for each char:
        n = n * 92 + indexOf(char in ALPHABET)
    return n
```

For encoding arbitrary byte arrays (e.g., the game seed or terminal hash), treat the byte array
as a big-endian unsigned integer and encode via BigInt arithmetic:

```
bytes_to_b92(bytes, width):
    v = big_endian_integer(bytes)
    return to_b92(v, width)   // using BigInt division

b92_to_bytes(string, byte_length):
    v = from_b92(string)      // BigInt result
    return big_endian_bytes(v, byte_length)
```

---

## Stream Structure

The stream is a single line of printable ASCII text with no whitespace.
Sections are delimited by semicolons. Header fields are delimited by commas.

```
stream = HEADER ; PLACEMENTS ; TERMINAL_HASH
```

Three sections exactly. No snapshots. No intermediate checkpoints.

---

## Section 1: Header

Comma-delimited fields:

```
seed_b92 , stats_b92 , player_name
```

| Field | Format | Length | Description |
|-------|--------|--------|-------------|
| seed_b92 | B92 | **5 chars** | 5 random B92 chars generated at game start |
| score | B92 | 4 chars | Final score (capacity: 71,639,296) |
| level | B92 | 2 chars | Final level |
| lines | B92 | 2 chars | Total lines cleared |
| pieces | B92 | 2 chars | Total pieces placed |
| player_name | B92 | 0–3 chars | Player's displayed name; may be empty |

The four stats fields (score, level, lines, pieces) are concatenated with no delimiter — total
10 chars. They follow immediately after the second comma, before the third comma (player_name).

**Example header:** `Xk3!m,!"R.!#!/!Y,ACE`

- seed: `Xk3!m` (5 B92 chars)
- stats: `!"R.!#!/!Y` (score=12800, level=2, lines=13, pieces=54)
- name: `ACE`

**Minimum header length:** 5 + 1 + 10 + 1 + 0 = 17 chars (no player name, trailing comma present)

---

## Section 2: Placements

All piece placements concatenated with no separators. Each placement is exactly **4 characters**:

```
[position 2 chars] [timing 2 chars]
```

### Position encoding (2 B92 chars)

Piece type, rotation, x-column, and drop-y are packed into a single index:

```
posIdx = type * 1160 + rotation * 290 + x * 29 + (drop_y + 4)
```

| Component | Range | Values |
|-----------|-------|--------|
| type | 0–6 | 7 piece types (I O T S Z J L) |
| rotation | 0–3 | 4 rotations |
| x | 0–9 | 10 columns |
| drop_y | −4 to +24 | 29 slots, stored as drop_y+4 (0–28) |

**Maximum posIdx:** 6×1160 + 3×290 + 9×29 + 28 = 8,119 < 8,464 (2-char B92 cap) ✓

**Why drop_y range includes negatives:** Pieces spawn above the visible board. A drop_y of −4
means the piece top is 4 rows above row 0. The offset of 4 maps −4..+24 → 0..28, a clean 29
values fitting in base-29 within the 2-char posIdx. Prior spec used base-25 (0..24 only), which
was incorrect — pieces at the top of the board can legally lock with cells above row 0.

**Why drop_y is stored explicitly:** CELLTOWER's slide mechanics allow pieces to navigate
laterally via BFS pathfinding, reaching positions unreachable by straight drop — tucking under
overhangs, sliding into cavities. The same type/rotation/x can have multiple valid resting rows
depending on path. drop_y must be stored; it cannot be derived.

**Why the multipliers are 1160 / 290 / 29:**
- 29 values for drop_y → base factor 29
- 10 x-columns × 29 = 290 → rotation factor
- 4 rotations × 290 = 1160 → type factor
- 7 types × 1160 = 8,120 total positions

### Timing encoding (2 B92 chars)

Milliseconds from piece spawn to lock. Range 0–8,463ms (clamped). Serves bot detection:
human timing distributions exhibit characteristic variability; automated play produces unnaturally
uniform timing.

### Placement block length

4 chars × N pieces. A 300-piece game = 1,200 chars. Design ceiling 600 pieces = 2,400 chars.

---

## Section 3: Terminal Hash

SHA-256 of the full hash chain, encoded as **40 B92 chars** (not hex).

```
92^40 > 2^260 > 2^256  →  40 B92 chars fully represent a 32-byte SHA-256 value
```

40 B92 chars vs 64 hex chars: saves 24 characters per stream with no loss of information.

---

## Hash Chain Construction

```
H_0 = SHA-256( UTF-8( seed5 + player_name ) )

For each placement n (1 to N):

    Apply placement to board:
        piece_words OR'd into board_words at (x, drop_y)
        Complete rows detected and cleared (row == 0x03FF)
        Remaining rows shifted down

    record_n = concat(
        piece_type     as uint8,
        rotation       as uint8,
        x_position     as uint8,
        drop_y         as uint8,
        timing_ms      as uint16 big-endian,
        board_word[0]  as uint16 big-endian,
        ...
        board_word[24] as uint16 big-endian
    )
    // record_n = 6 bytes (placement) + 50 bytes (board) = 56 bytes

    H_n = SHA-256( H_{n-1} || record_n )

Terminal hash = H_N
```

**H_0 binds identity to the chain.** The player name is concatenated directly onto the seed
string before hashing. A stream submitted under name `ACE` cannot verify under name `BOB` —
the terminal hash will not match. This prevents identity laundering: a valid replay cannot be
re-attributed to a different player without breaking the chain.

**H_0 uses string concatenation, not byte array concatenation.** The seed (5 B92 chars, ASCII)
and player_name (0–3 B92 chars, ASCII) are joined as a string and UTF-8 encoded. This is
simpler than the byte-array approach in earlier designs and produces the same result for all-ASCII
inputs (which both fields always are, given the B92 alphabet).

**The hash input uses board state after each placement** (piece OR'd in, lines cleared). The
chain commits to the consequence of each move, not just the move itself.

---

## Snapshot Removal Rationale

v1.4 of this spec included board-state snapshots emitted every 30 pieces. These were removed.

The argument for snapshots was "fail fast" — detect a physics divergence before replaying the
whole game. This misunderstands the system:

1. The hash chain is already all-or-nothing. If one bit changes anywhere in the 56-byte record
   for any piece, the terminal hash fails. There is no concept of "partially valid."
2. The verifier replays the whole game regardless — snapshots saved no work.
3. The game engine and verifier share physics code. A physics divergence would mean a bug in
   both simultaneously, which is not the threat model.
4. Snapshots added significant stream bloat (52 chars per snapshot × ~20 snapshots for a
   kill-screen game = ~1,040 chars, plus compression overhead).

The terminal hash is the proof. It is sufficient.

---

## Receipt Code

A 5-character human-readable code derived from the current hash, updated after each placement
and displayed live on the game canvas:

```
receipt_code = base40_encode( H_n[0:4] )

Base-40 alphabet: 0–9 A–Z . - _ !
```

Five base-40 characters encode 40^5 = 102,400,000 values from 4 bytes. This is a truncation —
the receipt code is a display convenience, not a cryptographic identifier.

---

## Size Budget (Implemented Format)

### 54-piece sample game (no player name)

```
Header:           17 chars  (5 seed + 1 + 10 stats + 1 + 0 name)
Placements:      216 chars  (54 × 4)
Terminal hash:    40 chars
Delimiters:        2 chars
────────────────────────────
Total:           275 chars
```

### 300-piece game (3-char player name)

```
Header:           20 chars  (5 + 1 + 10 + 1 + 3)
Placements:    1,200 chars  (300 × 4)
Terminal hash:    40 chars
Delimiters:        2 chars
────────────────────────────
Total:         1,262 chars
```

### 600-piece game / kill screen ceiling (3-char name)

```
Header:           20 chars
Placements:    2,400 chars  (600 × 4)
Terminal hash:    40 chars
Delimiters:        2 chars
────────────────────────────
Total:         2,462 chars
```

**Compared to v1.4 format** (with seed_hex/version_hex/snapshots/hex hash):

| Game size | v1.4 | v2.0 | Reduction |
|-----------|------|------|-----------|
| 300 pieces | 1,936 chars | 1,262 chars | −35% |
| 600 pieces | 3,666 chars | 2,462 chars | −33% |

The format is approximately one-third smaller than the previous design.

---

## Verification Algorithm

```
function verify(stream_text):

    sections = stream_text.split(";")
    if len(sections) != 3: FAIL

    header_parts = sections[0].split(",")
    if len(header_parts) < 2: FAIL

    seed5       = header_parts[0]           // 5 B92 chars
    stats       = header_parts[1]           // 10 B92 chars
    player_name = header_parts[2] or ""     // 0–3 B92 chars

    score    = from_b92(stats[0:4])
    level    = from_b92(stats[4:6])
    lines    = from_b92(stats[6:8])
    n_pieces = from_b92(stats[8:10])

    placements_block = sections[1]          // n_pieces × 4 chars
    term_hash_b92    = sections[2]          // 40 B92 chars

    if len(term_hash_b92) != 40: FAIL

    // Initialize hash chain
    H = SHA-256( UTF-8( seed5 + player_name ) )

    // Fresh board
    board = empty 25-row × 10-col array

    for n = 0 to n_pieces - 1:

        chunk    = placements_block[n*4 : n*4+4]
        if len(chunk) < 4: FAIL

        posIdx   = from_b92(chunk[0:2])
        ms       = from_b92(chunk[2:4])
        typeIdx  = posIdx // 1160
        rot      = (posIdx % 1160) // 290
        x        = (posIdx % 290) // 29
        drop_y   = (posIdx % 29) - 4

        apply_placement(board, typeIdx, rot, x, drop_y)
        clear_complete_rows(board)
        board_words = board_to_words(board)  // 25 × 16-bit words, low 10 bits used

        record = serialize(typeIdx, rot, x, drop_y, ms, board_words)
        // 1+1+1+1+2+50 = 56 bytes

        H = SHA-256( H || record )

    computed_b92 = bytes_to_b92(H, 40)
    if computed_b92 != term_hash_b92: FAIL "hash mismatch"

    return VALID
```

---

## Transport Architecture

### Current implementation: plain text clipboard

The game currently copies the uncompressed stream text to the clipboard at game-over. The player
pastes it wherever they want. Pasting it back into the game triggers the replay viewer, which
plays back the game in full.

Zlib compression (Path A in v1.4) and the custom visual matrix (Path B) remain design goals but
are not yet implemented in the single-file game client.

### QR codes and visual encodings — optional, never required

QR codes, barcodes, and visual matrix encodings are **app-specific convenience features**. An
app may choose to render a stream as a QR code for camera-to-camera transfer, or to scan one.
These are transport helpers — like a URL shortener — not a platform specification.

The platform specification is the plain-text stream string. Any transport that delivers the
string to its destination is valid. No player is ever required to use a QR code to submit a
score, enter a tournament, share a replay, or participate in any platform function.

This distinction matters for platform adoption: app stores, regional regulators, and corporate
policies treat QR-code-based payment and redemption flows with varying degrees of scrutiny.
By keeping QR codes strictly optional and app-layer, the platform avoids that baggage entirely.
The canonical flow — clipboard copy, clipboard paste — requires no special permissions and
works in every browser environment.

### Replay from clipboard

Pasting a valid stream into the game (CTRL-V / long-press paste):

- If the identity screen is open: stream is captured, replay starts immediately; pressing STOP
  after replay returns to the identity screen exactly as it was.
- If a game is not in progress: replay starts immediately.
- Player identity during replay comes from the stream's player_name field (displayed in badge).
- The human player's stored identity is never modified by replay activity.
- After replay ends, the identity screen appears pre-filled with the last human-entered name.

---

## Known Conflicts with platform.md

The following items are documented in `platform.md` but do not match the current implementation:

| Item | platform.md says | Implemented |
|------|-----------------|-------------|
| Seed field | `seed_hex` 64 hex chars | `seed_b92` 5 B92 chars |
| Version field | `version_hex` 64 hex chars (in header) | Removed from stream entirely |
| Snapshot sections | emitted every N actions | Removed entirely |
| Terminal hash | `hex64` (64 hex chars) | 40 B92 chars |
| H_0 inputs | `SHA-256(seed_bytes ∥ admission_id ∥ player_name)` | `SHA-256(UTF-8(seed5 + player_name))` |
| admission_id | distinct field mixed into H_0 | Not yet implemented; player_name serves both roles for casual play |
| game_id / mode_id in header | present | Not present in casual stream |
| Position packing | `type*1000 + rot*250 + x*25 + drop_y` | `type*1160 + rot*290 + x*29 + (drop_y+4)` |

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

---

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
2. Replace 2-char timing with 1-char lookup table value.
3. Adjust stream parser to read 2 chars per placement.
4. Keep header, delimiters, and terminal hash identical.
5. Both client and validator must share exact same seed→piece sequence and timing LUT.

Stream example structure remains: `HEADER;PLACEMENTS;TERMINAL_HASH`
Copy-paste ready. Update stream.md and matching JS encode/decode logic.


---

*Format version: 2.0*
*April 2026*
*CELLTOWER · the High Tower District · Fresno, California*
