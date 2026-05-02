# City Map 3D Renderer Migration Plan

## Purpose

Move Cruel Deal's live city map from the current flat SVG renderer toward a cinematic 3D/2.5D tactical city board with zoom, pan, variable-height buildings, lighting, shadows, glow routes, hoverable slots, and future camera tilt.

The target visual direction is a dark blue tactical surveillance map: raised urban blocks, glowing roads/routes, readable player interaction markers, and enough depth to feel premium without making gameplay hard to parse.

## Recommendation

Use Three.js for the 3D renderer.

The project previously had `pixi.js` installed, but Pixi is the wrong default for this specific ambition. Pixi would be strong for a fast 2D/WebGL map, sprites, particles, and post-processing-like filters. The requested final direction needs real scene depth:

- variable-height extruded buildings
- directional shadows
- camera tilt and orthographic zoom
- depth-aware label/marker placement
- instanced geometry for hundreds of repeated buildings
- optional bloom and depth-of-field style effects
- a path toward true 3D scene composition

Three.js is the cleaner long-term fit. Pixi can remain useful elsewhere for 2D effects, but the city map should not be forced through a 2D renderer if the design goal is a raised tactical city.

## Existing Codebase Reality

The current city map is already mostly world-space in data. The world coordinate system is the `CityMap.width x CityMap.height` space, currently `360 x 448`.

Important existing files:

- `services/playgame/city-map/types.ts`
- `services/playgame/city-map/config.ts`
- `services/playgame/city-map/city-v35.ts`
- `components/screens/play/city-map/CityMapBoard.tsx`
- `components/screens/play/city-map/CityMapSvg.tsx`
- `components/screens/play/city-map/CityMapSlots.tsx`
- `components/screens/play/city-map/CityMapLandmarks.tsx`
- `components/screens/play/city-map/useCityMapHover.ts`
- `components/screens/play/city-map/RouteDemoLayer.tsx`
- `components/screens/play/city-map/cityMapStyles.css`

The data model already includes world/map positions:

- `Point`
- `CityMap.width`
- `CityMap.height`
- district polygons
- land/water polygons
- road graph edges
- building polygons
- slot coordinates
- landmark centroids
- venue centroids

The screen-space coupling is mostly in the renderer and pointer handling:

- `CityMapSvg` always renders the full map with `viewBox="0 0 width height"`.
- `CityMapBoard` converts pointer coordinates directly from DOM pixels into full-map coordinates.
- `useCityMapHover` repeats that same conversion.
- SVG overlay layers assume every layer shares a full-world viewBox.

So the migration is not "invent world space." The migration is:

1. Make camera/view transforms explicit.
2. Convert current SVG rendering to consume a camera viewport.
3. Add 3D-ready render metadata to map generation.
4. Build a Three.js renderer that consumes the same city data.
5. Keep interaction and gameplay selection in world space.

## Guiding Principles

- Do not rewrite the generator and renderer at the same time.
- Keep city generation pure and DOM-free.
- Keep gameplay hit testing in world coordinates, not Three object picking only.
- Preserve the SVG renderer as a fallback until the 3D renderer reaches feature parity.
- Let 3D rendering consume a prepared render model rather than raw gameplay data.
- Use an orthographic camera first. It gives zoomable tactical readability while still allowing raised geometry and shadows.
- Add perspective/tilt only after selection, hover, and zoom feel solid.
- Use instancing for buildings early enough that performance does not become a late surprise.
- Avoid making labels and gameplay markers pure 3D meshes initially. DOM or SVG overlays are easier to keep readable.

## Target Architecture

```text
CityMap generator
  -> CityMap world data
  -> CityMapRenderModel adapter
  -> Renderer shell
       -> SVG renderer fallback
       -> Three.js renderer
       -> overlay interaction layer
       -> shared camera controller
```

The important split is between `CityMap` and `CityMapRenderModel`.

`CityMap` remains gameplay/data truth.

`CityMapRenderModel` is a renderer-friendly snapshot:

```ts
interface CityMapRenderModel {
  world: {
    width: number;
    height: number;
    origin: 'top-left-2d';
    unitScale: number;
  };
  terrain: RenderTerrain[];
  water: RenderWater[];
  roads: RenderRoad[];
  districts: RenderDistrict[];
  buildings: RenderBuilding[];
  slots: RenderSlot[];
  landmarks: RenderLandmark[];
  labels: RenderLabel[];
}
```

Three.js should not have to know how district ownership polygons, terrain fallback, or venue selection works. It should receive stable render primitives.

## Coordinate System

Keep current city coordinates as the authoritative map/world coordinates:

- `x`: left to right
- `y`: top to bottom
- map bounds: `0..city.width`, `0..city.height`

Three.js uses:

- `x`: left to right
- `z`: top to bottom map depth
- `y`: vertical height

Conversion:

```ts
function mapToThree(point: Point) {
  return {
    x: point.x - city.width / 2,
    y: 0,
    z: point.y - city.height / 2,
  };
}
```

This centers the map around the Three.js origin while preserving existing city-space math.

For picking and gameplay, convert back:

```ts
function threeToMap(position: THREE.Vector3) {
  return {
    x: position.x + city.width / 2,
    y: position.z + city.height / 2,
  };
}
```

## Phase 1: Camera And World-Space Prep

Goal: make the current SVG renderer camera-aware before adding 3D.

### Work

Add a shared camera module:

```text
components/screens/play/city-map/camera.ts
```

Types:

```ts
export interface CityMapCameraState {
  center: Point;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface CityMapViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

Functions:

- `cameraToViewport(camera, worldSize, aspect)`
- `screenToWorld(clientPoint, domRect, viewport)`
- `worldToScreen(worldPoint, domRect, viewport)`
- `clampCamera(camera, worldSize, options)`
- `zoomCameraAtWorldPoint(camera, anchorWorldPoint, nextZoom)`
- `panCameraByScreenDelta(camera, dx, dy, domRect, viewport)`

Update:

- `CityMapBoard.tsx`
- `CityMapSvg.tsx`
- `RouteDemoLayer.tsx`
- `CompositionDebugOverlay.tsx`
- `LandmarkTooltip.tsx`
- `useCityMapHover.ts`

The SVG layers should stop assuming:

```tsx
viewBox={`0 0 ${width} ${height}`}
```

and use:

```tsx
viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
```

### Interaction

Add:

- wheel zoom
- drag pan
- double-click or button reset
- cursor-centered zoom
- clamped zoom range

Do not add 3D yet.

### Acceptance

- Current map looks identical at default zoom.
- Hovered districts still highlight correctly.
- Landmark hover still works.
- Slot clicks still work.
- Route demo still aligns.
- Tooltips appear near the correct world anchors.
- Zooming in does not break hit testing.
- Panning does not break hit testing.
- `npm run build` passes.
- `npx tsx services/playgame/city-map/__tests__/city-v35.test.ts` passes.

## Phase 2: Renderer Abstraction

Goal: make `CityMapBoard` choose between SVG and future Three renderers without changing map generation.

### Work

Add:

```text
components/screens/play/city-map/render-model.ts
components/screens/play/city-map/CityMapRendererHost.tsx
components/screens/play/city-map/CityMapSvgRenderer.tsx
```

Rename or wrap `CityMapSvg` as the SVG renderer path.

Create a renderer mode:

```ts
type CityMapRendererMode = 'svg' | 'three';
```

`CityMapBoard` becomes orchestration:

- owns city data
- owns camera
- owns selection
- owns debug toggles
- owns interaction callbacks
- passes model/camera into renderer

Renderer components do not own gameplay state.

### Acceptance

- SVG mode behaves exactly like before.
- Renderer mode can be toggled through a dev/debug flag.
- No Three.js dependency required yet.
- All current debug layers still work in SVG mode.

## Phase 3: 3D Render Metadata

Goal: enrich existing city data with stable metadata needed by a 3D renderer.

Do this in the city-map service layer, not inside Three components.

### Building Metadata

Extend or adapt buildings with render metadata:

```ts
interface BuildingRenderMeta {
  height: number;
  baseElevation: number;
  roofStyle: 'flat' | 'antenna' | 'tiered' | 'mechanical';
  materialKey: 'lowrise' | 'midrise' | 'tower' | 'landmark' | 'industrial';
  emissiveStrength: number;
  windowDensity: number;
  shadowImportance: number;
  lodGroup: 'micro' | 'lowrise' | 'midrise' | 'tower';
}
```

Height rules:

- micro buildings: `1.5..4`
- lowrise: `4..10`
- midrise: `10..22`
- towers: `22..44`
- landmarks: custom range

Use deterministic seeded rules:

- distance to district center
- road kind nearby
- landmark/venue type
- block area
- coastal/industrial/open-space context
- random variation from existing city RNG

Do not make all buildings tall. The reference image works because most buildings are low blocks and a few elements carry focus.

### Road Metadata

Add render hints:

```ts
interface RoadRenderMeta {
  width: number;
  elevation: number;
  glowStrength: number;
  materialKey: 'local' | 'street' | 'avenue' | 'highway' | 'bridge' | 'route';
  lodGroup: 'major' | 'minor' | 'micro';
}
```

### Terrain Metadata

Add:

```ts
interface TerrainRenderMeta {
  elevation: number;
  materialKey: 'land' | 'water' | 'park' | 'plaza' | 'industrial';
}
```

Most terrain can start flat at `y = 0`. Add subtle variation later.

### Acceptance

- Metadata is deterministic for the same seed.
- Existing tests continue to pass.
- Add tests that assert building heights are finite, non-negative, and within expected bounds.
- Add tests that ensure at least one seed includes lowrise/midrise/tower variety if enough buildings exist.

## Phase 4: Add Three.js Dependency

Goal: install and isolate Three.js.

### Work

Install:

```bash
npm install three
npm install -D @types/three
```

Create renderer files:

```text
components/screens/play/city-map/three/
  CityMapThreeRenderer.tsx
  createCityScene.ts
  cityMaterials.ts
  cityGeometry.ts
  cityPicking.ts
  cityLights.ts
  cityCamera.ts
  disposeThree.ts
```

Keep all Three imports inside `components/screens/play/city-map/three/`.

Do not import Three into:

- `services/playgame/city-map/*`
- engine files
- generator files

### Acceptance

- Project builds with Three installed.
- SVG renderer still works.
- Three renderer can mount an empty scene without leaking canvas elements on route changes.

## Phase 5: Three Renderer MVP

Goal: render a flat 3D equivalent of the current SVG map.

### Scene

Use:

- `THREE.Scene`
- `THREE.WebGLRenderer`
- `THREE.OrthographicCamera`
- ambient light
- directional light
- flat terrain mesh

Camera:

- top-down orthographic
- no tilt yet
- same zoom semantics as SVG camera

The first Three version should look less good than the SVG but align perfectly. Alignment matters more than beauty here.

### Geometry

Initial primitives:

- land polygons as flat `ShapeGeometry`
- water as flat `ShapeGeometry` or background plane with cutouts later
- roads as thick lines or extruded strips
- buildings as flat footprints at `height = 0.2`
- slots as small glowing discs
- landmarks as small raised markers

### Acceptance

- Three mode shows the same city footprint as SVG.
- Pan/zoom uses the same camera state.
- Slot/landmark positions visually align with the SVG when toggling renderers.
- No variable heights yet.
- No shadows yet.

## Phase 6: Polygon Triangulation Strategy

Goal: reliably turn city polygons into Three geometry.

Three's `ShapeGeometry` can handle simple polygons, but city geometry may include weird concave shapes. Build a small adapter layer and test it.

### Work

Add utilities:

- `pointPolygonToShape(points)`
- `polygonToShapeGeometry(points)`
- `extrudePolygon(points, height)`
- `polylineToStrip(points, width)`

For roads, avoid `THREE.Line` for the final renderer because line width support varies across platforms. Use strip geometry for roads:

- compute segment normals
- join segments
- emit triangles

For route glow, use separate transparent meshes or shader material later.

### Acceptance

- Concave land/building polygons render without obvious holes.
- Road strips render with stable width at zoom.
- Geometry functions are tested with a few simple polygons.

## Phase 7: Variable-Height Buildings

Goal: replace flat building footprints with extruded buildings.

### Work

Use `ExtrudeGeometry` for early correctness:

```ts
new THREE.ExtrudeGeometry(shape, {
  depth: height,
  bevelEnabled: false,
});
```

Then rotate/position so extrusion maps to vertical `y`.

Later optimize with custom geometry or instancing for rectangular buildings.

### Visual Rules

- most buildings low
- a few midrise/towers
- landmarks distinct but not noisy
- height should reinforce city composition
- tall clusters should not cover card slots

Recommended first pass:

- regular buildings: blue-gray material
- landmark buildings: brighter cyan-blue material
- selected/hover district buildings: mild emissive lift

### Acceptance

- Buildings have visible height variation.
- Tall buildings do not hide slots in default top-down view.
- Same seed produces same heights.
- Renderer remains interactive on normal hardware.

## Phase 8: Lighting And Shadows

Goal: add depth through controlled shadows without muddying gameplay readability.

### Work

Renderer:

```ts
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

Lights:

- ambient light for readability
- directional light for building shadows
- optional hemisphere light for city glow

Objects:

- buildings cast shadows
- terrain receives shadows
- roads probably do not cast shadows
- markers probably do not cast shadows

Shadow settings:

- low-resolution shadows first
- tight directional light shadow camera bounds around map
- disable shadows on micro buildings if needed

### Acceptance

- Shadows show building height without making map too dark.
- Shadow direction matches the reference-style angled depth.
- Performance remains acceptable.
- Shadows can be disabled through debug/performance settings.

## Phase 9: Camera Tilt

Goal: move from pure top-down to cinematic 2.5D while preserving readability.

### Camera Modes

Start with these modes:

```ts
type CityMapCameraMode = 'topDown' | 'tacticalTilt' | 'cinematicTilt';
```

Suggested defaults:

- `topDown`: current behavior, useful for debug
- `tacticalTilt`: slight tilt, final gameplay candidate
- `cinematicTilt`: stronger tilt for preview/screenshots

Use orthographic camera for all three at first.

### Picking

When tilted, pointer-to-world should use raycasting against the ground plane:

```ts
raycaster.setFromCamera(ndc, camera);
ray.intersectPlane(groundPlane, out);
```

Then convert Three position back to map coordinates.

Do not rely on object picking alone for gameplay. Use ground-plane world position, then existing polygon/slot nearest tests.

### Acceptance

- Pan/zoom still feel natural.
- Cursor-centered zoom still works.
- Hovered district/slot still matches pointer.
- Tilt does not make gameplay markers unreadable.

## Phase 10: Labels And Gameplay Overlay

Goal: keep gameplay UI readable over a 3D scene.

Do not make all labels 3D text initially.

Recommended strategy:

- Three.js renders terrain, roads, buildings, shadows, route glow, and marker discs.
- Solid/SVG/HTML overlay renders labels, tooltips, debug dock, and accessible buttons.
- Convert world anchors to screen positions each frame.

Add:

```ts
function worldToOverlay(point: Point, camera, rendererDomRect): { x: number; y: number; visible: boolean }
```

Overlay elements:

- district labels
- landmark tooltip
- slot accessibility/focus layer
- debug controls
- selection affordances if needed

### Acceptance

- Labels stay readable at all zoom levels.
- Labels can fade by zoom level.
- Tooltips point to the correct world anchor.
- Keyboard accessibility for slots is not lost.

## Phase 11: Glow Roads, Routes, And Nodes

Goal: move toward the reference image's neon tactical language.

### Roads

Road material layers:

- base dark strip
- thin blue/cyan emissive center
- optional larger transparent glow strip for major roads

Major routes:

- animated pulse moving along route
- route endpoints as glowing discs
- selected route stronger bloom/emissive

Use simple transparent materials first. Add bloom later only if necessary.

### Nodes

Slots and landmarks become:

- ground disc
- ring mesh
- emissive center
- optional pulse animation

Keep gameplay slots visually distinct from decorative city lights.

### Acceptance

- The map reads as tactical and alive.
- Important gameplay markers are not confused with decorative lights.
- Glow does not obscure building silhouettes.

## Phase 12: Post-Processing

Goal: add polish after core readability is proven.

Potential Three.js post-processing:

- bloom for neon roads/nodes
- vignette
- slight color grading
- FXAA/SMAA
- optional depth-of-field only for cinematic mode

Do not add post-processing before the base scene works. Post effects can hide alignment and contrast problems.

### Acceptance

- Post effects are optional and configurable.
- Low-performance mode disables them.
- UI overlay remains crisp.

## Phase 13: Performance Plan

Goal: avoid death by many tiny buildings.

### Risks

- hundreds/thousands of `ExtrudeGeometry` meshes
- shadow casting on too many objects
- too many transparent glow materials
- rebuilding geometry every Solid render
- failing to dispose Three resources

### Required Practices

- Build scene imperatively inside Three renderer lifecycle.
- Use Solid props/signals to trigger controlled scene updates.
- Dispose geometries, materials, textures, and renderer on unmount.
- Memoize render model by city seed/version.
- Rebuild static city geometry only when seed/map changes.
- Update camera every frame or on signal changes.
- Use `InstancedMesh` for repeated rectangular buildings once MVP is proven.
- Use LOD groups by zoom level.

### LOD

Zoomed out:

- terrain
- major roads
- district boundaries
- towers/landmarks
- major slots

Mid zoom:

- most buildings
- local roads
- landmarks

Zoomed in:

- micro buildings
- small decorative lights
- detailed slot rings

### Acceptance

- Default map stays smooth on a normal laptop.
- Low mode can disable shadows, bloom, micro buildings, and animated pulses.
- No memory leak after switching routes or changing seeds repeatedly.

## Phase 14: Debug And Verification

Goal: make 3D migration testable rather than vibes-only.

### Debug Toggles

Add debug toggles:

- Renderer: SVG / Three
- Camera mode: top-down / tactical tilt / cinematic tilt
- Show buildings
- Show shadows
- Show roads
- Show glow
- Show terrain
- Show labels
- Show slots
- Show picking point
- Show render bounds
- Show LOD groups

### Automated Tests

Keep existing:

```bash
npm run build
npx tsx services/playgame/city-map/__tests__/city-v35.test.ts
```

Add pure tests for:

- camera transforms
- map-to-three conversion
- three-to-map conversion
- render metadata determinism
- building height bounds
- road strip geometry basics

### Visual Verification

Use these seeds at minimum:

```text
new-game-city
city-map-unit-seed
city-map-unit-seed-alt
```

Screenshots to capture:

- SVG default
- Three top-down
- Three tactical tilt
- zoomed in
- zoomed out
- shadows off
- shadows on

### Acceptance

- SVG and Three top-down align closely.
- Picking point debug marker appears under cursor.
- The same slot is selected in SVG and Three modes.
- Camera reset returns to a known framing.

## Phase 15: Final Cutover

Goal: make Three the default only after it earns it.

### Cutover Conditions

Three renderer can become default when:

- default scene is visually better than SVG
- hover/select/tooltip behavior matches SVG
- zoom/pan is stable
- shadows are performant or gracefully disabled
- labels remain readable
- build passes
- city-map tests pass
- route changes do not leak WebGL contexts
- low-performance fallback exists

### Fallback

Keep SVG renderer available for:

- debug
- tests
- low-end devices
- emergency regression fallback

Do not delete SVG until the Three renderer has survived several feature passes.

## Suggested Implementation Order

1. Add shared camera and SVG zoom/pan.
2. Extract render model adapter.
3. Add render metadata for buildings/roads/terrain.
4. Install Three.js.
5. Mount empty Three renderer behind debug toggle.
6. Render flat terrain/roads/buildings in Three top-down.
7. Add world-space raycast picking against ground plane.
8. Add variable-height building extrusion.
9. Add lighting and shadows.
10. Add tactical tilt camera.
11. Move labels/tooltips to camera-projected overlay.
12. Add glow roads/routes/nodes.
13. Add LOD and performance modes.
14. Add post-processing.
15. Make Three default after parity and performance verification.

## First Concrete PR Slice

The first PR should not install Three.js.

It should:

- add `camera.ts`
- add camera state to `CityMapBoard`
- make SVG `viewBox` camera-driven
- make pointer conversion use `screenToWorld`
- add wheel zoom
- add drag pan
- preserve default framing
- include camera transform tests

This creates the bridge from today's 2D renderer to tomorrow's 3D renderer without betting the whole board on a new rendering stack immediately.

## Second Concrete PR Slice

The second PR should add renderer abstraction but keep SVG as the only implementation.

It should:

- create `render-model.ts`
- create `CityMapRendererHost.tsx`
- move current SVG path behind a renderer interface
- add `rendererMode: 'svg' | 'three'` type without enabling Three yet
- preserve all current debug toggles

This prevents the eventual Three work from tangling with gameplay state.

## Third Concrete PR Slice

The third PR should add render metadata.

It should:

- derive deterministic building heights
- derive material keys
- derive LOD groups
- add tests for finite bounded metadata
- expose metadata through the render model

At this point the project is finally ready to install Three.js and build a real 3D renderer.

## Open Decisions

- Should gameplay use top-down mode while cinematic tilt is only for presentation, or should tactical tilt be the normal board?
- Should buildings ever block/occlude gameplay slots, or should slots always render above the 3D scene?
- Should route lines live on the ground, float above roads, or both?
- Should district ownership be shown through ground tint, boundary glow, building tint, or slot color?
- Should the final renderer support camera rotation, or only pan/zoom/tilt?
- Should low-end devices default to SVG, Three without shadows, or Three with reduced geometry?

## Strong Opinion

Use Three.js, but do not start with Three.js.

The correct first move is camera/world-space discipline in the existing SVG renderer. Once pan/zoom/picking works there, Three.js becomes a renderer swap rather than a risky gameplay rewrite. That ordering gives the final map the cinematic headroom you want while keeping the game playable every step of the way.
