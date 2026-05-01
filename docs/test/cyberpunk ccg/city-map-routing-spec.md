# City Map Routing Layer — Spec

**Status:** Design  
**Depends on:** `city-map-v35.js` (`buildCityV35`)  
**Visual target:** Glowing cyan path traced through streets between two pinned nodes, with data readouts at each node.

---

## 1. Goal

Given any two buildings on the map, compute and render the shortest road path between them — following actual street geometry, not straight lines.

Visual style (reference screenshot):
- Dark city map base
- Glowing circular node markers at source + destination (and optionally intermediate waypoints)
- Neon/cyan glowing polyline traced along road edges
- Numeric label near each node (distance, value, or game stat)
- Path bends at real intersections, curves with road geometry

---

## 2. Data Model Additions

### 2a. Building Address

Current buildings (`buildingPlan.buildings[]`) have no stable ID and no road reference. Add at city build time:

```js
{
  id: `${cellId}:bldg:${i}`,   // e.g. "district-1:block:3:bldg:7"
  cellId,                       // parent block
  districtId,                   // grandparent district
  centroid: { x, y },           // computed from footprint average
  footprint: [...],             // existing polygon corners
  snapEdgeId,                   // nearest roadGraph.edges[n].id
  snapPoint: { x, y },          // closest point on that edge to centroid
  snapT,                        // 0..1 parametric position along snapEdge
}
```

`snapEdgeId`, `snapPoint`, `snapT` computed once at build time — one pass, O(buildings × edges).

### 2b. Road Graph Nodes

Current `roadGraph.nodes` is `[]`. Populate it:

Each road edge (`roadGraph.edges[n]`) is a polyline: `points: [{x,y}, ...]`

Node extraction:
1. For each edge, emit its two endpoints as candidate nodes
2. For each pair of edges, find intersections — emit intersection point as node
3. Deduplicate nodes within `ε = 1.5px`
4. Assign each node a stable ID: `rn:${Math.round(x)},${Math.round(y)}`

Each node:
```js
{
  id: "rn:142,88",
  x, y,
  edgeIds: [...],   // edges this node belongs to
}
```

Each edge gains:
```js
{
  ...existing,
  nodeIds: [startNodeId, endNodeId],  // after node extraction
  length,                              // Euclidean sum of segment lengths
}
```

---

## 3. Routing Algorithm

### 3a. Snap source/dest to graph

For building A → building B:

1. Find edge `eA = A.snapEdgeId`. Split it at `A.snapT` → two virtual half-edges with lengths `snapT × eA.length` and `(1-snapT) × eA.length`.
2. Same for building B on edge `eB`.
3. Insert virtual nodes `vnA`, `vnB` into graph for this query only (not mutating the base graph).

Special case: if A and B snap to the **same edge**, path is just the segment between their snap points — no graph traversal needed.

### 3b. Dijkstra

Standard Dijkstra on the node adjacency graph. Edge weight = geometric length (could later be modified by road `kind`: highway cheaper, local more expensive, or vice versa for flavor).

Returns: ordered list of `{x, y}` waypoints from `vnA` → ... → `vnB`.

### 3c. Path smoothing (optional)

Apply light Chaikin or cubic smoothing to the waypoint polyline so sharp right-angle turns at intersections soften slightly — matches the curved look in the reference image.

---

## 4. Rendering Layer

New SVG `<g id="routing-layer">` rendered above road layer, below UI.

### Route line
```
stroke: #00f5ff (cyan) or configurable
strokeWidth: 1.2
filter: drop-shadow blur glow (same technique as existing neon roads)
strokeLinecap: round
strokeLinejoin: round
opacity: 0.92
```
Path = SVG `<path d="M x y L x y ...">` from smoothed waypoints.

### Node markers (source / destination / waypoints)
```
Outer ring:  circle r=5, stroke cyan, fill none, opacity 0.7
Inner dot:   circle r=2, fill cyan, opacity 1.0
Pulse ring:  animated circle, r 5→9, opacity 1→0, duration 1.8s loop
```

### Data label
```
<text> near each node marker
font: monospace, 7px
fill: cyan
content: configurable — distance in px, game value, building name, etc.
```

---

## 5. API (proposed module: `city-map-routing-v1.js`)

```js
window.CityMapRoutingV1 = {

  // Call once after buildCityV35(). Mutates city in place, adds:
  //   - building.id, .centroid, .snapEdgeId, .snapPoint, .snapT
  //   - roadGraph.nodes[], roadGraph.edges[n].nodeIds, .length
  enrichCity(city),

  // Returns { waypoints: [{x,y},...], distance: number, edgeIds: [...] }
  // or null if no path exists.
  findPath(city, buildingIdA, buildingIdB),

  // Returns SVG path string from findPath result. Applies optional smoothing.
  routeToSvgPath(waypoints, smooth = true),

  // Nearest building to a pixel coordinate (for click-to-select).
  nearestBuilding(city, x, y),
}
```

---

## 6. Build Order

1. `enrichCity(city)` — add building IDs + snap data, extract road nodes/edges
2. `findPath(city, a, b)` — routing query
3. SVG render layer — overlay on existing map SVG

---

## 7. Constraints / Notes

- Map is **360 × 448px** canvas (`VIEW_W × VIEW_H`). All coordinates in px.
- City is **procedural** — regenerates from seed. All IDs must be deterministic given same seed.
- Road graph is **planar** (no overpasses except bridges). Bridges are in `bridgePlan.bridges[]` — treat as normal edges for routing unless flagged otherwise.
- `roadGraph.edges` currently includes `v35-road-*`, `v35-river-bank-*`, `v35-lake-bank-*`. River-bank and lake-bank edges should be included in graph (they're real roads) but may want higher cost.
- `roadGraph.nodes` is `[]` in current build — must be populated by `enrichCity`.
- Buildings with no snap edge (e.g. isolated island buildings) — mark `snapEdgeId: null`, exclude from routing.

---

## 8. Future Extensions

- Multi-stop routing (A → waypoint → B)
- Road-kind weighting (highway = fast, local = slow, or inverted for stealth gameplay)
- Animated path draw (stroke-dasharray + dashoffset animation)
- "Visible from street" radius overlay per building
- District-to-district summary graph (already have `districtAdjacency`)
