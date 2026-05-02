import { DISTRICT_SHORT_NAMES, MAP_SLOT_EDGE_PAD, MAP_SLOT_HALF_H, MAP_SLOT_HALF_W, VIEW_H, VIEW_W } from "./config";
import { clipPolygonToRect, pointInPolygon, pointToSegmentDist, polygonCentroid } from "./geometry";

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

  // Area centroid of clipped (visible) polygon — what user sees, not the full off-screen district
  let cnt = 0;
  let cSumX = 0;
  let cSumY = 0;
  for (let x = minX; x <= maxX; x += 6) {
    for (let y = minY; y <= maxY; y += 6) {
      if (!pointInPolygon({ x, y }, visible)) continue;
      cSumX += x;
      cSumY += y;
      cnt++;
    }
  }
  const targetX = cnt > 0 ? cSumX / cnt : (minX + maxX) / 2;
  const targetY = cnt > 0 ? cSumY / cnt : (minY + maxY) / 2;
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;
  // Clamp helper: keeps label box inside visible bounding box regardless of fit quality
  const clamp = (lp: LabelPosition): LabelPosition => ({
    ...lp,
    x: Math.max(minX + lp.halfW, Math.min(maxX - lp.halfW, lp.x)),
    y: Math.max(minY + lp.halfH, Math.min(maxY - lp.halfH, lp.y)),
  });

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
      return clamp({ x: targetX, y: targetY, text, score: Infinity, hardFit: true, halfW, halfH });
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
        const score = Math.min(edgeDist, 30) * 0.72 - centroidDist * 0.5 - bboxCenterDist * 0.04 - (boxFits ? 0 : 150) - (dotsClear ? 0 : (24 - dotDist) * 2.6 + 32);
        if (!best || score > (best.score ?? -Infinity)) best = { x, y, text, score, hardFit: boxFits && dotsClear, halfW, halfH };
      }
    }
    if (best?.hardFit) return clamp(best);
    if (best && (!globalBest || (best.score ?? -Infinity) > (globalBest.score ?? -Infinity))) globalBest = best;
  }

  return clamp(globalBest || { x: targetX, y: targetY, text: labelText, ...labelMetrics(labelText) });
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
  labelAvoid: LabelPosition | null = null,
  preSeeds: Point[] = []
) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.max(MAP_SLOT_EDGE_PAD, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - MAP_SLOT_EDGE_PAD, Math.max.apply(null, xs));
  const minY = Math.max(MAP_SLOT_EDGE_PAD, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - MAP_SLOT_EDGE_PAD, Math.max.apply(null, ys));
  if (maxX - minX < 16 || maxY - minY < 16) return [];

  const area = Math.max(1, visibleArea || (maxX - minX) * (maxY - minY));
  const centroid = polygonCentroid(polygon);
  const initialSpacing = Math.sqrt(area / Math.max(1, target)) * 0.92;

  const edgeDistance = (x: number, y: number) => {
    let best = Math.min(x, y, VIEW_W - x, VIEW_H - y);
    for (let k = 0; k < polygon.length; k++)
      best = Math.min(best, pointToSegmentDist(x, y, polygon[k], polygon[(k + 1) % polygon.length]));
    return best;
  };

  const insidePolygon = (x: number, y: number) =>
    pointInPolygon({ x, y }, polygon) && !leafBlocksToAvoid.some((lb) => pointInPolygon({ x, y }, lb.polygon));

  // Retry with smaller spacing if Bridson can't fill target — each pass reduces by 25%
  const placed: Array<Point & { edgeD: number; angle: number; radial: number }> = [];
  for (let pass = 0; pass < 4 && placed.length < target; pass++) {
    const spacing = initialSpacing * Math.pow(0.75, pass);
    const labelExcl = labelAvoid ? labelAvoid.halfW + spacing * 0.55 + 8 : 0;
    placed.length = 0;

    // Pre-seeds act as occupied space — new points stay spacing-away from them.
    // Also seed active list so Bridson grows outward from large landmark positions.
    const occupied: Array<{ x: number; y: number }> = [...preSeeds];
    const tooClose = (x: number, y: number) => {
      if (labelAvoid && Math.hypot(x - labelAvoid.x, y - labelAvoid.y) < labelExcl) return true;
      return occupied.some((p) => Math.hypot(x - p.x, y - p.y) < spacing)
          || placed.some((p) => Math.hypot(x - p.x, y - p.y) < spacing);
    };
    const validPlacement = (x: number, y: number) =>
      insidePolygon(x, y) && edgeDistance(x, y) >= MAP_SLOT_EDGE_PAD && !tooClose(x, y);
    // Start active list from pre-seeds that are inside the polygon
    const active: Array<{ x: number; y: number }> = preSeeds.filter((p) => pointInPolygon(p, polygon));
    const addPoint = (x: number, y: number) => {
      const edgeD = edgeDistance(x, y);
      placed.push({ x, y, edgeD, angle: Math.atan2(y - centroid.y, x - centroid.x), radial: Math.hypot(x - centroid.x, y - centroid.y) });
      active.push({ x, y });
    };
    const plantSeed = (): boolean => {
      if (labelAvoid && placed.length === 0) {
        for (let k = 0; k < 80; k++) {
          const r = labelExcl + rng() * spacing;
          const theta = rng() * Math.PI * 2;
          const x = labelAvoid.x + r * Math.cos(theta);
          const y = labelAvoid.y + r * Math.sin(theta);
          if (validPlacement(x, y)) { addPoint(x, y); return true; }
        }
      }
      for (let k = 0; k < 400; k++) {
        const x = minX + rng() * (maxX - minX);
        const y = minY + rng() * (maxY - minY);
        if (validPlacement(x, y)) { addPoint(x, y); return true; }
      }
      return false;
    };

    if (!plantSeed()) continue;

    // Multi-source BFS: plant stratified seeds spread across polygon so Bridson
    // grows from multiple distributed roots rather than radiating from one point.
    const seedGrid = Math.ceil(Math.sqrt(target * 2));
    const cellW = (maxX - minX) / seedGrid;
    const cellH = (maxY - minY) / seedGrid;
    for (let col = 0; col < seedGrid && placed.length < target; col++) {
      for (let row = 0; row < seedGrid && placed.length < target; row++) {
        for (let attempt = 0; attempt < 12; attempt++) {
          const x = minX + (col + 0.2 + rng() * 0.6) * cellW;
          const y = minY + (row + 0.2 + rng() * 0.6) * cellH;
          if (validPlacement(x, y)) { addPoint(x, y); break; }
        }
      }
    }

    const K = 30;
    let reseeds = 0;
    while (placed.length < target) {
      if (active.length === 0) {
        if (reseeds++ > target || !plantSeed()) break;
        continue;
      }
      const idx = Math.floor(rng() * active.length);
      const ap = active[idx];
      let found = false;
      for (let k = 0; k < K; k++) {
        const r = spacing * (1 + rng());
        const theta = rng() * Math.PI * 2;
        const x = ap.x + r * Math.cos(theta);
        const y = ap.y + r * Math.sin(theta);
        if (x < minX - spacing || x > maxX + spacing || y < minY - spacing || y > maxY + spacing) continue;
        if (!validPlacement(x, y)) continue;
        addPoint(x, y);
        found = true;
        break;
      }
      if (!found) active.splice(idx, 1);
    }
  }

  return placed;
}
