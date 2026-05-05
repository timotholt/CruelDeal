import { pointInPolygon, pointToSegmentDist, polygonArea, polygonCentroid, segIntersect } from './geometry';
import { splitPolygonByLine } from './partition';
import { polygonBoolean, type PolygonSet } from './polygon-boolean';
import { polygonToPath } from './paths';
import { URBAN_SCALE } from './urban-units';
import type { CityBlock, CityDistrict, PhysicalRoadClass, Point, RoadEdge, RoadStyleId } from './types';

interface RoadStyleProfile {
  id: RoadStyleId;
  spacing: number;
  spacingJitter: number;
  angleJitter: number;
  curvature: number;
  branchProbability: number;
  deadEndProbability: number;
  loopProbability: number;
  snapDistance: number;
  minBlockArea: number;
  maxBlockAspect: number;
}

const ROAD_STYLE_PROFILES: Record<RoadStyleId, RoadStyleProfile> = {
  tight_grid: { id: 'tight_grid', spacing: 18, spacingJitter: 0.1, angleJitter: 0.05, curvature: 0, branchProbability: 0.08, deadEndProbability: 0.02, loopProbability: 0.18, snapDistance: 3, minBlockArea: 95, maxBlockAspect: 7 },
  loose_grid: { id: 'loose_grid', spacing: 26, spacingJitter: 0.24, angleJitter: 0.12, curvature: 0.08, branchProbability: 0.12, deadEndProbability: 0.04, loopProbability: 0.12, snapDistance: 3, minBlockArea: 115, maxBlockAspect: 7.5 },
  curvy_residential: { id: 'curvy_residential', spacing: 28, spacingJitter: 0.32, angleJitter: 0.22, curvature: 0.26, branchProbability: 0.24, deadEndProbability: 0.16, loopProbability: 0.1, snapDistance: 4, minBlockArea: 120, maxBlockAspect: 8 },
  industrial_spine: { id: 'industrial_spine', spacing: 36, spacingJitter: 0.18, angleJitter: 0.08, curvature: 0.04, branchProbability: 0.08, deadEndProbability: 0.1, loopProbability: 0.04, snapDistance: 5, minBlockArea: 180, maxBlockAspect: 9 },
  coastal_curve: { id: 'coastal_curve', spacing: 24, spacingJitter: 0.22, angleJitter: 0.16, curvature: 0.22, branchProbability: 0.14, deadEndProbability: 0.06, loopProbability: 0.12, snapDistance: 4, minBlockArea: 105, maxBlockAspect: 8 },
  old_core: { id: 'old_core', spacing: 16, spacingJitter: 0.38, angleJitter: 0.2, curvature: 0.1, branchProbability: 0.18, deadEndProbability: 0.08, loopProbability: 0.18, snapDistance: 3, minBlockArea: 80, maxBlockAspect: 8.5 },
};

export function roadStyleForDistrict(district: CityDistrict & Record<string, any>): RoadStyleProfile {
  const role = String(district.landUseRole || district.districtLandUseRole || '');
  const idx = Number(district.idx || String(district.id || '').match(/district-(\d+)/)?.[1] || 0);
  if (district.landmassId && district.landmassId !== 'mainland') return ROAD_STYLE_PROFILES.coastal_curve;
  if (role.includes('waterfront')) return ROAD_STYLE_PROFILES.coastal_curve;
  if (role.includes('backland')) return ROAD_STYLE_PROFILES.curvy_residential;
  if (role.includes('commercial') || role.includes('civic')) return ROAD_STYLE_PROFILES.tight_grid;
  if (role.includes('old') || idx === 0) return ROAD_STYLE_PROFILES.old_core;
  return idx === 2 ? ROAD_STYLE_PROFILES.curvy_residential : ROAD_STYLE_PROFILES.loose_grid;
}

export function physicalRoadClassForEdge(edge: RoadEdge): PhysicalRoadClass {
  const kind = String(edge.kind || edge.render?.materialKey || '');
  if (kind === 'highway') return 'highway';
  if (edge.source === 'coast-road' || kind === 'avenue') return 'avenue';
  if (kind === 'local') return 'local';
  if (edge.source === 'v35-river-bank') return 'service';
  if (kind === 'alley') return 'alley';
  return 'street';
}

export function physicalRoadWidthForClass(roadClass: PhysicalRoadClass) {
  if (roadClass === 'highway') return URBAN_SCALE.roads.highwayCorridor;
  if (roadClass === 'arterial' || roadClass === 'avenue') return URBAN_SCALE.roads.majorCorridor;
  if (roadClass === 'street') return URBAN_SCALE.roads.minorCorridor;
  if (roadClass === 'local') return URBAN_SCALE.roads.localCorridor;
  if (roadClass === 'alley') return URBAN_SCALE.roads.alleyCorridor;
  return URBAN_SCALE.roads.serviceCorridor;
}

function edgeCenterline(edge: RoadEdge) {
  const points = edge.centerline || (edge as RoadEdge & { points?: Point[] }).points;
  if (Array.isArray(points) && points.length >= 2) return points.map((point) => ({ x: point.x, y: point.y }));
  return [edge.a, edge.b].filter(Boolean).map((point) => ({ x: point.x, y: point.y }));
}

function centerlineSegments(edge: RoadEdge) {
  const centerline = edgeCenterline(edge);
  const segments: Array<[Point, Point]> = [];
  for (let i = 0; i + 1 < centerline.length; i++) {
    segments.push([centerline[i], centerline[i + 1]]);
  }
  return segments;
}

function normalForSegment(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function unitForSegment(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function averageNormal(points: readonly Point[], index: number) {
  const normals = [];
  if (index > 0) normals.push(normalForSegment(points[index - 1], points[index]));
  if (index + 1 < points.length) normals.push(normalForSegment(points[index], points[index + 1]));
  const nx = normals.reduce((sum, normal) => sum + normal.x, 0);
  const ny = normals.reduce((sum, normal) => sum + normal.y, 0);
  const len = Math.hypot(nx, ny) || 1;
  return { x: nx / len, y: ny / len };
}

export function roadCorridorPolygon(edge: RoadEdge): Point[] {
  const centerline = edgeCenterline(edge);
  if (centerline.length < 2) return [];
  const width = Number(edge.physicalWidth || physicalRoadWidthForClass(edge.roadClass || physicalRoadClassForEdge(edge)));
  const half = Math.max(0.5, width * 0.5);
  const capped = centerline.map((point) => ({ x: point.x, y: point.y }));
  const startDir = unitForSegment(centerline[0], centerline[1]);
  const endDir = unitForSegment(centerline[centerline.length - 2], centerline[centerline.length - 1]);
  capped[0] = { x: capped[0].x - startDir.x * half, y: capped[0].y - startDir.y * half };
  capped[capped.length - 1] = {
    x: capped[capped.length - 1].x + endDir.x * half,
    y: capped[capped.length - 1].y + endDir.y * half,
  };
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i < capped.length; i++) {
    const n = averageNormal(capped, i);
    const p = capped[i];
    left.push({ x: p.x + n.x * half, y: p.y + n.y * half });
    right.push({ x: p.x - n.x * half, y: p.y - n.y * half });
  }
  return [...left, ...right.reverse()];
}

export function attachPM2001RoadMetadata(edges: RoadEdge[], defaultStyleId: RoadStyleId = 'loose_grid') {
  for (const edge of edges) {
    const roadClass = edge.roadClass || physicalRoadClassForEdge(edge);
    const centerline = edgeCenterline(edge);
    edge.roadClass = roadClass;
    edge.physicalWidth = edge.physicalWidth || physicalRoadWidthForClass(roadClass);
    edge.centerline = centerline;
    edge.corridorPolygon = edge.corridorPolygon || roadCorridorPolygon(edge);
    edge.pm2001 = edge.pm2001 || {
      generator: edge.source === 'coast-road' ? 'coast' : edge.source === 'v35-road' ? 'global-goal' : 'fallback',
      styleId: defaultStyleId,
      hierarchyDepth: roadClass === 'highway' ? 0 : roadClass === 'avenue' || roadClass === 'arterial' ? 1 : roadClass === 'street' ? 2 : 3,
    };
  }
  return edges;
}

function bboxAspect(polygon: readonly Point[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return Math.max(w, h) / Math.max(1, Math.min(w, h));
}

function roadMaskForDistrict(districtPolygon: Point[], roadEdges: readonly RoadEdge[]) {
  const masks: PolygonSet = [];
  for (const edge of roadEdges) {
    // Coast roads are usually closed boundary loops around already-inset land.
    // Treating them like open road polylines can create self-overlapping bands
    // that swallow the whole district. They remain frontage/value roads; they
    // just do not participate in PM2001 interior face cutting yet.
    if (edge.source === 'coast-road') continue;
    const corridor = edge.corridorPolygon || roadCorridorPolygon(edge);
    if (corridor.length < 3) continue;
    const clipped = polygonBoolean.intersection([districtPolygon], [corridor]);
    masks.push(...clipped);
  }
  return polygonBoolean.union(masks);
}

function segmentTouchesPolygon(a: Point, b: Point, polygon: readonly Point[]) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (pointInPolygon(a, polygon) || pointInPolygon(b, polygon) || pointInPolygon(mid, polygon)) return true;
  for (let i = 0; i < polygon.length; i++) {
    if (segIntersect(a, b, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  }
  return false;
}

function splitPolygonByRoadCenterlines(polygon: Point[], roadEdges: readonly RoadEdge[]) {
  let faces = [polygon];
  for (const edge of roadEdges) {
    if (edge.source === 'coast-road') continue;
    for (const [a, b] of centerlineSegments(edge)) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 3) continue;
      const ux = dx / len;
      const uy = dy / len;
      const p1 = { x: a.x - ux * 4000, y: a.y - uy * 4000 };
      const p2 = { x: b.x + ux * 4000, y: b.y + uy * 4000 };
      const next: Point[][] = [];
      for (const face of faces) {
        if (!segmentTouchesPolygon(a, b, face)) {
          next.push(face);
          continue;
        }
        const split = splitPolygonByLine(face, p1, p2);
        if (split) {
          next.push(split[0], split[1]);
        } else {
          next.push(face);
        }
      }
      faces = next;
    }
  }
  return faces.filter((face) => face.length >= 3 && polygonArea(face) > 20);
}

function boundedRoadIdsForFace(face: readonly Point[], roadEdges: readonly RoadEdge[]) {
  const ids: string[] = [];
  for (const edge of roadEdges) {
    const centerline = edgeCenterline(edge);
    const threshold = Math.max(1.5, Number(edge.physicalWidth || 4) * 0.65);
    let close = false;
    for (let i = 0; i + 1 < centerline.length && !close; i++) {
      for (const point of face) {
        if (pointToSegmentDist(point.x, point.y, centerline[i], centerline[i + 1]) <= threshold) {
          close = true;
          break;
        }
      }
    }
    if (close) ids.push(edge.id);
  }
  return Array.from(new Set(ids));
}

function faceContainsRoadCenterlineSample(face: readonly Point[], roadEdges: readonly RoadEdge[]) {
  for (const edge of roadEdges) {
    if (edge.source === 'coast-road') continue;
    const centerline = edgeCenterline(edge);
    for (let i = 0; i < centerline.length; i++) {
      if (pointInPolygon(centerline[i], face)) return true;
      if (i + 1 < centerline.length) {
        const mid = {
          x: (centerline[i].x + centerline[i + 1].x) / 2,
          y: (centerline[i].y + centerline[i + 1].y) / 2,
        };
        if (pointInPolygon(mid, face)) return true;
      }
    }
  }
  return false;
}

export interface PM2001BlockFaceResult {
  blocks: Array<CityBlock & Record<string, any>>;
  roadMask: PolygonSet;
  rejectedFaces: PolygonSet;
}

export function buildPM2001BlockFacesForDistrict(
  district: CityDistrict & Record<string, any>,
  roadEdges: readonly RoadEdge[],
): PM2001BlockFaceResult {
  const style = roadStyleForDistrict(district);
  const sourceEntries = ((district.blocks || []) as Array<CityBlock & Record<string, any>>)
    .filter((block) => block.polygon?.length >= 3 && polygonArea(block.polygon) > 20)
    .map((block) => ({ id: block.id, polygon: block.polygon, legacyBlock: block }));
  const fallbackEntries = ((district.ownershipPolygons?.length ? district.ownershipPolygons : district.polygons || []) as Point[][])
    .filter((polygon) => polygon?.length >= 3 && polygonArea(polygon) > 20)
    .map((polygon, index) => ({ id: `${district.id}:ownership:${index}`, polygon, legacyBlock: null }));
  const subjects = sourceEntries.length ? sourceEntries : fallbackEntries;
  const candidateFaces: PolygonSet = [];
  const roadMask: PolygonSet = [];
  const rejectedFaces: PolygonSet = [];
  const faceSources: Array<{ sourceId: string; legacyBlock: (CityBlock & Record<string, any>) | null }> = [];

  for (const subject of subjects) {
    const seedPolygon = subject.polygon;
    if (!seedPolygon || seedPolygon.length < 3) continue;
    const simpleSubjects = splitPolygonByRoadCenterlines(seedPolygon, roadEdges);
    for (const polygon of simpleSubjects) {
      const mask = roadMaskForDistrict(polygon, roadEdges);
    roadMask.push(...mask);
    const faces = polygonBoolean.difference([polygon], mask);
    for (const face of faces) {
      candidateFaces.push(face);
      faceSources.push({ sourceId: subject.id, legacyBlock: subject.legacyBlock });
    }
    }
  }

  const blocks = candidateFaces
    .map((face, index) => {
      const source = faceSources[index] || { sourceId: `${district.id}:unknown`, legacyBlock: null };
      const area = polygonArea(face);
      const aspect = bboxAspect(face);
      const hasRoadSample = faceContainsRoadCenterlineSample(face, roadEdges);
      const buildable = !hasRoadSample && area >= style.minBlockArea && aspect <= style.maxBlockAspect;
      if (hasRoadSample) rejectedFaces.push(face);
      if (!buildable && area < Math.max(20, style.minBlockArea * 0.55)) rejectedFaces.push(face);
      const boundedByRoadIds = boundedRoadIdsForFace(face, roadEdges);
      const centroid = polygonCentroid(face);
      return {
        id: `${district.id}:block-face:${index}`,
        districtId: district.id,
        landmassId: district.landmassId,
        polygon: face,
        path: polygonToPath(face),
        centroid,
        area,
        source: 'pm2001-road-face',
        legacyBlockId: source.sourceId,
        boundedByRoadIds,
        roadStyleId: style.id,
        fieldAngle: Number(source.legacyBlock?.fieldAngle ?? (district as any).fieldAngle ?? 0),
        buildable,
        density: area > 850 ? 'dense' : area > 360 ? 'medium' : 'sparse',
        bigLandmark: !!source.legacyBlock?.bigLandmark,
      } as CityBlock & Record<string, any>;
    })
    .filter((block) => block.area > 36 && !rejectedFaces.includes(block.polygon));

  return { blocks, roadMask: polygonBoolean.union(roadMask), rejectedFaces };
}

export function pointInRoadCorridor(point: Point, roadEdges: readonly RoadEdge[]) {
  return roadEdges.some((edge) => {
    const corridor = edge.corridorPolygon || [];
    return corridor.length >= 3 && pointInPolygon(point, corridor);
  });
}
