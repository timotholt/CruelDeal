# Planar Block Extraction — Implementation Spec (v2, hand-held)

**Audience**: Claude Sonnet at low–medium effort.
**Assumptions**: You can read TypeScript. You can run shell commands. You will follow this spec **in order** and not skip phases.

## How to use this spec

- **Do exactly one phase at a time.** Each phase ends with a **CHECKPOINT**. Do not move to the next phase until the checkpoint passes.
- **If a checkpoint fails, stop and debug it before continuing.** Do not try to "fix it later" — bugs compound.
- **Every code block you are told to write is either complete or explicitly marked `TODO`.** If you find yourself inventing code that's not asked for, stop.
- **When in doubt, prefer the most literal reading of the spec.** If I wrote `snapEpsilon = 0.5`, use `0.5`, not `1e-6`.
- **You may not add dependencies.** No `npm install`. Use only what's already in the repo.

At the bottom of each phase is an **IF-STUCK** subsection with specific failure modes and fixes.

---

## 0. Why this exists (read once, then skip)

The current city generator puts blocks outside streets and buildings in roads. Root cause: `services/playgame/city-map/pm2001.ts` function `buildPM2001BlockFacesForDistrict` computes blocks by subtracting inflated road-corridor polygons from a seed polygon. That has unfixable slivers, spillover, and false-rejection bugs.

The fix is to compute blocks as the **planar faces** of the road graph — the bounded regions literally enclosed by roads. A block is, by construction, between streets when it is defined as "a region with streets as its boundary".

**You will not rewrite the old code. You will add a new code path behind a flag.**

---

## Phase 0 — Setup, baseline, and orientation

**Goal**: Confirm your environment works, you know where things live, and you have a baseline to compare against.

### 0.1 Verify your tools

Run these three commands in the repo root. Each must succeed (exit 0).

```bash
node --version
npx tsx --version
npm --version
```

If any fails, stop. Something is wrong with the environment and you cannot proceed.

### 0.2 Run the existing test suite and save baseline output

```bash
npx tsx services/playgame/city-map/__tests__/city-v35.test.ts > /tmp/baseline-city-v35.txt 2>&1
npx tsx services/playgame/city-map/__tests__/pm2001.test.ts > /tmp/baseline-pm2001.txt 2>&1
npx tsx services/playgame/city-map/__tests__/parcels.test.ts > /tmp/baseline-parcels.txt 2>&1
npx tsx services/playgame/city-map/__tests__/render-metadata.test.ts > /tmp/baseline-render.txt 2>&1
```

All four must exit 0. Check with `echo $?` after each, or inspect the files. They contain `PASS:` lines and no `AssertionError`.

If any test fails, **stop**. The repo is broken before your changes; no point proceeding.

### 0.3 Read these files (in this order, minimum)

Read the whole file or the indicated range. Do not skim — you will be asked concrete questions about these in later phases.

1. `services/playgame/city-map/types.ts` — full file. Know what `Point`, `RoadEdge`, `RoadGraph`, `CityBlock`, `CityDistrict`, `CityMap` are.
2. `services/playgame/city-map/geometry.ts` — full file. Note: `polygonArea`, `polygonCentroid`, `pointInPolygon`, `segIntersect`, `pointToSegmentDist` are available. **You will import these; do not reimplement them.**
3. `services/playgame/city-map/pm2001.ts` — lines 265–329 (`buildPM2001BlockFacesForDistrict`). You are writing a **sibling** to this function, not replacing it.
4. `services/playgame/city-map/city-v35.ts` — lines 1580–1650 (`applyPM2001BlockFaces` and `buildBaseCity`). This is where you'll wire in the flag at the end.
5. `services/playgame/city-map/index.ts` — full file. You'll add two exports here.

### 0.4 Take notes

Open a scratch file `docs/planar-blocks-notes.md` and record:

- The exact signature of `segIntersect` from `geometry.ts`.
- The exact signature of `polygonArea` and `polygonCentroid`.
- Whether `CityMapOptions` lives in `types.ts` or `city-v35.ts`.
- The exact line number in `city-v35.ts` where `const result = buildPM2001BlockFacesForDistrict(district, roadEdges);` (or similar) appears.

You'll refer back to these facts; having them written down prevents re-reading.

### CHECKPOINT 0

Before moving on, all of these must be true:

- [ ] `node`, `npx tsx`, `npm` all run.
- [ ] All four baseline test files saved to `/tmp/baseline-*.txt`, each exit 0.
- [ ] You have `docs/planar-blocks-notes.md` with the four pieces of info above.
- [ ] You can name three functions in `geometry.ts` without rechecking.

If all four are checked: proceed to Phase 1.

### IF-STUCK (Phase 0)

- **`npx tsx` not found** → run `npm install` in repo root, then retry. If still missing, stop; this is an environment problem.
- **Baseline test fails** → this is not your bug. Stop. Flag the failure up to the human.
- **Cannot find `segIntersect`** → search: `grep -n "export function segIntersect" services/playgame/city-map/geometry.ts`.

---

## Phase 1 — The warmup commit: stub file + empty export

**Goal**: Create the new file, have it compile, and confirm your test harness runs.

You will write **no algorithm** in this phase. Just plumbing.

### 1.1 Create `services/playgame/city-map/planar-faces.ts`

Copy this file verbatim:

```ts
// services/playgame/city-map/planar-faces.ts
//
// Planar-face extraction from a segment soup + clipping polygon.
// See docs/planar-blocks-migration-spec.md.

import { polygonArea, polygonCentroid, pointInPolygon, segIntersect } from './geometry';
import type { Point } from './types';

export interface PlanarEdge {
  id: string;
  points: Point[];       // polyline with ≥ 2 points
  roadEdgeId?: string;
}

export interface PlanarFace {
  polygon: Point[];            // CCW, no duplicate last point
  area: number;
  centroid: Point;
  boundedByEdgeIds: string[];
  holes?: Point[][];
}

export interface PlanarFaceOptions {
  snapEpsilon?: number;   // default 0.5
  minFaceArea?: number;   // default 20
}

const DEFAULT_SNAP_EPSILON = 0.5;
const DEFAULT_MIN_FACE_AREA = 20;

export function extractPlanarFaces(
  edges: ReadonlyArray<PlanarEdge>,
  clip: ReadonlyArray<Point>,
  options: PlanarFaceOptions = {},
): PlanarFace[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const snapEpsilon = options.snapEpsilon ?? DEFAULT_SNAP_EPSILON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const minFaceArea = options.minFaceArea ?? DEFAULT_MIN_FACE_AREA;

  // TODO(phase-2): snap & dedupe endpoints
  // TODO(phase-3): split segments at intersections
  // TODO(phase-4): build planar graph
  // TODO(phase-5): walk faces
  // TODO(phase-6): drop outer face, filter, normalize

  return [];
}
```

Notes:

- The function currently returns `[]`. That is intentional.
- The `// eslint-disable-next-line` comments are necessary because `snapEpsilon` and `minFaceArea` are unused until phase 2. Remove each comment when you use the corresponding variable.
- **Do not add helper functions yet.** They come in specific phases.

### 1.2 Create `services/playgame/city-map/__tests__/planar-faces.test.ts`

Copy verbatim:

```ts
import { strict as assert } from 'node:assert';
import { extractPlanarFaces } from '../planar-faces';
import type { Point } from '../types';

const pass = (label: string) => console.log(`PASS: ${label}`);

const square = (s: number): Point[] => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

// Phase 1: stub returns []
{
  const faces = extractPlanarFaces([], square(100));
  assert.equal(Array.isArray(faces), true, 'returns an array');
  pass('phase-1: stub returns array');
}
```

### 1.3 Run the test

```bash
npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts
```

Expected output:

```
PASS: phase-1: stub returns array
```

Exit code 0.

### CHECKPOINT 1

- [ ] `services/playgame/city-map/planar-faces.ts` exists and exports `extractPlanarFaces`, `PlanarEdge`, `PlanarFace`, `PlanarFaceOptions`.
- [ ] `services/playgame/city-map/__tests__/planar-faces.test.ts` exists.
- [ ] `npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts` prints `PASS: phase-1: stub returns array` and exits 0.
- [ ] All four baseline tests from Phase 0 still pass (re-run them if uncertain).

If all four are checked: **commit** with message `city-map: add planar-faces stub` and proceed.

### IF-STUCK (Phase 1)

- **TypeScript errors about `Point`** → you imported it wrong. Use `import type { Point } from './types';`.
- **Cannot find `./geometry`** → you mistyped the path. The file lives at `services/playgame/city-map/geometry.ts`, so the relative import from `planar-faces.ts` is `'./geometry'`.
- **Test file can't find `../planar-faces`** → the file must be in `services/playgame/city-map/`, not elsewhere.

---

## Phase 2 — Snap & dedupe endpoints

**Goal**: Turn `edges` (polylines) into a list of unique vertices with integer ids.

### 2.1 Add at the top of `planar-faces.ts` (below the interfaces, above `extractPlanarFaces`):

```ts
// ---- internal types (phase 2+) ----

interface Vertex {
  x: number;
  y: number;
}

interface SnapResult {
  vertices: Vertex[];
  /** For each edge, for each polyline point, the index into vertices. */
  edgeVertexIndices: number[][];
}

function snapAndDedupe(
  edges: ReadonlyArray<PlanarEdge>,
  snapEpsilon: number,
): SnapResult {
  const vertices: Vertex[] = [];
  const edgeVertexIndices: number[][] = [];
  const eps2 = snapEpsilon * snapEpsilon;

  const findOrInsert = (x: number, y: number): number => {
    for (let i = 0; i < vertices.length; i++) {
      const dx = vertices[i].x - x;
      const dy = vertices[i].y - y;
      if (dx * dx + dy * dy <= eps2) return i;
    }
    vertices.push({ x, y });
    return vertices.length - 1;
  };

  for (const edge of edges) {
    const indices: number[] = [];
    for (const p of edge.points) {
      indices.push(findOrInsert(p.x, p.y));
    }
    edgeVertexIndices.push(indices);
  }

  return { vertices, edgeVertexIndices };
}
```

This is `O(n·V)`. That's fine for our input sizes.

### 2.2 Wire it into `extractPlanarFaces`

Replace the body of `extractPlanarFaces` with:

```ts
export function extractPlanarFaces(
  edges: ReadonlyArray<PlanarEdge>,
  clip: ReadonlyArray<Point>,
  options: PlanarFaceOptions = {},
): PlanarFace[] {
  const snapEpsilon = options.snapEpsilon ?? DEFAULT_SNAP_EPSILON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const minFaceArea = options.minFaceArea ?? DEFAULT_MIN_FACE_AREA;

  // Sort edges by id for determinism
  const sorted = [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Step 1: snap & dedupe
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const snap = snapAndDedupe(sorted, snapEpsilon);

  // TODO(phase-3): split segments at intersections
  // TODO(phase-4): build planar graph
  // TODO(phase-5): walk faces
  // TODO(phase-6): drop outer face, filter, normalize

  return [];
}
```

### 2.3 Add a test

Add to `__tests__/planar-faces.test.ts` (at the bottom, after the Phase 1 test block):

```ts
// Phase 2: snap does not crash on trivial inputs
{
  const faces = extractPlanarFaces([
    { id: 'e1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    { id: 'e2', points: [{ x: 10.1, y: 0 }, { x: 20, y: 0 }] },  // 10.1 ≈ 10 → snaps
  ], square(100));
  assert.equal(faces.length, 0, 'phase 2 returns empty (walker not yet implemented)');
  pass('phase-2: snap does not crash');
}
```

Run:

```bash
npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts
```

Expected:

```
PASS: phase-1: stub returns array
PASS: phase-2: snap does not crash
```

### CHECKPOINT 2

- [ ] `snapAndDedupe` compiles and is called from `extractPlanarFaces`.
- [ ] Phase-2 test passes.
- [ ] Phase-1 test still passes.

Commit message: `city-map: planar-faces phase 2 — snap`

### IF-STUCK (Phase 2)

- **Points that should snap aren't snapping** → check you're using `<= eps2`, not `<`. And that you squared epsilon.
- **Duplicate vertices in output** → your `findOrInsert` returned `-1` somewhere, or you didn't push the new vertex before returning its index.

---

## Phase 3 — Segment soup and intersection splits

**Goal**: Turn the snapped edges into a list of atomic segments where no two segments cross except at endpoints.

Input: `SnapResult` (vertices + edge-vertex-indices) from Phase 2.
Output: a list of atomic segments `{ a: vertexIdx, b: vertexIdx, sourceEdgeId: string }`.

### 3.1 Strategy

1. Expand each polyline into consecutive 2-vertex segments.
2. **Also add the clip polygon as an edge** (so its boundary splits anything that crosses it). Give it id `__clip__`.
3. For every unordered pair of segments, compute intersection using `segIntersect`.
4. If an intersection lies strictly inside both segments (not at an endpoint), add a new vertex and split both segments at that vertex.
5. Repeat the pair-pass until no new intersections are found. (Two passes is usually enough in practice.)

### 3.2 Add this code to `planar-faces.ts` (below `snapAndDedupe`):

```ts
interface AtomicSegment {
  a: number;
  b: number;
  sourceEdgeId: string;
}

/** Split segments so they only meet at vertex endpoints. Mutates `vertices`. */
function splitAtIntersections(
  segments: AtomicSegment[],
  vertices: Vertex[],
  snapEpsilon: number,
): AtomicSegment[] {
  const eps2 = snapEpsilon * snapEpsilon;

  const addOrReuseVertex = (x: number, y: number): number => {
    for (let i = 0; i < vertices.length; i++) {
      const dx = vertices[i].x - x;
      const dy = vertices[i].y - y;
      if (dx * dx + dy * dy <= eps2) return i;
    }
    vertices.push({ x, y });
    return vertices.length - 1;
  };

  let current = segments.slice();
  // Cap passes to avoid pathological infinite loops; 4 passes handles all realistic cases.
  for (let pass = 0; pass < 4; pass++) {
    const next: AtomicSegment[] = [];
    const splitsInPass: Map<number, number[]> = new Map();  // segmentIdx → extra vertex indices

    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const si = current[i];
        const sj = current[j];
        // Shared endpoint → no true intersection
        if (si.a === sj.a || si.a === sj.b || si.b === sj.a || si.b === sj.b) continue;

        const a1 = vertices[si.a];
        const b1 = vertices[si.b];
        const a2 = vertices[sj.a];
        const b2 = vertices[sj.b];
        const hit = segIntersect(a1, b1, a2, b2);
        if (!hit) continue;

        const vIdx = addOrReuseVertex(hit.x, hit.y);

        // Only count it as a split if vIdx is NOT already an endpoint of the segment
        if (vIdx !== si.a && vIdx !== si.b) {
          const arr = splitsInPass.get(i) || [];
          arr.push(vIdx);
          splitsInPass.set(i, arr);
        }
        if (vIdx !== sj.a && vIdx !== sj.b) {
          const arr = splitsInPass.get(j) || [];
          arr.push(vIdx);
          splitsInPass.set(j, arr);
        }
      }
    }

    if (splitsInPass.size === 0) {
      return current;
    }

    // Apply splits: for each original segment, if there are split points, sort them along (a, b) and emit subsegments
    for (let i = 0; i < current.length; i++) {
      const seg = current[i];
      const splits = splitsInPass.get(i);
      if (!splits || splits.length === 0) {
        next.push(seg);
        continue;
      }
      const a = vertices[seg.a];
      const b = vertices[seg.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;

      const tFor = (vIdx: number) => {
        const v = vertices[vIdx];
        return ((v.x - a.x) * dx + (v.y - a.y) * dy) / len2;
      };

      const ordered = Array.from(new Set([seg.a, ...splits, seg.b]))
        .sort((p, q) => tFor(p) - tFor(q));

      for (let k = 0; k + 1 < ordered.length; k++) {
        if (ordered[k] !== ordered[k + 1]) {
          next.push({ a: ordered[k], b: ordered[k + 1], sourceEdgeId: seg.sourceEdgeId });
        }
      }
    }

    current = next;
  }

  return current;
}
```

### 3.3 Wire it into `extractPlanarFaces`

Replace body:

```ts
export function extractPlanarFaces(
  edges: ReadonlyArray<PlanarEdge>,
  clip: ReadonlyArray<Point>,
  options: PlanarFaceOptions = {},
): PlanarFace[] {
  const snapEpsilon = options.snapEpsilon ?? DEFAULT_SNAP_EPSILON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const minFaceArea = options.minFaceArea ?? DEFAULT_MIN_FACE_AREA;

  const sorted = [...edges].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Step 1: snap & dedupe road edges + clip boundary
  const clipEdge: PlanarEdge = {
    id: '__clip__',
    points: clip.map((p) => ({ x: p.x, y: p.y })),
  };
  // Add closing segment for clip
  if (clip.length >= 3) {
    clipEdge.points = [...clipEdge.points, { x: clip[0].x, y: clip[0].y }];
  }
  const withClip: PlanarEdge[] = [...sorted, clipEdge];
  const snap = snapAndDedupe(withClip, snapEpsilon);

  // Step 2: expand polylines into atomic segments
  const rawSegments: AtomicSegment[] = [];
  for (let e = 0; e < withClip.length; e++) {
    const indices = snap.edgeVertexIndices[e];
    const id = withClip[e].roadEdgeId ?? withClip[e].id;
    for (let i = 0; i + 1 < indices.length; i++) {
      if (indices[i] !== indices[i + 1]) {
        rawSegments.push({ a: indices[i], b: indices[i + 1], sourceEdgeId: id });
      }
    }
  }

  // Step 3: split at intersections
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const atomicSegments = splitAtIntersections(rawSegments, snap.vertices, snapEpsilon);

  // TODO(phase-4): build planar graph
  // TODO(phase-5): walk faces
  // TODO(phase-6): drop outer face, filter, normalize

  return [];
}
```

### 3.4 Add a test

```ts
// Phase 3: plus-sign splits into 4 intersection-created segments
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(faces.length, 0, 'phase 3 still returns empty (walker not yet implemented)');
  pass('phase-3: plus-sign does not crash');
}
```

Run:

```bash
npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts
```

Expected three PASS lines.

### CHECKPOINT 3

- [ ] `splitAtIntersections` compiles and is called.
- [ ] All three existing tests still pass.

Commit: `city-map: planar-faces phase 3 — segment split`

### IF-STUCK (Phase 3)

- **Infinite loop or very slow** → your split is not stable. You should never split a segment at a vertex that is already one of its endpoints. Double-check the `vIdx !== si.a && vIdx !== si.b` guards.
- **`segIntersect` not found** → confirm import `from './geometry'`.

---

## Phase 4 — Build the planar graph

**Goal**: From atomic segments, build a node-based graph with neighbors sorted by angle.

### 4.1 Add this code to `planar-faces.ts`:

```ts
interface GraphNode {
  x: number;
  y: number;
  neighbors: GraphNeighbor[];
}

interface GraphNeighbor {
  to: number;          // vertex index
  edgeId: string;      // underlying sourceEdgeId
  angle: number;       // radians, -PI..PI
}

function buildGraph(vertices: Vertex[], segments: AtomicSegment[]): GraphNode[] {
  const nodes: GraphNode[] = vertices.map((v) => ({ x: v.x, y: v.y, neighbors: [] }));

  const seen = new Set<string>();  // dedupe bidirectional entries

  for (const seg of segments) {
    if (seg.a === seg.b) continue;
    const key1 = `${seg.a}:${seg.b}`;
    const key2 = `${seg.b}:${seg.a}`;
    if (seen.has(key1) || seen.has(key2)) continue;
    seen.add(key1);

    const a = nodes[seg.a];
    const b = nodes[seg.b];
    const angleAB = Math.atan2(b.y - a.y, b.x - a.x);
    const angleBA = Math.atan2(a.y - b.y, a.x - b.x);

    a.neighbors.push({ to: seg.b, edgeId: seg.sourceEdgeId, angle: angleAB });
    b.neighbors.push({ to: seg.a, edgeId: seg.sourceEdgeId, angle: angleBA });
  }

  // Sort neighbors by angle ascending for deterministic face walking
  for (const node of nodes) {
    node.neighbors.sort((p, q) => p.angle - q.angle);
  }

  return nodes;
}
```

### 4.2 Wire it into `extractPlanarFaces`

After the `atomicSegments` line, add:

```ts
  // Step 4: build planar graph
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const graph = buildGraph(snap.vertices, atomicSegments);
```

### 4.3 Add a test

```ts
// Phase 4: graph has expected node count
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(faces.length, 0, 'phase 4 still returns empty');
  pass('phase-4: graph builds without crashing');
}
```

### CHECKPOINT 4

- [ ] `buildGraph` compiles and is called.
- [ ] All tests pass.

Commit: `city-map: planar-faces phase 4 — graph`

### IF-STUCK (Phase 4)

- **Neighbors listed twice in one node** → remove the dedupe `seen` guard, you have duplicate segments. Better: fix at the source in `splitAtIntersections`.

---

## Phase 5 — Walk faces

**Goal**: Produce raw face polygons by traversing directed half-edges.

### 5.1 The algorithm, visualized

Each undirected edge is two directed half-edges. To trace the face **to the right of** a directed half-edge `(u → v)`:

```
At vertex v, you just arrived from u.
v.neighbors is sorted by angle.
Find the index k of u in v.neighbors.
The next half-edge leaves v toward v.neighbors[(k - 1 + n) % n].
Continue until you return to your starting half-edge.
```

This is the "turn as far right as possible" walk. Each half-edge is used exactly once.

### 5.2 Add this code:

```ts
interface RawFace {
  vertexIndices: number[];
  edgeIds: string[];
}

function walkFaces(nodes: GraphNode[]): RawFace[] {
  // Map each directed half-edge (fromIdx, neighborIndex) to unique id
  const visited = new Set<string>();
  const faces: RawFace[] = [];

  const halfEdgeKey = (from: number, neighborIdx: number) => `${from}:${neighborIdx}`;

  for (let from = 0; from < nodes.length; from++) {
    const node = nodes[from];
    for (let ni = 0; ni < node.neighbors.length; ni++) {
      const startKey = halfEdgeKey(from, ni);
      if (visited.has(startKey)) continue;

      const vertexIndices: number[] = [];
      const edgeIds: string[] = [];

      let curFrom = from;
      let curNeighborIdx = ni;
      let guard = 0;
      const maxSteps = nodes.length * 4 + 16;

      while (guard++ < maxSteps) {
        const key = halfEdgeKey(curFrom, curNeighborIdx);
        if (visited.has(key)) break;
        visited.add(key);

        const curNode = nodes[curFrom];
        const neighbor = curNode.neighbors[curNeighborIdx];
        vertexIndices.push(curFrom);
        edgeIds.push(neighbor.edgeId);

        // Move to neighbor.to
        const to = neighbor.to;
        const toNode = nodes[to];

        // Find index of curFrom in toNode.neighbors
        let backIdx = -1;
        for (let i = 0; i < toNode.neighbors.length; i++) {
          if (toNode.neighbors[i].to === curFrom) {
            backIdx = i;
            break;
          }
        }
        if (backIdx < 0) break;  // graph inconsistency; bail

        // Next half-edge: one clockwise from backIdx, i.e. (backIdx - 1 + n) % n
        const n = toNode.neighbors.length;
        const nextNeighborIdx = (backIdx - 1 + n) % n;

        curFrom = to;
        curNeighborIdx = nextNeighborIdx;

        if (curFrom === from && curNeighborIdx === ni) break;  // completed cycle
      }

      if (vertexIndices.length >= 3) {
        faces.push({ vertexIndices, edgeIds });
      }
    }
  }

  return faces;
}
```

### 5.3 Wire in and update TODO

After `buildGraph` call:

```ts
  // Step 5: walk faces
  const rawFaces = walkFaces(graph);
```

At the bottom, compute a debug return (temporarily) to verify walker runs:

```ts
  // Temporary phase-5 stub: return raw faces as PlanarFaces without filtering
  return rawFaces.map((face) => {
    const polygon = face.vertexIndices.map((idx) => ({ x: snap.vertices[idx].x, y: snap.vertices[idx].y }));
    return {
      polygon,
      area: Math.abs(polygonArea(polygon)),
      centroid: polygonCentroid(polygon),
      boundedByEdgeIds: Array.from(new Set(face.edgeIds)),
    };
  });
```

### 5.4 Add a test

```ts
// Phase 5: plus-sign produces faces
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  // Expected: 4 interior faces + 1 outer face = 5 total (outer face dropped in phase 6)
  assert.ok(faces.length >= 4 && faces.length <= 5, `phase 5 produces 4–5 faces, got ${faces.length}`);
  pass('phase-5: plus-sign produces faces (unfiltered)');
}
```

### CHECKPOINT 5

- [ ] `walkFaces` compiles and is called.
- [ ] Plus-sign test produces 4 or 5 faces.

Commit: `city-map: planar-faces phase 5 — face walk`

### IF-STUCK (Phase 5)

- **Walker infinite-loops** → `guard++ < maxSteps` should catch it; if exceeded, you have a graph consistency bug from Phase 4. Debug by logging `nodes` and check every `to` field points back.
- **Faces have fewer than 3 vertices** → your walker exits early. Check the "completed cycle" break condition.
- **Produces 0 faces** → graph has no cycles; check Phase 3 that the clip polygon was actually added (the clip boundary forms the outer cycle).

---

## Phase 6 — Drop outer face, filter, normalize

**Goal**: Produce the final `PlanarFace[]` with the outer face removed, small faces filtered, CCW winding, centroids inside `clip`.

### 6.1 Replace the final `return rawFaces.map(...)` with:

```ts
  // Step 6: drop outer face, filter, normalize
  const allFaces = rawFaces
    .map((face) => {
      const polygon = face.vertexIndices.map((idx) => ({ x: snap.vertices[idx].x, y: snap.vertices[idx].y }));
      const signedArea = polygonArea(polygon);
      const edgeIds = Array.from(new Set(face.edgeIds));
      return { polygon, signedArea, edgeIds };
    });

  if (allFaces.length === 0) return [];

  // Outer face: the one with negative signed area AND largest absolute area.
  // Standard planar embedding: interior faces are CCW (positive area), outer face is CW (negative).
  // But our input winding isn't guaranteed, so drop the one with largest |area| if it's negative.
  let outerIdx = -1;
  let outerAbs = -Infinity;
  for (let i = 0; i < allFaces.length; i++) {
    const abs = Math.abs(allFaces[i].signedArea);
    if (allFaces[i].signedArea < 0 && abs > outerAbs) {
      outerAbs = abs;
      outerIdx = i;
    }
  }
  // Fallback: if no negative-area face, drop the largest face regardless
  if (outerIdx < 0) {
    for (let i = 0; i < allFaces.length; i++) {
      const abs = Math.abs(allFaces[i].signedArea);
      if (abs > outerAbs) {
        outerAbs = abs;
        outerIdx = i;
      }
    }
  }

  const interiorFaces = allFaces.filter((_, i) => i !== outerIdx);

  const result: PlanarFace[] = [];
  for (const face of interiorFaces) {
    const abs = Math.abs(face.signedArea);
    if (abs < minFaceArea) continue;

    // Force CCW: if signedArea is negative, reverse polygon
    const polygon = face.signedArea < 0 ? face.polygon.slice().reverse() : face.polygon.slice();
    const centroid = polygonCentroid(polygon);

    // Safety net: centroid must be inside clip
    if (clip.length >= 3 && !pointInPolygon(centroid, clip as Point[])) continue;

    result.push({
      polygon,
      area: abs,
      centroid,
      boundedByEdgeIds: face.edgeIds,
    });
  }

  // Sort for determinism
  result.sort((a, b) => (a.centroid.y - b.centroid.y) || (a.centroid.x - b.centroid.x));

  return result;
```

**Remember** to remove the `// eslint-disable-next-line` on `minFaceArea` above, since you now use it.

### 6.2 Replace the tests with the real suite

Replace the whole contents of `__tests__/planar-faces.test.ts` with:

```ts
import { strict as assert } from 'node:assert';
import { extractPlanarFaces } from '../planar-faces';
import type { Point } from '../types';

const pass = (label: string) => console.log(`PASS: ${label}`);

const square = (s: number): Point[] => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

// Test 1: empty input → one face covering clip
{
  const faces = extractPlanarFaces([], square(100));
  assert.equal(faces.length, 1, 'empty input gives 1 face');
  assert.ok(Math.abs(faces[0].area - 10000) < 1, `expected area ≈ 10000, got ${faces[0].area}`);
  pass('empty input → 1 face');
}

// Test 2: one horizontal road splits square into 2 faces
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 2, `expected 2 faces, got ${faces.length}`);
  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  assert.ok(Math.abs(totalArea - 10000) < 2, `total area ≈ 10000, got ${totalArea}`);
  pass('horizontal road → 2 faces');
}

// Test 3: plus-sign → 4 faces
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(faces.length, 4, `expected 4 faces, got ${faces.length}`);
  for (const face of faces) {
    assert.ok(Math.abs(face.area - 2500) < 2, `each face ≈ 2500, got ${face.area}`);
  }
  pass('plus-sign → 4 faces');
}

// Test 4: dead-end road does not split the space
{
  const faces = extractPlanarFaces([
    { id: 'dead', points: [{ x: 20, y: 50 }, { x: 60, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 1, `dead-end gives 1 face, got ${faces.length}`);
  assert.ok(Math.abs(faces[0].area - 10000) < 5, `area ≈ 10000, got ${faces[0].area}`);
  pass('dead-end → 1 face');
}

// Test 5: T-intersection → 3 faces
{
  const faces = extractPlanarFaces([
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
    { id: 'stub', points: [{ x: 50, y: 50 }, { x: 100, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 3, `expected 3 faces, got ${faces.length}`);
  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  assert.ok(Math.abs(totalArea - 10000) < 5, `total area ≈ 10000, got ${totalArea}`);
  pass('T-intersection → 3 faces');
}

// Test 6: determinism
{
  const a = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  const b = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'deterministic');
  pass('determinism');
}

// Test 7: boundedByEdgeIds includes road ids
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  for (const face of faces) {
    assert.ok(face.boundedByEdgeIds.includes('h'), 'contains h');
    assert.ok(face.boundedByEdgeIds.includes('v'), 'contains v');
  }
  pass('boundedByEdgeIds includes road ids');
}
```

Run:

```bash
npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts
```

Expected: 7 `PASS:` lines, exit 0.

### CHECKPOINT 6

- [ ] All 7 unit tests pass.
- [ ] All four baseline tests from Phase 0 still pass.

Commit: `city-map: planar-faces phase 6 — final extractor`

### IF-STUCK (Phase 6)

- **Test 1 fails (empty input → 0 faces)** → the clip edge wasn't added in Phase 3. Re-check Step 2 of `extractPlanarFaces`.
- **Test 3 gives 3 or 5 faces instead of 4** → outer-face detection is buggy. Log `allFaces[i].signedArea` for each; exactly one should be negative-and-largest.
- **Test 4 gives 2 faces instead of 1** → your walker might be incorrectly stopping at the dead-end and starting a new face. A dead-end should be traversed in both directions as part of the same face. Debug by printing `face.vertexIndices` for the failing case.
- **Total area off by > 5** → centroid-inside-clip filter is dropping a legitimate face. Temporarily log which faces are dropped and why.

---

## Phase 7 — District adapter in `pm2001.ts`

**Goal**: Wrap `extractPlanarFaces` into a function with the same shape as `buildPM2001BlockFacesForDistrict`.

### 7.1 Open `services/playgame/city-map/pm2001.ts`.

Find the end of `buildPM2001BlockFacesForDistrict` (around line 329). Below it, add:

```ts
import { extractPlanarFaces, type PlanarEdge } from './planar-faces';
```

Wait — imports go at the **top** of the file. Scroll up and add this import with the other `./planar-faces`-style imports (line ~1 to ~10). Do not add imports mid-file.

### 7.2 At the bottom of `pm2001.ts`, add:

```ts
export function buildPlanarBlockFacesForDistrict(
  district: CityDistrict & Record<string, any>,
  roadEdges: readonly RoadEdge[],
): PM2001BlockFaceResult {
  const clip = (district.ownershipPolygons?.[0] || district.polygons?.[0]) as Point[] | undefined;
  if (!clip || clip.length < 3) {
    return { blocks: [], roadMask: [], rejectedFaces: [] };
  }

  const planarEdges: PlanarEdge[] = roadEdges
    .filter((edge) => {
      const centerline = edge.centerline && edge.centerline.length >= 2
        ? edge.centerline
        : [edge.a, edge.b];
      return centerline.some((point) => point && pointInPolygon(point, clip));
    })
    .map((edge) => ({
      id: edge.id,
      points: (edge.centerline && edge.centerline.length >= 2
        ? edge.centerline
        : [edge.a, edge.b])
        .filter(Boolean)
        .map((p) => ({ x: p.x, y: p.y })),
      roadEdgeId: edge.id,
    }))
    .filter((edge) => edge.points.length >= 2);

  const faces = extractPlanarFaces(planarEdges, clip, { snapEpsilon: 0.5, minFaceArea: 20 });

  const style = roadStyleForDistrict(district);
  const blocks = faces.map((face, index) => {
    const aspect = bboxAspect(face.polygon);
    const buildable = face.area >= style.minBlockArea && aspect <= style.maxBlockAspect;
    return {
      id: `${district.id}:planar-face:${index}`,
      districtId: district.id,
      landmassId: district.landmassId,
      polygon: face.polygon,
      path: polygonToPath(face.polygon),
      centroid: face.centroid,
      area: face.area,
      source: 'planar-face',
      boundedByRoadIds: face.boundedByEdgeIds.filter((id) => !id.startsWith('__clip__')),
      roadStyleId: style.id,
      fieldAngle: Number((district as any).fieldAngle ?? 0),
      buildable,
      density: face.area > 850 ? 'dense' : face.area > 360 ? 'medium' : 'sparse',
    } as CityBlock & Record<string, any>;
  });

  return { blocks, roadMask: [], rejectedFaces: [] };
}
```

### 7.3 Confirm `bboxAspect`, `pointInPolygon`, `polygonToPath`, `Point` are already imported in `pm2001.ts`.

Grep for each:

```bash
grep -n "bboxAspect\|pointInPolygon\|polygonToPath" services/playgame/city-map/pm2001.ts
```

If any of these is used in the new function but not already imported at the top of the file, add the missing import. Do not re-import something that's already there.

### 7.4 Build check

Run:

```bash
npx tsc --noEmit services/playgame/city-map/pm2001.ts
```

If this fails, fix the TypeScript error before moving on.

### CHECKPOINT 7

- [ ] `pm2001.ts` exports `buildPlanarBlockFacesForDistrict`.
- [ ] TypeScript compiles (no new errors).
- [ ] All previous tests still pass.
- [ ] `buildPM2001BlockFacesForDistrict` is untouched (diff only adds lines).

Commit: `city-map: add buildPlanarBlockFacesForDistrict adapter`

### IF-STUCK (Phase 7)

- **`PlanarEdge` type import complains** → confirm syntax: `import { extractPlanarFaces, type PlanarEdge } from './planar-faces';`. If your TypeScript version rejects this, use two imports: `import { extractPlanarFaces } from './planar-faces';` and `import type { PlanarEdge } from './planar-faces';`.
- **`roadStyleForDistrict` not defined** → it's defined earlier in the same file. You don't need to import it, just use it.

---

## Phase 8 — Wire the feature flag

**Goal**: Let callers opt into planar faces via `CityMapOptions.planarBlockFaces = true`.

### 8.1 Locate `CityMapOptions`

```bash
grep -rn "interface CityMapOptions" services/playgame/city-map/
```

Open the file it's in. It is probably in `city-v35.ts`.

### 8.2 Add the flag

Find the `export interface CityMapOptions { ... }` block. Add **exactly one line** before the closing `}`:

```ts
  planarBlockFaces?: boolean;
```

Do not reorder other fields. Do not add other fields.

### 8.3 Wire through `applyPM2001BlockFaces`

In `city-v35.ts`, find `applyPM2001BlockFaces`. The current signature looks like:

```ts
function applyPM2001BlockFaces(districts: ..., roadEdges: ..., rng: ...) { ... }
```

Change it to:

```ts
function applyPM2001BlockFaces(
  districts: ...,
  roadEdges: ...,
  rng: ...,
  usePlanar: boolean,
) { ... }
```

Inside the function, replace the line:

```ts
const result = buildPM2001BlockFacesForDistrict(district, roadEdges);
```

with:

```ts
const result = usePlanar
  ? buildPlanarBlockFacesForDistrict(district, roadEdges)
  : buildPM2001BlockFacesForDistrict(district, roadEdges);
```

Add to the imports at top of `city-v35.ts`:

```ts
import { buildPlanarBlockFacesForDistrict } from './pm2001';
```

(Likely there's already an import line for `./pm2001` — extend it.)

### 8.4 Pass the flag from `buildBaseCity`

Find the call to `applyPM2001BlockFaces` (around line 1645). Change:

```ts
applyPM2001BlockFaces(districts as Array<CityDistrict & Record<string, any>>, roadEdges, rng);
```

to:

```ts
applyPM2001BlockFaces(
  districts as Array<CityDistrict & Record<string, any>>,
  roadEdges,
  rng,
  options.planarBlockFaces === true,
);
```

Confirm `options` is in scope at this call site. If `applyPM2001BlockFaces` is called from a function that doesn't have `options`, you need to plumb `options` down to it. Do this by adding `options: CityMapOptions = {}` as a parameter.

### 8.5 Bump the cache key

Find the line in `buildCityV35`:

```ts
const key = `city-v35:${normalizedSeed}:${opts.cacheKey || 'default'}:${opts.roadBlockModel || 'legacy-bsp'}:${opts.pm2001Roads ? 'pm2001-roads' : 'legacy-roads'}`;
```

Append `:${opts.planarBlockFaces ? 'planar' : 'corridor'}`:

```ts
const key = `city-v35:${normalizedSeed}:${opts.cacheKey || 'default'}:${opts.roadBlockModel || 'legacy-bsp'}:${opts.pm2001Roads ? 'pm2001-roads' : 'legacy-roads'}:${opts.planarBlockFaces ? 'planar' : 'corridor'}`;
```

### 8.6 Re-exports in `index.ts`

Open `services/playgame/city-map/index.ts`. Add at the bottom:

```ts
export { extractPlanarFaces } from './planar-faces';
export type { PlanarEdge, PlanarFace, PlanarFaceOptions } from './planar-faces';
export { buildPlanarBlockFacesForDistrict } from './pm2001';
```

### CHECKPOINT 8

- [ ] `CityMapOptions` has `planarBlockFaces?: boolean`.
- [ ] `applyPM2001BlockFaces` branches on `usePlanar`.
- [ ] Cache key includes `planar|corridor` suffix.
- [ ] Re-exports added to `index.ts`.
- [ ] All baseline tests pass with flag **off** (byte-identical cache behavior).
- [ ] `npm run build` succeeds.

Commit: `city-map: wire planarBlockFaces flag into buildCityV35`

### IF-STUCK (Phase 8)

- **Test output differs from baseline when flag is off** → you accidentally changed the legacy path. Diff your `city-v35.ts` changes carefully; non-flag code should be unchanged.
- **`options` is undefined at the call site** → add `options: CityMapOptions = {}` as a parameter to the enclosing function.

---

## Phase 9 — Integration tests

**Goal**: Verify the flag-on path produces valid cities for multiple seeds.

### 9.1 Create `services/playgame/city-map/__tests__/planar-integration.test.ts`

```ts
import { strict as assert } from 'node:assert';
import { buildCityV35 } from '../index';
import { pointInPolygon, polygonArea } from '../geometry';

const pass = (label: string) => console.log(`PASS: ${label}`);

const seeds = ['planar-face-1', 'planar-face-2', 'city-map-unit-seed', 'new-game-city'];

for (const seed of seeds) {
  const legacy = buildCityV35(seed, { cache: false });
  const planar = buildCityV35(seed, { cache: false, planarBlockFaces: true });

  assert.equal(
    planar.districts.length,
    legacy.districts.length,
    `${seed}: district count matches`,
  );

  // Planar blocks' centroids should be inside district ownership
  for (const district of planar.districts) {
    const clip = district.ownershipPolygons?.[0];
    if (!clip) continue;
    for (const block of district.blocks || []) {
      if (!block.centroid) continue;
      assert.ok(
        pointInPolygon(block.centroid, clip),
        `${seed}/${block.id}: centroid inside district`,
      );
    }
  }

  // Block-coverage sanity: sum of block areas should be meaningful fraction of district area
  for (const district of planar.districts) {
    const clip = district.ownershipPolygons?.[0];
    if (!clip) continue;
    const clipArea = polygonArea(clip);
    const blockArea = (district.blocks || []).reduce((s, b) => s + (b.area ?? 0), 0);
    const coverage = blockArea / clipArea;
    assert.ok(
      coverage > 0.4 && coverage < 1.1,
      `${seed}/${district.id}: coverage ${coverage.toFixed(2)} outside [0.4, 1.1]`,
    );
  }

  // Determinism
  const again = buildCityV35(seed, { cache: false, planarBlockFaces: true });
  const key = (city: any) =>
    JSON.stringify(
      city.districts.map((d: any) => (d.blocks || []).map((b: any) => b.polygon)),
    );
  assert.equal(key(planar), key(again), `${seed}: deterministic`);

  pass(seed);
}
```

### 9.2 Run

```bash
npx tsx services/playgame/city-map/__tests__/planar-integration.test.ts
```

Expected: 4 `PASS:` lines, exit 0.

### CHECKPOINT 9 (final)

Every item must be true:

- [ ] `npx tsx services/playgame/city-map/__tests__/planar-faces.test.ts` → 7 PASS.
- [ ] `npx tsx services/playgame/city-map/__tests__/planar-integration.test.ts` → 4 PASS.
- [ ] `npx tsx services/playgame/city-map/__tests__/city-v35.test.ts` passes (unchanged baseline).
- [ ] `npx tsx services/playgame/city-map/__tests__/pm2001.test.ts` passes.
- [ ] `npx tsx services/playgame/city-map/__tests__/parcels.test.ts` passes.
- [ ] `npx tsx services/playgame/city-map/__tests__/render-metadata.test.ts` passes.
- [ ] `npm run build` passes.
- [ ] `buildCityV35(seed)` **without** the flag gives output whose `summarizeCityV35` is identical to pre-change baseline for at least one seed (you can verify by caching the summary before Phase 1 and diffing now).

Commit: `city-map: planar-faces integration tests`

---

## 10. You are done

At this point:

- Flag is **off by default**. Nothing in production behavior has changed.
- The new `planarBlockFaces: true` path exists and produces valid cities.
- A human can now A/B-test rendering with both paths and decide whether to promote the flag to default in a follow-up.

Leave the review notes in `docs/planar-blocks-notes.md` if you kept it; otherwise delete it.

---

## 11. Hard rules (re-read before every commit)

1. **Don't modify any file not in the File Plan.**
   - `planar-faces.ts` (new)
   - `__tests__/planar-faces.test.ts` (new)
   - `__tests__/planar-integration.test.ts` (new)
   - `pm2001.ts` (append only; do not touch existing functions)
   - `city-v35.ts` (narrow, surgical changes in Phase 8)
   - `index.ts` (append 3 lines)
   - `types.ts` (maybe, only if `CityMapOptions` is there, 1-line add)

2. **Don't delete or edit `buildPM2001BlockFacesForDistrict`.**

3. **Don't change default behavior.** `planarBlockFaces` defaults to `false`.

4. **Don't add npm dependencies.**

5. **Don't add UI toggles, debug overlays, or React components.**

6. **Don't touch**: `buildings.ts`, `parcels.ts`, `parcel-shapes.ts`, `planning.ts`, `venues.ts`, `routing.ts`, `bridges.ts`, `terrain.ts`, `land.ts`, `water.ts`, `polygon-boolean.ts`, `rng.ts`, `config.ts`, `urban-units.ts`.

7. **Don't make `extractPlanarFaces` async.**

If you want to violate any of these, stop and ask the human.

---

## 12. What to do when things go sideways

- **If Phase N fails its CHECKPOINT**: revert everything in Phase N (don't pile on fixes) and re-read the Phase N instructions. Try again carefully.
- **If two consecutive attempts at a CHECKPOINT fail**: leave a clear TODO and a summary of what you tried in `docs/planar-blocks-notes.md`, then stop. A human needs to look.
- **If a baseline test starts failing after you introduced a change**: `git diff` vs HEAD and identify which line you touched outside scope. Revert that specific change.
- **If you run out of time/context**: a partial delivery is fine. Everything is flag-gated. Even just Phases 1–6 (the extractor + unit tests) is useful standalone.

---

## 13. Appendix — Glossary

- **Planar face**: A bounded region of the plane defined by the cycles in a planar graph.
- **Half-edge**: One directed end of an edge `(u, v)`; the other half-edge is `(v, u)`.
- **Rightmost-turn walk**: Standard planar face traversal — at each vertex, pick the neighbor that is clockwise-next from the incoming direction.
- **Outer face**: The single unbounded face of a planar graph — excluded from our output.
- **CCW (counter-clockwise)**: The standard winding for filled polygons; `polygonArea` returns a positive value for CCW polygons.
- **Clip polygon**: The boundary polygon we intersect faces against; for a district, it's `district.ownershipPolygons[0]`.

---

*End of spec. If you've followed every phase and hit every checkpoint, the integration is done.*
