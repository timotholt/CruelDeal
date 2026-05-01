import { VIEW_H, VIEW_W } from './config';
import { clipPolygonToRect } from './geometry';
import type { CutPath, Point, PolygonPoint, Segment } from './types';

const fmt = (value: number): string => value.toFixed(2);

export function straightPolylinePath(points: readonly Point[] = []): string {
  if (points.length === 0) return '';
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  return d;
}

export function smoothPolylinePath(points: readonly Point[] = []): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  if (points.length === 2) {
    return `M ${fmt(points[0].x)} ${fmt(points[0].y)} L ${fmt(points[1].x)} ${fmt(points[1].y)}`;
  }
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${fmt(points[i].x)} ${fmt(points[i].y)} ${fmt(mx)} ${fmt(my)}`;
  }
  d += ` L ${fmt(points[points.length - 1].x)} ${fmt(points[points.length - 1].y)}`;
  return d;
}

export function smoothClosedPath(points: readonly Point[] = []): string {
  if (points.length === 0) return '';
  if (points.length < 3) return straightPolylinePath(points);
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const n = points.length;
  const start = mid(points[n - 1], points[0]);
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const next = points[(i + 1) % n];
    const m = mid(p, next);
    d += ` Q ${fmt(p.x)} ${fmt(p.y)} ${fmt(m.x)} ${fmt(m.y)}`;
  }
  return `${d} Z`;
}

export function samplesToSegments(samples: readonly Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    segments.push({ a: samples[i], b: samples[i + 1] });
  }
  return segments;
}

export function sampleSmoothPolyline(points: readonly Point[], stepsPerSeg: number): Segment[] {
  const samples: Point[] = [];
  const k = points.length - 1;
  if (k < 1) {
    if (points.length === 1) samples.push({ x: points[0].x, y: points[0].y });
    return samplesToSegments(samples);
  }
  if (k === 1) {
    samples.push({ x: points[0].x, y: points[0].y });
    samples.push({ x: points[1].x, y: points[1].y });
    return samplesToSegments(samples);
  }

  const steps = stepsPerSeg | 0 || 8;
  samples.push({ x: points[0].x, y: points[0].y });
  for (let i = 1; i < k; i++) {
    const c = points[i];
    const start = i === 1
      ? { x: points[0].x, y: points[0].y }
      : { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 };
    const end = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const mt = 1 - t;
      samples.push({
        x: mt * mt * start.x + 2 * mt * t * c.x + t * t * end.x,
        y: mt * mt * start.y + 2 * mt * t * c.y + t * t * end.y,
      });
    }
  }
  samples.push({ x: points[k].x, y: points[k].y });
  return samplesToSegments(samples);
}

export function cutSegments(cut: CutPath): Segment[] {
  if (!cut.polyline || cut.polyline.length < 2) return [{ a: cut.p1, b: cut.p2 }];
  if (cut.polylineMode === 'jog') return samplesToSegments(cut.polyline);
  return sampleSmoothPolyline(cut.polyline, 8);
}

export function cutPath(cut: CutPath): string {
  if (!cut.polyline) return '';
  return cut.polylineMode === 'jog'
    ? straightPolylinePath(cut.polyline)
    : smoothPolylinePath(cut.polyline);
}

export function cutPoints(cut: CutPath): Point[] {
  return cut.polyline && cut.polyline.length >= 2
    ? cut.polyline
    : [cut.p1, cut.p2];
}

export function offsetPolyline(points: readonly Point[] = [], dist: number): Point[] {
  if (points.length < 2) return points.slice();
  const normals = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    normals.push({ x: -dy / len, y: dx / len });
  }
  return points.map((p, i) => {
    const n1 = normals[Math.max(0, i - 1)];
    const n2 = normals[Math.min(normals.length - 1, i)];
    const nx = n1.x + n2.x;
    const ny = n1.y + n2.y;
    const nLen = Math.hypot(nx, ny) || 1;
    return { x: p.x + (nx / nLen) * dist, y: p.y + (ny / nLen) * dist };
  });
}

export function polygonToPath(polygon: readonly PolygonPoint[]): string {
  const n = polygon.length;
  if (n === 0) return '';
  const isRoadEdge = (i: number) => (
    polygon[i].edgeKind === 'road'
    || polygon[i].edgeKind === 'roadMid'
    || polygon[i].edgeKind === 'roadBend'
  );
  const isCurveMid = (i: number) => polygon[i].edgeKind === 'roadMid';

  let d = `M ${fmt(polygon[0].x)} ${fmt(polygon[0].y)}`;
  let i = 0;
  while (i < n) {
    if (isRoadEdge(i)) {
      let j = i + 1;
      let runHasMid = isCurveMid(i);
      while (j < n && isRoadEdge(j)) {
        if (isCurveMid(j)) runHasMid = true;
        j++;
      }
      const term = polygon[j % n];
      if (runHasMid) {
        const roadPoints: PolygonPoint[] = [];
        for (let k = i; k < j; k++) roadPoints.push(polygon[k]);
        roadPoints.push(term);
        const sub = smoothPolylinePath(roadPoints);
        d += ` ${sub.replace(/^M\s+[\d.-]+\s+[\d.-]+\s*/, '')}`;
      } else {
        for (let k = i + 1; k < j; k++) {
          d += ` L ${fmt(polygon[k].x)} ${fmt(polygon[k].y)}`;
        }
        d += ` L ${fmt(term.x)} ${fmt(term.y)}`;
      }
      i = j;
    } else {
      const next = (i + 1) % n;
      d += ` L ${fmt(polygon[next].x)} ${fmt(polygon[next].y)}`;
      i++;
    }
  }
  return `${d} Z`;
}

export function polygonOutlinePathSkipRoads(polygon: readonly PolygonPoint[]): string {
  const n = polygon.length;
  if (n === 0) return '';
  const isRoad = (i: number) => (
    polygon[i].edgeKind === 'road'
    || polygon[i].edgeKind === 'roadMid'
    || polygon[i].edgeKind === 'roadBend'
  );

  let d = '';
  let penDown = false;
  for (let i = 0; i < n; i++) {
    if (isRoad(i)) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      d += `M ${fmt(polygon[i].x)} ${fmt(polygon[i].y)}`;
      penDown = true;
    }
    const next = (i + 1) % n;
    d += ` L ${fmt(polygon[next].x)} ${fmt(polygon[next].y)}`;
  }
  return d;
}

export function polygonOutlinePathClippedToViewport(
  polygon: readonly PolygonPoint[],
  viewportInset = 1,
): string {
  const rect = {
    minX: viewportInset,
    minY: viewportInset,
    maxX: VIEW_W - viewportInset,
    maxY: VIEW_H - viewportInset,
  };
  const clipped = clipPolygonToRect(polygon, rect);
  const n = clipped.length;
  if (n < 2) return '';
  let d = `M ${fmt(clipped[0].x)} ${fmt(clipped[0].y)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${fmt(clipped[i].x)} ${fmt(clipped[i].y)}`;
  }
  return `${d} Z`;
}

export function rectPolygon(cx: number, cy: number, w: number, h: number, angle: number): Point[] {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ].map(p => ({
    x: cx + p.x * ca - p.y * sa,
    y: cy + p.x * sa + p.y * ca,
  }));
}

export function rectPath(cx: number, cy: number, w: number, h: number, angle: number): string {
  return polygonToPath(rectPolygon(cx, cy, w, h, angle));
}
