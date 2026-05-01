# CELLTOWER Knowledge Format Specification

# Version 0.1 — High Tower District

# Format: .ctk (CellTower Knowledge)

-----

## Overview

The `.ctk` format encodes CELLTOWER game knowledge as a sequence of placement
records. Each record captures a playfield snapshot, the current and next piece,
a prescribed move, a strategy tag, and a confidence weight.

Data flows in from CELLTOWER replay via `ct2ctk.awk`. Human experts annotate
and reweight entries directly in vi. The `expand.awk` and `collapse.awk` filters
shuttle each paragraph between hex-authoritative and ASCII-authoritative forms.

The format is valid on iSH (iPhone), busybox awk, POSIX sed, vi. No other
tools required.

-----

## Piece Index

```
[T=0] [S=1] [Z=2] [L=3] [J=4] [O=5] [I=6]
```

-----

## Playfield Encoding

The playfield is 25 rows × 10 bits = 250 bits, stored top-down.
Row 0 = skyline. Row 24 = floor.

Rows are packed into 64-bit words, 4 rows per word (40 bits used, 24 reserved).
The final word carries the remaining 5 rows (50 bits used, 14 reserved).
Leading empty rows are omitted — absence encodes zero.
A completely empty playfield requires zero words.

Six words maximum:

```
word[0]  rows  0- 3   most significant (top of stack)
word[1]  rows  4- 7
word[2]  rows  8-11
word[3]  rows 12-15
word[4]  rows 16-19
word[5]  rows 20-24   5 rows, high-order bits set signals dense word
```

Within each word, rows pack MSB-first. Within each row, columns pack
left-to-right, bit 9 = leftmost column, bit 0 = rightmost column.

-----

## File Structure

The file is a sequence of PARAGRAPHS separated by blank lines.
A paragraph is the atomic unit for vi paragraph-filter operations ( !} ).

Three paragraph types:

```
HEADER      — one per file, at top
RECORD      — one per placement, the knowledge entries
LUT         — optional 49-entry lookup table block
```

-----

## Header Paragraph

```
%ctk 0.1
%game     <string>          // game identifier or replay hash
%date     <YYYY-MM-DD>
%author   <string>
%pieces   T=0 S=1 Z=2 L=3 J=4 O=5 I=6
```

-----

## Record Paragraph

Each record is one placement decision. Fields are positional within the
paragraph. Blank line terminates the record.

### Compact (hex-authoritative) form:

```
@<seq>.<cur><nxt> <rot> <x> <y> <weight> <strat>
P <word0> <word1> <word2> <word3> <word4> <word5>
```

### Expanded (ASCII-authoritative) form:

```
@<seq>.<cur><nxt> <rot> <x> <y> <weight> <strat>
P <word0> // ..........
          // ..........
          // ..........
          // ..........
  <word1> // ..........
          // ..........
          // ..........
          // ..........
  <word2> // ..........
          // ..........
          // ..........
          // ..........
  <word3> // ..........
          // ..........
          // ..........
          // ..........
  <word4> // ..........
          // ..........
          // ..........
          // ..........
  <word5> // ..........
          // ..........
          // ..........
          // ..........
          // ..........
```

### Field definitions:

```
@<seq>      placement sequence number, 1-600
.<cur>      current piece letter  e.g. .TI  .SI  .OL
<nxt>       next piece letter
<rot>       rotation 0-3
<x>         column 0-9 (leftmost=0)
<y>         row 0-28 (skyline=0)
<weight>    1=replay-derived  2-5=human reviewed  10=expert ground truth
<strat>     strategy tag (see below)
P           playfield keyword
<wordN>     64-bit hex value, 0x prefix, omit trailing zero words
```

### Strategy tags (controlled vocabulary + free text):

```
TOWRES_SETUP    building toward 4-line clear
TOWRES          4-line clear achieved on this placement
DIG             clearing holes, recovery mode
STACK           clean stacking, no immediate threat
FLAT            maintaining flat top
SURVIVE         defensive, stack height critical
NOTE:<text>     free text annotation, appended after tag
```

### Empty playfield shorthand:

```
P -             // (empty)
```

-----

## Minimal record examples:

### Compact, sparse board (only floor region occupied):

```
@1.TI 0 4 22 1 STACK
P 0x000000003C00000000 0x00FF3C000000000000
```

### Expanded same record:

```
@1.TI 0 4 22 1 STACK
P 0x000000003C00000000 // ..........
                       // ..........
                       // ..........
                       // ....XXXX..
  0x00FF3C000000000000 // ..........
                       // XXXXXXXX..
                       // ..XXXX....
                       // ..........
                       // ..........
```

### Empty board:

```
@1.OI 0 4 24 1 STACK
P -                    // (empty)
```

### Expert annotated TOWRES setup:

```
@312.IS 2 0 18 10 TOWRES_SETUP NOTE:left-well 4-deep I incoming
P 0x000000000000000000 // ..........
                       // ..........
                       // ..........
                       // ..........
  0x000000000000000000 // ..........
                       // ..........
                       // ..........
                       // ..........
  0x01FF01FF01FF01FF   // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
  0x01FF01FF01FF01FF   // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
  0x01FF01FF01FF01FF   // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
  0x01FF01FF01FF01FF   // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
                       // .XXXXXXXXX
```

-----

## LUT Paragraph (optional)

49-entry lookup table. One line per [cur][nxt] combination.
Format: L <cur><nxt> <rot> <x> [<y>] <strat>

Y is optional. Omit when the drop path is unambiguous — the piece falls
straight down and rests at one deterministic position for the given X.
Include Y when ambiguity exists — typically slide-in geometry where a piece
can enter from the side and come to rest under an overhang at a Y position
that differs from a straight vertical drop at the same X.

Parser distinguishes Y-present vs Y-absent by field count:
5 fields after L → cur nxt rot x strat        (Y omitted)
6 fields after L → cur nxt rot x y strat      (Y explicit)

strat is always a non-numeric string, making field count unambiguous.

```
L TT 0 4 STACK                  # straight drop, Y omitted
L TS 1 0 FLAT
L TZ 1 9 FLAT
L TL 0 7 STACK
L TJ 0 0 STACK
L TO 0 4 FLAT
L TI 0 4 TOWRES_SETUP           # straight drop into left well
L IS 2 0 18 TOWRES_SETUP        # Y=18 explicit, slide-in from left under overhang
L IZ 0 0 12 DIG                 # Y=12 explicit, undercut position
L ST ...
... (49 total)
```

-----

## awk Filter Scripts

### expand.awk — hex → ASCII art comments (paragraph scope)

Reads one record paragraph from stdin.
Parses P word values, renders 10-bit rows as . and X characters.
Writes expanded form to stdout.
Invoked in vi: position cursor in paragraph, type:  !}awk -f expand.awk

### collapse.awk — ASCII art → hex (paragraph scope)

Reads one expanded record paragraph from stdin.
Parses // comment rows as ground truth.
Recomputes hex word values from ASCII art.
Writes compact form with updated hex to stdout.
Invoked in vi: position cursor in paragraph, type:  !}awk -f collapse.awk

### ct2ctk.awk — CELLTOWER replay → .ctk

Reads CELLTOWER binary replay stream.
Emits one record paragraph per placement, weight=1, strat=STACK default.
Omits leading zero words per playfield.

### ctk2ct.awk — .ctk → CELLTOWER replay

Reads .ctk file.
Reconstructs placement sequence for playback or verification.

-----

## vi Workflow

```
# Open knowledge file
vi game.ctk

# Expand paragraph under cursor to ASCII art (hex is ground truth)
!}awk -f expand.awk

# Edit ASCII art rows directly with . and X characters

# Collapse back to hex (ASCII art becomes ground truth)
!}awk -f collapse.awk

# Strip all comments from entire file (lean form)
:%s/ \/\/.*//g

# Reweight a record manually
# find the @ line, change weight field from 1 to 10
```

-----

## Design Principles

1. Absence encodes zero. Omit leading empty words.
1. Position is truth. Row order is paragraph-positional, never labeled.
1. ASCII art is editable ground truth. Hex is compressed shadow.
1. Weight is authority. Machine emits 1. Human expert writes 10.
1. Paragraphs are atomic. Cut, paste, reorder freely in vi.
1. Four tools, all awk. Runs on iSH.

-----

## File Extension

```
.ctk        CellTower Knowledge
.ctk.lean   stripped, hex-only form (generated, not hand-edited)
```