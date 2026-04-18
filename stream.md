# CELLTOWER Replay Stream Format
## Specification v1.1

---

## Design Ceiling: 600 Pieces

CELLTOWER ends at a kill screen at level 20. Level 20 requires clearing 200 lines. Each cleared line is 10 cells wide, giving 2,000 cleared cells over the game's lifetime. The visible playfield at game-over is 10 × 25 = 250 occupied cells. Total cell budget: 2,250 cells. At 4 cells per piece, that is 562.5 pieces — rounded to **600 pieces** as the design ceiling.

All capacity estimates, size budgets, and QR version targets in this document are sized to handle a 600-piece game. A game that reaches the kill screen will always fit within this budget.

---

## Design Constraints

1. **One stream, one checksum.** Valid or invalid. No partial recovery, no error correction, no UDP. Connection-oriented delivery — there may be delay but the stream arrives complete or not at all.
2. **Text-based.** Human-inspectable before compression. No raw binary in the wire format.
3. **Zero whitespace in the minified form.** The pre-compression representation contains no spaces, tabs, newlines, or carriage returns. Every character is either data or a structural delimiter.
4. **Compression-optimized.** The encoding is designed to compress well under zlib (deflate). The format exploits character-level patterns that LZ77 dictionaries match efficiently.
5. **Self-contained.** One stream = one complete game. Seed, version, placements, board snapshots, terminal hash — everything needed to verify.
6. **Air-gapped validation.** The game and the validator are separate applications on separate devices. The only channel between them is visual — a QR code rendered on the game canvas, captured by a camera on the validator device. No network API, no WebSocket, no server.

---

## Transport: Camera-Only Interface

The game outputs the compressed replay stream as a QR code on the HTML5 canvas at game-over. The validator application reads that QR code using a device camera. This is the entire interface contract between the two systems.

### Tournament Mode (Two-Phone)

The player's phone runs the game. A second device (tournament official's phone or observer's phone) points its camera at the player's screen and captures the QR code. The player never touches the validation device. Chain of custody is physical and visible — the QR is scanned directly from the game screen in real time. No opportunity to inject a fabricated stream between game and validator.

### Casual Mode (Screenshot)

The player finishes a game, screenshots the game-over screen (which includes the QR code), and submits the image to the validator app. The validator decodes the QR from the screenshot. This path has weaker chain of custody (a screenshot could theoretically be doctored) but is acceptable for leaderboards that are not distributing cash prizes.

### Architecture Implications

No server infrastructure is required during development. The game runs as a static HTML file on GitHub Pages. The validator is a completely independent codebase that only needs to know this stream format spec and how to decode a QR code from a camera feed. The two applications share one spec and one codec implementation — nothing else.

---

## Encoding: Base-92 Printable ASCII

All values are encoded using 92 printable ASCII symbols: characters 33 (!) through 126 (~), excluding space (32), comma (44), and semicolon (59).

Excluding space eliminates whitespace ambiguity in the minified stream. Excluding comma and semicolon reserves them as unambiguous structural delimiters — they never appear in encoded data, so parsing is a simple split operation.

```
Encoding capacity:
  1 char  =      92 values  (0-91)
  2 chars =   8,464 values  (0-8463)
  3 chars = 778,688 values
  4 chars = 71,639,296 values
```

Encode function (big-endian, most significant digit first):
```
ALPHABET = ASCII 33-126, excluding 44 and 59  (92 symbols)

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

---

## Stream Structure

The stream is a single line of printable ASCII text with no whitespace. Structural sections are delimited by semicolons. Header fields are delimited by commas.

```
stream = header ; placements ; snapshots ; hash
```

### Minification (Pre-Compression)

Before compression, the stream is in its minified form: zero whitespace, minimal delimiters, maximum data density. This is the form that gets compressed with zlib.

### Pretty-Printing (Post-Decompression)

After decompression, the stream can be reconstructed into human-readable C-struct-style formatting:
- 4-space indentation (spaces only, no tabs)
- Semicolon-terminated assignments
- Board snapshots rendered as visual grids
- Placement data decoded into piece names, rotations, positions, and timing

The pretty-printer makes zero assumptions about the viewer's tab settings or terminal configuration. All formatting uses space characters exclusively.

---

## Record Types

### Header

One per stream. Comma-delimited fields:

```
seed_hex , version_hex , stats_b92
```

| Field | Format | Length | Description |
|-------|--------|--------|-------------|
| seed_hex | Hex string | 64 chars | SHA-256 of game seed (committed before game start) |
| version_hex | Hex string | 64 chars | SHA-256 of the index.html file loaded |
| score | Base-92 | 4 chars | Final score (capacity: 71,639,296) |
| level | Base-92 | 2 chars | Final level (capacity: 8,464) |
| lines | Base-92 | 2 chars | Total lines cleared |
| pieces | Base-92 | 2 chars | Total pieces placed |

The stats fields (score, level, lines, pieces) are concatenated with no delimiter — their widths are fixed, so parsing is positional.

Total header length: 64 + 1 + 64 + 1 + 10 = 140 characters.

### Placements

All placements are concatenated into a single block with no separators. Each placement is exactly 4 characters:

```
[position 2 chars] [timing 2 chars]
```

**Position encoding (2 base-92 chars):**

Piece type (0-6), rotation (0-3), x position (0-9), and drop-y (0-24) are packed into a single index:

```
index = type * 1000 + rotation * 250 + x * 25 + drop_y
```

Maximum value: 6 * 1000 + 3 * 250 + 9 * 25 + 24 = 6,999. Fits in 2 base-92 characters (capacity 8,464).

**Why drop-y is stored explicitly:** CELLTOWER's slide mechanics allow pieces to navigate laterally during descent via BFS pathfinding. A piece can land in positions unreachable by straight drop — tucking under overhangs, sliding into cavities. The same piece type, rotation, and x-column can have multiple valid resting rows depending on the path taken. Therefore the landing row cannot be derived from piece + rotation + column alone. It must be stored.

The verifier receives the terminal position and confirms legality via bitwise AND (piece pattern words AND board words at that position must equal zero — no overlap). The verifier does not need to run pathfinding.

**Timing encoding (2 base-92 chars):**

Milliseconds from piece spawn to lock. Range 0-8,463ms. Values above 8,463 are clamped. Any human placement exceeding 8.4 seconds is a statistical outlier — 99.9% of placements fall well under 5 seconds.

This field serves bot detection. Human timing distributions exhibit characteristic variability — reaction time variance, corrective movements, pauses before rotations. Automated play produces unnaturally uniform timing. Statistical analysis of the timing distribution provides a secondary integrity signal, analogous to engine-detection methods in competitive chess.

**Placement block length:** 4 characters × N pieces. A 300-piece game = 1,200 characters. The design ceiling of 600 pieces = 2,400 characters.

### Snapshots (I-Frames)

Board state checkpoints, emitted every 30 pieces. Multiple snapshots are semicolon-separated within the snapshots section. Each snapshot is exactly 52 characters:

```
[piece_number 2 chars] [row_0 2 chars] [row_1 2 chars] ... [row_24 2 chars]
```

Each row is a 10-bit board word (0-1023, representing 10 columns where 1 = occupied), base-92 encoded in 2 characters.

The board is represented as 25 sixteen-bit words, one per row. Only the low 10 bits are used (10 columns). The upper 6 bits are zeroed. This representation derives from efficient collision detection on resource-constrained hardware — the same bit-packed format enables both gameplay physics (bitwise AND for collision, bitwise OR for placement) and verification with identical operations.

Snapshots serve as integrity checkpoints. The board state derived by replaying placements from the previous snapshot (or from game start) must match the snapshot exactly. Any mismatch indicates tampering.

### Terminal Hash

The final element of the stream. SHA-256 hash chain terminal value, hex-encoded:

```
[hash_hex 64 chars]
```

This is the game's cryptographic fingerprint.

---

## Hash Chain Construction

```
H_0 = SHA-256(seed_bytes)

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
        board_word[1]  as uint16 big-endian,
        ...
        board_word[24] as uint16 big-endian
    )
    // record_n = 6 bytes (placement) + 50 bytes (board) = 56 bytes

    H_n = SHA-256(H_{n-1} || record_n)

Terminal hash = H_N
```

The hash input uses the board state *after* the placement (piece OR'd in, lines cleared). The hash commits to the consequence of each move, not just the move itself.

The hash chain operates on fixed-width binary representations internally, regardless of how the stream is encoded for transmission. The base-92 text encoding is the wire format. The SHA-256 computation uses canonical binary records.

---

## Receipt Code

A 5-character human-readable code derived from the current hash, updated after each placement and displayed live on the game canvas:

```
receipt_code = base40_encode(H_n[0:4])

Base-40 alphabet: 0-9 A-Z . - _ !
```

Five base-40 characters encode 40^5 = 102,400,000 values from 4 bytes (2^32 = 4,294,967,296). This is a truncation — collisions are theoretically possible but astronomically unlikely within a tournament bracket.

---

## Provably Fair Seed Protocol

1. **Before game start:** Server generates a random seed. Computes commitment = SHA-256(seed). Publishes the commitment to the player.
2. **During game:** The piece sequence is generated from the seed via a deterministic PRNG. The player cannot influence the sequence.
3. **After game:** The server reveals the seed. Anyone can verify that SHA-256(revealed_seed) equals the published commitment, and that the seed produces the recorded piece sequence through the same PRNG.
4. **Redundancy check:** Each placement's piece type field in the stream must match the seed-derived sequence at that position. A mismatch means the game code was modified to alter the piece sequence.

---

## Compression

The minified stream is compressed with zlib (deflate) level 9 for storage, transmission, and QR code encoding.

**Why zlib:** Empirical testing across seven compression algorithms (zlib levels 1/6/9, bz2 levels 1/9, lzma levels 6/9) on simulated game data at multiple sizes confirmed that zlib consistently produces the smallest output at this data scale. bz2 and lzma are designed for large files and add 6-12% overhead on kilobyte-scale streams.

zlib is also the most universally available compression algorithm — built into every browser (via CompressionStream), every language standard library, and every operating system.

### Empirical Size Results

| Game Size | Minified | Compressed (zlib-9) | Ratio | QR Version |
|-----------|----------|---------------------|-------|------------|
| 50 pcs    | 459 B    | 357 B               | 77.8% | v7         |
| 100 pcs   | 765 B    | 546 B               | 71.4% | v10        |
| 150 pcs   | 1,071 B  | 739 B               | 69.0% | v13        |
| 200 pcs   | 1,324 B  | 919 B               | 69.4% | v13        |
| 250 pcs   | 1,630 B  | 1,116 B             | 68.5% | v15        |
| 300 pcs   | 1,936 B  | 1,324 B             | 68.4% | v17        |
| 400 pcs   | 2,495 B  | 1,729 B             | 69.3% | v20        |
| 500 pcs   | 3,054 B  | 2,142 B             | 70.1% | v25        |
| **600 pcs** | **3,666 B** | **~2,530 B**    | **69.0%** | **v26**    |

Compression ratio stabilizes at approximately 69% regardless of game length. All game sizes up to the 600-piece kill screen ceiling fit in a single QR code (v26 capacity: 2,672 bytes).

### Key Finding

Base-92 text compresses to a smaller size than equivalent raw binary data after zlib compression. At 300 pieces, the text format compresses to 1,324 bytes versus raw binary at 1,339 bytes — text is 1.1% smaller. This occurs because base-92 character encoding creates byte-level repetition patterns that zlib's LZ77 dictionary matches more efficiently than the bit-level patterns in packed binary. The text encoding provides human readability at zero compression cost.

---

## QR Code Encoding

The compressed stream (zlib output) is encoded into a QR code in binary mode. The game renders this QR code on the canvas at game-over. The validator app captures it via camera.

Error correction level L (7% recovery) is used. The hash chain already provides integrity detection — any corruption that survives QR error correction will be caught by the hash chain verification. Level L maximizes data capacity per QR version.

---

## Verification Algorithm

```
function verify(compressed_data, revealed_seed):

    // Decompress
    stream_text = zlib_inflate(compressed_data)

    // Parse: split on semicolons for sections, commas for header fields
    sections = stream_text.split(";")
    header_parts = sections[0].split(",")

    seed_hex    = header_parts[0]          // 64 hex chars
    version_hex = header_parts[1]          // 64 hex chars
    stats       = header_parts[2]          // 10 base-92 chars
    score       = from_b92(stats[0:4])
    level       = from_b92(stats[4:6])
    lines       = from_b92(stats[6:8])
    n_pieces    = from_b92(stats[8:10])

    placements_block = sections[1]         // n_pieces * 4 chars
    snapshot_sections = sections[2:-1]     // semicolon-separated snapshots
    hash_hex = sections[-1]                // 64 hex chars

    // Verify seed commitment
    assert SHA-256(revealed_seed) == seed_hex

    // Initialize
    board = empty 25-word array (all zeros)
    rng = deterministic_rng(revealed_seed)
    H = SHA-256(revealed_seed)

    // Replay each placement
    for n = 0 to n_pieces - 1:

        // Decode placement (4 chars)
        chunk = placements_block[n*4 : n*4+4]
        idx     = from_b92(chunk[0:2])
        timing  = from_b92(chunk[2:4])
        type    = idx / 1000
        rot     = (idx % 1000) / 250
        x       = (idx % 250) / 25
        drop_y  = idx % 25

        // Verify piece sequence matches seed-derived RNG
        expected_type = rng.next() % 7
        assert type == expected_type

        // Verify placement legality (bitwise AND = 0, no overlap)
        piece_words = lookup_piece_pattern(type, rot)
        for r in piece_rows:
            assert (piece_words[r] shifted to x) AND board[drop_y + r] == 0

        // Apply placement (bitwise OR)
        for r in piece_rows:
            board[drop_y + r] |= (piece_words[r] shifted to x)

        // Clear complete rows (word == 0x03FF)
        remove full rows, shift remaining rows down

        // Advance hash chain
        record = serialize_binary(type, rot, x, drop_y, timing, board)
        H = SHA-256(H || record)

        // Check snapshot if one exists at this piece number
        if snapshot exists for piece (n + 1):
            assert board matches snapshot exactly

    // Terminal verification
    assert H == hash_hex

    // Bot detection (advisory, not pass/fail)
    analyze_timing_distribution(all timing values)

    return VALID
```

---

## Implementation Notes

### Game Client (JavaScript, browser)

```javascript
// Compress stream for QR encoding
const encoder = new TextEncoder();
const raw = encoder.encode(minifiedStream);
const cs = new CompressionStream('deflate');
const writer = cs.writable.getWriter();
writer.write(raw);
writer.close();
const compressed = await new Response(cs.readable).arrayBuffer();

// Render QR code on canvas
qrcode.generate(new Uint8Array(compressed), {mode: 'byte', ecLevel: 'L'});
```

### Validator App (separate device, camera input)

```javascript
// Capture QR from camera → compressed bytes
const compressed = qrScanner.decode(cameraFrame);

// Decompress
const ds = new DecompressionStream('deflate');
const writer = ds.writable.getWriter();
writer.write(compressed);
writer.close();
const raw = await new Response(ds.readable).arrayBuffer();
const streamText = new TextDecoder().decode(raw);

// Parse and verify
const result = verify(streamText, revealedSeed);
```

### Shared Codec

Both applications use the same base-92 encode/decode implementation and the same stream parsing logic. The codec is the only shared code between the two independent codebases. It is defined by this specification and implemented in `stream_codec.py` (reference implementation) with JavaScript ports for both client and validator.

---

## Size Budget

### 300-piece game (mid-skill reference)

```
Header:          140 chars
Placements:    1,200 chars  (300 x 4)
Snapshots:       529 chars  (10 snapshots x 52, plus 9 semicolons)
Terminal hash:    64 chars
Delimiters:        3 chars  (3 semicolons between sections)
────────────────────────────
Minified total: 1,936 chars

Compressed:    ~1,324 bytes  (zlib-9)
QR version:    17            (1,556 byte capacity, 232 bytes spare)
```

### 600-piece game (kill screen ceiling)

```
Header:          140 chars
Placements:    2,400 chars  (600 x 4)
Snapshots:     1,059 chars  (20 snapshots x 52, plus 19 semicolons)
Terminal hash:    64 chars
Delimiters:        3 chars  (3 semicolons between sections)
────────────────────────────
Minified total: 3,666 chars

Compressed:    ~2,530 bytes  (zlib-9)
QR version:    26            (2,672 byte capacity, 142 bytes spare)
```

---

## In-Frame Visual Encoding

The QR code is the primary verification channel. The following visual encoding channels are secondary — they are embedded directly in the game canvas on every frame, including during active play and in any screenshot. Together they allow a single screenshot to carry substantially all game history data, independent of QR decoding.

These channels are not part of the stream format and are not verified by the validator. They serve transparency, leaderboard screenshot verification, and the broader design principle: every frame of the game is a partial receipt.

### Channel 1: Verification Stripe (Piece History Tape)

A colored block is appended to the perimeter tape on every piece lock. Each block encodes:

- **Color** — piece type (I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue, L=orange). 3 bits.
- **Dot X position** — which of the 4 placement slots was chosen, encoded symmetrically: slots 1 and 4 are mirrored about the block center, slots 2 and 3 are mirrored inward. Formula: `pos = round(slot * (w-1) / 3)`. 2 bits.
- **Dot Y position** — piece rotation (0–3), encoded on the vertical axis using the same symmetric formula. 2 bits.

Total per block: 7 bits (piece type + slot + rotation). This matches the P-frame record minus timing and column — both of which are present in the other channels.

The tape routes counter-clockwise around the playfield: right side up → top across → left side down → bottom across. Block size is fixed at `max(4, floor(perimeter/270))` pixels so that approximately 270 pieces fill one revolution — roughly 90% of a kill screen game. When the tape exceeds one revolution, additional columns grow outward from the right and left sides with a 1-pixel black gap between them. History is unlimited — no blocks are ever overwritten or discarded.

### Channel 2: Timing Strip

A 1-pixel-tall grayscale strip runs parallel to each block in the verification stripe, separated by a 1-pixel black gap. Intensity encodes placement timing:

```
intensity = round(min(timing_ms, 8463) / 8463 * 255)
```

Dark = fast placement. Bright = slow. This embeds the timing field from the P-frame record directly into the visual history. The timing distribution across all pieces is visible as a luminance pattern — bot play produces uniform gray; human play produces variable intensity.

### Channel 3: Board Luminance Steganography

The board cells visible on any screenshot are rendered with a slight luminance modulation (±2 brightness units, imperceptible to the eye and survivable in PNG). Each cell carries 1 bit. At 10 × 25 = 250 cells, each frame carries 250 bits = 31 bytes.

This space embeds periodic hash chain checkpoints: a 4-byte truncated H-frame every 30 pieces = approximately 10 checkpoints over a 600-piece game = 40 bytes. At 31 bytes per frame, two consecutive screenshots together carry the full checkpoint set.

This channel functions as a passive integrity probe. A doctored screenshot would need to correctly recompute not only the visible board state but the embedded hash values — which requires the full hash chain from game start.

### Combined Per-Screenshot Data Budget (600-piece game)

| Channel | Data per block | Blocks | Total bits |
|---------|---------------|--------|------------|
| Stripe color (piece type) | 3 bits | 600 | 1,800 bits |
| Stripe dot X (slot) | 2 bits | 600 | 1,200 bits |
| Stripe dot Y (rotation) | 2 bits | 600 | 1,200 bits |
| Timing strip (ms) | 8 bits | 600 | 4,800 bits |
| Board stego (hash chain) | 1 bit/cell | 250 | 250 bits/frame |

A screenshot taken at game-over carries: full piece type sequence, full slot sequence, full rotation sequence, full timing sequence, and approximately 10 hash chain checkpoints. The seed (from the receipt code already visible on-screen) and the column positions (derivable from stripe routing position) complete the picture. A single screenshot is very nearly a full P-frame log.

---

*Format version: 1.2*
*April 2026*
