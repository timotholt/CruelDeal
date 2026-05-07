# Step 3: Island Clipping and Map Variety

**Depends on:** Step 1 (phone layout — so we can see results)
**Unblocks:** Step 4 (routing needs the land polygon to know walkable area)

---

## Goal

Support multiple map shapes: island, peninsula (current), and landlocked.
The old city-map used an elliptical island mask. The tensor generator uses
coastlines. We need a way to clip/shape the generated city into different
land forms, controlled by a seed-derived or explicit map type.

---

## Current State

### Old city-map (city-v35.ts)

Uses an elliptical land polygon:
```ts
// config.ts
LAND_RX = VIEW_W * 0.68;   // 979
LAND_RY = VIEW_H * 0.68;   // 1219
```

The terrain system generates an ellipse, then all geometry (roads, buildings,
slots) is clipped to this polygon. Water fills everything outside. Result:
an island surrounded by water.

### Tensor generator (current)

`WaterGenerator.createCoast()` integrates a streamline across the map. The
coastline divides the world rectangle into two polygons via
`PolygonUtil.lineRectanglePolygonIntersection()`. The smaller polygon becomes
`seaPolygon`. The larger is land.

This always produces a **peninsula** — land on one side, sea on the other,
with the coastline crossing two edges of the world rectangle.

`WaterGenerator.createRiver()` does the same for a river, splitting the land
further.

---

## Map Shape Options

### 1. Peninsula (current default)
Coast crosses two world edges. One side is sea. One side is land.
- Already works.

### 2. Island
Land is fully surrounded by water. The city sits on a finite island.
- Requires generating a **closed** land polygon instead of a coast that
  crosses edges.
- Two approaches:
  - **Elliptical mask** (like the old system) — simple, guaranteed results
  - **Organic coastline** — generate coast streamline as a closed loop using
    noise on an ellipse

### 3. Landlocked
No water at all. The city fills the entire world rectangle.
- Skip `createCoast()` and `createRiver()` entirely
- `seaPolygon = []`, no river
- All roads and buildings fill the full area

### 4. Archipelago (future)
Multiple islands. Complex but interesting for variety.
- Not in scope for this step.

---

## Approach: Map Shape Enum

```ts
type MapShape = 'peninsula' | 'island' | 'landlocked';
```

Seed-derived: `mapShape = shapes[hash(seed) % shapes.length]`

Or explicit: passed as a config option.

---

## Island Implementation

### Option A: Elliptical Mask (recommended for v1)

Simple. Deterministic. Matches the old game's look.

1. Generate an ellipse polygon centered in the world:
   ```ts
   function generateIslandMask(
     origin: Vector,
     worldDimensions: Vector,
     rx: number, ry: number,
     noiseAmplitude: number,
     rng: () => number
   ): Vector[] {
     const cx = origin.x + worldDimensions.x / 2;
     const cy = origin.y + worldDimensions.y / 2;
     const points: Vector[] = [];
     const steps = 64;
     for (let i = 0; i < steps; i++) {
       const angle = (i / steps) * Math.PI * 2;
       const noise = 1 + (rng() - 0.5) * noiseAmplitude;
       points.push(new Vector(
         cx + Math.cos(angle) * rx * noise,
         cy + Math.sin(angle) * ry * noise,
       ));
     }
     return points;
   }
   ```

2. Set `seaPolygon` = world rectangle minus island polygon (use JSTS
   difference, or simply set `seaPolygon` to the world bounds and
   `landPolygon` to the ellipse — the renderer draws sea first, then
   land on top).

3. **Clip roads to island** — after streamline generation, discard segments
   that fall outside the island polygon. Use `PolygonUtil.insidePolygon()`.

4. **Clip buildings to island** — `PolygonFinder` already filters polygons
   by `tensorField.sea` and `tensorField.parks`. Set `tensorField.sea` to
   the exterior of the island and it will naturally exclude buildings in water.

### Option B: Organic Coastline Loop (future enhancement)

Generate a closed-loop streamline using noise on an elliptical path. More
organic but harder to guarantee good results. Save for later.

---

## Integration Points

### TensorField.sea

`TensorField` already has a `sea` property (set by `WaterGenerator`) that is
checked by `onLand()`:
```ts
onLand(point: Vector): boolean {
  return this.sea.length === 0 || !PolygonUtil.insidePolygon(point, this.sea);
}
```

For island mode: set `sea` to the world-bounds polygon with the island
subtracted. All tensor field integration will then naturally avoid water.

For landlocked mode: set `sea = []`. Everything is land.

### WaterGenerator

Add a `mapShape` parameter:
- `peninsula`: run `createCoast()` + `createRiver()` as today
- `island`: skip `createCoast()`, instead set `seaPolygon` from the ellipse
  mask, optionally still run `createRiver()` across the island
- `landlocked`: skip both, `seaPolygon = []`, `riverPolygon = []`

### Style.draw()

No changes needed — it already draws `seaPolygon` and `coastline` from
whatever the generator provides. If `seaPolygon` is the ocean around an
island, it draws correctly.

---

## Work

### 1. Add `MapShape` type and config

```ts
// tensor/types.ts or tensor/headless.ts
export type MapShape = 'peninsula' | 'island' | 'landlocked';
```

Add to boot config and wire to dat.gui / debug panel.

### 2. Create island mask generator

```ts
// tensor/impl/island_mask.ts
export function generateIslandMask(
  origin: Vector, worldDimensions: Vector,
  rxRatio: number, ryRatio: number,
  noiseAmplitude: number,
  rng: () => number
): Vector[]
```

### 3. Modify WaterGUI / boot.ts

Before calling `coastline.generateRoads()`:
```ts
if (mapShape === 'island') {
  const mask = generateIslandMask(origin, worldDims, 0.42, 0.42, 0.15, rng);
  tensorField.sea = invertPolygon(origin, worldDims, mask);
  // Set seaPolygon for rendering
  style.seaPolygon = worldBoundsPolygon; // or the inverted polygon
  // Skip createCoast, optionally createRiver
} else if (mapShape === 'landlocked') {
  tensorField.sea = [];
  // Skip water generation entirely
} else {
  // peninsula — existing logic
}
```

### 4. Add road clipping for island mode

After all streamlines are generated, filter out segments outside the island:
```ts
function clipStreamlinesToLand(
  streamlines: Vector[][],
  landPolygon: Vector[]
): Vector[][]
```

This may already happen naturally via `tensorField.onLand()` checks during
integration, but verify and add explicit clipping if needed.

### 5. Seed-derived map shape

```ts
function mapShapeFromSeed(seed: string | number): MapShape {
  const hash = simpleHash(String(seed));
  const shapes: MapShape[] = ['peninsula', 'island', 'landlocked'];
  return shapes[hash % shapes.length];
}
```

Or make it configurable in the debug panel.

---

## Separation of Concerns

- **Island mask generation** — pure geometry, no rendering dependency
- **TensorField.sea** — already the single source of truth for "is this water?"
- **WaterGenerator** — responsible for coast/river; skip when not needed
- **Style.draw()** — reads `seaPolygon` from whatever source; no special island logic
- **No data duplication** — the island polygon IS the land boundary. It's set
  once and used by tensorField, road generation, building generation, and rendering.

---

## Acceptance

- Generate with `mapShape='island'`: city is surrounded by water on all sides
- Generate with `mapShape='landlocked'`: no water, city fills entire area
- Generate with `mapShape='peninsula'`: current behavior unchanged
- Buildings and roads don't appear in water for any mode
- Map shape is deterministic for a given seed
- Debug panel or dat.gui allows overriding map shape
