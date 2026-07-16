# First-Class Surface Architecture Spec

Status: superseded for new implementation on 2026-07-15
Authority: `docs/semantic-ui-authoring-compiler-spec.md`

> Historical architecture only. Its surface/runtime observations may help with
> migration, but its flat surface contract is not the canonical authored model.
> Do not begin new UI authoring work from this document.

Date: 2026-06-06
Supersedes:

- `docs/material-preview-emission-rules.md`
- `docs/minimal-material-emission-pipeline-spec.md`
- `docs/material-editor-sacred-dom-refactor-plan.md`
- `docs/material-editor-technical-debt-plan.md`
- `docs/sparse-surface-state-model.md`

Related:

- `docs/surface-composition-authoring-spec.md`

## Goal

Make surfaces a first-class runtime contract with clear separation between:

```txt
Surface runtime contract
  SurfaceOptions -> classes, CSS vars, active layers, product DOM

Authoring/editor contract
  MaterialRecipe / presets / editor JSON -> SurfaceOptions + sparse surfaceStates

Editor shell
  selection, diagnostics, provenance, controls, proof UI, local persistence
```

The material editor and `/material-main` rebuild must edit authoring JSON, compile
that JSON into surfaces, and render the same product DOM/CSS that runtime/export
will use. Editor knowledge must not permanently live inside the product subtree.

## Non-Goals

- Do not rewrite all `/material-main` UI in one pass.
- Do not delete useful material visual features while refactoring boundaries.
- Do not tune authored material values to make proof pass.
- Do not make export/runtime use a separate visual structure from editor preview.
- Do not send arbitrary HTML, CSS, JavaScript, or editor-only metadata as skin/UI
  payload.

## Core Contracts

### 1. Surface Runtime Contract

`SurfaceOptions` is the only renderer-facing surface contract.

It answers:

> What does the product component need in order to draw this surface?

It owns runtime fields such as material, texture, glass, tint, gradient, border,
edge wear, shadow, text style, content tone, emissions, motion, visual state, and
state vars.

It does not own:

- editor control layout
- localStorage/preset metadata
- selection state
- diagnostics/provenance
- proof status
- screen-specific part ids
- user-facing editor labels

### 2. Authoring Contract

`MaterialRecipe` is an authoring/editor shape, not a renderer contract.

It may store:

- editor-friendly defaults
- inactive feature settings
- named presets
- grouped state controls
- future feature values
- screen-specific local tuning data

It must compile to:

```ts
interface CompiledSurface {
  surface: SurfaceOptions;
  surfaceStates?: Partial<Record<'hover' | 'active' | 'pressed', Partial<SurfaceOptions>>>;
}
```

The compiler is responsible for turning authoring conveniences, such as
`lightStrengthBoost`, into ordinary sparse state overlays, such as
`{ lightStrength: 76 }`.

### 3. Sparse State Contract

Surface states behave like normal CSS hover:

```css
.button { text-shadow: ...; }
.button:hover { filter: brightness(1.08); }
```

Rest values are the base. A state emits only what it explicitly changes.

Rules:

- `surfaceStyle()` emits live vars and stable `*-base` aliases for rest style.
- `surfaceStateStyle()` emits live vars only.
- `computeSurfaceStateVars()` diffs rest live vars against state live vars.
- state overlays never emit `*-base` aliases.
- CSS state fallbacks must point to base aliases, not the live var being defined.

Allowed:

```css
--content-shadow: var(--hover-content-shadow, var(--content-shadow-base));
```

Forbidden:

```css
--content-shadow: var(--hover-content-shadow, var(--content-shadow));
```

Identity values are valid authored overrides when they disable a generic default.
For example, `surfaceFilterBrightness: 1` can disable host brightness while
`surfaceLayerBrightness: 1.18` brightens paint layers only.

### 4. Product DOM Boundary

The product subtree is sacred.

If the game runtime would not need a node, attr, class, CSS variable, or wrapper,
it must not permanently exist inside the product subtree.

Allowed product output:

- semantic/native elements such as `button`, `section`, `a`
- runtime/accessibility attrs such as `type`, `disabled`, `href`, `aria-*`
- active visual layer nodes when they affect pixels
- classes required by active product CSS
- instance CSS vars consumed by active product CSS
- text/icon/content wrappers required for pixels, layout, behavior, accessibility,
  or runtime text fitting

Forbidden product output:

- editor registry ids
- selection/provenance attrs
- diagnostic classes
- probe/measurement nodes that runtime does not need
- hidden editor metadata
- permanent editor-only wrappers
- variables that merely mirror recipe JSON

Temporary editor affordances, such as selected outlines and flash pulses, belong
to an editor shell outside or over the product subtree and must disappear when
inactive.

## Required Module Boundaries

The surface/material lane should converge on these files:

```txt
components/ui/material-lab/surfaceSchema.ts
  SurfaceOptions and renderer-facing type vocabulary only.

components/ui/material-lab/surfaceValidate.ts
  validation for SurfaceOptions and sparse surfaceStates.

components/ui/material-lab/surfaceFeatures.ts
  feature activity, classes, layer plan, rest/state CSS var emission.

components/ui/material-lab/surfaceStateVars.ts
  sparse state overlay -> MaterialSurfaceStateVars through surfaceStateStyle().

components/ui/material-lab/Surface.tsx
  product DOM renderer for panel/button hosts.

components/ui/material-lab/MaterialRecipeTypes.ts
  pure authoring/editor recipe type declarations only.

components/ui/material-lab/MaterialRecipeDefaults.ts
  create/clone/default recipe helpers.

components/ui/material-lab/MaterialRecipeValidate.ts
  sanitize/import/backward compatibility for authoring recipes.

components/ui/material-lab/MaterialRecipeCompiler.ts
  MaterialRecipe -> SurfaceOptions + sparse surfaceStates.

components/ui/material-lab/MaterialRecipeEditor.tsx
  controls over authoring JSON; no CSS-var math.
```

`MaterialRecipeCompiler.ts` must not hand-roll CSS custom properties. It should
produce surface data, then delegate CSS var emission to the surface pipeline.

## Editor Metadata Model

Material editor knowledge lives in RAM or external shell structures:

```ts
interface MaterialEditorEntry {
  id: string;
  label: string;
  authoringRecipe: MaterialRecipe;
  compiledSurface: CompiledSurface;
  productElement?: HTMLElement;
  diagnostics: MaterialDiagnostic[];
  provenance: MaterialProvenance[];
}
```

The inspector reads this registry, compiled surface data, emission plans, and
computed product DOM. It must not depend on product-internal editor attrs to
answer ordinary editor questions.

## Editor Field Metadata

The rebuilt full-JSON material editor should use surface field metadata rather
than hand-duplicating every control.

Example:

```ts
interface SurfaceFieldDefinition<K extends keyof SurfaceOptions = keyof SurfaceOptions> {
  key: K;
  group: 'base' | 'shape' | 'texture' | 'glass' | 'lighting' | 'border' | 'edgeWear' | 'shadow' | 'content' | 'emission' | 'motion';
  label: string;
  control: 'toggle' | 'slider' | 'select' | 'color' | 'text';
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: SurfaceOptions[K];
  stateEditable?: boolean;
}
```

The same metadata should drive:

- editor controls
- JSON inspector grouping
- import/export docs
- state-edit affordances
- validation coverage checks

## `/material-main` Rebuild Boundaries

`MainMaterialPreviewScreen.tsx` must be split before the editor rewrite becomes
serious. Target modules:

```txt
components/screens/main-material/defaultSurfaces.ts
components/screens/main-material/materialSelectionModel.ts
components/screens/main-material/materialPersistence.ts
components/screens/main-material/feedSurfaceTargets.ts
components/screens/main-material/MainMaterialPreview.tsx
components/screens/main-material/MainMaterialWorkbench.tsx
components/screens/main-material/mainMaterialExportPlanner.ts
```

The screen shell coordinates state. It should not own surface compilation,
recipe sanitization, feed target traversal, localStorage serialization, export
planning, and editor rendering in one file.

## Migration Plan

### Phase 1: Compiler Extraction

- Extract `MaterialRecipeDefaults.ts`.
- Extract `MaterialRecipeValidate.ts`.
- Extract `MaterialRecipeCompiler.ts`.
- Keep public functions re-exported if needed to avoid a broad call-site churn.
- Make recipe-to-state compilation output sparse `Partial<SurfaceOptions>`
  overlays.
- Route recipe state vars through `computeSurfaceStateVars()`.

Acceptance:

- no duplicate CSS var math remains in recipe modules
- existing material visuals are unchanged
- surface/state tests pass
- recipe conversion tests prove hover text emboss, brightness, glow, emission,
  and motion state behavior

### Phase 2: Typed Surface Host

- Replace `surfaceProps?: Record<string, any>` with typed `SurfaceOptions`.
- Split button-only and panel-only host props as needed.
- Keep UI node and material-node call sites compiling.
- Use `docs/schema-driven-surface-editor-spec.md` as the detailed
  implementation contract for this phase, the metadata registry phase, and the
  generated editor bridge.

Acceptance:

- TypeScript catches unknown surface props at host boundaries.
- UI node and material preview render paths still use the same product surface.

### Phase 3: Field Metadata Registry

- Add `surfaceFieldDefinitions`.
- Cover every renderer-supported editable field.
- Mark whether each field is rest-only, state-editable, or renderer-internal.
- Add a test that every validated/editor-visible field is classified.
- Generate editor controls from `surfaceValidate.ts` plus
  `surfaceFieldMetadata.ts`; do not hand-maintain duplicate slider lists.

Acceptance:

- new fields such as `surfaceLayerBrightness` and `textY` require metadata.
- the editor can render at least one control group from metadata.

### Phase 4: `/material-main` Decomposition

- Extract defaults, persistence, selection, feed target traversal, and preview
  rendering.
- Keep visual behavior stable.
- Add focused tests for extracted pure functions.

Acceptance:

- `MainMaterialPreviewScreen.tsx` becomes an orchestration component.
- feature work no longer requires editing a massive multi-responsibility file
  for every surface change.

### Phase 5: Product Boundary And Proof

- Wrap product subtrees with editor shell UI from outside.
- Move diagnostics/provenance into RAM registries.
- Export product subtree or the same product emission plan.
- Add render proof for rest/hover/pressed/active states.

Acceptance:

- preview, runtime, and export use the same product DOM/CSS for migrated families.
- no permanent editor-only DOM/CSS exists inside the product subtree.
- proof failures identify likely boundary/emitter/runtime causes.

## Verification

Every surface architecture change should run the focused proof set:

```txt
npx tsx components/ui/material-lab/surfaceFeatures.test.ts
npx tsx components/ui/material-lab/surfaceStateVars.test.ts
npx tsx components/ui/material-lab/surfaceValidate.test.ts
npx tsx components/ui/material-lab/uiNodeValidate.test.ts
npx tsx components/ui/material-lab/MaterialEmission.test.ts
npx tsx components/ui/material-lab/uiNodePresenter.test.ts
rg --pcre2 -n "var\\(--(hover|pressed)-[^,]+, var\\(--(?![^)]*-base)" src/styles/ui-material-lab.css
npm run build
```

The `rg` command should return no matches.

## First Concrete Work Slice

Extract the recipe compiler path without changing visuals:

1. Move recipe default creation/clone helpers out of `MaterialRecipeTypes.ts`.
2. Move recipe sanitization out of `MaterialRecipeTypes.ts`.
3. Move recipe-to-surface conversion out of `MaterialRecipeTypes.ts`.
4. Replace duplicate `resolvedSurfaceStateCssVars()` logic with sparse
   `SurfaceOptions` state overlays plus `computeSurfaceStateVars()`.
5. Add tests that prove recipe hover/pressed output stays sparse and keeps base
   text emboss unless explicitly changed.
