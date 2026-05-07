# Tensor Map Bridge Layer Spec

## Goal

Add bridges as an explicit semantic layer shared by peninsula, landlocked/wall-to-wall, and island map shapes.

Today peninsula maps appear to have bridges because the legacy river path creates riverbank road polylines and lets some higher-order roads ignore the river during generation. Island maps do not have bridges because the faster island path clips roads out of the river polygon. This spec replaces both behaviors with one intentional bridge pipeline.

## Non-Goals

- Do not build 3D bridge geometry yet.
- Do not redesign tensor road generation.
- Do not make ocean causeways by default.
- Do not allow buildings or lots to generate inside water.
- Do not remove `dat.gui` coupling as part of this change.

## Definitions

```ts
export type BridgeRoadClass = 'main' | 'major' | 'minor';

export type BridgeBarrierKind = 'river' | 'canal';

export interface WaterBarrier {
  id: string;
  kind: BridgeBarrierKind;
  polygon: Vector[];
  centerline?: Vector[];
}

export interface BridgeSegment {
  id: string;
  roadClass: BridgeRoadClass;
  barrierId: string;
  barrierKind: BridgeBarrierKind;
  start: Vector;
  end: Vector;
  center: Vector;
  width: number;
}
```

`WaterBarrier` is the bridgeable obstacle. Rivers and future canals are bridgeable. Coast/ocean is not bridgeable by default.

`BridgeSegment` is a road crossing that is allowed to pass over a bridgeable water barrier. Renderers should not infer bridges from ordinary road-water overlap.

## Architecture

### New Module

Add:

```txt
services/playgame/city-map/tensor/impl/bridge_generator.ts
```

Responsibilities:

- Detect road segment intersections with bridgeable water barriers.
- Select a limited set of crossings.
- Return:
  - road polylines with water-crossing portions removed
  - approved bridge segments

The bridge generator should be a pure geometry service. It should not know about Solid, canvas, dat.gui, or map shape UI.

### Data Ownership

`MainGUI` owns the current generated bridge layer:

```ts
private bridges: BridgeSegment[] = [];
```

`WaterGUI` exposes bridgeable barriers:

```ts
get waterBarriersWorld(): WaterBarrier[];
```

For the first pass, this returns the river polygon when one exists:

- peninsula: one river barrier
- island: one river barrier
- landlocked/wall-to-wall without river: empty array

### Rendering Contract

`MainGUI.draw()` passes bridges to `Style`:

```ts
style.bridges = this.bridges.map(...)
```

Initial 2D rendering can draw bridge decks as road-colored strokes over river polygons. Later 3D renderers can consume the same bridge layer to raise decks and add railings/supports.

## Generation Pipeline

All map shapes should converge on the same bridge-aware pipeline after water and roads exist.

1. Generate water/land shape.
2. Generate roads.
3. Gather bridgeable water barriers from `WaterGUI`.
4. Run bridge generation:
   - find road/barrier crossings
   - choose approved bridge crossings
   - cut non-approved road portions out of water polygons
   - return clipped roads and bridge segments
5. Replace road streamlines with clipped roads.
6. Store bridge segments in `MainGUI.bridges`.
7. Generate parks and buildings.
8. Ensure lots/buildings still treat water as forbidden, and bridges as road blockers.

## Shape-Specific Behavior

### Peninsula

Current behavior:

- `createRiver()` generates riverbank road polylines.
- Major/main generation temporarily ignores the river.
- Some road-water overlap looks like bridges.

Target behavior:

- Keep river polygon generation.
- Stop relying on accidental road overlap as bridges.
- Use the shared bridge generator to preserve approved crossings.
- Existing riverbank roads may remain as roads, but they are not bridges unless they cross the river barrier.

### Island

Current behavior:

- Roads are generated in the full world.
- Roads are clipped to the island.
- Roads are also cut out of the river polygon.
- No bridges exist.

Target behavior:

- Keep fast generate-then-clip.
- Before discarding river-crossing road portions, pass them through the bridge generator.
- Approved crossings become `BridgeSegment`s.
- Non-approved crossings remain cut out.

### Landlocked / Wall-To-Wall

Current behavior:

- No water means no bridges.

Target behavior:

- If no bridgeable water barriers exist, bridge layer is empty and road generation is unchanged.
- If canals/rivers are added later, the same bridge generator applies.

## Bridge Detection

For each road polyline:

1. Iterate each segment `a -> b`.
2. For each bridgeable barrier polygon:
   - use bounding-box rejection first
   - find intersection points with barrier polygon edges
   - if the segment enters and exits the polygon, it is a candidate bridge
3. Build a bridge candidate:
   - `start`: first intersection point
   - `end`: second intersection point
   - `center`: midpoint
   - `width`: style width based on road class

Candidate detection must work for:

- straight road crossing river
- diagonal road crossing river
- road segment starting outside and ending outside
- road segment with multiple crossings should split into multiple candidates

## Bridge Selection Rules

First-pass rules:

- Main roads are preferred.
- Major roads are allowed when not too close to an existing bridge.
- Minor roads are allowed only if there is no nearby main/major bridge.
- Reject bridge candidates shorter than a minimum deck length.
- Reject bridge candidates longer than a maximum deck length.
- Enforce spacing between bridge centers along the same barrier.

Suggested constants:

```ts
const BRIDGE_SPACING = 180;
const MIN_BRIDGE_LENGTH = 20;
const MAX_BRIDGE_LENGTH = 180;
```

Selection should be deterministic under the existing seeded RNG.

## Road Cutting

The bridge generator should return clipped roads and bridges together:

```ts
interface BridgeGenerationResult {
  roads: Record<BridgeRoadClass, Vector[][]>;
  bridges: BridgeSegment[];
}
```

Cutting behavior:

- Road portions outside water remain ordinary roads.
- Non-approved road portions inside water are removed.
- Approved crossing portions are removed from ordinary roads and stored as bridge segments.
- Renderers may draw bridges over rivers independently.

This prevents duplicate rendering and gives future 3D code a clean elevation boundary.

## Buildings and Blocks

Buildings must not be generated in water.

Bridges should be included as blockers for block/lots graph generation so buildings do not appear under bridge decks. The first pass can include bridge segments in `Buildings.setAllStreamlines(...)` with ordinary road blockers.

Do not relax `tensorField.onLand()` for buildings. Bridges are passable infrastructure, not buildable land.

## Style and Debug

Add a debug toggle later:

```ts
showBridges: boolean
```

Initial default should be on.

2D bridge styling:

- Draw river first.
- Draw bridge deck above river.
- Draw roads above land.
- Use a subtle outline or slightly warmer road fill so bridges are visible at high zoom.

## Profiling Requirements

Bridge generation must report timing through the existing tensor generation profiler:

- `bridge generation`
- candidate count
- accepted bridge count

Example detail:

```txt
12/48 bridges accepted
```

Bridge generation should stay below 100ms for the current 1800x3200 world on typical generated maps.

## Acceptance Criteria

- `npx vite build` passes.
- Peninsula maps still show river crossings, but crossings come from `BridgeSegment[]`.
- Island maps can show bridges over rivers.
- Landlocked maps produce an empty bridge layer without behavior change.
- Roads do not visibly bleed through rivers except at approved bridge segments.
- Buildings/lots do not generate inside rivers or oceans.
- Bridge layer is available to future 3D rendering without re-inferring geometry from road/water overlap.
- Generation profiler includes bridge timing and bridge counts.

## Suggested Implementation Slices

### Slice 1: Data Layer

- Add bridge types.
- Add empty bridge layer to `MainGUI`.
- Add `style.bridges` field and draw no-op/simple 2D bridge strokes.
- Add `WaterGUI.waterBarriersWorld`.

### Slice 2: Island Bridges

- Implement bridge detection against island river polygon.
- Preserve approved crossings as `BridgeSegment[]`.
- Continue cutting all other river road overlap.
- Include bridges in building blockers.

### Slice 3: Peninsula Migration

- Route peninsula river crossings through the shared bridge generator.
- Keep visual output similar to current peninsula behavior.
- Remove reliance on accidental `ignoreRiver` crossings where possible.

### Slice 4: Debug and Tuning

- Add bridge count/profile detail.
- Add debug toggle for bridges.
- Tune spacing and road-class priority.

