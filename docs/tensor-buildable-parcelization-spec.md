# Tensor Buildable Parcelization Spec

## Goal

Replace island building generation's dependence on perfect closed road loops with a buildable-land parcelization step.

Current island maps leave many visually usable blocks empty because `Buildings.generate()` builds a road graph, `PolygonFinder` finds closed loops, and anything not represented as a clean road loop never becomes a building parcel. Waterfront, riverfront, and clipped island-edge land often has a real boundary made from roads plus water/coast edges, but not a closed road-only loop.

The new source of truth should be:

```text
island land polygon
- river polygons
split by roads
=> buildable parcels
=> building lots
=> buildings
```

## Non-Goals

- Do not rewrite tensor road generation.
- Do not change the 2D/3D building renderer.
- Do not allow buildings inside rivers, ocean, bridge decks, or road corridors.
- Do not remove `PolygonFinder` immediately for peninsula/landlocked maps.
- Do not require a full zoning/planning system in this slice.

## Current Problem

### Current Building Path

```text
roads
-> Graph
-> PolygonFinder closed road loops
-> filter by land/water
-> shrink
-> divide
-> lots/buildings
```

This works best when every block is enclosed by roads.

Island mode now generates roads in an open world and clips them to the island. That creates many partial road fragments along the island edge and river edge. Those fragments can frame valuable land visually, but the graph may not form a closed loop.

### Failure Modes

- Waterfront strips look buildable but are absent from `PolygonFinder` output.
- Riverfront blocks are rejected because they intersect the river instead of being clipped to it.
- Long skinny coast/river parcels collapse during shrink.
- Island clipped road ends produce open graph faces.
- Valid land is discarded because water is treated only as a rejection filter, not as a parcel boundary.

## Target Model

Water and coast boundaries are parcel boundaries.

For island maps, parcelization should start from land area, remove water, then split that buildable area by road corridors.

```text
land polygon
  subtract river polygon(s)
  subtract road corridor polygons
  subtract bridge deck blocker polygons if needed
  split into connected buildable faces
  filter slivers/tiny faces
  shrink/set back
  subdivide into lots
```

This turns waterfront land into valid parcel faces instead of rejected road-loop failures.

## Proposed Modules

Add:

```text
services/playgame/city-map/tensor/impl/buildable_parcelizer.ts
```

Initial public contract:

```ts
export interface BuildableParcelizerInput {
  landPolygons: Vector[][];
  riverPolygons: Vector[][];
  roadPolylines: Vector[][];
  bridgePolylines: Vector[][];
  roadBuffer: number;
  bridgeBuffer: number;
  minParcelArea: number;
  minParcelWidth: number;
}

export interface BuildableParcelizerStats {
  landCount: number;
  riverCount: number;
  roadCount: number;
  rawFaceCount: number;
  acceptedFaceCount: number;
  rejectedTiny: number;
  rejectedSliver: number;
  ms: number;
}

export interface BuildableParcelizerResult {
  parcels: Vector[][];
  stats: BuildableParcelizerStats;
}

export function parcelizeBuildableLand(input: BuildableParcelizerInput): BuildableParcelizerResult;
```

The module should be a pure geometry service. It should not know about Solid, canvas, dat.gui, `Style`, or `DomainController`.

## Geometry Strategy

Use a robust polygon boolean library for the first implementation. The project already has `polygon-clipping` and `jsts`; prefer one consistent implementation behind `PolygonUtil` helpers.

The high-level operation is:

```text
buildable = union(landPolygons)
buildable = difference(buildable, union(riverPolygons))
buildable = difference(buildable, union(roadCorridors))
buildable = difference(buildable, union(bridgeBlockers))
faces = explodeMultiPolygon(buildable)
```

### Road Corridors

Roads must consume physical space before parcels exist.

Convert road polylines to corridor polygons:

```ts
const roadCorridor = PolygonUtil.resizeGeometry(polyline, roadBuffer, false);
```

Use class-aware buffers later:

```ts
main: 7-9
major: 5-7
minor: 3-5
coast/riverbank: 4-6
bridge: same as source road class
```

For the first pass, one conservative buffer is acceptable if it fixes empty waterfront land without causing road/building overlaps.

### Rivers

River polygons should be subtracted from land before road splitting.

Do not treat river intersection as a reason to discard a parcel. If land beside the river remains after subtraction and passes size checks, it is buildable.

### Coastline / Island Edge

The island polygon itself is a valid parcel boundary.

Parcels along the coastline should survive if they are wide enough. They may be:

- normal buildings
- waterfront commercial/hospitality later
- parks/open space if too irregular

The first pass should keep the parcel face and let existing subdivision produce buildings where possible.

## Integration Plan

### Phase 1: Island Buildings Only

Keep the current path for peninsula and landlocked maps.

For island maps only:

```text
MainGUI.generateIslandRoads()
-> roads clipped to island
-> bridge layer
-> buildable parcelizer
-> Buildings.generateFromParcels(parcels)
```

Add to `Buildings`:

```ts
async generateFromParcels(parcels: Vector[][], animate: boolean): Promise<void>
```

This method should reuse the existing shrink/divide/model creation path where possible:

```text
input parcels
-> shrink
-> divide
-> BuildingModels
```

It should bypass:

```text
Graph(this.allStreamlines)
PolygonFinder.findPolygons()
```

because the parcelizer already produced block faces.

### Phase 2: Unified Building Path

After island behavior is stable, consider using parcelization for all map shapes:

```text
peninsula land area = world bounds - sea polygon - river polygon
landlocked land area = world bounds
island land area = island polygon - river polygon
```

Then split all by road corridors.

This can eventually replace `PolygonFinder` as the building block source, while leaving `PolygonFinder` available for parks or debug comparison.

## Required Data from Existing Classes

`MainGUI` already owns or can gather:

- `this.coastline.landPolygonWorld`
- `this.coastline.riverPolygonWorld`
- `this.mainRoads.allStreamlines`
- `this.majorRoads.allStreamlines`
- `this.minorRoads.allStreamlines`
- `this.coastline.streamlinesWithSecondaryRoad`
- `this.bridges`

Bridge segments can be passed as polylines:

```ts
this.bridges.map(bridge => [bridge.start, bridge.end])
```

## Filtering Rules

A parcel face should be rejected only when it is not usable, not merely because it touches water.

Reject if:

- area below `minParcelArea`
- effective width below `minParcelWidth`
- polygon has fewer than 3 points
- polygon boolean output is invalid or self-intersecting
- after shrink/setback it collapses

Keep if:

- it touches coast
- it touches river
- it has an irregular but valid waterfront edge
- it is bounded by road on one side and water on another

## Sliver Handling

Not every parcel should become buildings.

For the first implementation:

- Reject tiny/sliver faces from building generation.
- Track rejection counts in stats.
- Later, classify rejected waterfront slivers as promenade/park/service land instead of silently losing them.

## Performance Requirements

Parcelization must not make island generation slower.

Budget for current phone-map sizes:

```text
small island:  < 250ms
medium island: < 400ms
large island:  < 750ms
```

If boolean operations exceed budget:

- simplify road polylines before buffering
- merge collinear road segments
- use class-aware road buffers with lower vertex counts
- use simplified logical coast/river polygons for parcelization and detailed polygons for rendering

## Profiling

Add a profiler phase:

```text
parcelize buildable land
```

Suggested detail string:

```text
124/151 parcels accepted, 18 tiny, 9 sliver
```

Also split building timing after this change:

```text
building shrink
building divide
building models
```

This avoids hiding parcelizer cost inside the existing `buildings` phase.

## Debug UI

Add later, not required for first pass:

- show buildable land mask/faces
- show accepted parcels
- show rejected tiny/sliver parcels
- show road corridor blockers
- show river/ocean subtraction polygons

The debug overlay should answer:

```text
Why did this visible block get buildings or not?
```

## Acceptance Criteria

- Island maps fill obvious waterfront and riverfront blocks that are currently empty.
- Buildings never appear in ocean, river water, or under bridge decks.
- Same map at different zoom levels shows the same parcel/building coverage.
- Smooth and jagged island modes both work.
- Peninsula/landlocked behavior remains unchanged in Phase 1.
- `npx vite build` passes.
- Generation profiler reports parcelization timing and accepted/rejected parcel counts.

## Risks

- Polygon boolean operations can be expensive or fragile with complex road buffers.
- Offset road corridors can self-intersect on sharp curves.
- Tiny waterfront slivers may become ugly buildings if filtering is too permissive.
- Existing `Buildings.divide()` may not handle highly irregular parcels elegantly.

## Mitigations

- Start island-only.
- Use simplified logical geometry for parcelization.
- Reject slivers first; recover them as parks/promenades later.
- Keep `PolygonFinder` path available behind a fallback flag until parcelizer is visually proven.
- Add debug visualization before tuning thresholds aggressively.

## Implementation Order

1. Add `buildable_parcelizer.ts` with pure geometry helpers and stats.
2. Add `Buildings.generateFromParcels()`.
3. Wire island mode to call parcelizer before building generation.
4. Profile parcelization and split building timings.
5. Add debug overlay for accepted/rejected parcels.
6. Tune road buffers, `minParcelArea`, and `minParcelWidth`.
7. Decide whether to migrate peninsula/landlocked to the same path.
