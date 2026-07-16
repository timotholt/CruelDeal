# Mission Briefing V2 static implementation baseline

Scope: current implementation evidence only. This document describes the code
and `fixture.json` as they exist before the semantic-schema/compiler migration;
it does not propose a replacement architecture.

## Baseline identity

- The current story is `season-pass-cosmic-eclipse-v2`, labelled **Mission
  Briefing V2**, with `cardTypeId: "card_type_04"`, image
  `/art/login/editor-temp-bg.png`, and action label `Accept Terms`
  (`components/screens/main-material/mainMaterialFeedModel.ts:1130-1153`).
- The protected fixture records that story plus the fully constructed
  `card_type_04` recipe in
  `docs/references/ui-authoring/mission-v2-current/fixture.json`. Its
  `inputKind` is deliberately `legacy-generic-render-input`; it is a render
  baseline, not a claim that the current model is the desired semantic model.
- Runtime construction starts with the V1 JSON default, then calls
  `createMissionBriefingV2CardType(cardTypes.card_type_01)`
  (`components/screens/MainMaterialPreviewScreen.tsx:1830-1835`). The V1 source
  data is
  `components/screens/main-material/defaults/missionBriefingV1.json`; it is
  loaded by `createDefaultMissionBriefingV1CardType`
  (`components/screens/main-material/mainMaterialFeedModel.ts:808-818`).

## Logical-to-current-code map

| Logical part visible in the baseline | Current generic representation | Implementation evidence |
| --- | --- | --- |
| Mission Briefing V2 | A generic `FeedCardTypeRecipe` named `card_type_04`, cloned from `card_type_01` | `components/screens/main-material/mainMaterialNodeTemplates.ts:231-252` |
| Background art | `FeedCardTypeRecipe.backgroundImage`, bound to `FeedStory.image` | `components/screens/main-material/mainMaterialFeedCarousel.tsx:191-260`; fixture `cardType.backgroundImage` and `story.image` |
| Deadline badge | Top-level generic text node `deadline-badge -> contractBadge` inherited from V1 | `components/screens/main-material/defaults/missionBriefingV1.json:266`; fixture `cardType.children[0]` |
| Mission panel | Top-level generic container `mission-briefing -> contractBriefing`; V2 changes its box to x 5%, y 35%, width 58%, height 50%, padding 16 | `components/screens/main-material/mainMaterialNodeTemplates.ts:231-245`; fixture `cardType.children[1]` |
| Briefing copy | The panel retains the single rich-text `contractBriefing` binding inherited from V1, rather than owning typed title/body/reward fields | V1 binding at `components/screens/main-material/defaults/missionBriefingV1.json:539-544`; V2 only replaces `missionPanel.children` at `components/screens/main-material/mainMaterialNodeTemplates.ts:245` |
| Reward/terms footer | Generic flow container `reward-terms-group`, slot `footer`, pushed to the end, with left/right child containers | `components/screens/main-material/mainMaterialNodeTemplates.ts:169-200`; fixture subtree under `mission-briefing` |
| Reward summary | Generic text node `reward-terms-group-summary -> contractRewardSummary`, rich markup, paragraph fit, maximum four lines | `components/screens/main-material/mainMaterialNodeTemplates.ts:153-167` |
| Fingerprint action | Generic button node `reward-terms-group-fingerprint -> contractCtaLabel`, distinguished by `presentation: "fingerprint-hold"` and `holdDurationMs: 1400` | `components/screens/main-material/mainMaterialNodeTemplates.ts:131-151,169-178` |
| Sector mark | Top-level generic text node `sector-mark -> sectorLabel` inherited from V1 | `components/screens/main-material/defaults/missionBriefingV1.json:1082`; fixture `cardType.children[2]` |

The current model vocabulary is generic: `FeedCardNode` supports only
`container | text | button`, optional binding, layout, surface, presentation,
hold duration, and children
(`components/screens/main-material/mainMaterialFeedModel.ts:181-216`). There is
no runtime `MissionBriefing` or typed fingerprint-action entity in this
baseline.

## Current render and emitted-DOM strategy

1. `feedCardNodeToMaterialNode` recursively converts each generic feed node to a
   `MaterialNodeRecipe`. Layout becomes concrete CSS; content retains its string
   binding; `fingerprint-hold` is converted to the CSS class
   `main-material-fingerprint-hold-node`
   (`components/screens/main-material/mainMaterialFeedToNode.ts:23-80`).
2. `CanonicalFeedCardTree` enriches those recipes with the live story text and
   renders them through the shared `MaterialNodeRenderer`
   (`components/screens/main-material/mainMaterialFeedCarousel.tsx:362-422,505-520`).
3. Every material node receives an outer `div` with
   `data-material-node-id`, `data-material-target-id`, and
   `data-material-role` (`components/ui/material-node/MaterialNodeFrame.tsx:55-66`).
4. A container with a surface emits an absolute background `section`, then a
   child-stack `div`, its bound content, and recursive child node frames. A leaf
   emits its `section` or `button` surface inside its frame
   (`components/ui/material-node/MaterialNodeRenderer.tsx:44-83` and
   `components/ui/material-node/MaterialNodeSurface.tsx:49-94`).
5. Each surface conditionally emits separate decorative spans for material,
   texture, tint, gradient, glass, glow, emission, border, edge wear, edge, and
   corners; glow corners add four nested arc spans. A separate content wrapper
   follows the decorative layers
   (`components/ui/material-lab/surfaceFeatures.ts:661-711` and
   `components/ui/material-lab/Surface.tsx:116-169`). Thus one logical node can
   expand into a frame, surface host, several decorative spans, and content
   wrappers.
6. The fingerprint's material button still emits its normal conditional surface
   layers. Current fingerprint CSS makes every direct child except
   `.cd-button__content` transparent rather than preventing those layers from
   being emitted (`src/styles/main-material-preview.css:738-758`). The
   fingerprint glyph and scan line themselves are efficient pseudo-elements on
   `.main-material-fingerprint-hold-label`, so they add no glyph/scan DOM nodes
   (`src/styles/main-material-preview.css:764-834`).

The carousel mounts every story in one track and moves that track with a CSS
transform; inactive stories therefore remain in the DOM
(`components/screens/main-material/mainMaterialFeedCarousel.tsx:539-557,583-630`;
`src/styles/main-material-preview.css:299-303`). Baseline capture must select the
V2 slide, not merely find a mounted V2 node.

## Fingerprint hold behavior

- Fingerprint identity is inferred twice by testing whether the generated layout
  class string contains `main-material-fingerprint-hold-node`
  (`components/screens/main-material/mainMaterialFeedCarousel.tsx:334-360`).
- Pointer down prevents the default event, resolves the source node by id, starts
  its configured timeout (1400 ms in the fixture), captures the pointer, and
  clears any prior completed state
  (`components/screens/main-material/mainMaterialFeedCarousel.tsx:458-475`).
- Pointer up, leave, or cancel clears the hold and releases capture
  (`components/ui/material-node/MaterialNodeSurface.tsx:61-74` and
  `components/screens/main-material/mainMaterialFeedCarousel.tsx:446-457`).
- The outer node frame always receives
  `main-material-fingerprint-hold-node--ready`; while pressed it receives
  `--holding`; after the timer it receives `--complete` for 520 ms
  (`components/screens/main-material/mainMaterialFeedCarousel.tsx:431-475,488-504`).
- `--holding` animates the scan pseudo-element for
  `--main-material-hold-duration`; `--complete` pulses the glyph and parks the
  scan line at its bottom (`src/styles/main-material-preview.css:844-888`).
- Completion is visual only in this baseline. The timeout changes local CSS
  state but emits no typed action event and calls no product callback.

## Exact selectors for live baseline capture

| Target | Selector / locator |
| --- | --- |
| Phone viewport | `.main-material-phone` |
| Feed stage | `[aria-label="Briefing feed"]` |
| Select current V2 slide (current story order) | `button[aria-label="Show feed slide 2"]` |
| V2 card frame | `[data-material-target-id="feed:card:card_type_04"]` |
| V2 mission panel node | `[data-material-target-id="feed:card:card_type_04:node:mission-briefing"]` |
| Reward/terms group | `[data-material-target-id="feed:card:card_type_04:node:reward-terms-group"]` |
| Fingerprint node frame | `[data-material-target-id="feed:card:card_type_04:node:reward-terms-group-fingerprint"]` |
| Fingerprint button (pointer target) | `[data-material-target-id="feed:card:card_type_04:node:reward-terms-group-fingerprint"] > button` |
| Fingerprint label / pseudo-element anchor | `.main-material-fingerprint-hold-label` |
| Holding-state proof | `[data-material-target-id="feed:card:card_type_04:node:reward-terms-group-fingerprint"].main-material-fingerprint-hold-node--holding` |
| Complete-state proof | `[data-material-target-id="feed:card:card_type_04:node:reward-terms-group-fingerprint"].main-material-fingerprint-hold-node--complete` |

The target-id format is generated as
`feed:card:<cardTypeId>:node:<nodeId>` in
`components/screens/main-material/materialTargetIds.ts:34-45`. Prefer these
target-id selectors over bare `data-material-node-id` values because V1 and V2
reuse node ids such as `mission-briefing` while all slides are mounted.
