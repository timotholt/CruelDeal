# Tensor Renderer 3D Migration Plan

## Purpose

The tensor city pipeline at `/dev/tensor` currently renders a pseudo-3D city using flat polygons with a perspective-projected roof offset — Canvas 2D only. This document describes how to migrate the tensor view from Canvas 2D to a true 3D renderer using Three.js.

Three.js is already a dependency (`three: ^0.184.0`). A separate `docs/city-map-3d-renderer-migration-plan.md` covers the gameplay city map (different code path); this plan is scoped to the tensor pipeline at `services/playgame/city-map/tensor/`.

## Current State Recap

The Canvas 2D pipeline has three logical layers that can be cleanly split between data and presentation:

1. **Field generation** (pure data, no rendering): `tensor_field`, `streamlines`, `graph`, `polygon_finder`, `water_generator`. Outputs road polylines, water polygons, parks, coastline, and lot polygons in world space.
2. **Pseudo-3D projection** (`buildings.ts`): For each lot, computes `lotScreen`, `roof` (offset by camera direction × height × perspective scale), and `sides` (quads bridging ground to roof). All output is in screen space and is recomputed every frame as zoom and camera change.
3. **Canvas 2D draw** (`style.ts`): Fills polygons in z-order — sea, parks, river, road outlines/strokes, then lot footprints, then sides, then roofs.

The projection in `BuildingModels.heightVectorToScreen` is a hack: it scales the roof toward the camera origin in screen space to mimic perspective. For a real 3D pipeline this entire stage is replaced by a 3D scene graph and the GPU perspective matrix.

## Strategy

Two viable shapes:

**A. Replace the renderer wholesale.** Drop Canvas 2D from the tensor view entirely. Three.js scene with extruded `THREE.Shape` building meshes, road meshes (or instanced ribbon geometry), water plane, and an `OrthographicCamera` (or tilted `PerspectiveCamera`). The dat.GUI controls map onto scene parameters.

**B. Layered hybrid.** Keep Canvas 2D for roads/water/ground, render only buildings in a Three.js canvas stacked above it (or below, depending on z). Cheaper to ship, but the seam between renderers is awkward — picking, lighting, fog, post-processing all stop at the boundary.

**Recommendation: A.** Hybrid is a short-term shortcut that becomes technical debt the moment we want shadows that fall on roads, fog over water, or hover-pickable buildings. The data already lives in world space — porting roads to extruded ribbons and water to a plane is straightforward.

## Target Architecture

### Scene composition

- `THREE.Scene` containing:
  - **Ground plane**: large flat mesh at y=0 with `bgColour`.
  - **Water mesh**: extruded coastline / river polygons, slight negative y, possibly an animated shader later.
  - **Park meshes**: flat polygons at small positive y with `grassColour`.
  - **Road meshes**: flat ribbons at slightly higher y than ground. Either stroke-extruded geometry from polylines (offset by `minorWidth`/`majorWidth`/`mainWidth`), or merged buffer geometry. Outlines become a second pass with a slightly larger ribbon underneath.
  - **Building meshes**: per lot, an extruded `THREE.Shape` of the lot polygon with depth = building height. Sides shaded one way, roof another (vertex colours or a two-material `Mesh`).
  - **Lights**: `AmbientLight` plus a directional/`HemisphereLight` for the cyberpunk look. Shadow map optional in phase 2.
  - **Optional fog**: `Fog` or `FogExp2` matching `bgColour` for atmospheric falloff.

### Camera

- `OrthographicCamera` matches the existing zoom-pan feel best and avoids parallax surprises during gameplay.
- `PerspectiveCamera` is the right choice if we want a tilted "tactical map" look. Default tilt 0° to match current top-down, with a GUI slider for pitch.
- Hook `domain_controller`'s pan/zoom directly to camera position and `zoom` (ortho) or distance (perspective).

### Renderer

- `WebGLRenderer({ antialias: true, alpha: true })`.
- `setPixelRatio(window.devicePixelRatio)` gated by the same high-DPI option already in the GUI.
- Resize on window resize the same way `DefaultCanvasWrapper` does today.

### Picking

- `Raycaster` against building meshes for hover. Each lot mesh stores `userData.lotIndex` so the existing slot/landmark hover logic can be ported.

## Data Flow Changes

The data layer needs almost no change. The boundary is `Buildings.lots` (world-space polygons) and the road polylines stored in the tensor controllers. What goes away:

- `BuildingModels.setBuildingProjections` — Canvas screen-space projection. Replaced by writing world-space polygons + heights into mesh geometry once at generate time.
- `BuildingModels.heightVectorToScreen` — gone, replaced by camera matrix.
- `BuildingModels.getBuildingSides` — gone, the extrusion produces sides as part of the geometry.
- `DefaultStyle.draw` — the giant z-ordered Canvas draw chain. Replaced by a `Scene3D` class that builds meshes once per generate and updates only when `needsUpdate` flips.

What stays:

- Tensor field math, streamlines, polygon finding, water generator — all unchanged.
- `domain_controller` zoom/pan input, but its outputs feed the camera instead of the canvas wrapper.
- `dat.GUI` — controls now mutate scene materials, light intensity, fog density, building height scale, etc.

## File Plan

New files under `services/playgame/city-map/tensor/ui/three/`:

- `scene.ts` — owns `THREE.Scene`, `WebGLRenderer`, camera, render loop. Public API mirrors the current `Style.draw()` entry point.
- `building_mesh.ts` — given lots and heights, builds an `ExtrudeGeometry` per lot (or one merged geometry per district for batching) plus materials.
- `road_mesh.ts` — given polylines and widths, builds ribbon geometry. Uses `MeshLine` or hand-rolled triangle strips; outlines are a separate ribbon underneath.
- `water_mesh.ts` — coastline + river polygons as extruded shapes.
- `picking.ts` — raycaster wrapper, hover state, callbacks.
- `materials.ts` — single source of truth for the colour scheme → material mapping. Reads `colour_schemes.json` the same way `style.ts` does.

Modified files:

- `tensor/TensorMapView.tsx` — swap canvas element for a host div, mount Three.js scene there.
- `tensor/ui/main_gui.ts` — point GUI controls at scene params.
- `tensor/boot.ts` — instantiate `Scene3D` instead of `DefaultStyle` / `RoughStyle`.

Files retired from the tensor path (still needed for the gameplay map until that migrates):

- `tensor/ui/canvas_wrapper.ts` — Canvas/Rough wrappers.
- `tensor/ui/style.ts` `DefaultStyle` and `RoughStyle` classes — the heightmap mode can become a debug shader instead.
- `tensor/ui/buildings.ts` `BuildingModels` projection methods — the data part (height assignment, lots) stays.

## Phases

**Phase 0 — Scaffolding (1 PR).** Add `Scene3D` skeleton: empty scene, camera, renderer, mounted next to the existing canvas behind a `?renderer=three` query flag. Verify zoom/pan controls still work and feed the camera.

**Phase 1 — Buildings.** Replace lot rendering with extruded meshes. Two materials (sides, roof). No lights yet, just `MeshBasicMaterial` matching current colours. Confirm the visual matches the current pseudo-3D within tolerance at typical zoom levels.

**Phase 2 — Ground, water, parks, roads.** Port each layer one at a time. Each PR can be visually compared against the Canvas 2D version with the query flag.

**Phase 3 — Lighting and atmosphere.** Add directional + ambient lights, fog, shadow maps gated by a GUI toggle. This is where the cyberpunk look starts paying off.

**Phase 4 — Picking and interaction.** Raycaster hover, click-to-select, integrate with the existing slot/landmark systems.

**Phase 5 — Camera tilt and post-processing.** Optional perspective camera with adjustable pitch. Optional `EffectComposer` with bloom for neon roads.

**Phase 6 — Retire Canvas 2D path.** Delete `style.ts` `DefaultStyle`, `RoughStyle`, `canvas_wrapper.ts` for the tensor route. Remove the `?renderer=three` flag and make Three.js the only path.

## Risks and Mitigations

- **Performance with hundreds of buildings.** Extrude geometry per lot is fine at current counts (~hundreds). If counts grow, merge geometries per district with `BufferGeometryUtils.mergeGeometries` or use `InstancedMesh` keyed on lot shape categories. Profile before optimizing.
- **Road geometry quality.** Ribbon meshes from polylines need careful mitering at corners. `three-mesh-line` or a hand-rolled `Line2` from `examples/jsm/lines` both work; pick whichever survives sharp tensor-field corners cleanly.
- **Z-fighting between ground, parks, roads, water.** Use small y offsets per layer (0.0, 0.01, 0.02, …) and `polygonOffset` on materials where needed.
- **Visual drift from current style.** Pin the colour scheme to `colour_schemes.json` and reuse the same RGB values. Side darkening (the `-40` per channel in `style.ts`) can be replicated by a darker side material.
- **dat.GUI feature parity.** Audit each toggle in `main_gui.ts` and map it explicitly; don't silently drop options like `buildingModels` (becomes "show buildings" toggle), `zoomBuildings` (LOD threshold), heightmap (debug material).
- **High-DPI / canvas scale option.** Already in the GUI; map to `renderer.setPixelRatio` rather than canvas pixel scaling.

## Open Questions

- Camera default: keep ortho top-down, or ship phase 5 perspective tilt as the default?
- Do we want shadows in production, or are they purely debug? Shadows on extruded urban blocks are expensive at high counts.
- Should the tensor view share its `Scene3D` implementation with the gameplay city map (`docs/city-map-3d-renderer-migration-plan.md`), or stay separate? Sharing is the long-term goal but couples two migrations that can otherwise ship independently.
