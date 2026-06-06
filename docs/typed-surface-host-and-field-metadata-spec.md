# Typed Surface Host And Field Metadata Spec

Status: active
Date: 2026-06-06
Parent: `docs/first-class-surface-architecture-spec.md`

## Goal

Close the next two surface-boundary gaps before rebuilding the full JSON
material editor:

1. `MaterialSurfaceHost` must accept typed `SurfaceOptions`, not loose
   `Record<string, any>` bags.
2. The editor must have an exhaustive field metadata registry for every
   `SurfaceOptions` key.

## Typed Surface Host Contract

`MaterialSurfaceHost` is a renderer boundary. It may choose a product host kind
(`button`, `panel`, or `bare`), but `surfaceProps` must be the runtime surface
contract:

```ts
surfaceProps?: SurfaceOptions;
```

The component props should be discriminated by `kind`:

```ts
type MaterialSurfaceHostProps =
  | MaterialSurfaceHostButtonProps
  | MaterialSurfaceHostPanelProps
  | MaterialSurfaceHostBareProps;
```

Button-only props, such as `buttonSize`, `buttonType`, `buttonFullWidth`,
`icon`, `iconRight`, `iconPosition`, `label`, and `onClick`, belong only to the
button variant. Panel-only props, such as `padded`, belong only to the panel
variant.

Upstream adapter callbacks that return surface props should also return
`SurfaceOptions`, not `Record<string, unknown>`.

## Field Metadata Contract

Every `SurfaceOptions` key must have a `SurfaceFieldDefinition`.

The registry answers:

- which editor group owns the field
- which control family can edit it
- whether it is editable in rest state, state overlays, both, or neither
- whether it is renderer/internal data
- numeric bounds and step hints where relevant
- enum option hints where relevant

Renderer-only fields are still represented. They are marked as internal instead
of silently omitted.

Example:

```ts
{
  key: 'surfaceLayerBrightness',
  group: 'lighting',
  label: 'Layer Brightness',
  control: 'slider',
  min: 0,
  max: 3,
  step: 0.01,
  editMode: 'rest-and-state',
}
```

## Acceptance

- `MaterialSurfaceHost` has no `any` or `Record<string, unknown>` surface prop
  escape hatch.
- `MainMaterialPreviewScreen`, `MaterialNodeRenderContext`, and export planner
  surface callback types use `SurfaceOptions`.
- `surfaceFieldDefinitions` has exactly one entry for every key in the validated
  `SurfaceOptions` field table.
- A test fails if a new validated surface field lacks metadata.
- `surfaceLayerBrightness`, `surfaceFilterBrightness`, and `textY` are marked
  state-editable.
