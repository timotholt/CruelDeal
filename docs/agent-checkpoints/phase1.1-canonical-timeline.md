# Phase 1.1 — Canonical Simulation Timeline

## Outcome

Phase 1.1 introduces one deterministic gameplay chronology shared by live
commit, state logs, replay serialization, replay materialization, and
presentation transitions.

There is exactly one gameplay frame identity:

```ts
type Frame = number & FrameBrand;

interface FramedEvent {
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: MatchEvent;
}
```

- genesis is frame `0`
- the first committed event is frame `1`
- each committed gameplay event advances exactly one frame
- frames are match-local; external references pair `{ matchId, frame }`
- frames never derive from wall-clock time, animation time, transaction
  revision, a queue position, or a replay cursor

## Authority

`MatchRuntime` owns the committed head exposed by `runtime.frame()`.
Resolution may produce temporary raw events, but the runtime's shared
framing boundary converts the accepted batch once into `FramedEvent[]`
before commitment. A gap, duplicate, rewind, or mixed raw/framed batch fails.

Private staging is a hypothetical mechanical projection. Its candidate log is
withheld, so it does not advance the runtime's committed frame.

## Turns and scheduling

Every framed event stores a `TemporalScope` with an explicit turn and coarse
phase:

- `SETUP`
- `ACTION`
- `RESOLUTION`
- `END`
- `START`
- `MATCH_END`

`TURN_STARTED` is itself a canonical event. Its frame is the first frame owned
by the new turn and its reducer transition changes `state.turn`; energy ramp,
refill, scheduled start effects, draws, and location reveal follow on later
frames in that turn. `TURN_ENDED` remains the final boundary frame of the old
turn before any endgame-only events.

Turn boundaries therefore group committed frames; they do not predict future
frame numbers. Delayed effects continue to schedule against semantic
turn/phase targets such as `START_OF_NEXT_TURN`, and receive a frame only when
their resulting event actually commits.

## Playback and replay

The following are views, not additional frame implementations:

- `EventTransition`: one `FramedEvent` plus structurally shared `before` and
  `after` states; its `index` is transaction-local presentation order
- `ReplayStep`: a materialized replay state plus `cursor`; its `frame` is the
  canonical gameplay frame
- `SeatTransactionFrame`: a projected wrapper that carries the same canonical
  `Frame`

Committed transactions and replay bundles store only `framedEvents`. There is
no legacy raw-event replay reader because no shipped persistence contract
requires one. The schema-breaking canonical replay/export format is version
`2`; version `1` is rejected rather than adapted.

## Lifecycle chronology

Card creation, play, reveal, move, destruction, and banishment are dated by the
frames of their canonical events. `cardLifecycleFrames` preserves every
occurrence rather than collapsing repeated lifecycles into one scalar.
Phase 1.2 location lifecycle fields and Phase 1.5 modifier provenance use this
same `Frame`; neither phase may introduce `FrameStamp` or another counter.

## Proof

The Phase 1.1 contract tests prove:

- global continuity from genesis
- one-to-one identity across `FramedEvent`, state log, and `EventTransition`
- explicit turn mapping across end/start boundaries
- lifecycle chronology
- gap, duplicate, rewind, and mixed-batch rejection
- private planning does not advance `runtime.frame()`
- live and replay fold parity through the shared builder

An additional 46 edge-case tests cover frame numeric limits, overflow,
cross-transaction continuity, transaction-index separation, setup/start/action
scope transitions, scope tampering, skipped/stale turns, illegal phase order,
terminal mechanical closure with diagnostic-only exceptions, repeated card
lifecycles, replay schema/genesis integrity, transaction identity, revision
gaps from private planning, frame gaps, and replayed turn-boundary state.
