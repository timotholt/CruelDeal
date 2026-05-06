import type { IslandMask, TensorRoadSegment, Vec2 } from './types';

export function cleanTensorRoads(
  segments: TensorRoadSegment[],
  island: IslandMask,
  simplifyTolerance: number,
): TensorRoadSegment[] {
  let cleaned = segments.filter((seg) => island.containsPolygon(seg.points, 0.6));

  cleaned = cleaned.map((seg) => ({
    ...seg,
    points: simplifyPolyline(seg.points, simplifyTolerance),
  }));

  cleaned = deduplicateRoads(cleaned);

  cleaned = cleaned.filter((seg) => seg.points.length >= 2);

  return cleaned;
}

function simplifyPolyline(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points;
  return douglasPeucker(points, tolerance);
}

function douglasPeucker(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDist(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist <= epsilon) return [first, last];

  const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIdx), epsilon);

  return [...left.slice(0, -1), ...right];
}

function perpendicularDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.001) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function deduplicateRoads(segments: TensorRoadSegment[]): TensorRoadSegment[] {
  const result: TensorRoadSegment[] = [];

  for (const seg of segments) {
    let isDuplicate = false;
    for (const existing of result) {
      if (roadsOverlap(seg, existing)) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) result.push(seg);
  }

  return result;
}

function roadsOverlap(a: TensorRoadSegment, b: TensorRoadSegment): boolean {
  let overlapCount = 0;
  for (const pa of a.points) {
    for (const pb of b.points) {
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      if (Math.sqrt(dx * dx + dy * dy) < 8) {
        overlapCount++;
        if (overlapCount > a.points.length * 0.3) return true;
      }
    }
  }
  return false;
}
