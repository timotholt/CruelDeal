# Phase 7 CSS Responsibility Split

Status: complete

## Delivered

`src/styles/playgame.css` is now a seven-line ownership manifest. Its modules
are:

- `tokens-and-sizing.css`
- `board-layout.css`
- `overlays-and-replay.css`
- `cards.css`
- `hud-and-controls.css`
- `vfx.css`
- `responsive.css`

Every selector-bearing module retains the Phase 7 `.playgame-root` scope.
The source order preserves the board, card, HUD/control, VFX, and responsive
cascade. Overlay selectors are component-specific and do not override those
families.

## Proof

- Phase 7 architecture fences require every owned module and import.
- Existing presentation architecture fences read the composed stylesheet and
  continue to enforce exact board, card, header, footer, hand, and location
  geometry declarations.
- 32 canonical play-component, presentation, and provider test files passed
  with 145 tests.
- Touched-scope ESLint passed.
- Production Vite build passed.

This was a mechanical ownership split. No CSS declaration values, animation
durations, transforms, easing curves, or presentation code changed.
