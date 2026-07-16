# Mission Briefing V2 Target Visual Analysis

Status: authoritative target extraction; not an implementation design
Date: 2026-07-16
Repository source: `docs/references/ui-authoring/mission-v2-target.png`
Original attachment: `codex-clipboard-54459234-31f3-4604-b2a0-90f48b1e4a76.png`
Source size: 941 × 1672 px (portrait, aspect ratio 0.5628:1)
Source SHA-256: `5861872957eec92ad3d999e98e987ce3a30eae63d5d8ba3e2ab125110ef59a57`

## 1. Target statement

This image is the authoritative visual goal for Mission Briefing V2. Earlier
captures of the current editor describe the migration checkpoint; they do not
replace this target.

The goal is the composition and visual hierarchy shown here: a portrait game
shell over full-bleed mission art, with a large dark Mission Briefing panel
anchored to the lower-left, an integrated fingerprint acceptance action, compact
player and utility chrome at the top, and persistent primary navigation at the
bottom. The right half of the mission art remains intentionally visible so the
glowing data block and hand stay part of the mission story.

This document separates facts observable in the flattened image from choices a
browser implementation must make. A visible effect is a requirement; a
particular DOM structure, CSS property, or number of authored layers is not.

## 2. Measurement convention

Normalized bounds use `[left, top, right, bottom]`, divided by the 941 × 1672
source dimensions. Measurements are approximate visual-edge observations from
the supplied raster, not recovered source coordinates. A later image-diff
harness may refine them without changing the composition.

| Region | Approx. pixel bounds | Normalized bounds | Composition role |
| --- | --- | --- | --- |
| Full-bleed mission art | 0, 0, 941, 1672 | `[0, 0, 1, 1]` | Continuous world/context layer behind every surface |
| Player summary | 16, 28, 450, 285 | `[.017, .017, .478, .170]` | Top-left identity anchor |
| Portrait inside player summary | 17, 45, 197, 285 | `[.018, .027, .209, .170]` | Character focal image and level badge |
| Resource summary | 466, 28, 925, 145 | `[.495, .017, .983, .087]` | Top-right economy/status group |
| Activity navigation | 466, 171, 925, 283 | `[.495, .102, .983, .169]` | Messages, news, missions, and events group |
| Intentional art breathing room | 0, 284, 941, 509 | `[0, .170, 1, .304]` | Keeps environment legible and separates chrome from mission content |
| Mission Briefing panel | 10, 510, 468, 1388 | `[.011, .305, .497, .830]` | Dominant narrative/action surface, lower-left anchored |
| Mission title block | 48, 606, 419, 786 | `[.051, .362, .445, .470]` | Strongest typography in the interface |
| Mission progress marks | 49, 823, 240, 840 | `[.052, .492, .255, .502]` | Compact state/progression cue |
| Mission description | 49, 874, 417, 1003 | `[.052, .523, .443, .600]` | Three-line readable narrative |
| Mission footer divider | 48, 1043, 425, 1048 | `[.051, .624, .452, .627]` | Separates narrative from terms/action |
| Reward/terms region | 48, 1087, 214, 1327 | `[.051, .650, .227, .794]` | Deposit and success values |
| Fingerprint action target | 257, 1081, 427, 1310 | `[.273, .647, .454, .784]` | Primary mission interaction |
| Fingerprint action label | 262, 1324, 422, 1354 | `[.278, .792, .448, .810]` | `ACCEPT TERMS` action name |
| Primary bottom navigation | 16, 1445, 921, 1627 | `[.017, .864, .979, .973]` | Persistent five-destination app navigation |
| Active Home destination | 382, 1445, 556, 1627 | `[.406, .864, .591, .973]` | Selected destination with amber treatment |

The main silhouette is measurable independent of text: the Mission Briefing
occupies about 48.6% of the viewport width and 52.5% of its height, while its
right edge stays near the horizontal midpoint. The top chrome ends near 17% of
viewport height, the mission begins near 30.5%, and the persistent navigation
begins near 86.4%.

## 3. Image-authoritative visual hierarchy

The flattened image establishes this priority order:

1. **Mission identity and choice.** `DATA EXTRACTION`, its description,
   compensation, and `ACCEPT TERMS` form the primary task.
2. **Mission-world focal art.** The illuminated data block and gloved hand on
   the right are not decorative leftovers; they complete the mission narrative
   and balance the left panel.
3. **Player and resource state.** Identity, level, XP, credits, and data remain
   immediately available but are smaller and shallower than the mission panel.
4. **Navigation.** Activity destinations and the persistent bottom navigation
   are recognizable, regularly spaced groups. Home is visibly selected.
5. **Atmosphere and material detail.** Server-room depth, blue light, surface
   texture, hairlines, and amber/cyan accents support the hierarchy without
   overtaking it.

The Mission Briefing is therefore not a centered modal, a full-width hero card,
or a freestanding card placed on an unrelated background. Its asymmetric
relationship with the image subject is part of the target.

## 4. Semantic regions visible in the target

The image supports the following logical component reading. Names describe
purpose, not required DOM tags.

```text
PortraitGameShell
  PlayerSummary
    CharacterPortrait
    PlayerIdentity
    LevelProgress
  ResourceSummary
    CreditsResource
    DataResource
    AddResourceAction
  ActivityNavigation
    MessagesDestination [notification]
    NewsDestination
    MissionsDestination [notification]
    EventsDestination
  MissionBriefing
    AvailabilityStatus
    MissionIdentity
      Title
      Progress
    MissionNarrative
    MissionTermsAndAction
      DepositTerm
      SuccessReward
      FingerprintAcceptanceAction
  PrimaryNavigation
    CollectionDestination
    OperationsDestination
    HomeDestination [selected]
    MarketDestination
    ProfileDestination
```

Semantic invariants implied by the composition:

- the Mission Briefing remains one coherent mission unit;
- mission identity, narrative, compensation, and primary action cannot be
  detached into unrelated generic panels;
- resource items remain a resource group;
- the four activity destinations remain a navigation group;
- the five bottom destinations remain primary navigation, with exactly one
  visibly selected destination in this state;
- portrait, player identity, level, and XP remain one player-summary group.

The plus glyph, notification dots, navigation destinations, and fingerprint
area look interactive. The image alone does not define what the plus action
does, how destinations route, or whether the fingerprint uses click, hold,
biometrics, or another gesture. Those behaviors come from semantic product
contracts. In V2, the separate milestone spec defines the fingerprint as a hold
action; this image defines its visual placement and prominence.

## 5. Composition and spacing facts

- The app uses a portrait, edge-to-edge composition with roughly 1–2% outer
  gutters for framed chrome. It does not use a centered desktop page column.
- Top chrome is a deliberate two-column composition: one large player card on
  the left and two shallower grouped surfaces on the right.
- A roughly 13.5%-of-height uninterrupted art interval separates top chrome
  from the Mission Briefing. Filling this interval with additional controls
  would materially change the target.
- The Mission Briefing is anchored to the left edge with about a 1% gutter and
  extends to approximately the viewport midpoint.
- The panel leaves the bright data block and hand unobscured on the right. The
  subject overlap begins near the panel edge and visually connects art and UI.
- Mission content has a consistent left inset of about 4% of viewport width
  (roughly 8% of panel width).
- The narrative occupies the upper two-thirds of the panel; terms and action
  share the lower section on opposite sides of an internal vertical division.
- The bottom navigation uses five near-equal cells separated by narrow gaps.
  The active Home cell preserves the same footprint as its peers.
- The mission panel and bottom navigation do not overlap. A visible art gap of
  about 3.4% of viewport height remains between them.

The panel outline uses chamfered/clipped transitions rather than a plain
rectangle: notably at its upper-left, upper-right, lower-left, and lower-right
silhouette. The exact polygon coordinates are not recoverable from the raster,
but the angular silhouette is authoritative.

## 6. Material and conceptual layer families

These are visible appearance concepts. They are not a requirement for one DOM
element per item.

| Family | Image-authoritative fact | Not established by the image |
| --- | --- | --- |
| World media | A sharp, full-bleed blue server-room scene remains visible through and around UI | Whether it is one bitmap, multiple media layers, or a generated composite |
| Readability surface | Mission and chrome surfaces are very dark, partially reveal background structure, and preserve high text contrast | Exact opacity, blend mode, or use of `backdrop-filter` |
| Surface texture | Fine hex/honeycomb and mottled/noisy detail appears on dark surfaces | Whether texture is procedural CSS, SVG, or raster |
| Edge system | Thin cool-white/gray hairlines, clipped geometry, restrained highlights, and subtle shadow separation define panels | A required nesting depth or dedicated border elements |
| Amber accent | Amber marks level, progress, reward currency, notifications, and active Home state | One exact hex value across every state |
| Cyan accent | Cyan/blue identifies data, environmental energy, and the held data-block focal point | Whether cyan is emitted light, image content, shadow, or glow filter |
| Localized glow | The active Home cell and illuminated data block have concentrated light; inactive cards remain restrained | A global glow layer or glow on every surface |
| Iconography | Thin-line, geometric icons use consistent visual weight and ample interior space | A specific icon library or SVG implementation |
| Reflection/depth | Bright edge runs and soft environmental variation imply depth in the glass/gunmetal surfaces | Physically correct glass, reflection simulation, or shader use |

The practical visual stack is: full-bleed media, local darkening/readability,
surface texture, edge treatment, content/icons, and localized state light. A
compiler may lower several of these concepts into backgrounds, masks,
pseudo-elements, shadows, or paint slots on one semantic element.

## 7. Typography roles

The exact font files cannot be identified from a flattened image. The target
does establish role, proportion, casing, density, and contrast.

| Role | Observable treatment | Approximate source-pixel scale |
| --- | --- | ---: |
| Mission title | Very large condensed uppercase, two lines, off-white/gray, strongest type | 58–68 px cap-height class |
| Mission eyebrow | Small condensed uppercase with amber double-slash marker | 21–25 px |
| Mission body | Tall narrow sentence case, generous line spacing, three lines | 25–30 px |
| Terms labels | Narrow uppercase, muted gray | 21–25 px |
| Terms values | Large condensed numerals with amber `CR` suffix | 52–64 px numerals |
| Action label | Condensed uppercase centered under fingerprint | 23–28 px |
| Player identity/status | Condensed uppercase/figures, off-white, medium hierarchy | 24–30 px |
| Resource values | Large condensed figures with smaller uppercase resource label | 28–36 px value |
| Navigation labels | Condensed uppercase, centered under outline icons | 21–27 px |

Additional typography facts:

- labels are predominantly uppercase;
- text uses a narrow/condensed industrial silhouette rather than a wide
  geometric sans;
- mission body line-height is deliberately open despite the condensed face;
- resource and reward figures align cleanly and behave like tabular data;
- off-white, muted gray, amber, and cyan carry hierarchy; pure white is used
  sparingly;
- no body copy or action label is placed directly over the un-darkened bright
  background.

Matching these metrics with a different font may still fail visually because
glyph width and cap-height determine wrapping. Font identity is an asset choice
to resolve during implementation, not a fact this raster can prove.

## 8. Interaction placement and states

Image-authoritative placement facts:

- the fingerprint action occupies the lower-right half of the Mission
  Briefing footer and is paired with compensation on the left;
- the fingerprint glyph is much larger than ordinary icons and is framed by
  four amber corner brackets;
- `ACCEPT TERMS` sits immediately below the glyph inside the panel;
- the fingerprint area has enough visual separation to read as the mission's
  primary action without a conventional filled CTA button;
- notification dots appear on Messages and Missions;
- Home is the only selected bottom destination, indicated through amber fill,
  border/glow, label color, underline, and a small centered bottom marker;
- inactive navigation cells retain the same shape and layout as the active
  cell.

The supplied frame represents one static visual state. It does not reveal
hover, focus-visible, holding progress, completion, disabled, error, reduced
motion, notification count, or route-transition states. Those states must be
designed from the same material grammar without claiming that this image shows
them. State changes should not alter component identity or rearrange the shell.

## 9. Responsive invariants

The source proves one 941 × 1672 portrait composition. It does not prove exact
breakpoints or landscape behavior. Responsive work should preserve these
derived invariants:

1. player summary remains a coherent identity group and resource/activity
   groups remain coherent utility groups;
2. the mission title remains the strongest text and retains a readable
   two-line treatment where the target aspect ratio is available;
3. the Mission Briefing remains left-anchored and leaves a meaningful right
   art field for the data block and hand at portrait target sizes;
4. reward terms and fingerprint action remain side by side when space permits,
   never overlap, and never escape the Mission Briefing;
5. the persistent five-item primary navigation remains ordered, evenly spaced,
   and visibly single-selected;
6. the Mission Briefing stays above primary navigation with an intervening art
   gap;
7. the background focal position preserves the data block and hand rather than
   centering the source image blindly;
8. clipped silhouettes, hairline edges, surface texture, and localized state
   lighting scale without becoming visually heavy;
9. text contrast and minimum interactive target sizes take priority if a
   viewport cannot preserve the reference geometry exactly.

For first-target comparison, render at 941 × 1672 CSS pixels or an exact uniform
scale of that aspect ratio. Major-region geometry should initially remain
within about ±1.5% of viewport width/height from the normalized bounds above.
That tolerance is a calibration target for layout work, not permission to
ignore typography, focal cropping, material, or interaction differences.

No claim about desktop, landscape, foldable, or extremely narrow behavior can
be extracted from this single portrait image. Those modes require an explicit
product decision rather than extrapolation disguised as visual fact.

## 10. Explicit non-goals

- Do not replace the target with the current editor checkpoint merely because
  the checkpoint is already implemented.
- Do not turn the Mission Briefing into a centered modal, full-width card, or
  generic dashboard tile.
- Do not cover, crop away, or visually subordinate the glowing data block and
  hand to simplify panel layout.
- Do not treat every decorative line, texture, reflection, bracket, bevel, or
  glow as a semantic child or required DOM element.
- Do not hard-code the product to a 941 × 1672 device. That size is the reference
  comparison viewport, not the only supported viewport.
- Do not infer exact CSS blur, opacity, blending, font identity, icon library,
  asset decomposition, or layer count from a flattened raster.
- Do not reproduce incidental AI-image artifacts, tiny pseudo-technical copy,
  or ambiguous logo geometry as product semantics.
- Do not invent additional cards or dashboard content for the open art interval
  between top chrome and the Mission Briefing.
- Do not broaden the Mission Briefing slice into rebuilding every top or bottom
  shell component before the mission component itself can compile and behave
  correctly.
- Do not use pixel perfection as justification for a many-layer DOM or for
  abandoning semantic component boundaries.

## 11. Implementation-choice boundary

The following remain implementation decisions and must be judged against the
visual facts above plus the semantic compiler specifications:

- whether the shell art is one responsive asset, an art-directed crop, or a
  composite;
- which font assets and icon set best reproduce the observed metrics;
- whether clipped corners lower to `clip-path`, masks, border images, or another
  browser-supported technique;
- whether texture and edge treatments use backgrounds, SVG, pseudo-elements,
  masks, shadows, or shared paint slots;
- how many semantic elements are needed for content and accessibility;
- the exact breakpoint at which reward/action or top chrome must reflow;
- focus, holding, completion, disabled, reduced-motion, and error treatments;
- the action event, routing, data binding, and resource-purchase behavior;
- how deterministic assets, fonts, browser profile, and screenshots are pinned.

The correct implementation is the smallest semantic structure that reproduces
this composition and its required states reliably. Visual fidelity is judged
against the image; DOM shape and compiler lowering are judged against the
architecture contract.
