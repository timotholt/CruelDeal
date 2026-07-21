# Phase 7 CSS Isolation Checkpoint

Status: complete

## Delivered

- Playgame variables and box sizing now begin at `.playgame-root`, not `:root`
  or the global universal selector.
- Every generic playgame selector is contained by `@scope (.playgame-root)`.
- Body-level replay, inspector, pile, and end-match portals receive an explicit
  playgame scope root so their rendering remains governed by the same rules.
- Removed unused legacy inspector, variant-selector, hint, mobile panel, and
  `fadeIn` rules.
- Removed the duplicate `vfxHalo` keyframe definition.

## Proof

- 32 canonical play-component, presentation, and provider test files passed
  with 143 tests.
- Phase 7 architecture fences assert scope ownership, portal roots, absence of
  global `:root`/`*` playgame rules, and unique keyframes.
- Touched-scope ESLint passed.
- Production Vite build passed and retained the CSS scope.

The broad play test glob also discovers two existing city-map files that
register no Vitest suites (`camera.test.ts` and `hover-tooltip.test.ts`). They
are outside the active `/play` refactor and were not changed here.

No card-motion timing, transforms, easing, presentation choreography, or
animation implementation changed in this checkpoint.
