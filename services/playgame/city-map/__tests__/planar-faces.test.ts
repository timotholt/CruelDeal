import { strict as assert } from 'node:assert';
import { extractPlanarFaces } from '../planar-faces';
import type { Point } from '../types';

const pass = (label: string) => console.log(`PASS: ${label}`);

const square = (s: number): Point[] => [
  { x: 0, y: 0 },
  { x: s, y: 0 },
  { x: s, y: s },
  { x: 0, y: s },
];

// Phase 1: stub returns []
{
  const faces = extractPlanarFaces([], square(100));
  assert.equal(Array.isArray(faces), true, 'returns an array');
  pass('phase-1: stub returns array');
}

// Phase 2: snap does not crash on trivial inputs
{
  const faces = extractPlanarFaces([
    { id: 'e1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
    { id: 'e2', points: [{ x: 10.1, y: 0 }, { x: 20, y: 0 }] },  // 10.1 ≈ 10 → snaps
  ], square(100));
  assert.equal(faces.length, 0, 'phase 2 returns empty (walker not yet implemented)');
  pass('phase-2: snap does not crash');
}
