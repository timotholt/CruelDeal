# Minimal Material Emission Pipeline Spec

Status: active
Date: 2026-06-03
Supersedes:

- `docs/layout-css-emission-minimization-spec.md`
- `docs/main-material-refactor-plan.md`
- `docs/material-node-system-refactor-spec-2026-06-02.md`
- `docs/material-lab-interaction-chrome-upgrade.md`

## Goal

The material UI system must render and emit DOM/CSS as if each component had been hand-authored for exactly its active behavior.

The editor preview must use the same product DOM/CSS as runtime/export. Editor intelligence lives in RAM, not in permanent DOM attributes, wrapper nodes, hidden spans, debug classes, or CSS variables.

If a current editor feature depends on polluted DOM, rewrite that feature around internal state, refs, registries, and emission plans. Do not preserve polluted DOM for compatibility.

Target standard:

- no disabled feature layers
- no default-valued inline declarations
- no editor-only attributes
- no editor-only wrappers
- no hidden diagnostic/probe nodes
- no wrapper whose removal leaves pixels, behavior, accessibility, and layout unchanged
- no CSS variable unless some active rule consumes it
- no class unless it selects active behavior or communicates semantic/runtime state

## Core Decision

There is one canonical product render.

The system still needs explicit output modes, but these modes must not justify different permanent material DOM:

```ts
type MaterialRenderMode = 'editor' | 'runtime' | 'export';
```

Mode meanings:

- `editor`: the product DOM/CSS rendered in the editor preview, plus only temporary visible editor affordances while active.
- `runtime`: the product DOM/CSS rendered by the game client.
- `export`: serialization of that same product DOM/CSS.

The live editor preview, runtime renderer, and export serializer must be driven by the same emission plan. Export is not a separate string-only representation. If editor preview and export differ permanently, the architecture is wrong.

Editor state may include rich metadata, provenance, diagnostics, selection state, layout intent, fitter state, and audit results. That information is held in Solid signals/stores, registries, maps, and planner output, not in product DOM.

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
  -> Canonical Product Emission Plan
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

Resolution may keep inactive data for editor display in RAM, but it must mark whether each feature is active. Inactive data does not become DOM/CSS.

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
09 transient editor adornment
10 content
```

Notes:

- `transient editor adornment` is not product DOM. It is a separate temporary editor UI channel when active.
- `content` is last because labels/icons must sit above material paint.
- `shadow` may emit as host style instead of a child layer.
- A layer may emit CSS-only, DOM-only, both, or nothing.

### 4. Canonical Product Emission Plan

The emission plan converts the layer plan into concrete product output.

Product output may emit:

- semantic/native attributes such as `type`, `aria-label`, `aria-current`, `disabled`
- classes required by active exported CSS
- inline styles required because the value is instance-specific
- minimal text/content DOM
- accessibility attributes
- stable behavior selectors required by runtime behavior
- text fitter metadata only when the fitter actually runs in the game runtime

Product output must not emit editor registry ids, instance ids, probe ids, debug attributes, provenance markers, migration selectors, layout diagnostics, hidden measurement nodes, inactive fitter metadata, or wrapper nodes used only for authoring.

Temporary editor UI may exist outside the product output while active:

- selected outline
- short selection flash
- visible inspector highlight

Those temporary affordances must not be required for product pixels, behavior, accessibility, or layout.

### 5. DOM + CSS Output

The output layer creates either:

- SolidJS product elements for editor/runtime
- serialized export HTML
- serialized export CSS
- inspector snapshots

The serializer must use the same emission plan as the live editor renderer and runtime renderer. Do not maintain a separate string-only export path that can drift from preview/runtime behavior.

## Surface Emission Rules

### Host Element

Emit one host element for a material component.

Use native elements when behavior calls for them:

- `button` for actions
- `a` for navigation links
- `section`, `article`, or `div` for static panels depending on semantics

Do not wrap a host only to carry editor ids, diagnostics, layout metadata, or inspector state.

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

Granular diagnostic classes are not allowed in product DOM. Keep diagnostics in RAM and show them in the inspector UI.

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

Editor-only layout selectors such as `data-feed-layout-mode` must not appear in product DOM. If layout information is needed by the inspector, it belongs in RAM. If layout information is needed by runtime CSS, emit the actual product class/style that consumes it.

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

Fitter metadata for inspection belongs in RAM. Product DOM must not emit `data-game-text-*` unless the game runtime fitter actually consumes it.

## Inspector Requirements

The emission inspector should prove product render identity, not normalize away a fake editor/export split.

Required views:

- Preview Product DOM
- Runtime DOM
- Export DOM
- Export CSS
- Render Proof

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

Inspector badges, colorization, provenance, and deletion proof controls are inspector UI. They must not be injected into the product DOM/CSS being inspected.

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

Render preview/runtime/export versions side by side in a test route.

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

Performance checks are mandatory for migrated product-render families.

## CTA Pilot

The CTA button is the first migration target.

Current legacy CTA output includes:

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

Target product output for a simple non-fitted CTA should be closer to:

```html
<button class="cd-button cd-button--contract" type="button">
  <span>View Contract</span>
</button>
```

If texture/gradient/border/edge wear are active, prefer CSS pseudo-elements and host rules before adding empty layer spans. A real child layer is acceptable only when it changes pixels/behavior/layout/accessibility and CSS cannot express it cleanly. If a layer is inactive, it is absent.

## Implementation Plan

### Stage 1: Types And Plans

- Add `MaterialRenderMode`, with `editor` defined as product render plus temporary editor affordances only.
- Add `ResolvedMaterialIntent`.
- Add `MaterialLayerPlan`.
- Add active/inactive predicates for every feature.
- Add `compactStyle()`.
- Add layer plan debug output to an inspector RAM registry, not product DOM.

### Stage 2: Surface Emitter

- Refactor `MaterialPanel` / `MaterialButton` internals to build from the layer plan.
- Make the editor preview render the same product DOM/CSS as export/runtime for the migrated family.
- Preserve authored visuals and interactions without tuning recipe values.
- Move diagnostic classes/attrs into RAM-backed inspector data.

### Stage 3: Text Emitter

- Add `plain`, `styled`, and `fitted` text paths.
- Make fixed single-line CTA use `styled` unless fit is explicitly enabled.
- Emit fitter wrappers only for fitted text.

### Stage 4: Export Serializer

- Add export DOM/CSS serializer driven by the same product emission plan.
- Add inspector tabs for Preview Product DOM, Runtime DOM, Export DOM, Export CSS, Render Proof.
- Add copy buttons per mode.

### Stage 5: CTA Pilot

- Migrate CTA button export path.
- Migrate CTA editor preview to the same product render path.
- Add golden emission tests.
- Add visual equivalence check proving preview CTA and export CTA are the same rendered product.
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

- editor preview, runtime, and export use the same product emission plan for migrated families.
- CTA preview/export emit no editor-only attributes.
- CTA preview/export emit no inactive visual layer spans.
- CTA preview/export emit no unused CSS variables.
- simple CTA text can render without the game text fitter stack.
- every product class/style/attribute has RAM-backed provenance.
- golden tests assert exact product/export output for the CTA pilot.
- visual equivalence confirms the preview/export/runtime CTA match.
- old overlapping specs are moved out of active docs.

## Non-Goals

- Do not keep editor DOM garbage to preserve a current feature. Rewrite the feature to use RAM.
- Do not delete useful editor diagnostics. Move them out of product DOM/CSS and into RAM-backed inspector data.
- Do not rewrite all material components before the CTA pilot proves the pipeline.
- Do not convert stable shared CSS into inline styles merely to reduce stylesheet size.
- Do not make the compiler infer design intent from screenshots. The layer plan must come from recipes and explicit feature predicates.
