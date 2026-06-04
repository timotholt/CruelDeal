# Surface System — Handoff (continue here)

Status: active. Date: 2026-06-04.

You are continuing a multi-session refactor of the Cruel Deal "material surface"
UI system toward **server-driven / client-driven UI**. The surface is now clean
and unified; a validated JSON node contract renders through it. Three tasks
remain, in this order: **(1) hover/pressed**, **(2) validation of the new
state fields**, **(3) skins**.

Read `~/.claude` memory `material-surface-architecture` if available, plus:
`docs/solidjs-server-driven-ui-skins-migration-plan.md` (the north star).

## Conventions (follow these)

- **Logging/faults:** `utils/logger.ts`. Use `fault(code, detail)` for
  "should not happen". It logs, then **throws in dev/CI/tests (`policy:'throw'`)**
  / **returns in prod (`policy:'continue'`)**. `configureLogging({policy,level})`,
  `ensure(cond,code,detail)`. Built on the `loglevel` dep.
- **Validation:** **valibot** (`^1.4.1`, already installed; `import * as v`).
  Pattern: strict schema for detection → `fault()` on issue → lenient
  (clamp/drop/fallback) schema for prod-continue. See `surfaceValidate.ts`.
- **Tests** are plain Node assert scripts run with `npx tsx <file>.test.ts`
  (NO jsdom; do NOT put Solid JSX in test files — esbuild won't transform it).
  Keep logic in pure modules so it's testable; keep JSX in `*.tsx` shells.
- **Verify visually** at `http://localhost:3000/ui-node` (`npm run dev`).
- **Do not tune authored recipe values to pass tests.** Behavior parity is the bar.
- Caveman comms style optional; write code/commits normally.

## What exists now (all done + tested)

Surface lives in `components/ui/material-lab/`:

| file | role |
|---|---|
| `surfaceSchema.ts` | type vocabulary + `SurfaceOptions`/`MaterialPanelProps`/`MaterialButtonProps` (pure types) |
| `surfaceTokens.ts` | color/tone tables, hex utils (`normalizeHexColor` faults on malformed hex) |
| `surfaceFeatures.ts` | flags→classes/vars pipeline, `SURFACE_DEFAULTS`, `surfaceClass`/`surfaceStyle`/`surfaceLayerEmissions`/`surfaceEmissionAttrs`, `createMaterialButtonEmissionPlan` |
| `Surface.tsx` | leaf Solid components `MaterialButton`/`MaterialPanel` (+ private `MaterialSurface`) |
| `MaterialPrimitives.tsx` | re-export barrel (preserves old import path) |
| `MaterialSurfaceHost.tsx` | `kind: 'button'|'panel'|'bare'` switch |
| `surfaceValidate.ts` | `validateSurfaceOptions(input,label)` — valibot strict/lenient, fault-wired |
| `uiNodeValidate.ts` | `UiNodePayload` type + `validateUiNode(input,label): UiNodePayload|null` (fail-closed) |
| `uiNodePresenter.ts` | pure `uiLayoutToStyle`, `surfaceKindForType` |
| `UiNode.tsx` | `UiNode` component + `renderUiNodeToSolid(node, context)` + `UiNodeRenderContext` |
| `widgets.tsx` | unrelated widgets (SectionLabel/StatBlock/SegmentedMeter) |

Tests (all green): `utils/logger`, `surfaceFeatures`, `MaterialEmission`,
`surfaceValidate`, `uiNodeValidate`, `uiNodePresenter` (`.test.ts` beside each).

Demo route: `components/screens/UiNodePreviewScreen.tsx` at `/ui-node`. Feeds a
sample `UiNodePayload` → `validateUiNode` → `renderUiNodeToSolid`. Renders real
painted surfaces; CTA click fires `onAction` with the JSON `action`.

**Gotcha — dual route registration:** preview/dev paths bypass the router +
auth in `App.tsx` via a hardcoded `<Show>` ladder, AND have a `router.tsx`
route. To add/wire such a screen you edit BOTH: `App.tsx` (add `isXPath()` to
the login-bypass `when`, add a branch in the ladder) and `router.tsx`.

## How interaction CSS already works (KEY for Task 1)

In `src/styles/ui-material-lab.css`, `.cd-surface.is-interactive`:
- `:hover` (gated `@media (hover:hover)`) and `:active` rules **already exist**.
- They read **prefixed CSS vars**: `--hover-*` and `--pressed-*` (e.g.
  `--hover-tint-alpha`, `--pressed-glow-alpha`, `--hover-state-scale`,
  `--pressed-state-translate-y`), each falling back to the rest-state var.
- **Base feedback with no overlays:** hover = `brightness(1.08)` + `scale(1)`;
  active = `translateY(1px) scale(0.985)`. So any interactive button already
  has baseline hover/press feedback for free.

`MaterialButton` sets `interactive` → adds `.is-interactive`. So a UiNode button
(`type:'button'` → `MaterialSurfaceHost kind="button"`) **already gets baseline
hover/press**. Confirm this first.

The per-recipe custom overlays (e.g. gold tint on hover, glow on press) are
delivered by populating those `--hover-*`/`--pressed-*` vars via the surface
`stateVars` field. The `state` feature in `surfaceFeatures.ts` already prefixes
`stateVars.hover`/`stateVars.pressed` into `--hover-*`/`--pressed-*`. The bridge
`materialRecipeToSurfaceStateVars` + `diffStateVars` (in `MaterialRecipeTypes.ts`)
already computes these FROM a `MaterialRecipe` with `states` overlays. The wire
`SurfaceOptions` does NOT yet carry state overlays.

## TASK 1 — hover/pressed as first-class wire behavior

Goal: a `UiNodePayload` can express per-state surface overlays, and the
interpreter produces `stateVars` so hover/pressed render correctly (not just the
baseline). Also honor `stateModel` for selectable/disclosure (toggle a
selected/active state).

Steps:
1. Verify baseline hover/press already works on `/ui-node` CTA (hover + mouse
   down in the live preview; expect brightness/scale change). Document result.
2. Extend the wire surface to carry overlays. Recommended shape on the node (NOT
   raw stateVars — that's computed): add to `UiNodePayload`:
   `surfaceStates?: { hover?: Partial<SurfaceOptions>; pressed?: Partial<SurfaceOptions>; active?: Partial<SurfaceOptions> }`.
   (Keep it `Partial<SurfaceOptions>` overlays merged over the base `surface`.)
3. Add a pure helper (new `surfaceStateVars.ts` or extend `surfaceFeatures.ts`):
   `computeSurfaceStateVars(base: SurfaceOptions, overlays): Partial<Record<state, MaterialSurfaceStateVars>>`.
   Implement by: for each state, merge `{...base, ...overlay}`, run
   `surfaceStyle(merged)`, diff against `surfaceStyle(base)` (only keep changed
   CSS vars), wrap as `{ cssVars }`. Mirror the existing `diffStateVars` logic in
   `MaterialRecipeTypes.ts` (reuse if cleanly importable).
4. In `UiNode.tsx`, when a node has `surfaceStates`, compute `stateVars` and pass
   `{ ...node.surface, stateVars }` to `MaterialSurfaceHost`. Map `stateModel`
   `selectable`/`disclosure` to a `selected`/`active` visualState as appropriate
   (track local signal on click for selectable).
5. Pure unit tests in `surfaceStateVars.test.ts`: a hover overlay changing
   `tintStrength` produces a `--hover-tint-alpha` var; unchanged fields are NOT
   emitted (diff works); empty overlay → no state vars.

Acceptance:
- `/ui-node` CTA visibly changes on hover and press (baseline + any overlay).
- Adding a `surfaceStates.hover` to the sample payload changes hover appearance.
- Pure tests green; existing tests still green; tsc clean on changed files.

## TASK 2 — validate the new state fields

Extend the valibot schemas so the new `surfaceStates` is fail-closed like the
rest.
- In `surfaceValidate.ts`: export a reusable `surfaceOptionsLenientSchema`
  (already exported). Add a `surfaceStatesSchema` = optional object with
  `hover`/`pressed`/`active` each = the lenient surface schema (overlays are
  partial; lenient already treats all fields optional).
- In `uiNodeValidate.ts`: add `surfaceStates: v.optional(surfaceStatesSchema)`
  to `uiNodeSchema` (strict structure, lenient values).
- Tests in `uiNodeValidate.test.ts` / `surfaceValidate.test.ts`: valid overlay
  passes; bad enum inside an overlay drops/clamps; unknown key in overlay strict
  path faults.

Acceptance: malformed state overlays fail closed (dev throw / prod coerce);
valid ones round-trip; tests green.

## TASK 3 — skins (server-driven plan Phase 2)

Add skin resolution so a node references a skin by id instead of inlining the
surface.
- New `skinManifest.ts`: `SkinManifest` type per
  `docs/solidjs-server-driven-ui-skins-migration-plan.md` (id, version,
  compatibility, `recipePatches: Record<string, Partial<SurfaceOptions>>`), and a
  valibot validator `validateSkinManifest` (fail-closed).
- New `skinRegistry.ts`: register built-in + downloaded skins by id; resolve
  `materialId`/`skinId` → `SurfaceOptions` with a **fallback chain**
  (requested → compatible downloaded → built-in → base recipe). Missing/invalid
  skin must not break rendering (fault + fallback).
- In `UiNode.tsx`: if `node.materialId` set and `node.surface` absent, resolve
  the skin from the registry to get the surface. Inline `surface` still wins/merges.
- Tests: resolve by id; missing id → fallback; incompatible version → fallback;
  invalid manifest → fault + safe default.

Acceptance: a node with only `materialId` renders the registered skin; unknown
skin falls back safely; manifest validation fail-closed; tests green; `/ui-node`
demo extended with one skin-by-id node.

## Verification checklist per task

```
# unit tests (run each changed/added one)
npx tsx components/ui/material-lab/<name>.test.ts
npx tsx utils/logger.test.ts
# typecheck (repo has pre-existing unrelated errors; grep YOUR files)
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "<your-files>"
# visual: npm run dev, open http://localhost:3000/ui-node
```

Do not commit unless asked; the user checks in themselves.
