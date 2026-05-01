import { VIEW_H, VIEW_W } from "./config";
import { EPS, clipPolygonToRect, pointInPolygon, polygonArea, polygonCentroid, segIntersect, segmentToSegmentDist } from "./geometry";
import { cutSegments, samplesToSegments } from "./paths";
import { viewportVisibleArea } from "./placement";
import type { CutPath } from "./types";

type Rng = () => number;

export interface Point {
  x: number;
  y: number;
  edgeKind?: string;
}

export interface Cut {
  p1: Point;
  p2: Point;
  polyline?: Point[];
  polylineMode?: "smooth" | "jog" | string;
  depth?: number;
  angle?: number;
  dividedHighway?: boolean;
  diagonalOverlay?: boolean;
}

export interface BspNode {
  polygon: Point[];
  depth: number;
  isLeaf: boolean;
  cut?: Cut;
  left?: BspNode;
  right?: BspNode;
  bigLandmark?: boolean;
}

export function splitPolygonByLine(polygon: Point[], L1: Point, L2: Point, polylineMids: Point[] | null = null, polylineMode: "smooth" | "jog" = "smooth") {
  const ints = [];
  for (let i = 0; i < polygon.length; i++) {
    const inter = segIntersect(L1, L2, polygon[i], polygon[(i + 1) % polygon.length]);
    if (inter) ints.push({ x: inter.x, y: inter.y, edgeIdx: i, u: inter.u });
  }
  if (ints.length < 2) return null;
  ints.sort((p, q) => p.edgeIdx - q.edgeIdx);
  const I1 = ints[0];
  let I2 = null;
  for (let i = 1; i < ints.length; i++) {
    if (ints[i].edgeIdx !== I1.edgeIdx) {
      I2 = ints[i];
      break;
    }
  }
  if (!I2 || I1.u < EPS || I1.u > 1 - EPS || I2.u < EPS || I2.u > 1 - EPS) return null;

  const a = I1.edgeIdx;
  const b = I2.edgeIdx;
  const aKind = polygon[a].edgeKind || "coast";
  const bKind = polygon[b].edgeKind || "coast";
  const mids = polylineMids || [];
  const midEdgeKind = polylineMode === "jog" ? "roadBend" : "roadMid";

  const half1: Point[] = [];
  for (let i = 0; i <= a; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half1.push({ x: I1.x, y: I1.y, edgeKind: "road" });
  for (const m of mids) half1.push({ x: m.x, y: m.y, edgeKind: midEdgeKind });
  half1.push({ x: I2.x, y: I2.y, edgeKind: bKind });
  for (let i = b + 1; i < polygon.length; i++) half1.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });

  const half2: Point[] = [{ x: I1.x, y: I1.y, edgeKind: aKind }];
  for (let i = a + 1; i <= b; i++) half2.push({ x: polygon[i].x, y: polygon[i].y, edgeKind: polygon[i].edgeKind });
  half2.push({ x: I2.x, y: I2.y, edgeKind: "road" });
  for (let i = mids.length - 1; i >= 0; i--) half2.push({ x: mids[i].x, y: mids[i].y, edgeKind: midEdgeKind });

  if (polygonArea(half1) < 50 || polygonArea(half2) < 50) return null;
  const polyline = mids.length ? [{ x: I1.x, y: I1.y }, ...mids.map((m) => ({ x: m.x, y: m.y })), { x: I2.x, y: I2.y }] : null;
  return [half1, half2, { p1: { x: I1.x, y: I1.y }, p2: { x: I2.x, y: I2.y }, polyline, polylineMode: mids.length ? polylineMode : null }] as const;
}

function curveLine(P1: Point, P2: Point, rng: Rng) {
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const len = Math.hypot(dx, dy);
  if (len < 55) return null;
  const perpX = -dy / len;
  const perpY = dx / len;
  const amp = 0.06 + rng() * 0.08;
  const isS = rng() < 0.2;
  const side = rng() < 0.5 ? 1 : -1;
  const a1 = (0.55 + rng() * 0.45) * amp * len * side;
  const a2 = (0.55 + rng() * 0.45) * amp * len * (isS ? -side : side);
  return [
    P1,
    { x: P1.x + dx * 0.33 + perpX * a1, y: P1.y + dy * 0.33 + perpY * a1 },
    { x: P1.x + dx * 0.66 + perpX * a2, y: P1.y + dy * 0.66 + perpY * a2 },
    P2
  ];
}

export function tryCurveCut(polygon: Point[], straightResult: NonNullable<ReturnType<typeof splitPolygonByLine>>, p1: Point, p2: Point, rng: Rng) {
  const I1 = straightResult[2].p1;
  const I2 = straightResult[2].p2;
  const poly = curveLine(I1, I2, rng);
  if (!poly) return null;
  const mids = poly.slice(1, -1);
  if (mids.some((m) => !pointInPolygon(m, polygon))) return null;
  return splitPolygonByLine(polygon, p1, p2, mids);
}

function jogLine(P1: Point, P2: Point, rng: Rng) {
  const dx = P2.x - P1.x;
  const dy = P2.y - P1.y;
  const len = Math.hypot(dx, dy);
  if (len < 70) return null;
  const mostlyVertical = Math.abs(dy) >= Math.abs(dx);
  const amp = Math.min(54, Math.max(20, len * (0.14 + rng() * 0.12))) * (rng() < 0.5 ? 1 : -1);
  const makeL = rng() < 0.76;
  const t1 = 0.24 + rng() * 0.18;
  const t2 = makeL ? (rng() < 0.5 ? 0.86 + rng() * 0.06 : 0.1 + rng() * 0.06) : 0.58 + rng() * 0.18;
  const tA = Math.min(t1, t2);
  const tB = Math.max(t1, t2);
  if (mostlyVertical) {
    const y1 = P1.y + dy * tA;
    const y2 = P1.y + dy * tB;
    if (makeL) {
      return [P1, { x: P1.x + dx * tA, y: y1 }, { x: P1.x + dx * tA + amp, y: y1 }, { x: P1.x + dx * tB + amp, y: y2 }, { x: P2.x, y: y2 }, P2];
    }
    return [P1, { x: P1.x + dx * tA, y: y1 }, { x: P1.x + dx * tA + amp, y: y1 }, { x: P1.x + dx * tB + amp, y: y2 }, { x: P1.x + dx * tB, y: y2 }, P2];
  }
  const x1 = P1.x + dx * tA;
  const x2 = P1.x + dx * tB;
  if (makeL) {
    return [P1, { x: x1, y: P1.y + dy * tA }, { x: x1, y: P1.y + dy * tA + amp }, { x: x2, y: P1.y + dy * tB + amp }, { x: P2.x, y: P1.y + dy * tB + amp }, P2];
  }
  return [P1, { x: x1, y: P1.y + dy * tA }, { x: x1, y: P1.y + dy * tA + amp }, { x: x2, y: P1.y + dy * tB + amp }, { x: x2, y: P1.y + dy * tB }, P2];
}

function polylineInsidePolygon(points: Point[], polygon: Point[]) {
  for (let i = 1; i < points.length - 1; i++) if (!pointInPolygon(points[i], polygon)) return false;
  for (const s of samplesToSegments(points)) {
    if (!pointInPolygon({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }, polygon)) return false;
  }
  return true;
}

export function tryJogCut(polygon: Point[], straightResult: NonNullable<ReturnType<typeof splitPolygonByLine>>, p1: Point, p2: Point, rng: Rng) {
  const I1 = straightResult[2].p1;
  const I2 = straightResult[2].p2;
  for (let attempt = 0; attempt < 6; attempt++) {
    const poly = jogLine(I1, I2, rng);
    if (!poly) return null;
    if (!polylineInsidePolygon(poly, polygon)) continue;
    const jogged = splitPolygonByLine(polygon, p1, p2, poly.slice(1, -1), "jog");
    if (jogged) return jogged;
  }
  return null;
}

export function truncateCutAtRiver(cut: Cut, riverSegs: Array<{ a: Point; b: Point }>, gap: number): Cut[] {
  const segs = cutSegments(cut as CutPath);
  if (!segs.length || !riverSegs?.length) return [cut];
  const runs: Point[][] = [];
  let curRun: Point[] = [{ x: segs[0].a.x, y: segs[0].a.y }];
  let anyHit = false;

  for (const s of segs) {
    const sx = s.b.x - s.a.x;
    const sy = s.b.y - s.a.y;
    const segLen = Math.hypot(sx, sy) || 1;
    const ux = sx / segLen;
    const uy = sy / segLen;
    const hits = [];
    for (const rs of riverSegs) {
      const hit = segIntersect(s.a, s.b, rs.a, rs.b);
      if (hit) hits.push({ x: hit.x, y: hit.y, t: hit.t });
    }
    if (!hits.length) {
      curRun.push({ x: s.b.x, y: s.b.y });
      continue;
    }
    anyHit = true;
    hits.sort((p, q) => p.t - q.t);
    for (const h of hits) {
      curRun.push({ x: h.x - ux * gap, y: h.y - uy * gap });
      runs.push(curRun);
      curRun = [{ x: h.x + ux * gap, y: h.y + uy * gap }];
    }
    curRun.push({ x: s.b.x, y: s.b.y });
  }
  if (curRun.length) runs.push(curRun);
  if (!anyHit) return [cut];

  const out: Cut[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    let len = 0;
    for (let i = 1; i < run.length; i++) len += Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y);
    if (len < 4) continue;
    out.push(
      run.length === 2
        ? { p1: run[0], p2: run[1], depth: cut.depth }
        : { p1: run[0], p2: run[run.length - 1], polyline: run, polylineMode: cut.polylineMode || "jog", depth: cut.depth }
    );
  }
  return out;
}

function pickBspCut(polygon: Point[], rng: Rng, gridAngle: number, depth: number) {
  const c = polygonCentroid(polygon);
  const cosG = Math.cos(-gridAngle);
  const sinG = Math.sin(-gridAngle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of polygon) {
    const u = p.x * cosG - p.y * sinG;
    const v = p.x * sinG + p.y * cosG;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const wU = maxU - minU;
  const wV = maxV - minV;
  const crossSectU = wU >= wV;
  const cutAngle = crossSectU ? gridAngle + Math.PI / 2 : gridAngle;
  const dx = Math.cos(cutAngle);
  const dy = Math.sin(cutAngle);
  const offDx = crossSectU ? Math.cos(gridAngle) : -Math.sin(gridAngle);
  const offDy = crossSectU ? Math.sin(gridAngle) : Math.cos(gridAngle);
  const dim = crossSectU ? wU : wV;
  const offset = (rng() - 0.5) * dim * 0.5;
  const px = c.x + offDx * offset;
  const py = c.y + offDy * offset;
  const huge = 4000;
  return { angle: cutAngle, p1: { x: px - dx * huge, y: py - dy * huge }, p2: { x: px + dx * huge, y: py + dy * huge }, depth };
}

export function tryGridCut(polygon: Point[], gridAngle: number, useSecondaryAxis: boolean, offsetMagnitude: number, rng: Rng) {
  const c = polygonCentroid(polygon);
  const cutAngle = useSecondaryAxis ? gridAngle + Math.PI / 2 : gridAngle;
  const dx = Math.cos(cutAngle);
  const dy = Math.sin(cutAngle);
  const offset = (rng() - 0.5) * offsetMagnitude;
  const px = c.x - dy * offset;
  const py = c.y + dx * offset;
  const huge = 4000;
  const p1 = { x: px - dx * huge, y: py - dy * huge };
  const p2 = { x: px + dx * huge, y: py + dy * huge };
  const result = splitPolygonByLine(polygon, p1, p2);
  if (!result) return null;
  return { halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle, cutLineP1: p1, cutLineP2: p2 };
}

function tryAngleCut(polygon: Point[], baseAngle: number, offsetMagnitude: number, rng: Rng) {
  const c = polygonCentroid(polygon);
  const cutAngle = baseAngle + (rng() - 0.5) * 0.035;
  const dx = Math.cos(cutAngle);
  const dy = Math.sin(cutAngle);
  const offset = (rng() - 0.5) * offsetMagnitude;
  const px = c.x - dy * offset;
  const py = c.y + dx * offset;
  const huge = 4000;
  const p1 = { x: px - dx * huge, y: py - dy * huge };
  const p2 = { x: px + dx * huge, y: py + dy * huge };
  const result = splitPolygonByLine(polygon, p1, p2);
  if (!result) return null;
  return { halfA: result[0], halfB: result[1], cutSeg: result[2], angle: cutAngle, cutLineP1: p1, cutLineP2: p2 };
}

export function macroDivide3(landPolygon: Point[], gridAngle: number, rng: Rng, riverSegments: Array<{ a: Point; b: Point }> | null = null) {
  const totalArea = polygonArea(landPolygon);
  const target1 = totalArea * (0.15 + rng() * 0.3);
  const visibleBBox = (poly: Point[]) => {
    const clipped = clipPolygonToRect(poly, { minX: 0, minY: 0, maxX: VIEW_W, maxY: VIEW_H });
    if (clipped.length < 3) return { w: 0, h: 0 };
    const xs = clipped.map((p) => p.x);
    const ys = clipped.map((p) => p.y);
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  const findFirstCut = (minRatio: number, minVisibleSmaller: number, minMinDim: number) => {
    let best: (NonNullable<ReturnType<typeof tryGridCut>> & { useSecondary: boolean }) | null = null;
    let bestScore = Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
      const useSecondary = attempt % 2 === 0;
      const r = tryGridCut(landPolygon, gridAngle, useSecondary, 80 + rng() * 50, rng);
      if (!r) continue;
      const aArea = polygonArea(r.halfA);
      const bArea = polygonArea(r.halfB);
      if (aArea < 1500 || bArea < 1500) continue;
      const visA = viewportVisibleArea(r.halfA);
      const visB = viewportVisibleArea(r.halfB);
      if (visA < 2500 || visB < 2500) continue;
      if (Math.min(aArea, bArea) < totalArea * minRatio || Math.min(visA, visB) < minVisibleSmaller) continue;
      const bbA = visibleBBox(r.halfA);
      const bbB = visibleBBox(r.halfB);
      if (Math.min(Math.min(bbA.w, bbA.h), Math.min(bbB.w, bbB.h)) < minMinDim) continue;
      const score = Math.abs(Math.min(aArea, bArea) - target1);
      if (score < bestScore) {
        best = { ...r, useSecondary };
        bestScore = score;
      }
    }
    return best;
  };

  let best1 = findFirstCut(0.12, 3500, 48) || findFirstCut(0.08, 2800, 38) || findFirstCut(0, 2000, 28) || findFirstCut(0, 2000, 0);
  if (!best1) return { regions: [landPolygon], macroCuts: [] as Cut[] };
  const roadCut1: Cut = {
    p1: best1.cutSeg.p1,
    p2: best1.cutSeg.p2,
    polyline: best1.cutSeg.polyline || undefined,
    polylineMode: best1.cutSeg.polylineMode || undefined,
    depth: 0,
    angle: best1.angle,
    dividedHighway: rng() < 0.5
  };
  const aArea = polygonArea(best1.halfA);
  const bArea = polygonArea(best1.halfB);
  const smaller = aArea <= bArea ? best1.halfA : best1.halfB;
  const larger = aArea <= bArea ? best1.halfB : best1.halfA;

  const findSecondCut = (minMinDim: number) => {
    let best = null as (NonNullable<ReturnType<typeof tryGridCut>> & { isDiagonalAvenue: boolean }) | null;
    let bestScore = Infinity;
    const secondAxis = !best1.useSecondary;
    for (let attempt = 0; attempt < 24; attempt++) {
      const r = tryGridCut(larger, gridAngle, secondAxis, 50 + rng() * 30, rng);
      if (!r) continue;
      const xA = polygonArea(r.halfA);
      const xB = polygonArea(r.halfB);
      if (xA < 1200 || xB < 1200 || viewportVisibleArea(r.halfA) < 2500 || viewportVisibleArea(r.halfB) < 2500) continue;
      const bbA = visibleBBox(r.halfA);
      const bbB = visibleBBox(r.halfB);
      if (Math.min(bbA.w, bbA.h) < minMinDim || Math.min(bbB.w, bbB.h) < minMinDim) continue;
      let riverPenalty = 0;
      if (riverSegments?.length) {
        let nearestRiver = Infinity;
        for (const rs of riverSegments) nearestRiver = Math.min(nearestRiver, segmentToSegmentDist(r.cutSeg.p1, r.cutSeg.p2, rs.a, rs.b));
        if (nearestRiver < 18) riverPenalty += (18 - nearestRiver) / 9;
      }
      const score = Math.max(xA, xB) / Math.max(1, Math.min(xA, xB)) + riverPenalty;
      if (score < bestScore) {
        best = { ...r, isDiagonalAvenue: false };
        bestScore = score;
      }
    }
    return best;
  };

  const best2 = findSecondCut(65) || findSecondCut(55) || findSecondCut(42) || findSecondCut(32);
  if (!best2) return { regions: [smaller, larger], macroCuts: [roadCut1] };
  const roadCut2: Cut = {
    p1: best2.cutSeg.p1,
    p2: best2.cutSeg.p2,
    polyline: best2.cutSeg.polyline || undefined,
    polylineMode: best2.cutSeg.polylineMode || undefined,
    depth: 1,
    angle: best2.angle
  };
  void tryAngleCut;
  return { regions: [smaller, best2.halfA, best2.halfB], macroCuts: [roadCut1, roadCut2] };
}

export function bspSubdivide(polygon: Point[], depth: number, gridAngle: number, rng: Rng): BspNode {
  const area = polygonArea(polygon);
  const minArea = 160 + rng() * 200;
  const maxDepth = 8 + Math.floor(rng() * 3);
  if (depth >= 3 && depth <= 4 && rng() < 0.08 && area > 1800 && area < 6000) return { polygon, depth, isLeaf: true, bigLandmark: true };
  if (depth >= maxDepth || area < minArea) return { polygon, depth, isLeaf: true };

  let result: ReturnType<typeof splitPolygonByLine> | null = null;
  let cutInfo: ReturnType<typeof pickBspCut> | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    cutInfo = pickBspCut(polygon, rng, gridAngle, depth);
    result = splitPolygonByLine(polygon, cutInfo.p1, cutInfo.p2);
    if (result && polygonArea(result[0]) > 30 && polygonArea(result[1]) > 30) break;
    result = null;
  }
  if (!result || !cutInfo) return { polygon, depth, isLeaf: true };
  return {
    polygon,
    depth,
    isLeaf: false,
    cut: { ...result[2], depth, angle: cutInfo.angle },
    left: bspSubdivide(result[0], depth + 1, gridAngle, rng),
    right: bspSubdivide(result[1], depth + 1, gridAngle, rng)
  };
}

export function collectAllCuts(node: BspNode, out: Cut[] = []) {
  if (!node.isLeaf) {
    if (node.cut) out.push(node.cut);
    if (node.left) collectAllCuts(node.left, out);
    if (node.right) collectAllCuts(node.right, out);
  }
  return out;
}

export function collectLeaves(node: BspNode, out: BspNode[] = []) {
  if (node.isLeaf) out.push(node);
  else {
    if (node.left) collectLeaves(node.left, out);
    if (node.right) collectLeaves(node.right, out);
  }
  return out;
}

export function collectAtDepth(node: BspNode, targetDepth: number, out: BspNode[] = []) {
  if (node.depth === targetDepth || node.isLeaf) out.push(node);
  else {
    if (node.left) collectAtDepth(node.left, targetDepth, out);
    if (node.right) collectAtDepth(node.right, targetDepth, out);
  }
  return out;
}

export function leavesUnder(node: BspNode, out: BspNode[] = []) {
  return collectLeaves(node, out);
}

export function nearestLandmarkDistance(polygon: Point[], landmarks: Array<{ polygon: Point[] }>, predicate?: (landmark: { polygon: Point[] }) => boolean) {
  const c = polygonCentroid(polygon);
  let best = Infinity;
  for (const lm of landmarks) {
    if (predicate && !predicate(lm)) continue;
    const lc = polygonCentroid(lm.polygon);
    best = Math.min(best, Math.hypot(c.x - lc.x, c.y - lc.y));
  }
  return best;
}

export function weightedPickRemove<T extends { weight?: number }>(items: T[], rng: Rng) {
  let total = 0;
  for (const item of items) total += Math.max(0, item.weight || 0);
  if (total <= 0) return items.splice(Math.floor(rng() * items.length), 1)[0];
  let ticket = rng() * total;
  for (let i = 0; i < items.length; i++) {
    ticket -= Math.max(0, items[i].weight || 0);
    if (ticket <= 0) return items.splice(i, 1)[0];
  }
  return items.pop();
}
