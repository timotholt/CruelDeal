# Phase 1.2 Checkpoint 2 — Canonical Location and Lane State

Status: complete in the current worktree.

## Outcome

The simulation now has one canonical location representation:

- every ordered bootstrap entry becomes a `LocationCardInstance`
- `locationCards` is the normalized instance registry
- `locationDeck` owns explicit draw, staging, discard, destroyed, and banished
  zones
- `lanesById` is the stable lane registry
- `activeLaneOrder` is the sole left-to-right playable order
- every lane owns one `LocationSlotState` that references an instance ID
- face state, reveal scheduling, and seat knowledge are independent fields

The retired embedded `lanes[].location` and `locationRevealed` state does not
remain behind an adapter, fallback read, alias, or dual-write path.

## State invariants

`validateLocationState` proves:

- every location instance occurs in exactly one zone
- every occupied slot resolves to a `LANE` instance
- every lane/location back-reference agrees
- deck-zone lists agree with each instance's declared zone
- active lane order has no duplicates and contains one to three active IDs
- face-up instances have a reveal history

Location replacement conserves the outgoing instance in its explicit
destination. Mechanical reveal discloses identity to both seats, advances
reveal history, and consumes the lane-owned reveal schedule.

## Projection boundary

`projectBootstrapForSeat` removes the location deck entries and content hash.
`projectStateForSeat` hides unknown face-down definition identity, source deck
position, authored tags/counters, and authoritative future draw order.
Presentation resolves locations from the projected registry by instance ID.

## Clean-cutover evidence

The engine, runtime, debug replay, selectors, reducer, effects, AI, setup
initializer, and test fixtures use `LocationCardDef`,
`LocationCardInstance`, `LocationCardInstanceId`, `lanesById`, and
`locationCardId`. Repository guidance explicitly forbids compatibility
adapters during active development.

## Proof

- Phase 1.2 location-state checkpoint: 4/4
- Location lifecycle: 28/28
- Canonical engine/debug Vitest suites: 170/170
- Phase 0 runtime authority/property gate: 71/71
- Reducer standalone suite: green
- Query and projection standalone suites: green
- Production Vite build: green
- `git diff --check`: green

The repository-wide TypeScript command still reports unrelated pre-existing
errors in legacy/deprecated and authoring subsystems. After filtering to the
changed playgame engine/runtime/debug/view surface, the only remaining report
is an existing tuple-inference error in
`runtime/__tests__/characterization/live-opening.contract.test.ts`; the same
runtime test is green under Vitest.

## Exit decision

Every Checkpoint 2 exit criterion is met. Checkpoint 3 may now replace
pre-populated initial location state with canonical framed setup operations and
events.
