# Main Material Refactor Plan

## Goal

Make the main material editor predictable by giving each editable UI part one paint owner: the shared material system. Layout CSS should position and size components, while `MaterialPanel` and `MaterialButton` own surface color, texture, glass, border, glow, and gradient.

## Problems Found

- `raw` is an opaque ivory material, so there is no true transparent/off material mode.
- Backdrop is an image stack, not a UI material surface; wrapping the whole phone in `MaterialPanel` makes its material/glass controls visually ambiguous.
- Top bar, nav surface, toolbar buttons, and currency buttons still have hardcoded backgrounds, borders, shadows, or texture images outside the material recipe.
- The feed cards were already moved mostly to material ownership, but tags still have local badge styling by design.
- The editor preview has separate recipes for top bar, profile, wallet, toolbar, and nav, but some child controls do not yet consume those recipes directly.

## Implementation

1. Add a `none` material mode to the shared material primitives and recipe editor.
2. Make `none` render transparent material/texture/gradient defaults.
3. Keep backdrop as the old image stack: base image, optional second layer, and image transform/tone controls.
4. Replace hand-painted currency, toolbar, and nav buttons in the main preview with `MaterialButton`.
5. Remove hardcoded material paint from editable wrappers in `main-material-preview.css`.
6. Keep layout-only CSS for dimensions, grids, spacing, typography, and icon shapes.
7. Build the app to catch type and CSS regressions.

## Expected Result

Turning off texture, border, gradient, glass, or choosing `none` should visibly remove that layer on actual UI components. Editing top bar, profile, wallet, feed, toolbar, and nav should no longer fight hidden CSS paint from the mockup; backdrop should remain a direct image-stack editor.
