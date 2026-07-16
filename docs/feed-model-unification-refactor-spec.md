# Feed Model Unification Refactor Spec

Status: superseded as a governing refactor on 2026-07-15
Authorities: `docs/semantic-ui-authoring-compiler-spec.md` and
`docs/mission-briefing-v2-vertical-slice-spec.md`

> The duplicate-model evidence remains useful. Do not collapse the Feed model
> into another universal generic node contract as an independent milestone.
> Migrate only the bounded `card_type_04` edge needed by the Mission Briefing
> vertical slice, into semantic components and appearance graphs.

Date: 2026-06-09
Historical parent: `docs/first-class-surface-architecture-spec.md`
Related: `docs/main-material-editor-architecture-handoff.md`, `docs/agent-checkpoints/editor-architecture-convergence.md`
Supersedes (on completion): `docs/feed-card-type-system-spec.md`

## Problem

The `/main-material` editor maintains a **third, private node-tree model** that is a fork of
the canonical material system. Three "node tree" abstractions exist for one job:

1. **Canonical wire contract** — `UiNodePayload` (`components/ui/material-lab/uiNodeValidate.ts`),
   validated by valibot, serialized by the editor-output registry.
2. **Canonical runtime tree** — `MaterialNodeRecipe` (`components/ui/material-node/MaterialNodeTypes.ts`)
   with renderer, traversal, targets, templates, rich text, emboss.
3. **The fork** — `FeedCardNode` & family in `components/screens/main-material/mainMaterialFeedModel.ts`
   (8,068 lines), with its own parallel of every one of those concerns, sharing only the leaf
   `MaterialRecipe` paint primitive.

### Evidence this is the root, not a symptom

- ~7,028 of the 8,068 lines in `mainMaterialFeedModel.ts` are **three hand-written default-data
  literals** (`createDefaultMissionBriefingV1CardType` 743–2922, `createDefaultPatchNotesCardType`
  2922–5351, `createDefaultCommunityCardType` 5351–7780). Verified **100% pure literal** — zero
  factory calls, spreads, or const references inside the returned objects.
- ~12 files exist mainly to **translate** Feed ⇄ `ui-node-content` or to **scrape the live DOM**
  to recover authoring/export state the unified model would already hold in memory.
- The last month of convergence commits are hand-built bridges between the Feed model and
  `UiNodePayload` (`mainMaterialFeedContentOutput`, emission output, export planner, dom audit…).

## Goal (north star)

Make the editor's working model **be** the canonical node contract:

```txt
validated authoring schema (UiNodePayload / MaterialNodeRecipe)
  -> editor controls
  -> authoring JSON  (== ui-node-content, no translation)
  -> runtime/export contracts (serializeEditorOutput)
  -> product renderers (MaterialNodeRenderer)
```

When done: `FeedCardNode` family deleted, the translation/scrape apparatus collapses, and the
default data lives as data, not code.

## Findings (4 verified investigations)

### A. Field mapping — Feed is a *superset fork*, mostly mechanical to collapse

The Feed tree maps onto `MaterialNodeRecipe`/`MaterialRecipe` field-for-field. Status of each axis:

- **SAME / RENAME (mechanical):** `id`, `label`, `type→kind`, `surface` (identical `MaterialRecipe`),
  `children`, `fitMode`, `maxLines`, most of `FeedTextSlotStyle`'s value fields
  (`contentTone`, `fontWeight`, `fontStyle`, `textTransform`, `letterSpacing`, `textAlign`,
  `textX`, `textY`, `textFontFamily`, `textSizeRem`), and all of `FeedStory` (flat fields →
  `UiNodeContentPayload` bag).
- **The `overrideX` boolean matrix dissolves into existing `'inherit'` sentinels.** Canonical
  `MaterialRecipe` content-override layer already expresses per-field inheritance with `'inherit'`
  (verified: `contentTone`, `contentEmboss: boolean | 'inherit'`, `fontWeight`, `fontStyle`,
  `textTransform`; `letterSpacing: number | null`). The 14 `overrideColor/Font/Weight/...` booleans
  become "is the field `'inherit'`?".

### B. Genuine GAPs requiring canonical extension (the real work)

| Gap | Home | Action |
|---|---|---|
| `lineHeight`, `paragraphGap` | `MaterialNodeContent` | extend (additive) |
| emboss richness (`textEmbossMode` dark/light/shadow + strength/offset/blur) | promote `MaterialRecipe.textEmboss` bool → config, or route via GameTextV2 emboss path | extend |
| inherit sentinels for `textSizeRem`/`textAlign`/`textX`/`textY` | content-override layer | extend |
| `markup`+`sizing` 3-field mess | already covered by `MaterialTextRenderMode` (`raw/rich/fit/rich-fit`); add missing `rich-fit` to `MaterialNodeTextRenderMode` | collapse + drop `auto` |
| layout extras (`slot`, `reverse`, `wrap`, `pushToEnd`, vertical size-mode, `distribute:evenly`, Figma `constraintH/V`) | extend `MaterialNodeLayout` or bake to concrete `position`/`display` at migrate time | extend/bake |
| background fade/fit/pan (`FeedBackgroundImageRecipe`) | model as a media/overlay child node | migrate/extend |

Per-type migration risk: `FeedStory` LOW; `FeedCardNode`/`FeedCardTypeRecipe` MED; `FeedNodeLayout`,
`FeedTextSlotStyle`, `FeedBackgroundImageRecipe` HIGH.

### C. Apparatus disposition

| Verdict | Files | LOC |
|---|---|---|
| DELETE | `mainMaterialFeedContentOutput`, `mainMaterialExportPlanner`, `mainMaterialCompatibilityExport`, `mainMaterialCssProbeTargets`, dead half of `mainMaterialWorkbenchExportTargets` | ~430 src (+~250 test) |
| THIN | `mainMaterialEmissionOutput`, `mainMaterialDomAudit` (plan-conversion half) | ~50–70 dissolve |
| KEEP (live-DOM inspector, model-agnostic) | `mainMaterialEmissionController`, `mainMaterialEmissionInspector`, `mainMaterialDomRegistry`, `mainMaterialDomExportGroup`, `mainMaterialExportGroups` | — |

`editorOutputRegistry` already provides `serializeEditorOutput('ui-node-content', …)` /
`validateEditorOutput(…)` and full `ui-node` tree validation — the bespoke Feed serialize/validate
paths are redundant.

**Sequencing:** delete-FIRST (no live dep) = planner, compatibility-export, workbench-targets half.
delete-LAST (live screen imports) = `mainMaterialFeedContentOutput` (screen L138), `mainMaterialCssProbeTargets` (screen L153).

### D. Blast radius

- **12 non-test consumers**, all under `components/screens/` + `.../main-material/`. None in
  `services/`, `hooks/`, `contexts/`, `App.tsx`, `router.tsx`.
- **10 test files** reference Feed types (5 high-churn: feedModel, feedText, nodeTreeOperations,
  feedContentOutput, feedNodeLayoutCss).
- **Persistence shim REQUIRED.** localStorage key `cruel-deal.main-material-preview.v23`
  (`mainMaterialPersistence.ts:8`) stores `feedStories`/`feedCardTypes`/`feedStoryImageOverrides`
  in legacy shape, rehydrated through model sanitizers at two sites (hydrate ~L2535, JSON import
  ~L2901). Migrating types must bump key to `…v24` with an upconvert, or make new sanitizers
  accept-and-upconvert the legacy shape. Both load sites go through the shim.
- **Zero protected-lane overlap.** No Feed consumer is a reflection/icon-lane file. Migration is
  disjoint from that lane.
- Highest-risk consumers: `MainMaterialPreviewScreen.tsx` (orchestrator + shim home),
  `mainMaterialFeedEditors.tsx` (70KB editor), `mainMaterialFeedText.ts` (render/CSS helper).

## Phased plan (sequential — each phase gated on green tests + `npm run build`)

**Phase 0 — Data extraction (SAFE, isolated, no type change).** Move the three pure-literal
default card-types into JSON assets; replace each function with a 1-line `clone(json)` wrapper.
8,068 → ~1,050 lines. Zero behavior change. *This is the only phase safe to run now and is the
first agent task.*

**Phase 1 — Extend canonical types (additive only).** Add the gap fields from §B to
`MaterialNodeContent` / `MaterialNodeLayout` / `MaterialNodeTextRenderMode` and the content-override
inherit sentinels. Pure additions, no consumer touched, existing tests stay green. Add tests for
each new field's validate/compile.

**Phase 2 — Convert the model.** Re-express `FeedCardTypeRecipe`/`FeedCardNode` as thin adapters
over `MaterialNodeRecipe` (de-normalize the `slots` side-table onto each node's `surface`). Keep
the Feed type names as aliases initially to avoid a big-bang consumer edit.

**Phase 3 — Migrate consumers** (12 files) off Feed-specific factories onto canonical ones, one
file per slice, renderer-first then editor.

**Phase 4 — Delete apparatus** in the verified order (§C sequencing). Pull each module + its test
together to keep the documented test list and build green.

**Phase 5 — Persistence shim + key bump** (`v23→v24` upconvert at both load sites), then remove
Feed type aliases.

Phases 1–5 are **sequential by data dependency** and all converge on the same two god-files
(`mainMaterialFeedModel.ts`, `MainMaterialPreviewScreen.tsx`). They are NOT parallelizable across
agents without conflicts — they proceed as the repo's established one-slice-one-proof cadence.

## Agent strategy

- **Investigation (done):** 4 read-only agents produced §A–D; all claims code-verified.
- **Phase 0 (now):** **1 implementation agent**, isolated worktree, mechanical + fully testable.
- **Phases 1–5 (later):** single-lane sequential slices, not a swarm. Parallelism buys nothing
  here (shared god-files, linear data dependency) and costs merge conflicts + risks the protected
  reflection lane.

Decision: **do not spawn a swarm for the type migration.** The honest, conflict-free, high-value
spawn today is Phase 0.

## Test methodology

Every slice must pass, in order:

1. **Targeted unit:** `npx tsx <changed-module>.test.ts` for each touched module.
2. **Lane regression:** the full main-material lane suite (the handoff's list) stays green.
3. **Round-trip proof (new, per phase):** a test that serializes the default card-types →
   `ui-node-content` → parse → deep-equal, proving no data loss across the model change. For Phase 0:
   `clone(json)` deep-equals the previous function output (snapshot equality).
4. **Build:** `npm run build` must pass.
5. **Browser smoke** (`http://localhost:3000/main-material`): no `CRITICAL ERROR`; ≥60 material
   targets mount; Structure controls render; Export DOM/CSS + CMS panel functional.
6. **Diff hygiene:** no protected-lane file (`IconsPreviewScreen`, `KitCoinIcon`, `KanIcon`,
   `MotionReflex`, `material-node/MaterialRichText`, `index.css`) modified.

A phase is "done" only when 1–6 all pass and the convergence checkpoint is updated.

## Risks

- **Persistence break** — biggest hazard; mandatory shim (Phase 5 / earlier if types alias).
- **Layout/emboss fidelity loss** — the HIGH-risk gaps; Phase 1 must land the extensions before
  Phase 2 or visual regressions appear.
- **God-file churn** — keep slices small; never break `npm run build`.

## Deprecated by this work

- `docs/feed-card-type-system-spec.md` → supersede on completion (documents the model being removed).
- Already moved to `_deprecated/` this session: `ui-template-cms-content-contract.md` (self-declared
  superseded), `material-preview-generic-interactions-plan.md`, `material-render-proof-verification-plan.md`
  (deliverables marked complete in the convergence checkpoint).
