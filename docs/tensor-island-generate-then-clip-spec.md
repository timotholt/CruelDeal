# Tensor Island Generate-Then-Clip Spec

## Problem

Island generation is currently too slow to use. Profiling showed the island
mask itself is not the expensive part. The slow path is minor road generation.

Measured in the browser on `/dev/tensor-play`:

| Shape | Island mask | Island river | Minor roads | Buildings | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Peninsula baseline | n/a | n/a | 1.48s | 1.07s | 3.35s |
| Island jagged | 0.095ms | 343ms | 82.1s | 3.92s | 86.8s |
| Island smooth | 0.207ms | 1.80s | 116.35s | 5.21s | 125.1s |

The island boundary makes the minor road generator repeatedly test candidate
seeds and one-pixel integration steps against a closed land polygon. Many
attempts near the edge fail, and successful roads often terminate at the
boundary. The generator keeps searching for more valid seeds until it exhausts
its normal fill rules.

## Goal

Make island generation fast enough for interactive use by generating roads in
an unclipped rectangular world, then clipping finished road geometry to the
island polygon.

Target behavior:

- Island generation should complete in single-digit seconds in common cases.
- Jagged and smooth island options should both remain available.
- Roads and buildings must not appear in water.
- The island perimeter road should still draw around the coastline.
- The river should still cut through the island when generated.
- Peninsula and landlocked behavior must remain unchanged.

## Proposed Architecture

Current island path:

1. Generate island polygon.
2. Set `tensorField.landPolygon = island`.
3. Generate roads while every seed and every integration step checks the island.
4. Generate buildings inside island.

New island path:

1. Generate island polygon.
2. Temporarily disable island land clipping for road generation.
3. Generate road networks across the full rectangular world.
4. Clip completed road polylines to the island polygon.
5. Add/keep the island perimeter road.
6. Set `tensorField.landPolygon = island`.
7. Generate parks/buildings from the clipped road graph.

This turns island mode from "carefully draw inside a weird boundary" into
"draw normally, then cookie-cut the result."

## Implementation Plan

### 1. Add Polyline Clipping Utility

Add a helper to `services/playgame/city-map/tensor/impl/polygon_util.ts`:

```ts
public static clipPolylineToPolygon(polyline: Vector[], polygon: Vector[]): Vector[][]
```

Use JSTS, which is already used in `PolygonUtil`.

Algorithm:

1. Convert the road polyline to a JSTS `LineString`.
2. Convert the island polygon to a JSTS `Polygon`.
3. Compute `line.intersection(polygon)`.
4. Convert the resulting geometry back to one or more `Vector[]` polylines.
5. Discard clipped fragments with fewer than two points.

Expected JSTS output types:

- empty geometry
- `LineString`
- `MultiLineString`
- possibly geometry collections containing line strings

The utility should hide these details behind a simple `Vector[][]` return.

### 2. Add Road Clipping Helpers

Add helpers near the road generation layer:

```ts
function clipRoadSetToLand(roads: Vector[][], landPolygon: Vector[]): Vector[][]
```

Rules:

- Keep only clipped road fragments with at least two points.
- Optionally discard very short fragments, for example length `< dstep * 4`.
- Preserve road category by clipping each category separately:
  - main roads
  - major roads
  - minor roads
  - coastline/perimeter roads
  - river secondary road, if applicable

### 3. Add Island-Specific Generation Flow

Avoid changing peninsula generation. Add a branch for island map shapes.

Pseudo-flow:

```ts
async generateEverything(animate?: boolean): Promise<void> {
  if (this.isIslandShape()) {
    await this.generateIslandByClipping(animate);
    return;
  }

  // existing behavior
}
```

Island clipping flow:

```ts
private async generateIslandByClipping(animate?: boolean): Promise<void> {
  // Generate water/island metadata and perimeter road.
  this.coastline.generateRoads();

  const landPolygon = this.coastline.landPolygonWorld;

  // Temporarily allow road integration across the full rectangle.
  const savedLandPolygon = this.tensorField.landPolygon;
  const savedRiver = this.tensorField.river;
  this.tensorField.landPolygon = [];
  this.tensorField.river = [];

  await this.mainRoads.generateRoads();
  await this.majorRoads.generateRoads(animate);
  await this.minorRoads.generateRoads(animate);

  // Restore land/water rules before parks and buildings.
  this.tensorField.landPolygon = savedLandPolygon;
  this.tensorField.river = savedRiver;

  this.clipGeneratedRoadsToIsland(landPolygon);

  this.redraw = true;
  await this.buildings.generate(animate);
}
```

The exact placement may differ depending on existing callback behavior. The
important invariant is:

- roads generate without landPolygon boundary checks
- parks/buildings generate with landPolygon restored
- final rendered roads are clipped to land

### 4. Expose World-Space Land Polygon

`WaterGUI.landPolygon` currently returns screen-space points for rendering.
The clipping pass needs world-space geometry.

Add one of:

```ts
get landPolygonWorld(): Vector[] {
  return this.streamlines.landPolygon;
}
```

or expose the underlying generator data in a similarly explicit way.

Do not use screen-space points for clipping.

### 5. Mutating Road Sets

`RoadGUI` and `StreamlineGenerator` currently own multiple internal arrays:

- `allStreamlines`
- `allStreamlinesSimple`
- `streamlinesMajor`
- `streamlinesMinor`
- grid storage

The clipping phase needs to update the arrays used for:

- rendering
- downstream graph generation
- building generation

Preferred minimal API:

```ts
RoadGUI.replaceStreamlines(clipped: Vector[][]): void
```

For generated categories, this should update:

- the underlying generator's rendered/simple streamlines
- any arrays consumed by `MainGUI.buildings.setAllStreamlines(...)`

It may not need to rebuild `GridStorage` after clipping, because clipping
happens after road generation. If a later post-process depends on grids, add a
rebuild method then.

### 6. Buildings and Parks

After clipping, `Buildings.generate()` should receive only clipped streamlines.
It already constructs a graph from `allStreamlines`.

Important:

- `tensorField.landPolygon` must be set before `PolygonFinder.findPolygons()`.
- `PolygonFinder.filterPolygonsByWater()` should continue rejecting building
  polygons outside the island.
- `tensorField.river` should be restored before building generation so lots
  do not appear inside the river.

### 7. Perimeter Road

The island perimeter road is already created from the island coastline.
Do not clip it away. Keep it as its own coastline road category.

If clipped world roads touch or cross the perimeter, that is acceptable for
v1. Later work can add snapping/intersection cleanup.

## Risks

### Road Fragments

Clipping can create short dangling road fragments near the coast. Mitigation:

- discard fragments below a minimum length
- let `Graph`/`PolygonFinder` naturally ignore fragments that do not form
  useful blocks

### Graph Connectivity

The clipped road graph may have fewer closed blocks than the current in-island
generation. This is acceptable if the visual output is good and buildings stay
on land.

### JSTS Geometry Edge Cases

Line/polygon intersections can return geometry collections. The clipping
utility should robustly recurse through geometry collections and collect only
line-like geometries.

### Visual Coast Crossings

Roads generated outside the island may cross the coastline before clipping.
After clipping, endpoints may sit exactly on the coastline. This is visually
acceptable for v1 and can read as roads ending at the coast.

## Acceptance Criteria

- `npx vite build` passes.
- Peninsula generation remains visually unchanged.
- Landlocked generation remains visually unchanged.
- `island (jagged)` generates in interactive time, ideally under 10 seconds.
- `island (smooth)` generates in interactive time, ideally under 10 seconds.
- Roads do not render outside the island.
- Buildings do not render outside the island or inside river water.
- Island perimeter road still renders.
- River still renders for island modes when a river is found.

## Profiling Follow-Up

After implementation, re-run the same browser timing pass:

- total generation time
- water/island time
- main roads
- major roads
- minor roads
- buildings

Expected improvement:

- minor roads should move much closer to peninsula timing, because they no
  longer repeatedly query the island boundary during seed search and step
  integration.
- clipping should add a new one-time geometry cost, but it should be far less
  than the previous 80-116 second minor-road cost.
