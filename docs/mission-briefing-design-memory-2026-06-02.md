# Mission Briefing Design Memory

Date: 2026-06-02
Refactor name: `mission-briefing-design-memory`

This document is a restoration memory for the Mission Briefing defaults before deeper layout/material refactors.

It is not a backwards-compatibility shim, migration layer, or runtime contract. It is a human and agent-readable snapshot of the current look, values, text, and intent so a future prompt can rebuild the Mission Briefing as closely as possible using the newer UI system.

## Source Anchors

Primary source file:

- `components/screens/MainMaterialScreen.tsx`

Important source functions and constants:

- `mockFeedStories`
- `createMissionBriefingLeftNodes`
- `createMissionBriefingCardSurface`
- `createMissionBriefingPanelSurface`
- `createMissionBriefingBadgeSurface`
- `createMissionBriefingCtaSurface`
- `createFeedRegionSurface`

## Restore Prompt

Use this prompt if the Mission Briefing visual gets lost after refactor work:

```text
Restore the Mission Briefing visual using docs/mission-briefing-design-memory-2026-06-02.md.

Do not add a backwards-compatibility shim. Recreate the look using the current refactored component and layout system. Treat the old x/y/w/h values as visual reference values, not mandatory architecture. Preserve the Mission Briefing V1/V2 text, the glass mission panel, the top-right bevel, the left/top border treatment, the bottom CTA placement, the deadline badge, and the sector mark. If the new system supports flow layout plus nudges, prefer that over raw absolute positioning.
```

## Visual Intent

Mission Briefing is a dark, glassy contract card layered over the carousel art. It should feel like a premium in-game briefing panel, not a generic web card.

The current default composition has:

- A compact deadline badge above the mission panel.
- A large glass mission briefing panel on the right side of the feed.
- A CTA button nested inside the mission panel, near the bottom.
- A sector mark near the upper-left area of the feed art.
- Condensed uppercase typography with small gold accent marks.
- A frosted/dark glass treatment with a top-right beveled cut and worn borders.

## Story Defaults

Mission Briefing V1:

| Field | Value |
| --- | --- |
| `id` | `season-pass-cosmic-eclipse` |
| `label` | `Mission Briefing V1` |
| `cardTypeId` | `card_type_01` |
| `image` | `/art/login/main-menu-contract-reference.png` |
| `contractBadge` | `03 Days Left` |
| `contractCtaLabel` | `View Contract` |
| `sectorLabel` | `Sector\n[black]07[/black]` |

Mission Briefing V2:

| Field | Value |
| --- | --- |
| `id` | `season-pass-cosmic-eclipse-v2` |
| `label` | `Mission Briefing V2` |
| `cardTypeId` | `card_type_04` |
| `image` | `/art/login/main-menu-contract-reference.png` |
| `contractBadge` | `03 Days Left` |
| `contractCtaLabel` | `View Contract` |
| `sectorLabel` | `Sector\n[black]07[/black]` |

Note: older snapshots had a trailing space after `View Contract`. Treat that as a bug, not a visual requirement.

## Mission Text

Current rich briefing text:

```text
[h1][acc1]//[/acc1] Active Contract[/h1]
[h2]Data [acc2]Extraction[/acc2][/h2][RULE]Extract encrypted data from Solace Corp mainframe cluster.[DIVIDER]
[h1]Reward[/h1][h3]1,800 [acc1]K[/acc1][/h3]
```

Current split contract fields:

```text
contractEyebrow: [accent]//[/accent] Active Contract
contractTitle: [h1]Data
Extraction[/h1]
contractBody: [rule]
Extract encrypted corporate data from Solace Corp mainframe cluster.
contractRewardLabel: Reward
contractRewardValue: 1,850 [accent]CR[/accent]
contractRule:
contractCtaLabel: View Contract
```

## Layout Snapshot

These are the current absolute layout values. Future refactors should treat them as visual memory, not as proof that absolute positioning is the right model.

| Node | Type | Binding | X | Y | W | H | Pad | Gap | Align | Justify |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `deadline-badge` | text | `contractBadge` | 51 | 10 | 38 | 6 | 0 | 0 | center | center |
| `mission-briefing` | container | `contractBriefing` | 47 | 29 | 39 | 55 | 16 | 0 | center | start |
| `contract-cta` | button | `contractCtaLabel` | 10 | 84 | 83 | 11 | 21 | 0 | center | center |
| `sector-mark` | text | `sectorLabel` | 7 | 11 | 18 | 14 | 0 | 0 | center | start |

Preferred future layout interpretation:

- The mission panel owns internal layout.
- CTA placement should be "bottom, stretched/inset horizontally, centered text" rather than "absolute x/y only."
- `x/y/w/h` may remain as an escape hatch for art-directed placement.
- Use semantic layout knobs first: slot, inset, alignment, justify, min/max size, nudge.

## Card Surface Memory

The card surface is the outer feed-card material behind the content.

| Property | Value |
| --- | --- |
| material | none |
| texture | none |
| textureStrength | 0 |
| textureScale | 512 |
| glass | true |
| glassOpacity | 0 |
| glassBlur | 3 |
| bevelCorners | top-right |
| bevelSize | 18 |
| tint | black |
| tintStrength | 50 |
| gradient | both |
| border | top |
| borderOpacity | 22 |
| lightStrength | 10 |
| darkStrength | 10 |
| sheen | false |
| edgeWear | dense |
| edgeWearOpacity | 0 |
| edgeWearWidth | 1 |
| edgeWearScale | 256 |
| edgeWearLayer | above-highlights |
| radius | 8 |
| contentTone | white |
| contentOpacity | 80 |
| textFontFamily | condensed feed font |
| textSizeRem | 0.65 |
| fontWeight | 100 |
| fontStyle | normal |
| textTransform | none |
| letterSpacing | 0.05 |

## Mission Panel Surface Memory

This is the main glass panel that contains the mission briefing and CTA.

| Property | Value |
| --- | --- |
| material | none |
| texture | none |
| textureStrength | 0 |
| textureScale | 512 |
| glass | true |
| glassOpacity | 41 |
| glassReflectionOpacity | 52 |
| glassBlur | 3 |
| glassHighlightWidth | 100 |
| glassHighlightHeight | 2 |
| glassHighlightY | 0 |
| bevelCorners | top-right |
| bevelSize | 18 |
| tint | none |
| tintStrength | 42 |
| gradient | none |
| border | top, left |
| borderColor | custom |
| borderCustomColor | `#c2c2c2` |
| borderOpacity | 49 |
| lightStrength | 5 |
| darkStrength | 0 |
| sheen | false |
| edgeWear | dense |
| edgeWearOpacity | 45 |
| edgeWearWidth | 1 |
| edgeWearScale | 1024 |
| edgeWearLayer | above-highlights |
| dropShadow | true |
| shadowOpacity | 69 |
| shadowBlur | 22 |
| shadowX | 11 |
| shadowY | 10 |
| shadowSpread | -1 |
| radius | 8 |
| contentTone | white |
| contentOpacity | 90 |
| textFontFamily | condensed feed font |
| textSizeRem | 0.65 |
| fontWeight | 100 |
| fontStyle | normal |
| textTransform | none |
| letterSpacing | 0.05 |

## Deadline Badge Surface Memory

| Property | Value |
| --- | --- |
| material | none |
| texture | stoneGray01 |
| textureStrength | 0 |
| textureScale | 512 |
| glass | false |
| glassOpacity | 35 |
| glassBlur | 5 |
| tint | white |
| tintStrength | 9 |
| gradient | top-light |
| border | all |
| borderOpacity | 24 |
| lightStrength | 22 |
| darkStrength | 8 |
| sheen | true |
| edgeWear | none |
| edgeWearOpacity | 0 |
| edgeWearLayer | below-highlights |
| radius | 4 |
| contentTone | gold |
| contentOpacity | 80 |

## CTA Surface Memory

| Property | Value |
| --- | --- |
| material | custom `#707275` |
| texture | stone04 |
| textureStrength | 84 |
| textureScale | 256 |
| glass | true |
| glassOpacity | 15 |
| glassBlur | 3 |
| glassHighlightWidth | 100 |
| glassHighlightHeight | 32 |
| glassHighlightY | 4 |
| tint | none |
| tintStrength | 0 |
| gradient | both |
| border | all |
| borderColor | custom |
| borderCustomColor | `#eaeaea` |
| borderOpacity | 54 |
| lightStrength | 62 |
| darkStrength | 36 |
| sheen | true |
| edgeWear | dense |
| edgeWearOpacity | 45 |
| edgeWearWidth | 1 |
| edgeWearScale | 1024 |
| edgeWearLayer | above-highlights |
| dropShadow | true |
| shadowOpacity | 58 |
| shadowBlur | 6 |
| shadowX | 0 |
| shadowY | 3 |
| shadowSpread | 0 |
| radius | 6 |
| contentTone | black |
| contentOpacity | 90 |
| textFontFamily | DIN feed font |
| textSizeRem | 0.8 |
| fontWeight | 800 |
| fontStyle | normal |
| textTransform | uppercase |
| letterSpacing | 0.05 |

CTA hover memory:

- Surface hover is enabled.
- Hover tint becomes gold with low strength.
- Hover border opacity and light strength increase slightly.
- Hover glow uses gold and emphasizes the top edge/corners.
- Icon/content hover treatment should feel sharper/brighter, not like a separate color theme.

## Restoration Priorities

If an exact restore is impossible after a future refactor, preserve these in order:

1. Overall composition: right-side mission glass panel, deadline badge above it, CTA near panel bottom, sector mark on left.
2. Typography hierarchy: small eyebrow, large condensed title, compact body, reward label/value, uppercase CTA.
3. Glass material mood: frosted panel, top-right bevel, subtle borders, dense edge wear, drop shadow.
4. CTA usability: centered label, button fills most of panel width, sufficient internal padding, no text clipping.
5. Exact numeric surface settings.
6. Exact old absolute positioning numbers.

## Known Refactor Direction

The future layout system should avoid relying only on absolute child placement. The likely replacement is:

- `layout.mode`: `flow` or `absolute`
- semantic slots such as `header`, `body`, `footer`, `badge`, `cta`
- container-owned spacing, padding, and alignment
- child nudges for art direction
- GameTextV2 for fitted server-sent labels and compact UI text

When restoring this Mission Briefing, use the new system's best idioms and only fall back to absolute placement where the art direction truly needs it.
