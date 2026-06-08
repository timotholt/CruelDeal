# Editor Architecture Convergence Checkpoint

Last Updated: 2026-06-07
Status: active

## Goal

Create a clear, restartable editor architecture where validated schema and field
metadata drive controls, authoring JSON compiles into runtime contracts, and
components consume those contracts through product renderers without editor-only
leakage.

## Operating Rules

- Treat the Antigravity reflection/rich-text/icon work as an active parallel
  lane. Do not clean it up or rewrite it unless explicitly asked.
- Keep refactors outside `MaterialRichText`, reflection CSS, and new icon
  systems unless integrating them is the point of the task.
- Prefer pure contract extractions from `/material-main` before visual rewrites.
- Every slice needs a focused proof and should preserve `npm run build`.
- The product path remains:

```txt
authoring JSON
  -> validation/sanitization
  -> compiler/resolver
  -> SurfaceOptions + sparse state overlays
  -> MaterialSurfaceHost / UiNode / game UI component
  -> product CSS emitter
```

## Completed In This Lane

- [x] Extracted main-material target id formats and feed target parsing into
  `components/screens/main-material/materialTargetIds.ts`.
- [x] Reused the shared target-id parser from `mainMaterialExportPlanner.ts` so
  preview/export do not duplicate feed target parsing.
- [x] Added `materialTargetIds.test.ts`.
- [x] Extracted preview interaction roles, allowed states, state coercion, and
  live hover/press/focus resolution into
  `components/screens/main-material/mainMaterialInteractionModel.ts`.
- [x] Added `mainMaterialInteractionModel.test.ts`.
- [x] Extracted selected workbench target resolution and selection overlay class
  generation into `components/screens/main-material/mainMaterialSelectionModel.ts`.
- [x] Added `mainMaterialSelectionModel.test.ts`.
- [x] Extracted main-material storage keys, localStorage read/write/remove
  helpers, persisted export payload shape, and legacy feed-target coercion into
  `components/screens/main-material/mainMaterialPersistence.ts`.
- [x] Reused the same persisted payload helper for localStorage saves and
  clipboard JSON export.
- [x] Reused the same feed-target coercion helper for localStorage load and JSON
  import.
- [x] Added `mainMaterialPersistence.test.ts`.
- [x] Extracted generic target-tree flatten/find/update helpers into
  `components/screens/main-material/mainMaterialTargetTree.ts`.
- [x] Reused target-tree helpers for feed node lookup, feed node updates, and
  flattened feed material target lists.
- [x] Added `mainMaterialTargetTree.test.ts`.
- [x] Extracted feed material target construction into
  `components/screens/main-material/mainMaterialFeedTargets.ts`.
- [x] Reused the feed target factory from `/material-main` while keeping
  screen-specific feed recipe/capability rules passed as callbacks.
- [x] Added `mainMaterialFeedTargets.test.ts`.
- [x] Extracted DOM registry instance-id, register/unregister, live-entry
  filtering, and fuzzy feed-node matching into
  `components/screens/main-material/mainMaterialDomRegistry.ts`.
- [x] Reused the DOM registry module from `/material-main` so editor shell DOM
  tracking no longer owns a private map/counter inside the screen.
- [x] Added `mainMaterialDomRegistry.test.ts`.
- [x] Extracted DOM audit token provenance, style parsing, DOM serialization,
  export-plan serialization, HTML serialization, and metrics into
  `components/screens/main-material/mainMaterialDomAudit.ts`.
- [x] Reused the DOM audit module from `/material-main`; browser stylesheet
  rule collection remains injected by the screen shell.
- [x] Added `mainMaterialDomAudit.test.ts`.
- [x] Added generated-editor capability support for disabled fields/groups so
  visibility and editability are separate contracts.
- [x] Added select option labels to surface field metadata and used them from
  `SurfaceFieldControl`.
- [x] Moved `MaterialRecipeEditor` edge-wear controls from a bespoke section to
  `SurfaceGeneratedEditor`, with edge-wear dependent controls disabled when the
  texture is `None`.
- [x] Moved `MaterialRecipeEditor` blur controls from a bespoke section to
  `SurfaceGeneratedEditor`, with blur amount disabled when blur is off.
- [x] Tightened blur field metadata to express the editor control range
  `0..24` by `0.25` while leaving runtime validation broader.
- [x] Added neutral editor output-mode registry in
  `components/ui/editor-output/editorOutputRegistry.ts`.
- [x] Registered first-class JSON output modes for `SurfaceOptions`,
  `surfaceStates`, `MaterialRecipe`, `UiNodePayload`, `GameUiTheme`,
  `GameCmsContent`, and `GameUiPlacements`.
- [x] Centralized output-mode validation/serialization through
  `validateEditorOutput()` and `serializeEditorOutput()` so future editor save
  targets do not need ad hoc validator branching.
- [x] Routed `UiMaterialLabScreen` recipe JSON readout/copy through the
  `material-recipe` editor output mode instead of raw preview-props
  `JSON.stringify`.
- [x] Added `components/screens/materialLabJsonReadout.ts` as the tested seam
  between screen orchestration and editor-output serialization.
- [x] Routed `GameUiSkinProofScreen` runtime JSON panes through registered
  editor-output modes via `components/screens/gameUiSkinProofJsonReadout.ts`.
- [x] Routed `UiNodePreviewScreen` template JSON through the registered
  `ui-node` output mode via `components/screens/uiNodePreviewJsonReadout.ts`;
  its local demo CMS/theme panes remain explicit legacy JSON readouts until
  they have first-class output schemas.
- [x] Started the next `/material-main` decomposition slice by extracting feed
  story document defaults, `FeedCardTypeId`/`FeedStory` contracts, story
  cloning, story sanitization, and story image override sanitization into
  `components/screens/main-material/mainMaterialFeedModel.ts`.
- [x] Updated `/material-main` localStorage load and JSON import paths to use
  the extracted feed story sanitizer with the active feed card type registry.
- [x] Continued feed model extraction by moving feed text slot ids/labels,
  inherited-weight slot policy, media fade modes/labels, and the feed
  background image recipe contract into
  `components/screens/main-material/mainMaterialFeedModel.ts`.
- [x] Moved feed background image default construction and sanitization into
  `mainMaterialFeedModel.ts`, so card-type persistence fallback logic no longer
  owns that document contract inside `/material-main`.
- [x] Moved feed text slot style contract, default construction, cloning, and
  sanitization into `mainMaterialFeedModel.ts`, including font/tone/style
  validation through the same material-lab token rules.
- [x] Moved feed node contracts, card-type container contracts, feed node layout
  defaults, node construction/cloning, and node layout sanitization into
  `mainMaterialFeedModel.ts`, so the editable feed tree shape is no longer
  private to `MainMaterialPreviewScreen.tsx`.
- [x] Moved feed card-type cloning and card-type/node sanitization into
  `mainMaterialFeedModel.ts`, with defaults and fallback surface passed in by
  callers for compatibility.
- [x] Moved feed region/glass/CTA surface factories into
  `mainMaterialFeedModel.ts`; CTA interaction overlays are now private model
  construction instead of screen-owned helper state.
- [x] Moved feed slot-map construction into `mainMaterialFeedModel.ts` via
  `createFeedSlots()`, so default card-type construction no longer reaches into
  screen-owned slot id/inherited-weight policy.
- [x] Moved reusable hero/simple feed node factory shapes into
  `mainMaterialFeedModel.ts` with tests.
- [x] Moved mission briefing feed surface factories and
  `createMissionBriefingLeftNodes()` into `mainMaterialFeedModel.ts`, with tests
  covering mission card/panel/text/CTA surfaces and the left-side mission node
  tree.
- [x] Moved `createDefaultFeedCardTypes()` and its three model-owned default
  card factories into `mainMaterialFeedModel.ts`. `/material-main` now consumes
  feed card defaults from the model layer instead of owning the 7k-line default
  card literal locally.
- [x] Moved feed text/render policy into
  `components/screens/main-material/mainMaterialFeedText.ts`. The extracted
  contract now owns text style inheritance, local node text overrides, rich-text
  token parsing, markup/fit render-mode resolution, feed story text lookup,
  feed media CSS helpers, and material recipe text projection.
- [x] Moved feed authoring controls into
  `components/screens/main-material/mainMaterialFeedEditors.tsx`.
  `FeedRecipeEditor` and `FeedTextGlobalsEditor` now consume the extracted feed
  model/text/layout contracts through explicit props while
  `MainMaterialPreviewScreen.tsx` keeps state ownership and persistence.
- [x] Extracted shared `/material-main` editor primitives into
  `components/screens/main-material/mainMaterialEditorPrimitives.tsx`, so the
  screen shell and extracted feed editors use the same `Slider` and `MiniButton`
  controls without duplicating local editor chrome.
- [x] Started feed preview renderer extraction by moving frame registration into
  `components/screens/main-material/mainMaterialFeedFrame.tsx`. The screen now
  owns the DOM registry instance and passes only a small registration API through
  `MainMaterialDomRegistrationProvider`; `FeedNodeFrame` and
  `MaterialDomRegistryTarget` no longer live in the giant screen.
- [x] Moved the Solid rich-text renderer wrapper into
  `components/screens/main-material/mainMaterialFeedRichText.tsx`, so
  `MainMaterialPreviewScreen.tsx` no longer imports rich-text token/parser
  internals from the text contract.
- [x] Moved chrome feed-node rendering into
  `components/screens/main-material/mainMaterialChromeFeedTree.tsx`. The
  screen now supplies chrome render context callbacks, while the product
  renderer owns recursive chrome node composition.
- [x] Moved feed card tree, slide frame, dots, track slide, and carousel
  rendering into `components/screens/main-material/mainMaterialFeedCarousel.tsx`.
  `MainMaterialPreviewScreen.tsx` now injects material surface/button adapter
  functions instead of importing feed text/media/render helpers for the live
  carousel subtree.
- [x] Moved the phone preview controller into
  `components/screens/main-material/mainMaterialPreview.tsx`. The screen now
  passes preview state, selection callbacks, and material adapter functions,
  while the extracted module owns chrome node factories, target-id helpers, and
  the composed product preview.
- [x] Centralized `/material-main` persisted preview JSON parsing and
  serialization in `components/screens/main-material/mainMaterialPersistence.ts`.
  LocalStorage save/load and clipboard import/export now share the same
  stored-state parser/serializer instead of the screen doing ad hoc JSON work.
- [x] Extracted the emission inspector view into
  `components/screens/main-material/mainMaterialEmissionInspector.tsx`. The
  screen still owns live DOM registry refresh/copy orchestration, while the
  extracted module owns inspector tabs, DOM tree rendering, export CSS audit
  rendering, metrics display, and frame-CSS row display.
- [x] Extracted selected emission export output shaping into
  `components/screens/main-material/mainMaterialEmissionOutput.ts`. The screen
  now consumes a tested snapshot contract for export plan, export DOM audit
  node, HTML, CSS, metrics, active copy payloads, and inspector tab status text
  instead of deriving those pieces inline.
- [x] Extracted live emission inspector controller helpers into
  `components/screens/main-material/mainMaterialEmissionController.ts`. The
  screen still owns Solid signals, but DOM audit refresh, retry queuing, hidden
  class toggling, and drag bounds are now tested controller behavior.
- [x] Extracted `/material-main` preview-state compatibility import/export into
  `components/screens/main-material/mainMaterialPreviewStateAdapter.ts`. The
  screen now routes localStorage save/load and clipboard import/export through a
  named editor preview-state document adapter, including tested story/card
  target fallback rules.
- [x] Extracted `/material-main` material preset state mechanics into
  `components/screens/main-material/mainMaterialPresetModel.ts`. Empty preset
  maps, selected preset ids, dirty flags, preset sanitization, add/update/delete
  mutations, and clone-on-save rules are now tested model behavior instead of
  screen-owned state manipulation.
- [x] Extracted `/material-main` part surface/reset mapping into
  `components/screens/main-material/mainMaterialPartStateModel.ts`. The screen
  now uses a tested part-to-surface-key contract and reset plan for selected
  reset/all reset behavior instead of keeping those mappings as branch ladders.

## Verification Evidence

- PASS `npx tsx components/screens/main-material/materialTargetIds.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialInteractionModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialSelectionModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPersistence.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialTargetTree.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialDomRegistry.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialDomAudit.test.ts`
- PASS `npx tsx components/ui/material-lab/surfaceEditorFilters.test.ts`
- PASS `npx tsx components/ui/material-lab/surfaceFieldMetadata.test.ts`
- PASS `npx tsx components/ui/editor-output/editorOutputRegistry.test.ts`
- PASS `npx tsx components/screens/materialLabJsonReadout.test.ts`
- PASS `npx tsx components/screens/gameUiSkinProofJsonReadout.test.ts`
- PASS `npx tsx components/screens/uiNodePreviewJsonReadout.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedText.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionController.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionOutput.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPreviewStateAdapter.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPresetModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPartStateModel.test.ts`
- PASS `npx tsx components/ui/material-lab/MaterialRecipeValidate.test.ts`
- PASS `npx tsx components/ui/material-lab/surfaceFeatures.test.ts`
- PASS `npx tsx components/ui/game-ui/gameUiSchema.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPersistence.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialTargetTree.test.ts`
- PASS `npm run build`

## Current Architecture State

- Game UI theme/CMS/placement JSON proof is closed through
  `docs/agent-checkpoints/game-ui-skinning-cms.md`.
- Surface runtime, sparse state vars, typed host, field metadata, generated
  editor scaffolding, material recipe compiler modules, and editor output-mode
  registry exist.
- `/material-main` is still too large, but its feed model, text/render policy,
  authoring controls, frame registration, rich text, chrome renderer, feed
  carousel renderer, phone preview controller, persisted preview JSON
  parser/serializer, emission inspector view, and selected emission export
  output/controller contracts, preview-state compatibility adapter, and material
  preset/part-state models are now extracted from the giant screen.

## Next Bottleneck

Continue decomposing `/material-main` around pure editor/runtime contracts. The
next blocker family is that top-level state orchestration still lives inside
`MainMaterialPreviewScreen.tsx`, so the screen remains responsible for state
application decisions even though the
feed model, sanitization, targets, DOM audit, text/render policy, feed authoring
controls, frame registration, rich-text rendering, chrome renderer, carousel
renderer, phone preview controller, persisted JSON parser/serializer, and
emission inspector view/output/controller, preview-state compatibility, and
material preset/part reset state now have extracted contracts.

Recommended finish plan, in order:

1. Extract feed preview renderer.
   `FeedNodeFrame`, rich text, `ChromeFeedNodeTree`, `FeedCarousel`, and
   `MainMaterialPreview` are now extracted. DOM registry/audit injection remains
   explicit so current inspector behavior survives.
2. Extract the top-level controller last into a
   `createMainMaterialEditorController` orchestration helper. At that point the
   screen should mostly compose workbench, editor, preview, and inspector.
3. Continue `MaterialRecipeEditor` generated-control migration in this order:
   Base Color -> Tint -> Gradient -> Glass -> Texture -> Border -> Shape ->
   Edge Emission state -> State Glow -> State Text -> State Surface. Keep state
   selector/presets as bespoke editor chrome. Add metadata/capabilities for
   tone/texture/border/font options, dependency disables, array toggles, and a
   separate state-overlay metadata adapter rather than forcing overlay-only
   authoring fields into `SurfaceOptions` metadata.

## Known Dirty Parallel Work

The following files may be modified by the active reflection/icon lane and should
not be reverted by this architecture lane:

- `components/screens/IconsPreviewScreen.tsx`
- `components/ui/KitCoinIcon.tsx`
- `components/ui/KanIcon.tsx`
- `components/ui/MotionReflex.tsx`
- `components/ui/material-node/MaterialRichText.tsx`
- `index.css`
