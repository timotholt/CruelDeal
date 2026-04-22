/**
 * sfc32 — a 4-state 32-bit small-fast-counter PRNG by Chris Doty-Humphrey.
 * 128-bit state, passes BigCrush, period >= 2^65. Fast and deterministic.
 *
 * Paired with `cyrb128` to derive a 128-bit state from an arbitrary string
 * seed. Identical seeds produce identical sequences on every JS runtime —
 * this is the foundation of the engine's determinism guarantee (spec §3.6).
 *
 * Attribution:
 *   sfc32:   https://pracrand.sourceforge.net/
 *   cyrb128: https://stackoverflow.com/a/47593316 (public domain)
 */

/**
 * cyrb128 — 128-bit non-cryptographic hash producing 4 uint32 values.
 * Deterministic across runtimes (uses only `Math.imul` + 32-bit math).
 */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/** Build a `next()` closure over 128 bits of mutable uint32 state. */
export function sfc32(a: number, b: number, c: number, d: number): () => number {
  // Keep the state in the closure; `| 0` coerces back to int32 after each step.
  return function next(): number {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11));
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Build an sfc32 generator directly from a string seed. */
export function sfc32FromSeed(seed: string): () => number {
  const [a, b, c, d] = cyrb128(seed);
  return sfc32(a, b, c, d);
}
