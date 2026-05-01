import { pointInPolygon, riverToRiverDistance } from "./geometry";
import { offsetPolyline, sampleSmoothPolyline, smoothPolylinePath } from "./paths";

type Rng = () => number;

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export interface RiverPlan {
  path: string;
  segments: Segment[];
  pts: Point[];
  widthScale: number;
  outerWidth: number;
  innerWidth: number;
  buildingBuffer: number;
  [key: string]: unknown;
}

export interface RiverBankRoadCut {
  p1: Point;
  p2: Point;
  polyline: Point[];
  polylineMode: null;
  depth: number;
  angle: number;
  riverBank: true;
}

export function generateRiver(landPolygon: Point[], rng: Rng): RiverPlan {
  const n = landPolygon.length;
  const i1 = Math.floor(rng() * n);
  const offset = Math.floor(n * 0.4 + rng() * n * 0.2);
  const i2 = (i1 + offset) % n;

  const segIdx = (idx: number) => {
    const a = landPolygon[idx];
    const b = landPolygon[(idx + 1) % n];
    const t = 0.2 + rng() * 0.6;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  };

  const start = segIdx(i1);
  const end = segIdx(i2);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const pts = [start];

  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const taper = Math.sin(t * Math.PI);
    const meander = (rng() - 0.5) * len * 0.22 * taper;
    pts.push({
      x: start.x + dx * t + perpX * meander,
      y: start.y + dy * t + perpY * meander
    });
  }
  pts.push(end);

  const widthScale = 0.55 + rng() * 1.05;
  return {
    path: smoothPolylinePath(pts),
    segments: sampleSmoothPolyline(pts, 10),
    pts,
    widthScale,
    outerWidth: 7 * widthScale,
    innerWidth: 3.5 * widthScale,
    buildingBuffer: 7 * widthScale
  };
}

export function makeRiverBankRoads(river: RiverPlan | null, landPolygon: Point[]): RiverBankRoadCut[] {
  if (!river || !river.segments || river.segments.length < 1) return [];
  const offset = Math.max(4, river.outerWidth / 2 + 1.35);
  const cuts: RiverBankRoadCut[] = [];
  const basePts = [river.segments[0].a, ...river.segments.map((s) => s.b)];
  const runLength = (pts: Point[]) =>
    pts.slice(1).reduce((sum, p, i) => {
      const prev = pts[i];
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);
  const pushRun = (pts: Point[]) => {
    if (pts.length < 2) return;
    const len = runLength(pts);
    if (len < 26) return;
    cuts.push({
      p1: pts[0],
      p2: pts[pts.length - 1],
      polyline: pts,
      polylineMode: null,
      depth: 3,
      angle: Math.atan2(pts[pts.length - 1].y - pts[0].y, pts[pts.length - 1].x - pts[0].x),
      riverBank: true
    });
  };

  for (const side of [-1, 1]) {
    const pts = offsetPolyline(basePts, side * offset);
    let run: Point[] = [];
    for (const p of pts) {
      if (pointInPolygon(p, landPolygon)) run.push(p);
      else {
        pushRun(run);
        run = [];
      }
    }
    pushRun(run);
  }
  return cuts;
}

export function generateRivers(landPolygon: Point[], rng: Rng): RiverPlan | null {
  const river1 = rng() < 0.6 ? generateRiver(landPolygon, rng) : null;
  let river2: RiverPlan | null = null;
  if (river1 && rng() < 0.5) {
    let bestRiver: RiverPlan | null = null;
    let bestDist = -Infinity;
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateRiver(landPolygon, rng);
      const d = riverToRiverDistance(river1, candidate);
      if (d > bestDist) {
        bestDist = d;
        bestRiver = candidate;
      }
      if (d > 46) break;
    }
    river2 = bestDist > 28 ? bestRiver : null;
  }
  if (river1 && river2) {
    return {
      path: `${river1.path} ${river2.path}`,
      segments: [...river1.segments, ...river2.segments],
      pts: river1.pts,
      widthScale: river1.widthScale,
      outerWidth: river1.outerWidth,
      innerWidth: river1.innerWidth,
      buildingBuffer: Math.max(river1.buildingBuffer, river2.buildingBuffer)
    };
  }
  return river1;
}
