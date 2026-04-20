# CELLTOWER Playback & Verification

## Stream Format

Every completed game produces a stream — a compact, printable string that is both a replay file and a cryptographic proof. The format is:

```
SEED5,STATS10,PLAYERNAME;PLACEMENTS;TERMHASH40
```

| Field | Length | Description |
|-------|--------|-------------|
| SEED5 | 5 B92 chars | Random game seed (16 bytes → B92 encoded) |
| STATS10 | 10 B92 chars | Score (4) + Level (2) + Lines (2) + Pieces (2), all B92 |
| PLAYERNAME | 1–3 chars | Player's chosen 3-char B92 name |
| PLACEMENTS | 4 × pieces chars | Each piece: 2-char position + 2-char timing (B92) |
| TERMHASH40 | 40 B92 chars | Terminal SHA-256 hash of the full game chain |

Fields are separated by semicolons (`;`). The header's three sub-fields are comma-separated.

**B92 character set:** ASCII 33–126 excluding comma (44) and semicolon (59) = 92 printable characters.

---

## Hash Chain

Every placement is woven into a running SHA-256 chain:

```
H_0 = SHA-256(seed_bytes)         // 16 random bytes, generated at game start
H_n = SHA-256(H_{n-1} || record)  // record = position + timing for piece n
```

The terminal hash (last H_n) is appended to the stream. Verification replays every piece, rebuilds the chain from scratch, and compares the recomputed terminal hash to the one in the stream. Any tampered placement, any reordered piece, any altered timing — all produce a different terminal hash.

**Decade snapshots:** Every 10 pieces, the current hash is checkpointed into a block ledger. This enables partial auditing and tournament "decade receipts."

---

## Human Probability Score (HPS)

The verifier also computes an HPS — a 0.0–1.0 estimate of whether the timing pattern is consistent with human reaction times:

- **≥ 0.72 → PASS** — consistent with human play
- **0.50–0.72 → REVIEW** — borderline; requires human judgment
- **< 0.50 → FAIL** — timing pattern inconsistent with human cognition

**Neural Processing Floor (NPF):** If a placement takes < 150ms while covering ≥ 70% of the board (high cognitive load), it is flagged as neurologically impossible. Multiple NPF hits shift the HPS toward FAIL.

---

## Replay Flow

1. **User copies a stream** (from RECEIPT button or external source)
2. **PASTE button** opens the native paste overlay (textarea)
3. `_tryLoadPasteStream()` validates the stream via `_looksLikeStream()`
4. On valid input: `_stopReplayMode()` resets to clean lobby state
5. `setTimeout(0)` defers one tick; then `_startReplayMode(stream)` begins
6. `startGame()` reinitializes board, score, and hash chain
7. Each piece: `_startReplayPlay()` reads the next recorded placement, navigates the piece to the recorded position via `_navigateAndLock()`, then locks
8. When all placements are exhausted: replay ends, performance is saved to the library and per-name high score table

---

## Per-Name High Score Tables

High scores are stored per player name in `localStorage` under the key `ct_hi_v2`:

```json
{
  "ACE": { "score": 1234567, "stream": "...", "playerName": "ACE" },
  "BOB": { "score": 890000,  "stream": "...", "playerName": "BOB" }
}
```

- A name's high score updates only when a **higher** score is achieved under that name.
- Watching a replay stores the performance under the **replayed player's name**, not the viewer's.
- Switching names on the identity screen loads that name's personal best immediately.
- To reset a name's high score: open the Library (tap HIGH), go to PLAYERS tab, tap ✕ next to the entry.

---

## Replay Library

All streams loaded via paste — and all personal bests from live games — are stored in `localStorage` under `ct_library_v1` (array, max 100 entries, FIFO eviction).

Access via: **tap the HIGH score display** → Library screen opens.

**Library tabs:**
- **PLAYERS** — one entry per player name (their personal best), from `ct_hi_v2`
- **TOP SCORES** — all library entries sorted by score, highest first
- **BUILT-IN** — curated demo games bundled with the application

Each entry shows: player name badge · score · lines/level info. Tap an entry to start replay. Tap ✕ (PLAYERS tab) to delete that player's stored high score.

---

## Verification Console Output

When a live game ends, the browser console logs:

```
[SELFCHECK] ✓ PASS — 247 pieces, 38ms | HPS: 0.81 [PASS] | Decades: 24
[SELFCHECK] verifyHumanity() → DPC-HPS: 0.79 [PASS] over 247 pieces
```

A stream that has been tampered with produces:

```
[SELFCHECK] ✗ FAIL — terminal hash mismatch
```

---

*CELLTOWER · the High Tower District · Fresno, California*
*Document reflects codebase state as of 2026-04-19*
