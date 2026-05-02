# Nightrun City Map V3.5 Spec

## Intent

V3.5 keeps the visual grammar that made V3 work: a small number of strong civic cuts, BSP block subdivision, road edges that naturally explain district borders, and compact rectangular city blocks.

V3.5 keeps the flexibility that motivated V4: terrain-first generation, islands, lakes, rivers, bridges, coastlines, elevation hints, district metadata, deterministic validation, and future 3D/static-scene hooks.

The core rule is:

> V4 owns terrain and metadata. V3 owns city grammar.

## Why V3 Looked Better

V3 has one coherent chain:

1. Generate land.
2. Split land into 3 macro districts with long mostly-straight cuts.
3. Recursively BSP each district into blocks.
4. Treat BSP cuts as roads.
5. Render districts, roads, buildings, labels, and hover from the same geometry.

This means roads, district borders, blocks, and buildings all agree. Roads do not look decorative because they are the cuts that created the blocks.

## Why V4 Drifted

V4 introduced useful terrain systems, but the city grammar became too indirect:

1. Terrain creates land and water.
2. Field sampling creates neighborhoods and cells.
3. Districts are assigned after cells exist.
4. Preview draws extra grids and connector roads on top.
5. Slot/label envelopes were accidentally reused as district borders.

That allowed several geometry contracts to diverge:

- Playable district ownership was not the same as visual district shape.
- Lake and river terrain were visually inside a district but not owned by it.
- Roads were sometimes rendered as overlays rather than block-forming edges.
- `displayPolygon` was a slot/label envelope but looked like district geometry.

## Naming

Working name: `CityMapV35`.

Do not call the revised architecture V4 until its contracts are clean. V4 can remain as the experimental branch while V3.5 becomes the production candidate.

## Data Contract

### Terrain

Terrain is generated first and is non-playable by default.

Terrain output:

```js
{
  bounds,
  landmasses,
  waterBodies,
  coastline,
  channels,
  elevation
}
```

Water bodies include:

- `ocean`: outside land ownership.
- `river`: district-owned when it passes through a landmass, but non-buildable.
- `lake`: district-owned by the containing district, but non-buildable.
- `channel`: outside district ownership unless explicitly bridged or island-owned.

### District

A district is a civic ownership region, not just a set of buildable blocks.

```js
{
  id,
  name,
  color,
  landmassId,
  ownershipPolygon,
  buildablePolygons,
  waterPolygons,
  blockTree,
  blocks,
  roads,
  slots,
  labelAnchor,
  metadata
}
```

Rules:

- `ownershipPolygon` is the hover and game ownership shape.
- `buildablePolygons` are where buildings and card slots may exist.
- `waterPolygons` are owned terrain features inside the district.
- Hover uses `ownershipPolygon`.
- Slots use `buildablePolygons`, never the full ownership polygon.
- Lakes and rivers can be highlighted as part of a district without becoming playable slots.

### Blocks

Blocks are BSP leaves.

```js
{
  id,
  districtId,
  polygon,
  kind,
  roadEdges,
  buildable,
  landmarkAllowed
}
```

Rules:

- Most blocks should be 4-sided or near-rectangular.
- Triangles are allowed only as coast/river leftovers or tiny edge cases.
- Target: under 5% triangular blocks across seed sanity tests.
- Target: at least 70% four-sided blocks across seed sanity tests.

### Roads

Roads are generated from cuts, not painted as unrelated overlays.

```js
{
  id,
  kind,
  path,
  source,
  adjacentDistrictIds,
  adjacentBlockIds
}
```

Road sources:

- `macro-cut`: highway or avenue between districts.
- `bsp-cut`: local street between blocks.
- `coast-road`: shoreline route.
- `bridge`: channel/river crossing.
- `landmark-access`: short spur only when connected to another road.

Rules:

- Every visible road must connect to another visible road, a coast road, or a bridge.
- Long roads should be straight for meaningful stretches.
- Curves are allowed for rivers, coasts, and a small number of feature arterials.
- District borders should prefer roads, water edges, and land boundaries.

## Generation Pipeline

### Step 1: Terrain

Use V4 terrain generation:

- landmasses
- islands
- lakes
- rivers
- channels
- elevation
- coastline metadata

Then build a set of `buildableLandPolygons` by subtracting internal non-buildable water from each landmass.

### Step 2: Macro Districts

Use a V3-style macro partition on each significant landmass.

Mainland:

- Split into 3 macro districts.
- Cuts should be mostly orthogonal, with optional minor jogs.
- Cuts should avoid creating thin ribbons.
- Cuts may snap to river/lake/coast boundaries when nearby.

Islands:

- If large enough, create 1 island district.
- If very large, allow 2 districts via one clean cut.
- Tiny islands become terrain landmarks, not playable districts.

### Step 3: Owned Water Assignment

Assign internal water to the district whose ownership polygon contains it.

Rules:

- Lake inside a district becomes `district.waterPolygons`.
- River segments inside a district become district-owned water corridors.
- Owned water participates in hover fill.
- Owned water blocks building, slots, and cards.

### Step 4: BSP Blocks

Run V3 BSP subdivision inside each district's buildable land polygons.

Rules:

- BSP inherits the district/grid angle.
- Cuts alternate primary and secondary axes.
- Jitter is small.
- Stop early for a few landmark blocks.
- Preserve road cut metadata.
- Do not BSP over lakes.

### Step 5: Roads

Promote cuts into roads:

- Macro cuts become highway/avenue.
- BSP cuts become local streets.
- Coastline gets a separate coast road stroke.
- Bridges connect road endpoints across channels/rivers.

Road rendering order:

1. water masks
2. road underlay
3. major roads
4. local roads
5. bridges
6. district border glow where not covered by roads

### Step 6: Buildings And Landmarks

Use V3 building placement inside BSP blocks, then add V4 metadata.

Rules:

- Buildings align to the block/grid frame.
- Landmark blocks reserve larger footprints.
- Parks/plazas are owned by the district and buildable=false.
- Lakes are terrain, not landmarks.

### Step 7: Slots And Labels

Slots and labels use buildable district space.

Rules:

- Slot candidates must be inside `buildablePolygons`.
- Slots avoid water, roads, labels, and landmarks.
- Labels prefer the largest visual interior point of ownership, but avoid water.
- Duplicate district names are disallowed per map.

## Rendering Contract

Render from semantic geometry only.

Allowed:

- `district.ownershipPolygon` for hover and district ownership.
- `district.buildablePolygons` for blocks/buildings/slots.
- `district.waterPolygons` for owned non-buildable hover.
- `road.path` for roads.
- `block.polygon` for block/building texture.

Disallowed:

- Rendering slot envelopes as district borders.
- Drawing preview-only grids outside block or district geometry.
- Drawing roads that do not come from road metadata.
- Reusing debug geometry as production art.

## Module Plan

Recommended files:

- `city-map-v35.js`: top-level builder and summary.
- `city-map-terrain-v4.js`: keep and reuse.
- `city-map-partition-v35.js`: terrain-aware macro split, based on V3 partition.
- `city-map-blocks-v35.js`: BSP block subdivision, based on V3 BSP.
- `city-map-roads-v35.js`: roads from macro/BSP cuts plus bridges/coast roads.
- `city-map-districts-v35.js`: ownership, water assignment, slots, labels.
- `city-map-buildings-v35.js`: V3 building grammar with V4 metadata.
- `city-map-v35-preview.jsx`: render V3.5 only from semantic contracts.

## Migration Path From Current V4

1. Freeze current V4 as `experimental`.
2. Create `CityMapV35.buildCity(seed)`.
3. Feed V4 terrain into a V3-style macro partition.
4. Replace cell-assignment districts with macro district ownership polygons.
5. Replace preview grid roads with roads derived from macro and BSP cuts.
6. Move lakes into district-owned `waterPolygons`.
7. Move slots from `displayPolygon` to `buildablePolygons`.
8. Render hover from ownership polygons.
9. Keep V4 summary/debug validation.

## Acceptance Checks

Run across at least 16 deterministic seeds:

- No console errors.
- Every district has an ownership polygon.
- Every playable district has at least one buildable polygon.
- No duplicate district names.
- All slots are inside buildable polygons.
- No slots in lakes, rivers, ocean, channels, roads, or bridges.
- Lakes inside land are owned by exactly one district.
- Rivers inside land are assigned to adjacent/containing districts.
- All visible roads are connected.
- Triangle blocks under 5%.
- Four-sided blocks at least 70%.
- Label anchors are finite and inside ownership, avoiding water where possible.
- Hover fill matches district ownership, including owned lakes/rivers.

## Decision

V4 is worth keeping as terrain and systems work.

V4 is not worth keeping as the city-block architecture.

The revised version should be V3.5: a terrain-aware V3 architecture with V4 metadata and validation.
