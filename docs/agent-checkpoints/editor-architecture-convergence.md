# Editor Architecture Convergence Checkpoint

Last Updated: 2026-06-12
Status: historical implementation checkpoint; superseded as an active plan on 2026-07-15
Authorities: `docs/semantic-ui-authoring-compiler-spec.md` and
`docs/mission-briefing-v2-vertical-slice-spec.md`

> Preserve this file as evidence of completed experiments and migration traps.
> Its control-trust lane, DOM-scraping export, and small contract-extraction work
> are not the current goal or progress metric.

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
- [x] Added `components/screens/main-material/mainMaterialExportGroups.ts`,
  the first explicit editable-target export/group descriptor contract
  (`mode: subtree`, `rootTargetId`).
- [x] Feed material targets now carry their own export-group descriptors during
  target construction instead of relying on the inspector to infer ownership.
- [x] Chrome/workbench selectable targets now expose export-group descriptors
  through `createMainMaterialWorkbenchExportGroups()`.
- [x] `/material-main` resolves selected UI target id and DOM export root id
  separately, so future children can export parent/group subtrees without
  changing inspector refresh/copy behavior.
- [x] Added `mainMaterialExportGroups.test.ts`.
- [x] Extracted selected CSS probe target lookup into
  `components/screens/main-material/mainMaterialCssProbeTargets.ts`, removing
  top-bar/toolbar/nav/feed route branching from the giant screen.
- [x] `/material-main` now resolves CSS probe nodes from the selected export
  descriptor root id, keeping frame CSS inspection aligned with the live export
  group model.
- [x] Added `mainMaterialCssProbeTargets.test.ts`.
- [x] Source-tagged selected export payloads as `live-dom` or `fallback-plan`
  in `mainMaterialEmissionOutput.ts`, so fallback planner output no longer
  masquerades as the normal live export path.
- [x] Removed the unused `exportPlan` prop from `EmissionInspector`; the
  inspector now consumes payload DOM/CSS/metrics plus source-aware status
  instead of planner internals.
- [x] Added explicit export descriptor coverage helpers in
  `mainMaterialExportGroups.ts` so tests can fail when selectable targets are
  missing descriptors instead of silently relying on self-target fallback.
- [x] Added `mainMaterialExportCoverage.test.ts`, proving representative feed
  targets plus workbench chrome targets all have explicit export descriptors.
- [x] Guarded live export group use with `domExportGroupContainsTargetId()`, so
  stale DOM snapshots after selection changes cannot be treated as current live
  export payloads.
- [x] Removed fallback planner generation from the normal `/material-main`
  inspector refresh/copy path. Export DOM/CSS in the screen now emits only from
  the current live DOM export group; the emission planner remains available as
  an explicit compatibility/offline adapter through its own module/tests.
- [x] Split fallback emission snapshot creation into
  `components/screens/main-material/mainMaterialCompatibilityExport.ts`, so
  `mainMaterialEmissionOutput.ts` no longer imports planner concepts and remains
  focused on inspector tab/status/payload behavior.
- [x] Added `components/screens/main-material/mainMaterialFeedContentOutput.ts`,
  a tested adapter that converts selected feed story CMS values into the
  registered `ui-node-content` editor output mode.
- [x] Added a visible CMS contract slice in `FeedRecipeEditor`: selected nodes
  now show bound/static state, field type, preview value, and a copy action for
  the selected story's `ui-node-content` JSON.
- [x] Added validated `ui-node-content` import for the selected feed story:
  pasted documents are parsed through the editor output registry, only known
  feed content fields are applied, unknown keys are ignored, and invalid JSON
  returns a UI validation message instead of crashing the route.
- [x] Replaced prompt/clipboard-only CMS import with an inline `ui-node-content`
  document editor in `FeedRecipeEditor`, including apply/reset controls and
  validation through the same content-output adapter.
- [x] Added inline CMS document validation/status feedback beside the
  `ui-node-content` editor.
- [x] Added non-throwing CMS document inspection plus formatting helpers in
  `mainMaterialFeedContentOutput.ts`, so dirty `ui-node-content` drafts can
  show live parse/shape status without invoking the stricter import path on
  every keystroke.
- [x] Upgraded the selected-node CMS panel with dirty-document validation,
  changed matching-field count, a `format` action, and disabled apply for
  invalid JSON.
- [x] Relabeled the lower bound-field textarea to `Selected Field` so the
  full `Content JSON` document remains the primary CMS authoring path.
- [x] Added `docs/main-material-editor-architecture-handoff.md` so future
  prompts can reload what was built, how it works, current risks, and next
  steps.
- [x] Added `docs/main-material-editor-control-contract-spec.md`, the
  restartable inventory/spec for proving every visible editor control by state
  read/write seam, preview effect, output effect, disabled behavior, and proof
  level.
- [x] Tightened `surfaceFieldMetadata.test.ts` with generic generated-control
  metadata gates: every generated slider must declare a range or value stops,
  stop lists must be strictly ascending, select/multi-toggle controls must have
  unique options, and option labels must reference declared options.
- [x] Added `SurfaceFieldControl.render.test.tsx`, a jsdom/Solid interaction
  proof covering generated toggle, multi-toggle, numeric slider, stop slider,
  select with contextual patching, color input, text input, state inherit
  clearing, and disabled toggle behavior.
- [x] Closed the generated surface-control proof slice with an in-app browser
  proof on `/main-material`: selected
  `feed:card:card_type_01:node:mission-briefing`, changed the generated
  `Glass Blur` slider from `3` to `7`, and verified both the live selected
  `.cd-surface` style and the active Export CSS inspector payload changed to
  `--glass-blur: 7px`.
- [x] Started `feed-layout-proof` with the user-reported center-pin semantics:
  in the browser, `Pin V = center` aligned the Mission Briefing node center
  within `0.004px` of its parent center and relabeled the slider to `Y Offset`;
  setting `Y Offset = 10` moved the node center exactly `10%` of the parent
  height below center while Export CSS showed normalized `top: calc(60%)` plus
  `translateY(-50%)`.
- [x] Added a feed-to-node bridge guard proving center-pinned layout emits
  `left/top: calc(50% + offset%)` and preserves
  `translateX(-50%) translateY(-50%)` in canonical layout output.
- [x] Fixed and proved absolute W/H fill sizing in the feed layout compiler:
  `feedNodeLayoutCss()` now emits `width: 100%` and `height: 100%` for
  absolute fill modes instead of preserving stale fixed percentages.
- [x] Expanded `feedNodeLayoutCss.test.ts` to cover absolute fixed/hug/fill,
  in-flow fixed/hug/fill, and spread/cross-axis flex declarations.
- [x] Added a feed-to-node bridge guard proving W/H fill reaches canonical
  layout output as `width: 100%` and `height: 100%`.
- [x] Browser-proved W/H fill in `/main-material`: on
  `feed:card:card_type_01:node:mission-briefing`, clicking the real `W fill`
  and `H fill` buttons activated both controls, disabled both size sliders,
  emitted live `width: 100%; height: 100%`, produced geometry ratios of `1`,
  and showed both declarations in Export CSS.
- [x] Added feed-to-node bridge guards for pad/gap/spread: selected-node
  `gap`, `--feed-node-gap`, `--feed-node-padding`,
  `justify-content: space-between`, and `align-items: stretch` now have
  canonical output assertions.
- [x] Browser-proved pad/gap/spread in `/main-material`: on
  `feed:card:card_type_01:node:mission-briefing`, setting `Pad = 24`,
  `Line Gap = 18`, and `Spread Y = between` produced computed
  `padding: 24px`, `gap: 18px`, and `justify-content: space-between`, with
  matching Export CSS declarations/vars.
- [x] Added a feed-to-node bridge guard proving W/H hug reaches canonical
  layout output as `width: max-content` and `height: auto`.
- [x] Browser-proved W/H hug in `/main-material`: on
  `feed:card:card_type_01:node:mission-briefing`, clicking the real `W hug`
  and `H hug` buttons activated both controls, disabled both size sliders,
  emitted live `width: max-content; height: auto`, showed both declarations in
  Export CSS, and measured the intended intrinsic behavior (`H hug` shrank
  from full parent height to content height while `W hug` expanded to intrinsic
  content width).
- [x] Extracted feed layout-control mapping from `FeedRecipeEditor` into
  `components/screens/main-material/mainMaterialFeedLayoutControls.ts`.
- [x] Added `mainMaterialFeedLayoutControls.test.ts` to prove column vs row
  visual-grid semantics, axis labels, distribution modes, and legacy
  `align`/`justify` compatibility writes.
- [x] Added a row-distribution feed-to-node bridge guard proving row direction,
  even distribution, and end cross-alignment reach canonical CSS as
  `flex-direction: row`, `justify-content: space-evenly`, and
  `align-items: flex-end`.
- [x] Browser-proved row-direction distribution in `/main-material`: on
  `feed:card:card_type_01:node:mission-briefing`, clicking real `Direction row`
  changed labels to `Align Y`/`Spread X` and emitted `flex-direction: row`;
  clicking `BL` then `Spread X evenly` emitted live and Export CSS declarations
  for `align-items: flex-end` and `justify-content: space-evenly`. Geometry
  confirmed cross-axis end alignment because child bottoms aligned at the
  content-box bottom (`606.133px`), one 24px padding inset above the container
  bottom (`630.133px`).
- [x] Added pure and bridge guards for the remaining selected-node layout
  controls in this lane: in-flow mode, overlay-as-absolute, flow nudge
  transforms, explicit pin-end overrides, fixed W/H sizes, and footer push.
- [x] Browser-proved fixed-size and flow layout controls in `/main-material`:
  real `W fixed`/`H fixed` plus `W size = 52`/`H size = 34` emitted
  `width: 52%` and `height: 34%`; real `Mode flow`, `Self in-flow`,
  `Slot footer`, `Nudge X = 14`, and `Nudge Y = -9` emitted
  `position: relative`, `margin-left: auto`, and
  `transform: translate(14px, -9px)` in live style and Export CSS, with stale
  absolute left/top removed.
- [x] Added root feed-layout contract helpers to
  `mainMaterialFeedLayoutControls.ts`, covering defaults, clamps, and runtime
  CSS var mapping for `Content Y`, `Copy Lift`, and `Dot Gap`.
- [x] Routed `MainMaterialPreview`, `FeedCarousel`, and
  `MainMaterialPreviewScreen` through those root feed-layout helpers so runtime
  vars and persistence/import sanitization share the tested contract.
- [x] Strengthened `mainMaterialEmissionOutput.test.ts` so all visible
  inspector tab labels/statuses/payloads are contract-tested.
- [x] Refactored selected-node X/Y label and range rules out of
  `FeedRecipeEditor` and into `mainMaterialFeedLayoutControls.ts`, with tests
  for in-flow labels, right/bottom labels, center-offset labels, and centered
  slider ranges.
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
- [x] Phase 0 of `docs/feed-model-unification-refactor-spec.md`: extracted the three
  pure-literal default card-types (`createDefaultMissionBriefingV1CardType`,
  `createDefaultPatchNotesCardType`, `createDefaultCommunityCardType`) out of
  `mainMaterialFeedModel.ts` into `components/screens/main-material/defaults/*.json`,
  replacing each function body with a `cloneFeedCardType(<json>)` one-liner. The model file
  dropped 8068 -> 1040 lines with byte-identical runtime output (independent snapshot match).
  No type, sanitizer, or consumer changed. Behavior-preserving data-as-code removal.
- [x] Phase 1a of `docs/feed-model-unification-refactor-spec.md`: additive canonical-type
  extensions so the model can later absorb the Feed shape. Added `lineHeight?`/`paragraphGap?`
  to `MaterialNodeContent` and `'rich-fit'` to `MaterialNodeTextRenderMode`; widened
  `MaterialRecipe.textEmboss` (and `SurfaceOptions.textEmboss`) from `boolean` to
  `boolean | MaterialTextEmbossStyle` reusing the existing `materialTextEmboss` type/renderer;
  `MaterialRecipeValidate` now sanitizes the emboss object (clamped) while booleans pass through
  unchanged; `surfaceFeatures` renders object emboss via `materialTextEmbossShadow`, with
  `true`/`false`/`undefined` branches byte-identical to before (independent boolean-baseline
  snapshot match). Additive only — no Feed type wired (Phase 2 deferred), no consumer behavior
  changed. Inherit sentinels for `textSizeRem`/`textAlign`/`textX`/`textY` deferred to Phase 1b.
- [x] Phase 1b of `docs/feed-model-unification-refactor-spec.md`: added `'inherit'` sentinels
  for `textSizeRem`/`textAlign`/`textX`/`textY` to the `ContentStateOverlay` content-override
  layer (type + defaults + `sanitizeContentOverlay` + compiler resolve). Defaults are `'inherit'`
  so the compiler resolves to the base recipe value -> compiled surface output is byte-identical
  (independent stash-based before/after snapshot, 23192 bytes, zero diff). This gives the 14 Feed
  `overrideX` booleans a canonical home for Phase 2. Updated one existing adapter test fixture for
  the new overlay keys and added a positive sentinel test (concrete kept/clamped, `'inherit'`
  preserved). Additive; no Feed type wired.
- [x] Phase 2a of `docs/feed-model-unification-refactor-spec.md`: added the pure, tested
  Feed->MaterialNode bridge `components/screens/main-material/mainMaterialFeedToNode.ts`
  (`feedCardNodeToMaterialNode`, `feedCardTypeToMaterialNodeTree`). It composes the EXISTING
  tested Feed resolvers (`feedNodeSurfaceRecipe` folds slot+node text style onto the surface;
  `resolveFeedNodeRenderMode`/`feedNodeFitMode` for content; `feedNodeLayoutCss` bakes ALL layout
  incl. gap/constraint/size-mode fields into `MaterialNodeLayout.style` -> zero layout fidelity
  loss), so no resolution logic is reimplemented. Proven on all 3 real default card types: node-
  count parity (4/4, 5/5, 5/5), surface deep-equals the resolver on sampled nodes, layout.style
  populated, own-key coverage guard against silent field drops. `cardType.backgroundImage`
  deferred (becomes a media node in a later slice). No consumer touched.
- [x] Phase 2b of `docs/feed-model-unification-refactor-spec.md`: render-parity proof. Enabled the
  Solid JSX transform under vitest (`vitest.config.ts` now loads `vite-plugin-solid` +
  `resolve.conditions` + inline solid deps) so component render tests run in jsdom, and added
  `mainMaterialFeedToNode.render.test.tsx`. It mounts the REAL canonical `MaterialNodeRenderer`
  on the bridged `card_type_01` tree with a binding resolver over a real `FeedStory`, and proves:
  exact node-count parity (one `.material-node` per source node, root + children), canonical kind
  classes emitted, and bound story copy resolved into the DOM through the canonical content path.
  Surface visual parity is transitive and already guaranteed: the bridge surface deep-equals
  `feedNodeSurfaceRecipe` (Phase 2a) AND both the feed carousel and `MaterialNodeSurface` render
  through the SAME `MaterialSurfaceHost`/`materialRecipeToSurfaceProps`. Remaining DOM-wrapper
  parity is a browser-smoke item. Bonus: vitest can now render Solid components for all later
  renderer-swap slices.
- [x] Phase 2 bridge completion: mapped `cardType.backgroundImage` (deferred in 2a) to leading
  nodes mirroring the carousel — a `media` node bound to `image` with `feedBackgroundImageCss`
  positioning, plus a fade-overlay `container` (`main-material-feed-media-fade--<mode>` class +
  `feedMediaFadeCss` vars) when a fade is active. Content parity preserved by splitting the leading
  background nodes off before the lockstep walk (feed 4/5/5 == material content 4/5/5; bg=1 mission
  briefing, bg=2 patch/community). Forward bridge now maps every FeedCardTypeRecipe field; render
  test confirms the canonical renderer emits the media node. Bridge + its 2 tests only.
- [x] Phase 2c-i of `docs/feed-model-unification-refactor-spec.md`: gave the canonical
  `MaterialNodeFrame` an OPTIONAL DOM-registration context (`MaterialNodeDomRegistration` +
  `MaterialNodeDomRegistrationProvider`), no-op by default (`createInstanceId` -> '' skips
  registration), mirroring `FeedNodeFrame`. This lets the editor find mounted canonical node
  elements by target id for live-DOM export/inspection AFTER the carousel swap, without coupling
  the canonical layer to the editor (the registration is injected). Existing provider-less
  consumers (UiNodePreviewScreen) render exactly as before. Proven: jsdom test asserts one
  registration per node element with the live element + matching `data-material-target-id`, and
  cleanup unregisters all; the 3 provider-less render tests still pass. Prereq for 2c-ii (carousel
  swap to MaterialNodeRenderer).
- [~] Phase 2c-ii of `docs/feed-model-unification-refactor-spec.md`: ATTEMPTED then REVERTED the
  live carousel renderer swap. A prototype rendered card content through the canonical
  `MaterialNodeRenderer` + the bridge + a full render context + content-enrichment. It got
  absolute leaf nodes positioning correctly, but container/flow nodes broke: the feed layout is a
  bespoke CSS system keyed off the `main-material-card-node--<type>-frame` CLASS, `data-feed-layout-
  mode`/`data-w-mode`/`data-h-mode` ATTRIBUTES, and a `.main-material-card-node-flow-stack` wrapper
  DOM that the generic `MaterialNodeRenderer` does not emit. Faithful parity needs the canonical
  frame to natively express size-modes/flow + arbitrary data-attrs (a real layout feature, not
  feed-specific class injection). Decision: revert the carousel swap, keep the renderer on the
  proven `FeedCardTreeNode`, and pursue Phase 3 (migrate consumers to canonical DATA first); unify
  the renderer LAST once the canonical layout gap is closed deliberately.
  KEPT additive wins from the attempt (all correct, tested, additive):
  - `MaterialNodeFrame` undefined-clobber fix: explicit layout fields no longer wipe values present
    only in `layout.style` (genuine bug — undefined keys were clobbering baked CSS).
  - `MaterialNodeFrame` optional DOM-registration hook (2c-i) + its jsdom test.
  - `MaterialNodeContentRenderer` default branch forwards `richText` (additive; undefined for
    other consumers).
  - `useMainMaterialDomRegistration` export (infra for the eventual swap).
  LESSON: do not trust a screenshot for feed-card parity — the background image bakes in mockup
  UI art; verify rendered node geometry (bounding boxes / computed position) instead.

- [x] Phase 2c layout-1 (closing the canonical layout gap, prereq to retrying the renderer swap):
  extracted `MaterialNodeFrame`'s inline layout into a pure, tested
  `components/ui/material-node/materialNodeLayoutCss.ts`, and expanded it to emit SELF-SUFFICIENT
  CSS — `display: 'absolute'` now compiles to real `position: absolute` + a flex column box model
  (`display:flex`, `flex-direction`, `box-sizing:border-box`, `min-width/height:0`), so an absolute
  node positions WITHOUT depending on a host stylesheet class like `.main-material-card-node`.
  Non-absolute `display` values and the undefined-clobber-safe `layout.style` merge are unchanged
  (additive; no existing node uses `display:'absolute'`). Unit tests cover absolute compilation,
  flex/block passthrough, baked-style preservation, and explicit-over-baked precedence. This is the
  first of a few layout slices; still TODO before re-swap: canonical size-modes (hug/fill) + flow
  vs absolute child layout, and reconciling the surface-as-wrapper vs surface-as-background
  structure.
- [x] Phase 2c layout-2: added canonical size-mode vocabulary `widthMode`/`heightMode`
  (`fixed`|`hug`|`fill`) to `MaterialNodeLayout`, resolved in `materialNodeLayoutCss`
  (hug -> `max-content`/`auto`, fill -> `100%`, fixed/unset -> the explicit `width`/`height`).
  Covers leaf + absolute nodes inline; flex-based container fill of in-flow children still needs
  the two-layer flow structure (layout-3). Additive (fields optional, unset = prior behavior).
  Tests cover hug/fill/fixed resolution + mode-over-baked-style precedence. Compiler tests +
  render regression (4/4) green, build clean. Reading the feed CSS confirmed hug/fill are coupled
  to a two-layer frame/flow-stack flex structure: the frame is the positioned box, the surface is
  an absolute `inset:0` background layer, and a `.main-material-card-node-flow-stack`
  (absolute inset:0, flex column, z-index 2) lays out children OVER the surface — hug flips the
  flow-stack to `position:relative` so content drives frame size; fill uses `flex:1` on children.
  That two-layer structure is the layout-3 target.
- [x] Phase 2c layout-3: implemented the two-layer canonical render structure. `MaterialNodeRenderer`
  now renders CONTAINER nodes (nodes with children) as `frame > [absolute background surface] +
  content + children`, where children are direct flex items of the frame (so their %/absolute
  positions resolve against the full frame box). LEAF nodes (no children) keep surface-wraps-content.
  `MaterialNodeSurface` gained an `asBackground` mode (panel host positioned `absolute; inset:0;
  100%x100%; z-index:0` via `rootProps.style`, no children, self-sufficient — no host stylesheet
  needed). The bridge now sets `display:'absolute'`/`'flex'` from feed `selfPosition`, and the
  background media/fade nodes are `display:'absolute'` so they leave flow. Added a dev harness route
  `/dev/canonical-card` (+ `CanonicalCardProofScreen`, wired in App.tsx's manual route ladder) that
  renders a bridged card through `MaterialNodeRenderer` with NO feed CSS, so geometry can be verified
  in isolation. VERIFIED BY LIVE NODE GEOMETRY (not screenshots): before the fix, children collapsed
  (deadline-badge y1/h0) because they were nested in the 0-height surface; after, deadline-badge is
  y48/h29 (top 10%, height 6% of the 480 frame), mission-briefing y139/h264, sector-mark y53/h67, and
  the background fills 272x480 absolute. Remaining harness overflow (contract-cta) is the text-fit
  enrichment gap, not structural: the harness omits the carousel's fit/richText enrichment, so the
  briefing body renders unscaled (fit:false, raw markup) and overflows; with enrichment it scales to
  fit. Compiler/render/bridge/lane tests green, build clean. Structural layout closed; re-swap (with
  enrichment) is the next slice.

- [x] Phase 2c layout-4 (re-swap) + flow->standard-CSS: re-applied the carousel swap on the
  fixed canonical renderer. `mainMaterialFeedCarousel.tsx` renders card content through
  `MaterialNodeRenderer` (no `FeedCardTreeNode`), with the render context (surface/button props,
  preview state, target ids, selection + frame classes, binding) + content enrichment (fit/style/
  rich-text) + bridged DOM registration. The two-layer container now uses STANDARD CSS flow: the
  frame is a flex box with `overflow:hidden` (replacing the `.main-material-card-node-flow-stack`
  wrapper), in-flow size modes map to flexbox (`fill`->`flex:1 1 0`+`min-height:0`,
  `hug`/`fixed`->`flex:0 0 auto`, via `materialNodeLayoutCss` + `MaterialNodeLayout.overflow`/
  size modes), and a container's bound content gets `flex:1;min-height:0;overflow:hidden`
  (`MaterialNodeContentRenderer` `fill` prop) so it shares the column with child nodes. VERIFIED BY
  LIVE GEOMETRY on `/main-material`: all 4 card_type_01 nodes positioned+sized correctly in the
  272x324 stage (badge x139/y32, mission-briefing x128/y94/h178, contract-cta x137/y260 visible,
  sector-mark x19/y36); contract-cta now visible 2/2 (was hidden/swallowed before). No flow-stack
  in the canonical card. compiler/render tests + build green.
- KNOWN REMAINING: bound rich text (`textRender:'rich'`) clips instead of autoscaling — only
  `rich-fit`/`fit` modes run the GameText fit. Routing flow-rich bound text through `rich-fit`
  (which exports as a `transform:scale`) is the follow-up; it's a text/material concern, not flow.
- [note] Swapped the baked-in feed background image (`/art/login/main-menu-contract-reference.png`,
  which had mockup UI baked in and was visually masking the canonical render) to a temporary clean
  image `/art/login/editor-temp-bg.png` (old file kept). Updated both the code default in
  `mainMaterialFeedModel.ts` and the persisted `feedStories` images in the `.v23` localStorage
  (which override code defaults on load). Temporary until the editor is done.

- [x] Minimal-surface rewrite, first working slice (steps 1-5 of
  `docs/surface-emitter-rewrite-spec.md`): the 10+-span surface now renders as 3 elements.
  Step 1: per-effect CSS extraction (`docs/surface-emitter-css-extraction.md`) — every slider's
  emitted CSS documented from `ui-material-lab.css:916-1584`, plus the fixed-slot trick (blend
  modes are positional per background layer, so the fill is a FIXED 9-slot stack whose inactive
  slots resolve to `none`). Step 2: `src/styles/material-minimal.css` — static template for
  `.cdm__fill` (base/texture/tint/gradient/glass stack + glass shine/sheen pseudos),
  `.cdm__light` (border + edge/corner strips + glow ::before + emission ::after), conditional
  `.cdm__wear` (own mask), neutral `.cdm__content` (button label typography opt-in via
  `--label`). Texture per-layer opacity replaced by a color-mix dilution veil (identical
  composite math). Step 3: `minimalSurfaceCss.ts` — active-effects-only emitter; gradient
  definitions reference the EXISTING var system so live slider tweaks propagate. Step 4:
  `MinimalSurface.tsx` — root keeps the `cd-surface` class, so vars, shape/bevel, state var-swap
  machinery, focus/disabled all apply unchanged; zero state-system duplication. Step 5:
  `/dev/minimal-surface` parity harness (old vs new, same resolved SurfaceOptions, 8 recipes) —
  worst case CTA-active drops 18 -> 6 DOM nodes; difference-overlay test (clone over old,
  mix-blend-mode:difference) shows near-black body = pixel-parity on fill/texture/edges; first
  three recipe rows visually indistinguishable. Remaining (next slices): faint highlight-band
  edge delta on CTA, interactive <button> root variant, the static-CSS-text EXPORT emitter,
  corner-arc rounding for glow corners, then consumer swap.

- [x] Minimal-surface permutation gallery (JSON-driven isolation matrix): added
  `components/screens/minimal-surface/minimalSurfacePermutations.ts` — 69 specs across 12 groups
  (base/shape/texture/tint/gradient/glass/frame/lighting/wear/content/states/kitchen-sink), each
  with an `expect` description; the same JSON drives the renderers AND the inspector panel.
  Rebuilt `/dev/minimal-surface` as the gallery: group select, compare-old toggle, per-cell
  difference mode (mix-blend difference, black = identical), sticky JSON inspector, tooltips,
  scrollable, and a `window.__permAudit()` self-debug hook returning per-cell render facts.
  BUGS FOUND AND FIXED via the gallery:
  1. SurfaceOptions defaults `texture` to 'road012a' when unset — isolation specs must set
     `texture:'none'` explicitly (spec helper now injects it). Was making base cells render the
     default road texture on BOTH renderers.
  2. `hasEdgeWearLayer` requires `edgeWearTexture` set — wear specs now pass
     'edge-bw-noise-dense'.
  3. NEW-renderer content host was missing the canonical `.cd-surface__content` styling
     (color rgb(--content-rgb/--content-alpha), text-align --content-align, text-shadow
     emboss+glow, --content-x/y offset) — now an exact copy; computed color/align/shadow are
     string-identical to the old renderer.
  4. CSS COMMENT BUG killed the whole `.cdm__light` rule: the comment text "--edge-*/--corner-*"
     contains `*/` which terminates the comment early; CSS error recovery then swallowed the
     entire following rule (border/edge/corner strips never painted). Diagnosed by bisecting
     live `document.styleSheets` vs the Vite-served text. Lesson: never write `*/` inside CSS
     comment prose.
  Verified after fixes: 69/69 cells render, wear renders (5 cells), light rule alive (1px border
  at the spec's exact 70% opacity + 12 strips), bevel-border cell: NEW renderer draws the bevel
  cut + crisp border correctly while the OLD span renderer shows neither (user-confirmed old-side
  bug — the new renderer is the reference for bevel+border). tex-100 verified semantically
  identical on both sides (no base + opacity 1).

- [x] Minimal-surface parity triage (numbered gallery + computed-style probes). Per-cell
  reference verdict established by MEASUREMENT, not eyeballing:
  - Lighting (#46/47/48/53): glow CSS vars byte-identical both sides; OLD is the reference for
    two details — (a) glow washes paint UNDER the crisp edge/corner strips (NEW had them over —
    FIXED: `cdm__light::before` now `z-index:-1`, glow behind strips, still screening the fill);
    (b) 4 `corner-arc` rounded highlights (NEW still lacks — the only remaining lighting gap, the
    faint difference-mode residual). Kitchen-sink (#67-69) inherits the corner-arc gap.
  - Content/typography (#57-62): NEW is correct — it applies recipe typography (size/weight/
    transform/color); the OLD PANEL host ignored it (panels aren't buttons). HARNESS BUG fixed:
    label cells now compare against the OLD BUTTON host, and the button is grid-stretched to fill
    the cell (was inline-block content-height 46px vs new 110px — the "huge height difference" the
    user saw was purely the harness not sizing the old button; now both 110px). Real NEW bug #61
    fixed: label mode used `align-items: var(--content-align)` with a text-align value (`left`) →
    invalid; switched to `text-align`.
  - States (#63-66): transform + filter computed-identical both sides; class noise (is-interactive)
    is the button host auto-adding it — not a renderer difference.
  Net: the only outstanding renderer gap is glow corner-arcs; everything else is fixed or NEW-is-
  correct (with #13 bevel+border being an OLD-side bug where NEW is the reference).

- [x] Minimal-surface corner-arcs + bevel matrix: the square-corner clipping on glowing cells
  (#46/47/48/53/56) was the missing 4 `corner-arc` rounded highlights — the strips alone read as
  square-cut at the radius tangent. Added a conditional `cdm__corners` layer (rendered only when
  glow lighting is active) that reuses the existing `.cd-surface__corner-arc--*` CSS + vars, so
  rounded corners now get the same accented arcs as the old renderer (verified: 4 arcs render,
  TL gold @0.98, 7px radius). Added an 8-cell `bevel-matrix` permutation group (bevel-per-corner ×
  border off/on/lit × lit-corners off/on + a rect control) to expose the historically buggy
  bevel+border+corner combos. KNOWN DEEPER BUG surfaced and confirmed in BOTH renderers: on a
  BEVELED corner the corner-arc highlight is still drawn ROUNDED (border-radius), not matching the
  diagonal cut — the old renderer has the same flaw. Fix (make the arc diagonal for beveled
  corners) is a follow-up. Gallery now 77 cells; build + tests green.

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
- PASS `npx tsx components/screens/main-material/mainMaterialCompatibilityExport.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedContentOutput.test.ts`
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
- PASS Phase 0 data extraction: 14/14 main-material lane tests green; independent
  snapshot of `createDefaultFeedCardTypes()` byte-identical (221421 bytes) before/after;
  `npm run build` clean (1110 modules); diff surgical (only model file + new `defaults/`),
  no protected-lane file touched; model 8068 -> 1040 lines.
- PASS Phase 1a type extensions: 16/16 tests green (MaterialRecipeValidate, surfaceFeatures,
  surfaceValidate, MaterialRecipeEditorStateAdapters, surfaceFieldMetadata, surfaceStateVars,
  uiNodeRichTextTheme, materialTextEmboss + 8 main-material lane tests); `npm run build` clean;
  emboss boolean output byte-identical (independent baseline); test diffs purely additive
  (pre-existing emboss assertions intact); diff scoped to 7 material-lab/material-node files,
  no protected/Feed file.
- PASS Phase 1b inherit sentinels: 15/15 tests green; compiled surface output byte-identical
  before/after (stash-based snapshot, 23192 bytes, zero diff); new positive sentinel test proves
  concrete values kept/clamped and `'inherit'` preserved; `npm run build` clean; diff scoped to 6
  material-lab files (4 source + 2 tests), no protected/Feed file.
- PASS Phase 2a Feed->MaterialNode bridge: bridge test green (node parity 4/4, 5/5, 5/5; surface
  deep-equal on 6 sampled nodes; coverage guard); feedText + feedModel tests still green; build
  clean; independent probe confirmed real folded text styling (e.g. deadline-badge -> gold/weight
  600/emboss/0.5rem) and 7 baked layout CSS props; diff = 2 new files only, no existing file
  modified.
- PASS Phase 2b render parity: new Solid jsdom render test green (3/3 — mount + exact node parity
  + kind classes + bound story copy in DOM via canonical MaterialNodeRenderer); existing
  feedNodeLayoutCss vitest test still 8/8 under the new config; tsx-runner suite unaffected; build
  clean; diff = vitest.config.ts + 1 new .test.tsx.
- PASS Phase 2c-i frame registration: jsdom test — one registration per node with live element +
  matching `data-material-target-id`, cleanup unregisters all; provider-less consumers unchanged.
- REVERTED Phase 2c-ii carousel swap (see [~] entry above). After revert: `npm run build` clean;
  render/bridge/feedText/feedModel/MaterialRecipeValidate tests green; live `/main-material`
  restored to the feed renderer (0 canonical `.material-node` frames, 60 targets, no error, text
  geometry back to sane heights, Export DOM for deadline-badge = 9 nodes). Kept additive fixes only.
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
- PASS `npx tsx components/screens/main-material/mainMaterialExportGroups.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialExportCoverage.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialFeedTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialCssProbeTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialWorkbenchExportTargets.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialWorkbenchModel.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialExportPlanner.test.ts`
- PASS `npx tsx components/screens/main-material/mainMaterialEmissionOutput.test.ts`
- PASS `npm run build`
- PASS in-app browser descriptor smoke test: `/main-material` loaded without
  critical error; 60 live material targets were present; Top Bar and Nav
  Container DOM roots each contained child material target ids, matching the
  subtree export-group model.
- PASS in-app browser CSS-probe smoke test: `/main-material` loaded without
  critical error; Top Bar and a feed child target were present with layout
  attributes after moving probe lookup out of the screen.
- PASS in-app browser live export group smoke test: `/main-material` mounted 60
  material targets; Top Bar and the first feed card roots each contained child
  material target ids, matching the live group containment guard.
- PASS in-app browser live-only export smoke test: `/main-material` mounted 60
  material targets; Top Bar's live export group contained its own target id plus
  child target ids after fallback planner removal from the screen path.
- PASS in-app browser CMS output smoke test: `/main-material` loaded without
  critical error; the CMS section rendered State, Type, Preview, Output, and
  `copy ui-node-content` controls.
- PASS in-app browser CMS import smoke test: `/main-material` loaded without
  critical error; the CMS section rendered copy/import content controls.
- PASS in-app browser CMS document editor smoke test: `/main-material` loaded
  without critical error; the CMS section rendered Content JSON, apply
  document, and reset controls.
- PASS in-app browser CMS status smoke test: `/main-material` loaded without
  critical error; the CMS document editor rendered inline Status/Ready feedback.

## Current Architecture State

- Game UI theme/CMS/placement JSON proof is closed through
  `docs/agent-checkpoints/game-ui-skinning-cms.md`.
- Surface runtime, sparse state vars, typed host, field metadata, generated
  editor scaffolding, material recipe compiler modules, and editor output-mode
  registry exist.
- `/material-main` is still too large, but its feed model, text/render policy,
  authoring controls, frame registration, rich text, chrome renderer, feed
  carousel renderer, phone preview controller, persisted preview JSON
  parser/serializer, emission inspector view, source-tagged selected emission
  export output/controller contracts, live-only screen export serialization,
  compatibility-only fallback export snapshots, live DOM export groups with
  current-target containment checks, first-class export-group descriptors,
  descriptor coverage tests, CSS probe target lookup, chrome/workbench
  export-target construction, preview-state compatibility adapter, material
  preset/part-state recipe models, feed CMS `ui-node-content` output adapter,
  interaction selection helpers, and workbench model are now extracted from the
  giant screen.

## Next Bottleneck

The `/material-main` top-level controller decomposition is no longer the primary
blocker. Structure authoring now has a live first slice, CMS binding is visible
for selected nodes, and Export DOM/CSS now prefers the live selected DOM subtree
instead of target-specific emitters, with the emission planner retained as a
fallback for unmounted targets. The live export-group contract now reports every
material target id contained by the selected DOM subtree, and selectable feed
plus chrome targets now declare their export root through explicit descriptors.
Chrome/workbench fallback export targets are built through a shared pure factory
instead of the giant screen, selected CSS probe lookup now follows the
descriptor root through a shared resolver, fallback planner payloads are
source-tagged, descriptor coverage is tested for representative feed plus
chrome workbench targets, the normal screen inspector path is now live-DOM only,
and fallback snapshot creation has been re-homed into a compatibility export
module. CMS/content convergence has its first live slice: selected story content
serializes through the registered `ui-node-content` output mode, and the CMS
panel exposes bound/static state, field type, preview value, copy, and validated
import actions. The CMS panel now includes an inline `ui-node-content` document
editor with live dirty-draft validation, apply/format/reset controls, inline
status feedback, and matching-field changed count, replacing
prompt/clipboard-only import. The lower bound-field textarea is now labeled as
a selected-field convenience editor, but still duplicates part of the document
edit workflow. The durable handoff doc is
`docs/main-material-editor-architecture-handoff.md`.

The active trust spec is `docs/main-material-editor-control-contract-spec.md`.
The goal has shifted from broad architecture extraction to proving the editor's
visible controls. The generated surface-control proof slice now has metadata
validity, `SurfaceFieldControl` interaction coverage for every shared control
kind, contextual patch behavior for texture/edge wear, and browser proof that a
generated control changes live Export CSS for a selected material target.

The next bottleneck is either finishing the remaining layout edge cases
(`wrap`, remaining Pin H/V constraints beyond center, and browser proof for the
root feed layout sliders) or moving to `inspector-export-proof`. Selected-node
layout controls now have contract and browser coverage for center pin, fill,
hug, fixed size, row/column distribution, flow/in-flow, footer/pin-end, and
nudge. Hug is proven, but the UI label may still need helper text or renaming
because `max-content` can exceed the parent instead of fitting inside it.

The first tangible test bed now exists in
`/main-material`: select a feed node, use the Structure controls in the right
panel, and verify the visible UI tree plus export DOM/CSS target updates.

Mission Briefing V2 now treats the reward column as one authored rich-text CMS
slot (`contractRewardSummary`) instead of two nested label/value stacks. The
default footer tree is `reward-terms-group-summary` plus the fingerprint
hold-action, and stale persisted V2 trees with the old deposit/success stack are
migrated back to the current default structure during feed card-type
sanitization.

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
