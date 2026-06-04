# Material Editor Sacred DOM Refactor Plan

Status: active
Date: 2026-06-04

## Goal

Refactor the material editor so the editor preview, runtime, and export all use the same product DOM/CSS subtree.

The editor may keep rich knowledge, but that knowledge lives outside the product subtree: Solid signals, stores, refs, registries, maps, inspector state, and emission plans. The product DOM is not a storage layer.

```txt
EditorTargetShell
  -> owns selection, refs, inspector registration, temporary highlight UI
  -> wraps but does not pollute:

Product DOM/CSS subtree
  -> real runtime/export UI
  -> serialized directly for export
  -> rendered by Solid in runtime
```

## Hard Rule

If the game runtime would not need it, the product DOM/CSS must not permanently contain it.

If a current editor feature depends on editor-only DOM attributes, wrapper nodes, hidden spans, diagnostic classes, probe nodes, or CSS variables inside the product subtree, rewrite that feature to use RAM or an editor shell outside the product subtree.

Temporary visible editor affordances are allowed only while active and only outside or over the product subtree. Examples:

- selected outline
- short selection flash
- visible inspector highlight

They must not be required for product pixels, layout, behavior, or accessibility.

## Current Problem

The current CTA export can serialize a lean product-like button, but the live editor preview still renders a heavier material DOM with a different layering model. That means export is not trusted: it is not the same structure the user sees in the editor.

The first fix is not to invent a separate two-element renderer. The first fix is to define the product boundary inside the current working render, move editor-owned facts outside that boundary, and export the product subtree directly.

Pruning is a temporary migration/audit tool only. It may help identify legacy editor-owned attrs/classes/nodes while we split the boundary, but the final architecture is not "export by pruning editor DOM." The final architecture is "export the product subtree."

## Target Architecture

```tsx
<EditorTargetShell targetId="contract-cta">
  <ProductCtaVisualTree />
</EditorTargetShell>
```

The shell owns:

- selection state
- hover/flash/highlight affordances
- element refs
- inspector registration
- diagnostics/provenance lookup
- transient editor-only UI

The product subtree owns:

- real semantic host element
- active material visual layers
- runtime/accessibility attributes
- runtime behavior selectors
- text/icon/content wrappers required for pixels, layout, behavior, accessibility, or fitting

The export serializer consumes the product subtree or the same product emission plan. It must not serialize the editor shell.

The inspector reads:

- recipe state
- selected target id
- emission plan
- layer activation result
- provenance
- metrics
- computed DOM/style audit

It does not store those facts in product DOM.

## CTA Prototype

CTA is the first migrated family.

### Product DOM Shape

The first truthful CTA export should resemble the current CTA product visual tree, not an invented minimal renderer.

If the CTA needs material layer nodes to produce pixels, the product subtree keeps those nodes. If the text fitter is active in the game runtime, the product subtree keeps the required fitter/text wrappers. If fitting is not active, simple CTA text should use the simpler runtime text path.

Example product subtree:

```html
<button class="...real visual button classes..." type="button">
  <span class="...active texture layer..." aria-hidden="true"></span>
  <span class="...active gradient layer..." aria-hidden="true"></span>
  <span class="...active border layer..." aria-hidden="true"></span>
  <span class="...active edge layer..." aria-hidden="true"></span>
  <span class="...content wrapper if required...">
    <span class="...label/fitter wrapper if required...">View Contract</span>
  </span>
</button>
```

The editor wrapper is outside this subtree:

```html
<div class="material-editor-target-shell">
  <!-- product subtree starts here -->
  <button class="...real visual button classes..." type="button">...</button>
  <!-- product subtree ends here -->
  <div class="material-editor-target-outline" hidden></div>
</div>
```

Only after product-subtree proof passes may we optimize toward:

```html
<button class="cd-button cd-button--contract" type="button">
  <span class="cd-button__label">View Contract</span>
</button>
```

The two-element form is a later optimization, not the first target.

### Boundary Audit

Create a CTA boundary audit that labels each node/attr/class/style in the current CTA area:

```ts
type DomEmissionRole =
  | 'product-visual'
  | 'product-behavior'
  | 'product-accessibility'
  | 'product-layout'
  | 'editor-state'
  | 'editor-diagnostic'
  | 'temporary-editor-affordance'
  | 'inactive-noop';
```

The audit is used to move editor-owned entries out of the product subtree. Export should not depend on a pruner once the boundary is clean.

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

### Phase 1: CTA Product Boundary

- Identify the current CTA editor target shell and product visual subtree.
- Wrap the product subtree with an editor shell that owns selection/inspector behavior.
- Do not change authored recipe values.
- Do not replace the working visual renderer in this phase.

Acceptance:

- CTA visuals remain stable.
- The product subtree is identifiable by ref/registry, not permanent product-internal editor ids.
- Editor shell can select/inspect the CTA without injecting metadata inside the product subtree.

### Phase 2: CTA Editor State In RAM

- Move CTA selection/provenance/layer diagnostics out of product DOM.
- Inspector reads RAM/emission-plan data.
- Keep colored inspector badges and useful diagnostics as inspector UI, not product DOM.

Acceptance:

- CTA inspector still shows useful provenance/layer information from RAM.
- Product subtree no longer carries editor-only DOM metadata to answer inspector questions.

### Phase 3: Product-Subtree Export

- Export DOM/CSS serializer consumes the CTA product subtree or the same product emission plan.
- Do not serialize the editor shell.
- Keep active visual layer nodes if the product render uses them.
- Copy/export payload remains raw product output.
- Badges/colorization stay outside the copied payload.

Acceptance:

- Export DOM is structurally recognizable as the product subtree shown in the editor.
- Export does not collapse from the editor's product visual structure to an unrelated 2-node structure unless proof shows those nodes are no-op.
- Export contains no editor-only storage/diagnostic/probe/temp metadata.

### Phase 4: Render Proof

Add a proof path that mounts and compares:

1. live editor CTA product subtree
2. exact exported CTA HTML/CSS
3. Solid runtime render from the same product component/emission plan, when available

Proof must check:

- DOM cleanliness
- node/class/attr/style variable counts
- bounding boxes
- key computed styles
- rest, hover, pressed, disabled states
- screenshot/pixel diff when practical

Acceptance:

- Proof fails if preview has permanent editor-only DOM/CSS inside the product subtree.
- Proof fails if export differs materially from the product subtree.
- Proof reports likely failure cause without changing authored recipe values.

### Phase 5: Minimal Optimization

After proof passes:

- try replacing active layer spans with pseudo-elements only one layer at a time
- prove pixels/layout/state still match after each optimization
- remove an element/class/style only when deletion proof says it is no-op or equivalent
- update tests/goldens for the optimized output

## Family Migration Order

1. CTA button
2. nav tabs
3. toolbar buttons
4. currency/wallet buttons
5. profile button
6. feed panels/cards
7. top/bottom shell

Each family must pass the same bar before moving on:

- editor wraps the product subtree from outside
- export/runtime use the same product subtree or product emission plan
- diagnostics live in RAM
- product DOM has no permanent editor-only garbage
- render proof exists
- authored recipe values were not tuned to make proof pass

## First Work Slice

Implement only the CTA sacred-DOM prototype:

1. Add CTA product-boundary audit for the current visual subtree.
2. Introduce an editor shell around the CTA product subtree.
3. Move CTA diagnostics needed by inspector into RAM.
4. Export the CTA product subtree directly, excluding the editor shell.
5. Add proof checks that compare live preview product subtree and exact export output.
6. Only after proof passes, evaluate whether individual layers can become pseudo-elements.
7. Run `npm run build`.
8. Verify `/main-material` visually and inspect CTA output.

## Non-Goals

- Do not rewrite the whole material system in this pass.
- Do not migrate every UI tree object in this pass.
- Do not tune authored CTA visual values.
- Do not delete useful inspector diagnostics.
- Do not keep editor DOM pollution to avoid breaking an editor feature.
- Do not export by permanently pruning an editor-specific DOM.
- Do not optimize to a two-element CTA until product-subtree export passes proof.
