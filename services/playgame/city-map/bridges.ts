import { VIEW_H, VIEW_W } from './config';
import { distToRiver, pointInPolygon, segIntersect } from './geometry';
import { cutSegments } from './paths';
import { truncateCutAtRiver } from './partition';
import type { Point } from './types';

interface CutSegment {
  p1: Point;
  p2: Point;
  polyline?: Point[];
  polylineMode?: string;
  depth: number;
  angle?: number;
  riverBank?: boolean;
}

interface GeneratedBridge {
  x: number;
  y: number;
  angle: number;
  roadAngle?: number;
  depth: number;
  score?: number;
  offshore?: boolean;
  riverMouth?: boolean;
  highwayBackstop?: boolean;
  sameRoadBackstop?: boolean;
  majorRoadBackstop?: boolean;
  renderedCutBackstop?: boolean;
}

interface BridgeGenerationInput {
  allCuts: CutSegment[];
  river: { outerWidth: number };
  riverSegments?: Array<{ a: Point; b: Point }>;
  coastRoadPolygon: Point[];
  landPolygon: Point[];
}

interface BridgeGenerationResult {
  bridges: GeneratedBridge[];
  renderedCuts: CutSegment[];
}

const MIN_BRIDGE_DIST = 20;

function bridgeMinDist(depth = 2) {
  if (depth <= 1) return 20;
  if (depth === 2) return 17;
  if (depth === 3) return 14;
  return 12;
}

function tooClose(x: number, y: number, depth: number | undefined, bridges: Array<{ x: number; y: number; depth?: number }>) {
  const candidateMinDist = bridgeMinDist(depth);
  return bridges.some((bridge) => Math.hypot(bridge.x - x, bridge.y - y) < Math.max(candidateMinDist, bridgeMinDist(bridge.depth)));
}

function cutRiverHits(cut: CutSegment, riverSegments: Array<{ a: Point; b: Point }>) {
  const hits: Array<{ x: number; y: number; along: number; roadAngle: number }> = [];
  let along = 0;
  for (const cutSeg of cutSegments(cut)) {
    const segLen = Math.hypot(cutSeg.b.x - cutSeg.a.x, cutSeg.b.y - cutSeg.a.y) || 1;
    for (const riverSeg of riverSegments) {
      const hit = segIntersect(cutSeg.a, cutSeg.b, riverSeg.a, riverSeg.b);
      if (!hit) continue;
      hits.push({
        x: hit.x,
        y: hit.y,
        along: along + (hit.t ?? 0) * segLen,
        roadAngle: Math.atan2(cutSeg.b.y - cutSeg.a.y, cutSeg.b.x - cutSeg.a.x),
      });
    }
    along += segLen;
  }
  hits.sort((a, b) => a.along - b.along);
  const clustered: typeof hits = [];
  for (const hit of hits) {
    const prev = clustered[clustered.length - 1];
    if (prev && Math.hypot(prev.x - hit.x, prev.y - hit.y) < 18) {
      prev.x = (prev.x + hit.x) / 2;
      prev.y = (prev.y + hit.y) / 2;
      prev.along = (prev.along + hit.along) / 2;
    } else {
      clustered.push({ ...hit });
    }
  }
  return clustered;
}

function riverAngleAt(x: number, y: number, riverSegs: Array<{ a: Point; b: Point }>): number {
  let bestSeg = riverSegs[0];
  let bestDistSq = Infinity;
  for (const seg of riverSegs) {
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - seg.a.x) * dx + (y - seg.a.y) * dy) / lenSq));
    const cx = seg.a.x + t * dx;
    const cy = seg.a.y + t * dy;
    const d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bestDistSq) { bestDistSq = d; bestSeg = seg; }
  }
  return Math.atan2(bestSeg.b.y - bestSeg.a.y, bestSeg.b.x - bestSeg.a.x);
}

function perpScore(bridge: GeneratedBridge, riverSegs: Array<{ a: Point; b: Point }>): number {
  const riverAngle = riverAngleAt(bridge.x, bridge.y, riverSegs);
  return Math.abs(Math.sin((bridge.roadAngle ?? bridge.angle) - riverAngle));
}

function hasBridgeNearCut(cut: CutSegment, riverSegments: Array<{ a: Point; b: Point }>, bridges: Array<{ x: number; y: number }>) {
  for (const cutSeg of cutSegments(cut)) {
    for (const riverSeg of riverSegments) {
      const hit = segIntersect(cutSeg.a, cutSeg.b, riverSeg.a, riverSeg.b);
      if (!hit) continue;
      if (bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 4)) return true;
    }
  }
  return false;
}

export function generateBridges({
  allCuts,
  river,
  riverSegments,
  coastRoadPolygon,
  landPolygon,
}: BridgeGenerationInput): BridgeGenerationResult {
  const bridges: BridgeGenerationResult['bridges'] = [];
  const riverSegs = riverSegments || [];

  if (riverSegs.length) {
    for (const cut of [...allCuts].filter((c) => c.depth <= 3 && !c.riverBank).sort((a, b) => a.depth - b.depth)) {
      for (const hit of cutRiverHits(cut, riverSegs)) {
        if (tooClose(hit.x, hit.y, cut.depth, bridges) && cut.depth > 0) continue;
        bridges.push({ x: hit.x, y: hit.y, angle: hit.roadAngle, roadAngle: hit.roadAngle, depth: cut.depth });
        break;
      }
    }

    for (const cut of allCuts.filter((c) => c.depth === 0)) {
      for (const hit of cutRiverHits(cut, riverSegs)) {
        if (bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 8)) continue;
        bridges.push({ x: hit.x, y: hit.y, angle: hit.roadAngle, roadAngle: hit.roadAngle, depth: 0, highwayBackstop: true });
      }
    }

    for (let i = 0; i < coastRoadPolygon.length; i++) {
      const a = coastRoadPolygon[i];
      const b = coastRoadPolygon[(i + 1) % coastRoadPolygon.length];
      let crHit: Point | null = null;
      for (const riverSeg of riverSegs) {
        const hit = segIntersect(a, b, riverSeg.a, riverSeg.b);
        if (hit) {
          crHit = hit;
          break;
        }
      }
      if (!crHit || bridges.some((bridge) => Math.hypot(bridge.x - crHit!.x, bridge.y - crHit!.y) < MIN_BRIDGE_DIST)) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      bridges.push({ x: crHit.x, y: crHit.y, angle, roadAngle: angle, depth: 1, riverMouth: true });
    }

    const fillCandidates: BridgeGenerationResult['bridges'] = [];
    for (const cut of allCuts) {
      if (cut.riverBank || cut.depth < 2 || cut.depth > 4) continue;
      for (const cutSeg of cutSegments(cut)) {
        for (const riverSeg of riverSegs) {
          const hit = segIntersect(cutSeg.a, cutSeg.b, riverSeg.a, riverSeg.b);
          if (!hit) continue;
          const nearest = bridges.reduce((best, bridge) => Math.min(best, Math.hypot(bridge.x - hit.x, bridge.y - hit.y)), Infinity);
          if (nearest < (cut.depth >= 4 ? 42 : 34) || nearest > (cut.depth >= 4 ? 104 : 88)) continue;
          const angle = Math.atan2(cutSeg.b.y - cutSeg.a.y, cutSeg.b.x - cutSeg.a.x);
          fillCandidates.push({ x: hit.x, y: hit.y, angle, roadAngle: angle, depth: cut.depth, score: nearest - Math.max(0, cut.depth - 3) * 14 });
        }
      }
    }
    fillCandidates.sort((a, b) => (b.score || 0) - (a.score || 0) || a.depth - b.depth);
    for (const candidate of fillCandidates) {
      if (bridges.length > 18) break;
      if (!tooClose(candidate.x, candidate.y, candidate.depth, bridges)) bridges.push(candidate);
    }

    for (const cut of allCuts.filter((c) => c.depth <= 4 && !c.riverBank)) {
      const hits = cutRiverHits(cut, riverSegs);
      if (hits.length < 2) continue;
      const roadIsPreserved = hits.some((hit) => bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 5));
      if (!roadIsPreserved) continue;
      for (const hit of hits) {
        if (bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 5)) continue;
        bridges.push({ x: hit.x, y: hit.y, angle: hit.roadAngle, roadAngle: hit.roadAngle, depth: cut.depth, sameRoadBackstop: true });
      }
    }

    for (const cut of allCuts.filter((c) => c.depth <= 3 && !c.riverBank)) {
      for (const hit of cutRiverHits(cut, riverSegs)) {
        if (bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 5)) continue;
        bridges.push({ x: hit.x, y: hit.y, angle: hit.roadAngle, roadAngle: hit.roadAngle, depth: cut.depth, majorRoadBackstop: true });
      }
    }
  }

  const offshoreCandidates: BridgeGenerationResult['bridges'] = [];
  for (const cut of allCuts.filter((c) => c.depth === 0)) {
    const points = cut.polyline && cut.polyline.length >= 2 ? cut.polyline : [cut.p1, cut.p2];
    const ends = [{ edge: points[0], next: points[1] }, { edge: points[points.length - 1], next: points[points.length - 2] }];
    for (const end of ends) {
      const len = Math.hypot(end.edge.x - end.next.x, end.edge.y - end.next.y) || 1;
      let ox = (end.edge.x - end.next.x) / len;
      let oy = (end.edge.y - end.next.y) / len;
      if (pointInPolygon({ x: end.edge.x + ox * 3, y: end.edge.y + oy * 3 }, landPolygon)) {
        ox = -ox;
        oy = -oy;
      }
      const x = end.edge.x + ox * 160;
      const y = end.edge.y + oy * 160;
      if (x > 4 && x < VIEW_W - 4 && y > 4 && y < VIEW_H - 4) continue;
      if (riverSegs.length && distToRiver(end.edge.x, end.edge.y, riverSegs) < 24) continue;
      offshoreCandidates.push({ x, y, angle: Math.atan2(oy, ox), depth: 0, offshore: true });
    }
  }
  offshoreCandidates.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const candidate of offshoreCandidates) {
    if (bridges.filter((bridge) => bridge.offshore).length >= 2) break;
    if (!tooClose(candidate.x, candidate.y, candidate.depth, bridges)) bridges.push(candidate);
  }

  if (riverSegs.length) {
    const PERP_CULL_DIST = 30;
    const scores = bridges.map((b) => perpScore(b, riverSegs));
    const toRemove = new Set<number>();
    for (let i = 0; i < bridges.length; i++) {
      if (toRemove.has(i) || bridges[i].offshore) continue;
      for (let j = i + 1; j < bridges.length; j++) {
        if (toRemove.has(j) || bridges[j].offshore) continue;
        if (Math.hypot(bridges[i].x - bridges[j].x, bridges[i].y - bridges[j].y) > PERP_CULL_DIST) continue;
        if (scores[i] >= scores[j]) toRemove.add(j);
        else toRemove.add(i);
      }
    }
    for (const idx of [...toRemove].sort((a, b) => b - a)) bridges.splice(idx, 1);
  }

  let renderedCuts = allCuts;
  if (riverSegs.length) {
    const riverGap = (river.outerWidth / 2) + 1;
    renderedCuts = allCuts.flatMap((cut) => {
      if (cut.depth <= 4 && hasBridgeNearCut(cut, riverSegs, bridges)) return [cut];
      return truncateCutAtRiver(cut, riverSegs, riverGap) as CutSegment[];
    });
    for (const cut of renderedCuts) {
      if (cut.riverBank || cut.depth > 4) continue;
      for (const cutSeg of cutSegments(cut)) {
        for (const riverSeg of riverSegs) {
          const hit = segIntersect(cutSeg.a, cutSeg.b, riverSeg.a, riverSeg.b);
          if (!hit || bridges.some((bridge) => Math.hypot(bridge.x - hit.x, bridge.y - hit.y) < 5)) continue;
          const roadAngle = Math.atan2(cutSeg.b.y - cutSeg.a.y, cutSeg.b.x - cutSeg.a.x);
          bridges.push({ x: hit.x, y: hit.y, angle: roadAngle, roadAngle, depth: cut.depth, renderedCutBackstop: true });
        }
      }
    }
  }

  return { bridges, renderedCuts };
}
