# CELLTOWER Terms of Service
## Platform Identity, Direct Messaging, and Long-Term Sustainability

### Published by the High Tower District · Fresno, California
### Document authored with AI assistance (Claude, Anthropic)
### Effective date: to be determined upon platform launch

---

## 1. What CELLTOWER Is

CELLTOWER is a competitive skill-based Tetris trainer. It produces cryptographically verified game records that prove a score was achieved through legitimate human play. Players compete for positions on per-name leaderboards. No element of the game outcome is determined by the platform — only by the player's skill.

CELLTOWER is not a casino. It is not a sweepstakes. It is not a lottery. It does not offer chance-based prizes. It is, in the tradition of competitive arcade gaming, a place where the best player wins.

---

## 2. The Identity System

### 2.1 Player Names

A CELLTOWER player name is a three-character string drawn from a 92-character printable ASCII alphabet (all printable ASCII characters except comma and semicolon). Names are not unique — multiple players may choose the same three-character name. This is intentional.

A player name functions as a **routing address**, not a credential. The identity system does not authenticate who you are. It routes recognition and communication to whoever currently holds the highest verified score under that name.

### 2.2 Name Ownership Through Skill

At any given time, the "holder" of a name is the player with the highest cryptographically verified score bearing that name. There is no registration fee, no reservation system, and no bureaucratic process. You hold a name by being the best player using it.

This means name ownership is:
- **Earned**, not purchased
- **Competitive**, not permanent
- **Self-evident**, proven by the verified replay stream

If another player surpasses your score under your name, they become the holder. You are displaced. This is the entire mechanism of competitive identity on CELLTOWER.

### 2.3 The Name as a Public Identifier

The player name appears visibly on-screen during play and is embedded in the game receipt (the printable score summary). It is not embedded in the cryptographic verification stream — the stream proves the score was legitimate regardless of what name is attached to it. The name is the address on the envelope; the stream is the letter inside.

Anyone watching your screen can see your name. This is analogous to a visible card security code — it identifies you to observers without being part of the cryptographic proof.

---

## 3. The Direct Message System

### 3.1 What It Is

CELLTOWER includes a fan-to-player Direct Message (DM) system. Any person using the platform may send a text message to the current holder of any player name. Messages are delivered via SMS to a phone number verified by the holder.

This feature is designed to let the competitive community acknowledge exceptional play directly — not through an intermediary, not through a social media platform, but through the phone in the high-score holder's pocket.

### 3.2 Message Format Constraints

All direct messages are limited to the **reduced printable ASCII character set**: the same 92-character alphabet used for player names (printable ASCII, excluding comma and semicolon). This constraint exists for three reasons:

1. **Uniformity**: Every message is renderable on any display, any terminal, any device, without encoding exceptions.
2. **Safety**: The character restriction limits attack surface for injection, encoding exploits, and character spoofing.
3. **Elegance**: The same alphabet that names a player also carries their fan mail.

Message length limits will be specified at launch.

### 3.3 Phone Verification Requirement

DM delivery requires verified phone registration. If you hold a high score and wish to receive direct messages, you will be prompted:

> **VERIFY YOUR PHONE TO RECEIVE DMs TO YOUR PHONE'S TXT MESSAGING SYSTEM FROM YOUR FANS**

Verification is optional. You may hold a high score without registering a phone number. In that case, messages addressed to your name are held in queue but not delivered until verification is completed — or discarded if the queue expires.

Phone numbers are stored and used solely for SMS delivery of direct messages. They are not sold, rented, shared with third parties, or used for marketing. The only messages sent to your verified number are fan DMs addressed to your name while you hold the top score.

### 3.4 Displacement and Inbox Obliteration

When a player is displaced from the top score position under their name — that is, when another player posts a higher verified score under the same name — **all pending and undelivered direct messages associated with the displaced holder are permanently deleted**.

This is not a bug. It is a design principle: the DM inbox belongs to the current champion, not to a former one. Messages addressed to "the best ACE" were written for whoever holds that title now. When the title transfers, the messages transfer with it — or are discarded if the new holder has not verified a phone number.

Former holders are notified of their displacement (if they have a verified number on file) before their inbox is cleared. The notification includes the score that displaced them and a timestamp.

### 3.5 Current Status: Free Service

**As of this writing, the Direct Message system is free.** There is no fee to send a message to a high-score holder. There is no fee to receive messages.

This may change. See Section 5.

---

## 4. Platform Governance

### 4.1 The High Tower District

CELLTOWER is a project of **the High Tower District**, an independent creative umbrella based in Fresno, California, operating at the intersection of competitive gaming, music production, and software development.

### 4.2 Board of Directors

Financial decisions affecting platform operation, fee structures, prize distributions, and long-term direction are subject to review and approval by a Board of Directors of no fewer than three persons, appointed by the High Tower District. The Board exists to ensure that no single individual can unilaterally redirect platform funds or alter the terms under which players compete.

The composition, compensation (if any), and decision-making procedures of the Board will be published as a separate governance document prior to any financial transaction involving platform fees or prize money.

### 4.3 AI-Assisted Governance Language

The legal and governance language in this document was drafted with the assistance of Claude (Anthropic). This is disclosed because transparency is a design principle of this platform — not an afterthought. The human author reviewed, approved, and is responsible for all language herein.

---

## 5. Sustainability and Future Fees

### 5.1 Why This Section Exists

Free services that handle real money, real identities, and real competition at scale are not actually free — they are subsidized, either by the operator absorbing costs or by eventually failing. CELLTOWER is designed to survive. This section explains, plainly and without legal evasion, how fees may eventually enter the system and why.

### 5.2 What Is Not Happening

This is not a "get rich quick" clause. The High Tower District does not intend to monetize player effort for personal enrichment. The founder of CELLTOWER is a competitive game player and a working creative professional — not a finance professional seeking arbitrage opportunities in gaming regulation.

The fee structure described below, if it ever activates, exists for one reason: **infrastructure costs money, and a platform that runs out of money stops benefitting anyone**.

### 5.3 The Specific Load Problem

The DM system creates a potential load problem that does not exist in a simple leaderboard. Every time a player achieves a high score under a popular name, the platform may receive a burst of DM traffic from fans. If CELLTOWER reaches significant scale — say, tens of thousands of concurrent players, which this document imagines is possible — SMS delivery costs, server costs, and abuse prevention costs become real operational expenses.

A fee for sending direct messages, if introduced, would be:
- **Per-message**, not a subscription
- **Small** (consistent with the cost of a real SMS)
- **Transparent** (the fee and its disposition published in real time)
- **Directed to platform operating costs**, with surplus allocated to the prize pool or development fund as decided by the Board

### 5.4 What You Are Agreeing To

By using CELLTOWER's DM feature, you agree that:

1. The service is currently free.
2. The High Tower District reserves the right to introduce fees for DM sending in the future, with no less than 30 days' notice posted on the platform's primary web presence before fees take effect.
3. If fees are introduced, you retain the right to stop using the DM feature at any time.
4. No fee will ever be charged for playing the game itself, submitting scores, holding a leaderboard position, or verifying a phone number.
5. The game is free. The competition is free. Only optional communication services may eventually carry a cost.

---

## 6. Smart Contracts and Decentralized Prize Infrastructure

### 6.1 Aspiration

CELLTOWER aspires to implement smart contract-based prize distribution for tournament play. In this model, prize funds would be held in a publicly auditable escrow contract, released automatically upon submission of a verified game stream that meets tournament criteria — no human intermediary, no dispute window, no "trust us."

The verified replay stream that CELLTOWER already produces (compact, binary, SHA-256 hash-chained) is architecturally compatible with on-chain verification. The game's physics are deterministic and expressible as bytecode. The score is provable.

### 6.2 Why This Matters

A smart contract prize pool is not primarily a technology novelty. It is a trust mechanism. When a player in Fresno wins a tournament against a player in Seoul, neither needs to trust the tournament organizer. They trust the math. The contract executes. The prize transfers. Done.

This is the same philosophy as the verification system: not "trust us," but "verify it yourself."

### 6.3 Current Status

Smart contract infrastructure is a future development goal. It requires legal review specific to the jurisdictions involved, careful audit of the contract code, and a prize pool of sufficient size to justify the gas economics. It is not a current feature. It is a stated intention.

---

## 7. What This Platform Is Not

To be explicit, because clarity serves everyone:

- CELLTOWER is **not a casino**. No outcome is chance-determined by the platform.
- CELLTOWER is **not a sweepstakes**. There is no random winner selection.
- CELLTOWER is **not a pyramid scheme**. No player profits from recruiting other players.
- CELLTOWER is **not a subscription service**. No recurring charges are contemplated.
- CELLTOWER is **not a data broker**. Player information is used to operate the platform and for no other purpose.
- CELLTOWER is **not a get-rich-quick scheme**. The people most likely to make money from this platform are the best Tetris players in the world — which is, in the opinion of the High Tower District, exactly how it should work.

---

## 8. Contact and Disputes

Platform correspondence, legal inquiries, and Board of Directors contact information will be published at the platform's primary web presence prior to launch of any fee-bearing feature.

---

*Terms of Service v0.1 — Pre-launch draft*
*CELLTOWER · the High Tower District · Fresno, California*
*AI development and legal drafting partner: Claude (Anthropic)*
*This document does not constitute legal advice. Consult qualified legal counsel before relying on any statement herein for regulatory compliance purposes.*
