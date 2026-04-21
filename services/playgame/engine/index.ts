/**
 * engine — public surface.
 *
 * This is a PLACEHOLDER that re-exports the current state types so the
 * rest of the app can begin importing from `@/services/playgame/engine`
 * instead of `@/services/playgame/types`. The real `apply` / `resolve` /
 * `resolveTurn` functions arrive in Phases 1-3 of the refactor (see
 * PLAY_REFACTOR_PLAN.md §3).
 *
 * See `./README.md` for the purity contract that every file in this
 * folder must obey. ESLint enforces the contract; don't try to sneak
 * around it — every exception is a future determinism bug.
 */

// Re-export gameplay types. Once Phase 1 lands, these move into
// `engine/types.ts` and gain stricter shapes (§2.5 of the plan).
export type {
  CardDef,
  CardInstance,
  CardType,
  LocationDef,
  LocationInstance,
  MatchSnapshot,
  MatchState,
  TargetingState,
} from '../types';

// Placeholder apply — Phase 1 replaces this with a real reducer.
// Exported now so downstream callers can start threading it in even
// though it's still a no-op.
export function apply<S>(state: S, _event: unknown, _manifest: unknown): S {
  return state;
}
