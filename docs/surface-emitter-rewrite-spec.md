# Surface Renderer + Emitter Rewrite Spec

Status: active (design locked, implementation pending)
Date: 2026-06-09
Related: `docs/first-class-surface-architecture-spec.md`, `docs/feed-model-unification-refactor-spec.md`

## Scope (important)

Do NOT redesign what conceptually works. The concept is right and stays: the contract split
(theme / style / layout / cms + editor-schema), the `MaterialRecipe`, the color source
(**tokens + color picker — already in the code**), the editor. **Rewrite only the INTERNALS** that
don't scale: the surface render structure (10+ spans -> 3 elements) and the emitter (recipe ->
minimal CSS). Same concept, better internals.

## One universal surface (confirmed)

Every node is the SAME component — `MaterialNodeRenderer` / the universal `Surface`. Toolbar,
navbar, mission-briefing, buttons differ only by parameters/presets. Every surface can take
text / rich text (sending content is a separate concern). Investigated the candidates for
"different":
- **Backdrop / far background:** it's a `MaterialRecipe` too (`mainMaterialPreview.tsx:68`) plus
  background-image fit params (`fit:cover/tile`, `dim`, `blur`, `scale`). Same surface + a
  "background-media-with-fit" layer — the same need as the feed card `backgroundImage`. Fold in as
  a surface capability, NOT a new type.
- **Carousel:** the only genuine exception, and it's BEHAVIOR (sliding/state), not render.

So: one render component for everything; behavior is the only escape hatch.

## Behavior (the 1%)

Keep the node universal; add an optional `behavior: { id, config }`. The renderer resolves `id`
against a **behavior registry** to a wrapper SolidJS component (Carousel, etc.) that owns stateful
logic and renders the surface subtree inside. 99% of nodes have no behavior. No "bigger JSON", no
special node type — navbar is just a node tree (`role: selectable` children); carousel is a normal
node + a small behavior config.

## Editor schema = derived from the component

Since every surface is one type, there is ONE schema, published by the Surface component (a runtime
descriptor of its parameters). The editor renders controls from it, the validator bounds-checks
from it, the emitter reads the output var from it — one declaration, three systems in sync.

## Goal

Replace the ~10-span `cd-surface` renderer with **3 DOM elements** that produce the same look
via `::before`/`::after` + stacked backgrounds/shadows, and an **emitter that generates the
minimal CSS from a `MaterialRecipe`** (no live-DOM scraping). North star: *if you hand-wrote the
CSS for this slider combo, this is what it would be.*

Current cost (per card surface, from the live export): ~59 nodes / ~744 styles / ~584 vars.
Target: a handful of rules per surface, ~3 nodes.

Keep (stable contract — the rewrite consumes them): the `MaterialRecipe` schema + validation, the
`material-node` layout system, tokens/skins. Rewrite only the surface **render structure** + the
**emitter**.

## The mechanic

Each DOM element gives **3 paint surfaces**: its own `background`, `::before`, `::after`. Each
surface can stack **multiple `background-image`s** (`background-blend-mode`) and **multiple
`box-shadow`s**. Effects collapse heavily onto few surfaces. Hard rules:
- An effect that **blends over** what's below, or needs **`backdrop-filter`**, must be its own
  paint surface, painted **above** the layers it blends.
- Glass needs **both** its pseudos (shine + sheen), so it cannot share an element with the frame
  lighting if those are to be independently tunable. -> this is what forces 3 layers.

## Render order (paint bottom -> top)

`shape(clip) -> base(material+color) -> texture -> tint -> gradient -> glass -> glow -> emission
-> border -> edge-wear -> corners -> content`

(Confirmed from both `SurfaceLayers` and the editor section order, which the author reordered to
match render order.)

## The 3-layer split (LOCKED — split at the glass boundary, independent tuning)

**Root element**: `clip-path` (shape/bevel) — clips all children. One clip replaces the 4
corner-arc spans. The node frame itself.

- **Child 0 — Fill + Glass** (z bottom)
  - element `background`: base-color (material) + texture + tint + gradient as **one stacked
    `background-image` set** with per-layer `background-blend-mode`. Tint = the recolor
    ("gray -> yellow/white") via a `color`-blend background layer.
  - `backdrop-filter: blur()` here (glass).
  - `::before` = glass shine · `::after` = glass sheen
- **Child 1 — Frame lighting** (z mid)
  - element `background`: the 4 per-edge **border** gradients (the established edge-strip technique).
  - `::before` = **glow + emission** (stacked `box-shadow`, `mix-blend-mode:screen`).
  - `::after` = **edge-wear** (masked gradient) + **corner highlights** (radial gradients).
- **Child 2 — Content** (z top)
  - element = text/icon · `::before`/`::after` = emboss/underline as needed.

Rationale: glass + fill belong together because glass owns its two pseudos; frame lighting is a
second independent blend stack; content on top. Each layer has one clear job, no pseudo contention.

## Recolor model

Author thinks of it as "recolor the gray base to yellow/white/etc." Implement tint as a background
layer with a blend mode (current CSS uses `mix-blend-mode: color` / `background-blend-mode`).
Confirm exact mode during per-effect extraction; pick the leanest that matches the look.

## States (rest / hover / press / active / selected)

Change **color + edges + corners only — NON-structural** (no DOM/geometry change). Emit as CSS
variants (state class or `:hover`/`:active`) that swap color/edge/corner vars. Same 3-element DOM
for every state.

## Under-glass content

Deferred. v1: content is **over** glass (child-2 on top). Under-glass (content frosted by the
blur) becomes a special case — a real content layer placed below child-0's glass — handled once
the over-glass path renders correctly.

## The emitter's job

`MaterialRecipe (sliders)` -> CSS for the 3 elements + their pseudos, emitting **only active
effects** (a slider off emits nothing for that layer). Deterministic recipe->CSS generation, not
DOM scraping. Output is the static CSS a hand author would write for that combo.

## Implementation plan

1. **Per-effect CSS extraction (next task):** read the current working `cd-surface` CSS
   (`src/styles/ui-material-lab.css`, ~75 rules) and write down, for each slider, the exact
   minimal CSS it produces (background / box-shadow / blend / clip-path / backdrop-filter /
   mask). This is the source of truth — the rewrite re-targets it from spans onto the 3-element
   structure. Note the holdouts (effects that don't collapse cleanly).
2. **Static templates:** for each layer, the CSS template with `var()` slots the emitter fills.
3. **Emitter:** `MaterialRecipe -> { child0, child1, child2 }` CSS, active-effects-only.
4. **Renderer:** a 3-element `Surface` component consuming the emitted CSS, replacing the span
   stack. Keep the same outer class contract where consumers depend on it.
5. **Parity:** verify per-slider against the current span renderer (visual + the editor's live
   preview), one effect at a time.

## Risks

- A few effects may not collapse cleanly onto 3 elements (the holdouts from step 1). Identify
  early; they may need a 4th surface or a minor fidelity tradeoff.
- `backdrop-filter` + `clip-path` interaction (does the blur respect the bevel clip?) — verify.
- `mix-blend-mode` over `backdrop-filter` results can differ across browsers — verify in-app.
