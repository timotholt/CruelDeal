import { clipPolygonToRect, pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import { splitPolygonByLine } from './partition';
import { fallbackUseForUnclassifiedParcel, classifyParcelShape } from './parcel-shapes';
import { analyzeBlockFrontage, type BlockFrontageAnalysis, type BuildingBlockProfile, type RoadHazard } from './planning';
import { URBAN_SCALE } from './urban-units';
import type { CityBlock, CityParcel, ParcelGenerationKind, Point, TerrainPlan } from './types';

type Rng = () => number;

interface OrientedFrame {
  center: Point;
  axisU: Point;
  axisV: Point;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  width: number;
  depth: number;
  angle: number;
}

interface FrontageSide {
  id: string;
  edgeIndex: number;
  a: Point;
  b: Point;
  angle: number;
  length: number;
  roadIds: string[];
  hazards: RoadHazard[];
  valueWeight: number;
}

interface ParcelLeaf {
  path: string;
  polygon: Point[];
  generationKind: ParcelGenerationKind;
  parcelCoverageRole: NonNullable<CityParcel['parcelCoverageRole']>;
  frontageRoadIds?: string[];
  frontageSideCount?: number;
  frontageDepth?: number;
  frontageWidth?: number;
  fieldAngle?: number;
}

export interface BlockParcelizationOptions {
  roadHazards?: RoadHazard[] | null;
  terrain?: TerrainPlan | null;
  maxDepth?: number;
}

const MIN_PARCEL_AREA = URBAN_SCALE.parcels.minBuildableArea;
const MIN_SPLIT_CHILD_AREA = URBAN_SCALE.parcels.minSplitChildArea;

function normalizeAngle(angle: number) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function axisAngleDelta(a: number, b: number) {
  const d = Math.abs(normalizeAngle(a - b));
  return Math.min(d, Math.abs(Math.PI - d));
}

function unique<T>(values: readonly T[]) {
  return Array.from(new Set(values));
}

function cleanPolygon(polygon: readonly Point[]) {
  const out: Point[] = [];
  for (const point of polygon) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(point.x - prev.x, point.y - prev.y) > 0.04) {
      out.push({ x: point.x, y: point.y });
    }
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 0.04) out.pop();
  }
  return out;
}

function localFrameForSide(side: FrontageSide, blockCenter: Point) {
  const dx = side.b.x - side.a.x;
  const dy = side.b.y - side.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ax = { x: dx / len, y: dy / len };
  const n1 = { x: -ax.y, y: ax.x };
  const mid = { x: (side.a.x + side.b.x) / 2, y: (side.a.y + side.b.y) / 2 };
  const toCenter = { x: blockCenter.x - mid.x, y: blockCenter.y - mid.y };
  const nm = n1.x * toCenter.x + n1.y * toCenter.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
  return {
    ax,
    nm,
    toLocal: (p: Point) => ({
      x: (p.x - side.a.x) * ax.x + (p.y - side.a.y) * ax.y,
      y: (p.x - side.a.x) * nm.x + (p.y - side.a.y) * nm.y,
    }),
    fromLocal: (p: Point): Point => ({
      x: side.a.x + ax.x * p.x + nm.x * p.y,
      y: side.a.y + ax.y * p.x + nm.y * p.y,
    }),
  };
}

function clipLocalPolygon(polygon: readonly Point[], rect: { minX: number; minY: number; maxX: number; maxY: number }) {
  return cleanPolygon(clipPolygonToRect(polygon, rect).map((p) => ({ x: p.x, y: p.y })));
}

function project(point: Point, center: Point, axis: Point) {
  return (point.x - center.x) * axis.x + (point.y - center.y) * axis.y;
}

function frameForAngle(points: readonly Point[], angle: number): OrientedFrame {
  const center = polygonCentroid(points);
  const axisU = { x: Math.cos(angle), y: Math.sin(angle) };
  const axisV = { x: -axisU.y, y: axisU.x };
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const point of points) {
    const u = project(point, center, axisU);
    const v = project(point, center, axisV);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return {
    center,
    axisU,
    axisV,
    minU,
    maxU,
    minV,
    maxV,
    width: maxU - minU,
    depth: maxV - minV,
    angle,
  };
}

function orientedFrame(points: readonly Point[], fallbackAngle = 0): OrientedFrame {
  if (points.length < 2) return frameForAngle(points, fallbackAngle);
  const candidates: number[] = [fallbackAngle, fallbackAngle + Math.PI / 2, 0, Math.PI / 2];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 0.5) continue;
    candidates.push(Math.atan2(b.y - a.y, b.x - a.x));
  }
  let best: OrientedFrame | null = null;
  let bestArea = Infinity;
  for (const angle of candidates) {
    const frame = frameForAngle(points, angle);
    const area = frame.width * frame.depth;
    if (area < bestArea) {
      best = frame;
      bestArea = area;
    }
  }
  return best || frameForAngle(points, fallbackAngle);
}

function lineFromFrame(frame: OrientedFrame, rng: Rng, irregularity: number) {
  const splitLongU = frame.width >= frame.depth;
  const lineAxis = splitLongU ? frame.axisV : frame.axisU;
  const offsetAxis = splitLongU ? frame.axisU : frame.axisV;
  const span = splitLongU ? frame.width : frame.depth;
  const jitter = (rng() - 0.5) * span * Math.max(0, Math.min(0.32, irregularity));
  const pivot = {
    x: frame.center.x + offsetAxis.x * jitter,
    y: frame.center.y + offsetAxis.y * jitter,
  };
  const extent = Math.max(frame.width, frame.depth) * 2.4 + 20;
  return {
    a: { x: pivot.x - lineAxis.x * extent, y: pivot.y - lineAxis.y * extent },
    b: { x: pivot.x + lineAxis.x * extent, y: pivot.y + lineAxis.y * extent },
  };
}

function polygonHasRoadAccess(polygon: readonly Point[], roadHazards: readonly RoadHazard[] = []) {
  if (!roadHazards.length) return true;
  const thresholdPad = 3.6;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    for (const hazard of roadHazards) {
      const threshold = hazard.buffer + thresholdPad;
      if (
        pointToSegmentDist(a.x, a.y, hazard.a, hazard.b) <= threshold ||
        pointToSegmentDist(b.x, b.y, hazard.a, hazard.b) <= threshold ||
        pointToSegmentDist(mid.x, mid.y, hazard.a, hazard.b) <= threshold
      ) {
        return true;
      }
    }
  }
  return false;
}

function hazardOverlapAlongEdge(edgeA: Point, edgeB: Point, hazard: RoadHazard) {
  const dx = hazard.b.x - hazard.a.x;
  const dy = hazard.b.y - hazard.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ax = { x: dx / len, y: dy / len };
  const projectOnHazard = (p: Point) => (p.x - hazard.a.x) * ax.x + (p.y - hazard.a.y) * ax.y;
  const e1 = projectOnHazard(edgeA);
  const e2 = projectOnHazard(edgeB);
  const edgeMin = Math.min(e1, e2);
  const edgeMax = Math.max(e1, e2);
  const overlap = Math.min(edgeMax, len) - Math.max(edgeMin, 0);
  return Math.max(0, overlap);
}

function detectFrontageSides(
  blockPolygon: readonly Point[],
  roadHazards: readonly RoadHazard[],
  blockFrontage: BlockFrontageAnalysis,
): FrontageSide[] {
  if (!roadHazards.length || blockPolygon.length < 3) return [];
  const sides: FrontageSide[] = [];
  const seenRoadIds = new Set(blockFrontage.groups.flatMap((group) => group.roadIds));

  for (let i = 0; i < blockPolygon.length; i++) {
    const a = blockPolygon[i];
    const b = blockPolygon[(i + 1) % blockPolygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 2) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const candidates = roadHazards
      .map((hazard) => {
        const hazardAngle = Math.atan2(hazard.b.y - hazard.a.y, hazard.b.x - hazard.a.x);
        const parallel = axisAngleDelta(angle, hazardAngle);
        if (parallel > 0.32) return null;
        const midpointDistance = pointToSegmentDist(mid.x, mid.y, hazard.a, hazard.b);
        const endpointDistance = Math.min(
          pointToSegmentDist(a.x, a.y, hazard.a, hazard.b),
          pointToSegmentDist(b.x, b.y, hazard.a, hazard.b),
        );
        const threshold = Math.max(3.2, hazard.buffer + 4.5);
        if (midpointDistance > threshold && endpointDistance > threshold) return null;
        const overlap = hazardOverlapAlongEdge(a, b, hazard);
        if (overlap < Math.min(length * 0.16, 2)) return null;
        const frontageBoost = seenRoadIds.has(hazard.roadId) ? 1.35 : 1;
        const score = (overlap + Math.max(0, threshold - midpointDistance)) * hazard.valueWeight * frontageBoost;
        return { hazard, score };
      })
      .filter((entry): entry is { hazard: RoadHazard; score: number } => Boolean(entry))
      .sort((x, y) => y.score - x.score);

    if (!candidates.length) continue;
    const best = candidates[0];
    const hazards = candidates
      .filter((entry) => entry.score >= best.score * 0.34 || entry.hazard.roadId === best.hazard.roadId)
      .map((entry) => entry.hazard);
    sides.push({
      id: `edge:${i}:${best.hazard.roadId}`,
      edgeIndex: i,
      a,
      b,
      angle,
      length,
      roadIds: unique(hazards.map((hazard) => hazard.roadId)),
      hazards,
      valueWeight: Math.max(...hazards.map((hazard) => hazard.valueWeight)),
    });
  }

  return mergeContiguousFrontageSides(sides)
    .sort((a, b) => b.length * b.valueWeight - a.length * a.valueWeight)
    .slice(0, 4);
}

function mergeContiguousFrontageSides(sides: FrontageSide[]) {
  if (sides.length < 2) return sides;
  const ordered = sides.slice().sort((a, b) => a.edgeIndex - b.edgeIndex);
  const merged: FrontageSide[] = [];
  for (const side of ordered) {
    const last = merged[merged.length - 1];
    const sameRoad = last && last.roadIds.some((roadId) => side.roadIds.includes(roadId));
    const contiguous = last && side.edgeIndex === last.edgeIndex + 1;
    if (last && sameRoad && contiguous && axisAngleDelta(last.angle, side.angle) < 0.18) {
      last.b = side.b;
      last.length += side.length;
      last.angle = Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x);
      last.roadIds = unique([...last.roadIds, ...side.roadIds]);
      last.hazards = unique([...last.hazards, ...side.hazards]);
      last.valueWeight = Math.max(last.valueWeight, side.valueWeight);
      continue;
    }
    merged.push({ ...side, roadIds: side.roadIds.slice(), hazards: side.hazards.slice() });
  }
  return merged;
}

function frontageDepthForProfile(profile: BuildingBlockProfile) {
  if (profile.use === 'industrial' || profile.use === 'infrastructure_service') return 18;
  if (profile.use === 'residential') return 10;
  if (profile.use === 'commercial_office' || profile.use === 'hospitality') return profile.age === 'old' ? 8 : 14;
  if (profile.use === 'mixed_use') return profile.age === 'new' ? 14 : 10;
  if (profile.use === 'commercial_retail') return profile.age === 'old' ? 8 : profile.age === 'average' ? 10 : 14;
  return 10;
}

function frontageMinWidthForProfile(profile: BuildingBlockProfile) {
  if (profile.use === 'industrial' || profile.use === 'infrastructure_service') return 14;
  if (profile.use === 'residential') return 6;
  if (profile.use === 'commercial_office' || profile.use === 'hospitality') return profile.age === 'old' ? 4 : 10;
  if (profile.use === 'mixed_use') return profile.age === 'new' ? 10 : 6;
  if (profile.use === 'commercial_retail') return profile.age === 'old' ? 4 : profile.age === 'average' ? 6 : 10;
  return 8;
}

function generationKindForRoadIds(roadIds: readonly string[]): ParcelGenerationKind {
  if (roadIds.length >= 3) return 'multi-frontage';
  if (roadIds.length === 2) return 'corner-frontage';
  return 'frontage-strip';
}

function parcelRoadIdsForPolygon(polygon: readonly Point[], sides: readonly FrontageSide[]) {
  const roadIds: string[] = [];
  for (const side of sides) {
    const close = polygon.some((point) => pointToSegmentDist(point.x, point.y, side.a, side.b) <= 1.25);
    if (close) roadIds.push(...side.roadIds);
  }
  return unique(roadIds);
}

function stripForSide(subject: readonly Point[], side: FrontageSide, depth: number, blockCenter: Point) {
  const frame = localFrameForSide(side, blockCenter);
  const local = subject.map(frame.toLocal);
  const frameSpan = Math.max(80, side.length * 3);
  const strip = clipLocalPolygon(local, {
    minX: -frameSpan,
    minY: -0.1,
    maxX: side.length + frameSpan,
    maxY: depth,
  });
  return strip.map(frame.fromLocal);
}

function remainingBehindSide(subject: readonly Point[], side: FrontageSide, depth: number, blockCenter: Point) {
  const frame = localFrameForSide(side, blockCenter);
  const local = subject.map(frame.toLocal);
  const frameSpan = Math.max(80, side.length * 3);
  const minV = Math.min(...local.map((p) => p.y));
  const maxV = Math.max(...local.map((p) => p.y));
  const remaining = clipLocalPolygon(local, {
    minX: -frameSpan,
    minY: depth,
    maxX: side.length + frameSpan,
    maxY: Math.max(maxV + 1, minV + frameSpan),
  });
  return remaining.map(frame.fromLocal);
}

function sliceFrontageStrip(
  strip: readonly Point[],
  side: FrontageSide,
  allSides: readonly FrontageSide[],
  profile: BuildingBlockProfile,
  blockCenter: Point,
  pathPrefix: string,
): ParcelLeaf[] {
  const area = polygonArea(strip);
  if (strip.length < 3 || area < 2) return [];
  const frame = localFrameForSide(side, blockCenter);
  const local = strip.map(frame.toLocal);
  const minU = Math.min(...local.map((p) => p.x));
  const maxU = Math.max(...local.map((p) => p.x));
  const minV = Math.min(...local.map((p) => p.y));
  const maxV = Math.max(...local.map((p) => p.y));
  const span = maxU - minU;
  const depth = Math.max(0, maxV - minV);
  const minWidth = frontageMinWidthForProfile(profile);
  const desired = Math.max(1, Math.floor(span / minWidth));
  const n = Math.max(1, Math.min(22, desired));
  const leaves: ParcelLeaf[] = [];

  for (let i = 0; i < n; i++) {
    const u1 = minU + (span * i) / n;
    const u2 = minU + (span * (i + 1)) / n;
    const cell = clipLocalPolygon(local, { minX: u1, minY: minV - 0.05, maxX: u2, maxY: maxV + 0.05 });
    const polygon = cell.map(frame.fromLocal);
    const cellArea = polygonArea(polygon);
    if (polygon.length < 3 || cellArea < 2) continue;
    const roadIds = parcelRoadIdsForPolygon(polygon, allSides);
    const explicitRoadIds = roadIds.length ? roadIds : side.roadIds;
    leaves.push({
      path: `${pathPrefix}s${i}`,
      polygon,
      generationKind: generationKindForRoadIds(explicitRoadIds),
      parcelCoverageRole: 'frontage',
      frontageRoadIds: explicitRoadIds,
      frontageSideCount: explicitRoadIds.length,
      frontageDepth: depth,
      frontageWidth: Math.max(0, u2 - u1),
      fieldAngle: side.angle,
    });
  }

  return leaves;
}

function targetParcelArea(profile: BuildingBlockProfile, blockArea: number) {
  if (profile.use === 'park_open' || profile.use === 'landmark' || profile.use === 'civic_public') return Infinity;
  if (profile.use === 'industrial' || profile.use === 'infrastructure_service') return Math.max(URBAN_SCALE.parcels.industrialTargetArea, blockArea * 0.55);
  if (profile.use === 'residential') return profile.age === 'old'
    ? URBAN_SCALE.parcels.residentialOldTargetArea
    : profile.age === 'new'
      ? URBAN_SCALE.parcels.residentialNewTargetArea
      : URBAN_SCALE.parcels.residentialAverageTargetArea;
  const divisions = Math.max(1, profile.frontageDivisionCount || 1);
  if (profile.age === 'old') return Math.max(URBAN_SCALE.parcels.oldCommercialTargetArea, blockArea / Math.max(2, Math.min(8, divisions * 0.85)));
  if (profile.age === 'average') return Math.max(URBAN_SCALE.parcels.averageCommercialTargetArea, blockArea / Math.max(2, Math.min(5, divisions)));
  return Math.max(URBAN_SCALE.parcels.newCommercialTargetArea, blockArea / Math.max(1, Math.min(3, divisions)));
}

function shouldSubdivideParcel(polygon: Point[], profile: BuildingBlockProfile, depth: number, maxDepth: number) {
  if (depth >= maxDepth) return false;
  const area = polygonArea(polygon);
  if (area < MIN_SPLIT_CHILD_AREA * 2.1) return false;
  if (profile.use === 'park_open' || profile.use === 'landmark' || profile.use === 'civic_public') return false;
  const target = targetParcelArea(profile, area);
  if (!Number.isFinite(target) || area <= target * 1.35) return false;
  const frame = orientedFrame(polygon, profile.frontageAngle || 0);
  const long = Math.max(frame.width, frame.depth);
  const short = Math.min(frame.width, frame.depth);
  if (short < 8 || long / Math.max(1, short) > 7.2) return false;
  return true;
}

function subdivideObb(
  polygon: Point[],
  profile: BuildingBlockProfile,
  roadHazards: readonly RoadHazard[],
  rng: Rng,
  depth: number,
  maxDepth: number,
  path: string,
  generationKind: ParcelGenerationKind = 'interior-obb',
): ParcelLeaf[] {
  if (!shouldSubdivideParcel(polygon, profile, depth, maxDepth)) {
    return [{
      path,
      polygon,
      generationKind: depth === 0 ? generationKind : 'interior-obb',
      parcelCoverageRole: generationKind === 'whole-block' ? 'buildable' : 'interior',
      fieldAngle: profile.frontageAngle,
    }];
  }

  const frame = orientedFrame(polygon, profile.frontageAngle || 0);
  const irregularity = profile.age === 'old' ? 0.28 : profile.age === 'average' ? 0.16 : 0.08;
  let line = lineFromFrame(frame, rng, irregularity);
  let split = splitPolygonByLine(polygon, line.a, line.b);

  if (split && !polygonHasRoadAccess(split[0], roadHazards) && rng() < 0.7) {
    const rotatedFrame = { ...frame, width: frame.depth, depth: frame.width, axisU: frame.axisV, axisV: frame.axisU };
    line = lineFromFrame(rotatedFrame, rng, irregularity);
    split = splitPolygonByLine(polygon, line.a, line.b);
  }

  if (!split) return [{
    path,
    polygon,
    generationKind: depth === 0 ? generationKind : 'interior-obb',
    parcelCoverageRole: generationKind === 'whole-block' ? 'buildable' : 'interior',
    fieldAngle: profile.frontageAngle,
  }];
  const [left, right] = split;
  if (polygonArea(left) < MIN_SPLIT_CHILD_AREA || polygonArea(right) < MIN_SPLIT_CHILD_AREA) {
    return [{
      path,
      polygon,
      generationKind: depth === 0 ? generationKind : 'interior-obb',
      parcelCoverageRole: generationKind === 'whole-block' ? 'buildable' : 'interior',
      fieldAngle: profile.frontageAngle,
    }];
  }

  return [
    ...subdivideObb(left, profile, roadHazards, rng, depth + 1, maxDepth, `${path}a`, 'interior-obb'),
    ...subdivideObb(right, profile, roadHazards, rng, depth + 1, maxDepth, `${path}b`, 'interior-obb'),
  ];
}

function profileForParcel(
  blockProfile: BuildingBlockProfile,
  parcel: CityParcel,
  parcelFrontage: BlockFrontageAnalysis,
) {
  const shape = parcel.shape;
  const primary = parcelFrontage.primary;
  const explicitRoadIds = unique([...(parcel.frontageRoadIds || []), ...parcelFrontage.groups.flatMap((group) => group.roadIds)]);
  const fallbackUse = shape
    ? fallbackUseForUnclassifiedParcel({ shape, districtRole: blockProfile.districtLandUseRole })
    : null;
  const profile: BuildingBlockProfile = {
    ...blockProfile,
    use: fallbackUse || blockProfile.use,
    shapeFamily: shape?.family,
    shapeOrientation: shape?.orientation,
    triangleOrientation: shape?.triangleOrientation,
    shapeSideCount: shape?.sideCount,
    shapeSideKinds: shape?.sideKinds,
    shapeCornerAngles: shape?.cornerAngles,
    shapeConfidence: shape?.confidence,
    shapeTemplateHints: shape?.templateHints,
    shapeFallbackReason: fallbackUse ? shape?.fallbackReason || `${shape?.family}-fallback-${fallbackUse}` : shape?.fallbackReason,
    shapeReasons: shape?.reasons?.slice(0, 3),
    selectedTemplate: shape?.templateHints?.[0] || blockProfile.selectedTemplate,
    frontageGroupId: primary?.id || null,
    frontageRoadIds: parcel.frontageRoadIds?.length ? parcel.frontageRoadIds : primary?.roadIds || [],
    allFrontageRoadIds: explicitRoadIds,
    frontageRoadClass: primary?.roadClass || null,
    frontageScore: primary?.weightedScore || 0,
    frontageLength: primary?.totalLength || 0,
    frontageAngle: primary?.averageAngle ?? blockProfile.frontageAngle,
    envelopeArea: undefined,
    envelopeCoverage: undefined,
    placedCount: undefined,
    layoutFailure: undefined,
    parcelGenerationKind: parcel.generationKind,
    parcelCoverageRole: parcel.parcelCoverageRole,
    frontageSideCount: parcel.frontageSideCount,
    frontageDepth: parcel.frontageDepth,
    frontageWidth: parcel.frontageWidth,
    metrics: undefined,
  };
  if (fallbackUse) {
    profile.frontageDivisionCount = 0;
  }
  return profile;
}

function parcelKindForProfile(profile: BuildingBlockProfile, leaf: ParcelLeaf): CityParcel['kind'] {
  if (profile.use === 'park_open') return 'park';
  if (leaf.generationKind === 'patio') return 'patio';
  if (profile.use === 'infrastructure_service' || leaf.parcelCoverageRole === 'service') return 'service';
  return 'lot';
}

function shouldUseSingleWholeBlock(profile: BuildingBlockProfile) {
  return profile.use === 'park_open' || profile.use === 'landmark' || profile.use === 'civic_public';
}

function classifySmallRemainder(profile: BuildingBlockProfile, area: number): Pick<ParcelLeaf, 'generationKind' | 'parcelCoverageRole'> {
  if (profile.use === 'industrial' || profile.use === 'infrastructure_service') {
    return { generationKind: 'merge-recovery', parcelCoverageRole: 'service' };
  }
  if (area < MIN_PARCEL_AREA) return { generationKind: 'patio', parcelCoverageRole: 'open-space' };
  return { generationKind: 'merge-recovery', parcelCoverageRole: 'recovery' };
}

function buildParcelLeaves(
  block: CityBlock & Record<string, any>,
  blockProfile: BuildingBlockProfile,
  blockFrontage: BlockFrontageAnalysis,
  rng: Rng,
  options: BlockParcelizationOptions,
): ParcelLeaf[] {
  const blockPolygon = cleanPolygon(block.polygon || []);
  const blockArea = Number(block.area || polygonArea(blockPolygon));
  const roadHazards = options.roadHazards || [];
  const maxDepth = options.maxDepth ?? (blockArea > URBAN_SCALE.parcels.largeParcelArea ? 3 : blockArea > URBAN_SCALE.parcels.mediumParcelArea ? 2 : 1);

  if (shouldUseSingleWholeBlock(blockProfile) || !roadHazards.length) {
    return subdivideObb(blockPolygon, blockProfile, roadHazards, rng, 0, maxDepth, 'p', 'whole-block');
  }

  const blockCenter = block.centroid || polygonCentroid(blockPolygon);
  const frontageSides = detectFrontageSides(blockPolygon, roadHazards, blockFrontage);
  if (!frontageSides.length) {
    return subdivideObb(blockPolygon, blockProfile, roadHazards, rng, 0, maxDepth, 'p', 'whole-block');
  }

  const leaves: ParcelLeaf[] = [];
  let remaining = blockPolygon;
  const nominalDepth = frontageDepthForProfile(blockProfile);
  const blockDepth = Math.max(1, blockFrontage.blockDepth || Math.sqrt(blockArea));
  const depth = Math.max(4, Math.min(nominalDepth, blockDepth * 0.48));

  frontageSides.forEach((side, index) => {
    if (remaining.length < 3 || polygonArea(remaining) < 4) return;
    const previousArea = polygonArea(remaining);
    const strip = stripForSide(remaining, side, depth, blockCenter);
    if (strip.length < 3 || polygonArea(strip) < 2) return;
    const nextRemaining = remainingBehindSide(remaining, side, depth, blockCenter);
    const nextArea = nextRemaining.length >= 3 ? polygonArea(nextRemaining) : 0;
    const stripArea = polygonArea(strip);
    if (stripArea + nextArea < previousArea * 0.92) return;

    leaves.push(...sliceFrontageStrip(strip, side, frontageSides, blockProfile, blockCenter, `f${index}`));
    if (nextRemaining.length >= 3 && polygonArea(nextRemaining) >= 2) {
      remaining = nextRemaining;
    } else {
      remaining = [];
    }
  });

  const remainingArea = remaining.length >= 3 ? polygonArea(remaining) : 0;
  if (remainingArea >= MIN_SPLIT_CHILD_AREA) {
    leaves.push(...subdivideObb(remaining, blockProfile, roadHazards, rng, 0, Math.max(1, maxDepth - 1), 'i', 'interior-obb'));
  } else if (remainingArea >= 2) {
    const small = classifySmallRemainder(blockProfile, remainingArea);
    leaves.push({
      path: 'r0',
      polygon: remaining,
      generationKind: small.generationKind,
      parcelCoverageRole: small.parcelCoverageRole,
      fieldAngle: blockProfile.frontageAngle,
    });
  }

  if (!leaves.length) {
    return [{
      path: 'm0',
      polygon: blockPolygon,
      generationKind: 'merge-recovery',
      parcelCoverageRole: 'recovery',
      fieldAngle: blockProfile.frontageAngle,
    }];
  }

  return leaves;
}

export function subdivideBlockIntoParcels(
  block: CityBlock & Record<string, any>,
  blockProfile: BuildingBlockProfile,
  blockFrontage: BlockFrontageAnalysis,
  rng: Rng,
  options: BlockParcelizationOptions = {},
): CityParcel[] {
  const blockPolygon = block.polygon || [];
  const blockArea = Number(block.area || polygonArea(blockPolygon));
  if (blockPolygon.length < 3 || blockArea < MIN_PARCEL_AREA || block.buildable === false) return [];

  const leaves = buildParcelLeaves(block, blockProfile, blockFrontage, rng, options);
  return leaves.map((leaf, index) => {
    const area = polygonArea(leaf.polygon);
    const buildable = area >= MIN_PARCEL_AREA && leaf.parcelCoverageRole !== 'open-space' && leaf.generationKind !== 'patio';
    const parcel: CityParcel = {
      id: `${block.id}:parcel:${leaf.path}-${index}`,
      blockId: block.id,
      districtId: block.districtId,
      polygon: leaf.polygon,
      centroid: polygonCentroid(leaf.polygon),
      buildable,
      kind: parcelKindForProfile(blockProfile, leaf),
      area,
      fieldAngle: Number(leaf.fieldAngle ?? block.fieldAngle ?? blockProfile.frontageAngle ?? 0),
      generation: leaf.generationKind,
      generationKind: leaf.generationKind,
      frontageRoadIds: leaf.frontageRoadIds || [],
      frontageSideCount: leaf.frontageSideCount || 0,
      frontageDepth: leaf.frontageDepth,
      frontageWidth: leaf.frontageWidth,
      parentBlockArea: blockArea,
      parcelCoverageRole: leaf.parcelCoverageRole,
    };
    const parcelFrontage = options.roadHazards?.length
      ? analyzeBlockFrontage(parcel as CityBlock & Record<string, any>, options.roadHazards)
      : blockFrontage;
    parcel.frontageAnalysis = parcelFrontage;
    parcel.shape = classifyParcelShape(parcel as unknown as CityBlock & Record<string, any>, {
      frontageAnalysis: parcelFrontage,
      roadHazards: options.roadHazards,
      terrain: options.terrain,
    });
    parcel.planning = profileForParcel(blockProfile, parcel, parcelFrontage);
    return parcel;
  });
}
