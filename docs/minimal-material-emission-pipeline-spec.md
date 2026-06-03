# Minimal Material Emission Pipeline Spec

Status: active
Date: 2026-06-03
Supersedes:

- `docs/layout-css-emission-minimization-spec.md`
- `docs/main-material-refactor-plan.md`
- `docs/material-node-system-refactor-spec-2026-06-02.md`
- `docs/material-lab-interaction-chrome-upgrade.md`

## Goal

The material UI system must be able to emit DOM and CSS as if each exported component had been hand-authored for exactly its active behavior.

The editor may keep rich metadata, selection handles, diagnostics, drag affordances, and inspection attributes. The export output must not inherit that editor weight.

Target standard:

- no disabled feature layers
- no default-valued inline declarations
- no editor-only attributes
- no wrapper whose removal leaves pixels, behavior, accessibility, and layout unchanged
- no CSS variable unless some active rule consumes it
- no class unless it selects active behavior or communicates semantic/runtime state

## Core Decision

Do not try to make one DOM tree serve every purpose.

The system needs explicit render modes:

```ts
type MaterialRenderMode = 'editor' | 'runtime' | 'export';
```

Mode meanings:

- `editor`: full authoring DOM. Includes selection ids, instance ids, inspector hooks, data provenance, flash overlays, layout probes, and rich diagnostics.
- `runtime`: game/client DOM. Keeps behavior and accessibility hooks, but removes editor-only inspection/debug metadata.
- `export`: minimal artifact DOM/CSS. Keeps only nodes, attributes, classes, variables, and declarations that are necessary for the exported visual/behavioral result.

The current preview may continue using `editor` while the new emitter is built. The export emitter should be validated against the current editor preview, not forced to share the same markup.

## Principle

Resolved recipe data is not emitted output.

Resolvers answer:

> What visual, layout, text, and interaction intent does this component have?

Emitters answer:

> What is the smallest DOM/CSS payload that produces that intent in this render mode?

Every feature emitter must be allowed to return nothing.

```ts
type EmittedLayer = null | {
  classNames?: string[];
  attrs?: Record<string, string | boolean | number>;
  style?: Record<string, string | number>;
  children?: EmittedLayer[];
};
```

If a feature is off, default-equivalent, transparent, zero-strength, or not consumed by the selected mode, its emitter returns `null`.

## Architecture

The material pipeline has five stages.

```txt
Recipe / Node Model
  -> Resolved Material Intent
  -> Layer Plan
  -> Mode-Specific Emission Plan
  -> DOM + CSS Output
```

### 1. Recipe / Node Model

The model remains expressive and editor-friendly. It may store defaults, inactive feature settings, previous values, and future-capable fields.

The model is not judged for being minimal.

### 2. Resolved Material Intent

Resolution normalizes the model into explicit active intent:

- base shape
- base color
- texture
- tint
- gradient
- blur
- frosted glass
- border
- edge wear
- shadow
- state overlays
- content/text/icon
- layout

Resolution may keep inactive data for editor display, but it must mark whether each feature is active.

### 3. Layer Plan

The layer plan is the canonical source for what can emit.

Layer order:

```txt
00 base shape
00 base color
01 texture
02 gradient
03 blur
04 frosted glass
05 border
06 edge wear
07 shadow
08 state
09 selected/editor overlay
10 content
```

Notes:

- `selected/editor overlay` is editor-only.
- `content` is last because labels/icons must sit above material paint.
- `shadow` may emit as host style instead of a child layer.
- A layer may emit CSS-only, DOM-only, both, or nothing.

### 4. Mode-Specific Emission Plan

The emission plan converts the layer plan into concrete output for `editor`, `runtime`, or `export`.

Editor mode may emit:

- `data-material-target-id`
- `data-material-instance-id`
- `data-feed-layout-mode`
- `data-w-mode`
- `data-h-mode`
- `data-direction`
- `data-game-text-*`
- inspector/probe hooks
- selection flash classes
- provenance markers

Runtime mode may emit:

- accessibility attributes
- interaction role attributes
- stable behavior selectors
- text fitter metadata only when the fitter actually runs at runtime

Export mode may emit:

- semantic/native attributes such as `type`, `aria-label`, `aria-current`, `disabled`
- classes required by active exported CSS
- inline styles required because the value is instance-specific
- minimal text/content DOM

Export mode must not emit editor registry ids, probe ids, debug attributes, provenance markers, migration selectors, or inactive fitter metadata.

### 5. DOM + CSS Output

The output layer creates either:

- SolidJS editor/runtime elements
- serialized export HTML
- serialized export CSS
- inspector snapshots

The serializer must use the same emission plan as the live renderer for the selected mode. Do not maintain a separate string-only export path that can drift from runtime behavior.

## Surface Emission Rules

### Host Element

Emit one host element for a material component.

Use native elements when behavior calls for them:

- `button` for actions
- `a` for navigation links
- `section`, `article`, or `div` for static panels depending on semantics

Do not wrap a host only to carry editor ids in `runtime` or `export`.

### Material Layers

Each visual feature owns exactly one layer emitter.

```txt
baseColor -> host class/style
texture -> child layer only when active
gradient -> child layer only when active
blur -> CSS only when active
frostedGlass -> child/style only when active
border -> child/style only when active
edgeWear -> child/style only when active
shadow -> host style/class only when active
state -> state attrs/classes/vars only when active
```

A layer is active only if it changes output pixels or interaction.

Examples:

- texture opacity `0` emits no texture layer, no texture class, no texture image var
- edge wear width `0` emits no edge wear layer
- transparent border sides emit no side variables
- gradient mode `none` emits no gradient span and no light/dark vars
- glass class emits only when glass/blur is active
- `transform: translate(0px, 0px)` emits nothing
- `padding-inline: 0px` emits nothing

### Classes

Classes are for shared behavior or shared style only.

Export mode should avoid class stacks like:

```html
class="cd-surface is-interactive is-visual-rest cd-surface--base-white cd-surface--rect ..."
```

Prefer a smaller set:

```html
class="cd-button cd-button--contract"
```

Then emit only the CSS needed by that exported class.

Editor mode may keep granular classes because they are useful for diagnostics.

### CSS Variables

CSS variables are emitted only when:

- the value varies by instance, and
- at least one emitted rule consumes the variable in that mode.

Do not emit variables as a mirror of the recipe.

No export output for:

- zero offsets
- default font style
- default transform
- disabled feature opacity
- transparent border sides
- inactive hover/pressed/active vars
- icon vars when the component has no icon

### Inline Styles

Inline styles are allowed when values are instance-specific and not worth generating a class for.

Inline styles must pass `compactStyle()`:

- remove `undefined`, `null`, empty string
- remove zero/default transforms
- remove default alignment
- remove transparent/off values
- remove unused custom properties

## Layout Emission Rules

Layout is part of the unified node model, but it follows the same mode-specific emission rules.

Emit layout CSS only when it is needed for the rendered result.

Examples:

- In-flow leaf with natural size emits no flex CSS.
- `row` emits `display:flex` and `flex-direction:row` only when children/content require flex layout.
- `wrap:false` emits no `flex-wrap`.
- `gap:0` emits no `gap`.
- `padding:0` emits no padding var/style.
- `pushToEnd` emits exactly one axis-aware auto margin.
- absolute left/top emits no right/bottom.
- absolute left-right emits no width.
- hug disables fitter sizing on that axis.

Editor-only layout selectors such as `data-feed-layout-mode` must not appear in export mode unless exported CSS actually uses them.

## Text Emission Rules

Text has three render paths.

```ts
type TextEmissionMode = 'plain' | 'styled' | 'fitted';
```

Use `plain` when:

- single text node/span is enough
- no custom per-instance typography is needed
- no fitting or measurement is needed

Use `styled` when:

- typography/color/shadow differs from surrounding text
- no measurement wrapper is needed

Use `fitted` only when:

- text must be measured, scaled, clamped, or auto-positioned
- the selected render mode actually needs the fitter

A fixed single-line CTA label should not automatically emit the full game text fitter stack. It should use `styled` or `plain` unless the recipe asks for fitting.

Editor mode may keep fitter metadata for inspection. Export mode must not emit `data-game-text-*` unless exported runtime code needs it.

## Inspector Requirements

The emission inspector should compare modes, not only display the editor DOM.

Required views:

- Editor DOM
- Runtime DOM
- Export DOM
- Export CSS

Each view should show:

- node count
- class count
- attribute count
- inline style declaration count
- CSS variable count
- feature provenance for every emitted class/style/attribute

The inspector must answer:

- which feature added this?
- is this editor-only, runtime, or export?
- what happens if this layer is disabled?
- what CSS rules consume this class or variable?

Click-to-hide class probing is an editor-only inspection tool. Refresh restores the selected mode snapshot.

## Validation Strategy

### 1. Golden Emission Tests

For representative components, assert exact exported HTML and CSS.

Minimum fixtures:

- CTA button with base only
- CTA button with texture/gradient/border/edge wear/shadow
- CTA button with plain label
- CTA button with fitted label
- mission briefing card
- top bar wallet button
- toolbar command button
- nav tab rest/active states

### 2. Visual Equivalence Tests

Render editor/runtime/export versions side by side in a test route.

Compare:

- bounding boxes
- computed key styles
- screenshot diff threshold
- text visibility
- click target dimensions

### 3. Deletion Proof

The inspector should support a deletion proof pass:

1. remove one emitted class/style/attribute from export output
2. rerender
3. detect whether pixels, layout, behavior, or accessibility changed

If removing an item changes nothing, that item is not allowed in export mode unless explicitly whitelisted.

### 4. Browser Performance Checks

Track:

- node count per component
- total preview node count
- style recalculation time after material changes
- layout time after layout changes
- paint/composite cost for texture, shadow, blur, edge wear

Performance checks are advisory during editor work and mandatory before export mode is considered complete.

## CTA Pilot

The CTA button is the first migration target.

Current editor-style CTA output includes:

- material frame div
- button host
- material layer spans
- content span
- label span
- material text span
- game text container
- game text inner
- editor ids and layout data attrs
- many CSS variables

Target export output for a simple non-fitted CTA should be closer to:

```html
<button class="cd-button cd-button--contract" type="button">
  <span>View Contract</span>
</button>
```

If texture/gradient/border/edge wear are active, export may add only the layers required for those visuals:

```html
<button class="cd-button cd-button--contract cd-button--textured" type="button">
  <span class="cd-layer cd-layer--texture" aria-hidden="true"></span>
  <span class="cd-layer cd-layer--gradient" aria-hidden="true"></span>
  <span class="cd-layer cd-layer--border" aria-hidden="true"></span>
  <span class="cd-layer cd-layer--edge" aria-hidden="true"></span>
  <span class="cd-button__label">View Contract</span>
</button>
```

That is acceptable only if each layer changes pixels. If a layer is inactive, it is absent.

## Implementation Plan

### Stage 1: Types And Plans

- Add `MaterialRenderMode`.
- Add `ResolvedMaterialIntent`.
- Add `MaterialLayerPlan`.
- Add active/inactive predicates for every feature.
- Add `compactStyle()`.
- Add layer plan debug output to the inspector.

### Stage 2: Surface Emitter

- Refactor `MaterialPanel` / `MaterialButton` internals to build from the layer plan.
- Keep current editor visuals stable.
- In editor mode, allow current diagnostic classes/attrs.
- In export mode, suppress editor-only output.

### Stage 3: Text Emitter

- Add `plain`, `styled`, and `fitted` text paths.
- Make fixed single-line CTA use `styled` unless fit is explicitly enabled.
- Emit fitter wrappers only for fitted text.

### Stage 4: Export Serializer

- Add export DOM/CSS serializer driven by the same emission plan.
- Add inspector tabs for Editor DOM, Runtime DOM, Export DOM, Export CSS.
- Add copy buttons per mode.

### Stage 5: CTA Pilot

- Migrate CTA button export path.
- Add golden emission tests.
- Add visual equivalence check between editor CTA and export CTA.
- Use deletion proof to remove no-op classes/styles/attrs.

### Stage 6: Expand By Component Family

Order:

1. toolbar command buttons
2. nav tabs
3. top bar currency buttons
4. profile button
5. mission briefing panels
6. feed cards
7. backdrop/title shell

Do not migrate the next family until the previous family has golden emission tests and inspector comparison.

## Acceptance Criteria

The minimal emission system is accepted when:

- `editor`, `runtime`, and `export` modes exist and are selectable by the inspector.
- CTA export emits no editor-only attributes.
- CTA export emits no inactive visual layer spans.
- CTA export emits no unused CSS variables.
- simple CTA text can render without the game text fitter stack.
- every export class/style/attribute has provenance.
- golden tests assert exact export output for the CTA pilot.
- visual equivalence confirms the export CTA still looks correct.
- old overlapping specs are moved out of active docs.

## Non-Goals

- Do not optimize the editor DOM to be minimal.
- Do not remove useful editor diagnostics just because export mode does not need them.
- Do not rewrite all material components before the CTA pilot proves the pipeline.
- Do not convert stable shared CSS into inline styles merely to reduce stylesheet size.
- Do not make the compiler infer design intent from screenshots. The layer plan must come from recipes and explicit feature predicates.
