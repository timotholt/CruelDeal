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
}

export function generateTensorRoadSegments(opts: StreamlineOptions): TensorRoadSegment[] {
  const seeds = placeSeeds(opts);
  const segments: TensorRoadSegment[] = [];
  let idCounter = 0;

  for (const seed of seeds) {
    const segment = traceStreamline(seed, opts, idCounter++);
    if (segment && segment.points.length >= 2 && segmentLength(segment) >= opts.minLength) {
      segments.push(segment);
    }
  }

  return segments;
}

function placeSeeds(opts: StreamlineOptions): Seed[] {
  const seeds: Seed[] = [];

  for (const road of opts.existingRoads) {
    if (road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < opts.stepSize * 2) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const seedPos = { x: mid.x + nx * opts.stepSize * 2, y: mid.y + ny * opts.stepSize * 2 };
      if (opts.island.containsPoint(seedPos.x, seedPos.y)) {
        seeds.push({ pos: seedPos, priority: 1 });
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
  const points: Vec2[] = [{ x: seed.pos.x, y: seed.pos.y }];
  let current = { x: seed.pos.x, y: seed.pos.y };

  for (let step = 0; step < opts.maxLength / opts.stepSize; step++) {
    const sample = opts.tensorField.sample(current.x, current.y);
    if (sample.strength < 0.01) break;

    const next: Vec2 = {
      x: current.x + Math.cos(sample.angle) * opts.stepSize,
      y: current.y + Math.sin(sample.angle) * opts.stepSize,
    };

    if (!opts.island.containsPoint(next.x, next.y)) break;
    if (tooCloseToExisting(next, points, opts)) break;

    points.push(next);
    current = next;
  }

  if (points.length < 2) return null;

  return {
    id: `tensor:${opts.roadClass}:${id}`,
    roadClass: opts.roadClass,
    points,
    tags: ['tensor', opts.roadClass],
  };
}

function tooCloseToExisting(
  p: Vec2,
  currentPoints: Vec2[],
  opts: StreamlineOptions,
): boolean {
  for (const road of opts.existingRoads) {
    for (const rp of road.points) {
      const dx = p.x - rp.x;
      const dy = p.y - rp.y;
      if (Math.sqrt(dx * dx + dy * dy) < opts.collisionRadius) return true;
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
