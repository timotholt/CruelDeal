# City Map Future Pipeline Spec

## Purpose

Define the next-generation city map pipeline for the final visual direction: a sparse, cinematic, terrain-aware city board with believable waterways, non-stiff roads, better bridges, cell-based districts, and future 2.5D/3D rendering support.

This spec covers the recommended implementation order:

1. Terrain First
2. Cell City Backbone
3. Graph Roads
4. Cell Districts
5. Bridge Planner
6. 3D-Ready Buildings

This order is intentional. Terrain must come before cells, cells before roads, roads before districts, bridges after both terrain and roads, and 3D buildings after parcels exist.

## Design Principles

- The city is generated from physical geography first, not from rectangular road cuts.
- Cells/parcels are the backbone of the map.
- Roads are graph infrastructure, not the thing that creates districts.
- Districts are unions of cells.
- Bridges are planned infrastructure with terrain and road context.
- Rendering consumes stable geometry/data and should not own generation logic.
- The static city layer may be expensive to build because it can be cached per seed.
- Live VFX is optional and should be layered on top, not required for the city layout to work.

## Current Problems To Solve

- Roads feel too stiff and parallel.
- Districts are still influenced too much by road-cut geometry.
- Water is mostly an afterthought rather than a terrain system.
- Islands, channels, rivers, lakes, and bays are handled as special cases.
- Bridges are reactive decorations instead of planned infrastructure.
- Buildings are placed on BSP leaves rather than meaningful parcels.
- Future 3D rendering needs height, shadow, and extrusion metadata that the current pipeline does not model cleanly.

## Target Pipeline

```text
seed
  -> terrain
  -> cells/parcels
  -> road graph
  -> district graph
  -> bridge planner
  -> buildings/landmarks
  -> static renderer data
  -> live overlay data
```

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

## 2. Cell City Backbone

### Goal

Replace BSP leaf blocks as the primary city skeleton with a cell/parcel graph that can produce non-parallel layouts, sparse clusters, irregular plots, and better building placement.

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
      tags: ["buildable", "coast", "parkCandidate"],
      density,
      neighborhoodId
    }
  ],
  neighborhoods: [
    {
      id,
      seedPoint,
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
- Generate cells clipped to landmasses and excluding water.
- Relax cells enough to avoid noisy randomness while preserving organic shape.
- Support different neighborhood orientations and densities.
- Tag cells by terrain relationship:
  - interior
  - coast
  - riverfront
  - lakefront
  - steep/hill
  - bridgehead candidate
- Keep enough large cells for parks, landmarks, plazas, and sparse empty space.

### Acceptance Criteria

- Cell outlines are not dominated by one parallel grid.
- Sparse and dense neighborhoods can coexist.
- Cells near angled coast/roads can become trapezoids or irregular parcels.
- Every buildable cell has adjacency data.
- Cells can be rendered for debugging independently of roads/districts.

## 3. Graph Roads

### Goal

Generate roads as a connected graph over terrain/cells instead of using recursive polygon cuts. Roads should be believable infrastructure: long highways, useful avenues, local streets, and organic connectors.

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
      cellsAlongside: [cellId],
      bridgeCandidateId,
      visualSmoothing
    }
  ],
  roadCells: [cellId],
  blockedCells: [cellId]
}
```

### Required Features

- Highways are few, long, and usually cross much of a landmass.
- Avenues connect neighborhoods, district hubs, bridgeheads, and coast gates.
- Local roads fill cells/neighborhoods without needing every line to be parallel.
- Roads avoid water except at bridge candidates.
- Roads avoid steep terrain unless explicitly marked as scenic/mountain roads.
- Visual paths may be smoothed even if topology remains graph-based.
- Diagonal roads are allowed visually, but they should not automatically become district borders.

### Acceptance Criteria

- Major roads are not short weird fragments.
- Roads can bend gently and avoid looking like hard CAD cuts.
- Roads connect to bridgeheads cleanly.
- Roads do not clip circular/landmark buildings.
- Local roads can remain dim/structural while major roads carry visual hierarchy.

## 4. Cell Districts

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

## 5. Bridge Planner

### Goal

Treat bridges as planned infrastructure that connects terrain and road graph, instead of decorative rectangles added after roads intersect water.

### New Module

`city-map-bridges-v4.js`

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

## 6. 3D-Ready Buildings

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
- Footprints come from parcel/cell inset, not from fixed rectangular stamps.
- Support odd footprints:
  - trapezoids
  - wedges
  - small irregular polygons
  - docks/piers as building-like structures
- Assign heights for future 2.5D/3D rendering.
- Generate roof and shadow metadata.
- Preserve open spaces intentionally.

### Acceptance Criteria

- Buildings look placed on parcels, not stamped on a uniform grid.
- Sparse clusters can exist without the city feeling empty by accident.
- Tall buildings can cast longer shadows.
- Short buildings do not visually shadow taller roofs in fake lighting.
- Renderer can consume the output without needing to infer height or footprint shape.

## Migration Strategy

Do not replace the current v3 map all at once.

1. Keep `buildCityV3(seed)` working.
2. Introduce v4 terrain behind a debug toggle or separate prototype entry point.
3. Add v4 cells and render debug cell outlines.
4. Add v4 road graph while still optionally drawing v3 roads for comparison.
5. Add v4 districts as cell unions.
6. Add v4 bridge planner.
7. Add 2.5D/static renderer once cells/buildings are stable.

## Debug Requirements

Each stage needs its own debug overlay:

- Terrain polygons and water types
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
