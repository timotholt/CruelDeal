/**
 * Tensor generator seeded RNG module.
 *
 * Provides a module-level random() replacement that is fully deterministic
 * when seeded. Uses the same sfc32 PRNG as the game engine.
 *
 * Usage:
 *   import { tensorRandom, setTensorSeed } from '../rng';
 *   setTensorSeed('my-seed');   // call once before generation
 *   const r = tensorRandom();   // drop-in for Math.random(), returns [0, 1)
 */
import { sfc32FromSeed } from '../../engine/rng/sfc32';

let _next: () => number = sfc32FromSeed('tensor-default');

/**
 * Seed (or re-seed) the tensor RNG. Call before each generation pass
 * to get reproducible output.
 */
export function setTensorSeed(seed: string): void {
    _next = sfc32FromSeed(seed);
}

/**
 * Drop-in replacement for Math.random(). Returns a float in [0, 1).
 * Deterministic after setTensorSeed() is called with the same seed.
 */
export function tensorRandom(): number {
    return _next();
}
