# Game UI Skinning And CMS Agent Spec

Status: active
Date: 2026-06-06
Related:

- `docs/first-class-surface-architecture-spec.md`
- `docs/schema-driven-surface-editor-spec.md`
- `docs/ui-template-cms-content-contract.md`
- `docs/solidjs-server-driven-ui-skins-migration-plan.md`

## Goal

Make Cruel Deal game UI skinning and CMS data first-class enough that bespoke
screen code can consume safe JSON for:

- global colors, fonts, type scale, spacing, radius, icon sizing, and density
- named component skin slots such as top bar, resource chip, bottom nav item,
  toolbar item, promo card, and CTA
- structured CMS objects such as news, store promos, resources, nav items, deck
  summary, profile summary, mission briefs, and timed events
- named placements such as home hero promo, news rail, store banner, top bar
  resources, bottom nav tabs, and toolbar actions
- minor layout choices such as density, compactness, media crop/focal point,
  card emphasis, row count, and CTA visibility

The system must not become a general JSON layout engine. Bespoke SolidJS screen
components continue to own screen structure, responsive layout, real gameplay
behavior, and composition.

## Non-Goals

- Do not express every screen entirely as JSON.
- Do not replace `HomeScreen`, `TopBar`, `BottomNav`, or future feature screens
  with a universal renderer.
- Do not allow arbitrary CSS, HTML, JavaScript, URLs, or functions from CMS,
  themes, placements, or skins.
- Do not make CMS decide game actions outside a client allowlist.
- Do not store editor-only metadata in product DOM.
- Do not block bespoke one-off UI when a screen has genuinely custom gameplay
  composition.

## Core Split

```txt
Bespoke screen code
  owns layout, responsive behavior, gameplay composition, shell, route behavior

Theme JSON
  owns shared visual tokens and named component skin slots

CMS JSON
  owns structured content objects and safe game-object references

Placement JSON
  owns which CMS objects appear in predefined screen slots

Surface JSON
  owns material/panel/button rendering via SurfaceOptions + sparse states
```

Bespoke components should ask for named contracts:

```tsx
<GameTopBar
  profile={cms.profile}
  resources={placementResources}
  skin={theme.skins.topBar}
/>

<PromoSlot
  placementId="home.heroPromo"
  promo={cms.promos[placements.home.heroPromo]}
  skin={theme.skins.heroPromo}
/>

<GameBottomNav
  items={cms.nav.bottom}
  activeId="home"
  skin={theme.skins.bottomNav}
/>
```

They should not consume raw arbitrary layout JSON.

## Existing Baseline

Already present:

- `SurfaceOptions` and surface validation in
  `components/ui/material-lab/surfaceSchema.ts` and
  `components/ui/material-lab/surfaceValidate.ts`
- skin manifest validation/resolution in
  `components/ui/material-lab/skinManifest.ts` and
  `components/ui/material-lab/skinRegistry.ts`
- proof-level `UiNodePayload` template/CMS/theme split in
  `components/ui/material-lab/uiNodeValidate.ts`,
  `components/ui/material-lab/UiNode.tsx`, and
  `components/screens/UiNodePreviewScreen.tsx`
- rich text theme validation in
  `components/ui/material-lab/uiNodeRichTextTheme.ts`
- surface field metadata and generated editor controls in
  `components/ui/material-lab/surfaceFieldMetadata.ts`,
  `SurfaceFieldControl.tsx`, and `SurfaceGeneratedEditor.tsx`

This spec builds a higher-level game UI contract above those pieces.

## Data Documents

The runtime should accept three logical JSON documents. They may live in one
file during development, but validators should keep them separate.

```txt
GameUiTheme
  visual tokens + named component skin slots

GameCmsContent
  structured content objects and safe references

GameUiPlacements
  named slot -> CMS object ids
```

### 1. GameUiTheme

Purpose: define reusable visual language and component skin slots.

Required top-level shape:

```ts
interface GameUiTheme {
  schemaVersion: 1;
  id: string;
  label?: string;
  palette: GamePaletteTokens;
  typography: GameTypographyTokens;
  spacing: GameSpacingTokens;
  radius: GameRadiusTokens;
  icon: GameIconTokens;
  surfaces: Record<string, GameSurfaceRecipe>;
  textStyles: Record<string, GameTextStyle>;
  skins: GameComponentSkins;
}
```

#### Palette Tokens

Palette tokens are semantic, not raw usage names.

```ts
interface GamePaletteTokens {
  bg: string;
  panelStone: string;
  panelDark: string;
  panelLight: string;
  textPrimary: string;
  textMuted: string;
  textInverse: string;
  gold: string;
  cyan: string;
  danger: string;
  success: string;
  divider: string;
}
```

What this buys:

- one global place to make a season/event/theme feel warmer, colder, darker, or
  cleaner
- bounded color vocabulary for editors and agents
- safe validation with hex/rgb-like allowlisted colors only
- consistent color language across top bar, nav, promo cards, rich text, and
  resource chips

Acceptance:

- invalid colors fail validation
- component skins reference palette tokens or approved direct color values
- swapping `gold` changes at least bottom nav active, CTA accent, and promo
  highlights in the proof screen without screen code changes

#### Typography Tokens

```ts
interface GameTypographyTokens {
  heading: GameFontToken;
  body: GameFontToken;
  condensed: GameFontToken;
  mono: GameFontToken;
  numeric: GameFontToken;
}

interface GameFontToken {
  family: string;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  letterSpacing?: number;
  lineHeight?: number;
}
```

What this buys:

- screen code can request `heading`, `numeric`, or `condensed` without knowing
  raw font stacks
- the editor can expose font families and weights once, not per component
- resource amounts, XP, deck stats, nav labels, and promo headings can share
  consistent typography

Acceptance:

- invalid font families are rejected using the same safe-family philosophy as
  `uiNodeRichTextTheme.ts`
- top bar resource numbers and bottom nav labels can change font token through
  theme only

#### Spacing, Radius, Icon, And Density Tokens

```ts
interface GameSpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  density: 'compact' | 'comfortable' | 'cinematic';
}

interface GameRadiusTokens {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

interface GameIconTokens {
  sm: number;
  md: number;
  lg: number;
  strokeWidth: number;
}
```

What this buys:

- minor layout tuning without making layout JSON first-class
- predictable compact/comfortable/cinematic variants for shared shell components
- icon scale consistency across resource chips, toolbars, bottom nav, and CTAs

Acceptance:

- no token may exceed safe bounds, e.g. spacing 0-80, radius 0-48, icon 8-96
- switching density changes shell/component spacing but not screen structure

### 2. GameSurfaceRecipe

Purpose: bind the existing surface pipeline to named theme recipes.

```ts
interface GameSurfaceRecipe {
  surface: SurfaceOptions;
  states?: Partial<Record<'hover' | 'active' | 'pressed', Partial<SurfaceOptions>>>;
}
```

Rules:

- use `SurfaceOptions` validation for `surface`
- use sparse `surfaceStates` validation for states
- no component-specific button props inside surface recipe
- no editor-only metadata

What this buys:

- existing material renderer stays the source of truth
- hover/pressed behavior remains CSS-like sparse inheritance
- named surfaces can be reused by component skin slots

Acceptance:

- invalid surface fields fail validation
- invalid state overlay keys fail validation
- component proof can render a named surface recipe on button and panel hosts

### 3. GameTextStyle

Purpose: create reusable text styles that are not tied to one rich text block.

```ts
interface GameTextStyle {
  tone?: keyof GamePaletteTokens | 'inherit';
  font?: keyof GameTypographyTokens;
  sizeRem?: number;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  lineHeight?: number;
  letterSpacing?: number;
  transform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize' | 'inherit';
  opacity?: number;
  embossMode?: 'inherit' | 'none' | 'dark' | 'light' | 'shadow';
  embossStrength?: number;
  embossOffset?: number;
  embossBlur?: number;
}
```

What this buys:

- bottom nav labels, top bar labels, promo titles, CTA labels, and resource
  amounts can share style names
- rich text theme can eventually point at these styles instead of carrying a
  parallel type system
- the material editor can offer text style presets

Acceptance:

- `textStyles.navLabel` and `textStyles.resourceAmount` can be applied to proof
  components
- unknown token references fail validation

### 4. GameComponentSkins

Purpose: map theme tokens and surface recipes onto known bespoke components.

```ts
interface GameComponentSkins {
  screenShell: ScreenShellSkin;
  topBar: TopBarSkin;
  resourceChip: ResourceChipSkin;
  avatarBlock: AvatarBlockSkin;
  bottomNav: BottomNavSkin;
  toolbar?: ToolbarSkin;
  promoCard: PromoCardSkin;
  heroPromo: HeroPromoSkin;
  cta: CtaSkin;
}
```

This is not a freeform map for arbitrary components. Each entry is a known game
component contract with documented fields.

#### ScreenShellSkin

```ts
interface ScreenShellSkin {
  backgroundTone?: keyof GamePaletteTokens;
  backgroundImageId?: string;
  backgroundDim?: number;
  safeAreaPadding?: keyof GameSpacingTokens;
  contentDensity?: 'compact' | 'comfortable' | 'cinematic';
}
```

Buys:

- global shell mood and density without changing route code
- per-theme background art binding
- safe area tuning for phone/tablet proofs

#### TopBarSkin

```ts
interface TopBarSkin {
  surface: keyof GameUiTheme['surfaces'];
  profileText: keyof GameUiTheme['textStyles'];
  resourceAmountText: keyof GameUiTheme['textStyles'];
  resourceLabelText?: keyof GameUiTheme['textStyles'];
  gap?: keyof GameSpacingTokens;
  avatarSize?: 'sm' | 'md' | 'lg';
  resourceChipVariant?: 'solid' | 'glass' | 'minimal';
}
```

Buys:

- every screen can share the same top bar component
- themes can make the top bar stone, glass, dark, or white without code changes
- profile/resource typography becomes consistent

Component-level acceptance:

- `GameTopBar` renders profile, level, XP progress, and resources from CMS data
- changing `TopBarSkin.surface` changes top bar material only
- top bar still owns layout; theme only changes allowed knobs

#### ResourceChipSkin

```ts
interface ResourceChipSkin {
  surface: keyof GameUiTheme['surfaces'];
  amountText: keyof GameUiTheme['textStyles'];
  labelText?: keyof GameUiTheme['textStyles'];
  iconTone?: keyof GamePaletteTokens;
  showLabel?: boolean;
  showPlusButton?: boolean;
}
```

Buys:

- currency/data/shards chips can repeat in top bar, store, rewards, and cards
- store/live-ops can add or hide plus affordances safely
- resource chips stay game-owned components, not arbitrary JSON nodes

#### BottomNavSkin

```ts
interface BottomNavSkin {
  containerSurface: keyof GameUiTheme['surfaces'];
  itemSurface: keyof GameUiTheme['surfaces'];
  activeItemSurface: keyof GameUiTheme['surfaces'];
  labelText: keyof GameUiTheme['textStyles'];
  activeLabelText?: keyof GameUiTheme['textStyles'];
  iconSize?: keyof GameIconTokens;
  activeIndicator?: 'none' | 'underline' | 'glow' | 'notch';
}
```

Buys:

- every screen can share the same nav structure
- active/hover/pressed nav state is skinnable through existing surface states
- badge dots and active indicators can be consistent

Acceptance:

- active tab changes visual state with no bespoke per-screen CSS
- each nav item has minimum touch target size in proof tests

#### ToolbarSkin

```ts
interface ToolbarSkin {
  containerSurface: keyof GameUiTheme['surfaces'];
  itemSurface: keyof GameUiTheme['surfaces'];
  activeItemSurface?: keyof GameUiTheme['surfaces'];
  labelText: keyof GameUiTheme['textStyles'];
  showLabels?: boolean;
}
```

Buys:

- screens can opt into a shared toolbar while keeping their own content
- toolbar can be hidden on screens that do not need it
- toolbar visual language stays aligned with bottom nav/top bar

#### PromoCardSkin And HeroPromoSkin

```ts
interface PromoCardSkin {
  surface: keyof GameUiTheme['surfaces'];
  titleText: keyof GameUiTheme['textStyles'];
  bodyText: keyof GameUiTheme['textStyles'];
  eyebrowText?: keyof GameUiTheme['textStyles'];
  ctaSkin?: keyof GameComponentSkins['cta'];
  mediaTreatment?: 'none' | 'cover' | 'contain' | 'right-cutout' | 'background';
  emphasis?: 'quiet' | 'standard' | 'featured';
}

interface HeroPromoSkin extends PromoCardSkin {
  minHeight?: 'sm' | 'md' | 'lg';
  overlay?: 'none' | 'left-gradient' | 'bottom-gradient' | 'panel';
}
```

Buys:

- home/news/store ad space can share content structure but vary presentation
- promo content can change daily without screen code changes
- media crop/focal point stays bounded

Acceptance:

- a hero placement swap changes visible promo content without route/component
  changes
- missing promo media falls back to a readable text-only promo card

#### CtaSkin

```ts
interface CtaSkin {
  surface: keyof GameUiTheme['surfaces'];
  labelText: keyof GameUiTheme['textStyles'];
  iconTone?: keyof GamePaletteTokens;
  iconPosition?: 'left' | 'right';
  minHeight?: number;
}
```

Buys:

- CTAs across promo cards, mission cards, store offers, and event cards can
  share hover/pressed behavior
- fixes like text emboss inheritance and layer brightness belong to skin data
  rather than one-off CSS patches

## CMS Content Contract

Purpose: structured game content, not arbitrary render instructions.

```ts
interface GameCmsContent {
  schemaVersion: 1;
  locale: string;
  profile: ProfileSummary;
  resources: Record<string, ResourceBalance>;
  nav: {
    bottom: NavItem[];
    toolbar?: NavItem[];
  };
  promos: Record<string, PromoItem>;
  news: Record<string, NewsItem>;
  storeOffers: Record<string, StoreOffer>;
  missions: Record<string, MissionBrief>;
  decks?: Record<string, DeckSummary>;
}
```

### ProfileSummary

```ts
interface ProfileSummary {
  id: string;
  displayName: string;
  title?: string;
  level: number;
  xpCurrent?: number;
  xpMax?: number;
  avatarImageId?: string;
  badgeImageId?: string;
}
```

Buys:

- every screen top bar can use the same profile object
- profile data is localizable/display-safe
- avatar/media id resolution stays client-owned

### ResourceBalance

```ts
interface ResourceBalance {
  id: string;
  label: string;
  amount: number;
  iconId: string;
  tone?: keyof GamePaletteTokens;
  action?: SafeActionRef;
}
```

Buys:

- top bar resources, rewards, and store prices share shape
- plus buttons can use safe actions like `openStoreCurrency`

### NavItem

```ts
interface NavItem {
  id: string;
  label: string;
  iconId: string;
  routeId: string;
  badge?: 'dot' | number | string;
  disabled?: boolean;
}
```

Buys:

- bottom nav labels/icons/badges can come from CMS/live config
- route handling remains client-owned through route allowlist

### PromoItem

```ts
interface PromoItem {
  id: string;
  kind: 'news' | 'store' | 'event' | 'season' | 'mission' | 'community';
  title: string;
  eyebrow?: string;
  body?: string;
  imageId?: string;
  focalPoint?: { x: number; y: number };
  cta?: CtaContent;
  startsAt?: string;
  endsAt?: string;
  priority?: number;
  analyticsId?: string;
}
```

Buys:

- “ad space” for game news/store/event content without arbitrary ad markup
- scheduling and fallback logic
- content analytics IDs
- bounded media behavior

### NewsItem, StoreOffer, MissionBrief, DeckSummary

These can be separate objects when game systems need richer fields.

```ts
interface NewsItem {
  id: string;
  category: 'patch' | 'event' | 'community' | 'system';
  title: string;
  summary: string;
  imageId?: string;
  cta?: CtaContent;
  publishedAt?: string;
}

interface StoreOffer {
  id: string;
  title: string;
  description?: string;
  priceResourceId?: string;
  priceAmount?: number;
  rewardIds?: string[];
  imageId?: string;
  cta?: CtaContent;
  startsAt?: string;
  endsAt?: string;
}

interface MissionBrief {
  id: string;
  title: string;
  faction?: string;
  location?: string;
  description: string;
  rewardResourceId?: string;
  rewardAmount?: number;
  difficulty?: 'easy' | 'normal' | 'hard' | 'elite';
  estimatedMinutes?: number;
  cta?: CtaContent;
}

interface DeckSummary {
  id: string;
  title: string;
  archetype?: string;
  power?: number;
  rank?: string;
  cardCount?: number;
  maxCards?: number;
  imageId?: string;
  cta?: CtaContent;
}
```

## Safe Actions

CMS may request only allowlisted action ids and safe params.

```ts
interface CtaContent {
  label: string;
  action: SafeActionRef;
}

interface SafeActionRef {
  id:
    | 'openNews'
    | 'openStoreOffer'
    | 'openEvent'
    | 'openMission'
    | 'openDeck'
    | 'openRoute'
    | 'openProfile'
    | 'openCurrencyStore';
  params?: Record<string, string | number | boolean>;
}
```

Rules:

- CMS supplies requested action and target ids.
- client action router validates route/target/action compatibility.
- no executable functions or arbitrary URLs.

Acceptance:

- invalid action id fails CMS validation
- known action id with bad params fails action resolution
- click handler receives safe resolved action

## Placement Contract

Purpose: route content into known screen slots.

```ts
interface GameUiPlacements {
  schemaVersion: 1;
  home: {
    heroPromo?: string;
    newsRail?: string[];
    storePromo?: string;
    activeMission?: string;
    deckSummary?: string;
  };
  shell: {
    bottomNav?: string[];
    toolbar?: string[];
    topBarResources?: string[];
  };
  store?: {
    featuredOffer?: string;
    offerRail?: string[];
  };
}
```

Rules:

- placement ids point to CMS object ids
- unknown ids do not crash; resolver returns fallback evidence
- screen code decides which placements it supports
- placement JSON never decides absolute coordinates

What this buys:

- live ops can swap home hero promo, news rail, and store banner
- screens keep bespoke layout
- A/B testing can later select placement variants
- missing content has deterministic fallback

Acceptance:

- placement resolver returns ordered CMS objects for `home.newsRail`
- unknown promo id records a diagnostic and falls back
- swapping `home.heroPromo` changes composed proof content without code changes

## Validation Modules To Implement

Suggested files:

```txt
components/ui/game-ui/gameUiThemeSchema.ts
components/ui/game-ui/gameCmsSchema.ts
components/ui/game-ui/gamePlacementSchema.ts
components/ui/game-ui/gameUiResolvers.ts
components/ui/game-ui/gameUiFixtures.ts
components/ui/game-ui/gameUiDiagnostics.ts
```

Each schema file should export:

```ts
validateGameUiTheme(input: unknown, label?: string): GameUiTheme | null
validateGameCmsContent(input: unknown, label?: string): GameCmsContent | null
validateGameUiPlacements(input: unknown, label?: string): GameUiPlacements | null
```

Validation behavior:

- structural schema failures return `null` and route through `fault()`
- unsafe unknown keys are rejected
- surface payloads use existing surface validators
- missing optional entries are allowed only where components can provide
  deterministic fallbacks

## Resolver Modules To Implement

```ts
interface GameUiRuntime {
  theme: GameUiTheme;
  cms: GameCmsContent;
  placements: GameUiPlacements;
}

interface ResolvedComponentSkin<TSkin> {
  skin: TSkin;
  diagnostics: GameUiDiagnostic[];
}

interface PlacementResult<T> {
  items: T[];
  diagnostics: GameUiDiagnostic[];
}
```

Required resolver functions:

```ts
resolveSurfaceRecipe(theme, surfaceId): GameSurfaceRecipe
resolveTextStyle(theme, textStyleId): ResolvedTextStyle
resolveTopBarSkin(theme): ResolvedComponentSkin<TopBarSkin>
resolveBottomNavSkin(theme): ResolvedComponentSkin<BottomNavSkin>
resolvePromoPlacement(runtime, placementPath): PlacementResult<PromoItem>
resolveShellResources(runtime): PlacementResult<ResourceBalance>
resolveBottomNavItems(runtime): PlacementResult<NavItem>
resolveSafeAction(cmsAction, context): SafeActionRef | null
```

Resolver rules:

- do not throw for missing optional content in runtime rendering
- return diagnostics for missing ids, incompatible object kinds, and fallbacks
- tests should assert diagnostics, not console output

## Components To Implement

Suggested directory:

```txt
components/ui/game-ui/
```

Minimum first slice:

```txt
GameScreenShell.tsx
GameTopBar.tsx
ResourceChip.tsx
GameBottomNav.tsx
PromoCard.tsx
PromoSlot.tsx
gameUi.css
```

These components are not generic screen builders. They are shared bespoke game
UI components with narrow JSON skin/CMS inputs.

### GameScreenShell

Props:

```ts
interface GameScreenShellProps {
  runtime: GameUiRuntime;
  activeRouteId: string;
  toolbar?: JSX.Element;
  children: JSX.Element;
}
```

Responsibilities:

- apply shell skin tokens
- render top bar from profile/resources
- render optional toolbar when supplied
- render bottom nav from placements/CMS
- render screen content children

Component tests:

- renders top bar and bottom nav for valid runtime
- does not render toolbar unless provided
- preserves child content
- reports missing nav placement diagnostics

### GameTopBar

Responsibilities:

- render profile/avatar/level/XP when present
- render shell resources from placement order
- consume `TopBarSkin` and `ResourceChipSkin`

Tests:

- profile text appears
- resource amounts appear in placement order
- changing skin surface id changes host surface props
- missing avatar id does not crash

### GameBottomNav

Responsibilities:

- render nav items
- mark active route
- pass active item surface/state to active tab
- call client route action when clicked

Tests:

- active nav item has active skin
- disabled nav item does not trigger action
- badge dot/count renders
- touch target min dimensions are represented by CSS class or style

### PromoCard / PromoSlot

Responsibilities:

- resolve a promo/news/store object by placement
- render title, eyebrow, body, media, CTA when present
- use promo/hero skin
- route CTA through safe action handler

Tests:

- hero promo placement changes visible title
- missing media remains readable
- invalid action is rejected by resolver
- CTA emits safe action payload

## Proof Routes

Add a dev proof route:

```txt
localhost:3000/game-ui-skin-proof
```

Suggested file:

```txt
components/screens/GameUiSkinProofScreen.tsx
```

The proof route should render:

- `GameScreenShell`
- `GameTopBar`
- `ResourceChip`
- `PromoSlot` for `home.heroPromo`
- `PromoCard` rail for `home.newsRail`
- `GameBottomNav`
- a small JSON inspector showing active theme/cms/placements

It should include two theme fixtures:

- dark stone/cyberpunk
- light marble/kitsune

And two placement fixtures:

- home hero points to season/event promo
- home hero points to store/news promo

Acceptance:

- toggling theme fixture changes color/font/material mood without code changes
- toggling placement fixture changes promo content without code changes
- shell/top bar/bottom nav composition remains stable

## Goal-Seeking Agent Loop

Agents executing this spec must be given a bounded objective, allowed files, and
verification commands.

Example objective:

```txt
Implement first validated GameUiTheme/GameCmsContent/GameUiPlacements slice and
render a proof screen where theme and placement fixture toggles visibly change
skin and CMS content without changing bespoke screen layout.
```

### Agent Inputs

```txt
objective
  concrete behavior to make true

allowed files
  directories/modules the agent may edit

allowed knobs
  schema fields, theme tokens, skins, CMS fixture values, component props

forbidden changes
  no arbitrary CSS payloads, no universal layout engine, no product DOM editor
  metadata, no unrelated screen rewrites

verification commands
  exact commands to run

visual acceptance
  screenshots/checks required when browser is available
```

### Loop

1. Read this spec and current checkpoint.
2. Inspect only files relevant to the current packet.
3. Implement one bounded slice.
4. Run component tests for the slice.
5. Run integration tests that combine schema + resolver + component.
6. Run build.
7. Run browser/visual proof when available.
8. Compare evidence to objective.
9. Update checkpoint.
10. Either continue to the next packet or stop with pass/fail evidence.

### Stop Conditions

- all acceptance criteria for the packet pass
- same blocker occurs in three consecutive attempts
- implementation would require forbidden scope
- local environment cannot run a required external/browser proof after one
  documented fallback attempt
- time budget is reached

## Restartability Protocol

This work must be restartable after token exhaustion, context compaction, or
handoff to a fresh agent.

### Checkpoint File

Maintain:

```txt
docs/agent-checkpoints/game-ui-skinning-cms.md
```

The checkpoint must be short, current, and machine-readable enough for a new
agent to resume without the previous chat.

Required shape:

```md
# Game UI Skinning/CMS Checkpoint

Last Updated: YYYY-MM-DD HH:MM local
Current Packet: P2 - Component Skins
Objective: ...

## Completed

- [x] P0 spec written
- [x] P1 schemas validate fixtures

## In Progress

- [ ] P2 implement `GameTopBar`

## Next Action

Run `npx tsx components/ui/game-ui/gameUiThemeSchema.test.ts`, then wire
`GameTopBar` into proof route.

## Files Touched By This Lane

- components/ui/game-ui/gameUiThemeSchema.ts
- components/ui/game-ui/gameUiThemeSchema.test.ts

## Verification Evidence

- PASS `npx tsx ...`
- FAIL browser proof: localhost blocked with ERR_BLOCKED_BY_CLIENT

## Known Constraints

- Do not edit unrelated `components/screens/IconsPreviewScreen.tsx`.
- Server may already be running at localhost:3000.

## Open Decisions

- Whether toolbar is part of shell P2 or deferred to P4.
```

Checkpoint rules:

- update after every completed packet
- update after any blocker
- include exact command names and pass/fail result
- include file paths touched by the lane
- include next action as one concrete instruction
- do not include long prose or copied diffs

### Packet IDs

Every agent-sized work unit must have a stable packet id.

```txt
P0 Spec and checkpoint
P1 Validators and fixtures
P2 Resolvers and diagnostics
P3 Shared shell components
P4 Promo/ad placement components
P5 Proof route and fixture toggles
P6 Editor/schema metadata follow-up
P7 Cleanup and stale-doc updates
```

Agents should record packet status in the checkpoint.

### Evidence Log

The checkpoint is the summary. Detailed evidence may optionally go in:

```txt
docs/agent-checkpoints/game-ui-skinning-cms-evidence.md
```

Use it for long visual notes, browser failures, or screenshots. The checkpoint
must still contain the current result summary.

## Agent Work Packets

### P0 - Spec And Checkpoint

Goal:

- add this spec
- create checkpoint file

Acceptance:

- spec exists
- checkpoint has `Current Packet`, `Next Action`, and empty packet checklist
- `git diff --check` passes

### P1 - Validators And Fixtures

Files:

```txt
components/ui/game-ui/gameUiThemeSchema.ts
components/ui/game-ui/gameCmsSchema.ts
components/ui/game-ui/gamePlacementSchema.ts
components/ui/game-ui/gameUiFixtures.ts
components/ui/game-ui/gameUiSchema.test.ts
```

Goal:

- implement the three document schemas
- add dark stone and light marble fixture themes
- add CMS fixture with profile, resources, nav, promos, news, store offers,
  mission, and deck summary
- add placement fixtures for two home promo variants

Acceptance:

- valid fixtures parse
- unknown top-level keys fail
- invalid color/font/action/placement id shape fails
- surface recipes use existing surface validation

Verification:

```txt
npx tsx components/ui/game-ui/gameUiSchema.test.ts
npm run build
git diff --check
```

### P2 - Resolvers And Diagnostics

Files:

```txt
components/ui/game-ui/gameUiResolvers.ts
components/ui/game-ui/gameUiDiagnostics.ts
components/ui/game-ui/gameUiResolvers.test.ts
```

Goal:

- resolve surfaces/text styles/skins
- resolve top bar resources and bottom nav items from placements
- resolve promo placements
- return diagnostics for missing references

Acceptance:

- missing optional content returns fallback + diagnostic
- missing required skin id returns fallback + diagnostic
- unknown placement id does not crash
- safe actions resolve only allowlisted ids

Verification:

```txt
npx tsx components/ui/game-ui/gameUiResolvers.test.ts
npx tsx components/ui/game-ui/gameUiSchema.test.ts
npm run build
git diff --check
```

### P3 - Shared Shell Components

Files:

```txt
components/ui/game-ui/GameScreenShell.tsx
components/ui/game-ui/GameTopBar.tsx
components/ui/game-ui/ResourceChip.tsx
components/ui/game-ui/GameBottomNav.tsx
components/ui/game-ui/gameUi.css
components/ui/game-ui/gameUiComponents.test.tsx
```

Goal:

- render the shared shell/top bar/nav from validated runtime data
- consume resolver outputs
- use existing `MaterialSurfaceHost` for skinned surfaces

Acceptance:

- top bar renders profile, XP, resources
- bottom nav renders items and active route
- disabled nav item blocks click
- active item uses active skin
- components do not accept arbitrary CSS from JSON

Verification:

```txt
npx tsx components/ui/game-ui/gameUiComponents.test.tsx
npx tsx components/ui/game-ui/gameUiResolvers.test.ts
npm run build
git diff --check
```

### P4 - Promo And Ad Placement Components

Files:

```txt
components/ui/game-ui/PromoCard.tsx
components/ui/game-ui/PromoSlot.tsx
components/ui/game-ui/gameUiPromo.test.tsx
```

Goal:

- render promo/news/store/event content through named placements
- support hero and card variants
- support CTA safe actions
- support missing-media fallback

Acceptance:

- `home.heroPromo` renders selected promo
- changing placement fixture changes promo title/body/media id
- CTA emits safe action
- missing media remains readable

Verification:

```txt
npx tsx components/ui/game-ui/gameUiPromo.test.tsx
npm run build
git diff --check
```

### P5 - Proof Route And Fixture Toggles

Files:

```txt
components/screens/GameUiSkinProofScreen.tsx
router.tsx or route registry file
src/styles/game-ui-skin-proof.css if needed
```

Goal:

- add `/game-ui-skin-proof`
- render shell, top bar, hero promo, news rail, bottom nav
- add dev-only fixture toggles for dark/light theme and placement variant
- show JSON inspector for theme/CMS/placements

Acceptance:

- route builds
- toggling theme changes surface/font/color mood
- toggling placement changes promo content
- top bar/nav stay structurally stable

Verification:

```txt
npm run build
```

Browser proof if available:

```txt
open http://localhost:3000/game-ui-skin-proof
verify dark theme
toggle light theme
verify visible changes
toggle placement
verify promo content changes
```

If browser is blocked, record the exact blocker in checkpoint and rely on
component/build tests.

### P6 - Editor And Metadata Follow-Up

Goal:

- expose theme token and component skin slot metadata for the future editor
- do not build full editor UI in this packet

Suggested files:

```txt
components/ui/game-ui/gameThemeFieldMetadata.ts
components/ui/game-ui/gameThemeFieldMetadata.test.ts
```

Acceptance:

- every editable theme token has metadata
- metadata includes control type/range/label/group
- non-editable/runtime-only fields are classified, not omitted

### P7 - Cleanup And Stale Docs

Goal:

- update older docs to point to this spec
- deprecate or delete docs that are misleading after implementation

Acceptance:

- stale reference scan has no obsolete active spec links
- no unrelated dirty files are reverted

Verification:

```txt
rg -n "ui-template-cms-content-contract|game-ui-skinning-cms-agent-spec" docs
git diff --check
```

## Component-Level Verification

Each component must have tests that prove:

- it renders required CMS fields
- it applies named skin slots through resolver output
- it emits safe actions only
- it handles missing optional content
- it does not depend on arbitrary CSS in CMS/theme/placement payload

Use pure resolver tests where possible and component tests only where rendering
behavior matters.

## Integration Verification

The integration test should build a complete runtime from:

```txt
darkStoneThemeFixture
gameCmsFixture
homePlacementFixtureA
```

Then assert:

- top bar resources resolve in placement order
- bottom nav items resolve in placement order
- hero promo resolves to expected promo id
- component skins resolve surfaces and text styles
- no diagnostics for the valid fixture

Then swap to:

```txt
lightMarbleThemeFixture
homePlacementFixtureB
```

Assert:

- theme id changes
- hero promo id changes
- resolved top bar/nav contracts remain structurally valid

## Visual Verification

When browser access works, capture or inspect:

- dark theme proof route
- light theme proof route
- placement A
- placement B

Required visual checks:

- text is readable
- top bar remains at top
- bottom nav remains at bottom
- active nav is visually distinct
- hero promo content changes on placement toggle
- no component text visibly overflows its control
- no missing image breaks layout

Do not tune visual values endlessly in a schema packet. If the proof is
structurally correct but ugly, record a visual-tuning follow-up.

## Migration Strategy

1. Build the game-ui package beside existing material lab modules.
2. Prove fixtures and resolvers in isolation.
3. Prove shared shell components with fixtures.
4. Add proof route.
5. Migrate one real screen to consume `GameScreenShell` only after proof route
   passes.
6. Keep bespoke screen code free to own major layout and gameplay composition.

## Final Done Definition

This lane is done when:

- `GameUiTheme`, `GameCmsContent`, and `GameUiPlacements` validators exist
- dark/light theme fixtures validate
- placement variants validate
- resolvers return skins/content/diagnostics deterministically
- shared shell/topbar/nav/promo components render from validated runtime data
- proof route demonstrates theme swap and placement swap
- tests cover schema, resolver, component, and integration behavior
- checkpoint file says all packets through proof route are complete
- `npm run build` passes
- `git diff --check` passes
