# Schema-Driven Surface Editor Spec

Status: active
Date: 2026-06-06
Parent: `docs/first-class-surface-architecture-spec.md`
Related: `docs/surface-composition-authoring-spec.md`
Supersedes:

- `docs/typed-surface-host-and-field-metadata-spec.md`
- `docs/material-workbench-design.md`

## Goal

Rebuild the material editor so controls are driven by the surface contract, not
by hand-maintained one-off slider sections.

The editor should derive its controls from two sources:

```txt
surfaceValidate.ts
  valid keys, value types, enum choices, numeric ranges, safety/coercion

surfaceFieldMetadata.ts
  group, label, control type, edit mode, visibility, UX hints
```

The validator is the authority for what data is legal. Field metadata is the
authority for how a human edits that legal data.

## Core Rule

No field appears in the generated editor unless all three are true:

1. `surfaceValidate.ts` accepts the field.
2. `surfaceFieldMetadata.ts` classifies the field.
3. the current editor mode/capability set allows the field.

No validated `SurfaceOptions` field may remain unclassified.

## Why Validation Alone Is Not Enough

A schema can say:

```txt
field: number, min: 0, max: 100
```

That does not decide whether the editor should show:

- a slider
- a stepper
- a numeric input
- a paired vector control
- a hidden renderer-internal field
- no normal control at all

That UX decision belongs to metadata.

## Surface Field Metadata Contract

Every `SurfaceOptions` key must have exactly one `SurfaceFieldDefinition`.

```ts
interface SurfaceFieldDefinition<K extends keyof SurfaceOptions = keyof SurfaceOptions> {
  key: K;
  group:
    | 'renderer'
    | 'base'
    | 'shape'
    | 'texture'
    | 'glass'
    | 'lighting'
    | 'border'
    | 'edgeWear'
    | 'shadow'
    | 'content'
    | 'emission'
    | 'motion'
    | 'state';
  label: string;
  control: 'toggle' | 'slider' | 'select' | 'color' | 'text' | 'json' | 'none';
  editMode: 'rest' | 'state' | 'rest-and-state' | 'renderer-internal';
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}
```

Metadata must classify renderer-only fields too. They should be marked
`renderer-internal`, not omitted.

## Editor Modes

The editor has separate modes for different JSON surfaces:

```txt
Rest editor
  edits the base SurfaceOptions for a material/node/skin

State editor
  edits sparse Partial<SurfaceOptions> overlays for hover/active/pressed

JSON inspector
  shows the authored JSON and compiled SurfaceOptions/stateVars

Renderer internals
  visible only in diagnostics/proof views, not normal editing controls
```

Fields with `editMode: 'rest'` appear in the rest editor.

Fields with `editMode: 'state'` appear only in state overlays.

Fields with `editMode: 'rest-and-state'` appear in both.

Fields with `editMode: 'renderer-internal'` do not appear in normal controls.

## Capability Filtering

Screen targets can still restrict editor controls. Capability filtering happens
after validation and metadata classification.

Examples:

- a static background surface can hide state controls
- a text-only node can hide texture/glass controls if desired
- a feed media root can use custom media controls instead of surface controls

Capabilities are not a substitute for metadata. They only narrow which
classified controls are shown for a selected target.

## Control Renderer Contract

Add a generic control renderer that consumes a field definition and an editing
scope:

```ts
interface SurfaceEditorScope {
  mode: 'rest' | 'state';
  value: Partial<SurfaceOptions>;
  onPatch: (patch: Partial<SurfaceOptions>) => void;
  capabilities?: SurfaceEditorCapabilities;
}
```

Suggested first component split:

```txt
SurfaceGeneratedEditor.tsx
  groups visible field definitions and renders controls

SurfaceFieldControl.tsx
  renders one toggle/slider/select/color/text/json control

surfaceEditorFilters.ts
  filters by editMode, capabilities, and renderer-internal status
```

The first implementation only needs enough controls to prove the architecture:

- `toggle`
- `slider`
- `select`
- `color`
- `text`

`json` controls can initially render a disabled/read-only value or a textarea
behind a feature flag.

## State Overlay Contract

The state editor edits sparse `Partial<SurfaceOptions>` objects.

It must not write resolved rest values into hover/active/pressed just because a
control was displayed.

For a state field:

- unset means inherit from rest
- set means explicitly override rest
- clearing a control removes the key from the state overlay

Example:

```ts
surfaceStates: {
  hover: {
    surfaceLayerBrightness: 1.18,
    surfaceFilterBrightness: 1,
  },
}
```

This must not emit text/content variables unless the state overlay actually
changes text/content fields.

## Typed Host Boundary

`MaterialSurfaceHost` remains a renderer boundary:

```ts
surfaceProps?: SurfaceOptions;
```

Button-only props such as `icon`, `iconRight`, `iconPosition`, `label`, and
`onClick` must travel through button-host props, not `surfaceProps`.

Panel-only props such as `padded` must travel through panel-host props.

Upstream adapters that return surface props must return `SurfaceOptions`, not
`Record<string, unknown>`.

## Acceptance Criteria

- `surfaceFieldDefinitions` has exactly one entry for every validated
  `SurfaceOptions` key.
- a test fails when a validated field lacks metadata.
- normal editor controls are generated from metadata, not hand-authored field
  lists.
- the generated editor does not show `renderer-internal` fields in normal mode.
- state mode writes sparse overlays and supports clearing a key back to inherit.
- `surfaceLayerBrightness`, `surfaceFilterBrightness`, and `textY` are editable
  through metadata-driven controls.
- `MaterialSurfaceHost` and upstream surface callbacks remain typed as
  `SurfaceOptions`.

## First Implementation Slice

1. Add `surfaceEditorFilters.ts`.
2. Add `SurfaceFieldControl.tsx` with toggle, slider, select, color, and text.
3. Add `SurfaceGeneratedEditor.tsx` for one rest group and one state group.
4. Wire one low-risk section of `MaterialRecipeEditor` to generated controls,
   preferably lighting or motion.
5. Keep the old hand-authored sections temporarily for groups not migrated.
6. Add tests for filtering, patch generation, and clearing state overrides.

Do not rebuild all of `MaterialRecipeEditor` in the first pass. Prove the
metadata-to-control loop first, then migrate groups incrementally.
