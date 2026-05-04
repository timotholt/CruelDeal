import { pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import type { BlockFrontageAnalysis, BlockUseTag, DistrictLandUseRole, RoadClass, RoadHazard } from './planning';
import type { CityBlock, Point, TerrainPlan } from './types';

export type ParcelShapeFamily =
  | 'rectangle'
  | 'rotated_rectangle'
  | 'parallelogram'
  | 'skewed_quad'
  | 'angled_frontage_quad'
  | 'irregular_quad'
  | 'long_strip'
  | 'triangle'
  | 'wedge'
  | 'trapezoid'
  | 'l_shape'
  | 't_shape'
  | 'courtyard_candidate'
  | 'curved_frontage'
  | 'crescent'
  | 'bulged_rectangle'
  | 'pinched_irregular'
  | 'organic_blob'
  | 'sliver'
  | 'tiny'
  | 'unclassified';

export type ParcelOrientation =
  | 'horizontal'
  | 'vertical'
  | 'diagonal_ne'
  | 'diagonal_nw'
  | 'diagonal_se'
  | 'diagonal_sw'
  | 'rotated'
  | 'curved'
  | 'unknown';

export type TriangleOrientation =
  | 'point_north'
  | 'point_south'
  | 'point_east'
  | 'point_west'
  | 'point_ne'
  | 'point_nw'
  | 'point_se'
  | 'point_sw'
  | 'flat_top'
  | 'flat_bottom'
  | 'flat_left'
  | 'flat_right'
  | 'valuable_long_side'
  | 'valuable_short_side'
  | 'valuable_apex'
  | 'unknown';

export type LayoutTemplateHint =
  | 'frontage_band'
  | 'rotated_frontage_band'
  | 'angled_quad_frontage_band'
  | 'curved_frontage_band'
  | 'diagonal_frontage_band'
  | 'flat_ladder'
  | 'corner_fan'
  | 'single_iconic_pad'
  | 'rear_service_yard'
  | 'rear_plaza'
  | 'parking_field'
  | 'courtyard'
  | 'split_lobes'
  | 'absorb_sliver_as_open'
  | 'fallback_park';

export interface OrientedBounds {
  center: Point;
  axisU: Point;
  axisV: Point;
  width: number;
  depth: number;
  angle: number;
  corners: Point[];
  area: number;
  fit: number;
}

export interface ShapeVertex {
  id: string;
  point: Point;
  angle: number;
  isConcave: boolean;
  isApex: boolean;
}

export interface ShapeSide {
  id: string;
  points: Point[];
  chordStart: Point;
  chordEnd: Point;
  midpoint: Point;
  length: number;
  chordLength: number;
  curvature: number;
  angle: number;
  normalInward: Point;
  kind: 'straight' | 'slightly_curved' | 'curved' | 'corner_cluster' | 'tiny_sliver_edge';
  orientation:
    | 'north'
    | 'south'
    | 'east'
    | 'west'
    | 'diagonal_ne'
    | 'diagonal_nw'
    | 'diagonal_se'
    | 'diagonal_sw'
    | 'curved'
    | 'unknown';
  adjacentRoadIds: string[];
  adjacentRoadClass?: RoadClass;
  frontageValue: number;
  isPrimaryFrontage: boolean;
  isSecondaryFrontage: boolean;
  isCheapBackSide: boolean;
  isWaterfront: boolean;
  isServiceSide: boolean;
}

export interface AwkwardRemainder {
  id: string;
  kind:
    | 'rear_triangle'
    | 'side_sliver'
    | 'corner_sliver'
    | 'bulge'
    | 'pinch'
    | 'concave_bite'
    | 'curved_margin'
    | 'unknown';
  polygon: Point[];
  area: number;
  usableForBuilding: boolean;
  recommendedUse: 'park' | 'plaza' | 'parking' | 'service_yard' | 'utility' | 'landscape' | 'secondary_building' | 'discard';
  reason: string;
}

export interface ParcelShapeClassification {
  family: ParcelShapeFamily;
  orientation: ParcelOrientation;
  triangleOrientation?: TriangleOrientation;
  sideCount: number;
  sideKinds: ShapeSide['kind'][];
  cornerAngles: number[];
  area: number;
  perimeter: number;
  compactness: number;
  aspectRatio: number;
  rectangularity: number;
  convexity: number;
  concavity: number;
  thinness: number;
  curvature: number;
  primaryAxisAngle: number;
  secondaryAxisAngle: number;
  orientedBounds: OrientedBounds;
  vertices: ShapeVertex[];
  sides: ShapeSide[];
  longestSideId?: string;
  shortestSideId?: string;
  flattestSideId?: string;
  mostCurvedSideId?: string;
  primaryFrontageSideId?: string;
  cheapBackSideId?: string;
  usableCore?: Point[];
  awkwardRemainders: AwkwardRemainder[];
  infrastructurePressure: number;
  waterfrontPressure: number;
  buildabilityScore: number;
  templateHints: LayoutTemplateHint[];
  confidence: number;
  reasons: string[];
  fallbackReason?: string;
}

export interface ParcelShapeClassificationContext {
  frontageAnalysis?: BlockFrontageAnalysis | null;
  roadHazards?: RoadHazard[] | null;
  terrain?: TerrainPlan | null;
}

const EPS = 1e-6;
const MIN_TINY_AREA = 42;
const MIN_TINY_DIM = 3.2;
const SLIVER_ASPECT = 7.5;
const SLIVER_THINNESS = 0.12;

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalizeAngle(angle: number) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function angleDelta(a: number, b: number) {
  return Math.abs(normalizeAngle(a - b));
}

function axisDelta(a: number, b: number) {
  const d = angleDelta(a, b);
  return Math.min(d, Math.abs(Math.PI - d));
}

function orientationForAngle(angle: number): ParcelOrientation {
  const deg = ((angle * 180 / Math.PI) % 180 + 180) % 180;
  if (deg < 15 || deg > 165) return 'horizontal';
  if (deg > 75 && deg < 105) return 'vertical';
  if (deg >= 15 && deg <= 75) return 'diagonal_ne';
  if (deg >= 105 && deg <= 165) return 'diagonal_nw';
  return 'rotated';
}

function sideOrientationForAngle(angle: number): ShapeSide['orientation'] {
  const deg = ((angle * 180 / Math.PI) % 360 + 360) % 360;
  if (deg < 22.5 || deg >= 337.5 || (deg >= 157.5 && deg < 202.5)) return 'east';
  if ((deg >= 67.5 && deg < 112.5) || (deg >= 247.5 && deg < 292.5)) return 'north';
  if ((deg >= 22.5 && deg < 67.5) || (deg >= 202.5 && deg < 247.5)) return 'diagonal_ne';
  if ((deg >= 112.5 && deg < 157.5) || (deg >= 292.5 && deg < 337.5)) return 'diagonal_nw';
  return 'unknown';
}

function isNearRightAngle(a: ShapeSide, b: ShapeSide) {
  return Math.abs(axisDelta(a.angle, b.angle) - Math.PI / 2) < 0.22;
}

function isNearParallel(a: ShapeSide, b: ShapeSide) {
  return axisDelta(a.angle, b.angle) < 0.18;
}

function fourSideFamily(
  sides: ShapeSide[],
  cornerAngles: number[],
  rectangularity: number,
  convexity: number,
  orientation: ParcelOrientation,
): { family: ParcelShapeFamily; confidence: number; reason: string } | null {
  if (sides.length !== 4 || convexity < 0.86) return null;
  const [s0, s1, s2, s3] = sides;
  const opposite02 = isNearParallel(s0, s2);
  const opposite13 = isNearParallel(s1, s3);
  const rightCorners = cornerAngles.filter((angle) => Math.abs(angle - 90) < 13).length;
  const strictRightCorners = cornerAngles.filter((angle) => Math.abs(angle - 90) <= 0.75).length;
  const strictOpposite02 = axisDelta(s0.angle, s2.angle) < 0.015;
  const strictOpposite13 = axisDelta(s1.angle, s3.angle) < 0.015;
  const primary = sides.find((side) => side.isPrimaryFrontage) || [...sides].sort((a, b) => b.frontageValue - a.frontageValue)[0];
  const primaryIndex = Math.max(0, sides.findIndex((side) => side.id === primary?.id));
  const primaryOpposite = sides[(primaryIndex + 2) % 4];
  const primaryParallelToBack = primary && primaryOpposite ? isNearParallel(primary, primaryOpposite) : false;
  const primaryPerpCorners = primary
    ? isNearRightAngle(sides[(primaryIndex + 3) % 4], primary) && isNearRightAngle(primary, sides[(primaryIndex + 1) % 4])
    : false;

  if (strictOpposite02 && strictOpposite13 && strictRightCorners >= 4 && rectangularity > 0.82) {
    const family: ParcelShapeFamily = orientation === 'horizontal' || orientation === 'vertical' ? 'rectangle' : 'rotated_rectangle';
    return { family, confidence: 0.92, reason: family === 'rectangle' ? 'four sides with strict parallel opposites and near-90 corners' : 'rotated four-sided rectangle with strict near-90 corners' };
  }
  if (opposite02 && opposite13 && rectangularity > 0.78) {
    return { family: 'parallelogram', confidence: 0.84, reason: 'four sides with parallel opposites but skewed corners' };
  }
  if ((opposite02 || opposite13) && rightCorners >= 2 && primary && !primaryPerpCorners) {
    return { family: 'angled_frontage_quad', confidence: 0.82, reason: 'four-sided parcel with angled primary frontage' };
  }
  if ((opposite02 || opposite13) && rectangularity > 0.62) {
    return { family: 'trapezoid', confidence: 0.76, reason: 'four sides with one mostly parallel side pair' };
  }
  if (rectangularity > 0.72 && primary && !primaryParallelToBack) {
    return { family: 'skewed_quad', confidence: 0.72, reason: 'high-fit quadrilateral with nonparallel frontage/back' };
  }
  return { family: 'irregular_quad', confidence: 0.62, reason: 'four dominant sides without a stable rectangle relation' };
}

function signedArea(points: readonly Point[]) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function simplifyPolygon(points: readonly Point[]) {
  const cleaned: Point[] = [];
  for (const p of points) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || dist(prev, p) > 0.05) cleaned.push({ x: p.x, y: p.y });
  }
  if (cleaned.length > 1 && dist(cleaned[0], cleaned[cleaned.length - 1]) < 0.05) cleaned.pop();
  if (cleaned.length < 4) return cleaned;

  let changed = true;
  let current = cleaned;
  while (changed && current.length > 3) {
    changed = false;
    const next: Point[] = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[(i - 1 + current.length) % current.length];
      const b = current[i];
      const c = current[(i + 1) % current.length];
      const ab = dist(a, b);
      const bc = dist(b, c);
      if (ab < 0.18 || bc < 0.18) {
        changed = true;
        continue;
      }
      const turn = axisDelta(Math.atan2(b.y - a.y, b.x - a.x), Math.atan2(c.y - b.y, c.x - b.x));
      if (turn < 0.035 && ab + bc < 18) {
        changed = true;
        continue;
      }
      next.push(b);
    }
    if (next.length < 3 || next.length === current.length) break;
    current = next;
  }
  return current;
}

function perimeter(points: readonly Point[]) {
  return points.reduce((sum, p, i) => sum + dist(p, points[(i + 1) % points.length]), 0);
}

function convexHull(points: readonly Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  if (sorted.length <= 3) return sorted;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function orientedBoundsForAngle(points: readonly Point[], angle: number, area: number): OrientedBounds {
  const axisU = { x: Math.cos(angle), y: Math.sin(angle) };
  const axisV = { x: -axisU.y, y: axisU.x };
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of points) {
    const u = p.x * axisU.x + p.y * axisU.y;
    const v = p.x * axisV.x + p.y * axisV.y;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const width = Math.max(0, maxU - minU);
  const depth = Math.max(0, maxV - minV);
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  const fromUv = (u: number, v: number): Point => ({
    x: axisU.x * u + axisV.x * v,
    y: axisU.y * u + axisV.y * v,
  });
  const boundsArea = Math.max(EPS, width * depth);
  return {
    center: fromUv(centerU, centerV),
    axisU,
    axisV,
    width,
    depth,
    angle,
    corners: [
      fromUv(minU, minV),
      fromUv(maxU, minV),
      fromUv(maxU, maxV),
      fromUv(minU, maxV),
    ],
    area: boundsArea,
    fit: Math.max(0, Math.min(1, area / boundsArea)),
  };
}

function bestOrientedBounds(points: readonly Point[], area: number): OrientedBounds {
  const angles = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = dist(a, b);
    if (len > 0.2) angles.add(normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x)));
  }
  angles.add(0);
  angles.add(Math.PI / 2);
  let best: OrientedBounds | null = null;
  for (const angle of angles) {
    const bounds = orientedBoundsForAngle(points, angle, area);
    if (!best || bounds.area < best.area) best = bounds;
  }
  return best || orientedBoundsForAngle(points, 0, area);
}

function buildVertices(points: readonly Point[]) {
  const winding = signedArea(points) >= 0 ? 1 : -1;
  return points.map((point, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const v1 = { x: prev.x - point.x, y: prev.y - point.y };
    const v2 = { x: next.x - point.x, y: next.y - point.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag = Math.max(EPS, Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    const angle = Math.acos(Math.max(-1, Math.min(1, dot / mag)));
    const cross = (next.x - point.x) * (prev.y - point.y) - (next.y - point.y) * (prev.x - point.x);
    return {
      id: `v${i}`,
      point,
      angle,
      isConcave: cross * winding > 0,
      isApex: false,
    };
  });
}

function cornerAnglesForSides(sides: ShapeSide[]) {
  if (sides.length < 3) return [];
  return sides.map((side, index) => {
    const next = sides[(index + 1) % sides.length];
    const deg = axisDelta(side.angle, next.angle) * 180 / Math.PI;
    return Math.round(Math.min(deg, 180 - deg) * 10) / 10;
  });
}

function groupSides(points: readonly Point[], centroid: Point, frontage?: BlockFrontageAnalysis | null): ShapeSide[] {
  if (points.length < 3) return [];
  const raw = points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    const length = dist(a, b);
    return { a, b, length, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }).filter((edge) => edge.length > 0.05);

  const groups: Array<{ points: Point[]; length: number; weightedAngle: number; edges: typeof raw }> = [];
  for (const edge of raw) {
    const last = groups[groups.length - 1];
    if (last && axisDelta(last.weightedAngle, edge.angle) < 0.18) {
      last.points.push(edge.b);
      last.length += edge.length;
      last.weightedAngle = Math.atan2(
        Math.sin(last.weightedAngle) * (last.length - edge.length) + Math.sin(edge.angle) * edge.length,
        Math.cos(last.weightedAngle) * (last.length - edge.length) + Math.cos(edge.angle) * edge.length,
      );
      last.edges.push(edge);
    } else {
      groups.push({ points: [edge.a, edge.b], length: edge.length, weightedAngle: edge.angle, edges: [edge] });
    }
  }
  if (groups.length > 1 && axisDelta(groups[0].weightedAngle, groups[groups.length - 1].weightedAngle) < 0.18) {
    const first = groups.shift()!;
    const last = groups[groups.length - 1];
    last.points.push(...first.points.slice(1));
    last.length += first.length;
    last.edges.push(...first.edges);
  }

  const primaryRoadIds = new Set(frontage?.primary?.roadIds || []);
  return groups.map((group, index) => {
    const chordStart = group.points[0];
    const chordEnd = group.points[group.points.length - 1];
    const chordLength = dist(chordStart, chordEnd);
    const length = group.edges.reduce((sum, edge) => sum + edge.length, 0);
    const midpoint = {
      x: group.points.reduce((sum, p) => sum + p.x, 0) / group.points.length,
      y: group.points.reduce((sum, p) => sum + p.y, 0) / group.points.length,
    };
    const angle = Math.atan2(chordEnd.y - chordStart.y, chordEnd.x - chordStart.x);
    const n1 = { x: -Math.sin(angle), y: Math.cos(angle) };
    const toCenter = { x: centroid.x - midpoint.x, y: centroid.y - midpoint.y };
    const normalInward = n1.x * toCenter.x + n1.y * toCenter.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
    const curvature = chordLength > 0 ? Math.max(0, length / chordLength - 1) : 0;
    const kind: ShapeSide['kind'] = length < 1.2
      ? 'tiny_sliver_edge'
      : curvature > 0.12
        ? 'curved'
        : curvature > 0.03
          ? 'slightly_curved'
          : group.edges.length <= 2 ? 'straight' : 'corner_cluster';
    const frontageEdges = frontage?.edges.filter((edge) =>
      pointToSegmentDist(edge.a.x, edge.a.y, chordStart, chordEnd) < edge.buffer + 3
      || pointToSegmentDist(edge.b.x, edge.b.y, chordStart, chordEnd) < edge.buffer + 3
      || pointToSegmentDist(midpoint.x, midpoint.y, edge.a, edge.b) < edge.buffer + 4,
    ) || [];
    const adjacentRoadIds = Array.from(new Set(frontageEdges.map((edge) => edge.roadId)));
    const frontageValue = frontageEdges.reduce((sum, edge) => sum + edge.score, 0);
    const isPrimaryFrontage = adjacentRoadIds.some((id) => primaryRoadIds.has(id));
    const adjacentRoadClass = frontageEdges.sort((a, b) => b.valueWeight - a.valueWeight)[0]?.roadClass;
    return {
      id: `side:${index}`,
      points: group.points,
      chordStart,
      chordEnd,
      midpoint,
      length,
      chordLength,
      curvature,
      angle,
      normalInward,
      kind,
      orientation: kind === 'curved' ? 'curved' : sideOrientationForAngle(angle),
      adjacentRoadIds,
      adjacentRoadClass,
      frontageValue,
      isPrimaryFrontage,
      isSecondaryFrontage: adjacentRoadIds.length > 0 && !isPrimaryFrontage,
      isCheapBackSide: adjacentRoadIds.length === 0 || adjacentRoadClass === 'SERVICE' || adjacentRoadClass === 'ALLEY',
      isWaterfront: frontageEdges.some((edge) => edge.source === 'coast' || edge.source === 'water'),
      isServiceSide: adjacentRoadClass === 'SERVICE' || adjacentRoadClass === 'ALLEY',
    };
  });
}

function triangleOrientation(points: readonly Point[], sides: ShapeSide[], primarySideId?: string): TriangleOrientation {
  if (points.length < 3 || sides.length < 3) return 'unknown';
  const longest = [...sides].sort((a, b) => b.length - a.length)[0];
  const apex = points.reduce((best, p) => {
    const d = pointToSegmentDist(p.x, p.y, longest.chordStart, longest.chordEnd);
    return d > best.d ? { p, d } : best;
  }, { p: points[0], d: -Infinity }).p;
  const center = polygonCentroid(points);
  const dx = apex.x - center.x;
  const dy = apex.y - center.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (primarySideId && primarySideId === longest.id) return 'valuable_long_side';
  if (absX > absY * 1.8) return dx > 0 ? 'point_east' : 'point_west';
  if (absY > absX * 1.8) return dy > 0 ? 'point_south' : 'point_north';
  if (dx >= 0 && dy < 0) return 'point_ne';
  if (dx < 0 && dy < 0) return 'point_nw';
  if (dx >= 0 && dy >= 0) return 'point_se';
  return 'point_sw';
}

function templateHintsForFamily(family: ParcelShapeFamily, primaryCurved: boolean): LayoutTemplateHint[] {
  switch (family) {
    case 'rectangle':
      return ['frontage_band', 'rear_service_yard'];
    case 'rotated_rectangle':
      return ['rotated_frontage_band', 'rear_service_yard'];
    case 'parallelogram':
    case 'skewed_quad':
    case 'angled_frontage_quad':
      return ['angled_quad_frontage_band', 'rear_service_yard'];
    case 'irregular_quad':
      return ['angled_quad_frontage_band', 'absorb_sliver_as_open'];
    case 'long_strip':
      return primaryCurved ? ['curved_frontage_band', 'parking_field'] : ['frontage_band', 'rear_service_yard'];
    case 'triangle':
      return ['diagonal_frontage_band', 'flat_ladder', 'absorb_sliver_as_open'];
    case 'wedge':
      return ['single_iconic_pad', 'corner_fan', 'absorb_sliver_as_open'];
    case 'trapezoid':
      return ['angled_quad_frontage_band', 'flat_ladder', 'rear_service_yard'];
    case 'curved_frontage':
      return ['curved_frontage_band', 'rear_plaza'];
    case 'crescent':
      return ['curved_frontage_band', 'courtyard'];
    case 'bulged_rectangle':
      return ['frontage_band', 'rear_plaza'];
    case 'pinched_irregular':
      return ['split_lobes', 'rear_plaza'];
    case 'l_shape':
    case 't_shape':
    case 'courtyard_candidate':
      return ['courtyard', 'rear_service_yard'];
    case 'tiny':
    case 'sliver':
    case 'unclassified':
      return ['fallback_park', 'absorb_sliver_as_open'];
    default:
      return ['fallback_park'];
  }
}

export function fallbackUseForUnclassifiedParcel(input: {
  shape: ParcelShapeClassification;
  districtRole?: DistrictLandUseRole;
}): BlockUseTag | null {
  const { shape, districtRole } = input;
  if (shape.family === 'tiny' || shape.family === 'sliver') {
    return shape.infrastructurePressure > 0.55 || districtRole === 'backland_edge' ? 'infrastructure_service' : 'park_open';
  }
  if (shape.family === 'unclassified' && shape.confidence < 0.45) {
    return shape.infrastructurePressure > 0.65 ? 'infrastructure_service' : 'park_open';
  }
  return null;
}

export function classifyParcelShape(
  block: CityBlock & Record<string, any>,
  context: ParcelShapeClassificationContext = {},
): ParcelShapeClassification {
  const original = block.polygon || [];
  const simplified = simplifyPolygon(original);
  const area = polygonArea(original);
  const centroid = block.centroid || polygonCentroid(original);
  const perim = perimeter(original);
  const hull = convexHull(original);
  const hullArea = Math.max(EPS, polygonArea(hull));
  const convexity = Math.max(0, Math.min(1, area / hullArea));
  const concavity = 1 - convexity;
  const bounds = bestOrientedBounds(simplified.length >= 3 ? simplified : original, area);
  const longDim = Math.max(bounds.width, bounds.depth);
  const shortDim = Math.max(EPS, Math.min(bounds.width, bounds.depth));
  const aspectRatio = longDim / shortDim;
  const rectangularity = bounds.fit;
  const compactness = perim > 0 ? Math.max(0, Math.min(1, (4 * Math.PI * area) / (perim * perim))) : 0;
  const thinness = shortDim / Math.max(EPS, longDim);
  const sides = groupSides(simplified.length >= 3 ? simplified : original, centroid, context.frontageAnalysis);
  const sideKinds = sides.map((side) => side.kind);
  const cornerAngles = cornerAnglesForSides(sides);
  const vertices = buildVertices(simplified.length >= 3 ? simplified : original);
  const sortedSides = [...sides].sort((a, b) => b.length - a.length);
  const longestSide = sortedSides[0];
  const shortestSide = [...sides].sort((a, b) => a.length - b.length)[0];
  const flattestSide = [...sides].sort((a, b) => a.curvature - b.curvature)[0];
  const mostCurvedSide = [...sides].sort((a, b) => b.curvature - a.curvature)[0];
  const primarySide = sides.find((side) => side.isPrimaryFrontage) || sides.sort((a, b) => b.frontageValue - a.frontageValue)[0];
  const cheapSide = sides.filter((side) => side.id !== primarySide?.id).sort((a, b) => a.frontageValue - b.frontageValue)[0];
  const sideCurvature = sides.length ? sides.reduce((sum, side) => sum + side.curvature * side.length, 0) / Math.max(EPS, sides.reduce((sum, side) => sum + side.length, 0)) : 0;
  const infrastructurePressure = sides.some((side) => side.adjacentRoadClass === 'SERVICE' || side.adjacentRoadClass === 'ALLEY')
    ? 0.58
    : context.frontageAnalysis?.primary?.roadClass === 'HIGHWAY' && aspectRatio > 5 ? 0.48 : 0;
  const waterfrontPressure = sides.some((side) => side.isWaterfront) ? 0.85 : 0;

  let family: ParcelShapeFamily = 'organic_blob';
  let confidence = 0.58;
  const reasons: string[] = [];

  if (area < MIN_TINY_AREA || shortDim < MIN_TINY_DIM) {
    family = 'tiny';
    confidence = 0.92;
    reasons.push('area or minimum dimension below buildable threshold');
  } else if (aspectRatio > SLIVER_ASPECT || thinness < SLIVER_THINNESS) {
    family = 'sliver';
    confidence = 0.9;
    reasons.push('extreme aspect ratio or thinness');
  } else if (sides.length === 3 && convexity > 0.9) {
    family = 'triangle';
    confidence = 0.84;
    reasons.push('three dominant sides');
  } else if (sides.length === 4 && shortestSide && longestSide && shortestSide.length < longestSide.length * 0.22 && convexity > 0.86) {
    family = 'wedge';
    confidence = 0.78;
    reasons.push('four sides with one tiny clipped edge');
  } else if (sides.length === 4) {
    const quad = fourSideFamily(sides, cornerAngles, rectangularity, convexity, orientationForAngle(bounds.angle));
    family = quad?.family || 'irregular_quad';
    confidence = quad?.confidence || 0.56;
    reasons.push(quad?.reason || 'four dominant sides');
  } else if (sides.length > 4 && sides.length <= 6 && rectangularity > 0.82 && convexity > 0.9) {
    family = aspectRatio > 3 ? 'long_strip' : 'bulged_rectangle';
    confidence = Math.min(0.82, 0.56 + rectangularity * 0.18 + convexity * 0.08);
    reasons.push(`${sides.length} sides with high rectangle core fit`);
  } else if (mostCurvedSide && mostCurvedSide.curvature > 0.12 && primarySide?.id === mostCurvedSide.id) {
    family = aspectRatio > 2.4 ? 'crescent' : 'curved_frontage';
    confidence = 0.74;
    reasons.push('primary frontage side is curved');
  } else if (concavity > 0.16 && aspectRatio < 3.5) {
    family = vertices.filter((vertex) => vertex.isConcave).length >= 2 ? 'l_shape' : 'pinched_irregular';
    confidence = 0.62;
    reasons.push('concave parcel outline');
  } else if (rectangularity > 0.66 && convexity > 0.82 && mostCurvedSide && mostCurvedSide.curvature > 0.05) {
    family = 'bulged_rectangle';
    confidence = 0.65;
    reasons.push('rectangular core with curved or bulged margin');
  } else if (sides.length < 3 || area <= EPS || !Number.isFinite(rectangularity)) {
    family = 'unclassified';
    confidence = 0.2;
    reasons.push('unstable polygon metrics');
  } else {
    family = 'organic_blob';
    confidence = 0.52;
    reasons.push('no simple shape family dominated');
  }

  const orientation = family === 'curved_frontage' || family === 'crescent'
    ? 'curved'
    : orientationForAngle(bounds.angle);
  const triangle = family === 'triangle' || family === 'wedge'
    ? triangleOrientation(simplified, sides, primarySide?.id)
    : undefined;
  const fallbackUse = fallbackUseForUnclassifiedParcel({ shape: {
    family,
    orientation,
    triangleOrientation: triangle,
    sideCount: sides.length,
    sideKinds,
    cornerAngles,
    area,
    perimeter: perim,
    compactness,
    aspectRatio,
    rectangularity,
    convexity,
    concavity,
    thinness,
    curvature: sideCurvature,
    primaryAxisAngle: bounds.angle,
    secondaryAxisAngle: bounds.angle + Math.PI / 2,
    orientedBounds: bounds,
    vertices,
    sides,
    longestSideId: longestSide?.id,
    shortestSideId: shortestSide?.id,
    flattestSideId: flattestSide?.id,
    mostCurvedSideId: mostCurvedSide?.id,
    primaryFrontageSideId: primarySide?.id,
    cheapBackSideId: cheapSide?.id,
    awkwardRemainders: [],
    infrastructurePressure,
    waterfrontPressure,
    buildabilityScore: 0,
    templateHints: [],
    confidence,
    reasons,
  }, districtRole: undefined });
  const fallbackReason = fallbackUse
    ? family === 'unclassified' ? 'unclassified-low-confidence-park' : `${family}-absorbed-as-${fallbackUse}`
    : undefined;
  const buildabilityScore = Math.max(0, Math.min(1,
    confidence * 0.45
    + convexity * 0.2
    + rectangularity * 0.12
    + Math.min(1, shortDim / 8) * 0.18
    - (family === 'tiny' || family === 'sliver' || family === 'unclassified' ? 0.28 : 0),
  ));
  const primaryCurved = primarySide?.kind === 'curved' || primarySide?.kind === 'slightly_curved';

  if (fallbackReason) reasons.push(fallbackReason);

  return {
    family,
    orientation,
    triangleOrientation: triangle,
    sideCount: sides.length,
    sideKinds,
    cornerAngles,
    area,
    perimeter: perim,
    compactness,
    aspectRatio,
    rectangularity,
    convexity,
    concavity,
    thinness,
    curvature: sideCurvature,
    primaryAxisAngle: bounds.angle,
    secondaryAxisAngle: bounds.angle + Math.PI / 2,
    orientedBounds: bounds,
    vertices,
    sides,
    longestSideId: longestSide?.id,
    shortestSideId: shortestSide?.id,
    flattestSideId: flattestSide?.id,
    mostCurvedSideId: mostCurvedSide?.id,
    primaryFrontageSideId: primarySide?.id,
    cheapBackSideId: cheapSide?.id,
    usableCore: family === 'tiny' || family === 'sliver' ? undefined : bounds.corners,
    awkwardRemainders: [],
    infrastructurePressure,
    waterfrontPressure,
    buildabilityScore,
    templateHints: templateHintsForFamily(family, primaryCurved),
    confidence,
    reasons: reasons.slice(0, 4),
    fallbackReason,
  };
}
