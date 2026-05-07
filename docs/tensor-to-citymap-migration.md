# Tensor Generator → CityMap Migration

**Purpose:** Phase out `city-v35.ts` and its helper modules. Replace with tensor
MapGenerator as the city generation engine. Keep the existing game board UI,
camera, renderers, and gameplay code unchanged — they consume `CityMap` and
don't care where it came from.

---

## 0. Current Architecture

```
PlayScreen
  → CityMapBoard (camera, interaction, selection)
    → buildCityMap(seed)           ← THIS GETS REPLACED
      → city-v35.ts + 15 helpers
    → CityMapRendererHost
      → SVG renderer
      → Three.js renderer
```

The renderers, camera, hover, slots, landmarks all consume one thing:
`CityMap` (defined in `types.ts`). Everything below `buildCityMap()` is
an implementation detail.

---

## 1. What Gets Archived (not deleted)

Move to `services/playgame/city-map/_legacy/`:

| File | Size | Reason to keep |
|------|------|----------------|
| `city-v35.ts` | 80KB | District subdivision logic, slot placement |
| `partition.ts` | 22KB | BSP subdivision (steal for district gen) |
| `parcels.ts` | 27KB | Parcel subdivision |
| `buildings.ts` | 53KB | Building generation, height assignment |
| `planning.ts` | 23KB | Block profiles, frontage analysis |
| `pm2001.ts` | 24KB | Road metadata, corridor polygons |
| `terrain.ts` | 15KB | Terrain noise, water body generation |
| `placement.ts` | 15KB | Slot placement in polygons |
| `bridges.ts` | 11KB | Bridge generation |
| `land.ts` | 6KB | Coast docks |
| `water.ts` | 4KB | River banks |
| `parcel-shapes.ts` | 29KB | Shape classification |
| `planar-faces.ts` | 12KB | Road-face block detection |
| `polygon-boolean.ts` | 3KB | Polygon clipping |
| `tensor-broken/` | dir | Previous failed extraction attempt |

**Keep in place (still used by the adapter or renderers):**
- `types.ts` — the `CityMap` contract
- `index.ts` — public API (repoint exports)
- `routing.ts` — pathfinding on any road graph
- `venues.ts` — venue/landmark enrichment
- `config.ts` — constants (VIEW_W, VIEW_H, colors, names)
- `geometry.ts` — pure geometry utils
- `paths.ts` — SVG path helpers
- `rng.ts` — seeded RNG
- `urban-units.ts` — scale constants

---

## 2. Headless Tensor Runner

The tensor generator currently requires a canvas and dat.gui. To use it as
a pure data pipeline:

### 2a. Extract computation from rendering

Create `services/playgame/city-map/tensor/headless.ts`:

```ts
import Vector from './vector';
import TensorField from './impl/tensor_field';
import { RK4Integrator } from './impl/integrator';
import StreamlineGenerator from './impl/streamlines';
import WaterGenerator from './impl/water_generator';
import Graph from './impl/graph';
import PolygonFinder from './impl/polygon_finder';

export interface TensorCityOutput {
  origin: Vector;
  worldDimensions: Vector;
  coastline: Vector[];
  seaPolygon: Vector[];
  riverPolygon: Vector[];
  parks: Vector[][];
  majorRoads: Vector[][];     // simplified streamlines
  minorRoads: Vector[][];
  mainRoads: Vector[][];
  coastlineRoads: Vector[][];
  buildingLots: Vector[][];
  graph: { nodes: any[]; };   // from Graph class
}

export interface TensorCityConfig {
  width: number;
  height: number;
  rng: () => number;         // seeded RNG replaces Math.random()
  // streamline params, water params, etc.
}

export function generateTensorCity(config: TensorCityConfig): TensorCityOutput {
  // 1. Create tensor field with basis fields (no GUI)
  // 2. Generate coast + river (WaterGenerator)
  // 3. Generate major/minor/main roads (StreamlineGenerator)
  // 4. Find parks (PolygonFinder on major+minor roads)
  // 5. Find building lots (PolygonFinder, shrink, divide)
  // 6. Return raw geometry
}
```

### 2b. Seed determinism

Replace all `Math.random()` calls in tensor code with a passed-in RNG:
- `StreamlineGenerator.samplePoint()` — random seed position
- `WaterGenerator.createCoast()` — `Math.random() < 0.5` for major/minor
- `TensorFieldGUI.setRecommended()` — random field positions
- `PolygonFinder` — `chanceNoDivide` uses random

Thread the RNG through constructors or use a module-level seedable reference.

### 2c. No canvas dependency

The headless runner uses none of:
- `CanvasWrapper` / `DefaultCanvasWrapper`
- `DomainController` (world↔screen transforms)
- `DragController`
- `dat.gui`
- `Style` / `DefaultStyle` / `RoughStyle`

It only uses the `impl/` classes + `TensorField` directly.

---

## 3. Tensor → CityMap Adapter

Create `services/playgame/city-map/tensor-adapter.ts`:

```ts
import type { CityMap } from './types';
import { generateTensorCity, type TensorCityConfig } from './tensor/headless';
import { enrichCityRouting } from './routing';
import { enrichCityVenues } from './venues';

export function buildCityFromTensor(seed: string | number): CityMap {
  const rng = createSeededRng(seed);
  const raw = generateTensorCity({ width: 360, height: 448, rng });

  const city: CityMap = {
    version: 'v35',
    seed,
    width: 360,
    height: 448,
    terrain: convertTerrain(raw),
    roadGraph: convertRoads(raw),
    districts: generateDistricts(raw, rng),
    blocks: convertBlocks(raw),
    buildingPlan: convertBuildings(raw),
    bridgePlan: { bridges: [] },
    coastDocks: [],
    venues: [],
    venueById: {},
  };

  enrichCityRouting(city);
  enrichCityVenues(city, rng);
  return city;
}
```

### 3a. Road conversion

```
Tensor streamlines (Vector[][])
  → RoadNode[] (each unique endpoint/intersection)
  → RoadEdge[] (each streamline segment between nodes)
  → physicalWidth derived from road type (main > major > minor)
  → RoadRenderMeta assigned per edge
```

The tensor `Graph` class already finds intersections — reuse its `nodes` list
to build the `RoadGraph`.

### 3b. District generation

Options (pick one):
1. **Voronoi from major intersections** — fast, organic shapes
2. **Largest polygons from major roads** — use `PolygonFinder` on major roads
   only, take the N largest as districts
3. **Steal BSP from legacy** — use `partition.ts`'s `macroDivide3` on the
   land polygon, subdivide by major roads

Recommendation: Option 2. The tensor generator already finds polygons from
road intersections. Run `PolygonFinder` on major+main roads → take top 5-7
largest polygons → those are districts. Remaining space is unowned.

### 3c. Slot placement

Steal from legacy `placement.ts`:
- `placeDotsInPolygon(polygon, count, rng)` — places N evenly-spaced points
  inside a polygon
- Each district gets `targetSlotCount` slots placed in its polygon

### 3d. Terrain conversion

```
seaPolygon → waterBodies[0]
riverPolygon → waterBodies[1] or rivers[0]
parks → openSpaces[]
land = world bounds minus sea
```

### 3e. Building conversion

```
buildingLots (Vector[][]) → Building[] with:
  - polygon: lot vertices
  - centroid: average point
  - render: BuildingRenderMeta (height from lot area, material from district)
```

Height assignment: steal logic from legacy `buildings.ts` or use simple
area-based rules (smaller lot → taller building, near district center → taller).

---

## 4. Swap Point

In `index.ts`, change:
```ts
// Before
export { buildCityV35 as buildCityMap } from './city-v35';

// After
export { buildCityFromTensor as buildCityMap } from './tensor-adapter';
```

The game board, renderers, and all gameplay code continue unchanged.

---

## 5. Implementation Order

| Step | Work | Unblocks |
|------|------|----------|
| 1 | Fix tensor generator rendering (water_generator.ts) | Visual verification |
| 2 | Add seeded RNG to tensor code | Deterministic output |
| 3 | Create `headless.ts` — run tensor without canvas | Adapter |
| 4 | Create `tensor-adapter.ts` — roads + terrain | Flat map rendering |
| 5 | Add district generation | Slot placement |
| 6 | Add slot + venue placement | Gameplay |
| 7 | Swap `buildCityMap` export | Live in game |
| 8 | Archive legacy files to `_legacy/` | Clean tree |

Step 1 is already done (this session). Steps 2-4 are the critical path.

---

## 6. Verification

At each step, these must pass:
- `npm run build` — no type errors
- Tensor map renders at `/dev/tensor` (visual check)
- `CityMapBoard` renders with new generator (visual check)
- Slots are clickable
- Landmarks show tooltips
- Route demo draws connected paths

---

## 7. What to Steal Later

From legacy modules, useful algorithms to port into tensor-adapter:

| Module | Algorithm | Use |
|--------|-----------|-----|
| `placement.ts` | `placeDotsInPolygon` | Slot placement |
| `venues.ts` | `enrichCityVenues` | Landmark/venue names |
| `routing.ts` | `enrichCityRouting` | A* pathfinding |
| `buildings.ts` | height assignment rules | BuildingRenderMeta |
| `partition.ts` | `macroDivide3` | Fallback district gen |
| `config.ts` | `DISTRICT_COLORS`, `DISTRICT_NAMES` | District theming |
| `planning.ts` | `chooseBlockProfile` | Building density rules |
