import { clipPolygonToRect, distToRiver, pointInPolygon, pointToSegmentDist, polygonArea, polygonCentroid } from './geometry';
import { polygonToPath } from './paths';
import type { Point } from './types';

type Rng = () => number;

const COMMERCIAL_FRONTAGE_SETBACK = 0.22;

interface RoadHazard {
  a: Point;
  b: Point;
  buffer: number;
  priority?: number;
  width?: number;
}

export type BlockAgeTag = 'old' | 'average' | 'new';
export type BlockUseTag = 'commercial' | 'residential' | 'public';

export interface BuildingBlockProfile {
  age: BlockAgeTag;
  use: BlockUseTag;
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

interface PushFootprintOptions {
  ignoreRoadShrink?: boolean;
}

export function generateBlockBuildings(
  blockPolygon: Point[],
  gridAngle: number,
  rng: Rng,
  riverSegments?: Array<{ a: Point; b: Point }> | null,
  roadHazards?: RoadHazard[] | null,
  riverBuffer = 7,
  profile: BuildingBlockProfile = { age: 'average', use: 'residential' },
): GeneratedBuildingFootprint[] {
  const blockArea = polygonArea(blockPolygon);
  const landUse = profile.use;
  const age = profile.age;
  const isCommercial = landUse === 'commercial';
  const isResidential = landUse === 'residential';
  const isPublic = landUse === 'public';
  const isModern = age === 'new';
  const isOld = age === 'old';

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
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of blockPolygon) {
    const u = p.x * cosG - p.y * sinG;
    const v = p.x * sinG + p.y * cosG;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const wU = maxU - minU;
  const wV = maxV - minV;
  if (wU < 7 || wV < 7) return [];

  const targetSize = isCommercial
    ? isOld
      ? 7.4 + rng() * 2.1
      : 8.6 + rng() * 3.6
    : isResidential && isModern
      ? 5.8 + rng() * 1.4
      : isResidential && isOld
        ? 5.4 + rng() * 2.6
        : isIrregular ? 6 + rng() * 2 : 7 + rng() * 3.2;
  const skipRate = isCommercial
    ? isOld ? 0.04 : 0.0
    : isResidential && isModern
      ? 0.04
      : isResidential && isOld
        ? 0.22
        : isIrregular ? 0.15 : 0.01;
  const inset = isCommercial
    ? 0.28
    : isResidential && isModern
      ? 0.42
      : isResidential && isOld
        ? 0.25 + rng() * 0.7
        : isIrregular ? 0.5 : 0.45;
  const nU = Math.max(1, Math.round(wU / targetSize));
  const nV = Math.max(1, Math.round(wV / targetSize));
  const cellU = wU / nU;
  const cellV = wV / nV;
  const buildings: GeneratedBuildingFootprint[] = [];
  const placedUVBoxes: UvBox[] = [];
  const blockCenter = polygonCentroid(blockPolygon);

  const cornersFromUv = (uvCorners: Array<{ u: number; v: number }>) => uvCorners.map((p) => ({
    x: p.u * cosI - p.v * sinI,
    y: p.u * sinI + p.v * cosI,
  }));

  const uvFromPoint = (point: Point) => ({
    u: point.x * cosG - point.y * sinG,
    v: point.x * sinG + point.y * cosG,
  });

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

  const uvBoxesOverlap = (a: UvBox, b: UvBox, pad = 0.25) =>
    a.u2 + pad > b.u1 && a.u1 - pad < b.u2 && a.v2 + pad > b.v1 && a.v1 - pad < b.v2;

  const pushUvCorners = (uvCorners: Array<{ u: number; v: number }>, options: PushFootprintOptions = {}) => {
    const box = uvBoxForCorners(uvCorners);
    if (box.u2 - box.u1 < 1 || box.v2 - box.v1 < 1) return false;
    if (placedUVBoxes.some((placed) => uvBoxesOverlap(box, placed))) {
      return false;
    }
    let corners = cornersFromUv(uvCorners);
    if (!corners.every((corner) => pointInPolygon(corner, blockPolygon))) return false;
    if (footprintNearRiver(corners)) return false;
    let placedBox = box;
    if (!options.ignoreRoadShrink && footprintNearRoad(corners)) {
      let adjusted: { uvCorners: Array<{ u: number; v: number }>; corners: Point[]; box: UvBox } | null = null;
      for (const scale of [0.95, 0.88, 0.8, 0.7, 0.6]) {
        const scaledUv = scaleUvCorners(uvCorners, scale);
        const scaledCorners = cornersFromUv(scaledUv);
        const scaledBox = uvBoxForCorners(scaledUv);
        if (scaledBox.u2 - scaledBox.u1 < 1 || scaledBox.v2 - scaledBox.v1 < 1) continue;
        if (!scaledCorners.every((corner) => pointInPolygon(corner, blockPolygon))) continue;
        if (footprintNearRiver(scaledCorners) || footprintNearRoad(scaledCorners)) continue;
        adjusted = { uvCorners: scaledUv, corners: scaledCorners, box: scaledBox };
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

  const pushFootprint = (u1: number, u2: number, v1: number, v2: number, options: PushFootprintOptions = {}) => {
    let uvCorners = [{ u: u1, v: v1 }, { u: u2, v: v1 }, { u: u2, v: v2 }, { u: u1, v: v2 }];
    const allowSkew = isOld && isResidential;
    if (allowSkew && isIrregular && rng() < 0.36) {
      const maxSkew = Math.min(u2 - u1, v2 - v1) * 0.12;
      const skew = (rng() < 0.5 ? -1 : 1) * maxSkew * (0.35 + rng() * 0.35);
      uvCorners = rng() < 0.5
        ? [{ u: u1 + skew, v: v1 }, { u: u2 + skew, v: v1 }, { u: u2 - skew, v: v2 }, { u: u1 - skew, v: v2 }]
        : [{ u: u1, v: v1 + skew }, { u: u2, v: v1 - skew }, { u: u2, v: v2 - skew }, { u: u1, v: v2 + skew }];
    }
    return pushUvCorners(uvCorners, options);
  };

  const pushRoadFrontageFootprint = (
    hazard: RoadHazard,
    t: number,
    frontage: number,
    depth: number,
    setbackOverride?: number,
  ) => {
    const dx = hazard.b.x - hazard.a.x;
    const dy = hazard.b.y - hazard.a.y;
    const length = Math.hypot(dx, dy);
    if (length < frontage + 1) return false;
    const tx = dx / length;
    const ty = dy / length;
    const base = { x: hazard.a.x + dx * t, y: hazard.a.y + dy * t };
    const n1 = { x: -ty, y: tx };
    const toCenter = { x: blockCenter.x - base.x, y: blockCenter.y - base.y };
    const normal = n1.x * toCenter.x + n1.y * toCenter.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
    const setback = hazard.buffer + (setbackOverride ?? 0.18) + depth * 0.5;
    const center = { x: base.x + normal.x * setback, y: base.y + normal.y * setback };
    const corners = [
      { x: center.x - tx * frontage / 2 - normal.x * depth / 2, y: center.y - ty * frontage / 2 - normal.y * depth / 2 },
      { x: center.x + tx * frontage / 2 - normal.x * depth / 2, y: center.y + ty * frontage / 2 - normal.y * depth / 2 },
      { x: center.x + tx * frontage / 2 + normal.x * depth / 2, y: center.y + ty * frontage / 2 + normal.y * depth / 2 },
      { x: center.x - tx * frontage / 2 + normal.x * depth / 2, y: center.y - ty * frontage / 2 + normal.y * depth / 2 },
    ];
    return pushUvCorners(corners.map(uvFromPoint));
  };

  const clipPolygonByRoadSetback = (subject: Point[], hazard: RoadHazard, setback: number) => {
    const dx = hazard.b.x - hazard.a.x;
    const dy = hazard.b.y - hazard.a.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001 || subject.length < 3) return subject;
    const n1 = { x: -dy / length, y: dx / length };
    const midpoint = { x: (hazard.a.x + hazard.b.x) / 2, y: (hazard.a.y + hazard.b.y) / 2 };
    const toCenter = { x: blockCenter.x - midpoint.x, y: blockCenter.y - midpoint.y };
    const normal = n1.x * toCenter.x + n1.y * toCenter.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
    const offset = hazard.buffer + setback;
    const linePoint = { x: hazard.a.x + normal.x * offset, y: hazard.a.y + normal.y * offset };
    const inside = (point: Point) => ((point.x - linePoint.x) * normal.x + (point.y - linePoint.y) * normal.y) >= -1e-6;
    const intersect = (a: Point, b: Point): Point => {
      const da = (a.x - linePoint.x) * normal.x + (a.y - linePoint.y) * normal.y;
      const db = (b.x - linePoint.x) * normal.x + (b.y - linePoint.y) * normal.y;
      const t = da / ((da - db) || 1e-9);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    const result: Point[] = [];
    for (let i = 0; i < subject.length; i++) {
      const current = subject[i];
      const previous = subject[(i - 1 + subject.length) % subject.length];
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) result.push(intersect(previous, current));
        result.push(current);
      } else if (previousInside) {
        result.push(intersect(previous, current));
      }
    }
    return result.length >= 3 && polygonArea(result) > 2 ? result : [];
  };

  const fillCommercialNewGrid = () => {
    if (!relevantRoadHazards.length) return;
    const envelopeArea = polygonArea(blockPolygon);
    if (envelopeArea < 9) return;

    const SETBACK = 0.5;
    const GAP = 0.36;
    const MIN_DIM = 2.5;
    const gridCell = Math.max(4.0, Math.min(7.0, Math.sqrt(envelopeArea) / 5.0));

    // Push an arbitrary world-coordinate polygon as a building footprint.
    // Slightly shrinks toward centroid so boundary-clipped vertices clear
    // pointInPolygon without affecting visual appearance.
    const pushWorldPoly = (poly: Point[]): boolean => {
      if (poly.length < 3) return false;
      const c = polygonCentroid(poly);
      const shrunk = poly.map((p) => ({ x: c.x + (p.x - c.x) * 0.95, y: c.y + (p.y - c.y) * 0.95 }));
      if (!shrunk.every((p) => pointInPolygon(p, blockPolygon))) return false;
      if (footprintNearRiver(shrunk)) return false;
      const uvPts = shrunk.map(uvFromPoint);
      const box = uvBoxForCorners(uvPts);
      if (box.u2 - box.u1 < 1 || box.v2 - box.v1 < 1) return false;
      if (placedUVBoxes.some((b) => uvBoxesOverlap(box, b))) return false;
      const coords = shrunk.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
      buildings.push({
        path: `M ${coords[0]} L ${coords.slice(1).join(' L ')} Z`,
        polygon: shrunk,
        area: polygonArea(shrunk),
        shade: rng(),
      });
      placedUVBoxes.push(box);
      return true;
    };

    // Process each adjacent road in priority order.
    // For each road: generate a strip of buildings parallel to that road with
    // minimal setback, clipped to block shape (produces trapezoids at corners),
    // then carve that strip from `remaining` for the next pass.
    let remaining = blockPolygon.slice();

    for (const hazard of relevantRoadHazards) {
      if (remaining.length < 3) break;
      const dx = hazard.b.x - hazard.a.x;
      const dy = hazard.b.y - hazard.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) continue;

      const ax = { x: dx / len, y: dy / len };
      const n1 = { x: -ax.y, y: ax.x };
      const mid = { x: (hazard.a.x + hazard.b.x) / 2, y: (hazard.a.y + hazard.b.y) / 2 };
      const toc = { x: blockCenter.x - mid.x, y: blockCenter.y - mid.y };
      const nm = n1.x * toc.x + n1.y * toc.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
      const orig = hazard.a;

      const toLoc = (p: Point) => ({
        u: (p.x - orig.x) * ax.x + (p.y - orig.y) * ax.y,
        v: (p.x - orig.x) * nm.x + (p.y - orig.y) * nm.y,
      });
      const frLoc = (u: number, v: number): Point => ({
        x: orig.x + ax.x * u + nm.x * v,
        y: orig.y + ax.y * u + nm.y * v,
      });

      // origLp = original block polygon in road-local coords.
      // Using it (not `remaining`) for strip extraction and setback reference ensures
      // the front-face distance from the road is identical on every side, regardless
      // of how prior strip carving altered the `remaining` polygon's nearest edge.
      const origLp = blockPolygon.map(toLoc);
      const origMinV = Math.min(...origLp.map((p) => p.v));
      const origMaxV = Math.max(...origLp.map((p) => p.v));
      const frontV = origMinV + SETBACK;

      const lp = remaining.map(toLoc);
      const lMinV = Math.min(...lp.map((p) => p.v));
      const lMaxV = Math.max(...lp.map((p) => p.v));
      const lMinU = Math.min(...lp.map((p) => p.u));
      const lMaxU = Math.max(...lp.map((p) => p.u));

      const depth = Math.min((origMaxV - origMinV) * 0.48, gridCell * 1.6);
      if (depth < MIN_DIM || lMaxU - lMinU < MIN_DIM) continue;

      // Extract front strip from original block polygon so it always starts at the road edge.
      const stripPts = clipPolygonToRect(origLp.map((p) => ({ x: p.u, y: p.v })), {
        minX: lMinU - 1, minY: origMinV, maxX: lMaxU + 1, maxY: origMinV + depth,
      });

      if (stripPts.length >= 3) {
        const sMinU = Math.min(...stripPts.map((p) => p.x));
        const sMaxU = Math.max(...stripPts.map((p) => p.x));
        const sW = sMaxU - sMinU;
        const nB = Math.max(1, Math.round(sW / gridCell));
        const bW = (sW - GAP * (nB + 1)) / nB;

        if (bW >= MIN_DIM) {
          for (let k = 0; k < nB; k++) {
            const bu1 = sMinU + GAP + k * (bW + GAP);
            const bu2 = bu1 + bW;
            // frontV = origMinV + SETBACK: consistent setback from road on every side.
            const cell = clipPolygonToRect(stripPts, {
              minX: bu1, minY: frontV, maxX: bu2, maxY: origMinV + depth - GAP * 0.5,
            });
            if (cell.length >= 3) pushWorldPoly(cell.map((p) => frLoc(p.x, p.y)));
          }
        }
      }

      // Carve this strip from `remaining` so the interior fill pass avoids overlap.
      const carved = clipPolygonToRect(lp.map((p) => ({ x: p.u, y: p.v })), {
        minX: lMinU - 1, minY: origMinV + depth + GAP, maxX: lMaxU + 1, maxY: lMaxV + 1,
      });
      remaining = carved.length >= 3 ? carved.map((p) => frLoc(p.x, p.y)) : [];
    }

    // Fill any remaining interior with a grid aligned to the primary road.
    if (remaining.length >= 3) {
      const pr = relevantRoadHazards[0];
      const dx = pr.b.x - pr.a.x;
      const dy = pr.b.y - pr.a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return;
      const ax = { x: dx / len, y: dy / len };
      const n1 = { x: -ax.y, y: ax.x };
      const mid = { x: (pr.a.x + pr.b.x) / 2, y: (pr.a.y + pr.b.y) / 2 };
      const toc = { x: blockCenter.x - mid.x, y: blockCenter.y - mid.y };
      const nm = n1.x * toc.x + n1.y * toc.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };
      const orig = pr.a;
      const toLoc = (p: Point) => ({
        u: (p.x - orig.x) * ax.x + (p.y - orig.y) * ax.y,
        v: (p.x - orig.x) * nm.x + (p.y - orig.y) * nm.y,
      });
      const frLoc = (u: number, v: number): Point => ({
        x: orig.x + ax.x * u + nm.x * v,
        y: orig.y + ax.y * u + nm.y * v,
      });
      const lp = remaining.map(toLoc);
      const rMinU = Math.min(...lp.map((p) => p.u));
      const rMaxU = Math.max(...lp.map((p) => p.u));
      const rMinV = Math.min(...lp.map((p) => p.v));
      const rMaxV = Math.max(...lp.map((p) => p.v));
      const rW = rMaxU - rMinU;
      const rH = rMaxV - rMinV;
      if (rW < MIN_DIM * 2 || rH < MIN_DIM * 2) return;
      const cols = Math.max(1, Math.round(rW / gridCell));
      const rows = Math.max(1, Math.round(rH / gridCell));
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const bu1 = rMinU + col * (rW / cols) + GAP;
          const bu2 = rMinU + (col + 1) * (rW / cols) - GAP;
          const bv1 = rMinV + row * (rH / rows) + GAP;
          const bv2 = rMinV + (row + 1) * (rH / rows) - GAP;
          const cell = clipPolygonToRect(lp.map((p) => ({ x: p.u, y: p.v })), {
            minX: bu1, minY: bv1, maxX: bu2, maxY: bv2,
          });
          if (cell.length >= 3) pushWorldPoly(cell.map((p) => frLoc(p.x, p.y)));
        }
      }
    }
  };

  const segmentParamForPoint = (point: Point, hazard: RoadHazard) => {
    const dx = hazard.b.x - hazard.a.x;
    const dy = hazard.b.y - hazard.a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 1e-6) return 0.5;
    return Math.max(0.04, Math.min(0.96, ((point.x - hazard.a.x) * dx + (point.y - hazard.a.y) * dy) / lenSq));
  };

  const consumed = new Array(nU * nV).fill(false);
  const cellIdx = (i: number, j: number) => i * nV + j;
  const buildingCoverage = () => buildings.reduce((sum, building) => sum + building.area, 0) / Math.max(1, blockArea);
  const relevantRoadHazards = (roadHazards || []).filter((hazard) => {
    const pad = hazard.buffer + Math.max(cellU, cellV) * 1.4;
    const hx1 = Math.min(hazard.a.x, hazard.b.x);
    const hx2 = Math.max(hazard.a.x, hazard.b.x);
    const hy1 = Math.min(hazard.a.y, hazard.b.y);
    const hy2 = Math.max(hazard.a.y, hazard.b.y);
    return hx2 >= minX - pad && hx1 <= maxX + pad && hy2 >= minY - pad && hy1 <= maxY + pad;
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.width || 0) - (a.width || 0));
  const targetCoverage = isPublic
    ? 0.12
    : isCommercial
      ? isOld ? 0.25 : 0.34
      : isResidential
        ? isModern ? 0.24 : isOld ? 0.16 : 0.2
        : isIrregular ? 0.18 : 0.24;
  const baseSize = Math.max(1.4, Math.min(cellU, cellV));
  const blockDepth = Math.max(1, Math.min(wU, wV));
  const frontageSetback = isCommercial
    ? 0.16
    : isResidential && isModern
      ? 0.36
      : isResidential && isOld
        ? 0.24 + rng() * 1.25
      : 0.3;

  if (isCommercial && isModern) {
    fillCommercialNewGrid();
    return buildings;
  }

  const placeCornerFrontageBuildings = (maxBuildings: number, coverageLimit: number) => {
    if (!relevantRoadHazards.length || maxBuildings <= 0) return 0;
    let added = 0;
    const corners = blockPolygon
      .map((corner, index) => ({ corner, index }))
      .sort(() => rng() - 0.5)
      .sort((left, right) => {
        const best = (point: Point) => Math.max(
          0,
          ...relevantRoadHazards
            .filter((hazard) => pointToSegmentDist(point.x, point.y, hazard.a, hazard.b) < hazard.buffer + baseSize * 1.7)
            .map((hazard) => hazard.priority || 0),
        );
        return best(right.corner) - best(left.corner);
      });
    for (const { corner } of corners) {
      if (added >= maxBuildings || buildingCoverage() >= coverageLimit) break;
      const nearby = relevantRoadHazards
        .filter((hazard) => pointToSegmentDist(corner.x, corner.y, hazard.a, hazard.b) < hazard.buffer + baseSize * 1.7)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.width || 0) - (a.width || 0));
      if (!nearby.length) continue;
      const primaryStreet = nearby[0];
      const t = segmentParamForPoint(corner, primaryStreet);
      const frontage = isCommercial
        ? Math.max(4.2, Math.min(baseSize * 3.4, blockDepth * (0.26 + rng() * 0.2)))
        : isResidential && isModern
          ? Math.max(2.4, Math.min(baseSize * 1.45, blockDepth * (0.14 + rng() * 0.08)))
          : Math.max(2.2, Math.min(baseSize * 1.7, blockDepth * (0.12 + rng() * 0.16)));
      const depthShare = isCommercial
        ? rng() < 0.68 ? 0.5 : 1 / 3
        : isResidential && isModern
          ? 1 / 3
          : rng() < 0.35 ? 0.5 : 1 / 3;
      const depth = Math.max(
        isCommercial ? 3.2 : 1.8,
        Math.min(blockDepth * depthShare, baseSize * (isCommercial ? 3.2 : 1.8), isCommercial ? 24 : 11),
      );
      if (pushRoadFrontageFootprint(primaryStreet, t, frontage, depth, frontageSetback)) added++;
    }
    return added;
  };

  const placeRoadFrontageBuildings = (maxBuildings: number, coverageLimit: number, primary: boolean) => {
    if (!relevantRoadHazards.length || maxBuildings <= 0) return 0;
    let added = 0;
    const hazards = relevantRoadHazards.slice()
      .sort(() => rng() - 0.5)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.width || 0) - (a.width || 0));
    for (const hazard of hazards) {
      if (added >= maxBuildings || buildingCoverage() >= coverageLimit) break;
      const length = Math.hypot(hazard.b.x - hazard.a.x, hazard.b.y - hazard.a.y);
      if (length < 3) continue;
      const step = primary
        ? isCommercial
          ? Math.max(5.0, Math.min(11.5, baseSize * (1.08 + rng() * 0.48)))
          : Math.max(3.1, Math.min(6.6, baseSize * (0.72 + rng() * 0.22)))
        : Math.max(2.3, Math.min(5.4, baseSize * (0.52 + rng() * 0.2)));
      const count = Math.min(primary ? 10 : 12, Math.max(1, Math.floor(length / step)));
      for (let k = 0; k < count && added < maxBuildings && buildingCoverage() < coverageLimit; k++) {
        if (rng() < (primary ? 0.08 : 0.18)) continue;
        const t = Math.max(0.05, Math.min(0.95, (k + 0.5 + (rng() - 0.5) * 0.45) / count));
        const frontage = primary
          ? isCommercial
            ? Math.max(4.0, Math.min(baseSize * 2.4, step * (0.84 + rng() * 0.5)))
            : Math.max(2.0, Math.min(baseSize * 1.25, step * (0.66 + rng() * 0.26)))
          : Math.max(1.4, Math.min(baseSize * 0.95, step * (0.58 + rng() * 0.28)));
        const depth = primary
          ? isCommercial
            ? Math.max(3.0, Math.min(blockDepth * (isOld ? 0.28 : 0.48), baseSize * 2.9, frontage * (0.72 + rng() * 0.52)))
            : Math.max(1.5, Math.min(baseSize * 0.9, frontage * (0.5 + rng() * 0.25)))
          : Math.max(1.15, Math.min(baseSize * 0.72, frontage * (0.56 + rng() * 0.26)));
        const setback = isResidential && isOld ? 0.18 + rng() * 1.45 : frontageSetback;
        if (pushRoadFrontageFootprint(hazard, t, frontage, depth, setback)) added++;
      }
    }
    return added;
  };

  placeCornerFrontageBuildings(Math.min(16, Math.ceil(blockArea / 160)), targetCoverage * 0.48);
  placeRoadFrontageBuildings(Math.min(48, Math.ceil(blockArea / 72)), targetCoverage * 0.72, true);

  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nV; j++) {
      if (consumed[cellIdx(i, j)] || rng() < skipRate) continue;
      const onEdge = i === 0 || i === nU - 1 || j === 0 || j === nV - 1;
      const isCorner = (i === 0 || i === nU - 1) && (j === 0 || j === nV - 1);
      const [pNormal, pCluster, pLarge] = isCommercial
        ? isCorner ? [0.28, 0.12, 0.54] : onEdge ? [0.34, 0.14, 0.44] : [0.22, 0.12, 0.6]
        : isResidential && isModern
          ? isCorner ? [0.72, 0.2, 0.04] : onEdge ? [0.76, 0.18, 0.03] : [0.7, 0.24, 0.03]
          : isResidential && isOld
            ? isCorner ? [0.34, 0.46, 0.08] : onEdge ? [0.42, 0.38, 0.08] : [0.5, 0.3, 0.08]
            : isCorner ? [0.4, 0.4, 0.13] : onEdge ? [0.5, 0.3, 0.13] : [0.65, 0.07, 0.18];
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

  const missingCoverage = targetCoverage - buildingCoverage();
  if (missingCoverage > 0) {
    const maxInfillBuildings = Math.min(
      36,
      Math.ceil((missingCoverage * blockArea) / Math.max(5, baseSize * baseSize * 0.28)),
    );
    let added = 0;
    added += placeRoadFrontageBuildings(maxInfillBuildings - added, targetCoverage, false);
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
