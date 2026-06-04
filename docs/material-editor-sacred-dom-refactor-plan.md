# Material Editor Sacred DOM Refactor Plan

Status: active
Date: 2026-06-04

## Goal

Refactor the material editor so export/runtime DOM/CSS is derived from the same visual DOM/CSS that the editor preview already uses.

The editor may keep rich knowledge, but that knowledge lives in RAM: Solid signals, stores, refs, registries, maps, and emission plans. The preview DOM is not a storage layer.

```txt
Current editor visual DOM/CSS
  -> classify product vs editor-only
  -> move editor-only facts to RAM
  -> prune editor-only DOM/CSS
  -> truthful export/runtime DOM/CSS

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

The current CTA export can serialize a lean two-element product-like button, but the live editor preview still renders a heavier material DOM with a different layering model. That means export is not trusted: it is not the same structure the user sees in the editor.

This split is the architecture smell to remove.

The first fix is not to invent a new two-element renderer. The first fix is to classify the existing editor visual DOM, remove only editor-owned storage/diagnostic garbage, and export the remaining truthful visual structure.

## Target Architecture

```txt
Current working editor render
  -> DOM/CSS classifier
  -> RAM-backed editor registry
  -> pruned product DOM/CSS
  -> export/runtime artifact
```

The pruned product DOM/CSS is consumed by:

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

The first truthful CTA export should resemble the current editor CTA after pruning editor-only metadata, not an invented minimal renderer.

If the editor visual CTA currently needs material layer nodes to produce pixels, the first export keeps those nodes.

Example truthful structure:

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

Only after proof passes may we optimize toward:

```html
<button class="cd-button cd-button--contract" type="button">
  <span class="cd-button__label">View Contract</span>
</button>
```

The two-element form is a later optimization, not the first target.

### DOM Classifier

Create a CTA DOM/CSS classifier that inspects the current editor visual subtree and labels each node/attr/class/style:

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

The export serializer removes only `editor-*`, temporary inactive affordances, and inactive/no-op entries. It keeps visual/runtime/accessibility/layout structure.

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

### Phase 1: CTA DOM/CSS Classification

- Identify the current CTA editor visual subtree.
- Classify each CTA node, attr, class, inline style, and CSS variable.
- Mark active material layer spans as product visual if they change pixels.
- Mark fitter/text wrappers as product text if fitting is active.
- Mark editor ids, feed layout diagnostics, provenance, probe flags, selection classes, and inactive feature hints as editor-owned.

Acceptance:

- Classification report explains why each emitted item stays or is removed.
- No live visual renderer is replaced in this phase.
- No authored recipe values are changed.

### Phase 2: CTA Editor State In RAM

- Move CTA selection/provenance/layer diagnostics out of preview DOM.
- Inspector reads RAM/emission-plan data.
- Keep colored inspector badges and useful diagnostics as inspector UI, not product DOM.

Acceptance:

- CTA inspector still shows useful provenance/layer information from RAM.
- Classifier no longer needs editor-only DOM metadata to answer inspector questions.

### Phase 3: Truthful Pruned Export

- Export DOM/CSS serializer consumes the classified live CTA visual subtree.
- Remove only editor-owned storage/diagnostic/probe/temp metadata and inactive/no-op layers.
- Keep active visual layer nodes if the editor render uses them.
- Copy/export payload remains raw product output.
- Badges/colorization stay outside the copied payload.

Acceptance:

- Export DOM is structurally recognizable as the editor visual DOM minus editor-only garbage.
- Export does not collapse from the editor's 12-node visual structure to an unrelated 2-node structure unless proof shows those nodes are no-op.

### Phase 4: Render Proof

Add a proof path that mounts and compares:

1. live editor CTA product render
2. exact pruned exported CTA HTML/CSS
3. Solid runtime render from the same pruned artifact or equivalent component, when available

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

- export/runtime are derived from the same visual structure used by preview
- diagnostics live in RAM
- product DOM has no permanent editor-only garbage
- render proof exists
- authored recipe values were not tuned to make proof pass

## First Work Slice

Implement only the CTA sacred-DOM prototype:

1. Add CTA DOM/CSS classifier for the current editor visual subtree.
2. Move CTA diagnostics needed by inspector into RAM.
3. Export by pruning the classified live visual DOM/CSS.
4. Add proof checks that compare live preview and exact pruned export output.
5. Only after proof passes, evaluate whether individual layers can become pseudo-elements.
6. Run `npm run build`.
7. Verify `/main-material` visually and inspect CTA output.

## Non-Goals

- Do not rewrite the whole material system in this pass.
- Do not migrate every UI tree object in this pass.
- Do not tune authored CTA visual values.
- Do not delete useful inspector diagnostics.
- Do not keep editor DOM pollution to avoid breaking an editor feature.
- Do not replace the current editor CTA renderer before truthful export is proven.
- Do not optimize to a two-element CTA until the pruned editor-DOM export passes proof.
