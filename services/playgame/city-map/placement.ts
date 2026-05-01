import { DISTRICT_SHORT_NAMES, MAP_SLOT_EDGE_PAD, MAP_SLOT_HALF_H, MAP_SLOT_HALF_W, VIEW_H, VIEW_W } from "./config";
import { clipPolygonToRect, pointInPolygon, pointToSegmentDist, polygonCentroid, polylabel } from "./geometry";

type Rng = () => number;

export interface Point {
  x: number;
  y: number;
}

export interface LabelPosition extends Point {
  text?: string;
  score?: number;
  hardFit?: boolean;
  halfW: number;
  halfH: number;
}

export function labelMetrics(text: string) {
  return {
    halfW: Math.min(62, Math.max(24, text.length * 4.9)),
    halfH: 8
  };
}

export function labelPosition(polygon: Point[], landmarks: Array<{ polygon: Point[] }> = [], labelText = "", dots: Point[] = []): LabelPosition {
  const margin = 24;
  const visible = clipPolygonToRect(polygon, { minX: margin, minY: margin, maxX: VIEW_W - margin, maxY: VIEW_H - margin });
  if (visible.length < 3) return { x: VIEW_W / 2, y: VIEW_H / 2, ...labelMetrics(labelText) };

  const xs = visible.map((p) => p.x);
  const ys = visible.map((p) => p.y);
  const minX = Math.min.apply(null, xs);
  const maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys);
  const maxY = Math.max.apply(null, ys);

  let cnt = 0;
  let cSumX = 0;
  let cSumY = 0;
  for (let x = minX; x <= maxX; x += 4) {
    for (let y = minY; y <= maxY; y += 4) {
      if (!pointInPolygon({ x, y }, visible)) continue;
      if (landmarks.some((lm) => pointInPolygon({ x, y }, lm.polygon))) continue;
      cSumX += x;
      cSumY += y;
      cnt++;
    }
  }

  const centroidX = cnt > 0 ? cSumX / cnt : (minX + maxX) / 2;
  const centroidY = cnt > 0 ? cSumY / cnt : (minY + maxY) / 2;
  const visualCenter = polylabel(visible, 1.2, { x: VIEW_W / 2, y: VIEW_H / 2 });
  const targetX = Number.isFinite(visualCenter.x) ? visualCenter.x : centroidX;
  const targetY = Number.isFinite(visualCenter.y) ? visualCenter.y : centroidY;
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;

  const rectDotDistance = (x: number, y: number, halfW: number, halfH: number, dot: Point) => {
    const dx = Math.max(Math.abs(dot.x - x) - halfW, 0);
    const dy = Math.max(Math.abs(dot.y - y) - halfH, 0);
    return Math.hypot(dx, dy);
  };

  const labelBoxFits = (x: number, y: number, halfW: number, halfH: number) => {
    const pts = [
      { x: x - halfW, y: y - halfH },
      { x, y: y - halfH },
      { x: x + halfW, y: y - halfH },
      { x: x - halfW, y },
      { x: x + halfW, y },
      { x: x - halfW, y: y + halfH },
      { x, y: y + halfH },
      { x: x + halfW, y: y + halfH }
    ];
    return pts.every((p) => pointInPolygon(p, visible) && !landmarks.some((lm) => pointInPolygon(p, lm.polygon)));
  };

  const shortNames = DISTRICT_SHORT_NAMES as Partial<Record<string, string>>;
  const shortText = shortNames[labelText] || labelText.slice(0, Math.min(4, labelText.length));
  const textOptions = [labelText, shortText].filter((t, i, a) => t && a.indexOf(t) === i);
  let globalBest: LabelPosition | null = null;

  for (const text of textOptions) {
    const { halfW, halfH } = labelMetrics(text);
    if (labelBoxFits(targetX, targetY, halfW, halfH)) {
      return { x: targetX, y: targetY, text, score: Infinity, hardFit: true, halfW, halfH };
    }
    let best: LabelPosition | null = null;
    for (let x = minX; x <= maxX; x += 3) {
      for (let y = minY; y <= maxY; y += 3) {
        if (!pointInPolygon({ x, y }, visible)) continue;
        if (landmarks.some((lm) => pointInPolygon({ x, y }, lm.polygon))) continue;
        const boxFits = labelBoxFits(x, y, halfW, halfH);
        let edgeDist = Infinity;
        for (let i = 0; i < visible.length; i++) edgeDist = Math.min(edgeDist, pointToSegmentDist(x, y, visible[i], visible[(i + 1) % visible.length]));
        for (const lm of landmarks) {
          for (let i = 0; i < lm.polygon.length; i++) edgeDist = Math.min(edgeDist, pointToSegmentDist(x, y, lm.polygon[i], lm.polygon[(i + 1) % lm.polygon.length]));
        }
        let dotDist = Infinity;
        for (const dot of dots) dotDist = Math.min(dotDist, rectDotDistance(x, y, halfW + 10, halfH + 10, dot));
        const dotsClear = dotDist > 24;
        const centroidDist = Math.hypot(x - targetX, y - targetY);
        const bboxCenterDist = Math.hypot(x - bboxCenterX, y - bboxCenterY);
        const score = Math.min(edgeDist, 30) * 0.72 - centroidDist * 1.12 - bboxCenterDist * 0.04 - (boxFits ? 0 : 48) - (dotsClear ? 0 : (24 - dotDist) * 2.6 + 32);
        if (!best || score > (best.score ?? -Infinity)) best = { x, y, text, score, hardFit: boxFits && dotsClear, halfW, halfH };
      }
    }
    if (best?.hardFit) return best;
    if (best && (!globalBest || (best.score ?? -Infinity) > (globalBest.score ?? -Infinity))) globalBest = best;
  }

  return globalBest || { x: targetX, y: targetY, text: labelText, ...labelMetrics(labelText) };
}

export function viewportVisibleArea(polygon: Point[]) {
  const step = 6;
  let count = 0;
  for (let x = step / 2; x < VIEW_W; x += step) {
    for (let y = step / 2; y < VIEW_H; y += step) {
      if (pointInPolygon({ x, y }, polygon)) count++;
    }
  }
  return count * step * step;
}

export function slotCountsByRank(visAreas: number[], rng: Rng) {
  const indexed = visAreas.map((a, i) => ({ a, i }));
  indexed.sort((x, y) => x.a - y.a);
  const pairsByRank = [2, rng() < 0.5 ? 3 : 4, 5];
  const result = new Array<number>(visAreas.length);
  indexed.forEach((item, rank) => {
    result[item.i] = pairsByRank[rank] * 2;
  });
  return result;
}

export function placeDotsInPolygon(
  polygon: Point[],
  rng: Rng,
  leafBlocksToAvoid: Array<{ polygon: Point[] }>,
  target: number,
  visibleArea?: number,
  labelAvoid: LabelPosition | null = null
) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.max(MAP_SLOT_EDGE_PAD, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - MAP_SLOT_EDGE_PAD, Math.max.apply(null, xs));
  const minY = Math.max(MAP_SLOT_EDGE_PAD, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - MAP_SLOT_EDGE_PAD, Math.max.apply(null, ys));
  const placed: Array<Point & { edgeD: number; angle: number; radial: number }> = [];
  if (maxX - minX < 16 || maxY - minY < 16) return placed;

  const area = Math.max(1, visibleArea || (maxX - minX) * (maxY - minY));
  const idealSpacing = Math.sqrt(area / Math.max(1, target)) * 0.92;
  const insideBlocked = (x: number, y: number) => {
    if (!pointInPolygon({ x, y }, polygon)) return true;
    if (labelAvoid) {
      const pad = Math.max(MAP_SLOT_HALF_W, MAP_SLOT_HALF_H) + 7;
      if (Math.abs(x - labelAvoid.x) < labelAvoid.halfW + pad && Math.abs(y - labelAvoid.y) < labelAvoid.halfH + pad) return true;
    }
    return leafBlocksToAvoid.some((lb) => pointInPolygon({ x, y }, lb.polygon));
  };
  const edgeDistance = (x: number, y: number) => {
    let best = Math.min(x, y, VIEW_W - x, VIEW_H - y);
    for (let k = 0; k < polygon.length; k++) best = Math.min(best, pointToSegmentDist(x, y, polygon[k], polygon[(k + 1) % polygon.length]));
    return best;
  };

  const centroid = polygonCentroid(polygon);
  const candidates: Array<Point & { edgeD: number; angle: number; radial: number }> = [];
  const candidateTarget = Math.max(700, target * 180);
  let attempts = 0;
  while (candidates.length < candidateTarget && attempts < candidateTarget * 8) {
    attempts++;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    if (insideBlocked(x, y)) continue;
    const edgeD = edgeDistance(x, y);
    if (edgeD < MAP_SLOT_EDGE_PAD) continue;
    candidates.push({ x, y, edgeD, angle: Math.atan2(y - centroid.y, x - centroid.x), radial: Math.hypot(x - centroid.x, y - centroid.y) });
  }

  const angleSep = (a: number, b: number) => {
    const d = Math.abs(a - b) % (Math.PI * 2);
    return Math.min(d, Math.PI * 2 - d);
  };

  while (placed.length < target && candidates.length) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let nearestDot = placed.length ? Infinity : idealSpacing * 0.75;
      let nearestAngle = placed.length ? Infinity : Math.PI;
      for (const p of placed) {
        nearestDot = Math.min(nearestDot, Math.hypot(p.x - c.x, p.y - c.y));
        nearestAngle = Math.min(nearestAngle, angleSep(p.angle, c.angle));
      }
      const score = Math.min(nearestDot, idealSpacing * 1.15) * 1.2 + Math.min(c.edgeD - MAP_SLOT_EDGE_PAD, idealSpacing * 0.45) * 0.5 + Math.min(c.radial, idealSpacing * 1.35) * 0.34 + Math.min(nearestAngle, Math.PI / 2) * 12 + rng() * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    placed.push(candidates.splice(bestIdx, 1)[0]);
  }

  if (placed.length < 2) return placed;
  relaxPlacedDots(placed, polygon, insideBlocked, edgeDistance, minX, maxX, minY, maxY, idealSpacing);
  return placed;
}

function relaxPlacedDots(
  placed: Array<Point & { edgeD: number; angle: number; radial: number }>,
  polygon: Point[],
  insideBlocked: (x: number, y: number) => boolean,
  edgeDistance: (x: number, y: number) => number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  idealSpacing: number
) {
  const dotRepelSpacing = idealSpacing * 0.58;
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < placed.length; i++) {
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < placed.length; j++) {
        if (i === j) continue;
        const dx = placed[i].x - placed[j].x;
        const dy = placed[i].y - placed[j].y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < dotRepelSpacing) {
          const f = ((dotRepelSpacing - d) / dotRepelSpacing) * 0.72;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      for (let k = 0; k < polygon.length; k++) {
        const a = polygon[k];
        const b = polygon[(k + 1) % polygon.length];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const len2 = ex * ex + ey * ey || 1e-9;
        const t = Math.max(0, Math.min(1, ((placed[i].x - a.x) * ex + (placed[i].y - a.y) * ey) / len2));
        const cx = a.x + t * ex;
        const cy = a.y + t * ey;
        const dx = placed[i].x - cx;
        const dy = placed[i].y - cy;
        const d = Math.hypot(dx, dy);
        if (d < MAP_SLOT_EDGE_PAD + 8 && d > 0.01) {
          const f = ((MAP_SLOT_EDGE_PAD + 8 - d) / (MAP_SLOT_EDGE_PAD + 8)) * 1.75;
          fx += (dx / d) * f;
          fy += (dy / d) * f;
        }
      }
      const newX = placed[i].x + fx * 0.28;
      const newY = placed[i].y + fy * 0.28;
      if (!insideBlocked(newX, newY) && edgeDistance(newX, newY) >= MAP_SLOT_EDGE_PAD) {
        placed[i].x = Math.max(minX, Math.min(maxX, newX));
        placed[i].y = Math.max(minY, Math.min(maxY, newY));
      }
    }
  }
}
