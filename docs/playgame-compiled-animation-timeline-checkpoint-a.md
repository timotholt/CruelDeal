# Compiled animation timeline — Checkpoint A evidence

Date: 2026-07-22

Status: complete. The compiler/runner foundation exists beside the current
live presentation path. No production event is routed through it yet.

## Delivered contracts

- integer, finite, non-negative branded milliseconds;
- a projector-generated closed `SeatAnimationEvent` payload union;
- an exhaustive canonical-event disposition registry with explicit
  `not-projected` entries;
- typed `step`, `sequence`, `parallel`, `stagger`, finite target mapping, and
  routine-call nodes;
- a closed schema-validated routine registry with duplicate, missing-edge,
  depth, undeclared-edge, asynchronous-expansion, and cycle rejection;
- complete routine flattening before compiler/runner input;
- deterministic accumulated-next-start schedule calculation;
- absolute cue compilation and stable same-time ordering;
- normalized target/channel/property tracks with explicit time-zero and
  time-end values;
- overlapping-property conflict and uncued-discontinuity rejection;
- normal, reduced-motion, and debug-slow immutable profiles;
- injected fake and native WAAPI drivers;
- one master-clock runner with shared origins, cue draining, pause/rebase,
  cancellation, typed failure, handoff, and exactly-once cleanup;
- diagnostic snapshots and a dedicated native-browser proof harness.

## Proofs

`npm run test:presentation`

- 27 files passed;
- 152 tests passed;
- includes 1,000 deterministic generated schedule cases;
- includes the existing actor, sink, director, choreography, and UI
  interleaving regressions.

`npm run typecheck:playgame`

- passed;
- explicitly includes the production storyboard modules;
- pure compiler/schedule source fences reject DOM and engine imports.

`npm run test:engine:authorities`

- 10 files passed;
- 95 tests passed;
- confirms the closed projected-event contract did not change authority,
  client, replay-debug, or atomic-block behavior.

`npm run build`

- passed.

Native Chrome WAAPI proof at `/prototypes/storyboard-proof/`:

- outcome `COMPLETED`;
- master plus two visual tracks shared one exact start origin;
- midpoint computed style showed both tracks genuinely in flight;
- cue order was exactly `start`, `middle`, `end`;
- final canonical handoff produced opacity `1` and translation `120px`.

## Architectural fences

- `compiler.ts` and `schedule.ts` are pure data modules;
- only `waapiDriver.ts` constructs `Animation` or `KeyframeEffect` objects;
- `runner.ts` contains no `setTimeout`, `setInterval`, CSS-transition wait, or
  duration-based completion race;
- runner completion awaits the master and every required track;
- routine calls do not survive expansion;
- the live presentation path has no dependency on the new runner.

## Next checkpoint

Checkpoint B owns the first integration boundary: transaction planning,
prepared-beat lifecycle, atomic frame partition/adoption, opening prelude,
interaction lock, and typed resync. Checkpoint B must consume this foundation;
it must not add a second clock, runner, routine expander, or cue scheduler.
