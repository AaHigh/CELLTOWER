# CELLTOWER: On Trusting Trust
## A Preemptive Hacker's Manifesto

*Aaron High / the High Tower District — April 2026*
*With analytical assist from Claude (Anthropic)*

---

## The Ken Thompson Problem

In 1984, Ken Thompson delivered his Turing Award lecture: *"Reflections on Trusting Trust."*
The argument was simple and devastating. He had modified the Unix C compiler to insert a
backdoor into the `login` program — but the backdoor was in the compiler, not in the source
code. Auditing the source would never find it. The only way to know the compiler was clean
was to trust the compiler that compiled the compiler.

Trust has to bottom out somewhere. The question is where you choose to bottom it out.

CELLTOWER has the same problem, and we found it by accident while trying to break our own format.

---

## The Discovery

The CELLTOWER v3.0 stream format is designed around a cryptographic hash chain. Every piece
placement commits the complete board state into SHA-256. The terminal hash signs the entire
game. A valid stream cannot be forged without either:

- Playing the game (physically waiting real time between moves), or
- Implementing the exact board physics from source and waiting real time anyway

We tested this by having Claude attempt a full offline forge — correct PRNG, correct piece
sequence, greedy AI placement, gaussian fake timing. The verifier rejected it immediately.

**The failure point:** board state commitment. The forge used coordinate-list piece shapes.
The game uses bitmap format. One representation difference → every board state word wrong →
hash chain diverges at piece 1 → terminal hash completely unrecognizable.

This is a property of the design: the hash chain is an unforgiving witness to every detail
of the physics engine. You cannot fake the board state without implementing the physics
exactly as the game does.

But then we noticed something.

---

## The Thompson Moment

The v3.0 parser has a legacy compatibility path. Streams with a 5-character seed header
(v2.0 format, 4 chars per placement) still parse for visual replay. They just don't verify
under v3.0 cryptography.

The built-in sample stream — a real 1-million-point game — is v2.0 format. It still plays
on GitHub Pages. The v3.0 verifier accepts it for display but flags it as unverifiable.

This is exactly Thompson's observation applied to our own system:

> The v2.0 stream is the compiler that compiled the compiler.

We trust the sample stream because we trust the system that produced it. But the system that
produced it — the v2.0 game — had weaker verification. A v2.0 stream carries piece type
explicitly. A sophisticated attacker with the v2.0 source could have constructed a plausible
stream with cherry-picked pieces and fabricated timing, passed it through the weaker v2.0
hash chain, and embedded it as the "authentic" sample.

We cannot fully audit that sample stream. We can only trust the environment that produced it.

**This is not a flaw we introduced. This is the irreducible structure of the problem.**
Any system that maintains backward compatibility inherits the trust assumptions of its
predecessors. The backward-compatible v2.0 reader is our Thompson compiler.

---

## The Preemptive Response

We are not waiting for attackers to find these paths. We are documenting them first.

### What the format prevents

| Attack vector | Defense | Strength |
|--------------|---------|----------|
| Forge stream with impossible piece sequence | PRNG bound to seed — verifier replays identically | Hard |
| Forge stream with impossible board state | Physics replayed in verifier, board committed per-piece | Hard |
| Submit another player's stream | H_0 = SHA-256(seed + player_name) — identity in chain | Hard |
| Inject sub-150ms timing | Timing table has 60 high-resolution slots in 0-150ms zone | Medium |
| Inject fake Gaussian timing | HPS metric detects wrong distribution shape | Medium |
| Full offline forge waiting real time | Nothing cryptographic — you just played the game | By design |
| v2.0 sample stream authenticity | Trust the original game session environment | Weak |

### What the format honestly cannot prevent

A sufficiently motivated attacker with full source access who:
1. Implements the exact board physics (NRS bitmaps, pivot corrections, board word encoding)
2. Replays the correct PRNG piece sequence from seed
3. Chooses legal placements via their own AI
4. Waits actual milliseconds between hash chain advances

...produces a stream that passes v3.0 verification. This person has, in effect, written
their own implementation of CELLTOWER and played a game on it. The stream is valid because
the game was played — just not in the browser, and not with human fingers.

**This is the Thompson boundary.** The hash chain proves the physics. It cannot prove the
human. That proof lives outside mathematics, in the tournament environment: proctoring,
admission tickets, entry windows, physical presence.

The `admission_id` field (specified in `platform.md`, not yet implemented for casual play)
is the mechanism. A tournament-issued admission ticket, bound into H_0 before play begins,
means a stream produced outside the tournament window fails verification even if the physics
are perfect. The ticket is the trusted third party — the one piece of the chain that lives
in the real world.

---

## The Backward Compatibility Trade

Why keep the v2.0 reader at all?

Because removing it would orphan every replay ever produced under v2.0. The sample stream —
a legitimate million-point game — would become unplayable. The human who played that game
would lose their record.

This is the exact trade Thompson described. You can audit the current source all you want.
The trust assumption that matters is the one that came before — the compiler that compiled
the compiler, the format that begat the format.

We made the trade consciously:

- v2.0 streams play for display but are flagged as unverifiable
- v3.0 streams carry the full cryptographic proof
- The boundary is visible in the header: 5-char seed = v2.0, 6-char seed = v3.0
- No v2.0 stream can be submitted as a v3.0 verified score

The backward compatibility is a display feature, not a trust feature. The trust layer is
hard-gated on format version.

---

## Why We Document This

Security through obscurity is not security. Every path described in this document is
discoverable by anyone who reads the source — which is public.

What obscurity does is raise the cost of attack without raising the cost of defense.
But the cost equation only favors defense if the defenders understand the attack surface
better than the attackers.

By mapping the attack surface ourselves — by asking Claude to forge a stream, watching it
fail, understanding exactly why, and then identifying what a successful forge would require —
we know more about this system's limits than any attacker who discovers it fresh.

The hash chain is not magic. It is a commitment scheme that proves physics and identity.
It cannot prove presence. It cannot prove humanity. It cannot prove the compiler that
compiled the compiler was honest.

What it can do is make cheating expensive enough that the reward isn't worth it —
especially when the tournament architecture adds the real-world anchors the math cannot provide.

That's all any security system can honestly claim.

---

## Credit and Lineage

- **Ken Thompson** (1984): Established that trust must bottom out somewhere, and that
  the compiler is always a candidate for where it doesn't.

- **Aaron High** (2026): Designed the CELLTOWER stream format to make forgery expensive,
  documented its limits preemptively, and had the instinct to test his own security by
  asking an AI to break it before an attacker could.

- **Claude (Anthropic)**: Attempted the forge, failed at the board state commitment layer,
  identified the exact failure point, and connected the backward-compatibility observation
  to Thompson's original argument.

The forge failed. The analysis succeeded. That's the correct outcome.

*"The best you can do to fake the process identifies the hole."*
— Aaron High, April 2026

---

*This document lives in the CELLTOWER repository as a permanent record of the security
analysis conducted during v3.0 development. It is not a vulnerability disclosure —
it is a design transparency statement. The holes described here are known, bounded,
and addressed at the appropriate layer of the system.*
