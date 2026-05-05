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
  targetRoadDensity: number;
  continuationProbability: number;
  branchProbability: number;
  crossStreetProbability: number;
  deadEndProbability: number;
  loopProbability: number;
  segmentLengthMin: number;
  segmentLengthMax: number;
  maxUninterruptedLength: number;
  snapDistance: number;
  intersectionExtensionDistance: number;
  minParallelSpacing: number;
  minBlockArea: number;
  maxBlockAspect: number;
}

const ROAD_STYLE_PROFILES: Record<RoadStyleId, RoadStyleProfile> = {
  tight_grid: { id: 'tight_grid', spacing: 72, spacingJitter: 0.1, angleJitter: 0.05, curvature: 0, targetRoadDensity: 0.9, continuationProbability: 0.82, branchProbability: 0.18, crossStreetProbability: 0.72, deadEndProbability: 0.02, loopProbability: 0.18, segmentLengthMin: 40, segmentLengthMax: 112, maxUninterruptedLength: 136, snapDistance: 12, intersectionExtensionDistance: 28, minParallelSpacing: 28, minBlockArea: 1520, maxBlockAspect: 7 },
  loose_grid: { id: 'loose_grid', spacing: 104, spacingJitter: 0.24, angleJitter: 0.12, curvature: 0.08, targetRoadDensity: 0.68, continuationProbability: 0.74, branchProbability: 0.22, crossStreetProbability: 0.58, deadEndProbability: 0.04, loopProbability: 0.12, segmentLengthMin: 48, segmentLengthMax: 144, maxUninterruptedLength: 176, snapDistance: 12, intersectionExtensionDistance: 32, minParallelSpacing: 36, minBlockArea: 1840, maxBlockAspect: 7.5 },
  curvy_residential: { id: 'curvy_residential', spacing: 112, spacingJitter: 0.32, angleJitter: 0.22, curvature: 0.26, targetRoadDensity: 0.54, continuationProbability: 0.66, branchProbability: 0.34, crossStreetProbability: 0.34, deadEndProbability: 0.16, loopProbability: 0.1, segmentLengthMin: 48, segmentLengthMax: 136, maxUninterruptedLength: 168, snapDistance: 16, intersectionExtensionDistance: 36, minParallelSpacing: 40, minBlockArea: 1920, maxBlockAspect: 8 },
  industrial_spine: { id: 'industrial_spine', spacing: 144, spacingJitter: 0.18, angleJitter: 0.08, curvature: 0.04, targetRoadDensity: 0.42, continuationProbability: 0.86, branchProbability: 0.18, crossStreetProbability: 0.24, deadEndProbability: 0.1, loopProbability: 0.04, segmentLengthMin: 64, segmentLengthMax: 192, maxUninterruptedLength: 232, snapDistance: 20, intersectionExtensionDistance: 40, minParallelSpacing: 56, minBlockArea: 2880, maxBlockAspect: 9 },
  coastal_curve: { id: 'coastal_curve', spacing: 96, spacingJitter: 0.22, angleJitter: 0.16, curvature: 0.22, targetRoadDensity: 0.58, continuationProbability: 0.7, branchProbability: 0.24, crossStreetProbability: 0.38, deadEndProbability: 0.06, loopProbability: 0.12, segmentLengthMin: 48, segmentLengthMax: 136, maxUninterruptedLength: 168, snapDistance: 16, intersectionExtensionDistance: 36, minParallelSpacing: 36, minBlockArea: 1680, maxBlockAspect: 8 },
  old_core: { id: 'old_core', spacing: 64, spacingJitter: 0.38, angleJitter: 0.2, curvature: 0.1, targetRoadDensity: 0.96, continuationProbability: 0.68, branchProbability: 0.32, crossStreetProbability: 0.68, deadEndProbability: 0.08, loopProbability: 0.18, segmentLengthMin: 32, segmentLengthMax: 96, maxUninterruptedLength: 128, snapDistance: 12, intersectionExtensionDistance: 28, minParallelSpacing: 24, minBlockArea: 1280, maxBlockAspect: 8.5 },
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
      generator: edge.source === 'coast-road' ? 'coast' : edge.source === 'pm2001-road' ? 'local-constraint' : edge.source === 'v35-road' ? 'global-goal' : 'fallback',
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
  const subjects = district.pm2001UseOwnershipSeed ? fallbackEntries : sourceEntries.length ? sourceEntries : fallbackEntries;
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

// Compute graph-connectivity metrics for a set of PM2001-generated local roads.
//
// largestComponentRatio: fraction of total local-road length in the single largest
//   connected component. Connectivity is counted both through direct endpoint proximity
//   between local roads AND through shared connections to the same existing road edge,
//   so roads in separate districts that both tie into the macro network are treated as
//   connected. This matches the spec intent: "after intersection splitting" across the
//   full road graph.
//
// connectedEndpointRatio: fraction of local road endpoints that touch another road,
//   node, gateway, or loop (either a peer local road or an existing road edge).
export function pm2001RoadConnectivityMetrics(
  localRoads: readonly RoadEdge[],
  existingEdges: readonly RoadEdge[],
  snapDist = 20,
): { largestComponentRatio: number; connectedEndpointRatio: number } {
  if (!localRoads.length) return { largestComponentRatio: 1, connectedEndpointRatio: 1 };

  const ptsOf = (edge: RoadEdge): Point[] => edgeCenterline(edge);
  const endpointsOf = (edge: RoadEdge): [Point, Point] => {
    const pts = edgeCenterline(edge);
    return [pts[0], pts[pts.length - 1]];
  };

  const n = localRoads.length;
  const m = existingEdges.length;
  // Union-find over n local roads + m existing edges as virtual connector nodes.
  // Indices [0, n-1] = local roads; [n, n+m-1] = existing edges.
  const parent = Array.from({ length: n + m }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function unite(i: number, j: number) { parent[find(i)] = find(j); }

  const eps = Math.max(snapDist * 2, 6);
  const localPts = localRoads.map(ptsOf);
  const localEps = localRoads.map(endpointsOf);
  const existingPts = existingEdges.map(ptsOf);

  // Union local roads that directly share/near endpoints or T-intersect
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue;
      const [si, ei] = localEps[i];
      const [sj, ej] = localEps[j];
      const nearEp =
        Math.hypot(si.x - sj.x, si.y - sj.y) <= eps ||
        Math.hypot(si.x - ej.x, si.y - ej.y) <= eps ||
        Math.hypot(ei.x - sj.x, ei.y - sj.y) <= eps ||
        Math.hypot(ei.x - ej.x, ei.y - ej.y) <= eps;
      if (nearEp) { unite(i, j); continue; }
      // T-intersections
      const pj = localPts[j];
      const pi = localPts[i];
      let hit = false;
      for (const ep of [si, ei]) {
        for (let k = 0; k + 1 < pj.length && !hit; k++) {
          if (pointToSegmentDist(ep.x, ep.y, pj[k], pj[k + 1]) <= eps) hit = true;
        }
      }
      if (!hit) {
        for (const ep of [sj, ej]) {
          for (let k = 0; k + 1 < pi.length && !hit; k++) {
            if (pointToSegmentDist(ep.x, ep.y, pi[k], pi[k + 1]) <= eps) hit = true;
          }
        }
      }
      if (hit) unite(i, j);
    }
  }

  // Union local roads to existing edge virtual nodes (cross-district connectivity)
  for (let i = 0; i < n; i++) {
    const [si, ei] = localEps[i];
    for (let j = 0; j < m; j++) {
      const ePts = existingPts[j];
      for (let k = 0; k + 1 < ePts.length; k++) {
        const distS = pointToSegmentDist(si.x, si.y, ePts[k], ePts[k + 1]);
        const distE = pointToSegmentDist(ei.x, ei.y, ePts[k], ePts[k + 1]);
        if (distS <= eps * 1.5 || distE <= eps * 1.5) {
          unite(i, n + j);
          break;
        }
      }
    }
  }

  // Measure component lengths (only over local roads)
  const componentLength = new Map<number, number>();
  let totalLength = 0;
  for (let i = 0; i < n; i++) {
    const pts = localPts[i];
    let len = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      len += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y);
    }
    const c = find(i);
    componentLength.set(c, (componentLength.get(c) ?? 0) + len);
    totalLength += len;
  }

  const largestComponent = componentLength.size ? Math.max(...componentLength.values()) : 0;
  const largestComponentRatio = totalLength > 0 ? largestComponent / totalLength : 1;

  // Connected endpoint ratio: endpoint touches any road (local or existing)
  let connectedEndpoints = 0;
  let totalEndpoints = 0;
  for (let i = 0; i < n; i++) {
    const [start, end] = localEps[i];
    for (const ep of [start, end]) {
      totalEndpoints++;
      let connected = false;
      for (let j = 0; j < n && !connected; j++) {
        if (j === i) continue;
        const [sj, ej] = localEps[j];
        if (Math.hypot(ep.x - sj.x, ep.y - sj.y) <= eps || Math.hypot(ep.x - ej.x, ep.y - ej.y) <= eps) {
          connected = true;
        }
        const pj = localPts[j];
        for (let k = 0; k + 1 < pj.length && !connected; k++) {
          if (pointToSegmentDist(ep.x, ep.y, pj[k], pj[k + 1]) <= eps) connected = true;
        }
      }
      for (let j = 0; j < m && !connected; j++) {
        const ePts = existingPts[j];
        for (let k = 0; k + 1 < ePts.length && !connected; k++) {
          if (pointToSegmentDist(ep.x, ep.y, ePts[k], ePts[k + 1]) <= eps * 1.5) connected = true;
        }
      }
      if (connected) connectedEndpoints++;
    }
  }

  const connectedEndpointRatio = totalEndpoints > 0 ? connectedEndpoints / totalEndpoints : 1;
  return { largestComponentRatio, connectedEndpointRatio };
}
