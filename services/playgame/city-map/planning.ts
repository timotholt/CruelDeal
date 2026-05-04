import { pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import { fallbackUseForUnclassifiedParcel, type LayoutTemplateHint, type ParcelOrientation, type ParcelShapeFamily, type TriangleOrientation } from './parcel-shapes';
import type { CityBlock, Point, RoadEdge } from './types';

type Rng = () => number;

export const GLOBAL_COMMERCIAL_PARCEL_GAP = 0.22;
export const GLOBAL_COMMERCIAL_SETBACK = GLOBAL_COMMERCIAL_PARCEL_GAP;

export type RoadClass = 'HIGHWAY' | 'MAJOR_ROAD' | 'MINOR_ROAD' | 'ALLEY' | 'SERVICE';
export type BlockAgeTag = 'old' | 'average' | 'new';
export type BlockUseTag =
  | 'residential'
  | 'commercial_retail'
  | 'commercial_office'
  | 'hospitality'
  | 'industrial'
  | 'civic_public'
  | 'park_open'
  | 'infrastructure_service'
  | 'landmark'
  | 'mixed_use';
export type DistrictLandUseRole =
  | 'old_core'
  | 'waterfront'
  | 'highway_corridor'
  | 'interior_grid'
  | 'backland_edge'
  | 'civic_center'
  | 'commercial_core';
export type SubdivisionFlavor =
  | 'iconic-edge-structure'
  | 'frontage-strip-subdivision'
  | 'skinny-tenant-frontage'
  | 'rectangular-backbone'
  | 'courtyard-park-insert'
  | 'hodgepodge-accretion';

export interface RoadValue {
  roadId: string;
  roadClass: RoadClass;
  weight: number;
  renderWidth: number;
  kind?: string;
  source?: string;
}

export interface RoadHazard {
  roadId: string;
  roadClass: RoadClass;
  valueWeight: number;
  a: Point;
  b: Point;
  buffer: number;
  priority: number;
  width: number;
  kind?: string;
  source?: string;
}

export interface FrontageEdge {
  id: string;
  roadId: string;
  roadClass: RoadClass;
  valueWeight: number;
  kind?: string;
  source?: string;
  a: Point;
  b: Point;
  length: number;
  angle: number;
  score: number;
  buffer: number;
}

export interface FrontageGroup {
  id: string;
  roadIds: string[];
  sources: string[];
  roadClass: RoadClass;
  valueWeight: number;
  edges: FrontageEdge[];
  polyline: Point[];
  totalLength: number;
  weightedScore: number;
  averageAngle: number;
  isCurved: boolean;
}

export interface BlockFrontageAnalysis {
  edges: FrontageEdge[];
  groups: FrontageGroup[];
  primary: FrontageGroup | null;
  blockArea: number;
  blockDepth: number;
  aspectRatio: number;
  irregularity: number;
}

export interface BlockPlanningMetrics {
  generatedBuildingCount?: number;
  highValueFrontageUtilization?: number;
  totalBuildableAreaUtilization?: number;
  rejectedParcelCount?: number;
  sliverCleanupCount?: number;
  fallbackReason?: string;
  score?: number;
}

export interface BuildingBlockProfile {
  age: BlockAgeTag;
  use: BlockUseTag;
  districtLandUseRole?: DistrictLandUseRole;
  zoneScores?: Partial<Record<BlockUseTag, number>>;
  subdivisionFlavor?: SubdivisionFlavor;
  frontageGroupId?: string | null;
  frontageRoadIds?: string[];
  frontageRoadClass?: RoadClass | null;
  frontageScore?: number;
  frontageLength?: number;
  frontageAngle?: number;
  frontageDivisionCount?: number;
  shapeFamily?: ParcelShapeFamily;
  shapeOrientation?: ParcelOrientation;
  triangleOrientation?: TriangleOrientation;
  shapeSideCount?: number;
  shapeSideKinds?: string[];
  shapeCornerAngles?: number[];
  shapeConfidence?: number;
  shapeTemplateHints?: LayoutTemplateHint[];
  shapeFallbackReason?: string;
  shapeReasons?: string[];
  selectedTemplate?: string;
  modernityScore?: number;
  roadPriority?: number;
  layoutStrategy?: string;
  gridCols?: number;
  gridRows?: number;
  envelopeArea?: number;
  envelopeCoverage?: number;
  placedCount?: number;
  frontageSetback?: number;
  bypassedRoadShrink?: boolean;
  layoutFailure?: string;
  highValueFrontageUtilization?: number;
  rejectedParcelCount?: number;
  sliverCleanupCount?: number;
  metrics?: BlockPlanningMetrics;
}

export interface BlockZoningContext {
  districtRole?: DistrictLandUseRole;
  districtZoneCounts?: Partial<Record<BlockUseTag, number>>;
  districtBlockCount?: number;
  blockIndexInDistrict?: number;
  plannedUseOverride?: BlockUseTag | null;
}

const BLOCK_USE_TAGS: BlockUseTag[] = [
  'residential',
  'commercial_retail',
  'commercial_office',
  'hospitality',
  'industrial',
  'civic_public',
  'park_open',
  'infrastructure_service',
  'landmark',
  'mixed_use',
];

const COMMERCIAL_FRONTAGE_USES = new Set<BlockUseTag>([
  'commercial_retail',
  'commercial_office',
  'hospitality',
  'mixed_use',
]);

function isCommercialFrontageUse(use: BlockUseTag) {
  return COMMERCIAL_FRONTAGE_USES.has(use);
}

function addScore(scores: Record<BlockUseTag, number>, use: BlockUseTag, amount: number) {
  scores[use] += amount;
}

function seededVariation(rng: Rng) {
  return (rng() - 0.5) * 0.56;
}

function scoreMap(entries: Partial<Record<BlockUseTag, number>>) {
  const scores = Object.fromEntries(BLOCK_USE_TAGS.map((use) => [use, 0])) as Record<BlockUseTag, number>;
  for (const use of BLOCK_USE_TAGS) scores[use] = entries[use] || 0;
  return scores;
}

const DISTRICT_AFFINITY: Record<DistrictLandUseRole, Record<BlockUseTag, number>> = {
  old_core: scoreMap({
    commercial_retail: 3,
    residential: 2,
    hospitality: 1.5,
    mixed_use: 1.35,
    commercial_office: 0.8,
    civic_public: 0.45,
    landmark: 0.35,
  }),
  waterfront: scoreMap({
    hospitality: 3,
    commercial_retail: 2,
    park_open: 1.45,
    mixed_use: 1.35,
    residential: 1.15,
    landmark: 0.95,
    civic_public: 0.5,
  }),
  highway_corridor: scoreMap({
    commercial_office: 2.45,
    hospitality: 1.7,
    industrial: 1.5,
    infrastructure_service: 1.4,
    commercial_retail: 1,
    landmark: 0.5,
  }),
  interior_grid: scoreMap({
    residential: 3.45,
    park_open: 0.65,
    commercial_retail: 0.5,
    mixed_use: 0.4,
    civic_public: 0.35,
  }),
  backland_edge: scoreMap({
    industrial: 4.2,
    infrastructure_service: 3.1,
    commercial_office: 0.8,
    park_open: 0.5,
    commercial_retail: 0.4,
    hospitality: -1,
    residential: -0.35,
  }),
  civic_center: scoreMap({
    civic_public: 2.65,
    park_open: 2,
    landmark: 1.6,
    commercial_office: 1,
    hospitality: 0.55,
    mixed_use: 0.45,
  }),
  commercial_core: scoreMap({
    commercial_retail: 2.65,
    commercial_office: 2.2,
    hospitality: 1.4,
    mixed_use: 1.25,
    civic_public: 0.45,
    landmark: 0.4,
    residential: 0.35,
  }),
};

export function roadClassForEdge(edge: RoadEdge): RoadClass {
  const kind = String(edge.kind || edge.render?.materialKey || '');
  if (kind === 'highway') return 'HIGHWAY';
  if (kind === 'avenue' || edge.source === 'coast-road') return 'MAJOR_ROAD';
  if (kind === 'street' || kind === 'local') return 'MINOR_ROAD';
  if (edge.source === 'v35-river-bank') return 'SERVICE';
  return 'ALLEY';
}

export function roadValueForEdge(edge: RoadEdge): RoadValue {
  const roadClass = roadClassForEdge(edge);
  const weight = roadClass === 'HIGHWAY' ? 10
    : roadClass === 'MAJOR_ROAD' ? 6
      : roadClass === 'MINOR_ROAD' ? 3
        : 1;
  return {
    roadId: edge.id,
    roadClass,
    weight,
    renderWidth: typeof edge.render?.width === 'number' ? edge.render.width : 1,
    kind: edge.kind,
    source: edge.source,
  };
}

function blockBoundarySpanNearHazard(blockPolygon: readonly Point[], hazard: RoadHazard) {
  let span = 0;
  const threshold = hazard.buffer + 3.2;
  for (let i = 0; i < blockPolygon.length; i++) {
    const a = blockPolygon[i];
    const b = blockPolygon[(i + 1) % blockPolygon.length];
    const edgeLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (edgeLength < 0.5) continue;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const near =
      pointToSegmentDist(mid.x, mid.y, hazard.a, hazard.b) <= threshold ||
      pointToSegmentDist(a.x, a.y, hazard.a, hazard.b) <= threshold ||
      pointToSegmentDist(b.x, b.y, hazard.a, hazard.b) <= threshold;
    if (near) span += edgeLength;
  }
  return span;
}

function angleDelta(a: number, b: number) {
  const d = Math.abs(a - b) % Math.PI;
  return d > Math.PI / 2 ? Math.PI - d : d;
}

export function groupConnectedFrontageEdges(edges: FrontageEdge[]): FrontageGroup[] {
  const byRoad = new Map<string, FrontageEdge[]>();
  for (const edge of edges) {
    const key = `${edge.roadId}:${edge.roadClass}`;
    byRoad.set(key, [...(byRoad.get(key) || []), edge]);
  }

  return Array.from(byRoad.entries()).map(([key, groupEdges]) => {
    const edgesByLength = groupEdges.slice().sort((a, b) => b.length - a.length);
    const totalLength = groupEdges.reduce((sum, edge) => sum + edge.length, 0);
    const weightedScore = groupEdges.reduce((sum, edge) => sum + edge.score, 0);
    let vx = 0;
    let vy = 0;
    for (const edge of groupEdges) {
      vx += Math.cos(edge.angle) * edge.length;
      vy += Math.sin(edge.angle) * edge.length;
    }
    const averageAngle = Math.atan2(vy, vx);
    const isCurved = groupEdges.some((edge) => angleDelta(edge.angle, averageAngle) > 0.24);
    const roadIds = Array.from(new Set(groupEdges.map((edge) => edge.roadId)));
    const sources = Array.from(new Set(groupEdges.map((edge) => edge.source).filter(Boolean) as string[]));
    const primary = edgesByLength[0];
    return {
      id: `frontage:${key}`,
      roadIds,
      sources,
      roadClass: primary.roadClass,
      valueWeight: primary.valueWeight,
      edges: groupEdges,
      polyline: groupEdges.flatMap((edge, index) => index === 0 ? [edge.a, edge.b] : [edge.b]),
      totalLength,
      weightedScore,
      averageAngle,
      isCurved,
    };
  }).sort((a, b) => b.weightedScore - a.weightedScore);
}

export function choosePrimaryFrontage(groups: FrontageGroup[]) {
  return groups[0] || null;
}

export function analyzeBlockFrontage(
  block: CityBlock & Record<string, any>,
  roadHazards: RoadHazard[],
): BlockFrontageAnalysis {
  const blockArea = Number(block.area || polygonArea(block.polygon));
  const centroid = block.centroid || polygonCentroid(block.polygon);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of block.polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const blockDepth = Math.min(width, height);
  const aspectRatio = Math.max(width, height) / blockDepth;
  const edges: FrontageEdge[] = [];

  for (let i = 0; i < roadHazards.length; i++) {
    const hazard = roadHazards[i];
    const pad = hazard.buffer + blockDepth * 0.7 + 8;
    const hx1 = Math.min(hazard.a.x, hazard.b.x);
    const hx2 = Math.max(hazard.a.x, hazard.b.x);
    const hy1 = Math.min(hazard.a.y, hazard.b.y);
    const hy2 = Math.max(hazard.a.y, hazard.b.y);
    if (hx2 < minX - pad || hx1 > maxX + pad || hy2 < minY - pad || hy1 > maxY + pad) continue;

    const boundarySpan = blockBoundarySpanNearHazard(block.polygon, hazard);
    const centroidDistance = pointToSegmentDist(centroid.x, centroid.y, hazard.a, hazard.b);
    if (boundarySpan < 2 && centroidDistance > blockDepth + hazard.buffer + 5) continue;

    const segmentLength = Math.hypot(hazard.b.x - hazard.a.x, hazard.b.y - hazard.a.y);
    const length = Math.max(1, Math.min(segmentLength, boundarySpan || segmentLength));
    edges.push({
      id: `${hazard.roadId}:frontage:${i}`,
      roadId: hazard.roadId,
      roadClass: hazard.roadClass,
      valueWeight: hazard.valueWeight,
      kind: hazard.kind,
      source: hazard.source,
      a: hazard.a,
      b: hazard.b,
      length,
      angle: Math.atan2(hazard.b.y - hazard.a.y, hazard.b.x - hazard.a.x),
      score: length * hazard.valueWeight,
      buffer: hazard.buffer,
    });
  }

  const groups = groupConnectedFrontageEdges(edges);
  const primary = choosePrimaryFrontage(groups);
  const perimeter = block.polygon.reduce((sum, point, index) => {
    const next = block.polygon[(index + 1) % block.polygon.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
  const bboxArea = width * height;
  const fill = blockArea / Math.max(1, bboxArea);
  const irregularity = Math.max(0, Math.min(1, (perimeter / Math.max(1, Math.sqrt(blockArea) * 4)) - 1 + (1 - fill) * 0.5));

  return { edges, groups, primary, blockArea, blockDepth, aspectRatio, irregularity };
}

function modernityFromFrontage(frontage: BlockFrontageAnalysis) {
  const primary = frontage.primary;
  if (!primary) return 0;
  const value = primary.valueWeight;
  const lengthScore = Math.min(2, primary.totalLength / Math.max(8, frontage.blockDepth * 1.2));
  return value * 0.72 + lengthScore + Math.min(1.2, frontage.blockArea / 1600);
}

export function frontageDivisionCountForProfile(
  profile: Pick<BuildingBlockProfile, 'use' | 'age'>,
  frontage: FrontageGroup | null,
  blockArea: number,
  rng: Rng,
) {
  if (!isCommercialFrontageUse(profile.use)) return 0;
  const frontageLength = frontage?.totalLength || Math.sqrt(Math.max(1, blockArea));
  if (profile.use === 'hospitality') return blockArea > 1100 && rng() < 0.62 ? 1 : 2;
  if (profile.use === 'commercial_office') {
    if (profile.age === 'old') return Math.max(3, Math.min(9, Math.round(frontageLength / (6 + rng() * 4))));
    return blockArea > 900 && rng() < 0.48 ? 1 : rng() < 0.64 ? 2 : 3;
  }
  if (profile.use === 'mixed_use' && profile.age !== 'old') return rng() < 0.44 ? 2 : 3;
  if (profile.age === 'new') {
    if (blockArea > 900 && frontageLength > 28 && rng() < 0.42) return 1;
    return rng() < 0.58 ? 2 : 3;
  }
  if (profile.age === 'average') {
    return Math.max(3, Math.min(7, Math.round(frontageLength / (8 + rng() * 5))));
  }
  return Math.max(7, Math.min(18, Math.round(frontageLength / (3.2 + rng() * 2.4))));
}

export function selectSubdivisionFlavor(profile: Pick<BuildingBlockProfile, 'use' | 'age'>): SubdivisionFlavor {
  if (profile.use === 'landmark') return 'iconic-edge-structure';
  if (profile.use === 'park_open' || profile.use === 'civic_public') return 'courtyard-park-insert';
  if (profile.use === 'industrial' || profile.use === 'infrastructure_service') return 'rectangular-backbone';
  if (isCommercialFrontageUse(profile.use)) {
    if (profile.age === 'new') return 'iconic-edge-structure';
    if (profile.age === 'average') return 'frontage-strip-subdivision';
    return 'skinny-tenant-frontage';
  }
  if (profile.age === 'old') return 'hodgepodge-accretion';
  return 'courtyard-park-insert';
}

function chooseAge(use: BlockUseTag, frontage: BlockFrontageAnalysis, modernityScore: number, rng: Rng): BlockAgeTag {
  const valueWeight = frontage.primary?.valueWeight || 1;
  const roll = rng();
  if (use === 'industrial' || use === 'infrastructure_service') {
    return valueWeight >= 6
      ? roll < 0.46 ? 'new' : roll < 0.84 ? 'average' : 'old'
      : roll < 0.18 ? 'new' : roll < 0.62 ? 'average' : 'old';
  }
  if (use === 'park_open' || use === 'civic_public') {
    return roll < 0.28 ? 'new' : roll < 0.78 ? 'average' : 'old';
  }
  if (use === 'landmark') {
    return roll < 0.64 ? 'new' : roll < 0.92 ? 'average' : 'old';
  }
  if (valueWeight >= 10 || modernityScore >= 8.5) {
    return roll < 0.7 ? 'new' : roll < 0.92 ? 'average' : 'old';
  }
  if (valueWeight >= 6 || modernityScore >= 5) {
    return roll < 0.34 ? 'new' : roll < 0.78 ? 'average' : 'old';
  }
  if (valueWeight >= 3) return roll < 0.12 ? 'new' : roll < 0.54 ? 'average' : 'old';
  return roll < 0.12 ? 'average' : 'old';
}

function scoreBlockUse(
  frontage: BlockFrontageAnalysis,
  context: BlockZoningContext,
  rng: Rng,
) {
  const role = context.districtRole || 'interior_grid';
  const scores = { ...DISTRICT_AFFINITY[role] };
  const primary = frontage.primary;
  const valueWeight = primary?.valueWeight || 1;
  const hasHighway = frontage.groups.some((group) => group.roadClass === 'HIGHWAY');
  const hasMajor = frontage.groups.some((group) => group.valueWeight >= 6);
  const hasWaterfront = frontage.groups.some((group) => group.sources.includes('coast-road'));
  const area = frontage.blockArea;
  const large = area > 1100;
  const veryLarge = area > 1800;
  const tiny = area < 150;
  const long = frontage.aspectRatio > 2.35;
  const square = frontage.aspectRatio < 1.45;
  const quietInterior = valueWeight <= 3 && square && area < 900 && frontage.irregularity < 0.2;
  const awkward = tiny || frontage.irregularity > 0.38;

  const counts = context.districtZoneCounts || {};
  const assignedCount = Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
  if (assignedCount > 0) {
    let dominant: BlockUseTag | null = null;
    let dominantCount = 0;
    for (const use of BLOCK_USE_TAGS) {
      const count = counts[use] || 0;
      if (count > dominantCount) {
        dominant = use;
        dominantCount = count;
      }
      if (count > 0 && use !== 'park_open') {
        addScore(scores, use, Math.min(0.95, (count / Math.max(1, assignedCount)) * 1.15));
      }
    }
    if (dominant && dominant !== 'park_open') addScore(scores, dominant, 0.45);
  }

  if (valueWeight >= 10) {
    addScore(scores, 'commercial_office', 2.9);
    addScore(scores, 'hospitality', 2.2);
    addScore(scores, 'commercial_retail', 1.6);
    addScore(scores, 'landmark', 1.25);
    addScore(scores, 'infrastructure_service', 0.9);
    addScore(scores, 'residential', -0.9);
  } else if (valueWeight >= 6) {
    addScore(scores, 'commercial_retail', 2.2);
    addScore(scores, 'commercial_office', 2);
    addScore(scores, 'mixed_use', 1.8);
    addScore(scores, 'hospitality', 1.55);
    addScore(scores, 'civic_public', 0.75);
    addScore(scores, 'park_open', 0.35);
  } else if (valueWeight >= 3) {
    addScore(scores, 'residential', 1.25);
    addScore(scores, 'commercial_retail', 0.75);
    addScore(scores, 'mixed_use', 0.65);
  } else {
    addScore(scores, 'residential', 1.45);
    addScore(scores, 'industrial', 0.45);
    addScore(scores, 'infrastructure_service', 0.55);
  }

  if (hasHighway) {
    addScore(scores, 'commercial_office', 1.2);
    addScore(scores, 'hospitality', 0.9);
    addScore(scores, 'industrial', 1.25);
    addScore(scores, 'infrastructure_service', 1.15);
    addScore(scores, 'residential', -1.25);
  }
  if (hasMajor) {
    addScore(scores, 'commercial_retail', 0.8);
    addScore(scores, 'mixed_use', 0.7);
    addScore(scores, 'civic_public', 0.4);
  }
  if (hasWaterfront) {
    addScore(scores, 'hospitality', 2.1);
    addScore(scores, 'park_open', 1.25);
    addScore(scores, 'landmark', 0.9);
    addScore(scores, 'commercial_retail', 0.7);
    addScore(scores, 'industrial', -1.2);
    addScore(scores, 'infrastructure_service', -0.75);
  }
  if (large) {
    addScore(scores, 'commercial_office', 1.15);
    addScore(scores, 'industrial', 1.05);
    addScore(scores, 'hospitality', 0.85);
    addScore(scores, 'landmark', veryLarge ? 1.05 : 0.55);
    addScore(scores, 'residential', -0.45);
  }
  if (long) {
    addScore(scores, 'industrial', 1.1);
    addScore(scores, 'infrastructure_service', 0.85);
    addScore(scores, 'commercial_office', 0.65);
    addScore(scores, 'commercial_retail', 0.35);
    addScore(scores, 'residential', -0.85);
  }
  if (quietInterior) {
    addScore(scores, 'residential', 2.25);
    addScore(scores, 'mixed_use', 0.35);
    addScore(scores, 'park_open', 0.25);
  }
  if (awkward) {
    addScore(scores, 'park_open', 1.75);
    addScore(scores, 'infrastructure_service', 0.85);
    addScore(scores, 'commercial_retail', 0.3);
    addScore(scores, 'landmark', -0.6);
  }

  if (context.plannedUseOverride) addScore(scores, context.plannedUseOverride, 8);
  if (!context.plannedUseOverride) {
    const exceptionRoll = rng();
    if (veryLarge && valueWeight >= 6 && exceptionRoll < 0.025) {
      addScore(scores, 'landmark', 6.5);
    } else if (hasMajor && area > 650 && exceptionRoll < 0.055) {
      addScore(scores, 'civic_public', 5.2);
    } else if (hasMajor && !hasHighway && exceptionRoll < 0.11) {
      addScore(scores, 'mixed_use', 4.1);
    } else if (role === 'backland_edge' && exceptionRoll < 0.24) {
      addScore(scores, 'infrastructure_service', 2.2);
    }
  }
  for (const use of BLOCK_USE_TAGS) addScore(scores, use, seededVariation(rng));
  return scores;
}

function pickHighestScoredUse(scores: Record<BlockUseTag, number>) {
  return BLOCK_USE_TAGS.reduce((best, use) => scores[use] > scores[best] ? use : best, BLOCK_USE_TAGS[0]);
}

export function chooseBlockProfile(
  block: CityBlock & Record<string, any>,
  frontage: BlockFrontageAnalysis,
  rng: Rng,
  context: BlockZoningContext = {},
): BuildingBlockProfile {
  const modernityScore = modernityFromFrontage(frontage);
  const primary = frontage.primary;
  const valueWeight = primary?.valueWeight || 1;
  const zoneScores = scoreBlockUse(frontage, context, rng);
  const shape = block.shape;
  const shapeFallbackUse = !context.plannedUseOverride && shape
    ? fallbackUseForUnclassifiedParcel({ shape, districtRole: context.districtRole })
    : null;
  if (shapeFallbackUse) addScore(zoneScores, shapeFallbackUse, 10);
  const use = context.plannedUseOverride || shapeFallbackUse || pickHighestScoredUse(zoneScores);
  const age = chooseAge(use, frontage, modernityScore, rng);
  const baseProfile: BuildingBlockProfile = {
    age,
    use,
    districtLandUseRole: context.districtRole,
    zoneScores,
    subdivisionFlavor: selectSubdivisionFlavor({ age, use }),
    frontageGroupId: primary?.id || null,
    frontageRoadIds: primary?.roadIds || [],
    frontageRoadClass: primary?.roadClass || null,
    frontageScore: primary?.weightedScore || 0,
    frontageLength: primary?.totalLength || 0,
    frontageAngle: primary?.averageAngle,
    frontageSetback: isCommercialFrontageUse(use) ? GLOBAL_COMMERCIAL_SETBACK : undefined,
    shapeFamily: shape?.family,
    shapeOrientation: shape?.orientation,
    triangleOrientation: shape?.triangleOrientation,
    shapeSideCount: shape?.sideCount,
    shapeSideKinds: shape?.sideKinds,
    shapeCornerAngles: shape?.cornerAngles,
    shapeConfidence: shape?.confidence,
    shapeTemplateHints: shape?.templateHints,
    shapeFallbackReason: shapeFallbackUse ? shape?.fallbackReason || `${shape.family}-fallback-${shapeFallbackUse}` : shape?.fallbackReason,
    shapeReasons: shape?.reasons?.slice(0, 3),
    selectedTemplate: shape?.templateHints?.[0],
    modernityScore,
    roadPriority: valueWeight,
  };
  baseProfile.frontageDivisionCount = frontageDivisionCountForProfile(baseProfile, primary, frontage.blockArea, rng);
  block.planning = baseProfile;
  return baseProfile;
}
