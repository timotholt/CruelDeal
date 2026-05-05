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

export function extractPlanarFaces(
  edges: ReadonlyArray<PlanarEdge>,
  clip: ReadonlyArray<Point>,
  options: PlanarFaceOptions = {},
): PlanarFace[] {
  const snapEpsilon = options.snapEpsilon ?? DEFAULT_SNAP_EPSILON;
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
  const atomicSegments = splitAtIntersections(rawSegments, snap.vertices, snapEpsilon);

  // Step 4: build planar graph
  const graph = buildGraph(snap.vertices, atomicSegments);

  // Step 5: walk faces
  const rawFaces = walkFaces(graph);

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
    // Force CCW: if signedArea is negative, reverse polygon
    const polygon = face.signedArea < 0 ? face.polygon.slice().reverse() : face.polygon.slice();
    const centroid = polygonCentroid(polygon);

    // Safety net: centroid must be inside clip
    if (clip.length >= 3 && !pointInPolygon(centroid, clip as Point[])) continue;

    result.push({
      polygon,
      area: Math.abs(face.signedArea),
      centroid,
      boundedByEdgeIds: face.edgeIds,
    });
  }

  // Sort for determinism
  result.sort((a, b) => (a.centroid.y - b.centroid.y) || (a.centroid.x - b.centroid.x));

  return result;
}
