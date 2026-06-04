# Material Editor Technical Debt Plan

Status: active
Date: 2026-06-03

## Goal

Remove editor DOM/CSS pollution while preserving editor usefulness, export correctness, and the path to server-driven SolidJS runtime UI.

This plan follows:

```txt
Render the product subtree. Store editor knowledge in RAM or an external editor shell. Export the product subtree directly.
```

See also:

- `docs/material-preview-emission-rules.md`
- `docs/minimal-material-emission-pipeline-spec.md`
- `docs/material-render-proof-verification-plan.md`
- `docs/solidjs-server-driven-ui-skins-migration-plan.md`

## Current Problem

The editor preview DOM currently stores too much information directly in DOM attributes, class stacks, layer spans, and CSS variables.

The CTA export path is smaller, but the live editor still renders a heavier editor-specific material primitive. That is not acceptable as a final architecture. It is temporary migration debt only.

If a current editor feature depends on permanent DOM garbage inside the product subtree, rewrite that feature to store its information internally in RAM or in an editor shell outside the product boundary. Do not keep polluted DOM to avoid breaking the current feature.

## Target Architecture

```txt
Editor Target Shell
  selection, refs, inspector registration, temporary affordance UI

Product DOM/CSS Subtree
  current working visual structure used by preview/runtime/export

Editor RAM Store
  selection, provenance, layout intent, diagnostics, layer status

Inspector
  reads RAM/emission plans/computed product DOM

Boundary Audit
  product vs editor-owned DOM/CSS classification during migration

Proof Harness
  DOM cleanliness, computed-style, and pixel verification
```

## Technical Debt Buckets

### 1. Editor Metadata In DOM

Examples:

- `data-feed-layout-mode`
- `data-feed-layout-slot`
- `data-w-mode`
- `data-h-mode`
- `data-direction`
- `data-wrap`
- text/fitter diagnostics
- provenance markers

Plan:

- Move diagnostics into an inspector registry.
- Prefer Solid refs/closures/component ids over permanent DOM ids.
- Treat any stable `data-*` hook as a temporary migration compromise.
- Make temporary attrs exist only while a visible current feature is active.

### 2. Permanent Editor Classes

Examples:

- selection flash classes
- persistent editing classes
- diagnostic classes

Plan:

- Move selection and flash affordances out of product DOM.
- Use DOM classes only for active temporary visible states.
- Remove them immediately after the effect ends.

### 3. Editor Layer DOM

Examples:

- material feature spans that exist for authoring convenience
- wrappers that carry diagnostics
- text fitter wrappers when not required by runtime/export

Plan:

- Audit layer DOM before moving or removing it.
- Keep active visual layer DOM in the first truthful export if it changes pixels.
- Remove only editor-only layer DOM, inactive/no-op layers, or layers proven equivalent by deletion proof.
- If a diagnostic needs layer information, read it from the emission plan/RAM store.

### 4. Main Material Screen Size

`MainMaterialPreviewScreen.tsx` owns too much:

- editor state
- feed model
- render adapters
- export planning context
- inspector rendering
- DOM auditing
- interaction resolver

Plan:

- Extract export planner. Started with `components/screens/main-material/mainMaterialExportPlanner.ts`.
- Extract proof harness.
- Extract editor RAM/inspector registry.
- Extract DOM/CSS audit renderers.
- Extract feed render adapters.

### 5. Export Is Not Yet Render-Proved

The inspector shows export DOM/CSS, but that does not prove it renders correctly or that the live preview is using the same DOM/CSS.

Plan:

- Add Render Proof tab.
- Mount exact export HTML/CSS.
- Mount Solid runtime render.
- Compare against live preview product render.
- Fail when live preview has permanent editor-only DOM/CSS.
- Add pixel diff and failure classification.

## Refactor Phases

### Phase 1: Codify Rules

Status: started.

- Add `docs/material-preview-emission-rules.md`.
- Treat these rules as acceptance criteria for future editor cleanup.

### Phase 2: Keep Live Editor Stable

Do not alter authored CTA recipe values while moving the live CTA preview onto product DOM/CSS.

Rules:

- Do not tune material sliders.
- Do not tune recipe font/rem/pixel values.
- Do not patch export proof by changing authored recipe values.
- Any visual mismatch is a preview/emitter/proof/runtime bug until proven otherwise.

### Phase 3: Build Inspector Registry

Create a registry keyed by target id:

```ts
interface MaterialInspectorEntry {
  targetId: string;
  element?: HTMLElement;
  role: string;
  layout?: unknown;
  activeLayers?: unknown;
  text?: unknown;
  provenance?: unknown;
}
```

Move diagnostics out of DOM into RAM in this order:

1. layout mode and sizing mode
2. direction/wrap
3. text/fitter status
4. active material layers
5. recipe/control provenance

### Phase 4: Remove Permanent Editor Affordance DOM

Remove permanent editor-only affordances from component DOM. Add temporary visible affordances only for current, real features.

Allowed first-pass affordances:

- selected outline
- flash pulse

Acceptance:

- selected target can be highlighted without adding classes to product DOM
- flash class does not persist on material elements
- no speculative editor affordance nodes exist unless a current feature actually uses them

### Phase 5: Render Proof During Live Replacement

For CTA, the prototype is truthful export from the live product subtree. Do not replace the live visual renderer until product-subtree export proves parity.

- proof tab exists
- rest/hover/pressed comparison passes
- text/fitter behavior is verified
- no authored recipe values were changed to pass proof
- no permanent editor-only DOM/CSS remains in export
- no permanent editor-only DOM/CSS remains inside the preview product subtree

CTA should be the first family.

### Phase 6: Family-By-Family Cleanup

Order:

1. CTA button
2. Toolbar buttons
3. Nav tabs
4. Wallet chips
5. Profile button
6. Feed panels/cards

For each family:

- add export planner
- add Solid runtime renderer
- add proof harness cases
- move diagnostics to RAM
- remove unnecessary DOM attrs/classes
- keep editor visuals stable

## Acceptance Criteria

A component family is considered editor-debt-clean only when:

- live editor visuals remain stable without authored value tuning
- export/runtime DOM/CSS is derived from the same visual structure as preview
- Solid runtime render is generated from same plan
- proof harness passes or reports actionable failures
- diagnostics no longer require extra DOM attrs/classes
- temporary editor effects are removed after use
- no permanent editor-only attrs/classes/nodes appear in preview/export/runtime

## First Concrete Slice

Use CTA as the prototype for truthful product-subtree export:

1. Add Render Proof tab for CTA.
2. Identify the CTA product subtree and wrap it with an editor shell.
3. Move CTA editor diagnostics into RAM.
4. Export the product subtree directly, excluding the editor shell.
5. Mount exact export HTML/CSS.
6. Compare preview/export/runtime.
7. Use proof output to fix boundary/shell/export/runtime bugs.
