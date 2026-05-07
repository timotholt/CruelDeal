# Planar Blocks — Phase 0 Notes

## Function signatures from `geometry.ts`

- **`segIntersect(a: Point, b: Point, c: Point, d: Point): SegmentIntersection | null`**
  - Returns `{ x, y, t, u }` or `null` if parallel/no intersection within [0,1].
  - Line 14 of `services/playgame/city-map/geometry.ts`.

- **`polygonArea(polygon: readonly Point[]): number`**
  - Returns absolute (positive) area via shoelace formula.
  - Line 41 of `services/playgame/city-map/geometry.ts`.

- **`polygonCentroid(polygon: readonly Point[]): Point`**
  - Returns `{ x, y }` centroid. Falls back to average of vertices for degenerate polygons.
  - Line 52 of `services/playgame/city-map/geometry.ts`.

## Where `CityMapOptions` lives

- Defined and exported from `services/playgame/city-map/city-v35.ts`.
- Re-exported via `services/playgame/city-map/index.ts` (lines 37–40).

## Call site of `buildPM2001BlockFacesForDistrict`

- Line **1699** of `services/playgame/city-map/city-v35.ts`:
  ```ts
  const result = buildPM2001BlockFacesForDistrict(district, roadEdges);
  ```
- Inside function `applyPM2001BlockFaces` (starts around line 1694).

## Three functions in `geometry.ts` (memorized)

1. `segIntersect` — segment-segment intersection
2. `polygonArea` — polygon area (shoelace)
3. `polygonCentroid` — polygon centroid
