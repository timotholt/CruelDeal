# Material Editor Sacred DOM Refactor Plan

Status: active
Date: 2026-06-04

## Goal

Refactor the material editor so the live preview DOM/CSS is the same product DOM/CSS used by export and runtime.

The editor may keep rich knowledge, but that knowledge lives in RAM: Solid signals, stores, refs, registries, maps, and emission plans. The preview DOM is not a storage layer.

```txt
Product emission plan
  -> Product Solid renderer -> editor preview
  -> Export serializer      -> exported HTML/CSS
  -> Runtime renderer       -> game UI

Editor state/diagnostics
  -> RAM store / inspector registry
```

## Hard Rule

If the game runtime would not need it, the preview DOM/CSS must not permanently contain it.

If a current editor feature depends on editor-only DOM attributes, wrapper nodes, hidden spans, diagnostic classes, probe nodes, or CSS variables, rewrite that feature to use RAM instead of preserving polluted DOM for compatibility.

Temporary visible editor affordances are allowed only while active. Examples:

- selected outline
- short selection flash
- visible inspector highlight

They must not be required for product pixels, layout, behavior, or accessibility.

## Current Problem

The current CTA export can serialize a lean product-like button, but the live editor preview still renders a heavier editor-specific material DOM. That means export is not trusted: it is inspectable, but not proven as the real thing users see in the editor.

This split is the architecture smell to remove.

## Target Architecture

```txt
Recipe / UI node data
  -> resolved material intent
  -> canonical product emission plan
  -> shared product render output
```

The shared product render output is consumed by:

- live material editor preview
- export HTML/CSS serializer
- SolidJS game runtime renderer
- render proof harness

The inspector reads:

- recipe state
- selected target id
- emission plan
- layer activation result
- provenance
- metrics
- computed DOM/style audit

It does not store those facts in preview DOM.

## CTA Prototype

CTA is the first migrated family.

### Product DOM Shape

The simple non-fitted CTA should render close to:

```html
<button class="cd-button cd-button--contract" type="button">
  <span class="cd-button__label">View Contract</span>
</button>
```

Active material effects should prefer CSS host rules and pseudo-elements before adding empty child spans. A real child layer is allowed only if it changes pixels, behavior, accessibility, or layout and cannot be represented cleanly in CSS.

### Product Renderer

Create or extract a CTA product renderer that accepts a canonical emission plan:

```tsx
<ProductCtaButton
  plan={ctaEmissionPlan()}
  label="View Contract"
  disabled={false}
  onSelect={() => selectTarget("contract-cta")}
/>
```

The `onSelect` handler is editor wiring through Solid props/closures. It is not serialized into export DOM and does not require permanent editor metadata in the button DOM.

### RAM Editor Registry

Move CTA editor diagnostics into RAM:

```ts
interface MaterialEditorEntry {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  emissionPlan: MaterialEmissionPlan;
  metrics: MaterialEmissionMetrics;
  diagnostics: MaterialEmissionDiagnostic[];
}
```

The inspector should query this entry rather than scrape editor-specific DOM.

## Implementation Phases

### Phase 1: Product CTA Render Path

- Identify the current CTA editor render path.
- Identify the current CTA export emission plan.
- Build a shared CTA product renderer from the emission plan.
- Use that renderer in the live editor preview for the selected CTA path.
- Do not alter authored recipe values, sliders, font sizes, colors, rem/px values, hover values, or pressed values to make visuals pass.

Acceptance:

- Live CTA editor preview uses product DOM/CSS.
- Live CTA still looks and behaves like the authored CTA.
- Hover and pressed behavior are preserved through product CSS/render state.

### Phase 2: CTA Editor State In RAM

- Move CTA selection/provenance/layer diagnostics out of preview DOM.
- Inspector reads RAM/emission-plan data.
- Keep colored inspector badges and useful diagnostics as inspector UI, not product DOM.

Acceptance:

- CTA inspector still shows useful export/editor/provenance information.
- CTA product DOM has no permanent editor-only attrs/classes/nodes.

### Phase 3: Export Shares The Same Plan

- Export DOM/CSS serializer consumes the same product emission plan as live preview.
- Copy/export payload remains raw product output.
- Badges/colorization stay outside the copied payload.

Acceptance:

- Export DOM is not a different fairy-tale renderer.
- Export DOM/CSS is a serialization of the same product output the editor uses.

### Phase 4: Render Proof

Add a proof path that mounts and compares:

1. live editor CTA product render
2. exact exported CTA HTML/CSS
3. Solid runtime CTA render from the same plan, when available

Proof must check:

- DOM cleanliness
- node/class/attr/style variable counts
- bounding boxes
- key computed styles
- rest, hover, pressed, disabled states
- screenshot/pixel diff when practical

Acceptance:

- Proof fails if preview has permanent editor-only DOM/CSS.
- Proof fails if export differs materially from preview.
- Proof reports likely failure cause without changing authored recipe values.

### Phase 5: Delete Legacy CTA DOM

After proof passes:

- remove the live CTA dependency on legacy editor-only material spans/wrappers
- keep legacy material paths only for unmigrated component families
- update tests/goldens for CTA product output

## Family Migration Order

1. CTA button
2. nav tabs
3. toolbar buttons
4. currency/wallet buttons
5. profile button
6. feed panels/cards
7. top/bottom shell

Each family must pass the same bar before moving on:

- preview/export/runtime share one product emission plan
- diagnostics live in RAM
- product DOM has no permanent editor-only garbage
- render proof exists
- authored recipe values were not tuned to make proof pass

## First Work Slice

Implement only the CTA sacred-DOM prototype:

1. Add or extract CTA product renderer.
2. Wire live editor CTA preview to product renderer.
3. Move CTA diagnostics needed by inspector into RAM.
4. Make export serialize the same plan.
5. Add proof checks that compare live preview and exact export output.
6. Run `npm run build`.
7. Verify `/main-material` visually and inspect CTA output.

## Non-Goals

- Do not rewrite the whole material system in this pass.
- Do not migrate every UI tree object in this pass.
- Do not tune authored CTA visual values.
- Do not delete useful inspector diagnostics.
- Do not keep editor DOM pollution to avoid breaking an editor feature.
