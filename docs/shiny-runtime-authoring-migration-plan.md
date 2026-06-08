---
title: Shiny Runtime and Authoring Migration Plan
status: draft
owner: UI / Authoring / Runtime
---

# Shiny Runtime and Authoring Migration Plan

## Purpose

This plan describes how to refactor the current metallic/reflex/icon material experiments into two clear deliverables:

- **`shiny` runtime**: a lean, production-safe SolidJS runtime subsystem for reflective/premium surfaces.
- **`shiny` authoring tool**: a single internal authoring tool for designing, previewing, validating, and exporting shiny material definitions.

The runtime should eventually be consumable by the production game web app, Tauri clients, and the authoring app. The authoring tool should not ship in game or Tauri client builds.

## Naming Decision

Use `shiny` as the umbrella name for the reflective material system.

`shiny` includes:

- metallic surfaces
- gold/silver/bronze materials
- foil-like treatments
- engraved treatments
- chrome/gloss treatments
- motion-reflex sheen
- baked bitmap metal textures
- Kan/currency icon treatments
- reflective text/buttons/progress bars

The runtime folder can be informal in name but formal in contract.

Near-term location:

```txt
components/ui/shiny/
```

Long-term package direction:

```txt
packages/material-runtime/
packages/ui-runtime/src/shiny/
apps/authoring/src/shiny/
```

## Current State

The existing shiny/metallic system is spread across several places:

```txt
components/ui/KanIcon.tsx
components/ui/MotionReflex.tsx
components/ui/reflex/ReflexController.ts
components/ui/reflex/useReflex.ts
components/ui/reflex/metals.ts
components/ui/reflex/index.ts
components/ui/material-node/
components/screens/IconsPreviewScreen.tsx
index.css
public/gold-textures/
```

Key problems:

- Runtime and authoring concerns are mixed.
- `IconsPreviewScreen` is both a visual lab and partial source of truth for tuning.
- `KanIcon` exposes many workbench-only props.
- `metals.ts` contains both canonical runtime material data and authoring/export/baking concerns.
- `reflex` currently owns material code even though reflex is only the motion/light input layer.
- Root-level dev routes and `/dev` routes both expose experiments.

## Target Architecture

### Authoring Shell / Meta UI

The authoring experience should have a meta UI similar to the current `/dev` page.

Near-term route:

```txt
/dev
  -> authoring/dev index

/dev/shiny
  -> shiny authoring tool
```

Long-term app:

```txt
apps/authoring/
  -> authoring shell
  -> tool picker
  -> individual tools
```

The intended workflow is:

1. Open the authoring app or `/dev`.
2. Choose a tool, such as `Shiny`.
3. Enter that tool.
4. Stay inside that tool until the task is complete.
5. Save/export the resulting artifact.
6. Return to the authoring shell only when switching tools.

The shell is not the editor itself. It is a tool launcher, status surface, and artifact dashboard.

The shell can show:

- Available tools.
- Recent draft artifacts.
- Export status.
- Runtime manifest version.
- Validation errors across tools.
- Links to generated outputs.
- Build/import instructions.

### Runtime

Runtime lives under `components/ui/shiny/` in the current repo phase.

It contains only code safe for production game and Tauri builds:

```txt
components/ui/shiny/
  index.ts
  materials.ts
  textureBake.ts
  textureRegistry.ts
  cssVars.ts
  reflexController.ts
  useReflex.ts
  types.ts

  KanIcon.tsx
  ReflectiveText.tsx
  ReflectiveButton.tsx
  ReflectiveProgressBar.tsx
  ShinySurface.tsx
```

Runtime responsibilities:

- Locked material definitions.
- Deterministic texture baking/loading.
- CSS variable publication.
- Global reflex input.
- Production-safe reflective Solid components.
- Runtime material types.
- Client-parity rendering.

Runtime must not contain:

- Color pickers.
- Stop editors.
- Save/load experiment slots.
- Workbench panels.
- Arbitrary custom material mutation in shipped clients.
- Texture-file browsing for editor experiments.
- Debug-only comparison grids.

### Authoring

Near term, authoring can remain inside the current app as one `/dev/shiny` tool.

```txt
components/screens/ShinyAuthoringScreen.tsx
components/screens/shiny-authoring/
  ShinyWorkbench.tsx
  MaterialStopEditor.tsx
  RuntimePreviewPanel.tsx
  DraftPreviewPanel.tsx
  ExportPanel.tsx
  SurfaceMatrix.tsx
  TextureBakeInspector.tsx
```

Long term, authoring moves to its own app:

```txt
apps/authoring/src/shiny/
```

Authoring responsibilities:

- Edit draft shiny materials.
- Preview multiple surfaces.
- Compare draft/vector/baked outputs.
- Validate against runtime constraints.
- Export locked runtime material definitions.
- Export pre-baked texture assets if selected.
- Run client-parity preview using the runtime package.

Authoring must use two explicit preview paths:

- **Draft preview**: editor-only preview for experimenting.
- **Runtime preview**: imports the real `components/ui/shiny` runtime path and renders exactly what the client will render.

The runtime preview is authoritative.

## Authoring Persistence and File Exchange

The authoring tool runs in a browser, so it cannot directly write arbitrary files to the project directory by default.

The system needs separate concepts for:

- **Draft persistence**: saving work-in-progress locally inside the browser.
- **Export artifact**: producing a portable JSON file or generated code input.
- **Project write/import**: getting the exported artifact into the repository.
- **Runtime consumption**: turning the artifact into runtime data used by the final app.

### Draft Persistence

Drafts should save automatically in browser storage.

Recommended near-term storage:

```txt
localStorage or IndexedDB
```

Use IndexedDB if drafts become large or include many variations. Use localStorage only for small/simple state.

Draft data can include:

- current material stops
- editor UI state
- active material
- comparison settings
- unsaved experiments
- draft names
- timestamps

Drafts are not runtime artifacts. They are editor state.

Example draft key:

```txt
crueldeal.authoring.shiny.drafts.v1
```

### Export Artifact

The primary interchange format should be JSON.

The shiny authoring tool should export:

```txt
shiny-materials.manifest.json
```

This JSON is the source artifact that moves from authoring into runtime.

The authoring UI should support:

- Download JSON.
- Copy JSON to clipboard.
- Validate JSON before export.
- Show a diff against the currently loaded runtime manifest.
- Optionally export pre-baked texture images later.

Browser-safe export options:

1. **Download file**
   - Use `Blob` and an `<a download>` link.
   - User manually saves the file.

2. **Copy to clipboard**
   - User pastes into the repo or PR.

3. **File System Access API**
   - Optional Chromium-only enhancement.
   - Lets user pick a file and write to it after explicit permission.
   - Not portable enough to be the only workflow.

4. **Dev-server write endpoint**
   - Optional local-development-only endpoint.
   - Browser sends JSON to a trusted local server process.
   - Server writes to `outputs/shiny/` or generated runtime files.
   - Must be disabled in production/hosted authoring unless properly authenticated.

5. **Future Tauri authoring app**
   - If authoring becomes a Tauri desktop app, it can write files through Tauri commands.
   - This is useful for internal tools but should not be required for web authoring.

### Recommended Near-Term Save Flow

Near term, use this flow:

1. Author edits shiny material in `/dev/shiny`.
2. Tool autosaves draft to browser storage.
3. User clicks `Validate`.
4. User clicks `Export JSON`.
5. Browser downloads `shiny-materials.manifest.json`.
6. User places it in:

```txt
outputs/shiny/shiny-materials.manifest.json
```

7. A script imports/generates runtime data from that manifest.

Example command:

```txt
npm run shiny:generate
```

Generated runtime file:

```txt
components/ui/shiny/generated/materials.generated.ts
```

### Recommended Mid-Term Save Flow

Add a local dev write path:

1. Run authoring/dev server locally.
2. `/dev/shiny` detects local write capability.
3. User clicks `Save to Workspace`.
4. Browser sends manifest to a local-only endpoint.
5. Endpoint writes:

```txt
outputs/shiny/shiny-materials.manifest.json
components/ui/shiny/generated/materials.generated.ts
```

This should be explicit and gated.

Rules:

- Never silently write files.
- Always show target paths before writing.
- Always validate first.
- Always show success/failure.
- Keep manual download as fallback.

### Recommended Long-Term Save Flow

In a separate authoring app:

- Use a server-side authoring API if web-hosted.
- Or use Tauri commands if authoring is a Tauri desktop tool.
- Save artifacts to a content repository, object store, CMS, or local workspace.
- Generate runtime manifests through CI or an explicit export pipeline.

Long-term, the authoring app should not directly mutate production runtime code in an uncontrolled way. It should produce versioned artifacts that are reviewed, committed, and built.

## Runtime Interchange Contract

Runtime should not read authoring drafts.

Runtime should read only a locked generated artifact:

```txt
components/ui/shiny/generated/materials.generated.ts
```

or, later:

```txt
packages/material-runtime/src/generated/materials.generated.ts
```

The artifact is generated from:

```txt
outputs/shiny/shiny-materials.manifest.json
```

Suggested flow:

```txt
authoring draft
  -> export manifest JSON
  -> validate manifest
  -> generate runtime TS
  -> game/Tauri/import runtime TS
```

This gives the final app stable TypeScript data and avoids runtime JSON loading unless intentionally desired.

### Why JSON?

JSON is the right interchange format because:

- It is portable.
- It can be downloaded from a browser.
- It can be validated with schemas.
- It can be committed to git.
- It can feed code generation.
- It can be used by non-web tooling later.
- It does not require the browser to write project files directly.

Runtime can still consume generated TypeScript for type safety and bundle friendliness.

### Manifest Validation

The authoring tool and generation script should validate:

- material IDs are known
- required materials exist
- stop offsets are sorted or sortable
- offsets are within `0..100`
- colors are valid hex colors
- texture sizes are allowed
- grain is within allowed bounds
- seed is present
- no unknown production fields are present

Invalid manifests should not generate runtime code.

### Texture Asset Interchange

Initially, runtime can bake textures from stops.

Later, authoring may export pre-baked textures:

```txt
outputs/shiny/textures/gold-512.png
outputs/shiny/textures/gold-128.png
outputs/shiny/textures/silver-512.png
```

The manifest can reference them:

```json
{
  "id": "gold",
  "texture": {
    "large": "textures/gold-512.png",
    "small": "textures/gold-128.png"
  }
}
```

Runtime strategy should be explicit:

- **generated texture mode**: runtime bakes from stops once
- **asset texture mode**: runtime loads exported images

Do not mix these implicitly.

## Dependency Rule

Dependencies flow one way:

```txt
shiny authoring
  -> shiny runtime
  -> shared UI/runtime dependencies
```

Runtime must never import authoring.

Disallowed:

```txt
components/ui/shiny/* -> components/screens/shiny-authoring/*
components/ui/shiny/* -> /dev/*
production app -> authoring-only controls
Tauri build -> authoring screens
```

Allowed:

```txt
ShinyAuthoringScreen -> components/ui/shiny
ShinyAuthoringScreen -> authoring-only editor widgets
Game/Tauri app -> components/ui/shiny
```

## Runtime Material Contract

Runtime materials are immutable once exported.

Proposed type:

```ts
export type ShinyMaterialId =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'kan'
  | 'credit'
  | 'mark'
  | 'engraved';

export interface ShinyStop {
  offset: number;
  color: string;
}

export interface ShinyMaterialDefinition {
  id: ShinyMaterialId;
  displayName: string;
  stops: ShinyStop[];
  highlight: string;
  angle: number;
  textureSize: number;
  smallTextureSize: number;
  grain: number;
  seed: number;
}
```

Runtime rules:

- No arbitrary new materials in production.
- No stop editing in production.
- No random grain in production.
- No unbounded texture cache.
- No per-frame baking.
- No per-element pointer listeners.

## Runtime Surface Contract

Runtime shiny components should accept semantic material IDs, not editor profiles.

Example:

```ts
export interface RuntimeKanIconProps {
  size?: number | string;
  material?: ShinyMaterialId;
  variant?: 'thin' | 'medium' | 'thick';
  interactive?: boolean;
  glow?: 'none' | 'subtle' | 'reward';
  class?: string;
  idPrefix?: string;
}
```

Workbench-only props such as custom stops, bake size, arbitrary texture selection, softbox controls, and K geometry controls should move to authoring-only wrappers.

## Authoring Export Contract

The authoring tool exports one runtime manifest.

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
      "seed": 1337,
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

Runtime imports the manifest or a generated TypeScript version of it.

## Route Plan

Near term:

```txt
/dev/shiny
```

Temporary aliases:

```txt
/dev/icons -> /dev/shiny
/icons -> /dev/shiny or legacy alias
```

Eventually remove or redirect root-level authoring/test routes.

The dev index should expose one shiny tool link:

```txt
/dev/shiny - Shiny Material Authoring
```

Not multiple competing metallic/icon/material routes.

## Migration Phases

## Phase 0: Freeze Current Behavior

Goal: avoid losing visual progress while refactoring.

Tasks:

1. Capture screenshots or visual baselines of current `IconsPreviewScreen` key states.
2. Identify current default values for gold, silver, brass/bronze, mark, credit, kan, and engraved.
3. Record current Kan icon default geometry.
4. Record current default render mode behavior.
5. Mark `IconsPreviewScreen` as legacy authoring surface until `/dev/shiny` replaces it.

Exit criteria:

- Current visual defaults are documented.
- Refactor has a known target to preserve.

## Phase 1: Create `components/ui/shiny` Runtime Folder

Goal: establish the new runtime home without changing behavior.

Create:

```txt
components/ui/shiny/
  index.ts
  types.ts
  materials.ts
  textureBake.ts
  textureRegistry.ts
  cssVars.ts
  reflexController.ts
  useReflex.ts
```

Move or copy runtime logic from:

```txt
components/ui/reflex/metals.ts
components/ui/reflex/ReflexController.ts
components/ui/reflex/useReflex.ts
```

Initial compatibility rule:

- Existing imports can keep working via re-exports from `components/ui/reflex`.
- New code imports from `components/ui/shiny`.

Exit criteria:

- `components/ui/shiny` exports all runtime material/reflex APIs.
- Existing UI still renders unchanged.
- Old `reflex` imports are compatibility-only.

## Phase 2: Split Material Data from Texture Baking

Goal: make runtime material definitions plain data.

Refactor current `metals.ts` into:

```txt
materials.ts
  - ShinyMaterialId
  - SHINY_MATERIALS
  - default material definitions
  - semantic runtime IDs

textureBake.ts
  - deterministic canvas texture creation
  - seeded grain/noise

textureRegistry.ts
  - one texture per material/size tier
  - bounded cache
  - runtime lookup helpers

cssVars.ts
  - publishShinyCssVars()
  - root variable names
```

Exit criteria:

- Runtime material definitions contain no editor-only presets.
- `PRESETS` is either moved to authoring or clearly marked legacy/authoring-only.
- Texture generation can be called only for known runtime materials.

## Phase 3: Create Production-Safe Shiny Components

Goal: move runtime components into the shiny namespace.

Move or wrap:

```txt
components/ui/KanIcon.tsx -> components/ui/shiny/KanIcon.tsx
components/ui/MotionReflex.tsx -> components/ui/shiny/ReflectiveText.tsx etc.
```

Suggested files:

```txt
components/ui/shiny/KanIcon.tsx
components/ui/shiny/ReflectiveText.tsx
components/ui/shiny/ReflectiveButton.tsx
components/ui/shiny/ReflectiveProgressBar.tsx
components/ui/shiny/ShinySurface.tsx
```

Keep temporary compatibility wrappers:

```txt
components/ui/KanIcon.tsx
components/ui/MotionReflex.tsx
```

These wrappers should re-export from `components/ui/shiny` during migration.

Exit criteria:

- New code imports shiny runtime components from `components/ui/shiny`.
- Existing routes still work.
- Production components can avoid importing legacy authoring APIs.

## Phase 4: Slim Runtime `KanIcon`

Goal: separate production icon rendering from authoring controls.

Create a runtime-facing API:

```ts
export interface RuntimeKanIconProps {
  size?: number | string;
  material?: ShinyMaterialId;
  variant?: 'thin' | 'medium' | 'thick';
  interactive?: boolean;
  glow?: 'none' | 'subtle' | 'reward';
  class?: string;
  idPrefix?: string;
}
```

Move editor-only options out of the production component:

- `customStops`
- arbitrary `gradientProfile` letters
- arbitrary `gradientAngle`
- arbitrary `gradientScale`
- arbitrary `gradientShift`
- softbox controls
- texture-file selection
- bake size controls
- bake grain controls
- low-level K geometry controls

Authoring can still drive these through an authoring-only `DraftKanIconPreview` or `ShinyDraftSurface`.

Exit criteria:

- Production `KanIcon` renders from semantic material IDs.
- Authoring has a separate wrapper for experimental geometry/material controls.
- Runtime and authoring APIs are clearly different.

## Phase 5: Build the Single `/dev/shiny` Authoring Tool

Goal: replace scattered shiny/metal/icon labs with one authoring surface.

Create:

```txt
components/screens/ShinyAuthoringScreen.tsx
components/screens/shiny-authoring/
  ShinyWorkbench.tsx
  MaterialListPanel.tsx
  MaterialStopEditor.tsx
  SurfaceMatrix.tsx
  DraftPreviewPanel.tsx
  RuntimePreviewPanel.tsx
  ExportPanel.tsx
  TextureBakeInspector.tsx
```

The authoring tool should include:

- Material selector.
- Stop editor.
- Color picker.
- Angle/grain/seed controls.
- Surface matrix preview.
- Draft preview.
- Runtime/client-parity preview.
- Export manifest panel.
- Optional exported texture preview.

Surface matrix should include:

- Kan icon.
- Reflective text.
- Rich text token.
- Button.
- Progress bar.
- Small text.
- Large display text.

Exit criteria:

- `/dev/shiny` exists.
- It can preview all runtime surfaces.
- It has an explicit runtime/client-parity preview.
- It can export a runtime manifest.

## Phase 6: Migrate Routes and Dev Links

Goal: make `/dev/shiny` the single shiny tool.

Update dev links:

```txt
/dev/shiny - Shiny Material Authoring
```

Add or update routes:

```txt
/dev/shiny -> ShinyAuthoringScreen
/dev/icons -> redirect/alias to /dev/shiny
/icons -> legacy redirect/alias to /dev/shiny
```

Deprecate:

```txt
/icons
/dev/icons
```

Exit criteria:

- Dev index points to `/dev/shiny`.
- Existing links do not break abruptly.
- New docs refer to `/dev/shiny` only.

## Phase 7: Move Authoring-Only Constants Out of Runtime

Goal: prevent runtime from accumulating editor data.

Move editor presets and draft data to:

```txt
components/screens/shiny-authoring/authoringPresets.ts
```

or later:

```txt
apps/authoring/src/shiny/authoringPresets.ts
```

Runtime keeps only:

```txt
SHINY_MATERIALS
```

Authoring may keep:

```txt
EXPERIMENTAL_GRADIENT_PRESETS
SOFTBOX_PRESETS
TEXTURE_FILE_OPTIONS
DRAFT_SURFACE_VARIANTS
```

Exit criteria:

- Production shiny runtime has no authoring-only presets.
- Runtime bundle does not import authoring presets.

## Phase 8: Enforce Build Separation

Goal: ensure Tauri/game builds do not include authoring.

Near-term enforcement:

- Keep authoring routes behind `/dev`.
- Avoid production imports from authoring folders.
- Prefer dynamic imports for dev screens if needed.

Long-term enforcement:

```txt
apps/game-web
apps/game-tauri
apps/authoring
packages/ui-runtime
packages/material-runtime
```

Build targets:

```txt
game-web:build
game-tauri:build
authoring:build
```

Exit criteria:

- Tauri build entrypoint does not import authoring routes.
- Production game build does not import authoring screens.
- Authoring imports runtime, not the reverse.

## Phase 9: Runtime Manifest Generation

Goal: connect authoring output to runtime input.

Authoring exports:

```txt
outputs/shiny/shiny-materials.manifest.json
```

A generation script can produce:

```txt
components/ui/shiny/generated/materials.generated.ts
```

or later:

```txt
packages/material-runtime/src/generated/materials.generated.ts
```

Runtime imports generated locked materials.

Exit criteria:

- Runtime material data is generated from the authoring manifest or manually synced with the same schema.
- The runtime preview in `/dev/shiny` uses the generated runtime artifact.
- No manual copy/paste is needed for finalized materials.

## Phase 10: Remove Legacy Compatibility Paths

Goal: complete the migration.

Remove or reduce:

```txt
components/ui/reflex/metals.ts
components/ui/reflex/index.ts material exports
components/ui/KanIcon.tsx compatibility wrapper
components/ui/MotionReflex.tsx compatibility wrapper
/icons route
/dev/icons route if no longer needed
```

Keep only if external code still relies on them.

Exit criteria:

- Runtime shiny code is under `components/ui/shiny`.
- Authoring shiny code is under `/dev/shiny` or authoring app.
- No production code imports old metallic/reflex material paths.

## Testing Strategy

### Unit Tests

Test:

- Material manifest validation.
- Stop sorting/clamping.
- Deterministic texture seed behavior.
- Texture registry cache keys.
- Runtime ID lookup.
- CSS variable publishing output.

### Visual Tests

Capture:

- Gold/silver/bronze Kan icon.
- Small rich text token.
- Large reflective text.
- Button state.
- Progress bar.
- Runtime preview vs exported manifest preview.

### Build Tests

Verify:

- Game build does not import authoring screen modules.
- Tauri build does not import authoring screen modules.
- Authoring build imports runtime shiny modules successfully.

## Risk Areas

### Visual Drift

Risk: moving runtime code changes the look.

Mitigation:

- Capture baselines before refactor.
- Use compatibility wrappers during migration.
- Keep runtime preview authoritative.

### Bundle Leakage

Risk: authoring code accidentally ships with game/Tauri builds.

Mitigation:

- Separate folders.
- One-way imports.
- Later, separate app entrypoints.

### Runtime API Too Flexible

Risk: runtime keeps authoring controls and becomes heavy.

Mitigation:

- Semantic material IDs only.
- Variant props instead of low-level controls.
- Editor controls live only in authoring.

### Texture Non-Determinism

Risk: runtime textures differ per session/browser.

Mitigation:

- Seeded deterministic grain.
- Optionally pre-bake textures at authoring time.

### Route Confusion

Risk: `/icons`, `/dev/icons`, and `/dev/shiny` compete.

Mitigation:

- Make `/dev/shiny` canonical.
- Convert old routes to aliases temporarily.
- Update docs and dev index.

## Final Desired State

Runtime:

```txt
components/ui/shiny/
  index.ts
  materials.ts
  textureBake.ts
  textureRegistry.ts
  cssVars.ts
  reflexController.ts
  useReflex.ts
  KanIcon.tsx
  ReflectiveText.tsx
  ReflectiveButton.tsx
  ReflectiveProgressBar.tsx
```

Authoring:

```txt
/dev/shiny
components/screens/shiny-authoring/
```

Future:

```txt
apps/authoring/src/shiny/
packages/material-runtime/
packages/ui-runtime/src/shiny/
```

The shipped game and Tauri clients import only runtime shiny modules. The authoring tool imports runtime shiny modules for final previews and wraps them with editor-only tooling.
