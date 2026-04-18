# CELLTOWER Replay Stream Format
## Specification v1.4

---

## Design Ceiling: 600 Pieces

CELLTOWER ends at a kill screen at level 20. Level 20 requires clearing 200 lines. Each cleared line is 10 cells wide, giving 2,000 cleared cells over the game's lifetime. The visible playfield at game-over is 10 × 25 = 250 occupied cells. Total cell budget: 2,250 cells. At 4 cells per piece, that is 562.5 pieces — rounded to **600 pieces** as the design ceiling.

All capacity estimates and size budgets in this document are sized to handle a 600-piece game. A game that reaches the kill screen will always fit within this budget.

---

## Design Constraints

1. **One stream, one checksum.** Valid or invalid. No partial recovery, no error correction, no UDP. Connection-oriented delivery — there may be delay but the stream arrives complete or not at all.
2. **Text-based.** Human-inspectable before compression. No raw binary in the wire format.
3. **Zero whitespace in the minified form.** The pre-compression representation contains no spaces, tabs, newlines, or carriage returns. Every character is either data or a structural delimiter.
4. **Compression-optimized.** The encoding is designed to compress well under zlib (deflate). The format exploits character-level patterns that LZ77 dictionaries match efficiently.
5. **Self-contained.** One stream = one complete game. Seed, version, placements, board snapshots, terminal hash — everything needed to verify.
6. **Screenshot as proof artifact.** A screenshot of the game canvas is the primary verification artifact. The visual encoding channels (verification stripe, timing strip) embedded in the canvas carry the full game history — piece types, slot choices, rotations, and timing — in every frame. The compressed text stream is a secondary channel, shareable via the device share sheet or clipboard.

---

## Transport: Screenshot-Primary Interface

The game canvas is the proof artifact. Every screenshot of the game in progress — or at game-over — is a partial or complete receipt. The verification stripe running around the playfield perimeter encodes the full piece history visually, frame by frame. No secondary application, camera, or decoding step is required to establish that the game was played as displayed.

### Primary Channel: Screenshot

The player finishes a game and screenshots the game-over screen. The screenshot carries: the live receipt code (5-character base-40, visible on canvas), the full verification stripe (piece type, slot, rotation, timing), and the board state. This is the chain of custody. The image is the record.

### Secondary Channel: Text Stream

At game-over the game also makes the compressed text stream available via the device share sheet (`navigator.share()`) or clipboard. This stream can be pasted into a validator application for mathematical verification of the hash chain. It is a supplement to the screenshot, not a replacement.

### Tournament Mode

The player's phone runs the game. A tournament official can photograph the player's screen directly, capturing the verification stripe in real time. Chain of custody is physical and visible. Optionally, the official receives the shared text stream from the player's device for hash-chain verification.

### Architecture Implications

No server infrastructure is required during development. The game runs as a static HTML file on GitHub Pages. The validator is a completely independent codebase that only needs to know this stream format spec. The two applications share one spec and one codec implementation — nothing else.

---

## Dual Transport Architecture

The game must deliver a complete, verifiable game record from the player's device to a validator. Two transport paths are being developed in parallel. They are not mutually exclusive during development — both may be active simultaneously. When one proves clearly superior in all relevant cases, the other is disabled. The goal is convergence on the best solution, not premature commitment.

---

### Path A: Text Stream via Share Sheet / Clipboard

**Status: Implemented.**

At game-over, the game compresses the replay stream with zlib and makes it available via `navigator.share()` (iOS share sheet) or clipboard. The player taps a SHARE button and the stream goes wherever they direct it — AirDrop, Messages, email, a validator app.

**Strengths:**
- Mathematically complete. The stream contains the full hash chain, all placements, all board snapshots, and the terminal hash. Verification is deterministic and unambiguous.
- No visual decoding required. The stream is text — paste it anywhere.
- Trivially small. A 600-piece kill-screen game compresses to ~2,530 bytes. Fits in a text message.
- No dependencies in the game itself. Compression via native `CompressionStream` (Safari 16.4+).

**Weaknesses:**
- Requires an active share action by the player. It is not passively present in a screenshot.
- The validator must exist as a separate application to receive and verify the stream.
- The stream alone without a screenshot is a less compelling physical artifact than an image.

---

### Path B: Custom Visual Matrix (High Tower District Format)

**Status: Design phase.**

A proprietary dense visual encoding rendered on the game canvas — conceptually descended from the data matrix family but owned entirely by the High Tower District. It encodes the same stream (or a compact derivative) as a grid of visual symbols that can be read by a CELLTOWER validator application from a screenshot.

This is not a QR code and is not intended to be readable by any generic camera or QR scanner. The format spec is open and documented here (legal transparency), but the toolchain is part of the High Tower District platform. No external standard, no external library, no external authority.

**Design intent:**
- The matrix appears on the game canvas at game-over, rendered by the game itself — zero dependencies, pure canvas drawing.
- A screenshot of the game-over screen is the complete artifact: the receipt code, the verification stripe, the board state, and the matrix are all present in a single image.
- A validator app reads the matrix from a screenshot image (not from a live camera feed — screen-to-camera transfer is not a goal). The validator decodes the matrix, inflates the stream, and runs the hash chain verification.
- Visual design is High Tower District branded. The matrix looks like something from this world, not from a generic tool.

**What the format needs to specify (not yet finalized):**
- Grid dimensions and cell size relative to canvas layout
- Symbol set: number of distinct symbols, visual encoding of each (color, shape, luminance, or combination)
- Error detection: the hash chain already provides integrity — the matrix format may not need independent error correction
- Alignment markers: how the validator locates and orients the matrix within a screenshot
- Capacity target: must encode ~2,530 bytes (600-piece game) at a cell density achievable in the canvas area available

**Candidate approaches:**
- **Color grid:** Each cell is one of N colors, encoding log₂(N) bits. At 16 colors (4 bits/cell), a 40×40 grid (1,600 cells) carries 800 bytes — not sufficient alone. At 256 colors (8 bits/cell), same grid carries 1,600 bytes.  Combining with luminance levels doubles capacity.
- **Binary dot matrix:** Two-symbol (black/white) cells, high spatial density. Requires large grid or very small cells. Equivalent to a traditional data matrix in structure, with custom alignment and framing.
- **Hybrid:** Use the verification stripe (already implemented) as the primary visual record for human inspection, and a compact high-density matrix for machine-readable verification. The stripe is the human receipt. The matrix is the machine receipt. Both are in every screenshot.

**Legal transparency constraint:** Regardless of how proprietary the format and toolchain are, the encoding algorithm must be fully documented in this specification. Anyone must be able to implement a validator independently. The High Tower District owns the format; no one else is obligated to use it — but no one can be blocked from verifying it. This is the same principle as open-source cryptographic primitives: the algorithm is public, the product is owned.

---

### Convergence Criteria

One path will eventually be disabled. The decision will be made on the following criteria:

| Criterion | Path A (Text Stream) | Path B (Custom Matrix) |
|-----------|---------------------|----------------------|
| Game is dependency-free | Yes | Yes (canvas-only rendering) |
| Screenshot is complete artifact | No (stream is separate) | Yes (matrix is in the image) |
| Validator complexity | Low (text parsing) | Medium (image decoding) |
| Human-readable artifact | No | No (requires validator) |
| Works offline | Yes (clipboard) | Yes (screenshot) |
| Tamper-evident from image alone | No | Yes |
| Tournament chain of custody | Requires share action | Screenshot sufficient |
| Legal auditability | Full | Full (if spec is open) |

If Path B achieves sufficient data density and the validator app is built, it is the stronger solution for tournament play — the screenshot becomes the sole artifact and no share action is required. Path A remains simpler to implement and simpler to verify independently.

Both paths are active until the matrix format is finalized and the density question is answered. If the matrix cannot encode a 600-piece game at a visually acceptable cell size, Path A wins by default.

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

The minified stream is compressed with zlib (deflate) level 9 for storage and transmission.

**Why zlib:** Empirical testing across seven compression algorithms (zlib levels 1/6/9, bz2 levels 1/9, lzma levels 6/9) on simulated game data at multiple sizes confirmed that zlib consistently produces the smallest output at this data scale. bz2 and lzma are designed for large files and add 6-12% overhead on kilobyte-scale streams.

zlib is also the most universally available compression algorithm — built into every browser (via CompressionStream), every language standard library, and every operating system.

### Empirical Size Results

| Game Size | Minified | Compressed (zlib-9) | Ratio |
|-----------|----------|---------------------|-------|
| 50 pcs    | 459 B    | 357 B               | 77.8% |
| 100 pcs   | 765 B    | 546 B               | 71.4% |
| 150 pcs   | 1,071 B  | 739 B               | 69.0% |
| 200 pcs   | 1,324 B  | 919 B               | 69.4% |
| 250 pcs   | 1,630 B  | 1,116 B             | 68.5% |
| 300 pcs   | 1,936 B  | 1,324 B             | 68.4% |
| 400 pcs   | 2,495 B  | 1,729 B             | 69.3% |
| 500 pcs   | 3,054 B  | 2,142 B             | 70.1% |
| **600 pcs** | **3,666 B** | **~2,530 B**    | **69.0%** |

Compression ratio stabilizes at approximately 69% regardless of game length. A full kill-screen game compresses to approximately 2,530 bytes — trivially small for share-sheet or clipboard transport.

### Key Finding

Base-92 text compresses to a smaller size than equivalent raw binary data after zlib compression. At 300 pieces, the text format compresses to 1,324 bytes versus raw binary at 1,339 bytes — text is 1.1% smaller. This occurs because base-92 character encoding creates byte-level repetition patterns that zlib's LZ77 dictionary matches more efficiently than the bit-level patterns in packed binary. The text encoding provides human readability at zero compression cost.

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
// Compress stream for sharing
const encoder = new TextEncoder();
const raw = encoder.encode(minifiedStream);
const cs = new CompressionStream('deflate');
const writer = cs.writable.getWriter();
writer.write(raw);
writer.close();
const compressed = await new Response(cs.readable).arrayBuffer();

// Share via device share sheet (primary) or clipboard (fallback)
const blob = new Blob([compressed], {type: 'application/octet-stream'});
const file = new File([blob], 'celltower-receipt.bin', {type: blob.type});
if (navigator.canShare && navigator.canShare({files: [file]})) {
    await navigator.share({files: [file], title: 'CELLTOWER Receipt'});
} else {
    // Fallback: base64 text to clipboard
    const b64 = btoa(String.fromCharCode(...new Uint8Array(compressed)));
    await navigator.clipboard.writeText(b64);
}
```

### Validator App (receives shared stream)

```javascript
// Decompress received bytes
const ds = new DecompressionStream('deflate');
const writer = ds.writable.getWriter();
writer.write(receivedBytes);
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
```

---

## In-Frame Visual Encoding

The visual encoding channels embedded in the game canvas are the **primary verification interface**. They are present in every frame — during active play, at game-over, and in any screenshot. Together they allow a single screenshot to carry substantially all game history data.

These channels are not part of the stream format and are not verified by the hash-chain validator. They serve transparency, leaderboard screenshot verification, and the core design principle: every frame of the game is a receipt.

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

*Format version: 1.4*
*April 2026*
