# Material Lab Interaction Chrome Upgrade

## Goal

Upgrade the shared material system so hover, pressed, and active game UI states can be designed once in the material lab and reused across nav tabs, toolbar buttons, CTAs, selected cards, reward tiles, store offers, tab rows, modal actions, and future game controls.

The first proof case is the main-material preview nav bar. After the preview proves the look, the production `NavigationBar` should replace its current bespoke `NavItem` styling with the same material primitive behavior.

This is a clean refactor. Do not preserve legacy material recipe storage. Do not support old `focus` recipe state names. Bump local storage keys and reset defaults.

## Design Principles

- Game UI states are pointer-first: mouse, touch, and tablet.
- Keyboard focus is not an art-directed state for this UI.
- `active` means selected, current, or powered-on.
- `hover` is only a desktop mouse/trackpad affordance.
- `pressed` is transient tap/click feedback.
- Surface tint and content color are separate systems.
- Icons should use `currentColor` or mask-based monochrome rendering when possible.
- Layout CSS places components. Material primitives own paint, glow, border, texture, tint, and interaction chrome.
- The nav bar should be a consumer of the system, not a special paint system.

## Current Problems

The existing material lab has a useful base surface model, but interaction states are incomplete:

- State model is `rest | hover | focus`, which does not match the actual game interaction model.
- State overlays only control glow/corners/edge highlights.
- Hover/active cannot independently alter surface tint, border intensity, bevel strength, content color, or icon color.
- The desired active nav treatment requires a shaped bottom emission, not just a straight `edgeHighlight`.
- Main-material preview nav uses `MaterialButton`, but its special state language is still mostly CSS-local.
- Production nav uses a separate `NavItem` component with hardcoded Tailwind paint, so it cannot share material lab recipes.

## New Interaction Model

Replace:

```ts
export type MaterialRecipeState = 'rest' | 'hover' | 'focus';
```

With:

```ts
export type MaterialRecipeState = 'rest' | 'hover' | 'active' | 'pressed';
```

State meanings:

- `rest`: default visible state.
- `hover`: pointer hover state for devices that support real hover.
- `active`: durable selected/current state.
- `pressed`: transient pointer-down state.

No `focus` state is retained. If keyboard focus-visible styling is needed later, it should be a minimal accessibility outline outside the art-directed recipe state model.

## Recipe Interfaces

### Material Tone

Add one shared palette for tint, glow, emission, label, and icon state work. Existing narrower tone types can be removed during the clean refactor or converted into aliases around this palette.

```ts
export type MaterialTone =
  | 'none'
  | 'inherit'
  | 'black'
  | 'white'
  | 'muted'
  | 'gold'
  | 'cyan'
  | 'red'
  | 'green';
```

Tone intent:

- `none`: no tone or transparent tone.
- `inherit`: use base recipe content styling.
- `black`: dark ink for bright active plates.
- `white`: high-contrast light text.
- `muted`: inactive gray/stone text.
- `gold`: primary selected/accent text.
- `cyan`: tech/data accent text.
- `red`: danger/hostile accent text.
- `green`: success/ready accent text.

### Edge Emission

Add a reusable edge emission layer. This is the generalized version of the nav bottom glow/blip.

```ts
export type EdgeEmissionKind =
  | 'none'
  | 'line'
  | 'center-blip'
  | 'rail-and-blip';

export type EdgeEmissionEdge = 'bottom';
```

Recommended first implementation:

- `none`: no emission.
- `line`: straight rail along the bottom edge.
- `center-blip`: short center glow with a thicker midpoint.
- `rail-and-blip`: rail plus center blip. This is the nav active default.

This first pass intentionally supports bottom-edge emissions only. Other edges and `corner-sparks` should not be exposed in the editor until their CSS is fully specified and implemented. Add them later as a deliberate expansion, not as unused type surface.

### State Overlay

Replace the current overlay shape with grouped state overlays. The grouping keeps implementation, sanitization, editor sections, and future extensions aligned.

```ts
export interface SurfaceStateOverlay {
  tint: MaterialTone;
  tintStrength: number | null;
  borderOpacityBoost: number;
  lightStrengthBoost: number;
  darkStrengthBoost: number;
}

export interface GlowStateOverlay {
  tone: MaterialTone;
  glowStrength: number;
  corners: CornerName[];
  edgeHighlight: EdgeName[];
  cornerSize: number;
}

export interface EdgeEmissionOverlay {
  emission: EdgeEmissionKind;
  emissionEdge: EdgeEmissionEdge;
  emissionTone: MaterialTone;
  emissionStrength: number;
  emissionLength: number;
  emissionThickness: number;
  emissionBlipSize: number;
}

export interface ContentStateOverlay {
  contentTone: MaterialTone;
  iconTone: MaterialTone;
  contentGlowStrength: number;
  iconGlowStrength: number;
  contentEmboss: boolean | 'inherit';
  fontWeight: FontWeightToken | 'inherit';
  fontStyle: FontStyleToken | 'inherit';
  textTransform: TextTransformToken | 'inherit';
  letterSpacing: number | null;
}

export interface MotionStateOverlay {
  translateY: number;
  scale: number;
}

export interface MaterialStateOverlay {
  enabled: boolean;
  surface: SurfaceStateOverlay;
  glow: GlowStateOverlay;
  emission: EdgeEmissionOverlay;
  content: ContentStateOverlay;
  motion: MotionStateOverlay;
}
```

Notes:

- `surface.tint: 'inherit'` means keep the base recipe tint.
- `surface.tintStrength: null` means keep the base recipe tint strength.
- Surface boost fields are additive and clamped during prop generation.
- `content.iconTone: 'inherit'` means icon follows `content.contentTone`; if `content.contentTone` is also `inherit`, both follow the base recipe.
- `motion.scale` defaults to `1`.
- `motion.translateY` defaults to `0`.

### Typography Tokens

Typography treatment is part of the material recipe, but it is not the same as content color. The recipe must expose font treatment directly so nav tabs, CTAs, toolbar buttons, and selected tiles can switch between condensed bold, italic game labels, quieter utility labels, or heavier active labels without one-off CSS.

```ts
export type FontWeightToken =
  | 'regular'
  | 'medium'
  | 'bold'
  | 'black';

export type FontStyleToken =
  | 'normal'
  | 'italic';

export type TextTransformToken =
  | 'none'
  | 'uppercase';
```

Token mapping:

- `regular`: `400`
- `medium`: `600`
- `bold`: `800`
- `black`: `900`
- `letterSpacing`: stored as a number in `em`; use `0` as the default, not negative tracking.

Default material button labels should use `black`, `italic`, `uppercase`, and `0em` letter spacing unless the recipe overrides them. This matches the current game UI direction while avoiding hidden hardcoded font treatment.

### Material Recipe

Keep the base recipe mostly intact, but add `contentTone` and `iconTone` as base-level fields. Rename or augment `textTone` carefully, because current `TextTone` only supports `black | white`.

Recommended clean model:

```ts
export interface MaterialRecipe {
  material: MaterialKind;
  texture: TextureKind;
  shape: ShapeKind;
  glass: boolean;
  glassOpacity: number;
  glassBlur: number;
  glassHighlightWidth: number;
  glassHighlightHeight: number;
  glassHighlightY: number;
  tint: MaterialTone;
  tintStrength: number;
  gradient: SurfaceGradient;
  sheen: boolean;
  disabled: boolean;
  border: EdgeName[];
  textureStrength: number;
  textureScale: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  edgeWearTexture: EdgeTextureKind;
  edgeWearOpacity: number;
  edgeWearWidth: number;
  edgeWearScale: number;
  edgeWearLayer: EdgeWearLayer;
  radius: number;
  textContent: string;
  contentLayer: ContentLayer;
  textFontFamily: string;
  textSizeRem: number;
  fontWeight: FontWeightToken;
  fontStyle: FontStyleToken;
  textTransform: TextTransformToken;
  letterSpacing: number;
  contentTone: MaterialTone;
  iconTone: MaterialTone;
  textEmboss: boolean;
  textAlign: ContentAlign;
  textX: number;
  textY: number;
  states: Record<MaterialRecipeState, MaterialStateOverlay>;
}
```

If keeping `textTone` temporarily is easier during implementation, do not expose it in the redesigned editor. Expose `contentTone` instead.

## Defaults

### Default State Overlays

```ts
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export const createMaterialStateOverlays = (
  overrides: Partial<Record<MaterialRecipeState, DeepPartial<MaterialStateOverlay>>> = {},
): Record<MaterialRecipeState, MaterialStateOverlay> => ({
  rest: createMaterialStateOverlay({
    enabled: false,
    ...overrides.rest,
  }),
  hover: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 8,
      borderOpacityBoost: 8,
      lightStrengthBoost: 8,
      darkStrengthBoost: 0,
    },
    glow: {
      tone: 'gold',
      glowStrength: 22,
      corners: ['top-left', 'top-right'],
      edgeHighlight: ['top'],
      cornerSize: 14,
    },
    emission: {
      emission: 'none',
      emissionEdge: 'bottom',
      emissionTone: 'gold',
      emissionStrength: 0,
      emissionLength: 42,
      emissionThickness: 1,
      emissionBlipSize: 12,
    },
    content: {
      contentTone: 'gold',
      iconTone: 'inherit',
      contentGlowStrength: 16,
      iconGlowStrength: 20,
      contentEmboss: 'inherit',
      fontWeight: 'inherit',
      fontStyle: 'inherit',
      textTransform: 'inherit',
      letterSpacing: null,
    },
    motion: {
      translateY: 0,
      scale: 1,
    },
    ...overrides.hover,
  }),
  active: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 34,
      borderOpacityBoost: 24,
      lightStrengthBoost: 18,
      darkStrengthBoost: 8,
    },
    glow: {
      tone: 'gold',
      glowStrength: 56,
      corners: ['top-left', 'top-right', 'bottom-right', 'bottom-left'],
      edgeHighlight: ['top', 'bottom'],
      cornerSize: 18,
    },
    emission: {
      emission: 'rail-and-blip',
      emissionEdge: 'bottom',
      emissionTone: 'gold',
      emissionStrength: 70,
      emissionLength: 54,
      emissionThickness: 2,
      emissionBlipSize: 18,
    },
    content: {
      contentTone: 'black',
      iconTone: 'black',
      contentGlowStrength: 0,
      iconGlowStrength: 0,
      contentEmboss: 'inherit',
      fontWeight: 'black',
      fontStyle: 'italic',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    motion: {
      translateY: 0,
      scale: 1,
    },
    ...overrides.active,
  }),
  pressed: createMaterialStateOverlay({
    enabled: true,
    surface: {
      tint: 'gold',
      tintStrength: 44,
      borderOpacityBoost: 28,
      lightStrengthBoost: 12,
      darkStrengthBoost: 16,
    },
    glow: {
      tone: 'gold',
      glowStrength: 68,
      corners: ['bottom-left', 'bottom-right'],
      edgeHighlight: ['bottom'],
      cornerSize: 18,
    },
    emission: {
      emission: 'center-blip',
      emissionEdge: 'bottom',
      emissionTone: 'gold',
      emissionStrength: 80,
      emissionLength: 36,
      emissionThickness: 3,
      emissionBlipSize: 20,
    },
    content: {
      contentTone: 'black',
      iconTone: 'inherit',
      contentGlowStrength: 0,
      iconGlowStrength: 0,
      contentEmboss: 'inherit',
      fontWeight: 'black',
      fontStyle: 'italic',
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    motion: {
      translateY: 1,
      scale: 0.985,
    },
    ...overrides.pressed,
  }),
});
```

### Nav Recipe Defaults

The main-material nav should start with a bright active plate similar to the reference screenshot:

- base: stone/glass, muted white/cream tint, dark content or muted content depending final material.
- hover: subtle gold tint, top corner glints, gold content.
- active: stronger gold tint, full corner glow, bottom `rail-and-blip`, black or very dark content.
- pressed: same family as active but slightly compressed and brighter at the bottom edge.

## Prop Resolution

`materialRecipeToSurfaceProps(recipe, state)` should apply a state overlay by merging base recipe values with overlay values.

Rules:

1. If state is `rest` or overlay disabled, use base recipe.
2. If `overlay.surface.tint !== 'inherit'`, override tint.
3. If `overlay.surface.tintStrength !== null`, override tint strength.
4. Add boost values:
   - `borderOpacity = clamp(base.borderOpacity + overlay.surface.borderOpacityBoost, 0, 100)`
   - `lightStrength = clamp(base.lightStrength + overlay.surface.lightStrengthBoost, 0, 100)`
   - `darkStrength = clamp(base.darkStrength + overlay.surface.darkStrengthBoost, 0, 100)`
5. Glow/corners/edges are active only if overlay is enabled, `overlay.glow.tone` is not `none`, and `overlay.glow.glowStrength` is above zero.
6. Emission is active only if overlay is enabled, `overlay.emission.emission` is not `none`, and `overlay.emission.emissionStrength` is above zero.
7. Content tone resolves:
   - `overlay.content.contentTone` if not `inherit`
   - base tone if not `inherit`
   - fallback `white`
8. Icon tone resolves:
   - `overlay.content.iconTone` if not `inherit`
   - `overlay.content.contentTone` if not `inherit`
   - base icon tone if not `inherit`
   - base content tone if not `inherit`
   - fallback content tone.
9. Typography resolves per field:
   - `overlay.content.fontWeight/fontStyle/textTransform` if not `inherit`
   - base recipe typography field
   - fallback button defaults.
10. `overlay.content.letterSpacing` resolves to the overlay value when it is not `null`; otherwise use base recipe `letterSpacing`.
11. `overlay.motion` transform values should be passed as CSS variables for the resolved state and as separate pressed variables for native pointer-down feedback.

## State Variable Strategy

Recipe-driven interactive components must emit variables for all relevant pointer states up front. Hover cannot be generic CSS polish if the material lab is expected to control hover tint, content tone, glow, or emission.

`materialRecipeToSurfaceProps(recipe, state)` should continue to return the resolved current-state props for non-interactive surfaces and previews. Add a second helper for recipe-backed interactive components:

```ts
export const materialRecipeToInteractiveSurfaceProps = (
  recipe: MaterialRecipe,
  visualState: Exclude<MaterialRecipeState, 'hover'>,
) => ({
  ...materialRecipeToSurfaceProps(recipe, visualState),
  stateVars: {
    rest: materialRecipeToSurfaceStateVars(recipe, 'rest'),
    hover: materialRecipeToSurfaceStateVars(recipe, 'hover'),
    active: materialRecipeToSurfaceStateVars(recipe, 'active'),
    pressed: materialRecipeToSurfaceStateVars(recipe, 'pressed'),
  },
});
```

Implementation rules:

- The element always renders current-state variables from `visualState`.
- The element also renders `--hover-*` variables from the hover overlay.
- The element also renders `--pressed-*` variables from the pressed overlay.
- CSS applies `--hover-*` only inside `@media (hover: hover) and (pointer: fine)`.
- CSS applies `--pressed-*` on native `:active`.
- `hover` is input-derived and should not be passed as the durable `visualState` by app components.
- `active` and `pressed` can be previewed directly in the material lab editor.

This keeps hover recipe-driven while preserving touch behavior: touch devices get native pressed feedback and durable active state, without sticky hover.

## Component API Changes

### MaterialSurface Options

Add fields to `SurfaceOptions`:

```ts
export interface MaterialSurfaceStateVars {
  cssVars: Record<string, string | number>;
}

contentTone?: MaterialTone;
iconTone?: MaterialTone;
contentGlowStrength?: number;
iconGlowStrength?: number;
fontWeight?: FontWeightToken;
fontStyle?: FontStyleToken;
textTransform?: TextTransformToken;
letterSpacing?: number;

emission?: EdgeEmissionKind;
emissionEdge?: EdgeEmissionEdge;
emissionTone?: MaterialTone;
emissionStrength?: number;
emissionLength?: number;
emissionThickness?: number;
emissionBlipSize?: number;

stateScale?: number;
stateTranslateY?: number;
stateVars?: Partial<Record<MaterialRecipeState, MaterialSurfaceStateVars>>;
```

`cssVars` should contain the full resolved variable set needed to swap visual state in CSS: tint, border/light/dark values, glow/corner/edge colors, emission values, content/icon colors, and motion values. Do not make hover a partial visual approximation.

### MaterialButton Props

Add an explicit visual state prop:

```ts
export interface MaterialButtonProps extends SurfaceOptions, JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  visualState?: Exclude<MaterialRecipeState, 'hover'>;
}
```

Behavior:

- `visualState` is the only art-directed durable state input for recipe-backed buttons.
- App components should pass `rest`, `active`, or, for explicit previews/tools, `pressed`.
- App components should not pass `hover`; hover is derived from pointer capability and CSS.
- Remove recipe-path reliance on `selected`, `hoverPreview`, and `pressed` booleans during the clean refactor.
- Native `:active` CSS handles transient press compression using the recipe's pressed variables.

### MaterialNavItem

Create a small reusable wrapper for nav-like buttons:

```ts
interface MaterialNavItemProps {
  label: string;
  icon: JSX.Element;
  active: boolean;
  recipe: MaterialRecipe;
  onClick: () => void;
  class?: string;
}
```

It should render:

```tsx
<MaterialButton
  {...materialRecipeToInteractiveSurfaceProps(props.recipe, props.active ? 'active' : 'rest')}
  size="sm"
  iconPosition="top"
  visualState={props.active ? 'active' : 'rest'}
  class={`cd-nav-item ${props.active ? 'is-active' : ''} ${props.class || ''}`}
  onClick={props.onClick}
  icon={props.icon}
>
  {props.label}
</MaterialButton>
```

`MaterialNavItem` owns nav label fitting and icon orientation. It must use the existing `GameText` primitive for its label, because production nav already relies on `GameText` to fit long localized labels inside fixed-width nav cells.

Recommended implementation:

```tsx
<MaterialButton
  {...materialRecipeToInteractiveSurfaceProps(props.recipe, props.active ? 'active' : 'rest')}
  size="sm"
  iconPosition="top"
  visualState={props.active ? 'active' : 'rest'}
  class={`cd-nav-item ${props.active ? 'is-active' : ''} ${props.class || ''}`}
  onClick={props.onClick}
  icon={props.icon}
>
  <span class="cd-nav-item__label">
    <GameText
      text={props.label}
      baseFontSize={0.75}
      minScale={0.4}
      maxScale={1}
      skewFactor={0.9}
      maxLines={1}
      italic={resolvedNavFontStyle() === 'italic'}
      letterSpacing={`var(--content-letter-spacing)`}
      class="cd-nav-item__game-text"
    />
  </span>
</MaterialButton>
```

`MaterialNavItem` should pass resolved typography to `GameText`, not rely on the current `GameText` defaults. In particular:

- `italic` comes from the resolved state typography.
- `letterSpacing` comes from `--content-letter-spacing`.
- `baseFontSize` should remain fixed by nav layout, not by the global button text size.
- `GameText` should continue to own fit-to-width scaling only.

`MaterialButton` should render JSX children without wrapping them in an extra text-only label span when the child is already a node. The nav wrapper supplies the fixed-height label box:

```css
.cd-nav-item__label {
  display: block;
  width: 100%;
  height: 0.875rem;
  min-width: 0;
}
```

Generic `MaterialButton` must not become responsible for nav-specific text scaling.

## CSS Layer Changes

### Surface Variables

Add variables in `surfaceStyle()`:

```css
--content-rgb
--icon-rgb
--content-color
--icon-color
--content-glow-alpha
--icon-glow-alpha
--content-glow-shadow
--icon-glow-shadow
--content-font-weight
--content-font-style
--content-text-transform
--content-letter-spacing

--emission-rgb
--emission-alpha
--emission-edge
--emission-length
--emission-thickness
--emission-blip-size
--state-scale
--state-translate-y
--hover-content-rgb
--hover-icon-rgb
--hover-tint-rgb
--hover-tint-alpha
--hover-emission-rgb
--hover-emission-alpha
--hover-scale
--hover-translate-y
--pressed-scale
--pressed-translate-y
--pressed-content-rgb
--pressed-icon-rgb
--pressed-tint-rgb
--pressed-tint-alpha
--pressed-emission-rgb
--pressed-emission-alpha
```

Use `rgb(var(--content-rgb) / 1)` style values to keep alpha flexible.

### Content/Icon Styling

Update:

```css
.cd-button__label {
  color: var(--content-color);
  font-style: var(--content-font-style);
  font-weight: var(--content-font-weight);
  letter-spacing: var(--content-letter-spacing);
  text-transform: var(--content-text-transform);
  text-shadow: var(--content-shadow), var(--content-glow-shadow);
}

.cd-button__icon {
  color: var(--icon-color);
  filter: drop-shadow(0 0 var(--icon-glow-size) rgb(var(--icon-rgb) / var(--icon-glow-alpha)));
}
```

SVG icons must use `currentColor`.

### Emission Layer

Add a new layer after glow and before border/edge/corners:

```tsx
<Show when={hasEmission(props)}>
  <span class="cd-surface__emission" aria-hidden="true" />
</Show>
```

Recommended stacking:

```txt
material
texture
tint
gradient
glass
glow
emission
border
edge-wear
edge
corners
content
```

Base CSS:

```css
.cd-surface__emission {
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: var(--emission-alpha);
  filter:
    drop-shadow(0 0 4px rgb(var(--emission-rgb) / 0.8))
    drop-shadow(0 0 14px rgb(var(--emission-rgb) / 0.55))
    drop-shadow(0 0 28px rgb(var(--emission-rgb) / 0.34));
}
```

For bottom `rail-and-blip`:

```css
.cd-surface[data-emission='rail-and-blip'][data-emission-edge='bottom'] > .cd-surface__emission {
  background:
    linear-gradient(
      90deg,
      transparent,
      rgb(var(--emission-rgb) / 0.18) 12%,
      rgb(var(--emission-rgb) / 0.98) 50%,
      rgb(var(--emission-rgb) / 0.18) 88%,
      transparent
    )
    center bottom / var(--emission-length) var(--emission-thickness) no-repeat,
    radial-gradient(
      ellipse at center bottom,
      rgb(var(--emission-rgb) / 0.95) 0%,
      rgb(var(--emission-rgb) / 0.52) 32%,
      transparent 72%
    )
    center bottom / var(--emission-blip-size) calc(var(--emission-blip-size) * 0.58) no-repeat;
}
```

Do not hardcode this to nav. It belongs to any `cd-surface`.

First implementation CSS must include bottom-edge variants for:

- `line`
- `center-blip`
- `rail-and-blip`

Do not expose unsupported edge directions or emission kinds in the editor.

### Hover Gate

Recipe-driven hover effects must only apply on devices with actual hover:

```css
@media (hover: hover) and (pointer: fine) {
  .cd-surface.is-interactive:hover {
    --content-rgb: var(--hover-content-rgb);
    --icon-rgb: var(--hover-icon-rgb);
    --tint-rgb: var(--hover-tint-rgb);
    --tint-alpha: var(--hover-tint-alpha);
    --emission-rgb: var(--hover-emission-rgb);
    --emission-alpha: var(--hover-emission-alpha);
    transform:
      translateY(var(--hover-translate-y, 0))
      scale(var(--hover-scale, 1));
  }
}
```

The first implementation must use the recipe-derived `--hover-*` variables described in **State Variable Strategy**. Generic hover polish is acceptable only as a fallback for non-recipe surfaces and must not be the path used by material lab preview buttons.

### Pressed Feedback

Native press:

```css
.cd-surface.is-interactive:active {
  --content-rgb: var(--pressed-content-rgb);
  --icon-rgb: var(--pressed-icon-rgb);
  --tint-rgb: var(--pressed-tint-rgb);
  --tint-alpha: var(--pressed-tint-alpha);
  --emission-rgb: var(--pressed-emission-rgb);
  --emission-alpha: var(--pressed-emission-alpha);
  transform:
    translateY(var(--pressed-translate-y, 1px))
    scale(var(--pressed-scale, 0.985));
}
```

For explicit `visualState="pressed"`, props should set `--state-translate-y` and `--state-scale`.

### Container Queries

Use container queries for layout and scale, not pointer capability:

```css
.cd-nav-grid {
  container-type: inline-size;
}

@container (max-width: 360px) {
  .cd-nav-item .cd-button__label {
    font-size: 0.62rem;
  }

  .cd-nav-item {
    --emission-length: 46%;
    --emission-blip-size: 15px;
  }
}
```

Keep media queries for hover capability.

## Material Lab UI Redesign

The editor should remain dense, but state controls need clearer grouping.

### State Selector

Replace current Glow state selector labels:

```txt
State: Rest | Hover | Active | Pressed
```

Default selected state in the editor should be `active`, because selected/powered UI is the most important art pass.

### Surface State Section

Add a new state section before glow:

```txt
State Surface
- Enabled
- Tint: inherit / none / gold / cyan / white / red / green
- Tint Power
- Border Boost
- Light Boost
- Dark Boost
```

### Glow Section

Keep glow controls, but make it explicitly state-scoped:

```txt
State Glow
- Corners
- Edges
- Glow Tone
- Glow Power
- Bracket Size
```

### Edge Emission Section

New section:

```txt
Edge Emission
- Type: none / line / center blip / rail + blip
- Edge: bottom
- Tone: gold / cyan / white / red / green
- Power
- Length
- Thickness
- Blip Size
```

Recommended slider ranges:

- `Power`: 0-100
- `Length`: 10-100 percent
- `Thickness`: 1-8 px
- `Blip Size`: 8-44 px

### Content State Section

New section:

```txt
State Content
- Label Tone: inherit / muted / black / white / gold / cyan / red / green
- Icon Tone: inherit / muted / black / white / gold / cyan / red / green
- Label Glow
- Icon Glow
- Emboss: inherit / on / off
- Weight: inherit / regular / medium / bold / black
- Style: inherit / normal / italic
- Case: inherit / none / uppercase
- Track: inherit / numeric em value
```

Important: label/icon color should not be implemented as surface tint. It is separate because active plates may need black text, while dark powered plates may need gold/cyan text.

### Motion Section

New small state section:

```txt
State Motion
- Scale
- Y
```

Ranges:

- `Scale`: 0.94-1.04, step 0.005
- `Y`: -4 to 4 px

Use mostly for `pressed`. Active can use a tiny lift later if desired.

### Presets

Add a preset row after the state selector:

```txt
Preset: quiet hover / gold active plate / cyan data tab / danger active / cta powered / nav tab
```

Applying a preset should update only the currently selected state overlay, not the whole recipe.

Recommended presets:

#### Quiet Hover

- tint `white`, strength `6`
- border boost `8`
- glow `white`, strength `16`
- corners top only
- content tone `white`
- icon tone `inherit`

#### Gold Active Plate

- tint `gold`, strength `34`
- border boost `24`
- glow `gold`, strength `56`
- corners all
- edges top/bottom
- emission `rail-and-blip`, bottom
- content/icon tone `black`

#### Cyan Data Tab

- tint `cyan`, strength `22`
- border boost `18`
- glow `cyan`, strength `46`
- corners top or all, depending target density
- emission `center-blip`, bottom
- content/icon tone `cyan`

#### Danger Active

- tint `red`, strength `28`
- glow `red`, strength `58`
- corners all
- emission `center-blip`, bottom
- content/icon tone `white`

#### CTA Powered

- tint `gold`, strength `42`
- glow `gold`, strength `72`
- edges bottom
- emission `rail-and-blip`, bottom
- content/icon tone `black`

#### Nav Tab

- hover: gold top glints, muted body lift.
- active: gold plate, full corners, bottom rail-and-blip, black icon/text.
- pressed: bottom center-blip, small compression.

## Main-Material Preview Changes

### Storage

Bump storage key:

```ts
const storageKey = 'cruel-deal.main-material-preview.v12';
```

Do not read or sanitize old stored recipes. It is acceptable to delete the obsolete key array or leave it only to clear old data before starting fresh.

### State Preview

Rename the editor signal concept:

```ts
const [previewState, setPreviewState] = createSignal<MaterialRecipeState>('active');
```

Active nav item state:

```ts
const navItemState = (index: number) => {
  if (index !== props.activeNavIndex) return 'rest';
  return props.selectedPart === 'navBar' ? props.previewState : 'active';
};
```

### Nav Layout CSS

Keep only layout/typography sizing in `main-material-preview.css`:

- nav wrapper height
- grid columns
- gap
- button height
- icon size
- label sizing constraints

Remove special hardcoded paint from `.main-material-nav-item` except layout and optional active class hooks for non-paint concerns.

### Nav Icons

Replace placeholder text icons (`*`, `M`, `V`, etc.) with SVG or mask-ready icons that honor `currentColor`.

Temporary acceptable path:

- keep placeholders while implementing material system.
- follow-up swaps them with proper inline SVG icons.

## Production Navigation Replacement

### Current Files

- `components/ui/NavigationBar.tsx`
- `components/navigation/NavItem.tsx`

### Target

Replace `NavItem` hardcoded Tailwind paint with `MaterialNavItem` or a `MaterialButton` using a shared nav material recipe.

The production nav should not duplicate the material lab CSS. It should consume the same primitive CSS from `ui-material-lab.css` or a renamed shared stylesheet.

### Recipe Location

Create a shared recipe module:

```txt
components/ui/material-lab/materialPresets.ts
```

or, if this system is now production rather than lab-only:

```txt
components/ui/material/materialPresets.ts
```

Export:

```ts
export const navTabMaterialRecipe = createMaterialRecipe({ ... });
```

The preview can import the same default recipe, then allow editing locally.

## Icon And Logo Color Strategy

### Best Case: Inline SVG

All nav and material button icons should be inline SVG using `currentColor`:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
  ...
</svg>
```

or:

```tsx
<svg viewBox="0 0 24 24" fill="currentColor">
  ...
</svg>
```

Then the material system controls icon color through:

```css
.cd-button__icon {
  color: var(--icon-color);
}
```

### Mask Icons

For monochrome logos loaded from assets:

```css
.cd-icon-mask {
  background: var(--icon-color);
  mask-image: var(--icon-url);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
}
```

This is good for solid logos that should tint cleanly.

### Bitmap Icons

Avoid filter-tinting detailed bitmaps for nav icons. CSS filters are imprecise and hard to tune across gold/cyan/red states.

For detailed bitmap logos, use explicit assets:

- default asset
- hover asset
- active asset

But for this UI, prefer SVG or masks.

### Text And Icon Independence

Do not couple icon color to button surface tint.

Examples:

Bright active plate:

```ts
active: {
  surface: {
    tint: 'gold',
    tintStrength: 34,
  },
  content: {
    contentTone: 'black',
    iconTone: 'black',
  },
}
```

Dark powered active plate:

```ts
active: {
  surface: {
    tint: 'none',
  },
  glow: {
    tone: 'gold',
  },
  content: {
    contentTone: 'gold',
    iconTone: 'gold',
    contentGlowStrength: 42,
    iconGlowStrength: 48,
  },
}
```

Hover:

```ts
hover: {
  surface: {
    tint: 'gold',
    tintStrength: 8,
  },
  content: {
    contentTone: 'gold',
    iconTone: 'inherit',
  },
}
```

## Accessibility And Input Notes

- Keep buttons as real `<button>` elements.
- Keep labels as text, even if icons carry the primary visual affordance.
- Do not remove native focus behavior globally.
- If focus outlines appear during mouse/touch use, use `:focus-visible` only:

```css
.cd-surface:focus {
  outline: none;
}

.cd-surface:focus-visible {
  outline: 1px solid rgb(255 220 128 / 0.55);
  outline-offset: 2px;
}
```

This is not a recipe state. It is a fallback accessibility affordance.

## Implementation Order

1. Update material type definitions:
   - state names
   - content tone
   - typography tokens
   - edge emission
   - expanded state overlay

2. Update recipe creation/sanitization:
   - new defaults
   - no legacy focus support
   - clamp all new numeric fields

3. Update `materialRecipeToSurfaceProps`:
   - merge overlay into base props
   - resolve content/icon tones
   - resolve typography fields
   - pass emission props
   - pass transform variables
   - add `materialRecipeToInteractiveSurfaceProps`
   - add state variable generation for `hover` and `pressed`

4. Update `MaterialPrimitives`:
   - add surface options
   - add emission layer
   - add data attributes for emission type/edge
   - update content/icon CSS variables
   - remove recipe-driven dependence on `selected` and `hoverPreview`

5. Update CSS:
   - content/icon color variables
   - content/icon glow
   - emission layer profiles
   - hover media query gate
   - pressed transform
   - focus-visible fallback

6. Redesign `MaterialRecipeEditor`:
   - state selector labels
   - state surface section
   - state glow section
   - edge emission section
   - state content section
   - motion section
   - state presets

7. Update main-material preview:
   - storage key bump
   - default nav recipe
   - preview state default `active`
   - remove nav paint overrides
   - prove rest/hover/active/pressed visually

8. Create shared nav recipe/preset:
   - export reusable recipe
   - preview imports default
   - production nav imports same recipe

9. Replace production `NavItem`:
   - render `MaterialNavItem`
   - keep routing behavior unchanged
   - remove hardcoded Tailwind paint

10. Verify:
    - desktop hover works only on mouse/trackpad
    - touch does not stick hover
    - active nav has gold body, icon/text change, corners, and bottom rail/blip
    - app nav and preview nav match closely
    - labels fit at mobile and desktop widths
    - no unrelated material controls regress

## Acceptance Criteria

- Material lab exposes `rest`, `hover`, `active`, and `pressed`.
- There is no `focus` state in material recipe types or editor labels.
- A material recipe can make a button change body tint on hover and active, using recipe-derived hover variables rather than generic CSS polish.
- A material recipe can make text and icon colors change independently by state.
- A material recipe can control label font weight, italic style, uppercase transform, and letter spacing by base recipe and by state overlay.
- A material recipe can add a bottom `rail-and-blip` emission without nav-specific CSS.
- `MaterialNavItem` owns nav label fitting and uses the existing `GameText` primitive inside a fixed-height label slot.
- Main-material preview nav active button visually matches the reference direction:
  - colored active plate
  - brighter icon/text state
  - corner glow
  - bottom glow with center thickness/blip
  - tactile press response
- Production nav consumes the same primitive or recipe behavior.
- Hover styles are gated by pointer capability media query.
- Container queries are used only for component sizing/layout refinements.

## Non-Goals

- No keyboard navigation art direction.
- No migration of old local storage recipes.
- No bitmap filter tint system as the primary icon strategy.
- No nav-only paint layer that cannot be reused elsewhere.
- No broad production screen redesign beyond replacing the nav component after the preview proves the system.
