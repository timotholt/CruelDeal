# PM2001 Road And Block Generation Spec

Status: implemented through Phase 6 behind `roadBlockModel: 'pm2001-road-faces'`; Phase 7 default flip pending visual inspection  
Created: 2026-05-04  
Primary source of truth for: physical road corridors, road-face blocks, and the transition from painted roads to roads that consume land.

Implementation note: v1 uses existing road centerlines and legacy BSP cells as temporary simple-polygon seeds, then splits/subtracts PM2001 physical road corridors to produce road-face blocks. Full PM2001 local road growth and graph-normalization remain future work.

## Purpose

Adopt the useful parts of Parish and Muller 2001 for Cruel Deal's city map generator.

The target change is conceptual and structural:

```txt
terrain / district land
  -> roadmap graph
  -> physical road corridors
  -> remaining road-bounded faces
  -> blocks
  -> parcels
  -> buildings
  -> slots / venues
```

The current generator often behaves like:

```txt
district land
  -> BSP cells / blocks
  -> roads painted over cells
  -> parcels inside cells
```

That creates the visible bug where blocks and parcels appear to overlap roads. PM2001-style generation fixes this by making roads consume space before blocks exist.

This spec does not replace the EG2012 parcelization work. PM2001 owns:

```txt
terrain / districts -> roads -> blocks
```

EG2012 owns:

```txt
blocks -> parcels -> buildings
```

## Design Principles

- Roads are graph infrastructure first, render strokes second.
- A road has a centerline for routing and a physical corridor for geometry.
- Blocks are the land faces left between road corridors.
- Buildings and parcels never need to know about painted road strokes to avoid overlap; they receive block polygons that already exclude road land.
- Keep public game contracts stable while changing internal generation.
- Use deterministic seeded randomness, not runtime randomness.
- Start with hand-authored road style profiles. Do not require downloaded OSM/map data for v1.
- Isolate polygon boolean operations behind one adapter so the geometry library can be changed later.

## Public Contracts

Existing contracts must remain valid:

```ts
CityMap.cells
CityMap.blocks
CityMap.parcels
CityMap.roadGraph.edges
CityMap.roadGraph.nodes
CityDistrict.blocks
CityDistrict.polygons
Building.blockId
Building.parcelId
CitySlot.blockId
```

When PM2001 road-face generation is enabled:

- `CityMap.cells` and `CityMap.blocks` should both expose the generated road-face blocks.
- `CityDistrict.blocks` should expose the same road-face blocks scoped to that district.
- `CityDistrict.polygons` should remain the buildable block polygons used for hit testing and district fill.
- Existing routing/venue/slot code should not need to know whether a block came from legacy BSP or PM2001 road faces.

Add an option:

```ts
export interface CityMapOptions {
  roadBlockModel?: 'legacy-bsp' | 'pm2001-road-faces';
}
```

Initial default:

```ts
roadBlockModel: 'legacy-bsp'
```

Flip the default only after screenshots and tests are stable.

## Road Types And Widths

Road rendering width and road physical width are separate.

```ts
export type PhysicalRoadClass =
  | 'highway'
  | 'arterial'
  | 'avenue'
  | 'street'
  | 'local'
  | 'alley'
  | 'service';

export interface RoadEdge {
  id: string;
  a: Point;
  b: Point;
  points?: Point[];
  centerline?: Point[];
  kind?: string;
  roadClass?: PhysicalRoadClass;
  physicalWidth?: number;
  corridorPolygon?: Point[];
  pm2001?: {
    generator: 'global-goal' | 'local-constraint' | 'connector' | 'coast' | 'fallback';
    styleId: RoadStyleId;
    hierarchyDepth: number;
  };
}
```

Physical widths:

| Road class | Physical corridor width |
| --- | ---: |
| `highway` | `24m` |
| `arterial` | `16m` |
| `avenue` | `16m` |
| `street` | `8m` |
| `local` | `6m` |
| `alley` | `4m` |
| `service` | `4m` |

These map to the existing `URBAN_SCALE.roads` constants. Do not encode new width literals outside `urban-units.ts`.

## Road Style Profiles

PM2001 uses image maps and pattern rules. For Cruel Deal v1, replace image maps with deterministic district style profiles.

```ts
export type RoadStyleId =
  | 'tight_grid'
  | 'loose_grid'
  | 'curvy_residential'
  | 'industrial_spine'
  | 'coastal_curve'
  | 'old_core';

export interface RoadStyleProfile {
  id: RoadStyleId;
  spacing: number;
  spacingJitter: number;
  angleJitter: number;
  curvature: number;
  branchProbability: number;
  deadEndProbability: number;
  loopProbability: number;
  snapDistance: number;
  minBlockArea: number;
  maxBlockAspect: number;
}
```

Recommended defaults:

| District role | Style |
| --- | --- |
| `old_core` | `old_core` |
| `interior_grid` | `loose_grid` |
| `backland_edge` | `curvy_residential` |
| `waterfront` | `coastal_curve` |
| `commercial_core` | `tight_grid` |
| `civic_center` | `tight_grid` with lower jitter |
| industrial/service districts | `industrial_spine` |

## Generation Pipeline

### 1. Terrain And Ownership

Keep the existing terrain generator.

Inputs:

- visible land polygon
- water polygons
- rivers/channels
- islands
- district ownership polygons
- macro composition template

District ownership polygons remain useful as high-level regions. PM2001 changes how blocks are created inside those ownership polygons.

### 2. Macro Roads

Generate or preserve major road centerlines before local streets:

- macro cuts
- highways
- avenues
- coast roads
- river-bank/service roads
- bridge approaches
- district connectors

These roads should become `RoadEdge` records with:

- stable `id`
- `centerline`
- `roadClass`
- `physicalWidth`
- render metadata

### 3. Local Road Growth

For each district:

1. Select `RoadStyleProfile`.
2. Find seed roads from macro roads touching or crossing the district.
3. Create candidate local road segments from existing vertices and boundary anchors.
4. Score candidates using style profile and local constraints.
5. Accept/reject deterministically with seeded randomness.
6. Repeat until target density or max attempts is reached.

Candidate generation should support:

- grid-parallel streets
- cross streets
- curved residential streets
- loops
- short connectors
- sparse industrial spines
- waterfront-following roads

### 4. Local Constraints

Reject or adjust a candidate road if:

- it exits the district buildable polygon without being clipped intentionally
- it crosses water without a bridge plan
- it creates a segment shorter than the road class minimum
- it creates an intersection too close to an existing intersection
- it creates a block below `style.minBlockArea`
- it creates an excessively thin block
- it duplicates a nearby road
- it crosses a higher-class road without legal intersection splitting

Snap behavior:

- snap endpoints to nearby road nodes within `style.snapDistance`
- split existing road edges at legal crossings
- merge near-duplicate nodes after all road growth
- preserve bridge endpoints and coast-road continuity

Dead ends:

- allowed only for `curvy_residential`, `industrial_spine`, and rare `old_core`
- never allowed for highways/arterials

### 5. Road Graph Normalization

After road growth:

- split all crossing segments into shared nodes
- merge nodes closer than tolerance
- remove duplicate edges
- remove dangling roads unless profile permits them
- classify edge hierarchy
- compute edge length and node IDs
- preserve `roadGraph.nodes` for routing

The routing layer should consume the normalized graph, not reconstruct graph topology from rendered paths.

### 6. Corridor Construction

Build a corridor polygon for every normalized road edge.

For straight roads:

```txt
centerline segment + physicalWidth -> rectangle with capped ends
```

For polylines:

```txt
offset each segment by half width
join offsets at bends
cap ends
clean polygon
```

For v1, miter or bevel joins are acceptable. Avoid round joins unless the polygon boolean adapter handles them robustly.

Intersections are handled by unioning road corridors. Individual corridor polygons may overlap at intersections; the unioned `roadMask` becomes the physical road land.

### 7. Polygon Boolean Adapter

Add:

```txt
services/playgame/city-map/polygon-boolean.ts
```

Adapter API:

```ts
export type PolygonSet = Point[][];

export interface PolygonBooleanAdapter {
  union(polygons: PolygonSet): PolygonSet;
  difference(subject: PolygonSet, mask: PolygonSet): PolygonSet;
  intersection(a: PolygonSet, b: PolygonSet): PolygonSet;
  clean(polygons: PolygonSet): PolygonSet;
}
```

Rules:

- No generation code imports the boolean library directly.
- Always clean/simplify inputs before boolean operations.
- Drop faces below area threshold after boolean operations.
- Preserve deterministic point order as much as possible.

The hand-written split/clip helpers are not sufficient for global `district - roadMask` with intersections, coast roads, islands, and bridges.

### 8. Block Face Extraction

For each district:

```txt
districtBuildablePolygon - roadMaskInsideDistrict = blockFaces
```

Each connected remaining polygon becomes a `CityBlock`.

```ts
export interface RoadFaceBlock extends CityBlock {
  source: 'pm2001-road-face';
  boundedByRoadIds: string[];
  area: number;
  buildable: boolean;
  fieldAngle: number;
  density: 'sparse' | 'medium' | 'dense';
}
```

Block ID format:

```txt
${districtId}:block-face:${index}
```

`boundedByRoadIds` is computed by checking which road corridor/centerline edges are adjacent to the block boundary.

### 9. Parcelization And Buildings

Feed PM2001 block faces into the existing EG2012-style parcelizer:

```txt
road-face block -> frontage/interior parcels -> buildings/open spaces
```

The parcelizer should no longer compensate for roads occupying block area. It can still use road hazards for frontage value, but the block polygon itself should already be behind the curb.

### 10. Slots, Venues, And Routing

Slot and venue systems should continue to work by reading:

- `district.blocks`
- `city.cells`
- `buildingPlan.buildings`
- `roadGraph.edges`
- `roadGraph.nodes`

Changes:

- `nearestBlockId` should search PM2001 road-face blocks.
- slot placement should avoid `roadMask`.
- route snapping should use the normalized graph.
- venue extraction should not assume legacy BSP block IDs.

## Implementation Phases

### Phase 1: Metadata And Feature Flag

- Add `roadBlockModel` option.
- Add road physical width metadata.
- Ensure every road can expose a centerline.
- Keep legacy BSP blocks active.
- Add debug tooltip fields for `roadClass`, `physicalWidth`, and `source`.

Acceptance:

- existing city tests pass
- no visual change required
- road widths are inspectable

### Phase 2: Road Corridor Geometry

- Generate corridor polygons for roads.
- Store `edge.corridorPolygon`.
- Build a debug overlay for physical road masks.
- Keep legacy blocks active.

Acceptance:

- corridors align with rendered roads
- intersections union visually in debug
- no route/slot/building behavior changes yet

### Phase 3: Polygon Boolean Adapter

- Add adapter.
- Choose a polygon boolean library.
- Add tests for union/difference/intersection on simple road masks.
- Keep implementation isolated.

Acceptance:

- `district - roadMask` works for rectangles, T intersections, X intersections, coast-road loops, and narrow slivers
- invalid/empty polygons are cleaned

### Phase 4: PM2001 Block Faces Behind Flag

- Generate block faces from `district - roadMask`.
- Attach as `district.pm2001Blocks` first.
- Compare legacy block count/area with PM2001 block count/area in tests/debug.
- Do not switch `city.cells` yet.

Acceptance:

- no block face contains road centerline samples
- block coverage plus road mask covers most buildable district land
- tiny/sliver faces are dropped or marked non-buildable

### Phase 5: Switch Parcel/Building Generation Behind Flag

- When `roadBlockModel === 'pm2001-road-faces'`, use PM2001 faces as `district.blocks`, `city.cells`, and `city.blocks`.
- Feed those faces into parcelization/buildings.
- Keep legacy fallback if PM2001 face extraction fails.

Acceptance:

- all buildings have valid `blockId` and `parcelId`
- parcels cover at least 90% of buildable block area
- highlighted parcels do not overlap roads visually
- debug tooltip clearly shows block source

### Phase 6: Slots/Venues/Routing Cleanup

- Move slots to PM2001 blocks.
- Ensure active slots do not sit inside road corridors.
- Ensure route snapping resolves through normalized graph nodes.
- Remove legacy assumptions from venue extraction.

Acceptance:

- existing slot-count tests pass
- route demo still works
- venues remain deterministic

### Phase 7: Make PM2001 Default

Flip default only after repeated visual inspection.

Acceptance:

- `city-map-unit-seed`, `city-map-unit-seed-alt`, `new-game-city`, and 20 random layout samples pass smoke tests
- `/play` screenshots show roads consuming space, not painting over blocks
- no obvious slot/road/building overlaps

## Tests

Add focused tests:

- road class maps to expected physical width
- corridor polygon area roughly equals `length * physicalWidth`
- intersecting road corridors union into one road mask
- road graph crossings split into shared nodes
- no generated block face contains a road centerline sample
- PM2001 block faces plus road mask cover most district buildable area
- every buildable PM2001 block has valid frontage analysis
- every PM2001 building has valid `blockId` and `parcelId`
- active slots are outside road corridors
- deterministic output for same seed
- profile sample includes tight grid, loose grid, curvy residential, industrial spine, and coastal curve behavior

Keep running:

```bash
npx tsx services/playgame/city-map/__tests__/parcels.test.ts
npx tsx services/playgame/city-map/__tests__/city-v35.test.ts
npx tsx services/playgame/city-map/__tests__/render-metadata.test.ts
npm run build
```

## Debugging And Inspection

Add debug toggles:

- Road physical corridors
- Road graph nodes
- PM2001 block faces
- Rejected road candidates
- Rejected block slivers
- Legacy BSP blocks

Planning tooltip should show:

- block source: `legacy-bsp` or `pm2001-road-face`
- bounded road IDs
- road physical width when hovering roads
- road style profile
- block coverage role
- parcel generation kind

## Non-Goals For V1

- Full CGF15 example-driven OSM patch extraction
- downloaded map data
- real lane modeling beyond whole-number corridor widths
- full traffic simulation
- production road editing UI
- deleting legacy BSP code immediately
- replacing EG2012 parcelization

## Deprecation Notes

This spec supersedes older city-road/block planning docs where they describe:

- roads painted over BSP blocks
- BSP leaves as final block source of truth
- parcel/building clearance as a substitute for physical road corridors

Those docs may still contain useful historical context, renderer details, or zoning rules, but PM2001 is now the active road/block-generation direction.
