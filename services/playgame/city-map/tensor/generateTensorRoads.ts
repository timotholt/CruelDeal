import type { IslandMask, RoadClass, TensorField, TensorRoadSegment, Vec2 } from './types';

export interface StreamlineOptions {
  roadClass: RoadClass;
  tensorField: TensorField;
  island: IslandMask;
  rng: () => number;
  existingRoads: TensorRoadSegment[];
  seedCount: number;
  stepSize: number;
  collisionRadius: number;
  maxLength: number;
  minLength: number;
  perpendicularAxis?: boolean;
}

export interface StreamlineResult {
  segments: TensorRoadSegment[];
  rejected: TensorRoadSegment[];
  seeds: Vec2[];
}

export function generateTensorRoadSegments(opts: StreamlineOptions): StreamlineResult {
  const seeds = placeSeeds(opts);
  const segments: TensorRoadSegment[] = [];
  const rejected: TensorRoadSegment[] = [];
  let idCounter = 0;

  const liveExisting = [...opts.existingRoads];
  const liveOpts = { ...opts, existingRoads: liveExisting };

  for (const seed of seeds) {
    const segment = traceStreamline(seed, liveOpts, idCounter++);
    if (!segment || segment.points.length < 2) continue;
    if (segmentLength(segment) >= opts.minLength) {
      segments.push(segment);
      liveExisting.push(segment);
    } else {
      rejected.push(segment);
    }
  }

  return { segments, rejected, seeds: seeds.map((s) => s.pos) };
}

function placeSeeds(opts: StreamlineOptions): Seed[] {
  const seeds: Seed[] = [];
  const roadSeedSpacing = opts.collisionRadius * 3;

  for (const road of opts.existingRoads) {
    if (seeds.length >= opts.seedCount) break;
    if (road.points.length < 2) continue;
    let distSinceSeed = roadSeedSpacing;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      distSinceSeed += len;
      if (len < opts.stepSize * 2 || distSinceSeed < roadSeedSpacing) continue;
      distSinceSeed = 0;
      const nx = -dy / len;
      const ny = dx / len;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const seedPos = { x: mid.x + nx * opts.stepSize * 2, y: mid.y + ny * opts.stepSize * 2 };
      if (opts.island.containsPoint(seedPos.x, seedPos.y)) {
        seeds.push({ pos: seedPos, priority: 1 });
        if (seeds.length >= opts.seedCount) break;
      }
    }
  }

  const bbox = computeBBox(opts.island.outline);
  for (let i = 0; i < opts.seedCount; i++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = bbox.minX + opts.rng() * (bbox.maxX - bbox.minX);
      const y = bbox.minY + opts.rng() * (bbox.maxY - bbox.minY);
      if (opts.island.containsPoint(x, y)) {
        seeds.push({ pos: { x, y }, priority: 0 });
        break;
      }
    }
  }

  seeds.sort((a, b) => b.priority - a.priority);
  return seeds;
}

interface Seed {
  pos: Vec2;
  priority: number;
}

function traceStreamline(
  seed: Seed,
  opts: StreamlineOptions,
  id: number,
): TensorRoadSegment | null {
  const seedSample = opts.tensorField.sample(seed.pos.x, seed.pos.y);
  const axisOffset = opts.perpendicularAxis ? Math.PI / 2 : 0;
  const startAngle = seedSample.angle + axisOffset;

  const forward = traceInDirection(seed.pos, startAngle, opts);
  const backward = traceInDirection(seed.pos, startAngle + Math.PI, opts);

  const points: Vec2[] = [
    ...backward.slice().reverse(),
    { x: seed.pos.x, y: seed.pos.y },
    ...forward,
  ];

  if (points.length < 2) return null;

  return {
    id: `tensor:${opts.roadClass}:${id}`,
    roadClass: opts.roadClass,
    points,
    tags: ['tensor', opts.roadClass],
  };
}

function traceInDirection(start: Vec2, initialAngle: number, opts: StreamlineOptions): Vec2[] {
  const points: Vec2[] = [];
  let current = { x: start.x, y: start.y };
  let prevAngle = initialAngle;

  for (let step = 0; step < opts.maxLength / opts.stepSize; step++) {
    const sample = opts.tensorField.sample(current.x, current.y);
    if (sample.strength < 0.01) break;

    const axisOffset = opts.perpendicularAxis ? Math.PI / 2 : 0;
    let angle = sample.angle + axisOffset;

    const diff = normalizeAngleDiff(angle - prevAngle);
    if (Math.abs(diff) > Math.PI / 2) angle += Math.PI;
    prevAngle = angle;

    const next: Vec2 = {
      x: current.x + Math.cos(angle) * opts.stepSize,
      y: current.y + Math.sin(angle) * opts.stepSize,
    };

    if (!opts.island.containsPoint(next.x, next.y)) break;
    if (tooCloseToExisting(next, points, opts)) break;

    points.push(next);
    current = next;
  }

  return points;
}

function normalizeAngleDiff(diff: number): number {
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function tooCloseToExisting(
  p: Vec2,
  currentPoints: Vec2[],
  opts: StreamlineOptions,
): boolean {
  for (const road of opts.existingRoads) {
    const isSameClass = road.roadClass === opts.roadClass;
    const isHighway = road.roadClass === 'highway';
    const radius = isHighway ? opts.collisionRadius : isSameClass ? opts.collisionRadius : 0;
    if (radius <= 0) continue;
    for (const rp of road.points) {
      const dx = p.x - rp.x;
      const dy = p.y - rp.y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) return true;
    }
  }
  for (let i = 0; i < currentPoints.length - 1; i++) {
    const cp = currentPoints[i];
    const dx = p.x - cp.x;
    const dy = p.y - cp.y;
    if (Math.sqrt(dx * dx + dy * dy) < opts.collisionRadius * 0.5) return true;
  }
  return false;
}

function segmentLength(seg: TensorRoadSegment): number {
  let total = 0;
  for (let i = 1; i < seg.points.length; i++) {
    const dx = seg.points[i].x - seg.points[i - 1].x;
    const dy = seg.points[i].y - seg.points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

function computeBBox(poly: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
