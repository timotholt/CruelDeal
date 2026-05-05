import { VIEW_H, VIEW_W } from "./config";
import {
  closestPointOnPolygon,
  distToRiver,
  pointInPolygon,
  pointToSegmentDist,
  polygonArea,
  polygonBBox,
  polygonCentroid,
  polygonToPolygonDist
} from "./geometry";
import { polygonToPath, smoothClosedPath } from "./paths";
import { generateLandPolygon } from "./land";
import { generateRivers, type RiverPlan, type Segment } from "./water";

type Rng = () => number;

export const MIN_ISLAND_CHANNEL = 56;

export interface Point {
  x: number;
  y: number;
  edgeKind?: string;
}

export interface LandmassPlan {
  id: string;
  kind: "mainland" | "island";
  isPrimary: boolean;
  compositionRole?: "satellite-balance" | string;
  polygon: Point[];
  path: string;
  hardPath: string;
  area: number;
  visibleArea: number;
  centroid: Point;
  bbox: ReturnType<typeof polygonBBox>;
  minimumChannel?: number;
}

export interface TerrainPlan {
  version: 1;
  bounds: { x: number; y: number; w: number; h: number };
  landmasses: LandmassPlan[];
  mainland: LandmassPlan;
  waterBodies: Array<Record<string, unknown>>;
  coastline: ReturnType<typeof buildCoastline>;
  channels: ReturnType<typeof buildChannels>;
  elevation: ReturnType<typeof makeElevation>;
}

function viewportPolygon(): Point[] {
  return [
    { x: 0, y: 0 },
    { x: VIEW_W, y: 0 },
    { x: VIEW_W, y: VIEW_H },
    { x: 0, y: VIEW_H }
  ];
}

function polygonEdges(polygon: Point[]) {
  const edges = [];
  for (let i = 0; i < polygon.length; i++) {
    edges.push({ a: polygon[i], b: polygon[(i + 1) % polygon.length], index: i });
  }
  return edges;
}

function visibleSampleArea(polygon: Point[], step = 32) {
  let count = 0;
  for (let x = step / 2; x < VIEW_W; x += step) {
    for (let y = step / 2; y < VIEW_H; y += step) {
      if (pointInPolygon({ x, y }, polygon)) count++;
    }
  }
  return count * step * step;
}

function pointEdgeDistance(point: Point, polygon: Point[]) {
  let best = Infinity;
  for (const edge of polygonEdges(polygon)) {
    best = Math.min(best, pointToSegmentDist(point.x, point.y, edge.a, edge.b));
  }
  return best;
}

export function allPointsInside(poly: Point[], container: Point[], minEdgeClearance = 0) {
  for (const p of poly) {
    if (!pointInPolygon(p, container)) return false;
    if (minEdgeClearance > 0 && pointEdgeDistance(p, container) < minEdgeClearance) return false;
  }
  return true;
}

function makeBlob(cx: number, cy: number, radius: number, rng: Rng, sides = 18, variance = 0.34): Point[] {
  const pts: Point[] = [];
  const phase = rng() * Math.PI * 2;
  const xSquash = 0.72 + rng() * 0.62;
  const ySquash = 0.72 + rng() * 0.62;
  for (let i = 0; i < sides; i++) {
    const a = phase + (Math.PI * 2 * i) / sides;
    const noise =
      1 +
      Math.sin(a * 2.1 + phase) * variance * 0.28 +
      Math.sin(a * 3.7 + phase * 0.7) * variance * 0.22 +
      (rng() - 0.5) * variance;
    pts.push({ x: cx + Math.cos(a) * radius * xSquash * noise, y: cy + Math.sin(a) * radius * ySquash * noise });
  }
  return pts;
}

function coastClassification(midpoint: Point, centroid: Point, avgRadius: number) {
  const d = Math.hypot(midpoint.x - centroid.x, midpoint.y - centroid.y);
  if (d < avgRadius * 0.76) return "inlet";
  if (d > avgRadius * 1.12) return "headland";
  return "coast";
}

export function buildCoastline(landmasses: LandmassPlan[]) {
  const edges = [];
  const docksAllowedEdges: string[] = [];
  const bridgeAllowedEdges: string[] = [];

  for (const landmass of landmasses) {
    const centroid = landmass.centroid;
    const radii = landmass.polygon.map((p) => Math.hypot(p.x - centroid.x, p.y - centroid.y));
    const avgRadius = radii.reduce((sum, r) => sum + r, 0) / Math.max(1, radii.length);
    for (const edge of polygonEdges(landmass.polygon)) {
      const dx = edge.b.x - edge.a.x;
      const dy = edge.b.y - edge.a.y;
      const length = Math.hypot(dx, dy);
      const midpoint = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };
      let nx = -dy / (length || 1);
      let ny = dx / (length || 1);
      if ((centroid.x - midpoint.x) * nx + (centroid.y - midpoint.y) * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const kind = coastClassification(midpoint, centroid, avgRadius);
      const id = `${landmass.id}:edge:${edge.index}`;
      const data = {
        id,
        landmassId: landmass.id,
        index: edge.index,
        a: edge.a,
        b: edge.b,
        length,
        midpoint,
        outward: { x: nx, y: ny },
        kind,
        dockable: length >= 96 && kind !== "inlet",
        bridgeable: length >= 72
      };
      edges.push(data);
      if (data.dockable) docksAllowedEdges.push(id);
      if (data.bridgeable) bridgeAllowedEdges.push(id);
    }
  }

  return { edges, docksAllowedEdges, bridgeAllowedEdges };
}

function makeLandmass(id: string, kind: "mainland" | "island", polygon: Point[], extra: Partial<LandmassPlan> = {}): LandmassPlan {
  return {
    id,
    kind,
    isPrimary: kind === "mainland",
    polygon,
    path: smoothClosedPath(polygon),
    hardPath: polygonToPath(polygon),
    area: polygonArea(polygon),
    visibleArea: visibleSampleArea(polygon),
    centroid: polygonCentroid(polygon),
    bbox: polygonBBox(polygon),
    ...extra
  };
}

function makeIslandCandidate(landPolygon: Point[], rng: Rng) {
  const side = Math.floor(rng() * 4);
  const waterPad = 64;
  let cx: number;
  let cy: number;
  if (side === 0) {
    cx = -waterPad + rng() * (VIEW_W + waterPad * 2);
    cy = 72 + rng() * 296;
  } else if (side === 1) {
    cx = VIEW_W - 296 + rng() * 368;
    cy = -waterPad + rng() * (VIEW_H + waterPad * 2);
  } else if (side === 2) {
    cx = -waterPad + rng() * (VIEW_W + waterPad * 2);
    cy = VIEW_H - 296 + rng() * 368;
  } else {
    cx = -72 + rng() * 368;
    cy = -waterPad + rng() * (VIEW_H + waterPad * 2);
  }
  if (pointInPolygon({ x: cx, y: cy }, landPolygon)) return null;
  const radius = 88 + rng() * 184;
  const poly = makeBlob(cx, cy, radius, rng, 16 + Math.floor(rng() * 7), 0.38);
  const visibleVerts = poly.filter((p) => p.x > -24 && p.x < VIEW_W + 24 && p.y > -24 && p.y < VIEW_H + 24).length;
  if (visibleVerts < 4) return null;
  if (polygonToPolygonDist(poly, landPolygon) < MIN_ISLAND_CHANNEL) return null;
  return poly;
}

function planTerrainIslands(landPolygon: Point[], rng: Rng, riverSegments: Segment[]) {
  const visibleLand = visibleSampleArea(landPolygon);
  const waterFraction = Math.max(0, 1 - visibleLand / (VIEW_W * VIEW_H));
  if (waterFraction < 0.12) return addCompositionSatelliteIslandIfNeeded(landPolygon, [], rng, riverSegments);
  const target = waterFraction > 0.34 ? 2 : rng() < 0.88 ? 1 : 0;
  const islands: LandmassPlan[] = [];
  for (let attempt = 0; attempt < 140 && islands.length < target; attempt++) {
    const poly = makeIslandCandidate(landPolygon, rng);
    if (!poly) continue;
    if (riverSegments.length && poly.some((p) => distToRiver(p.x, p.y, riverSegments) < 48)) continue;
    if (islands.some((existing) => polygonToPolygonDist(poly, existing.polygon) < 64)) continue;
    // Reject islands too close to mainland — they overlap visually with mainland
    // and produce confusing ghost districts on top of the main land mass.
    const distToMainland = polygonToPolygonDist(poly, landPolygon);
    if (distToMainland < 64) continue;
    islands.push(makeLandmass(`island-${islands.length + 1}`, "island", poly, { minimumChannel: distToMainland }));
  }
  return addCompositionSatelliteIslandIfNeeded(landPolygon, islands, rng, riverSegments);
}

type CompositionQuadrantId = "nw" | "ne" | "sw" | "se";

function quadrantVisibleSampleArea(polygon: Point[], bounds: { minX: number; minY: number; maxX: number; maxY: number }, step = 32) {
  let count = 0;
  for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
    for (let y = bounds.minY + step / 2; y < bounds.maxY; y += step) {
      if (pointInPolygon({ x, y }, polygon)) count++;
    }
  }
  return count * step * step;
}

function compositionQuadrantBounds(id: CompositionQuadrantId) {
  const west = { minX: 32, maxX: VIEW_W * 0.42 };
  const east = { minX: VIEW_W * 0.58, maxX: VIEW_W - 32 };
  const north = { minY: 32, maxY: VIEW_H * 0.38 };
  const south = { minY: VIEW_H * 0.62, maxY: VIEW_H - 32 };
  return {
    ...(id === "nw" || id === "sw" ? west : east),
    ...(id === "nw" || id === "ne" ? north : south),
  };
}

function satelliteCentersForQuadrant(id: CompositionQuadrantId) {
  const bounds = compositionQuadrantBounds(id);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const sx = bounds.maxX - bounds.minX;
  const sy = bounds.maxY - bounds.minY;
  return [
    { x: cx, y: cy, r: 96 },
    { x: cx + sx * 0.18, y: cy - sy * 0.12, r: 88 },
    { x: cx - sx * 0.16, y: cy + sy * 0.14, r: 84 },
    { x: cx + sx * 0.08, y: cy + sy * 0.2, r: 76 },
    { x: cx - sx * 0.2, y: cy - sy * 0.18, r: 72 },
  ];
}

function makeSatelliteCandidate(quadrantId: CompositionQuadrantId, index: number, rng: Rng) {
  const centers = satelliteCentersForQuadrant(quadrantId);
  const base = centers[index % centers.length];
  const cx = base.x + (rng() - 0.5) * 72;
  const cy = base.y + (rng() - 0.5) * 72;
  const radius = base.r + (rng() - 0.5) * 24;
  return makeBlob(cx, cy, radius, rng, 14 + Math.floor(rng() * 5), 0.28);
}

function emptiestCompositionQuadrant(landPolygon: Point[], islands: LandmassPlan[]) {
  const quadrants: CompositionQuadrantId[] = ["nw", "ne", "sw", "se"];
  return quadrants
    .map((id) => {
      const bounds = compositionQuadrantBounds(id);
      const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
      const mainlandMass = quadrantVisibleSampleArea(landPolygon, bounds);
      const islandMass = islands.reduce((sum, island) => sum + quadrantVisibleSampleArea(island.polygon, bounds), 0);
      return { id, share: (mainlandMass + islandMass) / Math.max(1, area) };
    })
    .sort((a, b) => a.share - b.share)[0];
}

function addCompositionSatelliteIslandIfNeeded(
  landPolygon: Point[],
  islands: LandmassPlan[],
  rng: Rng,
  riverSegments: Segment[],
) {
  const target = emptiestCompositionQuadrant(landPolygon, islands);
  if (!target || target.share >= 0.38) return islands;

  for (let attempt = 0; attempt < 12; attempt++) {
    const poly = makeSatelliteCandidate(target.id, attempt, rng);
    const visibleVerts = poly.filter((p) => p.x > 32 && p.x < VIEW_W - 32 && p.y > 32 && p.y < VIEW_H - 32).length;
    if (visibleVerts < 4) continue;
    if (poly.some((p) => pointInPolygon(p, landPolygon))) continue;
    if (riverSegments.length && poly.some((p) => distToRiver(p.x, p.y, riverSegments) < 48)) continue;
    if (islands.some((existing) => polygonToPolygonDist(poly, existing.polygon) < 64)) continue;

    const distToMainland = polygonToPolygonDist(poly, landPolygon);
    if (distToMainland < MIN_ISLAND_CHANNEL) continue;

    const satellite = makeLandmass(`island-${islands.length + 1}`, "island", poly, {
      compositionRole: `satellite-balance:${target.id}`,
      minimumChannel: distToMainland,
    });
    if (satellite.visibleArea < 5760) continue;
    return [...islands, satellite];
  }

  return islands;
}

function riverWaterBodies(rivers: RiverPlan | null) {
  if (!rivers) return [];
  const source = "rivers" in rivers ? (rivers as unknown as { rivers: RiverPlan[] }).rivers : [rivers];
  return source.map((river, index) => ({
    id: `river-${index + 1}`,
    kind: "river",
    path: river.path,
    pts: river.pts,
    segments: river.segments,
    outerWidth: river.outerWidth,
    innerWidth: river.innerWidth,
    buildingBuffer: river.buildingBuffer,
    widthScale: river.widthScale
  }));
}

function buildChannels(mainland: LandmassPlan, islands: LandmassPlan[]) {
  return islands.map((island) => {
    const islandCentroid = island.centroid;
    const mainlandPoint = closestPointOnPolygon(islandCentroid.x, islandCentroid.y, mainland.polygon);
    const islandPoint = closestPointOnPolygon(mainlandPoint.x, mainlandPoint.y, island.polygon);
    return {
      id: `channel-${mainland.id}-${island.id}`,
      kind: "island-channel",
      landmassIds: [mainland.id, island.id],
      minWidth: polygonToPolygonDist(mainland.polygon, island.polygon),
      centerline: [mainlandPoint, islandPoint],
      bridgeAllowed: island.visibleArea > 6720
    };
  });
}

function makeElevation(rng: Rng, landmasses: LandmassPlan[]) {
  const hills = [];
  const primary = landmasses[0];
  const hillCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < hillCount; i++) {
    const bbox = primary.bbox;
    let x = primary.centroid.x;
    let y = primary.centroid.y;
    for (let attempt = 0; attempt < 30; attempt++) {
      const px = bbox.minX + rng() * bbox.w;
      const py = bbox.minY + rng() * bbox.h;
      if (pointInPolygon({ x: px, y: py }, primary.polygon)) {
        x = px;
        y = py;
        break;
      }
    }
    hills.push({ id: `hill-${i + 1}`, x, y, radius: 320 + rng() * 520, height: 0.12 + rng() * 0.34 });
  }
  return { base: 0, hills, shadowHint: { azimuth: -0.72, elevation: 0.55 } };
}

export function sampleElevation(x: number, y: number, terrain: TerrainPlan | null | undefined) {
  if (!terrain || !terrain.elevation) return 0;
  let h = terrain.elevation.base || 0;
  for (const hill of terrain.elevation.hills || []) {
    const d = Math.hypot(x - hill.x, y - hill.y);
    const t = Math.max(0, 1 - d / hill.radius);
    h += hill.height * t * t * (3 - 2 * t);
  }
  return h;
}

export function generateTerrain(rng: Rng): TerrainPlan {
  const mainlandPolygon = generateLandPolygon(rng);
  const river = generateRivers(mainlandPolygon, rng);
  const riverSegments = river ? river.segments : [];
  const mainland = makeLandmass("mainland", "mainland", mainlandPolygon);
  const islands = planTerrainIslands(mainlandPolygon, rng, riverSegments);
  const landmasses = [mainland, ...islands];
  const ocean = viewportPolygon();
  return {
    version: 1,
    bounds: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
    landmasses,
    mainland,
    waterBodies: [{ id: "ocean", kind: "ocean", polygon: ocean, path: polygonToPath(ocean), area: VIEW_W * VIEW_H }, ...riverWaterBodies(river)],
    coastline: buildCoastline(landmasses),
    channels: buildChannels(mainland, islands),
    elevation: makeElevation(rng, landmasses)
  };
}

export function buildTerrain(seed: number | string = 1) {
  const numericSeed = typeof seed === "number" ? seed : Number(seed);
  const normalizedSeed = Number.isFinite(numericSeed) ? (numericSeed >>> 0) || 1 : 1;
  return generateTerrain(makePrototypeRng(normalizedSeed));
}

function makePrototypeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function terrainSummary(terrain: TerrainPlan) {
  return {
    landmasses: terrain.landmasses.length,
    islands: terrain.landmasses.filter((l) => l.kind === "island").length,
    waterBodies: terrain.waterBodies.length,
    rivers: terrain.waterBodies.filter((w) => w.kind === "river").length,
    coastlineEdges: terrain.coastline.edges.length,
    channels: terrain.channels.length
  };
}
