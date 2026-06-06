# Sparse Surface State Model

Status: active
Date: 2026-06-06

## Goal

Surface states such as hover, pressed, and active behave like normal CSS:
rest styles are the base, and a state only changes the properties it explicitly
overrides.

The JSON contract must stay sparse. A button that only brightens its material on
hover should not emit text, emboss, glow, or corner variables.

## Problem With The Old Model

The old CSS state block tried to preserve rest values like this:

```css
--content-rgb: var(--hover-content-rgb, var(--content-rgb));
```

That is not inheritance. Inside the same rule, it defines `--content-rgb` in
terms of itself. If `--hover-content-rgb` is absent, the fallback can become a
custom-property cycle and the resolved value becomes invalid.

Normal CSS hover is simpler because it does not reassign base properties at all:

```css
.button { text-shadow: ...; }
.button:hover { filter: brightness(1.08); }
```

The surface system must preserve that behavior even though it uses CSS variables
for JSON-driven state changes.

## Contract

1. Rest surface vars emit both the live var and a stable base alias:

```css
--content-shadow: 0 1px 0 rgb(255 255 255 / 0.38);
--content-shadow-base: 0 1px 0 rgb(255 255 255 / 0.38);
```

2. State overlays emit only changed live vars, prefixed by state:

```css
--hover-light-alpha: 0.76;
--hover-surface-layer-brightness: 1.18;
```

3. State overlays never emit `*-base` aliases.

4. State CSS resolves each property from the sparse state var or the base alias:

```css
--content-shadow: var(--hover-content-shadow, var(--content-shadow-base));
```

5. Identity values are valid authored overrides when they disable a generic
default. Example: `surfaceFilterBrightness: 1` disables host-level hover
brightness while `surfaceLayerBrightness: 1.18` brightens paint layers only.

## JSON Example

```ts
surface: {
  textY: 2,
},
surfaceStates: {
  hover: {
    lightStrength: 76,
    darkStrength: 22,
    surfaceFilterBrightness: 1,
    surfaceLayerBrightness: 1.18,
  },
  pressed: {
    lightStrength: 76,
    darkStrength: 22,
    surfaceFilterBrightness: 1,
    surfaceLayerBrightness: 1.18,
    stateTranslateY: 2,
  },
}
```

This means:

- text style and emboss inherit from rest
- the material layers brighten
- the whole host does not filter the text
- pressed uses the same visual treatment and only moves down

## Implementation Rules

- `surfaceStyle()` is responsible for emitting base aliases for authored rest
  CSS variables.
- `computeSurfaceStateVars()` diffs rest vs state and removes `*-base` aliases.
- Recipe-derived state vars follow the same rule.
- CSS state blocks must not use `--x: var(--hover-x, var(--x))`.
- New editor controls should author sparse `surfaceStates`, not full resolved
  visual states.

## Verification

The required tests are:

```txt
npx tsx components/ui/material-lab/surfaceFeatures.test.ts
npx tsx components/ui/material-lab/surfaceStateVars.test.ts
npx tsx components/ui/material-lab/uiNodeValidate.test.ts
npm run build
```

The important visual proof is `/dev/ui-node`: the `VIEW CONTRACT` button keeps
its text emboss on hover, brightens its material on hover, and presses down
without changing text styling.
