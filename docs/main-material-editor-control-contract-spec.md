# Main Material Editor Control Contract Spec

Last updated: 2026-06-12

## Goal

The editor is not trustworthy until every visible control has a declared
contract and a proof path.

This spec defines the acceptance model for `/main-material` controls:

```txt
visible control
  -> declared state read/write contract
  -> validated editor state
  -> rendered preview effect
  -> serialized/exported output effect
  -> focused proof
```

The objective is not to create a giant manual QA checklist. The objective is to
turn the editor into a system where controls can be inventoried, tested, and
debugged by seam.

## Control Contract Shape

Every visible editor control should be classifiable with this shape:

```txt
id: stable id for spec/test references
surface: screen/editor region
kind: button | toggle | multi-toggle | slider | select | text | textarea | file | color | tab
label: visible label or generated field label
reads: state or derived selector read by the control
writes: state mutation, patch helper, or command invoked
disabled_when: disabled/inactive rule, if any
preview_effect: visible DOM/render/runtime change expected after edit
output_effect: JSON/export/CSS/DOM contract affected after edit
proof: unit | contract | render | browser | visual
status: proven | partial | unproven | confusing | broken
```

When a control cannot be described this way, that is a design problem. It means
the editor is relying on implicit coupling instead of a control contract.

## Proof Levels

- `unit`: pure state transform or resolver test.
- `contract`: validates JSON, output registry, export group, or persistence
  contract.
- `render`: jsdom/Solid render proof that state reaches component DOM.
- `browser`: Playwright/in-app browser proof that a user action changes visible
  editor/runtime state.
- `visual`: screenshot or geometry proof for layout, text fit, surface layers,
  and other pixel-sensitive behavior.

Most controls need more than one proof level. For example, a layout slider needs
a state transform proof, a renderer/geometry proof, and at least one browser
smoke path proving the actual editor control drives the same seam.

## Acceptance Rules

A control is `proven` only when:

1. Its read/write state contract is named.
2. Its disabled/inactive behavior is named or explicitly not applicable.
3. It has a focused proof at the narrowest seam that owns its behavior.
4. At least one integrated proof confirms the visible editor reaches that seam.
5. The affected export/output path is either tested or explicitly classified as
   unaffected.

A control is `partial` when its pure seam is tested but no browser/render proof
exists, or when the browser path works but the state/output seam is not covered.

A control is `confusing` when it works mechanically but the user cannot predict
what it should do. Confusing controls are not world-class even when tests pass.

## Authoritative Seams

These are the seams the control proofs should target.

| Seam | Owns | Current evidence |
| --- | --- | --- |
| `surfaceFieldMetadata.ts` | generated surface field labels, control kind, ranges, stops, options | metadata tests exist |
| `surfaceEditorFilters.ts` | generated visibility, disabled fields/groups, contextual patching | metadata/filter tests exist |
| `SurfaceFieldControl.tsx` | generated toggle/multi-toggle/slider/select/color/text/json controls | component tests exist but need broader interaction proofs |
| `MaterialRecipeEditor.tsx` | state tabs, presets, bespoke text/state controls, generated surface groups | partial tests; still has bespoke controls |
| `mainMaterialFeedModel.ts` | feed/card/story defaults, sanitizers, slots, layout shape | strong model tests |
| `feedNodeLayoutCss.ts` | feed node layout semantics for absolute/flow/constraints/fill/hug/push | vitest-style test exists; browser geometry proofs still needed |
| `mainMaterialFeedEditors.tsx` | feed authoring UI: structure, CMS, selected-node text, layout controls | high-risk, large, partial proof |
| `mainMaterialNodeTreeOperations.ts` | add/remove/move/duplicate/wrap/unwrap tree operations | operation tests exist |
| `mainMaterialFeedContentOutput.ts` | selected story `ui-node-content` serialization/import/inspection | contract tests exist |
| `mainMaterialFeedToNode.ts` | feed tree to canonical `MaterialNode` renderer bridge | bridge tests exist |
| `mainMaterialDomExportGroup.ts` | live DOM/CSS export group serialization | contract tests exist |
| `mainMaterialExportGroups.ts` | selectable target to live export-root descriptor | coverage tests exist |
| `mainMaterialPersistence.ts` | local storage/import/export state shape | persistence tests exist |
| `editorOutputRegistry.ts` | named output modes and validators | registry tests exist |
| `MainMaterialPreviewScreen.tsx` | top-level orchestration still not fully extracted | unproven as a controller |

## Initial Control Inventory

This inventory is grouped by editor surface. It is intentionally tied to source
files so it can be expanded into executable tests.

### Top-Level Shell

Source: `components/screens/MainMaterialPreviewScreen.tsx`

| Region | Controls | Contract | Status |
| --- | --- | --- | --- |
| Workbench selection | left tree buttons from `MaterialWorkbenchLayout` | select `MainPartId` or feed target; reset CSS probe/hidden class state; update selected material editor | partial |
| Overlay | Off/Flash/Persistent | writes `selectionOverlayMode`; changes selection outline behavior | unproven |
| Interact | Selected/All | writes preview interaction mode; affects hover/pressed/focus tracking scope | unproven |
| JSON state | Export, Import | copy/paste preview-state compatibility JSON through persistence adapter | partial |
| Reset | Reset Selected, Reset All | reset selected recipe/surface/feed/nav/backdrop state | unproven |
| Presets | Save, Save New, Delete, Clear Material Presets | material preset model + localStorage | partial |

### Backdrop And Title

Source: `components/screens/MainMaterialPreviewScreen.tsx`

| Region | Controls | Contract | Status |
| --- | --- | --- | --- |
| Backdrop | fit cover/tile, blur, scale, x, y, dim, warm, dark | writes `BackdropRecipe`; affects preview backdrop styles and persisted preview JSON | unproven |
| Title | title/subtitle text inputs, font picker, size, tracking, x, y | writes `TitleRecipe`; affects preview title DOM and persisted preview JSON | unproven |
| Navigation | active nav index slider | writes active preview nav index; affects selected nav visual state | unproven |

### Generated Surface Controls

Source:

- `components/ui/material-lab/surfaceFieldMetadata.ts`
- `components/ui/material-lab/surfaceEditorFilters.ts`
- `components/ui/material-lab/SurfaceFieldControl.tsx`
- `components/ui/material-lab/SurfaceGeneratedEditor.tsx`

Generated control groups:

- base
- shape
- texture
- glass
- lighting
- border
- edgeWear
- shadow
- content
- emission
- motion
- state

Important control families:

| Family | Controls | Contract | Status |
| --- | --- | --- | --- |
| Toggle | glass, sheen, glassBlurEnabled, borderEnabled, borderLit, edgeWear, dropShadow, textEmboss | toggle boolean through `patchSurfaceFieldWithContext`; disabled rules from capabilities | partial |
| Multi-toggle | bevelCorners, corners, edgeHighlight, border | array add/remove; no hidden coupling between bevel and border | partial |
| Slider | textureStrength, textureScale, glass values, borderOpacity, lighting, edge wear, shadow, text, emission, state motion | numeric range or stop list; emits typed `SurfaceOptions` patch | partial |
| Select | material, texture, shape, glow, tint, gradient, borderColor, edgeWearTexture, contentLayer, tones, weights, emission | enum option writes typed `SurfaceOptions` patch | partial |
| Color | materialColor, borderCustomColor | writes valid color string; output appears in surface CSS vars | partial |
| Text/json | textContent, textFontFamily, stateVars | text/json state path; JSON currently display-only for generated control | partial |

Required generated-control proof:

1. Metadata has exactly one definition for every visible generated field.
2. Every generated definition has a compatible control component.
3. Every slider has range or `valueStops`.
4. Stop sliders click through exact stops, not arbitrary near-values.
5. Context patches are tested for side effects, especially texture and edge wear.
6. Disabled field/group rules are proven for each part capability.
7. `SurfaceFieldControl` interaction tests cover toggle, multi-toggle, numeric
   slider, stop slider, select, color, text, state inherit, and disabled
   controls.
8. Browser proof confirms at least one generated control mutates a live selected
   surface and updates Export CSS.

### Surface State And Text Controls

Source: `components/ui/material-lab/MaterialRecipeEditor.tsx`

| Region | Controls | Contract | Status |
| --- | --- | --- | --- |
| State picker | rest/hover/active/pressed buttons | selected visual state determines overlay editor target and preview state | partial |
| State enable | state overlay enable button | toggles sparse overlay state; disabled states inherit base | unproven |
| State surface | generated state surface fields | patch sparse state overlays, not base recipe | partial |
| Base text | font, size, opacity, color, weight, style, transform, tracking, emboss, align, x/y | writes material recipe text/content fields; affects label renderer and exported surface vars | partial |

### Feed Card And Story Controls

Source: `components/screens/main-material/mainMaterialFeedEditors.tsx`

| Region | Controls | Contract | Status |
| --- | --- | --- | --- |
| Fake Server | Story select | writes selected story id; preview and CMS content switch to that story | unproven |
| Card Type | name input | writes current card type name; persisted preview JSON changes | unproven |
| Card Image | enabled on/off, URL, file, override clear, fit, scale, x, y, fade, fade power, fade size | writes `FeedBackgroundImageRecipe` and story image override map; affects media/fade nodes | unproven |
| Feed Layout | content Y, card gap, news gap | writes `FeedRecipe`; affects feed carousel positioning/gaps | unproven |

### Structure Controls

Source:

- `components/screens/main-material/mainMaterialFeedEditors.tsx`
- `components/screens/main-material/mainMaterialNodeTreeOperations.ts`
- `components/screens/main-material/mainMaterialNodeTemplates.ts`

| Controls | Contract | Status |
| --- | --- | --- |
| Insert inside/after | chooses insertion parent/sibling strategy | partial |
| Add panel/text/2-col/terms | creates template node, inserts at selected location, selects new node | partial |
| Node ops up/down/dup/wrap/unwrap/delete | transforms node tree, updates selection, enables undo snapshot | partial |
| Undo | restores previous tree and selected target for last structure op | browser smoke exists; still partial |

Required structure proof:

1. Every operation has pure tree-operation tests.
2. Every operation has browser proof that selection remains valid.
3. Export descriptors update for inserted/duplicated nodes.
4. Deleting selected nodes does not leave stale DOM registry/export state.

### CMS Controls

Source:

- `components/screens/main-material/mainMaterialFeedEditors.tsx`
- `components/screens/main-material/mainMaterialFeedContentOutput.ts`

| Controls | Contract | Status |
| --- | --- | --- |
| Binding select | binds selected node to a `FeedTextSlotId` or unbinds | partial |
| Copy `ui-node-content` | serializes selected story through editor output registry | partial |
| Content JSON textarea | edits selected story content document draft | partial |
| Apply document | validates `ui-node-content`, applies known content fields, ignores unknown keys | partial |
| Format | parses/validates and pretty-prints draft JSON | partial |
| Reset | restores draft to selected story serialization | partial |
| Selected Field textarea | convenience edit of currently bound field | partial/confusing |

Required CMS proof:

1. Invalid JSON disables apply and shows status.
2. Invalid `ui-node-content` values disable apply and show field/key status.
3. Valid dirty JSON shows changed matching-field count.
4. Apply mutates story state and preview text.
5. Copy output round-trips through `validateEditorOutput('ui-node-content')`.
6. Selected Field edits the same story field as the JSON document path.

### Selected Node Text Controls

Source: `components/screens/main-material/mainMaterialFeedEditors.tsx`

| Controls | Contract | Status |
| --- | --- | --- |
| Text inherit/custom | toggles local node text override object | partial |
| Markup auto/on/off | controls rich markup parsing for selected node | partial |
| Render auto/fit/flow | controls sizing/render mode, with fit disabled for hug dimensions | partial |
| Fit mode/lines | controls `fitMode` and `maxLines` | partial |
| Color/opacity/font/size/weight/style/case/line/paragraph/track | writes local text override only when override checkbox/custom mode allows it | partial |
| Emboss on/mode/power/offset/blur | local text emboss override model | partial |
| Align/Text X/Text Y | local text alignment and offset | partial |

Required selected-node text proof:

1. Disabled override controls cannot write state.
2. Enabling override writes the smallest local text patch.
3. Fit/hug disabled behavior is tested.
4. Text style appears in the canonical feed renderer and Export CSS.

### Layout Controls

Source:

- `components/screens/main-material/mainMaterialFeedEditors.tsx`
- `components/screens/main-material/feedNodeLayoutCss.ts`
- `components/ui/material-node/materialNodeLayoutCss.ts`
- `components/screens/main-material/mainMaterialFeedToNode.ts`

| Controls | Contract | Status |
| --- | --- | --- |
| Mode absolute/flow | switches layout resolution mode | partial/confusing |
| Direction column/row/wrap | controls flex axis/wrap for child flow | partial/confusing |
| Self in-flow/absolute | controls whether x/y constraints are active | partial/confusing |
| Pin H/V | absolute constraint resolver; center makes x/y relative offsets | partial |
| Pin End | pushes in-flow node to parent main-axis end | partial |
| Slot auto/body/footer/overlay | legacy flow slot model | confusing |
| X/Y | absolute coordinate or center offset; disabled for in-flow | partial |
| W/H mode fixed/hug/fill | size-mode resolver; fixed enables size sliders | partial/confusing |
| W/H size | fixed size percent | partial |
| Nudge X/Y | flow transform nudge | partial |
| Pad/Gap | layout padding/gap; button label padding is safely clamped in renderer | partial |
| Align grid | packed cross/main-axis alignment | confusing |
| Spread | between/around/evenly distribution along main axis | confusing |

Required layout proof:

1. Pure resolver tests for each mode/constraint/axis.
2. Canonical renderer bridge tests that emitted inline layout preserves the same
   semantics.
3. Browser geometry tests for center pin + x/y offset, fill/hug/fixed, pad/gap,
   and row/column distribution.
4. UX labels for confusing controls must be revisited after behavior is proven.

Layout proof evidence from 2026-06-12:

- Browser target: `/main-material`, selected
  `feed:card:card_type_01:node:mission-briefing`.
- `Pin V = center` changed the UI label from `Y` to `Y Offset`, emitted
  `top: calc(50%)` with `transform: translateY(-50%)`, and aligned the selected
  node center within `0.004px` of its parent center.
- `Y Offset = 10` emitted normalized `top: calc(60%)` with
  `transform: translateY(-50%)` and moved the selected node center exactly
  `10%` of the parent height below center.
- `mainMaterialFeedToNode.test.ts` now protects the same bridge semantics:
  center pin emits `left/top: calc(50% + offset%)` and keeps
  `translateX(-50%) translateY(-50%)`.
- `W/H fill` is proven for absolutely positioned nodes. The feed layout
  compiler now emits `width: 100%` and `height: 100%`, matching the canonical
  `MaterialNodeLayout` contract instead of preserving stale fixed percentages.
  Browser proof on Mission Briefing showed both fill buttons active, both size
  sliders disabled, live geometry width/height ratios of `1`, and Export CSS
  containing `width: 100%` plus `height: 100%`.
- `feedNodeLayoutCss.test.ts` now covers absolute fixed/hug/fill sizing,
  in-flow fixed/hug/fill sizing, and spread/cross-axis flex declarations.
- `mainMaterialFeedToNode.test.ts` now protects W/H fill through the
  feed-to-canonical bridge.
- Pad/gap/spread are proven through the feed-to-canonical bridge and browser.
  `mainMaterialFeedToNode.test.ts` now guards `gap`, `--feed-node-gap`,
  `--feed-node-padding`, `justify-content: space-between`, and
  `align-items: stretch`. Browser proof on Mission Briefing set `Pad = 24`,
  `Line Gap = 18`, and `Spread Y = between`; the selected frame computed
  `padding: 24px`, `gap: 18px`, and `justify-content: space-between`, while
  Export CSS contained `--feed-node-padding: 24px`, `gap: 18px`,
  `--feed-node-gap: 18px`, `--feed-node-gap-scale: 0.18`, and
  `justify-content: space-between`.
- W/H hug is proven through the feed-to-canonical bridge and browser.
  `mainMaterialFeedToNode.test.ts` now guards `width: max-content` and
  `height: auto` for W/H hug. Browser proof on Mission Briefing clicked the
  real `W hug` and `H hug` buttons: both buttons became active, both size
  sliders disabled, live style emitted `width: max-content; height: auto`, and
  Export CSS contained those declarations. Geometry confirmed the semantic
  nuance: `H hug` shrank the selected frame from full parent height to content
  height (`heightRatio 1 -> 0.2229`), while `W hug` followed intrinsic content
  width and could exceed the parent (`widthRatio 1 -> 1.1738`).
- Row-direction distribution now has a pure editor-control seam plus bridge
  coverage. `mainMaterialFeedLayoutControls.ts` owns the visual grid mapping,
  axis labels, distribution modes, and legacy `align`/`justify` compatibility
  writes. `mainMaterialFeedLayoutControls.test.ts` proves the same visual cell
  maps to the correct cross/distribution axes in column vs row direction, and
  `mainMaterialFeedToNode.test.ts` proves row `distribute: evenly` plus
  `crossAlign: end` reaches canonical CSS as `flex-direction: row`,
  `justify-content: space-evenly`, and `align-items: flex-end`.
- Row-direction distribution is now browser-proven on Mission Briefing. Clicking
  the real `Direction row` button changed the UI labels from `Align X`/`Spread
  Y` to `Align Y`/`Spread X` and emitted `flex-direction: row`. Clicking the
  `BL` packed-alignment cell then `Spread X evenly` emitted live
  `align-items: flex-end` and `justify-content: space-evenly`; Export CSS
  contained `flex-direction: row`, `justify-content: space-evenly`,
  `align-items: flex-end`, and `--feed-node-gap: 18px`. Geometry confirmed the
  cross-axis: children bottoms aligned at the content-box bottom (`606.133px`),
  exactly one 24px padding inset above the container bottom (`630.133px`).
  Nuance: after `Spread X` is set to `evenly`, the 3x3 packed alignment grid no
  longer shows an active cell because the grid only represents packed
  start/center/end distribution.
- Fixed-size and flow layout controls are now contract- and browser-proven.
  `feedNodeLayoutCss.test.ts` covers in-flow positioning, overlay-as-absolute,
  flow nudge transforms, and explicit `Pin End` overrides.
  `mainMaterialFeedToNode.test.ts` proves fixed W/H size, flow/in-flow
  positioning, flow nudge, and footer push-through at the canonical renderer
  bridge. Browser proof on Mission Briefing clicked the real `W fixed` /
  `H fixed` buttons, set `W size = 52` and `H size = 34`, and saw live style
  plus Export CSS emit `width: 52%` and `height: 34%`. It then clicked
  `Mode flow`, `Self in-flow`, `Slot footer`, `Nudge X = 14`, and
  `Nudge Y = -9`; live style and Export CSS emitted `position: relative`,
  `margin-left: auto`, and `transform: translate(14px, -9px)` with stale
  absolute `left: 47%` absent. The `margin-left: auto` result is intentional
  because the selected node was still in row direction; footer/pin-end pushes
  along the active main axis.
- Root feed layout controls now have a shared contract helper. `Content Y`,
  `Copy Lift`, and `Dot Gap` map to `contentY`, `cardGap`, and `newsGap` with
  tested defaults/clamps and tested CSS var emitters:
  `--main-content-y`, `--main-card-gap`, and `--main-news-gap`.
  `MainMaterialPreviewScreen.tsx` now uses the shared sanitizer instead of a
  private duplicate.

### Emission Inspector

Source: `components/screens/main-material/mainMaterialEmissionInspector.tsx`

| Controls | Contract | Status |
| --- | --- | --- |
| Open/close | toggles inspector visibility | unproven |
| Tabs Export DOM/Export CSS/Editor DOM/Frame CSS | switches active payload view | contract |
| Copy | copies active payload | unproven |
| Refresh | refreshes active live DOM/CSS payload | partial |
| Badges toggle | shows/hides provenance badges | unproven |
| CSS class checkboxes | hide/restore CSS classes in inspector view | partial |
| Reset CSS | clears hidden CSS class keys | partial |

Required inspector proof:

1. Every selected target with a descriptor can refresh Export DOM/CSS.
2. Export DOM/CSS comes from live DOM only in normal mode.
3. Copy copies the active tab payload.
4. Hidden class toggles affect inspector output only, not runtime DOM.

Inspector proof evidence:

- `mainMaterialEmissionOutput.test.ts` proves labels, statuses, and active
  payload selection for all visible inspector tabs: Export DOM, Export CSS,
  Editor DOM, and Frame CSS. It also proves empty Editor DOM copy payloads stay
  empty when no editor DOM snapshot is available. Browser proof is still needed
  for the actual Solid tab buttons, copy/refresh, badges, class hiding, and
  reset CSS controls.

## Output Contracts

Every editor action must be classified against output contracts:

| Output | Owner | Controls that affect it |
| --- | --- | --- |
| Preview runtime DOM | product renderers and canonical feed renderer | most visual controls |
| Export DOM | `mainMaterialDomExportGroup.ts` | selected target, renderer output, structure/layout/surface controls |
| Export CSS | `mainMaterialDomAudit.ts` + live stylesheet collection | surface/layout/text controls |
| Frame CSS | `mainMaterialCssProbeTargets.ts` + selected node layout/surface | selected target, CSS probe toggles |
| Preview-state JSON | `mainMaterialPreviewStateAdapter.ts` + persistence | import/export/reset, all editor state controls |
| `material-recipe` JSON | editor output registry | material lab output panes |
| `ui-node-content` JSON | `mainMaterialFeedContentOutput.ts` | CMS document/selected-field controls |
| Future full `ui-node` JSON | `mainMaterialFeedToNode.ts` and UI node validators | structure/layout/content/surface controls |

## Test Bed Strategy

The editor needs test beds in this order:

1. `surface-control-proof`: generated fields by control kind, proving patches,
   disabled rules, and live surface CSS vars.
2. `feed-layout-proof`: selected fixture nodes for absolute/flow/pin/fill/hug,
   with geometry checks.
3. `cms-document-proof`: selected story content JSON round trip and selected
   field equivalence.
4. `structure-operation-proof`: add/remove/move/duplicate/wrap/unwrap with
   selection/export descriptor checks.
5. `inspector-export-proof`: select representative feed/chrome nodes and prove
   Export DOM/CSS/Frame CSS payloads are non-empty, live, and scoped.

## Current Highest-Risk Gaps

1. Layout controls work through several overlapping concepts:
   `mode`, `slot`, `selfPosition`, constraints, x/y, size modes, nudge, pad/gap,
   and distribute. Behavior needs geometry proofs before naming can be trusted.
2. `mainMaterialFeedEditors.tsx` owns too many unrelated control families. It
   should be split into CMS, structure, layout, selected-node text, image, and
   feed-layout subeditors after contracts are stable.
3. Top-level reset/import/export/preset actions are still orchestrated in
   `MainMaterialPreviewScreen.tsx`.
4. Inspector controls need end-to-end proof because they are the user's main
   trust surface for "what did this editor actually emit?"
5. Layout controls need browser geometry proof because their current concepts
   still overlap enough to feel unpredictable.

## Next Implementation Slice

The generated surface editor proof slice is now closed at the current spec
level:

```txt
surfaceFieldMetadata
  -> visibleSurfaceFieldDefinitions
  -> SurfaceFieldControl interaction
  -> patchSurfaceFieldWithContext
  -> SurfaceOptions patch
  -> Surface/DOM CSS vars
```

Completed acceptance for that slice:

1. Every generated field has valid metadata for its control kind:
   `surfaceFieldMetadata.test.ts`.
2. Every generated slider has either numeric range/step or value stops:
   `surfaceFieldMetadata.test.ts`.
3. `SurfaceFieldControl` has interaction tests for toggle, multi-toggle, slider,
   stop-slider, select, color, text, inherit, and disabled states:
   `SurfaceFieldControl.render.test.tsx`.
4. Context patches for texture and edge wear are covered:
   `surfaceEditorFilters.test.ts` and `SurfaceFieldControl.render.test.tsx`
   for live select dispatch.
5. Browser proof confirms a generated control changes live Export CSS for a
   selected material target.

Browser proof evidence from 2026-06-12:

- Target: `/main-material`, selected
  `feed:card:card_type_01:node:mission-briefing`.
- Control: generated `Glass Blur` range input in `MaterialRecipeEditor`.
- Action: changed slider from `3` to `7` through the in-app browser.
- Live DOM evidence: selected `.cd-surface` style changed from
  `--glass-blur: 3px` to `--glass-blur: 7px`.
- Export evidence: active `Export CSS` inspector panel included
  `--glass-blur: 7px` after the change.

The next best implementation slice is `feed-layout-proof`:

```txt
layout controls
  -> feedNodeLayoutCss resolver
  -> mainMaterialFeedToNode bridge
  -> materialNodeLayoutCss/runtime DOM
  -> browser geometry + Export CSS proof
```

Why this next:

- The user has repeatedly called out confusing layout semantics (`Pin V`,
  `x/y`, `distribute`, `fit`, `hug`).
- Layout affects visible editor trust and exported runtime contracts.
- The pure resolver seams exist, and row-direction control mapping now has its
  own tested helper plus browser proof. The next value is finishing the
  remaining visible layout controls: mode/self/slot/wrap/pin-end/nudge/fixed
  size, with browser geometry and Export CSS evidence for each meaningful
  behavior.
