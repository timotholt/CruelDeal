# Phase 1.2 — Dynamic Lane Lifecycle Slice

Status: implemented and focused-proof complete.

This slice establishes the executable behavior needed to author location
cards that modify board topology while the broader location-card
normalization work continues.

## Implemented

- Stable, monotonic numeric `LaneId` values replace the fixed `0 | 1 | 2`
  type throughout live playgame code.
- `activeLaneOrder` is the canonical current left-to-right playable order.
- Destroyed lanes remain in the lane registry as `DESTROYED` tombstones.
- Location swaps use one atomic `LOCATIONS_SWAPPED` event.
- Destroying a location has one representation: a single
  `LOCATION_REPLACED` event atomically swaps it for a fresh, revealed, inert
  `Ruin`. There is no locationless destruction event or reducer path.
- Lane destruction:
  - requires at least two currently active lanes
  - sends every occupant through ordinary governed card destruction
  - honors destruction immunity and destruction gates
  - runs normal `onDestroyed` and `onCardDestroyedHere` reactions
  - rejects atomically if any card still points at the lane
  - removes the lane from targeting, scoring, AI planning, and presentation
- `DESTROY_OTHER_LANES` is an authorable location/card effect primitive.
- Lane creation fills vacancies with a fresh never-reused ID.
- The board renders `activeLaneOrder`; one lane is centered, two lanes occupy
  equal left/right halves, and three lanes occupy equal thirds.
- Protocol lane IDs now accept all nonnegative match-local IDs and include the
  new lane/location lifecycle event types.

## Focused proof

`services/playgame/engine/__tests__/location-lifecycle.test.ts` contains 28
tests covering:

- atomic swaps and instance-state preservation
- Ruin replacement
- empty/invalid/repeated operation rejection
- two-lane destruction ceiling and final-lane protection
- every possible sole-survivor lane
- protected-card transaction rollback
- normal destruction reactions
- suppression of stale face-down reveals
- scoring, AI, targeting, pending-effect cleanup, and replay
- destroy-two/add-one/add-another sequencing
- monotonic identity allocation without tombstone reuse

## Gate results

- lifecycle/timeline/power focused suite: 75/75
- Phase-0 runtime suite: 71/71
- TypeScript protocol conformance: 3/3
- Rust protocol conformance: 2/2
- production build: pass
- scoped lint: pass
- protocol schema drift: pass

## Remaining Phase 1.2 work

This does not claim all of checkpoint 2 or checkpoint 4 complete. Location
instances are still embedded in lane state. The remaining normalization work
must introduce the canonical location-card registry/deck zones and remove the
temporary fixture tolerance for omitted lane lifecycle fields.
