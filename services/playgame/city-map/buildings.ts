import { distToRiver, pointInPolygon, pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import { polygonToPath } from './paths';
import type { Point } from './types';

type Rng = () => number;

interface RoadHazard {
  a: Point;
  b: Point;
  buffer: number;
}

export interface GeneratedBuildingFootprint {
  path: string;
  polygon: Point[];
  area: number;
  shade: number;
  round?: boolean;
  cx?: number;
  cy?: number;
  radius?: number;
  ringRadius?: number;
  edgeMidpoints?: Point[];
  fallback?: boolean;
}

interface UvBox {
  u1: number;
  u2: number;
  v1: number;
  v2: number;
}

export function generateBlockBuildings(
  blockPolygon: Point[],
  gridAngle: number,
  rng: Rng,
  riverSegments?: Array<{ a: Point; b: Point }> | null,
  roadHazards?: RoadHazard[] | null,
  riverBuffer = 7,
): GeneratedBuildingFootprint[] {
  const blockArea = polygonArea(blockPolygon);

  const footprintNearRiver = (corners: Point[]) => {
    if (!riverSegments?.length) return false;
    const probes = [...corners];
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      cx += a.x / corners.length;
      cy += a.y / corners.length;
      probes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    probes.push({ x: cx, y: cy });
    return probes.some((p) => distToRiver(p.x, p.y, riverSegments) < riverBuffer);
  };

  const footprintNearRoad = (corners: Point[]) => {
    if (!roadHazards?.length) return false;
    const probes = [...corners];
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      cx += a.x / corners.length;
      cy += a.y / corners.length;
      probes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    probes.push({ x: cx, y: cy });
    return probes.some((point) =>
      roadHazards.some((hazard) => pointToSegmentDist(point.x, point.y, hazard.a, hazard.b) < hazard.buffer),
    );
  };

  let hasCurvedBoundary = false;
  let hasCoastBoundary = false;
  for (const vertex of blockPolygon) {
    const edgeKind = (vertex as Point & { edgeKind?: string }).edgeKind;
    if (edgeKind === 'roadMid' || edgeKind === 'roadBend') hasCurvedBoundary = true;
    if (edgeKind === 'coast') hasCoastBoundary = true;
  }
  const isIrregular = hasCurvedBoundary || hasCoastBoundary;

  if (!isIrregular && rng() < 0.04 && blockArea > 700) {
    const c = polygonCentroid(blockPolygon);
    let inscribed = Infinity;
    for (let i = 0; i < blockPolygon.length; i++) {
      const a = blockPolygon[i];
      const b = blockPolygon[(i + 1) % blockPolygon.length];
      inscribed = Math.min(inscribed, pointToSegmentDist(c.x, c.y, a, b));
    }
    const radius = inscribed * 0.7;
    const centerNearRiver = riverSegments?.length
      ? distToRiver(c.x, c.y, riverSegments) < radius + riverBuffer
      : false;
    const roadCutsCircle = roadHazards?.some(
      (hazard) => pointToSegmentDist(c.x, c.y, hazard.a, hazard.b) < radius + hazard.buffer + 1.5,
    );
    if (radius > 4.5 && !centerNearRiver && !roadCutsCircle) {
      const sides = 18;
      const pts = Array.from({ length: sides }, (_, i) => {
        const angle = (i / sides) * Math.PI * 2;
        return { x: c.x + Math.cos(angle) * radius, y: c.y + Math.sin(angle) * radius };
      });
      const edgeMidpoints = blockPolygon.map((a, i) => {
        const b = blockPolygon[(i + 1) % blockPolygon.length];
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      });
      return [{
        path: polygonToPath(pts),
        polygon: pts,
        area: Math.PI * radius * radius,
        shade: rng(),
        round: true,
        cx: c.x,
        cy: c.y,
        radius,
        ringRadius: inscribed * 0.85,
        edgeMidpoints,
      }];
    }
  }

  const cosG = Math.cos(-gridAngle);
  const sinG = Math.sin(-gridAngle);
  const cosI = Math.cos(gridAngle);
  const sinI = Math.sin(gridAngle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of blockPolygon) {
    const u = p.x * cosG - p.y * sinG;
    const v = p.x * sinG + p.y * cosG;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const wU = maxU - minU;
  const wV = maxV - minV;
  if (wU < 7 || wV < 7) return [];

  const targetSize = isIrregular ? 6 + rng() * 2 : 7 + rng() * 3.2;
  const skipRate = isIrregular ? 0.15 : 0.01;
  const inset = isIrregular ? 0.5 : 0.45;
  const nU = Math.max(1, Math.round(wU / targetSize));
  const nV = Math.max(1, Math.round(wV / targetSize));
  const cellU = wU / nU;
  const cellV = wV / nV;
  const buildings: GeneratedBuildingFootprint[] = [];
  const placedUVBoxes: UvBox[] = [];

  const cornersFromUv = (uvCorners: Array<{ u: number; v: number }>) => uvCorners.map((p) => ({
    x: p.u * cosI - p.v * sinI,
    y: p.u * sinI + p.v * cosI,
  }));

  const scaleUvCorners = (uvCorners: Array<{ u: number; v: number }>, scale: number) => {
    const center = uvCorners.reduce(
      (sum, point) => ({ u: sum.u + point.u / uvCorners.length, v: sum.v + point.v / uvCorners.length }),
      { u: 0, v: 0 },
    );
    return uvCorners.map((point) => ({
      u: center.u + (point.u - center.u) * scale,
      v: center.v + (point.v - center.v) * scale,
    }));
  };

  const uvBoxForCorners = (uvCorners: Array<{ u: number; v: number }>): UvBox => ({
    u1: Math.min(...uvCorners.map((point) => point.u)),
    u2: Math.max(...uvCorners.map((point) => point.u)),
    v1: Math.min(...uvCorners.map((point) => point.v)),
    v2: Math.max(...uvCorners.map((point) => point.v)),
  });

  const pushFootprint = (u1: number, u2: number, v1: number, v2: number) => {
    if (u2 - u1 < 1 || v2 - v1 < 1) return false;
    if (placedUVBoxes.some((b) => u2 + 0.25 > b.u1 && u1 - 0.25 < b.u2 && v2 + 0.25 > b.v1 && v1 - 0.25 < b.v2)) {
      return false;
    }
    let uvCorners = [{ u: u1, v: v1 }, { u: u2, v: v1 }, { u: u2, v: v2 }, { u: u1, v: v2 }];
    if (isIrregular && rng() < 0.36) {
      const maxSkew = Math.min(u2 - u1, v2 - v1) * 0.12;
      const skew = (rng() < 0.5 ? -1 : 1) * maxSkew * (0.35 + rng() * 0.35);
      uvCorners = rng() < 0.5
        ? [{ u: u1 + skew, v: v1 }, { u: u2 + skew, v: v1 }, { u: u2 - skew, v: v2 }, { u: u1 - skew, v: v2 }]
        : [{ u: u1, v: v1 + skew }, { u: u2, v: v1 - skew }, { u: u2, v: v2 - skew }, { u: u1, v: v2 + skew }];
    }
    let corners = cornersFromUv(uvCorners);
    if (!corners.every((corner) => pointInPolygon(corner, blockPolygon))) return false;
    if (footprintNearRiver(corners)) return false;
    let placedBox = { u1, u2, v1, v2 };
    if (footprintNearRoad(corners)) {
      let adjusted: { uvCorners: Array<{ u: number; v: number }>; corners: Point[]; box: UvBox } | null = null;
      for (const scale of [0.95, 0.88, 0.8, 0.7, 0.6]) {
        const scaledUv = scaleUvCorners(uvCorners, scale);
        const scaledCorners = cornersFromUv(scaledUv);
        const box = uvBoxForCorners(scaledUv);
        if (box.u2 - box.u1 < 1 || box.v2 - box.v1 < 1) continue;
        if (!scaledCorners.every((corner) => pointInPolygon(corner, blockPolygon))) continue;
        if (footprintNearRiver(scaledCorners) || footprintNearRoad(scaledCorners)) continue;
        adjusted = { uvCorners: scaledUv, corners: scaledCorners, box };
        break;
      }
      if (!adjusted) return false;
      uvCorners = adjusted.uvCorners;
      corners = adjusted.corners;
      placedBox = adjusted.box;
    }
    buildings.push({
      path: `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
      polygon: corners,
      area: polygonArea(corners),
      shade: rng(),
    });
    placedUVBoxes.push(placedBox);
    return true;
  };

  const consumed = new Array(nU * nV).fill(false);
  const cellIdx = (i: number, j: number) => i * nV + j;
  const buildingCoverage = () => buildings.reduce((sum, building) => sum + building.area, 0) / Math.max(1, blockArea);

  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      if (consumed[cellIdx(i, j)] || rng() < skipRate) continue;
      const onEdge = i === 0 || i === nU - 1 || j === 0 || j === nV - 1;
      const isCorner = (i === 0 || i === nU - 1) && (j === 0 || j === nV - 1);
      const [pNormal, pCluster, pLarge] = isCorner ? [0.4, 0.4, 0.13] : onEdge ? [0.5, 0.3, 0.13] : [0.65, 0.07, 0.18];
      const mode = rng();
      const baseU0 = minU + i * cellU;
      const baseV0 = minV + j * cellV;
      if (mode < pNormal) {
        const aspectExtra = (rng() - 0.5) * 0.4 * cellU;
        pushFootprint(
          baseU0 + inset + Math.max(0, aspectExtra) + rng() * 0.3,
          baseU0 + cellU - inset - Math.max(0, -aspectExtra) - rng() * 0.3,
          baseV0 + inset + rng() * 0.3,
          baseV0 + cellV - inset - rng() * 0.3,
        );
      } else if (mode < pNormal + pCluster) {
        const layouts = [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3]];
        const [su, sv] = layouts[Math.floor(rng() * layouts.length)];
        const innerInsetU = Math.max(0.25, inset * 0.55);
        const innerInsetV = Math.max(0.25, inset * 0.55);
        const subU = (cellU - 2 * innerInsetU) / su;
        const subV = (cellV - 2 * innerInsetV) / sv;
        for (let si = 0; si < su; si++) {
          for (let sj = 0; sj < sv; sj++) {
            if (rng() < 0.22) continue;
            pushFootprint(
              baseU0 + innerInsetU + si * subU + 0.3 + rng() * 0.25,
              baseU0 + innerInsetU + (si + 1) * subU - 0.3 - rng() * 0.25,
              baseV0 + innerInsetV + sj * subV + 0.3 + rng() * 0.25,
              baseV0 + innerInsetV + (sj + 1) * subV - 0.3 - rng() * 0.25,
            );
          }
        }
      } else {
        const canRight = mode >= pNormal + pCluster + pLarge && i + 1 < nU && !consumed[cellIdx(i + 1, j)];
        const canDown = mode >= pNormal + pCluster + pLarge && j + 1 < nV && !consumed[cellIdx(i, j + 1)];
        const tightU = Math.max(0.15, inset * 0.4);
        const tightV = Math.max(0.15, inset * 0.4);
        let placed = false;
        if (canRight && (!canDown || rng() < 0.5)) {
          placed = pushFootprint(baseU0 + tightU, baseU0 + 2 * cellU - tightU, baseV0 + tightV, baseV0 + cellV - tightV);
          if (placed) consumed[cellIdx(i + 1, j)] = true;
        } else if (canDown) {
          placed = pushFootprint(baseU0 + tightU, baseU0 + cellU - tightU, baseV0 + tightV, baseV0 + 2 * cellV - tightV);
          if (placed) consumed[cellIdx(i, j + 1)] = true;
        }
        if (!placed) {
          pushFootprint(baseU0 + tightU, baseU0 + cellU - tightU, baseV0 + tightV, baseV0 + cellV - tightV);
        }
      }
    }
  }

  const targetCoverage = isIrregular ? 0.18 : 0.24;
  const missingCoverage = targetCoverage - buildingCoverage();
  if (missingCoverage > 0) {
    const baseSize = Math.max(1.4, Math.min(cellU, cellV));
    const maxInfillBuildings = Math.min(
      36,
      Math.ceil((missingCoverage * blockArea) / Math.max(5, baseSize * baseSize * 0.28)),
    );
    let added = 0;
    const attempts = Math.max(24, maxInfillBuildings * 10);
    for (let attempt = 0; attempt < attempts && added < maxInfillBuildings && buildingCoverage() < targetCoverage; attempt++) {
      const u = minU + rng() * wU;
      const v = minV + rng() * wV;
      const scale = 0.34 + rng() * 0.42;
      const aspect = rng() < 0.35 ? 0.55 + rng() * 0.35 : 0.85 + rng() * 0.45;
      const w = Math.max(1.15, Math.min(cellU * 0.82, baseSize * scale * aspect));
      const h = Math.max(1.15, Math.min(cellV * 0.82, baseSize * scale / Math.max(0.55, aspect)));
      const jitterU = (rng() - 0.5) * Math.max(0, cellU - w) * 0.35;
      const jitterV = (rng() - 0.5) * Math.max(0, cellV - h) * 0.35;
      const placed = pushFootprint(
        u - w / 2 + jitterU,
        u + w / 2 + jitterU,
        v - h / 2 + jitterV,
        v + h / 2 + jitterV,
      );
      if (placed) added++;
    }
  }

  return buildings;
}

export function generateCoastStripBuildings(coastRoadPolygon: Point[], landPolygon: Point[], rng: Rng): GeneratedBuildingFootprint[] {
  const buildings: GeneratedBuildingFootprint[] = [];
  const stripCentroid = polygonCentroid(coastRoadPolygon);
  for (let i = 0; i < coastRoadPolygon.length; i++) {
    const a = coastRoadPolygon[i];
    const b = coastRoadPolygon[(i + 1) % coastRoadPolygon.length];
    const segDx = b.x - a.x;
    const segDy = b.y - a.y;
    const segLen = Math.hypot(segDx, segDy);
    if (segLen < 5 || rng() < 0.6) continue;
    const tx = segDx / segLen;
    const ty = segDy / segLen;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const p1 = { x: -ty, y: tx };
    const outward = p1.x * (midpoint.x - stripCentroid.x) + p1.y * (midpoint.y - stripCentroid.y) > 0
      ? p1
      : { x: -p1.x, y: -p1.y };

    const numHere = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < numHere; k++) {
      const t = (k + 0.5 + (rng() - 0.5) * 0.7) / numHere;
      const cx = a.x + tx * (t * segLen) + outward.x * (1.4 + rng() * 2.6);
      const cy = a.y + ty * (t * segLen) + outward.y * (1.4 + rng() * 2.6);
      if (!pointInPolygon({ x: cx, y: cy }, landPolygon)) continue;
      const w = 1.8 + rng() * 2.4;
      const h = 1.4 + rng() * 1.6;
      const angle = Math.atan2(ty, tx) + (rng() - 0.5) * 0.5;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const corners = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]
        .map((p) => ({ x: cx + p.x * ca - p.y * sa, y: cy + p.x * sa + p.y * ca }));
      if (!corners.every((corner) => pointInPolygon(corner, landPolygon))) continue;
      buildings.push({
        path: `M ${corners[0].x.toFixed(2)} ${corners[0].y.toFixed(2)} L ${corners[1].x.toFixed(2)} ${corners[1].y.toFixed(2)} L ${corners[2].x.toFixed(2)} ${corners[2].y.toFixed(2)} L ${corners[3].x.toFixed(2)} ${corners[3].y.toFixed(2)} Z`,
        polygon: corners,
        area: polygonArea(corners),
        shade: rng(),
      });
    }
  }
  return buildings;
}
