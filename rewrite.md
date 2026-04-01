# CELLTOWER Refactor Blueprint
## Goal: Consolidated State Object for Tournament Verification

### Why This Matters
The SHA-based per-placement hash chain requires snapshotting complete game state at every `lock()` call. Current architecture scatters state across 60+ globals mutated by dozens of functions — no clean snapshot is possible. Consolidating into `G` enables:
- `JSON.stringify(G)` snapshots for hash chain input
- Server-side replay verification (same `G` transitions in Node)
- Spectator streaming (serialize `G`, render remotely)
- Deterministic replay (seed + input sequence → identical `G` history)

---

## Phase 1: State Inventory

### CORE GAME STATE (must be in G — these define a game position)

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `board` | `array[25][10]` | `init`, `placeOn`, `lock`, `animateClearLines` callback | `G.board` |
| `cur` | `{k,rot,c,rgb}` | `spawn`, `rot`, `lock` (nulled), `choose`, `_animatePlacement`, `_applyMove` | `G.cur` |
| `cx` | `int` | `spawn`, `mhz`, `rot`, `_applyMove`, `choose`, `_animatePlacement`, `_startAutoPlay` | `G.cx` |
| `cy` | `int` | `spawn`, `sdrop`, `hdrop`, `_applyMove`, `_gravStep`, `choose`, `_animatePlacement` | `G.cy` |
| `nxt` | `{k,rot,c,rgb}` | `spawn`, `mkPiece`, `verifyTetrisPiece` | `G.nxt` |
| `score` | `int` | `addScore`, `awardLineClearBonus`, `checkNoHoleBonus`, `fanfare` | `G.score` |
| `level` | `int` | `addScore` | `G.level` |
| `lines` | `int` | `addScore` | `G.lines` |
| `hi` | `int` | `addScore`, `triggerDead`, `awardLineClearBonus` | `G.hi` |
| `dead` | `bool` | `triggerDead`, `init` | `G.dead` |
| `paused` | `bool` | `togglePause`, `init`, `showReceipt` | `G.paused` |

### SCORING / BONUS STATE

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `piecePot` | `int` | `checkNoHoleBonus`, `awardLineClearBonus`, `init`, `spawn` | `G.piecePot` |
| `tetrisPot` | `int` | `fanfare`, `lock` callback, `init` | `G.tetrisPot` |
| `piecesPlaced` | `int` | `lock` callbacks, `init` | `G.piecesPlaced` |
| `tetrisStreak` | `int` | `fanfare`, `lock` callback, `init` | `G.tetrisStreak` |
| `tetrisMultiplier` | `int` | `fanfare`, `lock` callback, `init` | `G.tetrisMultiplier` |
| `currentScoringHoles` | `int` | `checkNoHoleBonus`, `spawn`, `fanfare`, `init` | `G.currentScoringHoles` |
| `scoringDisabledSound` | `bool` | `awardLineClearBonus`, `checkNoHoleBonus`, `init` | `G.scoringDisabledSound` |
| `hfRun` | `int` | `checkNoHoleBonus`, `init` | `G.hfRun` |
| `hfBest` | `int` | `checkNoHoleBonus`, `triggerDead`, `init` | `G.hfBest` |
| `hfAllTime` | `int` | `checkNoHoleBonus` | `G.hfAllTime` |
| `_neverHoled` | `bool` | `checkNoHoleBonus`, `init` | `G.neverHoled` |
| `_tetrisLines` | `int` | `fanfare`, `init` | `G.tetrisLines` |
| `_dirtyRun` | `int` | `checkNoHoleBonus`, `init` | `G.dirtyRun` |
| `_dirtyBest` | `int` | `checkNoHoleBonus`, `init` | `G.dirtyBest` |
| `_towerSeverity` | `int` | `checkTowers`, `init` | `G.towerSeverity` |

### AI / PLACEMENT STATE

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `placements` | `array[4]` | `calcPlacements`→`applyNextOptions`, `lock` | `G.placements` |
| `allCands` | `array` | `calcPlacements` | `G.allCands` |
| `shownFootprints` | `Set` | `calcPlacements`, `applyNextOptions` | `G.shownFp` |
| `_candCursor` | `int` | `calcPlacements`, `applyNextOptions` | `G.candCursor` |
| `selectedPlacementIdx` | `int|null` | `_animatePlacement`, `lock` | `G.selectedIdx` |
| `_navStartT` | `float` | `_animatePlacement`, `lock` | `G.navStartT` |
| `playerHasMoved` | `bool` | `rot`, `mhz`, `calcPlacements` | `G.playerHasMoved` |
| `moveStartTime` | `float` | `rot`, `mhz`, `calcPlacements` | `G.moveStartT` |
| `labelPositions` | `array` | `drawGhosts` | `G.labelPositions` |
| `gapList` | `array` | `rebuildGapList`, `init` | `G.gapList` |
| `tetrisPrepCol` | `int` | `updateTetrisPrepStrategy` | `G.tetrisPrepCol` |
| `tetrisPrepActive` | `bool` | `updateTetrisPrepStrategy`, `init` | `G.tetrisPrepActive` |

### AUTOPLAY STATE

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `AUTO_PLAY` | `bool` | `toggleAutoPlay`, `restart` | `G.autoPlay` |
| `AUTO_SPEED` | `float` | `setAutoSpeed` | `G.autoSpeed` |
| `autoUsed` | `bool` | `toggleAutoPlay`, `init` | `G.autoUsed` |
| `_autoIv` | `timer` | many | `G.timers.autoIv` |
| `_animStep` | `fn|null` | `_executePath`, `_animatePlacement`, `stopSelTimer` | `G.timers.animStep` |
| `_animArmT` | `float` | `_executePath` | `G.timers.animArmT` |
| `_animArmMs` | `float` | `_executePath` | `G.timers.animArmMs` |
| `_autoPhase` | `obj|null` | `startSelTimer` | `G.timers.autoPhase` |

### PUZZLE STATE

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `puzzleQueue` | `array` | `buildPuzzleQueue`, `mkPiece`, `init` | `G.puzzle.queue` |
| `puzzleTargets` | `array` | `buildPuzzleQueue`, `lock`, `init` | `G.puzzle.targets` |
| `puzzleActive` | `bool` | `buildPuzzleQueue`, `mkPiece`, `lock`, `init` | `G.puzzle.active` |
| `puzzleWellCol` | `int` | `buildPuzzleQueue` | `G.puzzle.wellCol` |

### ANIMATION / VISUAL STATE (read by renderer, not part of hash)

| Global | Type | Mutated By | G.field |
|--------|------|-----------|---------|
| `particles` | `array` | `explodeBlock`, `drawPlayfield`, `init` | `G.vfx.particles` |
| `explodedCells` | `Set` | `animateClearLines`, `init` | `G.vfx.exploded` |
| `clearAnimating` | `bool` | `animateClearLines`, `init` | `G.vfx.clearAnim` |
| `_shakeT` | `float` | `triggerShake` | `G.vfx.shakeT` |
| `_shakeDur` | `float` | `triggerShake` | `G.vfx.shakeDur` |
| `_shakeAmp` | `float` | `triggerShake` | `G.vfx.shakeAmp` |
| `_shakeField` | `obj` | `triggerShake` | `G.vfx.shakeField` |
| `_shakeHUD` | `obj` | `triggerShake` | `G.vfx.shakeHUD` |

### TIMER HANDLES (cancel-group, not hashable)

| Global | Type | G.field |
|--------|------|---------|
| `_dropDeadline` | `float` | `G.timers.dropDeadline` |
| `_dropRafId` | `timer` | `G.timers.dropRafId` |
| `selIv` | `interval` | `G.timers.selIv` |
| `_txDrainTO` | `timeout` | `G.timers.txDrainTO` |
| `_txRAF` | `raf` | `G.timers.txRAF` |

### SESSION / META STATE

| Global | Type | G.field |
|--------|------|---------|
| `_gamesPlayed` | `int` | `G.meta.gamesPlayed` |
| `_gamePauseCount` | `int` | `G.meta.pauseCount` |
| `_gamePauseStartT` | `float` | `G.meta.pauseStartT` |
| `_gameTotalPauseMs` | `float` | `G.meta.totalPauseMs` |
| `_p10Log` | `array` | `G.meta.p10Log` |
| `txLog` | `array` | `G.tx.log` |
| `txRunningTotal` | `int` | `G.tx.runningTotal` |

### MARQUEE STATE

| Global | Type | G.field |
|--------|------|---------|
| `_mqOffset` | `float` | `G.marquee.offset` |
| `_mqUserPaused` | `bool` | `G.marquee.userPaused` |
| `_mqPauseCount` | `int` | `G.marquee.pauseCount` |
| `_mqPauseStartT` | `float` | `G.marquee.pauseStartT` |
| `_mqTotalPauseMs` | `float` | `G.marquee.totalPauseMs` |
| `_mqHueOffset` | `float` | `G.marquee.hueOffset` |
| `_mqLastT` | `float` | `G.marquee.lastT` |
| `_mqMsgIdx` | `int` | `G.marquee.msgIdx` |

### TIP BUBBLE STATE

| Global | Type | G.field |
|--------|------|---------|
| `_tipMoveCount` | `int` | `G.tip.moveCount` |
| `_tipChoiceUsed` | `bool` | `G.tip.choiceUsed` |
| `_tipShownAt` | `float` | `G.tip.shownAt` |
| `_tipDismissed` | `bool` | `G.tip.dismissed` |

### UI STATE (renderer-only, mutable display cache)

| Global | Type | G.field |
|--------|------|---------|
| `ui.tickers` | `array` | `G.ui.tickers` |
| `ui.flash` | `obj|null` | `G.ui.flash` |
| `ui.debugMode` | `bool` | `G.ui.debugMode` |
| `ui._levelTaps` | `array` | `G.ui.levelTaps` |
| `ui._dbgTap` | `obj` | `G.ui.dbgTap` |
| `ui.gameStarted` | `bool` | `G.ui.gameStarted` |

### LAYOUT / RENDERING (NOT in G — these are screen config)

These stay as module-level constants. They don't define game state:
- `SW`, `SH`, `CELL`, `R`, `hitZones` — screen geometry
- `CTX`, `cv` — canvas refs
- `DM_FONT`, `SEG7` — font tables
- `MARQUEE_MESSAGES`, colors, font templates — constants
- `ctrlPressed`, `_sliderDragging` — transient input state

---

## Phase 2: Migration Order

### Step 1 — Declare G, alias existing globals
Non-breaking: `const G = {}; G.board = board; G.cur = cur;` etc.
Every global still works. G is a parallel reference.

### Step 2 — Route all WRITES through G
Change `score = x` → `G.score = x` everywhere.
Keep reads via globals for now (they alias the same values initially).

### Step 3 — Route all READS through G
Change `if(dead)` → `if(G.dead)` everywhere.
At this point the bare globals are dead code.

### Step 4 — Remove bare globals
Delete `var score=0` etc. G is the single source of truth.

### Step 5 — Kill DOM stubs
Remove `setupDOMStubs()`. Replace `document.getElementById('sv').textContent=score`
with `G.score = newScore` (renderer reads G directly — already true after step 3).

### Step 6 — Add snapshot hook in lock()
```javascript
// In lock(), BEFORE placeOn():
G.hashChain = sha256(G.hashChain + JSON.stringify({
  board: G.board,
  piece: G.cur.k, rot: G.cur.rot,
  x: G.cx, y: G.cy,
  score: G.score, holes: G.currentScoringHoles,
  piecePot: G.piecePot, tetrisPot: G.tetrisPot
}));
G.receiptCode = base40(G.hashChain, 5);
```

### Step 7 — Extract pure AI module
`computeCandidates(board, cur, nxt, opts) → candidates[]`
No globals, no side effects. Testable in Node.

### Step 8 — Phase state machine
```
enum Phase { TITLE, PLAYING, ANIM_CLEAR, ANIM_PATH, PAUSED, DEAD, RECEIPT }
```
One transition function. All timer management centralized.

---

## Phase 3: Hash Chain Spec (from receipt.md)

### Per-placement record (binary, 32 bytes)
```
[4B piece_id] [1B rotation] [1B x] [1B y] [4B score_after]
[4B piecePot] [4B tetrisPot] [1B holes] [1B level]
[1B lines_cleared] [10B board_hash]
```

### Chain construction
```
H_0 = SHA-256(game_seed)
H_n = SHA-256(H_{n-1} || placement_record_n)
receipt_code_n = base40(H_n[0:4])  // 5 chars from first 4 bytes
```

### Verification
Replay engine (Node): given seed + placement records, reconstruct
board state at each step, recompute H_n, confirm terminal H matches.

### Display
- QR code on canvas: updates after each lock() — encodes latest H_n
- 5-char base-40 code: rendered in receipt and on HUD

---

## Notes

- `_lastScoringHoleCheck` is a boolean edge-detector — tracks whether
  the board was hole-free on the previous placement. This is the trigger
  for the "🔥 CS" ticker event and the no-hole fanfare. Must be in G
  for replay verification (it affects scoring flow).

- `_straightFp` is set inside `calcPlacements` — it's the footprint key
  of the "straight drop from current position" candidate. Used by
  `drawGhosts` to determine which ghost to show during the initial
  0.5s before player moves. Purely visual — not needed in hash.

- `window._proofCorrectFp` and `window._proofCorrectCand` are the puzzle
  system's "answer key" for the current piece. These should move to
  `G.puzzle.correctFp` and `G.puzzle.correctCand`.

- Timer handles (`_dropRafId`, `_autoIv`, `selIv`) go in `G.timers`
  but are NOT part of the hash — they're execution artifacts.
  The state machine (Phase 8) will replace them with a single
  `G.phase` enum + centralized timer management.
