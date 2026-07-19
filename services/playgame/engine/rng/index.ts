/**
 * Rng — the seeded RNG interface the engine uses for all randomness.
 * See spec §3.6.
 *
 * Every gameplay consumer shares one serializable sequence. Purpose scopes
 * annotate draws for diagnostics; they never create independent generators.
 *
 * Implementation: sfc32 keyed by cyrb128(seed). See `./sfc32.ts`.
 */

import { cyrb128, stepSfc32 } from './sfc32';

export interface GameplayRngState {
  readonly algorithm: 'sfc32-v1';
  readonly seed: string;
  readonly words: readonly [number, number, number, number];
  readonly draws: number;
}

export interface GameplayRngStep {
  readonly value: number;
  readonly state: GameplayRngState;
}

export interface Rng {
  readonly seed: string;
  readonly purpose: string;
  readonly draws: number;
  /** Uniform int in `[lo, hi]`, inclusive on both ends. */
  int(lo: number, hi: number): number;
  /** Uniform pick from a non-empty array. Throws on empty. */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle. Returns a NEW array; input is not mutated. */
  shuffle<T>(arr: readonly T[]): T[];
  /** A labeled view over this same sequence; draw order remains global. */
  scope(purpose: string): Rng;
  /** Exact serializable state describing the next draw. */
  snapshot(): GameplayRngState;
}

export function createGameplayRngState(seed: string): GameplayRngState {
  const words = Object.freeze(cyrb128(seed));
  return Object.freeze({
    algorithm: 'sfc32-v1',
    seed,
    words,
    draws: 0,
  });
}

export function stepGameplayRng(state: GameplayRngState): GameplayRngStep {
  if (state.algorithm !== 'sfc32-v1') {
    throw new Error(`Unsupported gameplay RNG algorithm: ${state.algorithm}`);
  }
  if (
    !Array.isArray(state.words)
    || state.words.length !== 4
    || state.words.some(word => !Number.isSafeInteger(word) || word < 0 || word > 0xffffffff)
  ) {
    throw new Error('Invalid sfc32-v1 gameplay RNG state words');
  }
  if (!Number.isSafeInteger(state.draws) || state.draws < 0) {
    throw new Error(`Invalid gameplay RNG draw cursor: ${state.draws}`);
  }
  const stepped = stepSfc32({
    a: state.words[0],
    b: state.words[1],
    c: state.words[2],
    d: state.words[3],
  });
  return {
    value: stepped.value,
    state: Object.freeze({
      ...state,
      words: Object.freeze([
        stepped.state.a,
        stepped.state.b,
        stepped.state.c,
        stepped.state.d,
      ]),
      draws: state.draws + 1,
    }),
  };
}

/** Advance a serialized gameplay stream by an exact, non-negative draw count. */
export function advanceGameplayRng(
  initial: GameplayRngState,
  draws: number,
): GameplayRngState {
  if (!Number.isSafeInteger(draws) || draws < 0) {
    throw new Error(`Gameplay RNG draw count must be a non-negative safe integer; received ${draws}`);
  }
  let state = initial;
  for (let index = 0; index < draws; index++) {
    state = stepGameplayRng(state).state;
  }
  return state;
}

/** Mutable transaction-local facade over one serializable gameplay stream. */
export function createRng(initial: string | GameplayRngState): Rng {
  const cell = {
    state: typeof initial === 'string'
      ? createGameplayRngState(initial)
      : Object.freeze({
          ...initial,
          words: Object.freeze([...initial.words] as [number, number, number, number]),
        }),
  };

  const view = (purpose: string): Rng => {
    const rng: Rng = {
      get seed() {
        return cell.state.seed;
      },
      get purpose() {
        return purpose;
      },
      get draws() {
        return cell.state.draws;
      },

      int(lo: number, hi: number): number {
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        throw new Error(`Rng.int: bounds must be finite (got lo=${lo}, hi=${hi})`);
      }
      if (hi < lo) {
        throw new Error(`Rng.int: hi (${hi}) must be >= lo (${lo})`);
      }
      const range = hi - lo + 1;
      const stepped = stepGameplayRng(cell.state);
      cell.state = stepped.state;
      // value ∈ [0, 1); multiplying by integer range and flooring is safe
      // for ranges up to 2^32 because sfc32 returns 32 bits of precision.
      return lo + Math.floor(stepped.value * range);
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

      scope(childPurpose: string): Rng {
        return view(purpose.length === 0 ? childPurpose : `${purpose}/${childPurpose}`);
      },

      snapshot(): GameplayRngState {
        return Object.freeze({
          ...cell.state,
          words: Object.freeze([...cell.state.words] as [number, number, number, number]),
        });
      },
    };
    return Object.freeze(rng);
  };

  return view('gameplay');
}

export { sfc32, sfc32FromSeed, cyrb128, stepSfc32 } from './sfc32';
