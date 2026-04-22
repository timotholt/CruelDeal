/**
 * Rng — the seeded RNG interface the engine uses for all randomness.
 * See spec §3.6.
 *
 * Determinism requirement: any effect that samples randomness receives an
 * Rng that is `fork`ed from a deterministic tag. Same seed + same tag +
 * same call order → same output on every JS runtime (client, server, CI).
 *
 * Implementation: sfc32 keyed by cyrb128(seed). See `./sfc32.ts`.
 */

import { sfc32FromSeed } from './sfc32';

export interface Rng {
  /** The seed string used to construct this generator. Debug-only; the
   *  internal state is NOT exposed to callers. */
  readonly seed: string;
  /** Uniform int in `[lo, hi]`, inclusive on both ends. */
  int(lo: number, hi: number): number;
  /** Uniform pick from a non-empty array. Throws on empty. */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle. Returns a NEW array; input is not mutated. */
  shuffle<T>(arr: readonly T[]): T[];
  /** Derive a child Rng deterministic per (this.seed, tag). */
  fork(tag: string): Rng;
}

/**
 * Construct an Rng from a string seed. Same seed → same sequence everywhere.
 *
 * The internal PRNG state is captured in a closure; the only way to advance
 * it is through the Rng methods. Callers can never read raw bytes, so
 * randomness provenance stays auditable (every sample is tied to a named
 * fork tag somewhere up the call stack).
 */
export function createRng(seed: string): Rng {
  const next = sfc32FromSeed(seed);

  const rng: Rng = {
    seed,

    int(lo: number, hi: number): number {
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new Error(`Rng.int: bounds must be finite (got lo=${lo}, hi=${hi})`);
      }
      if (hi < lo) {
        throw new Error(`Rng.int: hi (${hi}) must be >= lo (${lo})`);
      }
      const range = hi - lo + 1;
      // next() ∈ [0, 1); multiplying by integer range and flooring is safe
      // for ranges up to 2^32 because sfc32 returns 32 bits of precision.
      return lo + Math.floor(next() * range);
    },

    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error('Rng.pick: cannot pick from empty array');
      }
      return arr[rng.int(0, arr.length - 1)];
    },

    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      // Classic Fisher-Yates: iterate from last to first, swap with a
      // random earlier-or-equal index.
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },

    fork(tag: string): Rng {
      // Use a separator that cannot appear in a well-formed tag by
      // convention. The hash mixes parent seed and tag so forking order
      // is irrelevant to the child's output — only (seed, tag) pairs matter.
      return createRng(`${seed}::${tag}`);
    },
  };

  return rng;
}

export { sfc32, sfc32FromSeed, cyrb128 } from './sfc32';
