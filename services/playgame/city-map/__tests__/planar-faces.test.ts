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

// Test 1: empty input → one face covering clip
{
  const faces = extractPlanarFaces([], square(100));
  assert.equal(faces.length, 1, 'empty input gives 1 face');
  assert.ok(Math.abs(faces[0].area - 10000) < 1, `expected area ≈ 10000, got ${faces[0].area}`);
  pass('empty input → 1 face');
}

// Test 2: one horizontal road splits square into 2 faces
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 2, `expected 2 faces, got ${faces.length}`);
  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  assert.ok(Math.abs(totalArea - 10000) < 2, `total area ≈ 10000, got ${totalArea}`);
  pass('horizontal road → 2 faces');
}

// Test 3: plus-sign → 4 faces
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(faces.length, 4, `expected 4 faces, got ${faces.length}`);
  for (const face of faces) {
    assert.ok(Math.abs(face.area - 2500) < 2, `each face ≈ 2500, got ${face.area}`);
  }
  pass('plus-sign → 4 faces');
}

// Test 4: dead-end road does not split the space
{
  const faces = extractPlanarFaces([
    { id: 'dead', points: [{ x: 20, y: 50 }, { x: 60, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 1, `dead-end gives 1 face, got ${faces.length}`);
  assert.ok(Math.abs(faces[0].area - 10000) < 5, `area ≈ 10000, got ${faces[0].area}`);
  pass('dead-end → 1 face');
}

// Test 5: T-intersection → 3 faces
{
  const faces = extractPlanarFaces([
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
    { id: 'stub', points: [{ x: 50, y: 50 }, { x: 100, y: 50 }] },
  ], square(100));
  assert.equal(faces.length, 3, `expected 3 faces, got ${faces.length}`);
  const totalArea = faces.reduce((s, f) => s + f.area, 0);
  assert.ok(Math.abs(totalArea - 10000) < 5, `total area ≈ 10000, got ${totalArea}`);
  pass('T-intersection → 3 faces');
}

// Test 6: determinism
{
  const a = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  const b = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'deterministic');
  pass('determinism');
}

// Test 7: boundedByEdgeIds includes road ids
{
  const faces = extractPlanarFaces([
    { id: 'h', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] },
    { id: 'v', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }] },
  ], square(100));
  for (const face of faces) {
    assert.ok(face.boundedByEdgeIds.includes('h'), 'contains h');
    assert.ok(face.boundedByEdgeIds.includes('v'), 'contains v');
  }
  pass('boundedByEdgeIds includes road ids');
}
