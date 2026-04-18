# Galactic Snap - Technical Debt & Roadmap

## 🐞 Known Bugs (High Priority)

### 1. Persistent Font Snap on App Load
- **Symptom:** UI elements (especially the Command Bar) appear in a system font (Arial/sans-serif) for ~100-300ms before snapping to the correct IBM Plex Sans metrics, causing a visible layout jitter.
- **Attempted Fixes:**
    - High-priority `<link rel="preload">` in `index.html`.
    - `font-display: block` in CSS to force invisibility until loaded.
    - Explicit `document.fonts.load()` checks in `assetLoader.ts`.
    - 250ms "Settling Buffer" after browser signals readiness.
- **Current Status:** Tabled. Needs investigation into environment-specific rendering pipelines or potential Base64 font-face embedding to eliminate network latency entirely.

## 🛠 UI/UX Refinements

### 1. Command Bar Interaction Polish
- Monitor "Sticky Hover" behavior on physical mobile devices vs. browser emulators.
- Ensure the `@media (hover: hover)` logic correctly identifies high-end tablets with trackpads.

### 2. Inspector Overlay Transitions
- Fine-tune the 150ms interaction lockout in `InspectorOverlay.tsx` to ensure it feels responsive but prevents accidental "double-tap" closures.

## 🚀 Future Roadmap
- [ ] **Deck Builder Search:** Add advanced filters for Rarity and Power ranges.
- [ ] **Matchmaking Simulation:** Implement a deeper "Searching for Opponent" animation with fake player profiles.
- [ ] **Audio Mixdown:** Implement a global volume slider in a settings menu.
- [ ] **Visual Effects:** Add "Gold Foil" and "Inkify" rarity effects to cards.
