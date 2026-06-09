# Editor Architecture Convergence Checkpoint

Last Updated: 2026-06-09
Status: active - live export/CMS composition convergence

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
- [x] Added live DOM audit CSS serialization, so Export CSS can be derived from
  the actual selected DOM subtree by collecting class rules and inline style
  declarations instead of requiring target-specific export code.
- [x] Added `mainMaterialDomAudit.test.ts`.
- [x] Added `components/screens/main-material/mainMaterialDomExportGroup.ts`,
  a live export-group contract that collects all `data-material-target-id`s in
  the selected DOM subtree and returns the matching DOM, CSS, and metrics as one
  payload.
- [x] Routed `/material-main` Export DOM/CSS through the live export-group
  contract first, with the emission planner retained as the unmounted fallback.
- [x] Added `mainMaterialDomExportGroup.test.ts`.
- [x] Extracted chrome/workbench export-target construction into
  `components/screens/main-material/mainMaterialWorkbenchExportTargets.ts`, so
  `/material-main` no longer owns a local ID-by-ID map for top bar, wallet,
  toolbar, and nav export fallback targets.
- [x] Added `mainMaterialWorkbenchExportTargets.test.ts`.
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
- [x] Moved `MaterialRecipeEditor` base color controls from a bespoke section
  to `SurfaceGeneratedEditor`, with `material`/`materialColor` labels and
  option names owned by `surfaceFieldMetadata.ts` and custom color disabled
  unless the material mode is `custom`.
- [x] Moved `MaterialRecipeEditor` tint controls from a bespoke section to
  `SurfaceGeneratedEditor`, with `tint` options and `Tint Power` labels owned
  by `surfaceFieldMetadata.ts` and tint strength disabled while tint is `none`.
- [x] Moved `MaterialRecipeEditor` gradient controls from a bespoke section to
  `SurfaceGeneratedEditor`, with gradient options/labels owned by
  `surfaceFieldMetadata.ts` and white/dark/sheen controls disabled according to
  the selected gradient mode.
- [x] Updated `visibleSurfaceFieldDefinitions()` so explicitly requested field
  lists preserve caller order. Generated editor sections can now stay
  schema-driven while keeping deliberate authoring order.
- [x] Moved `MaterialRecipeEditor` frosted-glass controls from a bespoke
  section to `SurfaceGeneratedEditor`, with glass/shine dependent controls
  disabled through generated-editor capabilities and old editor labels/ranges
  owned by `surfaceFieldMetadata.ts`.
- [x] Moved `MaterialRecipeEditor` texture controls from a bespoke section to
  `SurfaceGeneratedEditor`, with texture dropdown options/labels and discrete
  validated texture-scale stops owned by `surfaceFieldMetadata.ts`.
- [x] Added generated numeric slider `valueStops` support in
  `SurfaceFieldControl`, preserving stepped authoring controls while keeping
  sections metadata-driven.
- [x] Moved `MaterialRecipeEditor` border controls from a bespoke section to
  `SurfaceGeneratedEditor`, with border color options/labels, side-array
  toggles, custom-color visibility, and border-alpha dependency behavior owned
  by metadata/capabilities.
- [x] Added generated `multi-toggle` controls in `SurfaceFieldControl`, so
  array-valued authoring fields can use metadata-driven toggle groups instead
  of JSON textareas or bespoke editor JSX.
- [x] Moved `MaterialRecipeEditor` base-shape controls from a bespoke section
  to `SurfaceGeneratedEditor`, with bevel-corner multi-toggle labels and
  radius/bevel-size editor ranges owned by `surfaceFieldMetadata.ts`.
- [x] Moved `MaterialRecipeEditor` edge-emission state controls from a bespoke
  section to `SurfaceGeneratedEditor`, using a state-overlay adapter that maps
  generated `SurfaceOptions` patches back into `states[activeState()].emission`
  while preserving concrete overlay values.
- [x] Added generated-editor `inheritControls` control so state-mode sections
  can opt out of inherit buttons when the underlying overlay is not sparse.
- [x] Moved `MaterialRecipeEditor` state-glow controls from a bespoke section
  to `SurfaceGeneratedEditor`. Glow corner/edge toggles and glow tone options
  now come from surface field metadata, while a tested state-glow adapter maps
  generated `corners`/`edgeHighlight`/`glow`/`glowStrength`/`cornerSize`
  patches back into `states[activeState()].glow`.
- [x] Moved `MaterialRecipeEditor` state-text controls from a bespoke section
  to `SurfaceGeneratedEditor`. State text now uses metadata-owned tone, glow,
  emboss, font weight/style/case, and tracking controls, with a tested sparse
  adapter mapping generated field clears back into overlay `inherit`/`null`
  sentinels.
- [x] Moved `MaterialRecipeEditor` State Surface controls out of bespoke
  editor JSX and onto a small generated overlay metadata contract. The tested
  adapter preserves overlay-only fields (`borderOpacityBoost`,
  `lightStrengthBoost`, `darkStrengthBoost`) without forcing them into
  `SurfaceOptions`, while keeping `tintStrength` sparse/inheritable.
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
- [x] Added first-class editor output modes for UiNode content binding maps
  and UiNode rich-text themes (`ui-node-content`, `ui-node-theme`).
- [x] Routed all `UiNodePreviewScreen` JSON tabs through registered editor
  output modes. Template, CMS/content bindings, and rich-text theme panes now
  share the same validation/serialization path instead of falling back to raw
  `JSON.stringify`.
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
- [x] Extended `mainMaterialPartStateModel.ts` to own selected recipe lookup and
  recipe application target decisions. Preset save/apply paths now ask the model
  whether a part targets the feed child or a surface recipe key instead of
  branching through those rules in the screen.
- [x] Extended `components/screens/main-material/mainMaterialSelectionModel.ts`
  with workbench selection routing. The screen now applies a tested route object
  for feed targets, chrome child targets, and root workbench parts instead of
  owning that branch ladder inline.
- [x] Extended `mainMaterialSelectionModel.ts` with selected-part child target
  clearing rules, so `selectPart()` no longer owns top-bar/toolbar/nav clearing
  branches.
- [x] Extended `components/screens/main-material/mainMaterialInteractionModel.ts`
  with selected interaction-role, state-option, active preview-state, and
  preview-state update helpers. The screen now delegates selected preview state
  resolution instead of deriving it inline.
- [x] Extracted `/material-main` workbench part labels and workbench hierarchy
  construction into `components/screens/main-material/mainMaterialWorkbenchModel.ts`.
  Feed targets are still injected by the screen, but chrome/root workbench tree
  composition is now tested model behavior.
- [x] Added `docs/surface-composition-authoring-spec.md` to define the
  structure/layout/CMS authoring path. The spec makes two-column, reward, and
  fingerprint layouts ordinary nested node compositions rather than rich-text
  layout or special runtime primitives.
- [x] Added pure feed node tree operations in
  `components/screens/main-material/mainMaterialNodeTreeOperations.ts`.
  Insert, remove, duplicate, move, wrap, unwrap, and patch now have a tested
  result-object contract that can be wired into editor UI without crashing the
  route on invalid commands.
- [x] Added composition templates and a tangible mission-briefing test bed in
  `components/screens/main-material/mainMaterialNodeTemplates.ts`. The test bed
  proves reward/fingerprint/two-column composition is represented as normal
  `FeedCardNode` children.
- [x] Wired the first structure-authoring controls into
  `FeedRecipeEditor`. `/material-main` now exposes add-panel, add-text,
  add-two-column, add-terms-template, duplicate, wrap, and delete controls for
  feed nodes, with selection following created/duplicated/wrapped nodes.
- [x] Browser-verified `/main-material` as the live testbed: clicking `terms`
  inserted a normal nested `reward-terms-group`/two-column/fingerprint subtree
  into the visible UI tree and selected the new material target for export.
- [x] Extended structure authoring with production-oriented node operations:
  reorder up/down, unwrap container, and delete confirmation. Reorder is now
  represented by a tested pure `moveFeedNodeByOffset()` operation instead of UI
  code manipulating sibling arrays directly.
- [x] Made template insertion semantics explicit in the editor. Structure
  authoring now exposes `inside` vs `after` insertion mode, backed by a tested
  pure `insertFeedNodeAfter()` operation for sibling insertion.
- [x] Added visible structure-operation status and one-step undo to
  `FeedRecipeEditor`. Successful operations snapshot the previous feed card
  type and selected material target; failed pure operations report their reason
  in the Structure panel instead of failing silently.
- [x] Started visible CMS binding authoring in `FeedRecipeEditor`. Selected
  text/button/container nodes now show a CMS Binding select backed by
  `feedTextSlotIds`/`feedTextSlotLabels`, support rebinding to another story
  field, and support `none` to unbind.
- [x] Fixed the export-plan split where only feed targets produced Export DOM
  plans. `mainMaterialExportPlanner.ts` now accepts registered generic
  workbench export targets, and `/main-material` registers backdrop, top bar,
  profile, wallet, toolbar, nav container, nav bar, and their child button
  targets through the same `createMainMaterialEmissionExport()` path.
- [x] Added export CSS fallback generation from emission-plan host styles, so
  targets with inline surface vars still produce useful Export CSS instead of
  an empty CSS tab when no shared `cssRules` are emitted.

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
- PASS `npx tsx components/ui/material-lab/MaterialRecipeEditorStateAdapters.test.ts`
- PASS `npx tsx components/ui/editor-output/editorOutputRegistry.test.ts`
- PASS `npx tsx components/screens/materialLabJsonReadout.test.ts`
- PASS `npx tsx components/screens/gameUiSkinProofJsonReadout.test.ts`
- PASS `npx tsx components/screens/uiNodePreviewJsonReadout.test.ts`
- PASS `npx tsx components/ui/material-lab/uiNodeRichTextTheme.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedText.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionController.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionOutput.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPreviewStateAdapter.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPresetModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPartStateModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialWorkbenchModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialNodeTreeOperations.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialTargetTree.test.ts`
- PASS `npx vitest run components/screens/main-material/feedNodeLayoutCss.test.ts`
- PASS `npx tsx components/ui/material-lab/MaterialRecipeValidate.test.ts`
- PASS `npx tsx components/ui/material-lab/surfaceFeatures.test.ts`
- PASS `npx tsx components/ui/game-ui/gameUiSchema.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialPersistence.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialTargetTree.test.ts`
- PASS `npm run build`
- PASS `curl -I http://localhost:3000/main-material`
- PASS headless Chrome DOM render for `http://localhost:3000/main-material`
  rendered editor controls/preview DOM instead of the prior `CRITICAL ERROR`
  page.
- PASS headless Chrome screenshot for `http://localhost:3000/main-material`:
  `/private/tmp/main-material-verification.png`.
- PASS in-app browser testbed for `http://localhost:3000/main-material`: route
  loaded without critical error, Structure controls rendered, and clicking
  `terms` inserted/selects the nested reward terms node tree.
- PASS in-app browser structure-authoring smoke test: after inserting `terms`,
  `up`, `down`, `dup`, `wrap`, `unwrap`, and `delete` controls rendered; clicking
  `up` preserved the selected reward terms target and did not crash the route.
- PASS in-app browser insertion-mode smoke test: selecting an inserted node,
  switching to `after`, and adding `text` created and selected a new text-block
  sibling target without crashing the route.
- PASS in-app browser undo smoke test: adding a text block selected the new
  text-block target, enabled `undo`, and undo removed the node while restoring
  the previous selected target without crashing the route.
- PASS in-app browser CMS binding smoke test: selecting the Mission Briefing
  node exposed the CMS binding select, rebinding it from `contractBriefing` to
  `contractTitle` updated the select/status, and choosing `none` unbound the
  node without crashing the route.
- PASS in-app browser non-feed export smoke test: Top Bar, Profile, Credits,
  Tool Bar, Log, Nav Container, and Battle Pass left-tree targets all produced
  Export DOM payloads instead of the previous "No export plan" fallback.
- PASS in-app browser non-feed Export CSS smoke test: selecting Top Bar and
  opening Export CSS showed `.main-material-topbar-shell` with surface/content
  vars and no "No export plan" fallback.
- PASS `npx tsx components/screens/main-material/mainMaterialDomAudit.test.ts`
  for live DOM-to-CSS serialization.
- PASS `npx tsx components/screens/main-material/mainMaterialDomExportGroup.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialWorkbenchExportTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialWorkbenchModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialExportPlanner.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionOutput.test.ts`
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
  parser/serializer, emission inspector view, selected emission export
  output/controller contracts, live DOM export serialization, live DOM export
  groups, chrome/workbench export-target construction, preview-state
  compatibility adapter, material preset/part-state recipe models, interaction
  selection helpers, and workbench model are now extracted from the giant
  screen.

## Next Bottleneck

The `/material-main` top-level controller decomposition is no longer the primary
blocker. Structure authoring now has a live first slice, CMS binding is visible
for selected nodes, and Export DOM/CSS now prefers the live selected DOM subtree
instead of target-specific emitters, with the emission planner retained as a
fallback for unmounted targets. The live export-group contract now reports every
material target id contained by the selected DOM subtree, making the group model
explicit instead of implicit in the inspector. Chrome/workbench fallback export
targets are now built through a shared pure factory instead of the giant screen.
The next bottleneck is attaching export/group descriptors directly to editable
target construction, so selected elements consistently declare their export
root/group before the inspector has to infer it from the DOM. After that, make
CMS editing fuller: show field type/value previews, make bound vs static
content explicit, and route CMS/content documents through the editor output
registry instead of treating feed story values as only fake-server textarea
state.

The first tangible test bed now exists in
`/main-material`: select a feed node, use the Structure controls in the right
panel, and verify the visible UI tree plus export DOM/CSS target updates.

The generated-control convergence inside `MaterialRecipeEditor` is now closed
for the high-risk material/state surface sections. Remaining bespoke editor
chrome is intentional for state selection/presets and base text/content
positioning until those get a broader content-authoring metadata pass.

True runtime/editor JSON panes are now routed through registered editor output
modes. Remaining raw stringification is classified as local storage snapshots,
debug/action display text, play/debug drawers, or legacy login-skin clipboard
export rather than validated runtime editor contracts.

The restartable architecture goal is close but active: validated field metadata
drives the high-risk material/state controls, authoring JSON paths
compile/serialize through named output contracts, and the main editor route
loads with extracted product renderers and inspector contracts. Remaining work
is concentrated around first-class editable target descriptors, richer CMS
authoring, and removing compatibility fallback paths once the live contracts
cover every selectable target.

## Known Dirty Parallel Work

The following files may be modified by the active reflection/icon lane and should
not be reverted by this architecture lane:

- `components/screens/IconsPreviewScreen.tsx`
- `components/ui/KitCoinIcon.tsx`
- `components/ui/KanIcon.tsx`
- `components/ui/MotionReflex.tsx`
- `components/ui/material-node/MaterialRichText.tsx`
- `index.css`
