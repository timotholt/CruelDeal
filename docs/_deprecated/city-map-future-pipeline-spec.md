# City Map Future Pipeline Spec

> Status: partially superseded. This document is useful as historical context for terrain-first and 3D-ready goals, but its road/cell/block pipeline direction is superseded by [pm2001-road-block-generation-spec.md](/Users/timotholt/Projects/CruelDeal/docs/pm2001-road-block-generation-spec.md). Use PM2001 for the active `roads -> physical corridors -> block faces` plan.

## Purpose

Define the next-generation city map pipeline for the final visual direction: a sparse, cinematic, terrain-aware city board with believable waterways, non-stiff roads, better bridges, cell-based districts, and future 2.5D/3D rendering support.

This spec covers the recommended implementation order:

1. Terrain First
2. City Field Planner
3. Graph Roads
4. Parcel/Cell Backbone
5. Cell Districts
6. Bridge Planner
7. 3D-Ready Buildings

This order is intentional. Terrain must come first, then a field system defines the city's directional logic, then roads are traced from that field, then parcels/cells are generated around roads and terrain. Districts group cells, bridges connect roads across water, and 3D buildings come after parcels exist.

## Design Principles

- The city is generated from physical geography first, not from rectangular road cuts.
- A city field/tensor layer defines local street direction, grid families, radial zones, waterfront influence, and diagonal corridors.
- Roads are traced from the field and terrain constraints, not routed through random cell centroids.
- Cells/parcels are the hidden backbone of the map, not the final visual style.
- Roads are graph infrastructure, not the thing that creates districts.
- Districts are unions of cells.
- Bridges are planned infrastructure with terrain and road context.
- Rendering consumes stable geometry/data and should not own generation logic.
- The static city layer may be expensive to build because it can be cached per seed.
- Live VFX is optional and should be layered on top, not required for the city layout to work.
- Debug geometry must never be confused with final art. Cell outlines, raw district seams, and construction polygons are opt-in debug overlays.
- Most buildings should read as disciplined urban forms. Irregular parcels are useful for placement, setbacks, and coast/road hugging, but they should not automatically create irregular building footprints.

## Current Problems To Solve

- Roads feel too stiff and parallel.
- The current v4 road graph routes over cell centroids, so roads inherit jagged construction geometry instead of feeling planned.
- Districts are still influenced too much by road-cut geometry.
- Water is mostly an afterthought rather than a terrain system.
- Islands, channels, rivers, lakes, and bays are handled as special cases.
- Bridges are reactive decorations instead of planned infrastructure.
- Buildings are placed on BSP leaves rather than meaningful parcels.
- Future 3D rendering needs height, shadow, and extrusion metadata that the current pipeline does not model cleanly.
- The first v4 preview exposes construction geometry too literally: raw cell outlines, random neighborhood angles, cell-shaped buildings, and hard district seams produce a cartoon/stained-glass look instead of the intended cinematic map.

## Visual Correction Plan

The current v4 data backbone is directionally useful, but the preview renderer is showing the wrong layer of abstraction. The fix is not to abandon cells; it is to make cells serve a stricter visual model.

### 1. Hide Construction Geometry By Default

Cell outlines, raw neighborhood Voronoi boundaries, district cell seams, and parcel debugging must be disabled in the default preview. They should be controlled by explicit debug toggles:

- `Show Cells`
- `Show Parcel Debug`
- `Show District Cell Seams`
- `Show Road Graph Nodes`

Default map rendering should show only:

- land/water
- roads
- major district outline
- buildings/open spaces
- bridges
- labels

### 2. Add A City Field Before Roads And Cells

Neighborhoods should not use fully random orientations. A city can have multiple grids, but they should feel like coherent planning eras rather than every district inventing a new compass. Use a tensor/vector-style city field, similar in spirit to ProbableTrain-style field-based city generation, to answer "which way should roads/parcels want to go here?"

Replace arbitrary `rng() * Math.PI` orientation with field elements:

- 1 primary city grid angle per landmass
- 1 optional secondary grid angle for older/waterfront neighborhoods
- optional radial fields around civic centers, ports, stations, or circular landmarks
- water/coast-following fields near shoreline and rivers
- rare diagonal avenue corridors independent from parcel orientation
- small local jitter only after sampling the dominant local field

Target behavior:

- 70-80% of cells align to the primary grid
- 15-25% align to a secondary grid
- 0-10% are intentionally odd: coast, hill, bridgehead, or landmark parcels

### 3. Roads Become Visual Order, Cells Become Substrate

Roads should be planned as the visible organizing layer. Cells should adapt to roads and terrain, not visually compete with them.

Required changes:

- Generate major roads before final parcel subdivision.
- Trace major roads through the city field instead of through existing cell centroids.
- Use road corridors as clipping constraints for parcels.
- Keep highways and avenues long, legible, and sparse.
- Use roads as stable visual hierarchy:
  - highways: rare, long, glowing
  - avenues: district connectors
  - locals: faint parcel texture
  - alleys: mostly omitted unless zoomed/debug

The final renderer should not draw every cell edge as a road.

### 4. Buildings Should Mostly Be Rectangular

Irregular parcels are allowed; irregular buildings should be rare. The current preview uses shrunken cell polygons for too many buildings, causing hard cartoon shapes.

New rule:

- 80-90% rectangular or simple orthogonal footprints
- 5-15% trapezoids/wedges near angled roads, coast, rivers, or bridges
- 0-5% expressive irregular footprints for landmarks only

Building footprints should be generated from a parcel-local frame:

- choose a parcel orientation from its neighborhood or nearest road
- place a rectangle or compound rectangle inside the parcel
- shrink/inset from parcel edges
- only use the full cell shape for parks, plazas, waterfront lots, or landmark blocks

### 5. Districts Should Render As Generalized Shapes

Districts can still be unions of cells, including L and C shapes, but the visible district outline should be simplified/generalized.

Required changes:

- Keep cell union for gameplay and adjacency.
- Generate a simplified display boundary from the cell union.
- Remove tiny jagged stair-steps and short segments.
- Do not render every internal cell boundary.
- Labels use the generalized district footprint or a weighted cell center, not raw construction seams.

### 6. Preview Renderer Must Separate Modes

`city-map-v4-preview.jsx` should have two modes:

- `final`: default visual target
- `debug`: construction overlays

The current preview is effectively a debug mode. It should be renamed or altered so it does not imply that raw v4 data is the intended final look.

### Acceptance Criteria For The Correction

- With `Game UI` off and `V4 Preview` on, the map should read closer to the reference: sparse, cinematic, blue, and map-like.
- Turning off debug overlays should remove the stained-glass/cartoony polygon look.
- Most buildings should read as small extruded blocks, not random shards.
- Roads should provide the main visual structure.
- Districts should still support L/C/square shapes internally, but their display outlines should not look like raw cell debris.
- The system should still expose full cell/parcel data for future gameplay and 3D rendering.

## Target Pipeline

```text
seed
  -> terrain
  -> city field / tensor planner
  -> road graph
  -> cells/parcels
  -> district graph
  -> bridge planner
  -> buildings/landmarks
  -> static renderer data
  -> live overlay data
```

## Current Implementation Status

The first executable v4 backbone exists as a sidecar pipeline beside the live v3 map. It is loaded by `Nightrun CCG v3.html`, but the gameplay layer still uses v3 districts and slots unless the `V4 Preview` debug toggle is enabled.

Implemented modules:

- `city-map-terrain-v4.js`
- `city-map-field-v4.js`
- `city-map-cells-v4.js`
- `city-map-road-graph-v4.js`
- `city-map-districts-v4.js`
- `city-map-bridge-planner-v4.js`
- `city-map-buildings-v4.js`
- `city-map-v4.js`
- `city-map-v4-preview.jsx`

Important: the current executable v4 backbone now generates a city field before cells, stores field metadata on neighborhoods/cells, and attaches field samples plus corridor polygons to road edges. Highway and avenue visuals trace through the field between endpoint cells while retaining `routeCellPoints` for the older adjacency route. The remaining road refactor is to make the topology itself field-traced, then generate parcels around those road corridors.

V4 also now emits balanced player/opponent district slots and generalized district display outlines. The live board can consume v4 dots when the `V4 Preview` debug toggle is active, though the non-preview gameplay path still defaults to v3 data.

Public entry point:

```js
const city = CityMapV4.buildCityV4(seed);
const summary = CityMapV4.summarizeCityV4(city);
```

The v4 preview is intentionally visual/debug-only for now. Card placement, scoring, and detection still run against v3 data so the prototype remains playable while the new city architecture matures.

## 1. Terrain First

### Goal

Generate the physical world before generating the city: land, water, coastlines, channels, bays, islands, lakes, rivers, and optional elevation hints.

### New Module

`city-map-terrain-v4.js`

### Outputs

```js
{
  landmasses: [
    {
      id,
      polygon,
      kind: "mainland" | "island" | "peninsula",
      area,
      centroid,
      coastEdges
    }
  ],
  waterBodies: [
    {
      id,
      kind: "ocean" | "bay" | "river" | "lake" | "canal" | "channel",
      polygon,
      centerline,
      width,
      edges
    }
  ],
  coastline: {
    edges,
    docksAllowedEdges,
    bridgeAllowedEdges
  },
  channels: [
    {
      betweenLandmasses: [landmassIdA, landmassIdB],
      minWidth,
      centerline
    }
  ],
  elevation: {
    sample(x, y),
    ridges,
    hills
  }
}
```

### Required Features

- Generate one main landmass and optionally secondary islands/peninsulas.
- Guarantee minimum water channel width between landmasses.
- Support at least these water types:
  - ocean edge
  - bay indentation
  - river/canal through land
  - lake inside land
  - channel between landmasses
- Tag coastline edges by use:
  - dockable
  - bridgeable
  - decorative only
- Keep water as the darkest part of the map visually, but that is a render concern.

### Acceptance Criteria

- Islands never touch mainland.
- Bays read as bays, not random polygon bites.
- Rivers/canals have consistent banks and can expose bridge candidates.
- Lakes do not accidentally become district holes unless intended.
- Terrain output is independent from district and road generation.

## 2. City Field Planner

### Goal

Generate a terrain-aware direction field that controls road and parcel logic. This is the missing layer between organic geography and believable planned city structure.

### New Module

`city-map-field-v4.js`

### Outputs

```js
{
  fieldElements: [
    {
      id,
      kind: "grid" | "radial" | "coastFollow" | "riverFollow" | "diagonalCorridor" | "hillAvoidance",
      origin,
      angle,
      strength,
      radius,
      falloff,
      landmassId,
      priority
    }
  ],
  samples: [
    {
      point,
      primaryAngle,
      secondaryAngle,
      strength,
      density,
      tags
    }
  ],
  sample(point): {
    primaryAngle,
    secondaryAngle,
    strength,
    density,
    avoidWater,
    avoidSteepTerrain
  }
}
```

### Required Features

- Generate one dominant grid field per major landmass.
- Optionally add one secondary grid field for older/waterfront neighborhoods.
- Add radial fields around civic centers, stations, ports, or circular landmarks when useful.
- Add coast-following and river-following fields near water.
- Add rare diagonal corridor fields for long diagonal avenues.
- Blend fields deterministically by strength, radius, priority, and terrain relationship.
- Expose a `sample(point)` API so roads and parcels can ask for local direction.
- Keep density metadata with the field so roads/buildings know where sparse and dense areas should happen.

### Acceptance Criteria

- Road directions sampled from nearby points are coherent, not noisy.
- The map can contain multiple planning grids without looking randomly shattered.
- Diagonal avenues come from explicit corridor fields, not accidental cell geometry.
- Coast/river areas can bend roads/parcels locally without changing the whole city grid.
- Field debug can render streamlines or sample arrows, but final rendering hides them.

## 3. Graph Roads

### Goal

Trace roads through terrain and the city field instead of using recursive polygon cuts or existing cell centroids. Roads should be believable infrastructure: long highways, useful avenues, local streets, and organic connectors.

### New Module

`city-map-road-graph-v4.js`

### Outputs

```js
{
  nodes: [
    {
      id,
      point,
      kind: "intersection" | "bridgehead" | "coastGate" | "districtHub"
    }
  ],
  edges: [
    {
      id,
      from,
      to,
      kind: "highway" | "avenue" | "local" | "alley",
      path,
      corridorPolygon,
      fieldSamples,
      bridgeCandidateId,
      visualSmoothing
    }
  ],
  roadCorridors,
  blockedAreas
}
```

### Required Features

- Highways are few, long, and usually cross much of a landmass.
- Avenues connect neighborhoods, district hubs, bridgeheads, and coast gates.
- Local roads fill later parcels/neighborhoods by sampling the field; they do not need every line to be parallel.
- Major roads are generated before final parcel subdivision so they can influence parcels and building orientation.
- Roads avoid water except at bridge candidates.
- Roads avoid steep terrain unless explicitly marked as scenic/mountain roads.
- Visual paths may be smoothed even if topology remains graph-based.
- Diagonal roads are allowed visually, but they should not automatically become district borders.
- Roads are the visible structure of the map; cell edges are not automatically roads.
- Road generation order:
  - trace highways/primary routes from coast gates, bridgeheads, and city anchors
  - trace avenues from neighborhood anchors through field streamlines
  - generate locals only after major road corridors exist
  - emit road corridors that parcel generation must respect

### Acceptance Criteria

- Major roads are not short weird fragments.
- Roads can bend gently and avoid looking like hard CAD cuts.
- Roads connect to bridgeheads cleanly.
- Roads do not clip circular/landmark buildings.
- Local roads can remain dim/structural while major roads carry visual hierarchy.
- The final renderer can draw a sparse road set without exposing every parcel boundary.
- Roads look planned even when parcels/cells are hidden.

## 4. Parcel/Cell Backbone

### Goal

Replace BSP leaf blocks with parcels/cells generated around terrain and road corridors. Cells remain the gameplay/placement backbone, but they are downstream from the city field and major roads.

### New Module

`city-map-cells-v4.js`

### Outputs

```js
{
  cells: [
    {
      id,
      polygon,
      centroid,
      area,
      neighbors: [cellId],
      landmassId,
      nearestRoadEdgeId,
      fieldAngle,
      tags: ["buildable", "coast", "parkCandidate"],
      density,
      neighborhoodId
    }
  ],
  neighborhoods: [
    {
      id,
      seedPoint,
      fieldElementIds,
      orientation,
      density,
      cells: [cellId]
    }
  ],
  adjacency: Map<cellId, cellId[]>
}
```

### Required Features

- Seed neighborhood centers across buildable land.
- Generate cells clipped to landmasses, excluding water and road corridors.
- Use the city field to determine local parcel orientation.
- Use major roads as hard boundaries where appropriate.
- Relax cells enough to avoid noisy randomness while preserving organic shape.
- Preserve construction cells for placement, adjacency, and gameplay, but do not require final renderers to show cell outlines.
- Tag cells by terrain relationship:
  - interior
  - coast
  - riverfront
  - lakefront
  - steep/hill
  - bridgehead candidate
- Keep enough large cells for parks, landmarks, plazas, and sparse empty space.

### Acceptance Criteria

- Cell outlines are coherent enough to support parcels, but they are hidden in final rendering by default.
- Neighborhoods follow the field planner rather than fully random orientations.
- Sparse and dense neighborhoods can coexist.
- Cells near angled coast/roads can become trapezoids or irregular parcels.
- Every buildable cell has adjacency data.
- Cells can be rendered for debugging independently of roads/districts.
- Final map art remains legible when all cell debug overlays are disabled.

## 5. Cell Districts

### Goal

Build districts by grouping cells, not by road cuts. Districts should be compact when needed, but can intentionally become L-shaped, C-shaped, waterfront, island, or central square districts.

### New Module

`city-map-districts-v4.js`

### Outputs

```js
{
  districts: [
    {
      id,
      name,
      cells: [cellId],
      polygon,
      outlinePath,
      centroid,
      visualCenter,
      shapeKind: "compact" | "L" | "C" | "waterfront" | "island" | "center",
      slots,
      label
    }
  ],
  districtAdjacency: Map<districtId, districtId[]>
}
```

### Required Features

- Region-grow districts over cell adjacency.
- Support explicit shape targets:
  - compact rectangle-ish
  - L shape
  - inverted/reversed/rotated L
  - C shape
  - waterfront strip
  - central square/anchor district
- Let district borders follow selected major cell boundaries, not arbitrary diagonal roads.
- Use polylabel or equivalent visual-center placement for labels.
- Place labels before slots.
- Place slots after labels, respecting:
  - district boundaries
  - label bounds
  - slot ownership north/south bias
  - minimum edge clearance

### Acceptance Criteria

- Diagonal avenues do not become district borders by default.
- Each map can produce multiple intentional L/C-shaped districts when area supports it.
- Labels are visibly centered in the human sense.
- Slots feel intentionally spread and do not collide with labels.
- Districts can be debug-rendered as cell unions.

## 6. Bridge Planner

### Goal

Treat bridges as planned infrastructure that connects terrain and road graph, instead of decorative rectangles added after roads intersect water.

### New Module

`city-map-bridge-planner-v4.js`

### Outputs

```js
{
  bridges: [
    {
      id,
      kind: "short" | "causeway" | "bayBridge" | "suspension",
      fromNode,
      toNode,
      waterBodyId,
      path,
      spanLength,
      roadKind,
      deckWidth,
      supports,
      clearance
    }
  ],
  bridgeheads: [
    {
      id,
      point,
      landmassId,
      connectsToRoadNode
    }
  ]
}
```

### Required Features

- Generate bridge candidates from terrain:
  - river crossings
  - bay crossings
  - channel crossings
  - island connectors
- Score candidates by:
  - span length
  - road demand
  - spacing from other bridges
  - landmass importance
  - visual clarity
- Snap bridge endpoints to road graph nodes.
- Allow long bridges for bay/island scenarios.
- Ensure roads continue cleanly on both sides.
- Distinguish bridge visuals by span length and road hierarchy.

### Acceptance Criteria

- No accidental clusters of tiny duplicate bridges.
- Long bridges can connect landmasses across bays/channels.
- Short river bridges are placed where roads actually need to cross.
- Bridges do not appear without road continuation.
- Bridge decks visually sit above water and below/with road hierarchy cleanly.

## 7. 3D-Ready Buildings

### Goal

Generate sparse, height-aware, render-ready building data from cells/parcels so the map can be drawn as a static 2.5D/3D city board.

### New Module

`city-map-buildings-v4.js`

### Outputs

```js
{
  buildings: [
    {
      id,
      cellId,
      footprint,
      roofPolygon,
      height,
      elevation,
      type: "tower" | "block" | "landmark" | "dock" | "industrial" | "residential",
      material,
      shadowPolygon,
      renderPriority
    }
  ],
  openSpaces: [
    {
      cellId,
      kind: "park" | "plaza" | "emptyLot" | "waterfront"
    }
  ]
}
```

### Required Features

- Fill only some cells with buildings for a sparse cinematic look.
- Building density depends on neighborhood density, terrain, district role, and proximity to roads.
- Footprints are placed inside parcels, but most are generated from rectangular or compound-rectangular forms.
- Parcel/cell insets are used for setbacks, parks, plazas, and landmarks; they should not be the default building shape.
- Support odd footprints:
  - trapezoids
  - wedges
  - small irregular polygons
  - docks/piers as building-like structures
- Limit odd footprints to places where they explain something visually:
  - angled avenue frontage
  - waterfront/coast parcels
  - bridgeheads
  - landmark/civic blocks
- Assign heights for future 2.5D/3D rendering.
- Generate roof and shadow metadata.
- Preserve open spaces intentionally.

### Acceptance Criteria

- Buildings look placed on parcels, not stamped on a uniform grid.
- Most buildings still read as disciplined urban blocks, not random shards.
- Sparse clusters can exist without the city feeling empty by accident.
- Tall buildings can cast longer shadows.
- Short buildings do not visually shadow taller roofs in fake lighting.
- Renderer can consume the output without needing to infer height or footprint shape.

## Migration Strategy

Do not replace the current v3 map all at once.

1. Keep `buildCityV3(seed)` working.
2. Introduce v4 terrain behind a debug toggle or separate prototype entry point.
3. Add v4 field planner and render debug field streamlines/arrows.
4. Regenerate v4 road graph from terrain + field samples.
5. Generate v4 parcels/cells around terrain and road corridors.
6. Add v4 districts as cell unions.
7. Add v4 bridge planner.
8. Add 2.5D/static renderer once roads/parcels/buildings are stable.

## Debug Requirements

Each stage needs its own debug overlay:

- Terrain polygons and water types
- Field elements, streamlines, and sampled direction arrows
- Cell IDs and adjacency
- Road graph nodes/edges by hierarchy
- District cell membership
- Bridge candidates and selected bridges
- Building footprints, heights, and shadows

## Non-Goals

- Do not start with Three.js.
- Do not make VFX routes responsible for city layout.
- Do not continue tuning BSP as the final layout architecture.
- Do not make every road curvy; major roads can be smooth while local structure remains readable.
- Do not require fully realistic GIS behavior. The goal is believable and distinctive, not simulation-grade urban planning.

## Open Questions

- Should v4 live beside v3 as a separate renderer/prototype, or replace v3 module by module?
- How many districts should v4 support long-term: always 3, or variable by board mode?
- Should water bodies affect card visibility/pathing, or remain visual only?
- Should elevation become gameplay-relevant, or only visual?
- Should long bridges be playable locations/slots, or purely map infrastructure?
