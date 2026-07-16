# Surface CSS Extraction — span layers → 3-element allocation

Status: superseded for new implementation on 2026-07-15
Authority: `docs/semantic-ui-authoring-compiler-spec.md`

> Historical CSS inventory only. Do not implement the fixed three-element
> allocation described below. The semantic compiler allocates each appearance
> graph to target-specific host CSS, pseudo-elements, or justified helpers.

Date: 2026-06-09
Source of truth: `src/styles/ui-material-lab.css` lines 916–1584 (the working span renderer).

## What each span/effect actually emits (extracted)

| Effect (slider group) | Current span | CSS it boils down to | Blend / special |
|---|---|---|---|
| Shape (rect/bevel) | root `.cd-surface` | `border-radius` (+ `corner-shape` or `clip-path: polygon` fallback) | clips all layers (`overflow:hidden`) |
| Base color | `__material` | `background: var(--material-base-color)` (flat fill) | normal |
| Texture | `__texture` | `background-image: var(--texture-image)`, `background-size: var(--texture-scale)`, `opacity: var(--texture-strength)` | normal + per-layer opacity |
| Tint (recolor) | `__tint` | `background: rgb(var(--tint-rgb)/var(--tint-alpha))` | `mix-blend-mode: color` (white tint: `screen`) — THE recolor mechanism |
| Gradient | `__gradient` | 1–2 alpha linear-gradients per mode (both / top-light / bottom-dark / none) | normal |
| Glass base | `__glass` | 3 stacked translucent gradients + `backdrop-filter: blur(var(--glass-blur))` | normal + backdrop-filter |
| Glass shine | `__glass::before` | 2 gradients, highlight band via `--glass-highlight-*` | `mix-blend-mode: screen` |
| Glass sheen | `__glass::after` | 1px highlight line gradient | normal, opacity .88 |
| Glow washes | `__glow` | 8 stacked gradients (4 edge linear + 4 corner radial washes) | `mix-blend-mode: screen` |
| Emission | `__emission` | per-mode bg (line / center-blip / rail-and-blip = 1–2 gradients) + `opacity: var(--emission-alpha)` + 3× `drop-shadow` filter | `mix-blend-mode: screen` |
| Border | `__border` | rect: real 1px `border` per-side colors; bevel: 4 gradient strips + XOR mask. `--border-lit`: 2 inset box-shadows | normal |
| Edge highlights | `__edge` | 4 1px gradient strips + 3× `drop-shadow(var(--corner-shadow))` filter | normal + filter |
| Corner highlights | `__corners` + 4 `__corner-arc` spans | 8 gradient strips (2 per corner) + same drop-shadow filter; arcs = border-radius arcs | normal + filter |
| Edge wear | `__edge-wear` + `::before` | masked noise: XOR frame mask + `mask-image: var(--edge-wear-image)` + `contrast(2.8)` | mask (needs own element) |
| Layer brightness | base spans | `filter: brightness(var(--surface-layer-brightness))` on fill layers | per-element filter |
| States (hover/press) | root `.cd-surface` rules | pure CSS-var swaps (`--hover-*`/`--pressed-*` → live vars) + root brightness/transform | NON-structural ✓ |

## Critical reuse decision

- `surfaceFeatures.surfaceStyle(options)` already computes every var value; `surfaceClass` the
  modifier classes; the state system is var-swaps on the ROOT class. **The new renderer keeps the
  `cd-surface` root class** → inherits vars, defaults, radius/bevel, state machinery, focus/disabled
  for free. Only the span-targeting rules go unused. Zero state-system duplication.

## The 3-element allocation (with the fixed-slot trick)

Blend modes are positional per background layer (`background-blend-mode` list aligns with
`background-image` list). So the fill uses a **fixed 9-slot background stack** — inactive slots
default to `none` (vars unset) and still hold their blend position:

**child 0 `.cdm__fill`** — element background (top→bottom):
`1 glass-a | 2 glass-b | 3 glass-c | 4 grad-a | 5 grad-b | 6 tint | 7 texture-veil | 8 texture | 9 base-color`
blend list: `normal ×5, var(--mf-tint-blend, normal), normal ×3`.
`backdrop-filter: blur` on the element. `filter: brightness(layer-brightness)`.
`::before` = glass shine (screen) · `::after` = glass sheen.
- Texture opacity trick: per-layer opacity doesn't exist in bg stacks → slot 7 is a veil of the
  base color at alpha `(1 - strength)` painted OVER the texture = identical dilution math.

**child 1 `.cdm__light`** — element: border (rect: real `border`; bevel: strip+mask) + 4 edge
strips + 8 corner strips as fixed bg slots + border-lit inset shadows + the shared
`drop-shadow(var(--corner-shadow))×3` filter (edge+corners already share that exact filter today).
`::before` = 8 glow washes (screen) · `::after` = emission (screen + opacity + its drop-shadows;
fixed 2 slots: rail + blip).

**child 2** — content host (existing `cd-surface__content` classes; emboss = text-shadow on text).

## Holdouts (documented tradeoffs)

1. **Edge wear** — needs its own mask → conditionally emitted EXTRA span only when active
   (`texture != none && wear on`). Active-effects-only philosophy; most surfaces don't pay for it.
2. **Under-glass content** — deferred (per spec).
3. **Corner-arc spans** (rounded corner highlight arcs) — v1 approximates with the strip
   highlights only; arcs can join the conditional extra span later if visibly missed.
4. **Border inside the corner-glow filter**: border now lives on the same element as the
   corner/edge filter; when glow is off the filter is transparent (no-op). When on, border lines
   near corners may glow slightly (current renderer keeps border outside the filter). Verify in
   parity; likely imperceptible or an improvement.

## Emitter design consequence

The static template (`material-minimal.css`) is tiny and structural — the gradient DEFINITIONS
live in the emitter (TS) as `--mf-*` var values that reference the existing var system
(e.g. `--mf-glass-a: linear-gradient(... calc(var(--glass-alpha) * 0.16) ...)`), so live editor
slider tweaks still propagate without re-emitting.
