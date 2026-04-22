/**
 * engine — public surface.
 *
 * See `./README.md` for the purity contract (lint-enforced).
 * See `docs/spec-engine-isolation.md` for the architecture spec.
 *
 * Step 1 lands scaffolding and type surfaces. Every runtime function throws
 * "not implemented" until its implementation step arrives:
 *   - Step 2: Rng (createRng)
 *   - Step 3: populated manifest
 *   - Step 4: projections
 *   - Step 5: apply reducer
 *   - Step 6: revealCard + evalEffect
 *   - Step 7: resolve (staging intents)
 *   - Step 8: resolveTurn
 */

// ---- Types -----------------------------------------------------------------
export type * from './types';

// ---- Manifest --------------------------------------------------------------
export type * from './manifest/types';
export { BOOTSTRAP_MANIFEST } from './manifest/bootstrap';

// ---- RNG -------------------------------------------------------------------
export type { Rng } from './rng';
export { createRng } from './rng';

// ---- Reducer / resolvers ---------------------------------------------------
export { apply } from './apply';
export { resolve } from './resolve';
export { resolveTurn } from './resolveTurn';

// ---- Evaluator (usually consumed indirectly via resolveTurn) --------------
export { revealCard, evalEffect, MAX_EVAL_DEPTH } from './eval';

// ---- Projections -----------------------------------------------------------
export * as projections from './projections';
