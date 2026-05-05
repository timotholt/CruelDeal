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
