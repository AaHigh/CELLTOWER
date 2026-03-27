
# Speech Synthesis Integration for CELLTOWER

## Overview
This document describes how to integrate **speech synthesis** into CELLTOWER for real-time audio feedback. The goal is to enhance the game's training mechanics by providing spoken reinforcement for player actions, scoring events, and game summaries.

---

## Implementation Steps

### 1. Initialize Speech Synthesis
Add the following code near the top of the `<script>` section in `index.html`:

```javascript
// Initialize speech synthesis
const synth = window.speechSynthesis;

// Helper function to speak text
function speak(text, rate = 1.0, pitch = 1.0) {
  if (synth.speaking) {
    synth.cancel(); // Stop any ongoing speech
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate; // Speed (0.5 to 2.0)
  utterance.pitch = pitch; // Pitch (0.5 to 2.0)
  synth.speak(utterance);
}
```

---

### 2. Integrate Speech into Key Game Events

#### Ghost Piece Selection
Call `speak()` when a player selects a ghost piece placement:

```javascript
if (selectedGhost === 1) {
  speak("Optimal play! Ghost 1—clean stack, no holes.");
} else {
  speak(`Ghost ${selectedGhost} placed. Ghost 1 was the AI’s top pick.`);
}
```

#### Line Clears and Tetris
Call `speak()` when lines are cleared or a Tetris is achieved:

```javascript
speak(`${linesCleared} lines cleared! T-BONUS multiplier: ${tBonus}.`);
```

#### Hole Creation
Call `speak()` when a hole is created:

```javascript
speak("Uh-oh. Hole detected. Aim for cleaner stacks next time.");
```

#### Game Over (Receipt Narration)
Call `speak()` at game over to narrate the receipt:

```javascript
const receiptText = `
  Game over. Final score: ${score}.
  Lines cleared: ${lines}.
  Holes: ${holes}.
  ${holes === 0 ? "Perfect stack—no holes! New personal best?" : "Work on keeping your board clean."}
`;
speak(receiptText, 0.9, 0.9); // Slower, deeper for emphasis
```

---

### 3. Optional: Customize the Voice
To match the retro vibe of CELLTOWER, customize the voice used for speech synthesis:

```javascript
synth.onvoiceschanged = () => {
  const voices = synth.getVoices();
  const desiredVoice = voices.find(voice => voice.name.includes("Daniel")); // Example: "Daniel" on macOS
  if (desiredVoice) {
    utterance.voice = desiredVoice;
  }
};
```

---

### 4. Testing Notes
- **Browser Support:** Test in **Safari on iPhone**, where the Web Speech API is supported.
- **User Interaction:** Ensu