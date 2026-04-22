/**
 * Rng — the seeded RNG interface the engine uses for all randomness.
 * See spec §3.6. Implementation (sfc32) lands in Step 2.
 *
 * Determinism requirement: any effect that samples randomness receives an
 * Rng that is `fork`ed from a deterministic tag. Same seed + same tag +
 * same call order → same output on client and server.
 */

export interface Rng {
  readonly seed: string;
  int(lo: number, hi: number): number;        // inclusive-inclusive
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];         // Fisher-Yates; returns NEW array
  fork(tag: string): Rng;                     // derived rng; deterministic per (parent seed + tag)
}

/**
 * Step 2 will replace this with a real sfc32 implementation. Throwing now
 * guarantees we never silently pull from a nondeterministic source.
 */
export function createRng(_seed: string): Rng {
  throw new Error('createRng: not implemented (Step 2 of spec 0.2 migration)');
}
