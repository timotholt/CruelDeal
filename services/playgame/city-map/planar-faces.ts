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

  // Step 4: build planar graph
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const graph = buildGraph(snap.vertices, atomicSegments);

  // TODO(phase-5): walk faces
  // TODO(phase-6): drop outer face, filter, normalize

  return [];
}
