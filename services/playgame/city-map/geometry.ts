import type {
  BoundingBox,
  Point,
  PolygonPoint,
  PolylabelResult,
  RectBounds,
  RiverPath,
  Segment,
  SegmentIntersection,
} from './types';

export const EPS = 1e-9;

export function segIntersect(a: Point, b: Point, c: Point, d: Point): SegmentIntersection | null {
  const dx1 = b.x - a.x;
  const dy1 = b.y - a.y;
  const dx2 = d.x - c.x;
  const dy2 = d.y - c.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS) return null;
  const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / denom;
  const u = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x + t * dx1, y: a.y + t * dy1, t, u };
}

export function pointInPolygon(p: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y))
      && (p.x < ((xj - xi) * (p.y - yi)) / ((yj - yi) || EPS) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonArea(polygon: readonly Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(polygon: readonly Point[]): Point {
  let cx = 0;
  let cy = 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    area += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < EPS) {
    const x = polygon.reduce((sum, p) => sum + p.x, 0) / n;
    const y = polygon.reduce((sum, p) => sum + p.y, 0) / n;
    return { x, y };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function pointToSegmentDist(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || EPS;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function pointToPolygonSignedDist(point: Point, polygon: readonly Point[]): number {
  const edgeDist = polygon.reduce((best, p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    return Math.min(best, pointToSegmentDist(point.x, point.y, p, q));
  }, Infinity);
  return pointInPolygon(point, polygon) ? edgeDist : -edgeDist;
}

export function polylabel(
  polygon: readonly Point[],
  precision = 1.5,
  fallback: Point = { x: 0, y: 0 },
): PolylabelResult {
  if (!polygon || polygon.length < 3) return { x: fallback.x, y: fallback.y, d: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize <= 0) return { x: minX, y: minY, d: 0 };

  const makeCell = (x: number, y: number, h: number) => {
    const d = pointToPolygonSignedDist({ x, y }, polygon);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  let best = makeCell((minX + maxX) / 2, (minY + maxY) / 2, 0);
  const centroid = polygonCentroid(polygon);
  const centroidCell = makeCell(centroid.x, centroid.y, 0);
  if (centroidCell.d > best.d) best = centroidCell;

  const cells = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      cells.push(makeCell(x + cellSize / 2, y + cellSize / 2, cellSize / 2));
    }
  }

  while (cells.length) {
    cells.sort((a, b) => b.max - a.max);
    const cell = cells.shift();
    if (!cell) break;
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    const h = cell.h / 2;
    cells.push(
      makeCell(cell.x - h, cell.y - h, h),
      makeCell(cell.x + h, cell.y - h, h),
      makeCell(cell.x - h, cell.y + h, h),
      makeCell(cell.x + h, cell.y + h, h),
    );
  }

  return { x: best.x, y: best.y, d: best.d };
}

export function segmentToSegmentDist(a: Point, b: Point, c: Point, d: Point): number {
  if (segIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDist(a.x, a.y, c, d),
    pointToSegmentDist(b.x, b.y, c, d),
    pointToSegmentDist(c.x, c.y, a, b),
    pointToSegmentDist(d.x, d.y, a, b),
  );
}

export function polygonToPolygonDist(polyA: readonly Point[], polyB: readonly Point[]): number {
  if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) return Infinity;
  for (const p of polyA) if (pointInPolygon(p, polyB)) return 0;
  for (const p of polyB) if (pointInPolygon(p, polyA)) return 0;
  let best = Infinity;
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      best = Math.min(best, segmentToSegmentDist(a1, a2, b1, b2));
      if (best <= 0) return 0;
    }
  }
  return best;
}

export function clipPolygonToRect<T extends PolygonPoint>(polygon: readonly T[], rect: RectBounds): PolygonPoint[] {
  const clipEdge = (
    poly: readonly PolygonPoint[],
    isInside: (point: PolygonPoint) => boolean,
    intersectFn: (a: PolygonPoint, b: PolygonPoint) => PolygonPoint,
  ) => {
    if (!poly.length) return poly.slice();
    const result: PolygonPoint[] = [];
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const prev = poly[(i - 1 + poly.length) % poly.length];
      const cIn = isInside(curr);
      const pIn = isInside(prev);
      if (cIn) {
        if (!pIn) result.push(intersectFn(prev, curr));
        result.push(curr);
      } else if (pIn) {
        result.push(intersectFn(prev, curr));
      }
    }
    return result;
  };

  const inheritKind = (a: PolygonPoint) => a.edgeKind || 'coast';
  let clipped: readonly PolygonPoint[] = polygon;
  clipped = clipEdge(clipped, p => p.x >= rect.minX, (a, b) => {
    const t = (rect.minX - a.x) / (b.x - a.x || EPS);
    return { x: rect.minX, y: a.y + t * (b.y - a.y), edgeKind: inheritKind(a), _clipNew: true };
  });
  clipped = clipEdge(clipped, p => p.x <= rect.maxX, (a, b) => {
    const t = (rect.maxX - a.x) / (b.x - a.x || EPS);
    return { x: rect.maxX, y: a.y + t * (b.y - a.y), edgeKind: inheritKind(a), _clipNew: true };
  });
  clipped = clipEdge(clipped, p => p.y >= rect.minY, (a, b) => {
    const t = (rect.minY - a.y) / (b.y - a.y || EPS);
    return { x: a.x + t * (b.x - a.x), y: rect.minY, edgeKind: inheritKind(a), _clipNew: true };
  });
  clipped = clipEdge(clipped, p => p.y <= rect.maxY, (a, b) => {
    const t = (rect.maxY - a.y) / (b.y - a.y || EPS);
    return { x: a.x + t * (b.x - a.x), y: rect.maxY, edgeKind: inheritKind(a), _clipNew: true };
  });
  return clipped.slice();
}

export function insetPolygon<T extends Point>(polygon: readonly T[], dist: number): Point[] {
  const n = polygon.length;
  if (n < 3) return polygon.map(p => ({ x: p.x, y: p.y }));
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / n;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / n;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const cur = polygon[i];
    const next = polygon[(i + 1) % n];
    const e1x = cur.x - prev.x;
    const e1y = cur.y - prev.y;
    const e2x = next.x - cur.x;
    const e2y = next.y - cur.y;
    const e1Len = Math.hypot(e1x, e1y) || EPS;
    const e2Len = Math.hypot(e2x, e2y) || EPS;
    let n1x = -e1y / e1Len;
    let n1y = e1x / e1Len;
    if (n1x * (cx - (prev.x + cur.x) / 2) + n1y * (cy - (prev.y + cur.y) / 2) < 0) {
      n1x = -n1x;
      n1y = -n1y;
    }
    let n2x = -e2y / e2Len;
    let n2y = e2x / e2Len;
    if (n2x * (cx - (cur.x + next.x) / 2) + n2y * (cy - (cur.y + next.y) / 2) < 0) {
      n2x = -n2x;
      n2y = -n2y;
    }
    const bx = n1x + n2x;
    const by = n1y + n2y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-6) {
      out.push({ x: cur.x + n1x * dist, y: cur.y + n1y * dist });
      continue;
    }
    const moveDist = dist / (bLen / 2);
    out.push({ x: cur.x + (bx / bLen) * moveDist, y: cur.y + (by / bLen) * moveDist });
  }
  return out;
}

export function polygonBBox(polygon: readonly Point[]): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

export function closestPointOnPolygon(px: number, py: number, polygon: readonly Point[]): Point & { dist: number } {
  let best = Infinity;
  let bx = px;
  let by = py;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || EPS;
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const d = Math.hypot(px - cx, py - cy);
    if (d < best) {
      best = d;
      bx = cx;
      by = cy;
    }
  }
  return { x: bx, y: by, dist: best };
}

export function distToRiver(x: number, y: number, riverSegments: readonly Segment[] = []): number {
  if (!riverSegments.length) return Infinity;
  let best = Infinity;
  for (const segment of riverSegments) {
    const d = pointToSegmentDist(x, y, segment.a, segment.b);
    if (d < best) best = d;
  }
  return best;
}

export function riverToRiverDistance(a?: RiverPath | null, b?: RiverPath | null): number {
  if (!a || !b || !a.segments || !b.segments) return Infinity;
  let best = Infinity;
  for (const sa of a.segments) {
    for (const sb of b.segments) {
      best = Math.min(best, segmentToSegmentDist(sa.a, sa.b, sb.a, sb.b));
    }
  }
  return best;
}
