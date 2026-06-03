# Material Editor Technical Debt Plan

Status: active
Date: 2026-06-03

## Goal

Reduce editor DOM/CSS pollution while preserving editor usefulness, export correctness, and the path to server-driven SolidJS runtime UI.

This plan follows:

```txt
Render the product. Store the editor. Overlay the tools. Export what renders.
```

See also:

- `docs/material-preview-emission-rules.md`
- `docs/minimal-material-emission-pipeline-spec.md`
- `docs/material-render-proof-verification-plan.md`
- `docs/solidjs-server-driven-ui-skins-migration-plan.md`

## Current Problem

The editor preview DOM currently stores too much information directly in DOM attributes, class stacks, layer spans, and CSS variables.

The CTA export path is smaller, but the live editor still renders a heavier editor-specific material primitive. That is acceptable temporarily, but it creates verification risk unless export/runtime are separately render-proved.

## Target Architecture

```txt
Product Render DOM
  minimal runtime-like render surface

Inspector Registry
  rich editor diagnostics keyed by target id / element ref

Overlay Layer
  selection outlines, flashes, handles, probes, deletion proof

Emission Planner
  editor/runtime/export/proof output plans

Proof Harness
  visual and computed-style verification
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
- Keep only a stable target hook in DOM where needed.
- Make temporary probe attrs exist only while a probe is active.

### 2. Permanent Editor Classes

Examples:

- selection flash classes
- persistent editing classes
- diagnostic classes

Plan:

- Move selection and flash affordances to overlay-first rendering.
- Use DOM classes only for active temporary states.
- Remove them immediately after the effect ends.

### 3. Editor Layer DOM

Examples:

- material feature spans that exist for authoring convenience
- wrappers that carry diagnostics
- text fitter wrappers when not required by runtime/export

Plan:

- Keep editor layer DOM only where it is needed for editor rendering.
- For migrated families, prefer product-like DOM plus overlay/registry diagnostics.
- Do not replace editor rendering until render proof passes.

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
- Extract inspector registry.
- Extract DOM/CSS audit renderers.
- Extract feed render adapters.

### 5. Export Is Not Yet Render-Proved

The inspector shows export DOM/CSS, but that does not prove it renders correctly.

Plan:

- Add Render Proof tab.
- Mount exact export HTML/CSS.
- Mount Solid runtime render.
- Compare against editor render.
- Add pixel diff and failure classification.

## Refactor Phases

### Phase 1: Codify Rules

Status: started.

- Add `docs/material-preview-emission-rules.md`.
- Treat these rules as acceptance criteria for future editor cleanup.

### Phase 2: Keep Live Editor Stable

Do not alter authored CTA visuals or interaction behavior while building exporter/proof infrastructure.

Rules:

- Do not tune material sliders.
- Do not tune recipe font/rem/pixel values.
- Do not patch export proof by changing authored recipe values.
- Any visual mismatch is an emitter/proof/runtime bug until proven otherwise.

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

Move diagnostics out of DOM into the registry in this order:

1. layout mode and sizing mode
2. direction/wrap
3. text/fitter status
4. active material layers
5. recipe/control provenance

### Phase 4: Overlay-First Selection

Move selection visuals away from component DOM.

Overlay should support:

- selected outline
- flash pulse
- hover target
- drag handles
- deletion proof markers
- measurement labels

Acceptance:

- selected target can be highlighted without adding classes to product DOM
- flash class does not persist on material elements

### Phase 5: Render Proof Before Live Replacement

Before replacing any live editor render with export/runtime-like render:

- proof tab exists
- rest/hover/pressed comparison passes
- text/fitter behavior is verified
- no authored recipe values were changed to pass proof

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
- move diagnostics to registry
- remove unnecessary DOM attrs/classes
- keep editor visuals stable

## Acceptance Criteria

A component family is considered editor-debt-clean only when:

- live editor visuals remain stable
- export DOM/CSS is generated from emission plan
- Solid runtime render is generated from same plan
- proof harness passes or reports actionable failures
- diagnostics no longer require extra DOM attrs/classes
- temporary editor effects are removed after use
- no editor-only attrs/classes appear in export/runtime

## First Concrete Slice

Do not swap CTA live render yet.

Build proof infrastructure first:

1. Add Render Proof tab for CTA.
2. Mount exact export HTML/CSS.
3. Add Solid runtime render from the same emission plan.
4. Compare both against current editor CTA.
5. Use proof output to fix emitter/runtime bugs.
6. Only then consider moving CTA live editor render closer to product DOM.
