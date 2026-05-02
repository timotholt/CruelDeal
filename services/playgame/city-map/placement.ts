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

  type Placed = Point & { edgeD: number; angle: number; radial: number };

  const trimMaximin = (points: Placed[], count: number) => {
    if (points.length <= count) return points;
    const minD = points.map(() => Infinity);
    const selected = new Set<number>();
    let first = 0;
    let bestStart = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - centroid.x, points[i].y - centroid.y);
      if (d < bestStart) { bestStart = d; first = i; }
    }
    selected.add(first);
    for (let i = 0; i < points.length; i++)
      minD[i] = Math.hypot(points[i].x - points[first].x, points[i].y - points[first].y);
    while (selected.size < count) {
      let best = -1;
      let bestMin = -1;
      for (let i = 0; i < points.length; i++) {
        if (selected.has(i)) continue;
        if (minD[i] > bestMin) { bestMin = minD[i]; best = i; }
      }
      if (best === -1) break;
      selected.add(best);
      for (let i = 0; i < points.length; i++) {
        const d = Math.hypot(points[i].x - points[best].x, points[i].y - points[best].y);
        if (d < minD[i]) minD[i] = d;
      }
    }
    return points.filter((_, i) => selected.has(i));
  };

  const pointKey = (p: Point) => `${Math.round(p.x * 10)}:${Math.round(p.y * 10)}`;

  const completeFromCandidateGrid = (basePoints: Placed[], count: number) => {
    const selected = trimMaximin(basePoints, Math.min(count, basePoints.length)).slice();
    if (selected.length >= count) return selected;

    const selectedKeys = new Set(selected.map(pointKey));
    const relaxedEdgePad = Math.max(7, POLY_EDGE_PAD * 0.62);
    const seedClearance = Math.max(12, initialSpacing * 0.32);
    const duplicateClearance = 8;
    const step = Math.max(5, Math.min(14, initialSpacing * 0.22));
    const candidates: Placed[] = [];

    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        const jitterX = (rng() - 0.5) * step * 0.54;
        const jitterY = (rng() - 0.5) * step * 0.54;
        const cx = Math.max(minX, Math.min(maxX, x + jitterX));
        const cy = Math.max(minY, Math.min(maxY, y + jitterY));
        if (!insidePolygon(cx, cy) || nearLabel(cx, cy)) continue;
        const edgeD = edgeDistance(cx, cy);
        if (edgeD < relaxedEdgePad) continue;
        if (nearSeed(cx, cy, seedClearance)) continue;
        if (selected.some((p) => Math.hypot(cx - p.x, cy - p.y) < duplicateClearance)) continue;
        const candidate = {
          x: cx,
          y: cy,
          edgeD,
          angle: Math.atan2(cy - centroid.y, cx - centroid.x),
          radial: Math.hypot(cx - centroid.x, cy - centroid.y)
        };
        candidates.push(candidate);
      }
    }

    while (selected.length < count && candidates.length > 0) {
      let bestIndex = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const key = pointKey(candidate);
        if (selectedKeys.has(key)) continue;
        const minToSelected = selected.length
          ? Math.min(...selected.map((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y)))
          : initialSpacing;
        const minToSeed = preSeeds.length
          ? Math.min(...preSeeds.map((p) => Math.hypot(candidate.x - p.x, candidate.y - p.y)))
          : initialSpacing;
        const edgeScore = Math.min(candidate.edgeD, 28) * 0.38;
        const score = minToSelected * 1.28 + minToSeed * 0.34 + edgeScore - candidate.radial * 0.015;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
      if (bestIndex < 0) break;
      const [best] = candidates.splice(bestIndex, 1);
      selected.push(best);
      selectedKeys.add(pointKey(best));
    }

    return selected;
  };

  // Multi-source Bridson growth gives better coverage for concave and skinny
  // districts than a pure grid candidate scan, while maximin trim keeps the
  // final count spread out and deterministic enough for regression tests.
  const placed: Placed[] = [];
  for (let pass = 0; pass < 4 && placed.length < target; pass++) {
    const spacing = initialSpacing * Math.pow(0.75, pass);
    placed.length = 0;
    const occupied: Point[] = [...preSeeds];
    const tooClose = (x: number, y: number) =>
      nearLabel(x, y)
      || nearSeed(x, y, spacing)
      || occupied.some((p) => Math.hypot(x - p.x, y - p.y) < spacing)
      || placed.some((p) => Math.hypot(x - p.x, y - p.y) < spacing);

    const validPlacement = (x: number, y: number) =>
      insidePolygon(x, y) && edgeDistance(x, y) >= POLY_EDGE_PAD && !tooClose(x, y);

    const active: Point[] = preSeeds.filter((p) => pointInPolygon(p, polygon));
    const addPoint = (x: number, y: number) => {
      const edgeD = edgeDistance(x, y);
      placed.push({ x, y, edgeD, angle: Math.atan2(y - centroid.y, x - centroid.x), radial: Math.hypot(x - centroid.x, y - centroid.y) });
      active.push({ x, y });
    };

    const plantSeed = () => {
      if (labelAvoid && placed.length === 0) {
        for (let k = 0; k < 80; k++) {
          const offX = (rng() < 0.5 ? -1 : 1) * ((labelAvoid.halfW + 6) + rng() * spacing);
          const offY = (rng() - 0.5) * ((labelAvoid.halfH + 6) + spacing) * 2;
          const x = labelAvoid.x + offX;
          const y = labelAvoid.y + offY;
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

    const seedGrid = Math.ceil(Math.sqrt(target * 2));
    const cellW = (maxX - minX) / seedGrid;
    const cellH = (maxY - minY) / seedGrid;
    for (let col = 0; col < seedGrid; col++) {
      for (let row = 0; row < seedGrid; row++) {
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

    if (placed.length >= target) return trimMaximin(placed, target);
  }

  return completeFromCandidateGrid(placed, target);
}
