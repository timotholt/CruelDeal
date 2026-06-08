---
title: Metallic Material System Runtime/Authoring Spec
status: draft
owner: UI / Material System
---

# Metallic Material System Runtime/Authoring Spec

See also: `docs/shiny-runtime-authoring-migration-plan.md` for the detailed migration/refactor plan that consolidates metallic/reflex/icon authoring into one `shiny` runtime subsystem and one `/dev/shiny` authoring tool.

## Purpose

The metallic material system defines how CruelDeal renders premium metal surfaces such as gold, silver, bronze/brass, marks, credits, engraved text, and the Kan icon treatment.

The system has two distinct modes:

- **Author-time**: experimental, editable, heavy, and visual-design focused.
- **Runtime**: locked, deterministic, lean, and optimized for repeated in-game rendering.

Runtime should not be a gradient editor. Once canonical metals are finalized, runtime should only consume finalized material definitions and render them efficiently.

Authoring tools must use the same runtime material package that the game client uses for final rendering. Authoring may wrap runtime components with editors, inspectors, exporters, and comparison views, but it must not maintain a separate renderer for the final preview path. This is required for visual consistency and for authoring to reveal real client bugs before content ships.

## Current System Summary

The current implementation is centered around these pieces:

- **`components/ui/reflex/metals.ts`**
  - Defines canonical metal stops in `METALS` and `PRESETS`.
  - Converts metal stops to SVG stops and CSS gradients.
  - Bakes canvas-generated bitmap textures from gradient stops.
  - Publishes CSS variables such as `--metal-gold-gradient`, `--metal-gold-highlight`, and `--metal-gold-texture-sm`.

- **`components/ui/reflex/ReflexController.ts`**
  - Owns the global pointer/tilt vector.
  - Writes normalized reflex direction to root CSS variables.
  - Avoids per-surface event listeners.

- **`components/ui/KanIcon.tsx`**
  - Renders the Kan hex/K icon using SVG passes.
  - Supports vector gradients, photographic texture fills, procedural/baked canvas fills, softbox overlays, bevels, glow, and interactive reflex movement.

- **`components/ui/MotionReflex.tsx`**
  - Provides reusable reflective DOM surfaces such as reflective text, buttons, and progress bars.

- **`index.css`**
  - Maps metal classes to injected CSS variables.
  - Defines vector sheen and bitmap/canvas-metal rendering behavior for text-like DOM surfaces.

- **`components/screens/IconsPreviewScreen.tsx`**
  - Acts as the authoring/workbench surface for experimenting with profiles, stops, angles, fill methods, grain, softbox settings, glow, and geometry.

## Core Concept

A metallic surface is composed from:

1. **Material identity**
   - Example: `gold`, `silver`, `bronze`, `mark`, `credit`, `kan`, `engraved`.

2. **Finalized color stop list**
   - Ordered stops from `0..100`.
   - These are locked for runtime.

3. **Baked bitmap texture**
   - Generated from the finalized stop list.
   - Runtime may generate this once per material at startup/module initialization, or load pre-baked assets.

4. **Reflex movement**
   - A single global pointer/tilt vector shifts the visible texture or sheen.
   - Runtime surfaces do not own input listeners.

5. **Surface adapter**
   - The same material can be rendered on text, buttons, progress bars, icons, resource chips, or card frames.

## Runtime Goals

Runtime must be:

- **Lean**
  - No gradient editing UI.
  - No custom stop creation.
  - No arbitrary profile mutation.
  - No visual workbench state.

- **Deterministic**
  - The same material definition should produce the same visual result.
  - If bitmap textures are generated at runtime, grain/noise must be deterministic or disabled.

- **Cache-friendly**
  - One bitmap per canonical material and size tier.
  - No unbounded cache growth.
  - No cache keys based on user-edited values at runtime.

- **Surface-agnostic**
  - Text, icons, buttons, and future UI surfaces should reference the same finalized materials.

- **Input-efficient**
  - One global reflex controller.
  - No per-element pointer listeners.
  - No per-frame canvas baking.

## Runtime Non-Goals

Runtime should not support:

- Editing gradient stops.
- Saving/loading experimental profiles.
- Arbitrary custom gradients.
- Arbitrary custom texture files.
- Heavy softbox controls.
- Workbench-only geometry tuning.
- Random, non-deterministic grain generation.
- Per-element event listeners for metal movement.
- Re-baking textures in response to pointer movement.

## Author-Time Goals

Author-time tools should support:

- Editing metal stops.
- Comparing vector gradient vs bitmap texture output.
- Adjusting angle, grain, texture size, and highlight behavior.
- Testing material surfaces across icons, text, buttons, and rich text.
- Previewing mobile/low-power modes.
- Exporting finalized material definitions.
- Exporting pre-baked textures if runtime should avoid canvas baking entirely.

Author-time is allowed to be heavy because it is not part of the in-game render path.

## Proposed Separation

The separation is architectural, not visual. Authoring and runtime should be separate applications or folders, but the final preview inside authoring should import and exercise the same runtime modules used by the shipped game client.

The authoring system may have extra codepaths for editing, draft previews, diagnostics, and export. It should not have a separate final-render codepath for metals.

### Author-Time Package/Area

Author-time functionality should live in an explicit workbench area, for example:

- `/dev` routes during the current app phase
- a future `dev/` or `authoring/` app/folder
- `components/screens/IconsPreviewScreen.tsx` while it remains in the main app
- `tools/material-workbench/`
- `components/ui/material-authoring/`

It may contain:

- Stop editors.
- Color pickers.
- Softbox controls.
- Geometry tuners.
- Texture-file previews.
- Save/load experiment slots.
- Export buttons.
- Visual comparison grids.

It should not be imported by production gameplay UI.

Authoring code may import runtime code. Runtime code must not import authoring code.

### Runtime Package/Area

Runtime functionality should live in a small stable material module, for example:

- `components/ui/reflex/ReflexController.ts`
- `components/ui/material-runtime/materials.ts`
- `components/ui/material-runtime/textures.ts`
- `components/ui/material-runtime/MetalSurface.tsx`
- `components/ui/KanIcon.tsx` after production simplification

It should contain only:

- Canonical locked material definitions.
- Texture creation/loading.
- CSS variable publication.
- Reflex input state.
- Lightweight surface helpers.

Runtime code should be packaged so it can be consumed by:

- the game web client
- future iOS/Android clients where practical
- the authoring/dev app for final previews
- automated visual tests

The same runtime package should be the source of truth for material rendering behavior.

### Shared Runtime Preview Contract

Every authoring surface needs two preview modes:

- **Draft/edit preview**
  - May show editor-only overlays, stop handles, debug readouts, vector comparisons, and experimental variants.
  - May use temporary data that has not been promoted to the runtime registry.

- **Client parity preview**
  - Must render through the same runtime material package as the final game client.
  - Must consume the exported/generated runtime manifest.
  - Must use the same texture baking/loading strategy as the client target being validated.
  - Must not call editor-only renderers.

If the draft preview and client parity preview differ, the client parity preview wins.

## Runtime Material Definition

A runtime material should be plain data.

Example shape:

```ts
export type RuntimeMetalId = 'gold' | 'silver' | 'bronze' | 'mark' | 'credit' | 'kan' | 'engraved';

export interface RuntimeMetalStop {
  offset: number;
  color: string;
}

export interface RuntimeMetalDefinition {
  id: RuntimeMetalId;
  displayName: string;
  stops: RuntimeMetalStop[];
  highlight: string;
  angle: number;
  textureSize: number;
  smallTextureSize: number;
  grain: number;
}
```

At runtime, these definitions are immutable.

## Runtime Texture Strategy

There are two acceptable runtime strategies.

### Option A: Generate Once at Runtime

On app startup or first material use:

1. Read finalized material definitions.
2. Generate one bitmap texture per material size tier.
3. Publish CSS variables.
4. Reuse the generated URLs for all surfaces.

Rules:

- Bake once per material.
- Bake once per size tier.
- Never bake on pointer movement.
- Never bake because of user-authored changes.
- Use deterministic grain/noise.

This is flexible and avoids shipping many baked image files.

### Option B: Pre-Bake at Author-Time

At author-time:

1. Finalize metal stops.
2. Export PNG/WebP textures.
3. Commit those textures as static assets.
4. Runtime loads them by URL.

Rules:

- Runtime does no canvas work.
- Materials still have canonical metadata.
- Static textures become part of the asset contract.

This is the leanest runtime path.

## Recommended Runtime Path

Use **Option A initially**, with deterministic baking and a fixed material registry.

Move to **Option B** if profiling shows startup canvas baking is expensive or if exact visual consistency across browsers becomes critical.

## Rendering Model

### Bitmap Metal Method

The preferred runtime method is bitmap metal:

- A finalized metal texture is revealed through the surface shape.
- Reflex movement shifts the texture/background position.
- Surfaces do not regenerate the texture.

For DOM text/buttons:

- Use CSS `background-image`.
- Use `background-clip: text` for text.
- Use normal background rendering for buttons/bars.

For SVG icons:

- Use an SVG mask or pattern/image reference.
- The Kan icon shape reveals the same baked material texture.

### Vector Gradient Method

Vector gradients may remain useful for:

- Debugging.
- Author-time comparison.
- Very small/simple surfaces.
- Fallback rendering.

But the production runtime target should prefer bitmap metal for consistency and performance.

### Photographic Texture Method

Photographic texture files such as `Gold01.png` should be considered author-time or special-case art direction assets, not the default runtime material path.

## Reflex Runtime Contract

Runtime reflex should remain global:

- `ReflexController` owns pointer/tilt input.
- It writes root variables such as `--reflex-gx` and `--reflex-gy`.
- CSS surfaces consume those variables.
- SVG surfaces consume the same normalized direction through a lightweight hook or direct CSS variable strategy.

Runtime surfaces should not attach their own pointer listeners.

## Surface Responsibilities

### Material Registry

Responsible for:

- Canonical material IDs.
- Locked stop lists.
- Highlight colors.
- Default angles.
- Texture settings.

Not responsible for:

- Surface geometry.
- UI controls.
- Editor state.

### Texture Runtime

Responsible for:

- Creating or loading textures.
- Publishing texture CSS variables.
- Maintaining a fixed-size cache.

Not responsible for:

- Editing stops.
- Random visual variation.
- Per-surface behavior.

### Reflex Controller

Responsible for:

- Pointer/tilt input.
- Frame throttling.
- Root CSS variables.

Not responsible for:

- Material definitions.
- Surface rendering.

### Surface Components

Responsible for:

- Applying material textures to their geometry.
- Choosing appropriate masks/clipping.
- Applying bevels, shadows, or shape-specific styling.

Not responsible for:

- Defining metal colors.
- Baking new arbitrary textures.
- Owning pointer input.

## KanIcon Runtime Simplification

The production `KanIcon` should eventually be reduced to:

- Geometry props that are truly needed at runtime.
- Material ID.
- Size.
- Optional glow/intensity state.
- Optional disabled/static reflex behavior.

Production `KanIcon` should not expose:

- Arbitrary custom stops.
- Gradient profile editor presets.
- Texture-file selector.
- Softbox editing controls.
- Bake size/grain controls.
- Detailed K tuning controls unless needed by real product variants.

A possible production prop shape:

```ts
export interface RuntimeKanIconProps {
  size?: number | string;
  material?: RuntimeMetalId;
  variant?: 'thin' | 'medium' | 'thick';
  interactive?: boolean;
  glow?: 'none' | 'subtle' | 'reward';
  class?: string;
  idPrefix?: string;
}
```

Author-time can keep the full experimental prop surface.

## Author-Time Export Contract

The authoring tool should export a finalized material manifest.

Example:

```json
{
  "version": 1,
  "materials": {
    "gold": {
      "displayName": "Gold",
      "angle": 135,
      "highlight": "#FFFDDA",
      "textureSize": 512,
      "smallTextureSize": 128,
      "grain": 8,
      "stops": [
        { "offset": 0, "color": "#7C6535" },
        { "offset": 8, "color": "#997E47" },
        { "offset": 26, "color": "#B8A269" },
        { "offset": 30, "color": "#7C6535" },
        { "offset": 34, "color": "#FFFDDA" },
        { "offset": 60, "color": "#D5BB8A" },
        { "offset": 81, "color": "#B8A269" },
        { "offset": 85, "color": "#7C6535" },
        { "offset": 93, "color": "#FBECA9" },
        { "offset": 100, "color": "#7C6535" }
      ]
    }
  }
}
```

Runtime imports this manifest or a generated TypeScript version of it.

## Locked Runtime Material Names

The final runtime registry should use semantic names, not experiment profile letters.

Recommended runtime IDs:

- `gold`
- `silver`
- `bronze`
- `kan`
- `credit`
- `mark`
- `engraved`

Author-time may still use profile labels such as `A`, `B`, `C`, `J`, `R1`, and `R2`, but these should not become gameplay/runtime API unless intentionally promoted.

## Performance Rules

Runtime must follow these rules:

1. No canvas baking during pointer/tilt updates.
2. No unbounded texture cache.
3. No per-element pointer or device orientation listeners.
4. No arbitrary runtime custom stops.
5. No editor controls bundled into gameplay UI.
6. Prefer small textures for text glyph clipping.
7. Prefer larger textures only for large icon/card-frame surfaces.
8. Avoid CSS filters/glows by default on dense surfaces.
9. Gate heavy visual effects behind explicit momentary states, such as rewards.

## Migration Plan

### Phase 1: Formalize Runtime Registry

- Rename or wrap current `METALS` as locked runtime materials.
- Add `bronze` if that is the intended runtime name instead of `brass`.
- Keep `PRESETS` as author-time/workbench-only data.

### Phase 2: Extract Author-Time Tools

- Move editor-only profile controls, stop editors, texture pickers, and softbox tuners into an authoring namespace.
- Ensure production UI does not import authoring modules.

### Phase 3: Slim Runtime KanIcon

- Introduce a production-facing `RuntimeKanIconProps` API.
- Internally render from locked material IDs.
- Keep experimental `KanIcon` or `KanIconWorkbench` separate if needed.

### Phase 4: Deterministic Texture Baking

- Replace random grain with deterministic seeded grain.
- Cap texture caches.
- Generate only known material/size combinations.

### Phase 5: Optional Pre-Baked Assets

- If needed, export final textures to static files.
- Replace runtime canvas baking with static asset URLs.

## Open Decisions

- Should the runtime name be `bronze` or `brass`?
- Should runtime generate bitmap textures once, or should author-time export pre-baked image assets?
- Should vector gradient mode remain available in production as a fallback?
- Which surfaces require large textures versus small text-optimized textures?
- Should `KanIcon` production geometry be fully locked or variant-based?

## Recommendation

Treat the current system as a successful authoring prototype plus a nearly complete runtime foundation.

The target architecture should be:

- **Author-time** owns experimentation.
- **Runtime** owns locked material data, deterministic bitmap generation/loading, shared reflex variables, and lean surface rendering.

Once gold, silver, and bronze are finalized, their stops should be considered immutable runtime constants. Runtime should create or load exactly those textures, then reuse them everywhere.
