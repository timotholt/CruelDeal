# Playgame Deterministic Server Authority Plan

Status: approved implementation direction  
Repository policy: active-development replacement; no compatibility layer  
Primary sequence: state/history separation, state compaction, canonical RNG,
seat-safe wire protocol, persistence and reconciliation

Implementation progress (2026-07-19):

- Phase 0/1 complete: canonical history is runtime-owned, not state-owned.
- Phase 2 complete: average final-state JSON reduced below the 25 KB budget.
- Phase 3 complete: one serialized sfc32 stream, state-owned location ordering,
  compact deterministic setup IDs, atomic draw-delta events, and transaction
  RNG coordinates.
- Phase 4 complete: explicit seat-safe JSON snapshots, opaque seat-scoped
  tokens, filtered animation events, correction snapshots, resync contracts,
  schemas, and reconnect folding.
- Phase 5 reconciliation core complete: DEBUG play checkpoints, automatic
  genesis-plus-events replay, exact state comparison, RNG cursor verification,
  and first-drift diagnostics. Durable backend persistence remains backend
  integration work.

Current measured averages across 20 complete matches:

| Artifact | JSON | gzip |
| --- | ---: | ---: |
| Genesis mechanical state | 8.5 KB | — |
| Final mechanical state | 20.6 KB | 2.9 KB |
| Seat-safe final snapshot | 3.5 KB | 1.0 KB |
| Genesis plus canonical events | 33.9 KB | 4.1 KB |
| Full DEBUG play checkpoints | 270.5 KB | 6.6 KB |

Changing a TypeScript `number` to a nominal smaller integer type would not
shrink a JavaScript object or JSON payload. The implemented savings come from
removing duplicated history/default facts, using compact tuples where they
remain readable, projecting counts instead of secret collections, and
compressing repetitive debug evidence at persistence boundaries.

## Goal

CruelDeal must have one authoritative deterministic match simulation that:

- keeps `MatchState` limited to current mechanically relevant facts;
- keeps canonical history outside `MatchState` as ordered committed records;
- owns one serializable gameplay PRNG state from setup through match end;
- produces explicit, versioned, seat-redacted JSON snapshots and events;
- can reconstruct and verify every committed checkpoint and final result;
- supports richer debug capture without making debug history authoritative.

The target is not merely "the same event log folds twice." The target is that
the same frozen bootstrap, accepted inputs, engine/content version, and RNG
stream regenerate the same events, checkpoints, and final state.

## Current Problems

### 1. `MatchState` owns its own complete history

`MatchState.log` grows on every reducer application. The runtime also owns
`CommittedTransactionRecord[]`, so history has two representations and every
serialized state snapshot repeats all earlier events.

Measured across 20 complete six-turn matches:

| Artifact | Average JSON size |
| --- | ---: |
| Genesis `MatchState` | 15.1 KB |
| Setup-complete `MatchState` | 42.1 KB |
| Final state without `log` | 46.0 KB |
| Final state with `log` | 70.0 KB |
| State after every card play | 813 KB per match |
| Genesis plus canonical events | 39.1 KB |

A representative 68.9 KB final state was approximately 33% `log`, 31%
`locationStore`, and 31% `cardStore`.

### 2. Current state contains verbose historical/index structures

- Every location in the complete third deck has a full runtime lifecycle
  record even when it never leaves the deck.
- Card and location lifecycle objects repeat many null/default fields.
- Current placement is represented in both instance records and zone/lane
  indexes.
- Power, cost, text, energy, and lifecycle history is partly duplicated by the
  canonical event stream.
- Debug/history queries read the engine state instead of the runtime record.

Some indexes and semantic ledgers are mechanically necessary. Each field must
be classified by actual engine reads before removal; state-size reduction must
not replace explicit mechanics with event-log scans.

### 3. RNG is deterministic but is not one state-owned sequence

`MatchState` contains a seed, while `createRng()` keeps mutable state inside a
closure. Setup, location selection, opening, resolution, priority, effects, and
AI use independently tagged forks or reconstruct generators from the seed.
This is order-independent deterministic randomness, not one serializable
cursor that can be reconciled with `MatchState`.

### 4. Player-facing state is not a JSON wire contract

Raw `MatchState` happens to be JSON-serializable, but it is not a protocol
schema. `ProjectedState` stores its payload under a symbol and therefore drops
the actual state under `JSON.stringify`. The trusted local transaction
projection performs no player-data redaction.

### 5. Replay verifies folding, not complete causal correctness

Current replay proves that recorded factual events reduce to the same state.
It must also verify that all randomness was consumed from the canonical stream.

## Non-Negotiable Invariants

1. There is one authoritative `MatchState` shape and one current state owner.
2. `MatchState` contains no append-only event collection.
3. Canonical history exists only in committed runtime/persistence records.
4. Every committed event has one match-global frame and is reduced exactly
   once.
5. All match-affecting randomness consumes one serializable gameplay RNG state.
6. Validation, projection, animation, analytics, and cosmetics cannot consume
   gameplay RNG.
7. RNG advancement and the gameplay change it enabled commit atomically.
8. A replay never depends on wall-clock time, process-local identity, property
   enumeration accidents, or unversioned content.
9. Player APIs expose only explicit seat-safe JSON DTOs and seat-safe events.
10. Debug snapshots are evidence/checkpoints, never a second state authority.
11. Exhausted finite random tapes never wrap. A paged tape must deterministically
    advance to a new page or fail as an invariant violation.
12. Superseded fields, APIs, adapters, fallback reads, and dual-write paths are
    deleted in the phase that replaces them.

## Target Architecture

### Authoritative state

`MatchState` contains current mechanics and a current deterministic coordinate:

```ts
interface MatchTimelinePosition {
  readonly frame: Frame;
  readonly scope: TemporalScope | null;
}

interface GameplayRngState {
  readonly algorithm: 'sfc32-v1';
  readonly seed: string;
  readonly words: readonly [number, number, number, number];
  readonly draws: number;
}

interface MatchState {
  readonly timeline: MatchTimelinePosition;
  readonly rng: GameplayRngState;
  // current mechanical facts only
}
```

Genesis uses frame zero and null scope. Applying a framed event advances the
timeline coordinate but does not retain the event.

The RNG function is pure:

```ts
nextUint32(rng: GameplayRngState): {
  readonly value: number;
  readonly rng: GameplayRngState;
}
```

`pick`, `int`, and `shuffle` build on this step and return the next RNG state.
The algorithm identifier and golden vectors are protocol fixtures.

### Canonical match record

```ts
interface MatchRecord {
  readonly version: number;
  readonly bootstrap: FrozenMatchBootstrap;
  readonly engineVersion: string;
  readonly manifestHash: string;
  readonly transactions: readonly CommittedTransactionRecord[];
}
```

Each committed transaction contains:

- accepted input identity;
- ordered seat-authoritative framed events;
- base and resulting revision;
- RNG draw count before and after;
- accepted intent identity.

The runtime may materialize short-lived per-event transitions for animation.
It must release them after presentation and never store them as match history.

### Player wire model

The server never sends raw `MatchState`. It sends:

```ts
interface SeatMatchSnapshotV1 {
  readonly version: 1;
  readonly matchId: string;
  readonly revision: number;
  readonly frame: Frame;
  readonly viewerSeat: Seat;
  readonly state: SeatVisibleMatchStateV1;
}

interface SeatCommittedTransactionV1 {
  readonly matchId: string;
  readonly baseRevision: number;
  readonly revision: number;
  readonly events: readonly SeatVisibleFramedEventV1[];
  readonly postState: SeatVisibleMatchStateV1;
}
```

The client starts or reconnects from a snapshot, animates ordered projected
events, then adopts the transaction's authoritative seat-safe correction
state. Filtered frame numbers intentionally contain gaps where authority-only
events were removed.

Competitive player payloads must not expose the root RNG seed/cursor, opponent
hand identities, deck order, hidden location identities/order, server-only
pending effects, or authoritative internal ledgers.

### Debug evidence

Debug mode may persist:

- a compressed full mechanical snapshot after each committed card play;
- snapshot frame and RNG draw count;
- an optional consumed-random audit tape containing draw index and semantic
  purpose;
- intent-regeneration and event-fold reconciliation results.

Debug snapshots omit canonical history because the match record already owns
it.

## Implementation Phases

## Phase 0 — Baseline and architecture fences

### Work

- Add a repeatable state-size probe for genesis, setup, final mechanical state,
  event record, and debug checkpoint totals.
- Record current deterministic property-test coverage.
- Add source fences that prevent new state-history reads while Phase 1 lands.
- Document which current fields are mechanically read versus debug/projection
  only.

### Exit criteria

- State sizes are measured by a checked-in command.
- A test fails if a new append-only event array is added to `MatchState`.
- Existing direct/replay parity and exactly-once tests remain green.

## Phase 1 — Remove canonical history from `MatchState`

This phase is first because every later snapshot, projection, and
size result depends on having one history owner.

### Work

1. Replace `MatchState.log` with one current `timeline` coordinate.
2. Change `applyFramed` to:
   - validate immediate frame succession;
   - apply the mechanical event;
   - update `state.timeline`;
   - retain no event.
3. Make `frameAndFoldEvents` and `foldFramedEvents` own framed event arrays and
   materialized transitions.
4. Make runtime `CommittedTransactionRecord[]` the sole live canonical history.
5. Change replay/export APIs to accept explicit genesis plus committed records;
   delete state-log export paths.
6. Change lifecycle-history utilities to consume `FramedEvent[]`.
7. Change debug APIs to read history from runtime export, not live state.
8. Remove UI invalidation reads of `state.log`.
9. Update testkit and tests to assert transaction/event-record history rather
   than reducer-state history.
10. Delete `MatchLogEntry`.

### Exit criteria

- `MatchState` has no `log` or other append-only event field.
- Repeated diagnostic events advance the frame without growing serialized
  mechanical state.
- Runtime export contains every canonical event exactly once.
- Direct execution and replay reach identical mechanical states at every
  committed frame.
- The 1,000-frame replay stress proof passes without state-owned history.
- Typical final serialized state falls from approximately 70 KB to
  approximately 46 KB before further compaction.

## Phase 2 — Minimize current mechanical state

### Work

1. Classify every `MatchState`, card record, location record, lifecycle, and
   ledger field:
   - required current mechanic;
   - required O(1) mechanical index;
   - derived projection;
   - historical/debug only.
2. Replace the full inactive location runtime store with compact immutable deck
   entries plus a draw cursor. Materialize full location state only when a
   location enters an active mechanical lifecycle.
3. Replace verbose default lifecycle objects with compact optional facts.
4. Move complete lifecycle occurrence history to event-record projections.
5. Select one canonical placement representation and derive or validate the
   other indexes at transaction boundaries.
6. Remove historical cost/text/energy data that has no mechanical reader.
   Preserve or redesign semantic ledgers that mechanics genuinely require.
7. Add invariant validation for card/location membership and placement.

### Exit criteria

- Every retained field has a documented mechanical reader or invariant role.
- No untouched location carries a full lifecycle object.
- No default object repeats large null/empty structures per instance.
- Typical six-turn final mechanical state is at most 25 KB JSON, unless a
  measured mechanically necessary field prevents that budget.
- Replay/debug tools still expose complete lifecycle history from records.

## Phase 3 — Install one serializable gameplay RNG

### Work

1. Convert sfc32 from a closure to a pure serializable state transition.
2. Add `GameplayRngState` to match genesis and remove the standalone
   `MatchState.seed`.
3. Route authoritative setup, deck ordering, priority ties, locations, card
   effects, server AI choices, and deterministic instance creation through the
   same state-owned stream when they affect match outcomes.
4. Replace random identifiers with deterministic counters where entropy is not
   mechanically required.
5. Remove gameplay `fork()` and gameplay `createRng(seed)` reconstruction.
6. Keep presentation/cosmetic randomness outside match authority and prevent it
   from importing gameplay RNG APIs.
7. Record RNG before/after draw counts per committed transaction.
8. Add optional debug draw-purpose auditing.
9. Add golden sequence fixtures shared by TypeScript and Rust protocol tests.

### Exit criteria

- Searching active gameplay code finds one authoritative RNG step API.
- `MatchState.rng` always describes the exact next draw.
- Same bootstrap and accepted inputs produce identical random draws, events,
  states, and final RNG cursor.
- Skipped, rejected, retried, and duplicate intents cannot consume RNG.
- Cosmetic activity cannot alter gameplay output.

## Phase 4 — Define the seat-safe JSON protocol

### Work

1. Add versioned JSON schemas and TypeScript types for:
   - seat match snapshot;
   - seat-visible framed event;
   - seat committed transaction;
   - resync request/response.
2. Implement explicit serializers. Do not use symbol-held payloads as wire
   values.
3. Define redaction for every state field and every event variant.
4. Represent hidden cards as opaque seat-scoped tokens/counts where animation
   continuity requires identity without revealing definitions.
5. Exclude root seed/cursor from competitive snapshots until an explicit
   post-match reveal policy exists.
6. Implement a projected-state reducer used by the client animation timeline.
7. Add JSON round-trip and TypeScript/Rust conformance fixtures.
8. Delete or rename trusted-local projection APIs so they cannot be mistaken
   for network-safe serializers.

### Exit criteria

- Raw `MatchState` is not accepted by any player-facing protocol message.
- Every player payload validates against the generated schema.
- Hidden-information tests cover both snapshots and every event family.
- Client projected event folding matches a freshly projected server snapshot.
- Reconnect from snapshot plus event suffix reaches the current projected
  state.

## Phase 5 — Debug persistence and deterministic reconciliation

### Work

1. Persist bootstrap, accepted intents, committed transactions, and versions
   atomically when the backend storage layer lands.
2. In debug mode, persist compressed no-history checkpoints after committed
   card plays.
3. Add event-fold reconciliation:
   - genesis plus recorded framed events;
   - compare every stored checkpoint and final state directly;
   - verify every transaction's RNG before/after cursor.
4. Persist a structured reconciliation report at match end.

The server is the sole creator of this record. Cryptographic state checksums,
transaction hash chains, and hostile-tampering defenses are intentionally out
of scope. A small diagnostic fingerprint may be included in a report, but
exact state equality is the correctness test.

### Exit criteria

- Every completed debug match produces a pass/fail reconciliation report.
- Event folding agrees with every captured play checkpoint and the live final
  state.
- RNG cursor drift is reported at the transaction where it occurs.
- Persistence can restore authority after process restart without hidden
  process-local RNG or timeline state.

## Phase 6 — Operational hardening and cleanup

### Work

- Add storage/latency telemetry and debug retention limits.
- Compress checkpoints as a group or with dictionary/delta encoding if storage
  measurements justify it.
- Add reconnect, duplicate-delivery, delayed-delivery, and server-restart stress
  tests.
- Add a production policy for seed secrecy and optional post-match disclosure.
- Remove obsolete replay bundles, projections, debug adapters, RNG namespaces,
  and deprecated documentation superseded by this architecture.

### Exit criteria

- No active dual authority, dual serialization, or dual RNG path remains.
- Normal player traffic uses snapshots only for initialization/resync and
  ordered projected transactions for live play.
- Debug retention is bounded and measurable.
- Architecture fences prevent reintroduction of state-owned history,
  ungoverned gameplay randomness, and raw-state player payloads.

## Verification Matrix

| Property | Primary proof |
| --- | --- |
| Reducer purity | same framed event + same state = same next state |
| Exactly-once application | stable transaction/event identity property test |
| History separation | source fence plus constant-size diagnostic-state test |
| Replay parity | every replay frame equals the captured live checkpoint |
| RNG parity | golden vectors plus final draw cursor equality |
| Hidden information | schema/redaction test per state and event variant |
| Reconnect correctness | snapshot + suffix equals current projected state |
| Cross-language protocol | TypeScript/Rust shared conformance fixtures |
| Corruption detection | first-divergence mutation suite |
| Storage budget | checked-in multi-match size probe |

## Delivery Order

Each phase lands as a clean replacement:

1. plan and baseline;
2. state/history separation;
3. state compaction;
4. serializable gameplay RNG;
5. seat-safe network protocol;
6. persistence and reconciliation;
7. operational cleanup.

Do not start wire-state implementation while `MatchState.log` remains
authoritative. Do not persist RNG checkpoints until RNG state lives in
`MatchState`. Do not expose a snapshot message until complete state and event
redaction exists.
