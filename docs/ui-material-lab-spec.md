# UI Material Lab Spec

## Purpose

Create a temporary development route at `/uitest` for tuning the next Cruel Deal UI material system before replacing production screens.

The lab should recreate the visual language shown in the mock reference `Full UI.png`: stone panels, stone buttons, glass panels, glass buttons, gold slash labels, icon-forward controls, bottom-edge highlights, corner glows, and dense 9:16 mobile-first composition.

This route is a living styleboard, not a final player-facing screen. Its job is to make the primitive system concrete enough that future game screens can be rebuilt with shared components instead of one-off CSS.

## Reference Observations

The mock UI has several repeated visual rules:

- Most containers are rectangular or softly beveled slabs, not highly jagged shapes.
- Stone is used for both panels and buttons.
- Glass is used for overlays, status bars, some secondary buttons, and framed information regions.
- Gold marks primary attention: slashes, active tabs, selected home tile, CTA icon plate, progress fill, and hover/selected glow.
- Cyan/blue marks data currency and secondary tech accents.
- White/gray marks neutral borders, typography, icons, and panel bevels.
- UI density is high. Components must be compact, scan-friendly, and composition-ready.
- The label format `// LOADOUT` is a branded text primitive and should be reused consistently.
- Buttons may be large CTA bars, standard horizontal buttons, square icon tiles, nav tabs, or small inline action buttons.
- Icons are not decoration only. They carry affordance: add, arrow, settings, user, calendar, cube, history, target, security, clock, reward, document.

## Route

Add a dev/test route:

```txt
localhost:3000/uitest
```

Suggested component:

```txt
components/screens/UiMaterialLabScreen.tsx
```

Suggested stylesheet:

```txt
src/styles/ui-material-lab.css
```

Suggested route registration:

```txt
router.tsx
```

The existing app currently gates routes behind login/profile loading in `App.tsx`. The first implementation can keep that behavior. If quick iteration becomes annoying, add an explicit dev-only bypass later rather than mixing auth changes into this UI primitive pass.

## Layout

The lab should render inside the normal app/root shell but force a centered 9:16 working area regardless of actual browser viewport.

```txt
App viewport
└── lab page background
    └── 9:16 frame
        ├── cinematic background layer
        ├── optional frame haze/vignette
        ├── compact controls
        └── primitive gallery
```

Frame sizing:

```css
.ui-lab-frame {
  width: min(100vw, calc(100vh * 9 / 16));
  height: min(100vh, calc(100vw * 16 / 9));
  aspect-ratio: 9 / 16;
}
```

The content inside the frame should be vertically scrollable. The frame itself should preserve the phone/game composition, but the gallery can be taller than one screen so we can inspect many variants in one place.

The lab should avoid large explanatory text. It is a visual test surface. Labels and controls are acceptable because this route is dev-only.

## Assets

Use the downloaded ambientCG material as the first stone texture:

```txt
public/art/textures/road012a/Road012A_1K-JPG_Color.jpg
public/art/textures/road012a/Road012A_1K-JPG_AmbientOcclusion.jpg
public/art/textures/road012a/Road012A_1K-JPG_Roughness.jpg
public/art/textures/road012a/Road012A_1K-JPG_NormalGL.jpg
```

For CSS-only UI primitives, start with the color map. The AO/roughness/normal maps should remain available for later canvas/WebGL previews or preprocessed texture work.

Runtime CSS path:

```css
url("/art/textures/road012a/Road012A_1K-JPG_Color.jpg")
```

## Material Model

Do not make separate hardcoded systems for cards and buttons. Make a shared material surface vocabulary.

Conceptual layers:

```txt
host element
├── material layer
├── light/dark gradient layer
├── grime/noise/texture adjustment layer
├── border/bevel layer
├── edge highlight layer
├── corner glow layer
└── content layer
```

Cards and buttons differ by host semantics and layout, not by duplicating material logic.

### Stone

Stone should feel opaque, textured, heavy, and slightly weathered.

Use:

- Road012A texture
- top-light/bottom-dark gradient
- inner top bevel
- darker lower inset
- subtle outer shadow
- optional gold selected glow
- optional bottom edge highlight

Stone should not be a flat gray rectangle. It should have enough material information to match the mock, but not so much contrast that text becomes hard to read.

### Glass

Glass should feel translucent, smoky, and dirty rather than clean SaaS glass.

Use:

- translucent dark fill
- backdrop blur where supported
- weak stone/noise contamination if needed
- white/gray bevel
- asymmetric inset shadows
- optional gold or cyan corner glow
- optional bottom edge highlight

Glass should not be implemented as "stone opacity 0%" or as a base material. Stone/raw define the surface substrate; glass is an optional translucent layer above that substrate.

Example material variables:

```css
.cd-surface--stone {
  --surface-fill: rgba(52, 50, 44, 1);
  --surface-texture-opacity: 0.62;
  --surface-blur: 0px;
  --surface-border: rgba(225, 215, 190, 0.24);
}

.cd-surface__glass {
  --glass-alpha: 0.42;
  --glass-blur: 10px;
  backdrop-filter: blur(var(--glass-blur)) saturate(1.08);
}
```

## Primitive Components

### MaterialSurface

Base visual primitive used internally by panels and buttons.

Suggested props:

```ts
type MaterialKind = "raw" | "stone";
type ShapeKind = "rect" | "beveled";
type GlowTone = "none" | "gold" | "cyan" | "white" | "red";
type EdgeName = "top" | "right" | "bottom" | "left";
type CornerName = "top-left" | "top-right" | "bottom-right" | "bottom-left";

type CornerSpec =
  | "none"
  | "all"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | CornerName[];

type SurfaceGradient = "none" | "top-light" | "bottom-dark" | "both";

interface MaterialSurfaceProps {
  material?: MaterialKind;
  glass?: boolean;
  shape?: ShapeKind;
  corners?: CornerSpec;
  edgeHighlight?: EdgeName | EdgeName[] | "none";
  glow?: GlowTone;
  gradient?: SurfaceGradient;
  selected?: boolean;
  interactive?: boolean;
  hoverPreview?: boolean;
  textureStrength?: number;
  glassOpacity?: number;
  glassBlur?: number;
  borderOpacity?: number;
  cornerSize?: number;
  radius?: number;
}
```

Implementation note: this can be a CSS class/attribute system rather than a public component. The important point is that `MaterialPanel` and `MaterialButton` consume the same vocabulary.

### MaterialPanel

Use for cards, status groups, loadout containers, target cards, currency bars, and content regions.

Suggested props:

```ts
interface MaterialPanelProps extends MaterialSurfaceProps {
  padded?: boolean;
  compact?: boolean;
  class?: string;
  children: JSX.Element;
}
```

Panel variants to show in the lab:

- stone card
- glass panel
- beveled stone card
- glass status bar
- stone CTA panel
- nested content region inside a larger panel

Avoid card-inside-card styling when possible. For the lab, framed repeated items are acceptable because the mock uses item slots inside the loadout panel.

### MaterialButton

Use for all new stone/glass buttons.

Suggested props:

```ts
type ButtonSize = "sm" | "md" | "lg" | "tile" | "cta";
type IconPosition = "left" | "right" | "top";

interface MaterialButtonProps extends MaterialSurfaceProps {
  size?: ButtonSize;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
  iconPosition?: IconPosition;
  fullWidth?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  selected?: boolean;
  children?: JSX.Element;
}
```

Button variants to show in the lab:

- stone standard button
- glass standard button
- stone button with bottom edge highlight
- glass button with all four corner glows
- glass button with custom two-corner glow
- square stone icon tile
- selected bottom-nav tile
- large CTA stone bar with a separate arrow tile on the right
- compact `VIEW INTEL` button with document icon
- `EDIT LOADOUT` bar with settings icon

Button states:

- default
- hover preview
- selected
- active/pressed
- disabled
- focus-visible

For accessibility and keyboard parity, hover glow should also apply to `:focus-visible`.

### SectionLabel

The `// LOADOUT` label is a first-class text primitive.

Suggested API:

```ts
interface SectionLabelProps {
  children: string;
  size?: "xs" | "sm" | "md";
  tone?: "default" | "muted" | "gold";
  slashes?: boolean;
  class?: string;
}
```

Default rendering:

```txt
// LOADOUT
```

Visual rules:

- slashes are gold
- text is white or muted gray
- uppercase
- condensed font
- tight letter spacing, but no negative letter spacing
- should align cleanly in cards and buttons

Examples:

```tsx
<SectionLabel>Active Contract</SectionLabel>
<SectionLabel size="sm">Target</SectionLabel>
<SectionLabel>Loadout</SectionLabel>
<SectionLabel>Intel Brief</SectionLabel>
```

### StatBlock

Small label/value primitive for mock-style metrics.

Examples:

```txt
DIFFICULTY
HARD

EST. TIME
45 MIN

REWARD
1,850
```

Suggested API:

```ts
interface StatBlockProps {
  label: string;
  value: string;
  icon?: JSX.Element;
  tone?: "default" | "gold" | "red" | "cyan";
}
```

### SegmentedMeter

Used for security level and data value.

Suggested API:

```ts
interface SegmentedMeterProps {
  value: number;
  segments?: number;
  tone?: "gold" | "red" | "cyan" | "white";
  showPercent?: boolean;
}
```

Examples from mock:

- security level: red segments plus `87%`
- data value: gold segments

### IconFrame

Used for square icon plates like the CTA emblem, add button, and nav tiles.

Suggested API:

```ts
interface IconFrameProps extends MaterialSurfaceProps {
  icon: JSX.Element;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
}
```

The icon frame can be implemented with `MaterialButton size="tile"` if that keeps the system smaller.

## Icon Strategy

The project does not currently include a general icon library such as `lucide-solid`. Start with local inline SVG icon primitives in the UI lab to avoid a dependency decision during the first pass.

Create a small local icon set if needed:

```txt
components/ui/material-lab/MaterialIcons.tsx
```

Initial icons based on the mock:

- `ArrowRightIcon`
- `PlusIcon`
- `SettingsIcon`
- `UserIcon`
- `CalendarIcon`
- `CubeIcon`
- `HistoryIcon`
- `DocumentIcon`
- `ClockIcon`
- `RewardIcon`
- `ShieldHexIcon`
- `TargetMarkIcon`
- `HomeIcon`
- `CollectionIcon`
- `OperationsIcon`
- `MarketIcon`
- `ProfileIcon`
- `DataDiamondIcon`
- `CreditHexIcon`

Icon rules:

- use `currentColor` by default
- support `class` prop for sizing/color
- use consistent stroke width
- do not put text inside icons
- icons inside buttons should be centered in fixed-size slots
- tile buttons should not resize when icon changes

Optional later decision:

```txt
npm install lucide-solid
```

If installed, prefer lucide icons for common concepts and keep custom SVGs only for game-specific marks such as faction emblems, currency shapes, and contract symbols.

## Corner Glow

Corner glow should be a shared effect used by stone buttons, glass buttons, selected nav tiles, and CTA arrow tiles.

Controls:

- no corners
- all corners
- top edge corners
- bottom edge corners
- left side corners
- right side corners
- custom individual corners
- corner size
- glow tone
- simulated hover/selected

CSS can use layered gradients instead of four DOM elements:

```css
.cd-surface__corners {
  position: absolute;
  inset: -1px;
  pointer-events: none;
  opacity: var(--corner-opacity);
  background:
    linear-gradient(var(--corner-color), var(--corner-color)) left top / var(--corner-size) 1px no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) left top / 1px var(--corner-size) no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) right top / var(--corner-size) 1px no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) right top / 1px var(--corner-size) no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) left bottom / var(--corner-size) 1px no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) left bottom / 1px var(--corner-size) no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) right bottom / var(--corner-size) 1px no-repeat,
    linear-gradient(var(--corner-color), var(--corner-color)) right bottom / 1px var(--corner-size) no-repeat;
  filter: drop-shadow(0 0 7px var(--corner-shadow));
}
```

If individual corners need fully independent behavior, generate CSS variables per corner or use four absolutely positioned spans. The lab should make this tradeoff visible.

## Edge Highlight

Edge highlight is separate from corner glow.

Use cases:

- selected nav tab has a gold underline
- selected tile has bottom glow
- CTA arrow tile has bright bottom/right emphasis
- panels may have a subtle top white bevel and bottom shadow

Suggested props:

```ts
edgeHighlight="bottom"
edgeHighlight={["bottom", "right"]}
```

Edge tones:

- gold
- cyan
- white
- red

## Control Dock

The lab should include a compact control dock that changes a primary preview component and optionally toggles global sample states.

Controls should be actual UI controls, not plain text links:

- segmented control for material: stone/glass
- segmented control for shape: rect/beveled
- segmented control for target: panel/button/tile/cta
- toggles for selected, disabled, hover preview, focus preview
- checkbox group for custom corners
- select/menu for corner preset
- select/menu for edge highlight
- select/menu for glow tone
- sliders for texture strength, glass opacity, border opacity, corner size, radius
- segmented control for gradient: none/top-light/bottom-dark/both

Suggested control state:

```ts
interface UiLabControls {
  target: "panel" | "button" | "tile" | "cta";
  material: "stone" | "glass";
  shape: "rect" | "beveled";
  cornerPreset: CornerSpec;
  customCorners: CornerName[];
  edgeHighlight: EdgeName | "none";
  glow: GlowTone;
  gradient: SurfaceGradient;
  selected: boolean;
  disabled: boolean;
  hoverPreview: boolean;
  textureStrength: number;
  glassOpacity: number;
  glassBlur: number;
  borderOpacity: number;
  cornerSize: number;
  radius: number;
}
```

Show a small props readout near the primary preview so useful combinations can be copied into real screens.

## Gallery Content

The gallery should have two kinds of sections: primitives and composites.

### Primitive Sections

Typography:

- `SectionLabel` sizes
- display title: `DATA EXTRACTION`
- emphasized gold title word: `EXTRACTION`
- numeric value: `2,450`
- small labels: `CREDITS`, `DATA`, `SECURITY LEVEL`

Panels:

- stone card
- glass panel
- beveled stone panel
- compact glass status bar
- nested loadout slot

Buttons:

- stone standard
- glass standard
- stone with icon left
- glass with icon right
- all-corner glow
- custom-corner glow
- bottom-edge highlight
- selected stone tile
- disabled stone tile

Meters and stats:

- red segmented meter
- gold segmented meter
- difficulty/time/reward stat row
- XP progress bar

Icons:

- single icon grid
- icon inside stone tile
- icon inside glass tile
- currency icon examples

### Composite Sections

Build mock-inspired blocks to prove the primitives can compose:

Profile card:

```txt
[portrait placeholder] NETRUNNER_07
LVL 24
[XP progress]
18,450 / 24,000 XP
```

Currency bar:

```txt
[gold hex] 2,450 CREDITS | [cyan diamond] 870 DATA | [+]
```

Contract header:

```txt
// ACTIVE CONTRACT
DATA
EXTRACTION
Extract encrypted corporate data...
```

Target card:

```txt
// TARGET
SOLACE CORP
CENTRAL NODE
MEGABUILDING 7B
NEW EDEN
[security meter] [data value meter]
```

Intel brief:

```txt
// INTEL BRIEF
Solace Corp has recently acquired...
[VIEW INTEL button]
```

Loadout panel:

```txt
// LOADOUT
[slot] [slot] [slot] [slot] [+]
[EDIT LOADOUT button]
```

Initiate CTA:

```txt
[gold icon plate] INITIATE EXTRACTION
// PREPARE. BREACH. EXTRACT.
[arrow tile]
```

Bottom tabs:

```txt
OVERVIEW | OBJECTIVES | REWARDS | HISTORY
```

Bottom nav tiles:

```txt
COLLECTION | OPERATIONS | HOME | MARKET | PROFILE
```

## Background

The lab should include a moody city/backdrop placeholder to evaluate glass readability. Start with CSS gradients if no approved background asset exists, but leave the component ready to swap in a real image.

Suggested background layers:

```css
background:
  radial-gradient(circle at 70% 10%, rgba(255, 214, 145, 0.18), transparent 34%),
  linear-gradient(to bottom, rgba(20, 22, 22, 0.42), rgba(4, 5, 6, 0.92)),
  #111;
```

Do not let the background become the focus. It exists to stress-test glass, stone, contrast, and text readability.

## Styling Constraints

- Keep card/button border radius at 8px or less unless a mock-specific tile needs a tiny variation.
- Do not use large decorative gradient blobs.
- Do not build a marketing hero page.
- Do not put explanatory text inside production-like mock composites.
- Use stable dimensions for icon buttons, tile buttons, meters, and nav items.
- Ensure text never overflows buttons or cards at the 9:16 frame width.
- Use condensed typography for labels and headings.
- Reserve hero-scale text only for mock display titles like `DATA EXTRACTION`.
- Keep dominant palette dark neutral stone/glass, with gold and cyan accents.

## Implementation Plan

1. Add `UiMaterialLabScreen` and route `/uitest`.
2. Add `ui-material-lab.css` and import it from the screen or global CSS.
3. Create local lab primitives under `components/ui/material-lab/`.
4. Implement `SectionLabel`.
5. Implement `MaterialPanel` using Road012A texture.
6. Implement `MaterialButton` using the shared surface CSS.
7. Implement local SVG icons needed by the mock composites.
8. Add control dock state and bind it to a primary preview.
9. Add primitive gallery sections.
10. Add mock-inspired composite sections.
11. Run the Vite dev server and inspect `/uitest`.
12. Tune CSS until the mock-inspired blocks feel coherent inside the 9:16 frame.

## Acceptance Criteria

The first pass is good enough when:

- `/uitest` renders in the app at localhost.
- The visible work area preserves a centered 9:16 frame.
- Stone panels and stone buttons both use the Road012A texture.
- Glass panels and glass buttons share the same surface vocabulary but feel translucent.
- `SectionLabel` renders gold `//` plus white label text.
- Buttons support text, left/right icons, selected state, disabled state, corner glow, and bottom edge highlight.
- Corner glow can be shown for all corners or custom corner selections.
- At least one stone button and one glass button demonstrate bottom edge highlight.
- The gallery includes mock-inspired composite blocks for loadout, target, CTA, currency, and nav.
- Icon slots remain stable when icons change.
- Text remains readable inside the 9:16 frame.

## Non-Goals

- Replacing the production UI.
- Finalizing the full visual identity.
- Building runtime procedural jagged edges.
- Adding a general icon dependency unless the first pass proves local SVGs are too cumbersome.
- Implementing full game behavior behind the mock composites.
- Making the lab responsive as a normal webpage. The point is the forced 9:16 game surface.

## Future Follow-Ups

- Add authored stone masks for chipped or irregular panels.
- Add preprocessed darker UI-specific stone texture variants.
- Add animated hover shimmer for selected glass buttons.
- Add canvas/WebGL material preview using normal/roughness maps.
- Promote stable lab primitives into production `components/ui`.
- Replace mock composites screen by screen once the primitive vocabulary feels settled.
