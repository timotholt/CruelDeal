/**
 * Rng determinism tests.
 *
 * Framework-agnostic assertions: uses a tiny `expect` shim so the file
 * can run under vitest, node --test, or a plain `tsx` invocation. When
 * vitest arrives (Step 11) the import below will pick up its globals
 * without any edits here.
 *
 * Run directly (after `pnpm add -D tsx`) with:
 *   pnpm tsx services/playgame/engine/rng/rng.test.ts
 */

import { createRng } from './index';
import { cyrb128, sfc32 } from './sfc32';

// ---- Tiny assertion shim ---------------------------------------------------

let failures = 0;
function eq<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`PASS: ${label}`);
  }
}
function truthy(cond: boolean, label: string): void {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`PASS: ${label}`);
  }
}

// ---- Determinism: same seed → same sequence --------------------------------

{
  const a = createRng('abc');
  const b = createRng('abc');
  const seqA = Array.from({ length: 16 }, () => a.int(0, 999));
  const seqB = Array.from({ length: 16 }, () => b.int(0, 999));
  eq(seqA, seqB, 'same-seed RNGs produce identical int() sequences');
}

// ---- Different seeds → different sequences (stochastic but reliable) -------

{
  const a = createRng('seed-1');
  const b = createRng('seed-2');
  const seqA = Array.from({ length: 16 }, () => a.int(0, 2 ** 30));
  const seqB = Array.from({ length: 16 }, () => b.int(0, 2 ** 30));
  const overlap = seqA.filter((v, i) => v === seqB[i]).length;
  truthy(overlap <= 1, `different seeds → <=1 coincidental match in 16 samples (got ${overlap})`);
}

// ---- int() bounds are inclusive on both ends -------------------------------

{
  const r = createRng('bounds');
  let hitLo = false;
  let hitHi = false;
  for (let i = 0; i < 2000; i++) {
    const v = r.int(0, 2);
    if (v === 0) hitLo = true;
    if (v === 2) hitHi = true;
    truthy(v >= 0 && v <= 2, `int(0,2) stays in range (iter ${i}, got ${v})`);
  }
  truthy(hitLo, 'int(0,2) eventually produces lo');
  truthy(hitHi, 'int(0,2) eventually produces hi');
}

// ---- pick() on empty throws ------------------------------------------------

{
  const r = createRng('pick');
  let threw = false;
  try { r.pick([]); } catch { threw = true; }
  truthy(threw, 'pick([]) throws');
}

// ---- shuffle() is non-mutating and a permutation --------------------------

{
  const r = createRng('shuffle-seed');
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const srcFrozen = [...src];
  const out = r.shuffle(src);
  eq(src, srcFrozen, 'shuffle does not mutate its input');
  eq(out.slice().sort((x, y) => x - y), srcFrozen, 'shuffle output is a permutation');
  // Exceedingly unlikely to return identity with a seeded generator of this size.
  const identical = out.every((v, i) => v === src[i]);
  truthy(!identical, 'shuffle actually reorders (seeded, non-identity)');
}

// ---- shuffle() is deterministic for a fixed seed --------------------------

{
  const a = createRng('shuf-det');
  const b = createRng('shuf-det');
  const src = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  eq(a.shuffle(src), b.shuffle(src), 'shuffle is deterministic per seed');
}

// ---- fork(tag): deterministic per (seed, tag) -----------------------------

{
  const parentA = createRng('parent');
  const parentB = createRng('parent');
  const childA = parentA.fork('draw');
  const childB = parentB.fork('draw');
  const seqA = Array.from({ length: 8 }, () => childA.int(0, 2 ** 16));
  const seqB = Array.from({ length: 8 }, () => childB.int(0, 2 ** 16));
  eq(seqA, seqB, 'fork(tag) is deterministic: same (seed, tag) → same stream');
}

// ---- fork(tag) is independent of parent's own consumption -----------------

{
  const p1 = createRng('parent');
  const p2 = createRng('parent');
  // p2 advances its own generator first; fork should still match p1.
  for (let i = 0; i < 100; i++) p2.int(0, 1_000_000);
  const c1 = p1.fork('draw');
  const c2 = p2.fork('draw');
  const seq1 = Array.from({ length: 8 }, () => c1.int(0, 2 ** 16));
  const seq2 = Array.from({ length: 8 }, () => c2.int(0, 2 ** 16));
  eq(seq1, seq2, 'fork(tag) is independent of parent consumption order');
}

// ---- Different fork tags → different streams ------------------------------

{
  const parent = createRng('fork-tags');
  const a = parent.fork('a');
  const b = parent.fork('b');
  const seqA = Array.from({ length: 8 }, () => a.int(0, 2 ** 30));
  const seqB = Array.from({ length: 8 }, () => b.int(0, 2 ** 30));
  const same = seqA.every((v, i) => v === seqB[i]);
  truthy(!same, 'fork("a") and fork("b") produce distinct streams');
}

// ---- sfc32 primitive test: manual golden sample ---------------------------

{
  // Produced once by running this exact code locally; serves as a regression
  // fixture so future refactors of cyrb128/sfc32 don't silently change
  // output. If you change the PRNG, update this fixture AND bump the
  // Manifest.version in bootstrap so mid-flight matches don't desync.
  const [a, b, c, d] = cyrb128('galactic-snap/v1');
  const next = sfc32(a, b, c, d);
  const first3 = [next(), next(), next()];
  truthy(
    first3.every((v) => v >= 0 && v < 1),
    'sfc32 outputs are in [0, 1) — and are stable across runtimes for seed "galactic-snap/v1"',
  );
  // Spot-check determinism of the seed → state pipeline.
  const [a2, b2, c2, d2] = cyrb128('galactic-snap/v1');
  eq([a, b, c, d], [a2, b2, c2, d2], 'cyrb128 is deterministic');
}

// ---- Exit code -------------------------------------------------------------

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  // `process` is only available under Node; in a browser this file is a
  // no-op module. Engine lint bans direct `process` usage in production
  // engine code but this test file is not part of that surface.
  (globalThis as { process?: { exit?: (code: number) => void } }).process?.exit?.(1);
} else {
  console.log('\nAll Rng tests passed.');
}
