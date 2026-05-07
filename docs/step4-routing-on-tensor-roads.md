# Step 4: Routing on Tensor Roads

**Depends on:** Step 1 (phone layout), Step 3 (island clipping — land polygon
defines walkable area)
**Also depends on:** tensor-to-citymap-migration.md §3a (road conversion to
`RoadEdge[]` + `RoadNode[]`)

---

## Goal

Enable A* pathfinding on tensor-generated roads so the route demo and
future gameplay can find paths between any two points on the map.

The existing `routing.ts` already has all the pathfinding logic:
`enrichCityRouting()`, `findPath()`, `findPathBetweenCoords()`, `dijkstra()`.
It works on `RoadEdge[]` with `{a, b}` endpoints. We just need to feed it
the right data from the tensor generator.

---

## Current Routing Pipeline

```
enrichCityRouting(city: CityMap)
  → densifyEdgePoints(edge) — adds intermediate points along each edge
  → enrichBuildings(buildings, edges) — snaps each building to nearest edge
  → buildRoadGraph(edges, waterSegs, bridges) → RoutingGraph
      → creates nodes at intersections and edge endpoints
      → creates adjacency list with distances
      → stores on city._routing
  → city.roadGraph.nodes = graph.nodes

findPathBetweenCoords(city, x1, y1, x2, y2)
  → nearestBuilding(city, x, y) — finds closest building
  → findPath(city, buildingIdA, buildingIdB)
      → snapNodes — finds routing nodes near the building's snap point
      → dijkstra(adjacency, startId, endId)
      → buildWaypoints — converts node path to polyline
```

### Key requirement from routing.ts

It expects `city.roadGraph.edges` to be `RoadEdge[]` where each edge has:
```ts
{
  id: string;
  a: Point;          // start endpoint
  b: Point;          // end endpoint
  centerline?: Point[];  // intermediate points (optional, used for densification)
  kind?: string;
  source?: string;
}
```

And `city.buildingPlan.buildings` where each building has:
```ts
{
  id: string;
  centroid: Point;
  // After enrichment:
  snapEdgeId?: string;
  snapPoint?: Point;
  snapT?: number;
}
```

---

## What Tensor Generator Provides

### Road data

`MainGUI` has:
- `coastline.allStreamlinesSimple` — coast road polylines
- `majorRoads.allStreamlinesSimple` — major road polylines
- `minorRoads.allStreamlinesSimple` — minor road polylines
- `mainRoads.allStreamlinesSimple` — main road polylines

Each is `Vector[][]` — arrays of polylines where each polyline is a sequence
of `Vector` (with `.x`, `.y`).

### Intersection data

`Graph` class (from `tensor/impl/graph.ts`) already finds all road
intersections:
- `graph.nodes: Node[]` — each has `value: Vector` and `neighbors: Set<Node>`
- `graph.intersections: Vector[]` — intersection points

### Building data

`Buildings.lots: Vector[][]` — building footprint polygons (in screen space).
`Buildings.polygonFinder.polygons` — in world space.

---

## Conversion: Tensor Streamlines → RoadEdge[]

### Step 1: Collect all streamlines with type metadata

```ts
interface TaggedStreamline {
  points: Vector[];
  kind: 'main' | 'major' | 'minor' | 'coastline';
}

const allStreamlines: TaggedStreamline[] = [
  ...mainRoads.allStreamlinesSimple.map(s => ({ points: s, kind: 'main' })),
  ...majorRoads.allStreamlinesSimple.map(s => ({ points: s, kind: 'major' })),
  ...minorRoads.allStreamlinesSimple.map(s => ({ points: s, kind: 'minor' })),
  ...coastline.allStreamlinesSimple.map(s => ({ points: s, kind: 'coastline' })),
];
```

### Step 2: Split streamlines at intersections

The `Graph` class already does this internally — it finds where streamlines
cross and creates nodes. But it returns `Node` objects with `Vector` values,
not `RoadEdge` objects.

Two approaches:

**A. Use Graph nodes directly** (recommended):
```ts
const graph = new Graph(allSimpleStreamlines, dstep, false);
// graph.nodes has all intersection + endpoint nodes
// Each node has neighbors — walk the adjacency to build edges
```

Walk the graph adjacency to extract edges:
```ts
function graphToRoadEdges(nodes: Node[], streamlines: TaggedStreamline[]): RoadEdge[] {
  const edges: RoadEdge[] = [];
  const visited = new Set<string>();

  for (const node of nodes) {
    for (const neighbor of node.neighbors) {
      const key = edgeKey(node, neighbor);
      if (visited.has(key)) continue;
      visited.add(key);

      edges.push({
        id: `tensor-edge-${edges.length}`,
        a: { x: node.value.x, y: node.value.y },
        b: { x: neighbor.value.x, y: neighbor.value.y },
        kind: classifyEdge(node, neighbor, streamlines),
        source: 'tensor',
      });
    }
  }
  return edges;
}
```

**B. Split streamlines into segments between consecutive points**:
Simpler but loses intersection topology — not recommended.

### Step 3: Create RoadNode[]

```ts
function graphToRoadNodes(nodes: Node[]): RoadNode[] {
  return nodes.map((n, i) => ({
    id: `tensor-node-${i}`,
    x: n.value.x,
    y: n.value.y,
  }));
}
```

### Step 4: Add centerline points

For edges that follow a streamline (not just straight A→B), include the
intermediate points:
```ts
edge.centerline = streamlinePointsBetween(node, neighbor, originalStreamline);
```

This gives `routing.ts` the polyline path for accurate distance calculation
and waypoint generation.

---

## Conversion: Tensor Lots → Building[]

```ts
function lotsToBuildings(lots: Vector[][], rng: () => number): Building[] {
  return lots.map((lot, i) => {
    const centroid = polygonCentroid(lot);
    return {
      id: `tensor-bldg-${i}`,
      polygon: lot.map(v => ({ x: v.x, y: v.y })),
      centroid: { x: centroid.x, y: centroid.y },
    };
  });
}
```

After conversion, `enrichCityRouting()` will snap each building to the
nearest road edge automatically.

---

## Integration

### In the adapter (tensor-adapter.ts)

```ts
// After tensor generation completes:
const graph = new Graph(allStreamlines, dstep, false);
const roadEdges = graphToRoadEdges(graph.nodes, taggedStreamlines);
const roadNodes = graphToRoadNodes(graph.nodes);
const buildings = lotsToBuildings(polygonFinder.polygons, rng);

const city: CityMap = {
  // ...
  roadGraph: { nodes: roadNodes, edges: roadEdges },
  buildingPlan: { buildings },
  // ...
};

// This does all the routing graph construction + building snapping
enrichCityRouting(city);

// Now findPathBetweenCoords(city, x1, y1, x2, y2) works!
```

### In the route demo

`RouteDemoLayer.tsx` calls `findPathBetweenCoords(city, x1, y1, x2, y2)`.
This function:
1. Finds nearest building to each point
2. Uses the building's `snapEdgeId` to enter the routing graph
3. Runs Dijkstra
4. Returns waypoints

No changes needed to `RouteDemoLayer` — it just needs a `CityMap` with
populated routing data.

---

## Water-Aware Routing

`routing.ts` already handles water barriers via `waterSegmentsFromTerrain()`:
```ts
function waterSegmentsFromTerrain(city: CityMap) {
  // Extracts water body polygon edges as segments
  // buildRoadGraph uses these to penalize or block edges crossing water
}
```

For the tensor adapter, we need:
```ts
city.terrain.waterBodies = [
  { id: 'sea', polygon: seaPolygon.map(v => ({ x: v.x, y: v.y })) },
  { id: 'river', polygon: riverPolygon.map(v => ({ x: v.x, y: v.y })) },
];
```

Then `enrichCityRouting()` will automatically avoid routing through water.

---

## Separation of Concerns

- **Tensor generator** — produces raw streamlines, lots, and sea/river polygons.
  No routing knowledge.
- **Graph (tensor)** — finds intersections in streamlines. Pure topology.
- **Conversion functions** — transform tensor `Node[]` → `RoadNode[]` +
  `RoadEdge[]` and tensor lots → `Building[]`. Pure data mapping.
- **routing.ts** — unchanged. Receives standard `CityMap`, builds routing
  graph, runs Dijkstra. No tensor dependency.
- **RouteDemoLayer** — unchanged. Receives `CityMap`, calls
  `findPathBetweenCoords()`.
- **No data duplication** — tensor `Graph.nodes` is converted once to
  `RoadNode[]`. Not stored in both formats.

---

## Work

| Task | Where |
|------|-------|
| `graphToRoadEdges()` conversion | `tensor-adapter.ts` |
| `graphToRoadNodes()` conversion | `tensor-adapter.ts` |
| `lotsToBuildings()` conversion | `tensor-adapter.ts` |
| Wire `enrichCityRouting(city)` | `tensor-adapter.ts` |
| Set `city.terrain.waterBodies` from tensor sea/river | `tensor-adapter.ts` |
| Verify `findPathBetweenCoords` works end-to-end | Test |
| Enable route demo on tensor play screen | `TensorPlayScreen.tsx` |

---

## Acceptance

- `findPathBetweenCoords(city, x1, y1, x2, y2)` returns valid paths
  between any two points on tensor-generated roads
- Route waypoints follow road geometry (not straight lines)
- Routes don't cross water
- Route demo layer renders animated paths on the tensor map
- Same seed produces same routes
