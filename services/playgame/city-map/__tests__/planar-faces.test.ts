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
