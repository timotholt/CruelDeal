import { For } from 'solid-js';
import type { CityMap, Point, RoadEdge } from '@/services/playgame/city-map';
import { pointInPolygon } from '@/services/playgame/city-map/geometry';
import type { CityMapViewport } from './camera';

export interface CompositionDebugOverlayProps {
  city: CityMap;
  width: number;
  height: number;
  viewport?: CityMapViewport;
}

type QuadrantId = 'nw' | 'ne' | 'sw' | 'se';

interface QuadrantScore {
  id: QuadrantId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mass: number;
  share: number;
  empty: boolean;
}

interface CompositionMetrics {
  quadrants: QuadrantScore[];
  lowestQuadrantId: QuadrantId;
  tConfidence: number;
  dominantDistrictAngle: number | null;
  diagonalRoadShare: number;
}

type RenderTerrain = CityMap['terrain'] & {
  mainland?: { polygon?: Point[] };
  landmasses?: Array<{ id?: string; polygon?: Point[] }>;
  landPolygon?: Point[];
  visibleLandPolygon?: Point[];
};

type RenderBuilding = {
  centroid?: Point;
  polygon?: Point[];
  footprint?: Point[];
};

type RenderLandmark = {
  centroid?: Point;
};

type RenderRoad = RoadEdge & {
  points?: Point[];
};

function terrainPolygons(city: CityMap): Point[][] {
  const terrain = city.terrain as RenderTerrain;
  const landmasses = terrain.landmasses?.map((landmass) => landmass.polygon).filter((polygon): polygon is Point[] => !!polygon?.length) || [];
  if (landmasses.length > 0) return landmasses;
  const fallback = terrain.visibleLandPolygon || terrain.landPolygon || terrain.mainland?.polygon;
  return fallback?.length ? [fallback] : [];
}

function pointQuadrant(point: Point, width: number, height: number): QuadrantId {
  const east = point.x >= width / 2;
  const south = point.y >= height / 2;
  if (!east && !south) return 'nw';
  if (east && !south) return 'ne';
  if (!east && south) return 'sw';
  return 'se';
}

function addPointMass(mass: Record<QuadrantId, number>, point: Point | null | undefined, width: number, height: number, weight: number) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return;
  mass[pointQuadrant(point, width, height)] += weight;
}

function centroidOf(points: readonly Point[]) {
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function roadPoints(edge: RenderRoad): Point[] {
  if (edge.points?.length) return edge.points;
  return [edge.a, edge.b].filter(Boolean) as Point[];
}

function normalizeAngle(angle: number) {
  let normalized = Math.abs(angle) % Math.PI;
  if (normalized > Math.PI / 2) normalized = Math.PI - normalized;
  return normalized;
}

function analyzeRoadAngles(city: CityMap) {
  const roads = (city.roadGraph?.edges || []) as RenderRoad[];
  if (!roads.length) return { diagonalRoadShare: 0 };

  let diagonal = 0;
  let total = 0;
  for (const road of roads) {
    const points = roadPoints(road);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 2) continue;
      const angle = normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x));
      total += length;
      if (angle > Math.PI / 10 && angle < Math.PI * 0.4) diagonal += length;
    }
  }
  return { diagonalRoadShare: total > 0 ? diagonal / total : 0 };
}

function districtAngle(district: CityMap['districts'][number]) {
  const polygons = district.ownershipPolygons?.length ? district.ownershipPolygons : district.polygons;
  const points = polygons.flat();
  if (points.length < 2) return null;

  let bestLength = 0;
  let bestAngle: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > bestLength) {
      bestLength = length;
      bestAngle = normalizeAngle(Math.atan2(b.y - a.y, b.x - a.x));
    }
  }
  return bestAngle;
}

function analyzeDistrictAngles(city: CityMap) {
  const angles = city.districts
    .filter((district) => district.playable !== false)
    .map(districtAngle)
    .filter((angle): angle is number => angle != null);
  if (!angles.length) return { dominantDistrictAngle: null, tConfidence: 0 };

  const screenAligned = angles.filter((angle) => angle < Math.PI / 14 || Math.abs(angle - Math.PI / 2) < Math.PI / 14).length;
  const slanted = angles.length - screenAligned;
  const dominantDistrictAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
  return {
    dominantDistrictAngle,
    tConfidence: angles.length > 0 ? Math.min(1, (screenAligned + slanted * 0.5) / angles.length) : 0,
  };
}

export function analyzeComposition(city: CityMap): CompositionMetrics {
  const width = city.width;
  const height = city.height;
  const mass: Record<QuadrantId, number> = { nw: 0, ne: 0, sw: 0, se: 0 };
  const land = terrainPolygons(city);

  const sampleStep = Math.max(8, Math.min(width, height) / 24);
  for (let x = sampleStep / 2; x < width; x += sampleStep) {
    for (let y = sampleStep / 2; y < height; y += sampleStep) {
      if (land.some((polygon) => pointInPolygon({ x, y }, polygon))) {
        mass[pointQuadrant({ x, y }, width, height)] += 1;
      }
    }
  }

  for (const building of (city.buildingPlan?.buildings || []) as RenderBuilding[]) {
    addPointMass(mass, building.centroid || centroidOf(building.footprint || building.polygon || []), width, height, 0.45);
  }
  for (const road of (city.roadGraph?.edges || []) as RenderRoad[]) {
    for (const point of roadPoints(road)) addPointMass(mass, point, width, height, 0.18);
  }
  for (const landmark of (city.landmarks || []) as RenderLandmark[]) {
    addPointMass(mass, landmark.centroid, width, height, 1.5);
  }
  for (const district of city.districts) {
    for (const slot of district.slots || []) addPointMass(mass, slot, width, height, 1.15);
    addPointMass(mass, district.labelAnchor, width, height, 0.75);
  }

  const total = Object.values(mass).reduce((sum, value) => sum + value, 0) || 1;
  const quadrants: QuadrantScore[] = [
    { id: 'nw', label: 'NW', x: 0, y: 0, width: width / 2, height: height / 2, mass: mass.nw, share: mass.nw / total, empty: false },
    { id: 'ne', label: 'NE', x: width / 2, y: 0, width: width / 2, height: height / 2, mass: mass.ne, share: mass.ne / total, empty: false },
    { id: 'sw', label: 'SW', x: 0, y: height / 2, width: width / 2, height: height / 2, mass: mass.sw, share: mass.sw / total, empty: false },
    { id: 'se', label: 'SE', x: width / 2, y: height / 2, width: width / 2, height: height / 2, mass: mass.se, share: mass.se / total, empty: false },
  ];
  const lowest = quadrants.reduce((best, quadrant) => quadrant.mass < best.mass ? quadrant : best, quadrants[0]);
  for (const quadrant of quadrants) quadrant.empty = quadrant.id === lowest.id || quadrant.share < 0.16;
  const roadMetrics = analyzeRoadAngles(city);
  const districtMetrics = analyzeDistrictAngles(city);

  return {
    quadrants,
    lowestQuadrantId: lowest.id,
    ...roadMetrics,
    ...districtMetrics,
  };
}

export const CompositionDebugOverlay = (props: CompositionDebugOverlayProps) => {
  const metrics = () => analyzeComposition(props.city);
  const viewport = () => props.viewport || { x: 0, y: 0, width: props.width, height: props.height };
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const angleLabel = () => {
    const angle = metrics().dominantDistrictAngle;
    return angle == null ? 'n/a' : `${Math.round((angle * 180) / Math.PI)}deg`;
  };
  const templateLabel = () => props.city.composition?.macroLayoutTemplate || 'classic-t';

  return (
    <svg
      class="city-map-composition-debug"
      viewBox={`${viewport().x} ${viewport().y} ${viewport().width} ${viewport().height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <For each={metrics().quadrants}>
        {(quadrant) => (
          <g classList={{ 'city-map-composition-debug__quadrant': true, 'city-map-composition-debug__quadrant--empty': quadrant.empty }}>
            <rect x={quadrant.x} y={quadrant.y} width={quadrant.width} height={quadrant.height} />
            <text x={quadrant.x + 10} y={quadrant.y + 18}>
              {quadrant.label} {percent(quadrant.share)}
            </text>
          </g>
        )}
      </For>
      <text class="city-map-composition-debug__summary" x="10" y={props.height - 34}>
        LAYOUT {templateLabel().toUpperCase()} | LOW {metrics().lowestQuadrantId.toUpperCase()}
      </text>
      <text class="city-map-composition-debug__summary" x="10" y={props.height - 18}>
        DIST ANGLE {angleLabel()} | DIAG ROADS {percent(metrics().diagonalRoadShare)} | T {percent(metrics().tConfidence)}
      </text>
    </svg>
  );
};
