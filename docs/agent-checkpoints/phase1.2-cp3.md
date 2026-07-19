# Phase 1.2 Checkpoint 3 — Canonical Setup

Status: complete in the current worktree.

## Outcome

Frame-zero genesis no longer contains pre-populated lanes, location-card
instances, or an implicit location draw pile. It begins in `SETUP` with empty
canonical location state.

The runtime now commits two ordered system transactions before accepting
player work:

1. canonical location/lane setup;
2. opening hand deal, turn-one location reveal, and turn-start draws.

The setup transaction emits:

- `LOCATION_DECK_INITIALIZED`;
- three repetitions of lane creation start, location draw, location play, and
  lane creation completion;
- `MATCH_SETUP_COMPLETED`.

Every setup fact owns one canonical frame in `SETUP` scope.

## Authority and replay

`createMatchGenesis()` is the only frame-zero constructor used by runtime and
replay authority. `buildLocationSetupTransaction()` consumes the validated,
ordered third deck supplied by bootstrap; it never enumerates the manifest to
choose the runtime's initial locations.

`createSetupMatch()` and `createInitialMatchState()` are headless
engine/CLI conveniences. They materialize the same framed setup transaction
and do not populate lanes or locations through an alternate mutation path.

A replay starting from genesis and folding the setup frames reconstructs the
same setup-complete state as live execution.

## Intent gate

Genesis remains in `SETUP`. The reducer moves to `AWAITING_INTENT` only when
`MATCH_SETUP_COMPLETED` observes exactly three active lanes, each with an
occupied face-down location slot. The engine resolver rejects player gameplay
intents while setup is incomplete; runtime phase validation provides the same
boundary at the intent queue.

## Clean cutover

- no initial-state constructor embeds lane/location state;
- no setup compatibility adapter, fallback read, alias, or dual-write path
  remains;
- dynamic lane creation now uses the same location-card created/staged/played
  vocabulary before `LANE_CREATED`;
- protocol schema coverage includes every new setup event in TypeScript and
  Rust.

## Proof

- canonical engine/runtime/debug/protocol/drag Vitest gate: 235/235;
- Phase 0 runtime/property gate: 71/71 with 200 generated cases;
- Checkpoint 3 focused setup/location/runtime gate: green;
- standalone replay reconstruction gate: green;
- TypeScript protocol validator: 4/4;
- Rust protocol conformance: 2/2;
- production Vite build: green;
- `git diff --check`: green.

The repository-wide TypeScript command continues to report pre-existing errors
in deprecated card archives, authoring surfaces, city-map experiments, and the
known live-opening tuple inference test. Filtering to the changed
engine/runtime/protocol surface adds no new type errors.

## Exit decision

Every Checkpoint 3 exit criterion is met. Checkpoint 4 may now migrate reveal,
move, swap, replacement, destruction, and private disclosure producers onto
the governed location lifecycle operations.
