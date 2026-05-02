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
  if (visible.length < 3) {
    // Polygon is off-viewport (or too clipped). Return its own centroid so the
    // label stays on the polygon — never the viewport center, which would
    // create a ghost label dead-center on the visible area.
    let sx = 0, sy = 0;
    for (const p of polygon) { sx += p.x; sy += p.y; }
    const n = Math.max(1, polygon.length);
    return { x: sx / n, y: sy / n, ...labelMetrics(labelText) };
  }

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

  const result = clamp(globalBest || { x: targetX, y: targetY, text: labelText, ...labelMetrics(labelText) });
  // Final safety: bbox clamp can land outside irregular polygons — snap back to grid centroid
  if (!pointInPolygon({ x: result.x, y: result.y }, visible)) {
    return { ...result, x: targetX, y: targetY };
  }
  return result;
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
  const POLY_EDGE_PAD = 13;  // min distance from district polygon edges
  const VIEW_EDGE_PAD = 16; // min distance from viewport edges

  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.max(VIEW_EDGE_PAD, Math.min.apply(null, xs));
  const maxX = Math.min(VIEW_W - VIEW_EDGE_PAD, Math.max.apply(null, xs));
  const minY = Math.max(VIEW_EDGE_PAD, Math.min.apply(null, ys));
  const maxY = Math.min(VIEW_H - VIEW_EDGE_PAD, Math.max.apply(null, ys));
  if (maxX - minX < 16 || maxY - minY < 16) return [];

  const area = Math.max(1, visibleArea || (maxX - minX) * (maxY - minY));
  const centroid = polygonCentroid(polygon);
  const initialSpacing = Math.sqrt(area / Math.max(1, target)) * 0.92;

  const edgeDistance = (x: number, y: number) => {
    // Viewport edge distance — kept separate so polygon edge pad can be tighter
    const viewportDist = Math.min(x, y, VIEW_W - x, VIEW_H - y);
    if (viewportDist < VIEW_EDGE_PAD) return -1;
    let polyDist = Infinity;
    for (let k = 0; k < polygon.length; k++)
      polyDist = Math.min(polyDist, pointToSegmentDist(x, y, polygon[k], polygon[(k + 1) % polygon.length]));
    return polyDist;
  };

  const insidePolygon = (x: number, y: number) =>
    pointInPolygon({ x, y }, polygon) && !leafBlocksToAvoid.some((lb) => pointInPolygon({ x, y }, lb.polygon));

  const labelPadX = labelAvoid ? labelAvoid.halfW + 6 : 0;
  const labelPadY = labelAvoid ? labelAvoid.halfH + 6 : 0;
  const nearLabel = (x: number, y: number) =>
    !!labelAvoid && Math.abs(x - labelAvoid.x) < labelPadX && Math.abs(y - labelAvoid.y) < labelPadY;
  const nearSeed = (x: number, y: number, minDist: number) =>
    preSeeds.some((p) => Math.hypot(x - p.x, y - p.y) < minDist);

  const bucketAwareMaximin = (candidates: Placed[], count: number) => {
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const aspect = width / height;
    const cols = aspect > 1.35 ? 4 : aspect < 0.74 ? 2 : 3;
    const rows = aspect < 0.74 ? 4 : aspect > 1.35 ? 2 : 3;
    const bucketCount = cols * rows;
    const bucketFor = (point: Point) => {
      const col = Math.max(0, Math.min(cols - 1, Math.floor(((point.x - minX) / width) * cols)));
      const row = Math.max(0, Math.min(rows - 1, Math.floor(((point.y - minY) / height) * rows)));
      return row * cols + col;
    };
    const candidateBuckets = candidates.map(bucketFor);
    const availableByBucket = new Array(bucketCount).fill(0);
    candidateBuckets.forEach((bucket) => { availableByBucket[bucket] += 1; });
    const selected = new Set<number>();
    const selectedByBucket = new Array(bucketCount).fill(0);
    const minD = candidates.map(() => Infinity);

    while (selected.size < count) {
      let best = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        if (selected.has(i)) continue;
        const bucket = candidateBuckets[i];
        const bucketPressure = selectedByBucket[bucket] / Math.max(1, availableByBucket[bucket]);
        const coverageBonus = selectedByBucket[bucket] === 0 ? 620 : 0;
        const spread = selected.size === 0
          ? Math.min(candidates[i].radial, initialSpacing)
          : minD[i];
        const edgeBonus = Math.min(candidates[i].edgeD, 34) * 0.55;
        const centerPenalty = selected.size === 0 ? candidates[i].radial * 0.12 : 0;
        const score = coverageBonus + spread * 1.4 + edgeBonus - bucketPressure * 220 - centerPenalty;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best === -1) break;
      selected.add(best);
      selectedByBucket[candidateBuckets[best]] += 1;
      for (let i = 0; i < candidates.length; i++) {
        const d = Math.hypot(candidates[i].x - candidates[best].x, candidates[i].y - candidates[best].y);
        if (d < minD[i]) minD[i] = d;
      }
    }

    return candidates.filter((_, i) => selected.has(i));
  };

  // Replace Bridson BFS (directionally biased) with: uniform grid scan → candidate pool
  // → bucket-aware maximin sampling. No BFS → no left/right bias, and
  // irregular districts get coverage across lobes instead of centroid-heavy clumps.
  // Reduce step each pass to grow the candidate pool until we have enough to fill target.
  type Placed = Point & { edgeD: number; angle: number; radial: number };
  for (let pass = 0; pass < 5; pass++) {
    const minSep = initialSpacing * Math.pow(0.75, pass);
    const step = minSep * 0.45; // ~5x more candidates than target per pass
    const candidates: Placed[] = [];
    for (let gx = minX + step * 0.5; gx <= maxX; gx += step) {
      for (let gy = minY + step * 0.5; gy <= maxY; gy += step) {
        // Small jitter so points aren't on a perfect grid
        const x = gx + (rng() - 0.5) * step * 0.5;
        const y = gy + (rng() - 0.5) * step * 0.5;
        if (!insidePolygon(x, y)) continue;
        const ed = edgeDistance(x, y);
        if (ed < POLY_EDGE_PAD) continue;
        if (nearLabel(x, y)) continue;
        if (nearSeed(x, y, minSep)) continue;
        candidates.push({ x, y, edgeD: ed, angle: Math.atan2(y - centroid.y, x - centroid.x), radial: Math.hypot(x - centroid.x, y - centroid.y) });
      }
    }
    if (candidates.length < target) continue;

    return bucketAwareMaximin(candidates, target);
  }

  return [];
}
