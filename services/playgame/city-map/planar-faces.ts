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
