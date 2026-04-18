# 📱 CELLTOWER

### v0.420 — *First Playable Release*

> **“Get high at the Tower.”**
> *— THC Magazine (a wholly fictitious publication)*

-----

## 🎮 Play Now

**[▶ Launch on GitHub Pages](https://aahigh.github.io/CELLTOWER/)**

Works in Safari on iPhone. No app install. No account. Just tap and play.

-----

## What Is This?

CELLTOWER is a hardcore Tetris trainer built specifically for the iPhone — designed to teach the same high-level techniques used on the original 8-bit Nintendo Entertainment System.

This is **v0.420** — the first version that actually runs on a real phone. It’s rough around the edges, it’s opinionated, and it’s only the beginning.

-----

## Why Does This Exist?

NES Tetris is one of the deepest competitive games ever made. The problem: almost nobody knows how to play it correctly. The standard mobile Tetris games teach the wrong habits — they’re casual, forgiving, and fundamentally different from the real thing.

CELLTOWER’s narrow focus right now:

- Play on your iPhone, feel like you’re on a real NES
- Learn to **read the board**, not just react to pieces
- Practice **clean stacking** — keeping holes out of your tower
- Understand **the T-Bonus system** — why clean pieces matter
- See your mistakes in real time via the scoring display

This is piece one of a larger puzzle.

-----

## What’s In v0.420

- ✅ Full NES-accurate piece set with authentic rotation system
- ✅ NES speed curve (Level 1 through kill-screen territory)
- ✅ **Ghost piece system** — 4 look-ahead placements shown as white outlines on the playfield
- ✅ **T-BONUS tracker** — counts your clean piece streak and Tetris bonuses separately
- ✅ **HOLES counter** — live penalty tracking, real-time
- ✅ **Score event ticker** — left panel shows every scoring event as it happens (lines cleared, Tetris!, clean streak fire/ice combos)
- ✅ **AUTO mode** — watch the AI demo optimal play (scores don’t count toward high score)
- ✅ **Transaction Receipt** — tap RECEIPT to see your full scoring history printed as a thermal paper readout from the High Tower District, 777 Olive Ave, Fresno CA
- ✅ Touch controls tuned for iPhone 16
- ✅ Runs from a single `index.html` — no build step, no dependencies, no framework

-----

## How To Play

**Tap anywhere** to start. Then:

|Control                  |Action                      |
|-------------------------|----------------------------|
|Tap a ghost outline (1–4)|Place piece at that position|
|↙ ↘ arrows               |Move left / right           |
|↺ ↻ buttons              |Rotate                      |
|↓                        |Soft drop                   |
|⬇ (double tap)           |Hard drop                   |
|PAUSE                    |Pause                       |
|AUTO                     |Toggle AI demo mode         |

**The Ghost Numbers (1–4)** show the 4 best computed placements for the current piece. Number 1 is the AI’s top pick. Tap any ghost to instantly place there.

-----

## Scoring Philosophy

CELLTOWER uses a modified scoring system built around *clean play*:

- **Clean pieces** (no new holes created) build your T-BONUS multiplier
- **Tetris clears** (4 lines at once) pay out big — but only if you’ve been stacking clean
- **Holes** are tracked and penalized. A holey board kills your multiplier
- **AUTO scores** are tracked separately and never overwrite your human high score

The receipt printout at the end of each game shows every transaction — what you earned, when, and why.

-----

## The Bigger Picture

CELLTOWER is one module in a larger project being developed under the **the High Tower District** creative umbrella — an intersection of retro gaming, music production, AI tooling, and Fresno culture.

More pieces of the puzzle coming. This is just the playfield.

-----

## Tech

- Pure HTML5 Canvas — single file, zero dependencies
- All game logic, rendering, audio synthesis, and layout in one `index.html`
- Designed and built with [Claude](https://claude.ai) (Anthropic) via iterative AI-assisted development
- Hosted on GitHub Pages

-----

## Credits

**Created by Aaron Hightower**
Fresno, CA

*AI development partner: Claude Sonnet (Anthropic)*

-----

## Version History

|Version    |Notes                                                                                                                                          |
|-----------|-----------------------------------------------------------------------------------------------------------------------------------------------|
|v0.420     |First playable release on GitHub Pages. TAP TO PLAY works on iPhone Safari. Ghost outlines, T-BONUS, ticker, receipt, AUTO mode all functional.|
|v0.1–v0.419|Development builds. Canvas rendering architecture, ghost piece system, scoring engine, iOS Safari compatibility debugging.                     |

-----

*CELLTOWER is an independent project. Not affiliated with The Tetris Company or Nintendo.*