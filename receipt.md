# CELLTOWER Score Receipt System

## Overview

CELLTOWER implements a self-contained, cryptographically verifiable score receipt system. No server is required. No external authority is trusted. The game itself generates an unforgeable proof of every game that occurs, visible in every frame.

A screenshot is a receipt.

-----

## Design Philosophy

Most games handle score verification one of three ways:

1. **Trust the client** — easily faked
1. **Trust a server** — requires infrastructure, accounts, connectivity
1. **Do nothing** — no verification at all

CELLTOWER uses a fourth path: **the game generates its own proof**. Every piece placement updates a live cryptographic hash displayed on the canvas. At game end, the final hash is the authoritative receipt. No internet connection required. No account required. No trust required.

This design was conceived by Aaron Hightower, whose prior work includes the first high score verification system for San Francisco Rush 2049 (Atari, coin-op, 1999) — a SHA-based 5-character password system designed and implemented for networked arcade cabinets.

-----

## The Data Structure

A single binary data structure accumulates all game state. It contains:

- **RNG seed** — enables complete deterministic replay
- **Piece input log** — rotation state (2 bits) + column position (4 bits) per piece = 6 bits per placement
- **Running score / lines / level** — redundant cross-check data
- **Piece count** — establishes the frame of the game

This structure is updated with every piece placement.

-----

## The Hash

At every piece placement, the entire data structure is processed through SHA to produce a 32-bit digest.

That digest is encoded as a **5-character base-40 code** and displayed live on the game canvas at all times.

### Base-40 Character Set

Characters are selected for **visual unambiguity** — no characters that can be confused with each other under degraded conditions (no 0/O, no 1/I/l, etc.). This character set was originally designed for the Rush 2049 arcade system in 1999.

-----

## Snapshot Hash / Terminal State

The hash is a **snapshot hash** — it reflects cumulative game state at each piece placement and updates continuously.

The **final hash** is produced when the board rejects the next piece — the natural terminal state defined by the game itself. This is the authoritative score receipt.

This means:

- Any mid-game screenshot is a **partial proof of work**
- The final screenshot is the **complete verifiable record**
- You cannot fake a mid-game screenshot without reconstructing the entire valid game history that produces the correct hash at that exact piece count

-----

## Screenshot Submission

The expected submission workflow:

1. Play a game
1. If the score is notable, the game prompts the player to submit
1. Player screenshots the final game state (the 5-character code is visible on screen)
1. Screenshot is submitted to `score.html`

The visible code on screen ties to everything that happened in that game. Anyone with the game can verify independently by reconstructing the same data structure and hashing it.

**The image is the receipt.**

-----

## Replay

Because the data structure contains the RNG seed and complete input log, any verified game can be replayed in full. Replacing the live RNG with a seeded deterministic path produces an identical game from the same inputs.

This means a very small amount of data encodes an entire high-level game — the receipt is compact by design.

-----

## Identity

Player name is **display-only**. It is not part of the hash or the data structure. A player can change their name at any time and all of their scores update accordingly. This is a deliberate design decision: a person deserves the right to change their name before or after claiming a score.

The score is verified by the game data. Identity is a separate concern.

-----

## Collaboration

If you want to contribute to CELLTOWER or build on this receipt system, the key things to understand are:

- The data structure definition is the foundation — everything else derives from it
- The base-40 character set is fixed — do not modify it or existing receipts will not verify
- The RNG seed path must remain deterministic and stable — any change breaks replay
- `score.html` is a standalone file — it does not depend on the game running

-----

## Author

Aaron Hightower  
Hightower District — Fresno, CA  
Former: Silicon Graphics, Nintendo (Pilotwings 64), Naughty Dog (Jak 3), Atari (San Francisco Rush 2049)  
[aahigh.github.io](https://aahigh.github.io)