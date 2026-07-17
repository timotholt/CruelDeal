# Font Manager + GameText V3 Architecture Spec

Status: DRAFT — awaiting approval
Date: 2026-07-17

## Problem

GameTextV2 measures text with a hidden off-DOM clone appended to `document.body`,
then applies corrective reads against the live element. This creates two sources
of geometric truth that can silently disagree — the font-loading bug that broke
55 audit cases was one instance of that class, not a one-off. Separately, fonts
load with no readiness gate (`@fontsource` CSS imports plus a stray Google Fonts
CDN link with `display=swap`), so any text component can render before its font
is usable and must react to late font arrival with re-measure churn.

## Goals

1. **Fonts are startup assets, not runtime events.** Nothing that renders game
   text mounts before its fonts are loaded. No component ever re-measures
   because a font arrived late.
2. **One source of geometric truth.** The element that is measured is the
   element that is painted.
3. **No unscoped relayout.** Fitting text never invalidates page layout.
   All layout reads/writes are scoped by CSS containment to the fixed-size
   GameText box.
4. **Pixel-perfect glyphs.** Final paint uses native rasterization at the
   fitted size (real `font-size`), not a scaled texture. Transform is used
   only as an opt-in fast path for animation.
5. Preserve the GameTextV2 public API and keep the existing conformance audit
   green (184/184) throughout.

## Non-goals

- Changing the visual design of any text.
- Supporting runtime-downloaded fonts from third-party origins. All fonts ship
  in the bundle.
- SSR. This is a client-rendered Vite app.

## Part 1 — Font Manager

New module: `services/fontManager.ts` (single file).

### Registry

The registry is the only place fonts are declared. Typography configs consume
it; nothing else declares font families.

```ts
export const FONT_REGISTRY = {
  'IBM Plex Sans Condensed': { weights: [400, 600, 700] },
  'Barlow Condensed':        { weights: [400, 600, 700] },
  'JetBrains Mono':          { weights: [400, 700] },
} as const;

export type GameFontFamily = keyof typeof FONT_REGISTRY;
```

The `@fontsource` CSS imports currently in `index.tsx` move into
`fontManager.ts` so the registry and the `@font-face` declarations live and
change together. A registry entry without a matching import (or vice versa) is
a code-review-visible diff in one file.

### Loading gate

```ts
export async function loadGameFonts(): Promise<void>
```

- Iterates the registry, calls `document.fonts.load('<weight> 16px "<family>"')`
  for every family × weight, awaits all.
- Idempotent (memoized promise). Resolves immediately on subsequent calls.
- Called once at boot, before the React root mounts game UI — the loading
  screen (or a minimal splash) is the only thing that may render before it
  resolves.

### Dev assertion

```ts
export function assertFontReady(family: string, weight: number): void
```

- Dev-mode only. Throws if `document.fonts.check()` fails or the family is not
  in the registry. GameText V3 calls it on mount. A missing/misdeclared font is
  an instant loud error pointing at the registry, never silently-wrong metrics.

### Cleanup

- Remove the Google Fonts `<link>` and preconnects from `index.html`
  (lines 10–12). IBM Plex Sans (non-condensed) from the CDN is either unused or
  gets a registered bundled replacement — verify usage before deletion.
- Remove `fontsReadyPromise` / `document.fonts.ready` cache-clearing from
  GameText (V2 lines 51–64 equivalent). With the gate, late fonts cannot
  happen; the reactive path is deleted, not kept as a fallback.

## Part 2 — GameText V3

Same public API as V2 (props, modes, alignment, typography config, lang/dir,
optical metrics). Internals replaced.

### Structure

```
container (fixed rect from parent; contain: strict; display: grid,
│          justify-items/align-items from hAlign/vAlign props)
└── text element (the ONE element: measured AND painted)
```

No hidden clone. No `document.body` appends. No explicit `left/top` coordinate
math — CSS grid alignment positions the fitted element.

### Fitting pipeline (all inside `useLayoutEffect`, i.e. pre-paint)

```
commit text at base font-size (container is contain: strict → layout
  of this subtree cannot invalidate the page)
→ measure the live text element (scoped reflow, microseconds)
→ compute scale for the active mode (see strategies below)
→ apply fitted size as real font-size (quantized; native glyph raster)
→ browser paints once, fitted — no visible unfitted frame
```

Layout cost: two scoped micro-layouts of a leaf subtree at mount, zero page
relayout, zero further layouts unless text/container/config change. Because
fonts are gated at boot, the first measurement is always final — no
re-measure path exists in the component.

### Fitting strategies (internal dispatch, shared measurement plumbing)

- **single-line** — measure natural width/height at base size; scale =
  min(maxScale, containerW/textW, containerH/relevantVerticalBox), clamped to
  minScale. Optical vertical metric (cap/ink/line-box) applies here only.
- **fixed-line** — same, per explicit line structure.
- **paragraph** — wrap at container width, binary-search font-size between
  min and max scale until block height fits. (Iterations are scoped
  micro-layouts; cap iteration count, ~7 suffices.)

### Overflow / clamping semantics

Unchanged from V2: below minScale, behavior follows the existing prop contract
(clip/ellipsis per mode). The audit matrix is the authority.

### Transform fast path (opt-in, animation only)

For animated scale (card zoom, pulse), a `transform: scale()` may be layered on
top of the fitted state by the animation system. Accepted trade-off: transform
may soften glyphs mid-animation; rest state always returns to native raster.
GameText V3 itself never uses transform for static fitting.

### Caching

Per-instance memo keyed by (text, typography config, container size, lang,
dir). No global measurement cache: measurements come from the live element, and
font state is invariant after boot so keys never need a font-generation
component. Delete the module-level `measurementCache`.

## Migration plan

1. Land `fontManager.ts` + boot gate + `index.html` cleanup. V2 untouched.
   Verify: app boots, no CDN font requests in network panel, `document.fonts`
   shows all registry faces loaded before first game UI paint.
2. Build `GameTextV3.tsx` alongside V2. Point the existing conformance audit at
   V3 (same prop-level assertions). Gate: 184/184 green.
3. Add relayout guard to the audit: instrument with a PerformanceObserver /
   layout-shift check asserting no layout invalidation escapes the container
   during fit.
4. Flip call sites from V2 to V3 (mechanical — API identical). Delete V2 after
   one full playtest pass.

## Acceptance criteria

- 184/184 audit green on V3.
- Zero `document.fonts.ready` listeners or font re-measure code paths in V3.
- Zero appends to `document.body`; zero measurement of any element that is not
  the painted element.
- No visible unfitted frame (verified by pre-paint fit in layout effect).
- No page-level relayout attributable to GameText (containment verified).
- Static text painted via real `font-size`, never via transform.
