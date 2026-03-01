# CELLTOWER — Platform README & Implementation Specification

**Version:** 0.333b  
**Author:** Aaron Hightower  
**Stack:** Single-file HTML5 · Canvas 2D · Web Audio API · Vanilla JS (no dependencies)  
**Live:** https://aahigh.github.io/CELLTOWER/  
**Source:** `index.html` (~3,600 lines, ~119KB JS, ~11KB CSS)

-----

## Spirit & Design Intent

CELLTOWER is a Tetris-variant built in the spirit of **1979–1982 coin-op arcade culture** — Asteroids, Defender, Centipede. The target demographic is the confident, aggressive, skill-driven male player who expects to master a machine in public, perform under pressure, and be compensated for skill. Think: playing pool for quarters, or feeding the Defender cabinet at a bar knowing you’ll walk away with more than you put in.

Defender was reviewed in *Playboy* as “a real man’s game.” CELLTOWER is built in that tradition — fast, punishing, technically deep, with a scoring system that **rewards mastery disproportionately**. The AI AUTO mode is not a crutch — it is a **teaching tool** that demonstrates optimal play so a skilled human can internalize and eventually exceed it.

This codebase is **one instance of a larger platform** — a vibe-coded game engine that could host multiple arcade-style titles with shared infrastructure: scoring, event logging, audio synthesis, AI demonstration, and physical control I/O.

-----

## Architecture Overview

Everything lives in a single `index.html`. There are no build steps, no npm, no frameworks. This is intentional — the file is self-contained, deployable to any static host (GitHub Pages, S3, Netlify), and embeddable in any WebView on iOS/macOS/Android.

```
index.html
├── <head>          — viewport meta, Google Fonts (Orbitron, Share Tech Mono)
├── <style>         — ~11KB CSS, all layout and animation
├── <body>          — pure HTML structure, no inline styles except dynamic values
└── <script>        — ~119KB JS wrapped in DOMContentLoaded
    ├── Constants & piece definitions (NRS rotation system)
    ├── Board state & hole detection engine
    ├── Physics: gravity, lock delay, collision
    ├── Scoring engine (piecePot, tetrisPot, multipliers)
    ├── AI placement engine (4-candidate heuristic)
    ├── Web Audio synthesis engine (19 named sound events)
    ├── Event ticker (canvas-based scrolling log)
    ├── Tower detection (smoke alarm feedback)
    ├── Thermal receipt renderer (dot-matrix canvas font)
    └── Game loop (requestAnimationFrame)
```

-----

## Board & Physics

|Constant  |Value                |Notes                                                         |
|----------|---------------------|--------------------------------------------------------------|
|`COLS`    |10                   |Standard Tetris width                                         |
|`ROWS`    |25                   |20 visible + 5 spawn buffer rows above                        |
|`CELL`    |dynamic              |Computed from viewport: `floor(min(avW/10, avH/25))`, min 12px|
|`NES_SP[]`|30-step array        |NES gravity speeds in ms/frame, level-indexed                 |
|`NES_SC[]`|`[0,40,100,300,1200]`|NES line-clear base points × level                            |

### Piece System

Full NES right-handed rotation system (NRS). All 7 tetrominoes (I, O, T, S, Z, J, L) with 4 rotation states each, pre-defined as coordinate arrays. Spawn position mirrors NES Tetris exactly. Wall-kick is not implemented (authentic NES behavior).

### Hole Detection

`countScoringHoles(board)` — a **topological flood-fill** that identifies cells which are covered by at least one filled cell in their column. This is stricter than naive hole counting: it distinguishes **scoring holes** (accessible from surface with correct piece) from **permanent holes** (geometrically unreachable by any piece). Permanent holes trigger the `PERMANENT_HOLE_PENALTY` which is near-fatal to scoring.

-----

## Scoring System

CELLTOWER uses a **dual-pot** scoring architecture layered on top of NES base scoring. This is the core innovation — it creates a compulsive risk/reward loop that rewards clean play exponentially.

### Piece Pot (`piecePot`)

Every piece placed cleanly (zero new holes created) adds:

```
pieceBonus = min(100 × tetrisMultiplier, 1600)
```

The pot accumulates silently. It is **collected on any line clear** and **zeroed on hole creation**. This creates constant tension — the longer you stay clean, the more you stand to lose.

**T-Bonus Panel display:** `CLEAN` = `piecePot ÷ 100` (piece count, not points)

### Tetris Pot (`tetrisPot`)

Virtual credits that build with each consecutive Tetris:

- Tetris #1 (mult=1): +2,000 credit
- Tetris #2 (mult=2): +4,000 credit
- Tetris #3 (mult=4): +8,000 credit
- Continues doubling, capped at 16×

**T-Bonus Panel display:** `TETRIS` = compact K format (e.g. `14k`)

### Line Clear Award Formula

For 1–3 line clears:

```
award = piecePot × lineFrac × holeFrac
```

- `lineFrac`: 1L=25%, 2L=50%, 3L=75%
- `holeFrac`: 0H=100%, 1H=90%, 2H=80%… 10H+=0% (scoring disabled)
- Rounded down to nearest 100, minimum 100 if raw ≥ 50

For 4-line Tetris: collects `piecePot + tetrisPot` in full.

### Bonus Constants

```javascript
TETRIS_PREP_BONUS   = 12000  // column prepared for I-piece drop
TETRIS_PREP_PENALTY = 25000  // column invaded that was prepared
SLIDE_BONUS         =  8000  // I-piece slid under overhang (×1.6 at dist 2, ×2 at dist 3+)
SLIDE_HOLE_PENALTY  = 60000  // slide created a hole
GAP_FILL_BONUS      = 18000  // piece filled a gap with open sky above
HOLE_REDUCE_BONUS   = 40000  // per buried cell eliminated
HOLE_CREATE_PENALTY = 60000  // per new buried cell created
HOLE_EXIST_PENALTY  =  8000  // per buried cell persisting on board
PERMANENT_HOLE_PENALTY = 120000  // near-fatal per unreachable cell
```

### Easter Eggs

- **Atari OG Bonus** (+20,490): Tetris cleared in ≤10 pieces from empty board
- **Perfect Square Bonus** (+20,490): board has a perfect square number of filled cells + I-piece is next

-----

## AI Engine (AUTO Mode)

The AI runs a **4-candidate heuristic** every piece spawn. It evaluates all rotations and columns, scores each placement, then presents the top 4 options as labeled overlay thumbnails (1–4) on the board.

### Placement Scoring Heuristic

The score for a candidate placement integrates:

- Aggregate column height (lower = better)
- Number of holes created (penalized heavily)
- Bumpiness (height variance between adjacent columns)
- Lines cleared by placement
- Tetris prep (is the rightmost column clear for I-piece?)
- Slide opportunities
- Gap fill opportunities
- Permanent hole risk

### AUTO Execution

When `AUTO_PLAY=true`, the AI:

1. Computes best placement on spawn
1. Waits `startDelay` (scales from 600ms at speed 1 → 0ms at speed 11)
1. Executes: rotate to target → strafe to target column → hard drop
1. Player can interrupt at any time by tapping any control

**Speed control:** Slider 1–11. Speed 11 displays `11🔊` (Spinal Tap reference). Speed scales `_autoIv` interval and initial delay.

**NES mode** (AUTO off): straight drop from current position, no lateral movement — authentic NES AI behavior for demonstration.

-----

## Audio Engine

All audio synthesized in real-time via **Web Audio API**. No audio files. The master gain node (`getMaster()`) controls global volume. All oscillators route through it.

### Sound Events

|Function                    |Description                                              |
|----------------------------|---------------------------------------------------------|
|`sndMove()`                 |Short high blip on L/R move                              |
|`sndRotate()`               |Two-tone chirp on rotation                               |
|`sndLock()`                 |Thud on piece lock                                       |
|`sndSoftDrop()`             |Tick on soft drop                                        |
|`sndHardDrop()`             |Descending sweep on hard drop                            |
|`sndSpawn()`                |Spawn indicator                                          |
|`sndBlockPop(rowRank, step)`|Per-cell pop during line clear animation                 |
|`sndLineClear(n)`           |Ascending fanfare scaled to line count                   |
|`sndTetrisBlip()`           |Tetris line-clear blip sequence                          |
|`sndLevelUp()`              |Level-up arpeggio                                        |
|`sndGameOver()`             |Descending game-over tone                                |
|`sndBonusReset()`           |Penalty buzz when piecePot zeroed                        |
|`sndBubblePop()`            |Bubble pop sequence for hole creation                    |
|`sndScoringDisabled()`      |Alarm when hole count kills scoring                      |
|`sndLineClearReversed()`    |Reversed fanfare                                         |
|`sndNoHole()`               |Clean placement confirmation                             |
|`sndWaitingTetris()`        |Anticipation tone when Tetris setup detected             |
|`sndTetrisPerfection()`     |Full ascending run + chord explosion for Easter eggs     |
|`sndSmokeAlarm(count)`      |**Tower warning** — 1–5 detuned 3150Hz square-wave chirps|

### Smoke Alarm Design

`sndSmokeAlarm(n)` synthesizes `n` alarms (1–5) each at 3150Hz (real T3 smoke alarm frequency) with individual detuning `[0, +18, -23, +37, -41]` Hz. Each chirp: 4ms attack, 55ms hold, exponential decay. Random 100–200ms gap between chirps (scheduled on Web Audio timeline, not setTimeout — sample-accurate). Mid-chirp frequency wobble simulates dying battery. Square wave throughout. Intentionally unpleasant.

### `blip(freq, freq2, dur, vol, type, delayT)` — Core Primitive

All sounds built on this. Schedules an oscillator with exponential gain decay. `freq2` enables pitch sweep. `delayT` enables future scheduling for arpeggios. Types: `square`, `triangle`, `sawtooth`, `sine`.

-----

## Event Ticker

A canvas-based scrolling event log in the left panel, positioned between the **bottom of the Lines box** and the **bottom of the playfield**. Height is measured live from DOM `getBoundingClientRect()`.

### Architecture

```
_txQueue[]  — incoming lines not yet visible {text, hue}
_txBuf[]    — visible rows, newest at bottom
```

### Drain Loop

Every `DRAIN_MS` (110ms), one row moves from `_txQueue` → bottom of `_txBuf`. If `_txBuf` is full (`_txMaxRows = floor(H/TX_LINE_H)`), oldest row is shifted off the top first. This means **multi-line events arrive staggered, one row every 110ms** — no jarring 3-row jumps.

### Rendering

Canvas right-aligned, `900 9px Courier New`. Rows pinned to bottom: `y = H - (n-i) × TX_LINE_H`. Colors: each row has a birth hue, advances 30° per row. Hue drifts 14°/sec over time. Numbers/K values rendered 28% brighter lightness than label text (visibility on dark background). Regex splits each line into numeric segments vs label segments for dual-brightness rendering.

### Ticker Nomenclature

|Display      |Meaning                                                  |
|-------------|---------------------------------------------------------|
|`+32.2k`     |Score awarded (compact K format)                         |
|`115CS`      |115-piece clean streak (no holes)                        |
|`4T`         |4-line Tetris clear                                      |
|`3L`         |3-line clear                                             |
|`2H`         |2 holes present                                          |
|`🔥🔥🔥`        |30-piece clean streak milestone (1🔥 per 10 pieces, max 5)|
|`🥶🧊❄️`        |Clean streak broken by hole creation                     |
|`🗼🗼🗼`        |Tower severity level 3                                   |
|`🎯 TETRIS 💎💎`|Tetris scored, streak 2 (1💎 per streak, max 5)           |
|`🏆✨ PERFECT` |Perfect square Easter egg                                |
|`👾 ATARI OG` |≤10 piece perfect clear Easter egg                       |
|`⛰️➡️✅`        |Towers cleared                                           |

-----

## Tower Detection

`checkTowers()` runs after every piece lands.

```
rawCount = columns where (height - boardMean ≥ 3) AND (taller than ≥1 neighbor)
severity = min(5, floor(rawCount / 3))
```

Severity escalates only — de-escalation is silent. Tower clearance (severity → 0 after ≥1) fires a celebration line. Fires `sndSmokeAlarm(severity)`.

|Severity|Emoji|Message         |Trigger             |
|--------|-----|----------------|--------------------|
|1       |🗼    |GETTING TALL    |3+ prominent columns|
|2       |🗼🗼   |HIGHTOWER ALERT |6+ prominent columns|
|3       |🗼🗼🗼  |BUILDING TOWERS!|9+                  |
|4       |🗼🗼🗼🗼 |DAD DISAPPROVES |12+                 |
|5       |🗼🗼🗼🗼🗼|HIGHTOWER LIVES |15 (all columns)    |

-----

## Thermal Receipt System

The RECEIPT button renders a **dot-matrix canvas receipt** of the full game session. Built with a custom 5×7 bitmap font renderer — each character is a hand-coded pixel array. The receipt scrolls with a smooth drift animation and includes:

- Session header with timestamp
- Every scoring event (`txScore`) with full breakdown
- Milestones (`txMilestone`)
- Running total after each event
- Per-event type label mapping (human-readable)

`txLog[]` accumulates `{type, eventType, amount, breakdown[], running}` objects throughout gameplay. The receipt is generated on demand from this log.

-----

## Layout System

### Responsive Sizing

```javascript
W = window.innerWidth
H = window.innerHeight
avW = min(W - sidepanels - 16, 380)   // max 380px wide playfield
avH = H - titleH - controlsH - gaps
CELL = floor(min(avW/10, avH/25))      // largest cell that fits both axes
CELL = max(12, CELL)                   // minimum 12px floor
```

Canvas dimensions: `gc.width = CELL×10`, `gc.height = CELL×25`

Ticker height: measured live from `linesBox.getBoundingClientRect().bottom` to `canvasWrap.getBoundingClientRect().bottom`. This measurement is taken inside a `requestAnimationFrame` callback after layout settles.

### Panel Structure

```
#app (flex column, 100vh)
├── #title          — CELLTOWER wordmark, animated gradient
├── #main-area      (flex row)
│   ├── #left-panel — Score, Level, Lines, #event-ticker
│   ├── #canvas-wrap — main board canvas + game-over overlay
│   └── #right-panel — Next, High, Pause, T-Bonus, Holes
├── #piece-preview  — 4 labeled placement previews (1-4)
├── #controls       — 6 circular touch buttons
└── #bottom-bar     — AUTO toggle, speed slider, RECEIPT button
```

-----

## Control System

### Touch Controls (6 buttons)

|Button |Action                  |NES Equivalent     |
|-------|------------------------|-------------------|
|↺ (CCW)|Rotate counter-clockwise|B button           |
|◀      |Move left               |D-pad left         |
|▼      |Soft drop               |D-pad down         |
|⬇      |Hard drop               |— (modern addition)|
|▶      |Move right              |D-pad right        |
|↻ (CW) |Rotate clockwise        |A button           |

All buttons support **touch hold** with auto-repeat for move/drop. Tap detection distinguishes tap vs hold.

### Physical Control Mapping (Arcade Cabinet)

For a 5-switch Asteroids-style panel or leaf-switch pinball buttons:

```
SW1 = Rotate CW    (A button — right thumb)
SW2 = Move Left    (D-pad left)
SW3 = Soft Drop    (D-pad down)
SW4 = Move Right   (D-pad right)
SW5 = Rotate CCW   (B button — left thumb)
SW6 = Hard Drop    (optional 6th / coin door button)
```

Physical I/O should debounce at the hardware level with a **1–2ms window** — leaf switches arc on make and break. For USB HID implementation, use a dedicated microcontroller (Teensy 4.0 recommended for sub-millisecond USB polling). Map switches to keyboard keycodes (`ArrowLeft`, `ArrowRight`, `ArrowDown`, `KeyZ`/`KeyX` for rotate, `Space` for hard drop) — the game already handles `keydown`/`keyup` events.

For authentic arcade feel: **leaf switches at 100–150g actuation force** with 1–2mm travel. The digital waveform on make should show a clean rising edge with <500µs bounce — achievable with hardware RC filter (10kΩ + 100nF) or firmware debounce on the microcontroller.

-----

## Deployment

### GitHub Pages (Recommended)

1. Repo must be public
1. Upload `index.html` to repo root
1. Settings → Pages → Source: main branch / root
1. Live at `https://username.github.io/reponame/`

### Important: `DOMContentLoaded` Wrapper

The entire JS block is wrapped in `document.addEventListener('DOMContentLoaded', ...)`. This is required — `const gc = document.getElementById('gc')` must not execute before the DOM is parsed. Without this wrapper, any environment that executes scripts before full HTML parse (CodePen, certain WebView configs, `<head>` script injection) will crash on `gc.getContext is not a function`.

### iOS WebView / WKWebView (macOS/iOS App)

```swift
// In your WKWebViewConfiguration:
config.preferences.javaScriptEnabled = true
config.mediaTypesRequiringUserActionForPlayback = []  // allow audio autoplay
webView.scrollView.isScrollEnabled = false
webView.isUserInteractionEnabled = true

// Load:
let url = Bundle.main.url(forResource: "index", withExtension: "html")!
webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
```

Web Audio requires a user gesture to start on iOS. The game handles this — the first button tap calls `getAC()` which creates and resumes the `AudioContext`. No additional configuration needed.

### macOS Desktop (Electron or WKWebView App)

For a full desktop build, wrap in an Electron shell or a native macOS app with `WKWebView`. The canvas scales to any window size via the responsive layout system. For a fixed-size arcade cabinet display (e.g. 1080×1920 portrait), set the window to that exact size and the CELL computation will maximize to fill it.

-----

## Re-Implementation Guide

To re-implement CELLTOWER in a native environment (Swift/SpriteKit, Unity, Godot, etc.):

### Core Loop

```
spawn piece → start gravity timer → 
  on input: move/rotate → 
  on gravity tick: move down 1 → 
  on collision: lock → 
  check line clears → 
  update scoring → 
  check towers → 
  update ticker → 
  spawn next piece
```

### Minimum Viable Port

1. **Board:** `COLS×ROWS` boolean grid
1. **Pieces:** NRS rotation tables (7 pieces × 4 rotations × 4 coordinates)
1. **Gravity:** timer-based, speed from `NES_SP[]` array indexed by level
1. **Hole detection:** flood-fill from top, count covered empty cells
1. **Scoring:** `piecePot` + `tetrisPot` dual-pot system
1. **Audio:** any synthesizer supporting frequency + envelope (ADSR); target frequencies are exact
1. **Ticker:** ring buffer, drain queue, bottom-pinned render

### What Makes It Feel Right

- **Lock delay:** piece does not lock instantly on ground contact — there is a brief window (same as NES: ~16 frames at 60fps) to slide or rotate
- **Spawn timing:** next piece appears at row 0-1, one frame after lock animation completes
- **Hard drop:** instant — no animation, no intermediate frames
- **Line clear:** brief flash/explosion animation before rows collapse (~400ms), during which input is frozen
- **Gravity sync:** gravity timer resets on any successful horizontal move or rotation (allows infinite stalling — intentional, NES-authentic)

-----

## Extension Points

The codebase is structured for extension. Key hooks:

|Hook                              |Location      |Purpose                       |
|----------------------------------|--------------|------------------------------|
|`txScore(type, amount, breakdown)`|scoring events|feeds receipt log             |
|`txMilestone(label)`              |game events   |non-scoring receipt entries   |
|`tickerPush([line1, line2...])`   |anywhere      |push to scrolling log         |
|`checkTowers()`                   |post-lock     |board shape commentary        |
|`updateTBDisplay()`               |post-scoring  |sync T-Bonus panel            |
|`autoChooseBest()`                |AI            |override with custom heuristic|

### Platform Vision

CELLTOWER is **one title** on a larger platform. The platform infrastructure includes:

- Shared scoring/leaderboard backend
- Physical cabinet I/O layer (USB HID microcontroller)
- Multiplayer session management
- Tournament bracket integration (California skill-game law compliant)
- AI demonstration mode for player onboarding
- Per-session receipt (provably fair audit trail)

Each title on the platform inherits: audio engine, event ticker, receipt system, AI framework, and physical control mapping. The game logic (board, pieces, scoring) is the only title-specific layer.

-----

## Known Issues & Technical Debt

- **CodePen incompatible:** CodePen’s iframe executes JS before HTML parse regardless of settings. Use GitHub Pages or any direct HTML host instead.
- **iOS audio autoplay:** Web Audio context requires user gesture. First button tap initializes. No workaround needed — by design.
- **Ticker height on orientation change:** `getBoundingClientRect()` is called in `layout()` via rAF. On rapid orientation change there can be a 1-frame flicker. Acceptable.
- **Tower detection sensitivity:** `rawCount/3` threshold may be too aggressive on narrow boards. Consider making `TOWER_PROMINENCE_THRESHOLD` (currently hardcoded 3 rows above mean) configurable.
- **Permanent hole detection** is computationally expensive on deep boards. Currently runs on every piece land. Could be debounced to every 3rd piece on slow devices.

-----

## File Manifest

```
index.html          — entire game, self-contained (~3,600 lines)
README.md           — this file
```

That’s it. No build artifacts, no node_modules, no config files.

-----

*Built in conversation with Claude (Anthropic) — an instance of what vibe-coded, AI-assisted game development looks like in 2025. The scoring system, audio synthesis, hole detection, tower commentary, and event ticker were all designed and implemented iteratively through natural language specification. The code is clean enough to hand off, extend, and productize.*