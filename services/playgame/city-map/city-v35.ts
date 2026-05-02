import { DISTRICT_COLORS, DISTRICT_NAMES, VIEW_H, VIEW_W } from './config';
import { closestPointOnPolygon, insetPolygon, pointInPolygon, pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import { buildTerrain } from './terrain';
import {
  bspSubdivide,
  collectAllCuts,
  collectLeaves,
  macroDivide3,
  splitPolygonByLine,
  type Cut,
} from './partition';
import { cutPath, cutPoints, polygonToPath, rectPolygon, smoothClosedPath, straightPolylinePath } from './paths';
import { labelPosition, placeDotsInPolygon, viewportVisibleArea } from './placement';
import { generateBlockBuildings } from './buildings';
import { generateBridges } from './bridges';
import { generateCoastDocks } from './land';
import { makeRiverBankRoads } from './water';
import { enrichCityRouting, findPath } from './routing';
import { enrichCityVenues } from './venues';
import type { Building, CityBlock, CityDistrict, CityMap, CitySlot, Point, RoadEdge, Venue } from './types';

type Rng = () => number;

export interface BaseCityFactoryContext {
  seed: string | number;
  normalizedSeed: number;
  rng: Rng;
  terrain: unknown;
  options: CityMapOptions;
}

export interface CityMapOptions {
  cache?: boolean;
  cacheKey?: string;
  rng?: Rng;
  baseCityFactory?: (context: BaseCityFactoryContext) => CityMap;
}

export interface CityMapSummary {
  seed: string | number;
  version: 'v35';
  districts: number;
  blocks: number;
  buildableBlocks: number;
  ownedWater: number;
  roads: number;
  roadKinds: Record<string, number>;
  bridges: number;
  buildings: number;
  venues: number;
}

export interface CityRoute {
  waypoints: Point[];
  distance: number;
  buildingIds: [string, string];
  nodeIds?: string[];
}

const CACHE_LIMIT = 12;
const cache = new Map<string, CityMap>();

type TerrainV35 = ReturnType<typeof buildTerrain>;

function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function terrainWaterBodiesOfKind(terrain: TerrainV35, kind: string) {
  return (terrain.waterBodies || []).filter((body) => body.kind === kind);
}

function cutToRoad(cut: Cut, index: number, source: string): RoadEdge {
  const points = cutPoints(cut);
  const kind = cut.depth <= 0 ? 'highway' : cut.depth <= 1 ? 'avenue' : 'street';
  const isCoastRoad = cut.polylineMode === 'coast';
  const cutId = (cut as Cut & { id?: string }).id;
  return {
    id: cutId || (isCoastRoad ? `${source}:${index}:coast-road` : `${source}:${index}`),
    kind,
    source: isCoastRoad ? 'coast-road' : source,
    a: points[0] || cut.p1,
    b: points[points.length - 1] || cut.p2,
    points,
    path: cutPath(cut) || straightPolylinePath(points),
    depth: cut.depth,
    cut,
  };
}

function nearestBlockId(blocks: CityBlock[], point: Point) {
  let best: { id: string; distance: number } | null = null;
  for (const block of blocks) {
    if (pointInPolygon(point, block.polygon)) return block.id;
    const centroid = block.centroid || polygonCentroid(block.polygon);
    const distance = Math.hypot(centroid.x - point.x, centroid.y - point.y);
    if (!best || distance < best.distance) best = { id: block.id, distance };
  }
  return best?.id || null;
}

function fallbackTinyBlockBuilding(block: CityBlock & { area?: number; fieldAngle?: number }, rng: Rng) {
  const centroid = block.centroid || polygonCentroid(block.polygon);
  const size = Math.max(3.2, Math.min(8.5, Math.sqrt(block.area || polygonArea(block.polygon)) * 0.34));
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = size * (0.8 + rng() * 0.45);
    const h = size * (0.75 + rng() * 0.55);
    const angle = (block.fieldAngle || 0) + (rng() - 0.5) * 0.24;
    const polygon = rectPolygon(centroid.x, centroid.y, w, h, angle);
    if (polygon.every((corner) => pointInPolygon(corner, block.polygon))) {
      return [{ polygon, path: polygonToPath(polygon), area: polygonArea(polygon), shade: rng(), fallback: true }];
    }
  }
  return [];
}

function signedLineSide(point: Point, a: Point, b: Point) {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function cutBoundarySegments(cut: Cut) {
  const points = cut.polyline && cut.polyline.length >= 2 ? cut.polyline : [cut.p1, cut.p2];
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let i = 0; i + 1 < points.length; i++) segments.push({ a: points[i], b: points[i + 1] });
  return segments;
}

function polygonUsesCutBoundary(polygon: readonly Point[], cut: Cut) {
  const segments = cutBoundarySegments(cut);
  if (!segments.length) return false;
  let matchedSpan = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (edgeLen < 4) continue;
    for (const segment of segments) {
      const da = pointToSegmentDist(a.x, a.y, segment.a, segment.b);
      const db = pointToSegmentDist(b.x, b.y, segment.a, segment.b);
      if (da < 2.25 && db < 2.25) {
        matchedSpan += edgeLen;
        break;
      }
    }
  }
  return matchedSpan >= 5;
}

function clipPolygonToCutSide(subject: Point[], cut: Cut, keepPoint: Point) {
  if (!subject || subject.length < 3) return [];
  const points = cut.polyline && cut.polyline.length >= 2
    ? [cut.polyline[0], cut.polyline[cut.polyline.length - 1]]
    : [cut.p1, cut.p2];
  const a = points[0];
  const b = points[1];
  const keepSide = signedLineSide(keepPoint, a, b);
  if (Math.abs(keepSide) < 1e-6) return subject;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return subject;

  const ux = dx / len;
  const uy = dy / len;
  const huge = 4000;
  const result = splitPolygonByLine(
    subject,
    { x: a.x - ux * huge, y: a.y - uy * huge },
    { x: b.x + ux * huge, y: b.y + uy * huge },
  );
  if (!result) return subject;

  const halves = [result[0], result[1]].filter((poly) => poly && poly.length >= 3 && polygonArea(poly) > 20);
  const selected = halves.find((poly) => signedLineSide(polygonCentroid(poly), a, b) * keepSide >= -1e-6);
  return selected || subject;
}

function buildMainlandBuildablePolygons(
  ownershipPolygons: Point[][],
  buildableLandPolygon: readonly Point[] | null | undefined,
  boundaryCuts: readonly Cut[],
) {
  if (!buildableLandPolygon || buildableLandPolygon.length < 3) return ownershipPolygons;
  return ownershipPolygons
    .map((ownershipPolygon) => {
      const keepPoint = polygonCentroid(ownershipPolygon);
      let buildable = buildableLandPolygon.map((point) => ({ ...point }));
      for (const cut of boundaryCuts) {
        if (!polygonUsesCutBoundary(ownershipPolygon, cut)) continue;
        const clipped = clipPolygonToCutSide(buildable, cut, keepPoint);
        if (clipped.length >= 3) buildable = clipped;
      }
      return buildable;
    })
    .filter((poly) => poly && poly.length >= 3 && polygonArea(poly) > 50);
}

function makeDistrict(
  region: Point[],
  idx: number,
  names: string[],
  colors: string[],
  rng: Rng,
  gridAngle: number,
  buildablePieces?: readonly Point[][] | null,
  landmassId = 'mainland',
  flavor = false,
): CityDistrict & { rawCuts: Cut[]; label?: ReturnType<typeof labelPosition>; visibleArea?: number; waterPolygons: Point[][]; landmassId: string } {
  const districtId = `district-${idx}`;
  const sourcePolygons = (buildablePieces?.length ? buildablePieces : [region])
    .filter((polygon) => polygon && polygon.length >= 3 && polygonArea(polygon) > 50)
    .map((polygon) => polygon.map((point) => ({ ...point })));
  const roots = sourcePolygons.map((polygon) => bspSubdivide(polygon, 2, gridAngle, rng));
  const leaves = roots.flatMap((root) => collectLeaves(root));
  const rawCuts = roots.flatMap((root) => collectAllCuts(root));
  const blocks = leaves
    .map((leaf, blockIndex) => {
      const area = polygonArea(leaf.polygon);
      const centroid = polygonCentroid(leaf.polygon);
      const block = {
        id: `${districtId}:block:${blockIndex}`,
        districtId,
        landmassId,
        polygon: leaf.polygon,
        centroid,
        area,
        fieldAngle: gridAngle,
        buildable: area > 85,
        density: area > 850 ? 'dense' : area > 360 ? 'medium' : 'sparse',
        bigLandmark: !!leaf.bigLandmark,
      };
      return block;
    })
    .filter((block) => block.area > 36);
  const visibleArea = viewportVisibleArea(region);
  const label = labelPosition(region, [], names[idx] || `DISTRICT ${idx + 1}`);
  const bigLandmarkBlocks = blocks.filter((b) => b.bigLandmark).map((b) => ({ polygon: b.polygon }));

  const slotCount = flavor ? 0
    : visibleArea > 52000 ? 10
    : visibleArea > 40000 ? 8
    : visibleArea > 26000 ? 6
    : 4;
  const numLandmarks = flavor ? 0
    : visibleArea > 40000 ? 3
    : visibleArea > 26000 ? 2
    : 1;

  // Single Bridson pass: landmarks + slots together → guaranteed even spacing between all
  const allPoints = flavor ? [] : placeDotsInPolygon(
    region, rng, bigLandmarkBlocks, numLandmarks + slotCount, visibleArea, label
  );
  // First numLandmarks points → landmark positions; remainder → card slots
  const landmarkPoints = allPoints.slice(0, numLandmarks).map((p) => ({ x: p.x, y: p.y }));
  const slotPoints = allPoints.slice(numLandmarks);

  const slots: CitySlot[] = slotPoints.map((point, slotIndex) => ({
    id: `${districtId}:slot:${slotIndex}`,
    districtId,
    slotIndex,
    playableBy: 'both' as const,
    slotRole: 'street' as const,
    ownerSeat: (point.y < VIEW_H / 2 ? 'P1' : 'P0') as 'P0' | 'P1',
    blockId: nearestBlockId(blocks, point),
    venueId: null,
    buildingId: null,
    x: point.x,
    y: point.y,
  }));

  return {
    id: districtId,
    idx,
    name: names[idx] || `DISTRICT ${idx + 1}`,
    color: colors[idx % colors.length],
    landmassId,
    playable: !flavor,
    ownershipPolygons: [region],
    polygons: blocks.filter((block) => block.buildable).map((block) => block.polygon),
    blocks,
    roads: rawCuts.map((cut, cutIndex) => cutToRoad(cut, cutIndex, `${districtId}:road`)),
    slots,
    dots: slots,
    rawCuts,
    label,
    labelAnchor: { x: label.x, y: label.y },
    landmarkPoints,
    visibleArea,
    waterPolygons: [],
  };
}

function makeMainlandDistricts(terrain: TerrainV35, rng: Rng, names: string[], colors: string[], buildableMask?: readonly Point[] | null) {
  const riverSegments = terrainWaterBodiesOfKind(terrain, 'river')
    .flatMap((river) => ((river.segments || []) as Array<{ a: Point; b: Point }>));
  const divided = macroDivide3(terrain.mainland.polygon, 0, rng, riverSegments);
  const regions = divided.regions
    .slice()
    .sort((a, b) => viewportVisibleArea(b) - viewportVisibleArea(a))
    .slice(0, 3);
  const districtAngles = [
    0,
    Math.PI / 4 + (rng() - 0.5) * 0.14,
    -Math.PI / 5 + (rng() - 0.5) * 0.14,
  ];
  const districts = regions.map((region, idx) => {
    const buildablePieces = buildableMask
      ? buildMainlandBuildablePolygons([region], buildableMask, divided.macroCuts)
      : null;
    return makeDistrict(region, idx, names, colors, rng, districtAngles[idx] || 0, buildablePieces);
  });
  if (districts.length === 3) return { districts, macroCuts: divided.macroCuts };

  const fallbackDistrict = makeDistrict(
    terrain.mainland.polygon,
    0,
    names,
    colors,
    rng,
    0,
    buildableMask ? [buildableMask.map((point) => ({ ...point }))] : null,
  );
  return { districts: [fallbackDistrict], macroCuts: [] as Cut[] };
}

function makeCoastCut(id: string, polygon: Point[]): Cut {
  return {
    id,
    p1: polygon[0],
    p2: polygon[0],
    polyline: [...polygon, polygon[0]],
    polylineMode: 'coast',
    depth: 1,
    angle: 0,
  } as Cut & { id: string };
}

function pushCoastRoad(district: CityDistrict & { roads: RoadEdge[] }, id: string, polygon: Point[]) {
  const coastCut = makeCoastCut(id, polygon);
  district.roads.push({
    ...cutToRoad(coastCut, 0, 'coast-road'),
    id,
    kind: 'avenue',
    source: 'coast-road',
    path: smoothClosedPath(polygon),
  });
}

function makeIslandDistricts(terrain: TerrainV35, startIdx: number, names: string[], colors: string[], rng: Rng) {
  const districts: Array<CityDistrict & { rawCuts: Cut[]; landmassId: string }> = [];
  for (const landmass of terrain.landmasses || []) {
    if (landmass.kind !== 'island' || landmass.visibleArea < 2000) continue;
    const innerPolygon = insetPolygon(landmass.polygon, 6);
    if (!innerPolygon || innerPolygon.length < 3 || polygonArea(innerPolygon) < 260) continue;
    const district = makeDistrict(
      innerPolygon,
      startIdx + districts.length,
      names,
      colors,
      rng,
      (rng() - 0.5) * (Math.PI / 4),
      [innerPolygon],
      landmass.id,
      true, // flavor — no slots or landmarks
    );
    pushCoastRoad(district, `${district.id}-coast-road`, innerPolygon);
    districts.push(district);
  }
  return districts;
}

function makeIslandBridges(terrain: TerrainV35, mainlandCoastRoadPolygon: Point[] | null) {
  if (!mainlandCoastRoadPolygon) return [];
  return (terrain.channels || [])
    .filter((channel: any) => channel.bridgeAllowed && channel.centerline?.length >= 2)
    .map((channel: any, index: number) => {
      const mainlandOuter = channel.centerline[0];
      const islandOuter = channel.centerline[channel.centerline.length - 1];
      const island = (terrain.landmasses || []).find((landmass) => landmass.id === channel.landmassIds?.[1]);
      const islandCoastRoad = island ? insetPolygon(island.polygon, 6) : null;
      const b = islandCoastRoad && islandCoastRoad.length >= 3
        ? closestPointOnPolygon(mainlandOuter.x, mainlandOuter.y, islandCoastRoad)
        : islandOuter;
      const a = closestPointOnPolygon(b.x, b.y, mainlandCoastRoadPolygon);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return {
        id: `v35-island-bridge-${index + 1}`,
        channelId: channel.id,
        path: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
        x: center.x,
        y: center.y,
        center,
        centroid: center,
        deckWidth: bridgeDeckWidthForDepth(1),
        type: 'island',
      };
    });
}

function roadWidthForDepth(depth = 2) {
  if (depth === 0) return 1.42;
  if (depth === 1) return 1.05;
  if (depth === 2) return 0.72;
  return 0.38;
}

function bridgeDeckWidthForDepth(depth = 2) {
  const width = roadWidthForDepth(depth) * 3;
  return depth >= 3 ? width + 0.35 : width;
}

function bridgeLinePath(cx: number, cy: number, angle: number, length: number) {
  const dx = Math.cos(angle) * length * 0.5;
  const dy = Math.sin(angle) * length * 0.5;
  return `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} L ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}`;
}

function angleDelta(a: number, b: number) {
  let d = Math.abs(a - b) % Math.PI;
  return d > Math.PI / 2 ? Math.PI - d : d;
}

function nearestSegmentAngle(point: Point, segments: Array<{ a: Point; b: Point }>) {
  let best: { distance: number; angle: number } | null = null;
  for (const segment of segments || []) {
    const distance = pointToSegmentDist(point.x, point.y, segment.a, segment.b);
    if (!best || distance < best.distance) {
      best = { distance, angle: Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) };
    }
  }
  return best?.angle ?? null;
}

function bridgeRiverDelta(bridge: { x: number; y: number; angle?: number; roadAngle?: number }, riverSegments: Array<{ a: Point; b: Point }>) {
  const riverAngle = nearestSegmentAngle({ x: bridge.x, y: bridge.y }, riverSegments);
  if (riverAngle == null) return Math.PI / 2;
  return angleDelta(bridge.roadAngle ?? bridge.angle ?? 0, riverAngle);
}

function makeBridgePlan(terrain: TerrainV35, mainlandCoastRoadPolygon: Point[] | null, roadCuts: Cut[]) {
  const islandBridges = makeIslandBridges(terrain, mainlandCoastRoadPolygon);
  const river = terrainWaterBodiesOfKind(terrain, 'river')[0] || null;
  const riverSegments = ((river?.segments || []) as Array<{ a: Point; b: Point }>);
  const riverBridgeResult = river && mainlandCoastRoadPolygon
    ? generateBridges({
        allCuts: roadCuts,
        river: river as { outerWidth: number },
        riverSegments,
        coastRoadPolygon: mainlandCoastRoadPolygon,
        landPolygon: terrain.mainland.polygon,
      })
    : null;
  const renderedCuts = riverBridgeResult?.renderedCuts || roadCuts;
  const riverBridges = (riverBridgeResult?.bridges || [])
    .filter((bridge) => !bridge.offshore)
    .map((bridge, index) => {
      const depth = bridge.depth ?? 2;
      const delta = bridgeRiverDelta(bridge, riverSegments);
      const baseLength = Math.max((river?.outerWidth || 7) + 8, depth <= 1 ? 13 : 10);
      const shallowFactor = 1 / Math.max(0.34, Math.sin(Math.max(delta, 0.22)));
      const maxLength = depth <= 1 ? 64 : depth >= 4 ? 36 : 52;
      const length = Math.min(maxLength, baseLength * shallowFactor);
      const center = { x: bridge.x, y: bridge.y };
      return {
        ...bridge,
        id: `v35-river-bridge-${index + 1}`,
        path: bridgeLinePath(bridge.x, bridge.y, bridge.angle || 0, length),
        center,
        centroid: center,
        deckWidth: bridgeDeckWidthForDepth(depth),
        depth,
        riverMouth: !!bridge.riverMouth,
        type: 'river',
      };
    });
  return { bridges: [...islandBridges, ...riverBridges], renderedCuts };
}

function buildStaticBuildings(cells: Array<CityBlock & Record<string, any>>, rng: Rng, terrain: TerrainV35) {
  const riverSegments = terrainWaterBodiesOfKind(terrain, 'river')
    .flatMap((river) => ((river.segments || []) as Array<{ a: Point; b: Point }>));
  const openSpaces: Array<Record<string, any>> = [];
  const buildings: Building[] = [];
  const districtParkCells = new Set<string>();

  for (const districtId of new Set(cells.map((cell) => cell.districtId).filter(Boolean))) {
    const largest = cells
      .filter((cell) => cell.districtId === districtId && cell.buildable && cell.area > 1100)
      .sort((a, b) => b.area - a.area)[0];
    if (largest) districtParkCells.add(largest.id);
  }

  for (const block of cells) {
    if (!block.buildable) continue;
    if (districtParkCells.has(block.id)) {
      openSpaces.push({ id: `${block.id}:park`, kind: 'park', role: 'landmark', cellId: block.id });
      continue;
    }
    let generated = generateBlockBuildings(block.polygon, block.fieldAngle || 0, rng, riverSegments, null, 7);
    if (!generated.length && block.area > 110) generated = fallbackTinyBlockBuilding(block, rng);
    generated.forEach((gen, index) => {
      const height = block.density === 'dense' ? 12 + rng() * 18 : block.density === 'medium' ? 7 + rng() * 10 : 4 + rng() * 7;
      buildings.push({
        id: `${block.id}:building:${index}`,
        cellId: block.id,
        blockId: block.id,
        districtId: block.districtId,
        footprint: gen.polygon,
        polygon: gen.polygon,
        path: gen.path,
        area: gen.area,
        height,
        shade: gen.shade,
        fallback: !!gen.fallback,
        centroid: polygonCentroid(gen.polygon),
        shadow: { azimuth: -0.72, length: height * 0.58, opacity: Math.min(0.32, 0.07 + height / 100) },
        render: {
          extrudable: true,
          staticMesh: true,
          lodGroup: height > 18 ? 'tower' : height > 9 ? 'midrise' : 'lowrise',
        },
      } as Building);
    });
  }

  return {
    buildings,
    openSpaces,
    landmarks: [],
    staticScene: { shadowAzimuth: -0.72, shadowElevation: 0.55, cacheable: true },
  };
}

function buildBaseCity(seed: string | number, normalizedSeed: number, rng: Rng, terrain: TerrainV35): CityMap {
  const names = shuffle(DISTRICT_NAMES, rng);
  const colors = shuffle(DISTRICT_COLORS, rng);
  const mainlandInset = insetPolygon(terrain.mainland.polygon, 6);
  const validInset = mainlandInset.length >= 3 && polygonArea(mainlandInset) > 400;
  const { districts: mainlandDistricts, macroCuts } = makeMainlandDistricts(terrain, rng, names, colors, validInset ? mainlandInset : null);

  if (validInset && mainlandDistricts.length > 0) pushCoastRoad(mainlandDistricts[0], 'mainland-coast-road', mainlandInset);

  const maxIslands = Math.max(0, 3 - mainlandDistricts.length);
  const islandDistricts = makeIslandDistricts(terrain, mainlandDistricts.length, names, colors, rng).slice(0, maxIslands);
  const districts = [...mainlandDistricts, ...islandDistricts];
  const cells = districts.flatMap((district) => district.blocks);

  const rawRoadCuts = [
    ...macroCuts,
    ...districts.flatMap((district) => district.rawCuts || []),
    ...districts.flatMap((district) => district.roads || []).filter((road) => road.source === 'coast-road').map((road) => road.cut),
  ].filter(Boolean) as Cut[];
  const bridgePlan = makeBridgePlan(terrain, validInset ? mainlandInset : null, rawRoadCuts);
  const bridgeAwareRoadCuts = bridgePlan.renderedCuts || rawRoadCuts;
  const riverBankCuts = terrainWaterBodiesOfKind(terrain, 'river')
    .flatMap((riverBody) => makeRiverBankRoads(riverBody as any, terrain.mainland.polygon) as Cut[]);
  const roadEdges = [
    ...bridgeAwareRoadCuts.map((cut, index) => cutToRoad(cut, index, 'v35-road')),
    ...riverBankCuts.map((cut, index) => cutToRoad(cut, index, 'v35-river-bank')),
  ];
  const buildingPlan = buildStaticBuildings(cells, rng, terrain);
  const coastDocks = generateCoastDocks(
    terrain.mainland.polygon,
    makeRng(normalizedSeed ^ 0xd0c5),
    terrainWaterBodiesOfKind(terrain, 'river').flatMap((riverBody) => (riverBody.segments || []) as Array<{ a: Point; b: Point }>),
  );
  return {
    version: 'v35',
    seed,
    width: VIEW_W,
    height: VIEW_H,
    bounds: terrain.bounds,
    terrain: terrain as CityMap['terrain'],
    cells,
    neighborhoods: [],
    adjacency: {},
    roadGraph: {
      nodes: [],
      edges: roadEdges,
      bridgeCandidates: [],
      roadCells: [],
      blockedCells: cells.filter((cell) => !cell.buildable).map((cell) => cell.id),
      roadCorridors: [],
    },
    districts,
    districtAdjacency: {},
    cellDistrict: Object.fromEntries(cells.map((cell) => [cell.id, cell.districtId])),
    bridgePlan,
    coastDocks,
    buildingPlan,
    venues: [],
    venueById: {},
  } as CityMap;
}

export function normalizeSeed(seed: string | number): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
  let h = 2166136261;
  const text = String(seed || '1');
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function remember(key: string, value: CityMap) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return value;
}

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeCityShape(city: CityMap, seed: string | number): CityMap {
  const mutableCity = city as CityMap & Record<string, any>;
  mutableCity.version = 'v35';
  mutableCity.seed = seed;
  mutableCity.width = mutableCity.width ?? mutableCity.bounds?.width ?? mutableCity.bounds?.w ?? VIEW_W;
  mutableCity.height = mutableCity.height ?? mutableCity.bounds?.height ?? mutableCity.bounds?.h ?? VIEW_H;
  mutableCity.venues = mutableCity.venues || [];
  mutableCity.venueById = mutableCity.venueById || {};
  mutableCity.landmarks = mutableCity.landmarks || [];
  mutableCity.landmarkById = mutableCity.landmarkById || {};
  mutableCity.districts = mutableCity.districts || [];
  mutableCity.buildingPlan = mutableCity.buildingPlan || { buildings: [], openSpaces: [], landmarks: [] };
  mutableCity.bridgePlan = mutableCity.bridgePlan || { bridges: [], renderedCuts: [] };
  mutableCity.coastDocks = mutableCity.coastDocks || [];
  mutableCity.roadGraph = mutableCity.roadGraph || { nodes: [], edges: [] };
  for (const district of mutableCity.districts) {
    district.id = String(district.id);
    district.slots = district.slots || [];
    district.dots = district.dots || district.slots;
    for (let i = 0; i < district.slots.length; i++) {
      const slot = district.slots[i];
      slot.id = String(slot.id || `${district.id}:slot:${i}`);
      slot.districtId = String(slot.districtId || district.id);
      slot.slotIndex = slot.slotIndex ?? i;
    }
  }
  for (const building of mutableCity.buildingPlan.buildings) building.id = String(building.id);
  for (const bridge of mutableCity.bridgePlan.bridges) if (bridge.id != null) bridge.id = String(bridge.id);
  return mutableCity as CityMap;
}

/**
 * Public v35 generator entry.
 *
 * The enrichment boundary is intentionally fixed:
 * 1. create the base city shape,
 * 2. attach routing and building snap metadata,
 * 3. derive venues and assign district slots.
 */
export function buildCityV35(seed: string | number = 1, opts: CityMapOptions = {}): CityMap {
  const normalizedSeed = normalizeSeed(seed);
  const key = `city-v35:${normalizedSeed}:${opts.cacheKey || 'default'}`;
  if (opts.cache !== false && cache.has(key)) return cache.get(key)!;

  const rng: Rng = opts.rng || makeRng(normalizedSeed ^ 0x3355);
  const terrain = buildTerrain(normalizedSeed);
  const baseCity = opts.baseCityFactory
    ? opts.baseCityFactory({ seed, normalizedSeed, rng, terrain, options: opts })
    : buildBaseCity(seed, normalizedSeed, rng, terrain);

  const city = normalizeCityShape(baseCity, seed);
  enrichCityRouting(city);
  enrichCityVenues(city);
  return opts.cache === false ? city : remember(key, city);
}

export function summarizeCityV35(city: CityMap): CityMapSummary {
  const roadKinds: Record<string, number> = {};
  for (const edge of city.roadGraph?.edges || []) roadKinds[edge.kind] = (roadKinds[edge.kind] || 0) + 1;
  const looseCity = city as CityMap & Record<string, any>;
  const cells = looseCity.cells || city.districts.flatMap((district) => district.blocks || []);
  return {
    seed: city.seed,
    version: city.version,
    districts: city.districts.length,
    blocks: cells.length,
    buildableBlocks: cells.filter((cell) => cell.buildable).length,
    ownedWater: city.districts.reduce((sum, district) => sum + (((district as any).waterPolygons || []).length || 0), 0),
    roads: city.roadGraph?.edges?.length || 0,
    roadKinds,
    bridges: city.bridgePlan?.bridges?.length || 0,
    buildings: city.buildingPlan?.buildings?.length || 0,
    venues: city.venues?.length || 0,
  };
}

export function findCityRoute(city: CityMap, fromVenueId: string, toVenueId: string): CityRoute | null {
  const from = city.venueById?.[fromVenueId] as (Venue & { buildingId?: string | null }) | undefined;
  const to = city.venueById?.[toVenueId] as (Venue & { buildingId?: string | null }) | undefined;
  if (!from?.buildingId || !to?.buildingId) return null;
  return findPath(city, from.buildingId, to.buildingId);
}

export function clearCityV35Cache() {
  cache.clear();
}
