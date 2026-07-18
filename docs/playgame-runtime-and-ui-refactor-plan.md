# Playgame Runtime and UI Refactor Plan

## Status

Amended after Phase 1 completion with a review-ready Phase 1.5 engine-capability and location-authoring dependency before Phases 2 and 3.

This plan covers the active `/play` card-game surface. It is intentionally not an implementation change.

## Cost Model

The tags are delivery commitments, not importance labels. The round-6 census remains the historical Phase 0/1 baseline; this amendment adds tagged Phase 1.5 requirements that require a fresh review census. A tagged parent item owns any untagged examples or field lists nested beneath it.

- **[SEAM]** Decide the contract or ownership shape now, with zero or near-zero implementation cost. The seam gate is a type/API review proving that later work can attach without reopening runtime authority.
- **[BUILD NOW]** Phase 0/1 is roughly **8–10 review-commit units**: characterization and generated parity/provenance/fold tests; bootstrap validation; shared opening and frame construction; hand-based AI; one local single-writer intent queue; simultaneous lock/reveal; and complete migration of authoritative live mutations. The tier gate is `P-PARITY`, `P-EXACTLY-ONCE`, `P-PROVENANCE`, `P-FOLD`, and `P-NO-TIME` green at the configured CI depth, plus the named opening/reveal regressions and a DOM-free complete turn.
- **[BUILD AFTER]** Implement during Phase 1.5 and Phases 2–4. Phase 1.5 stabilizes governed engine operations, committed reactions, and location authoring before provider or presentation consumers bind to them. The tier gate includes the Phase 1.5 capability/reaction/location gates plus H1–H7 and `P-INTERLEAVE` when the director exists.
- **[BUILD LAST]** Implement during Phases 5–7 or a final hardening pass; these items have local value but no ordering dependency. The tier gate is transaction-bound, retention-release, bounded-index, mutation-check, component/layout, mobile, CSS, content, and browser proofs green for the touched slice.
- **[DEFER]** Record only; perform no implementation work in this plan. The future live-server gate is durable recovery/idempotency and checksum parity under injected failures, exhaustive wire redaction/version compatibility, reconnect race coverage, fencing, clocks, backpressure, and an approved retention policy.

## Executive Decision

**[SEAM]** Do not perform a broad rewrite or general cleanup before the known debt.

**[SEAM]** Establish a sole-authority match runtime first; refactor UI/presentation only after that boundary is stable.

**[SEAM]** Preserve the engine, reducer, card-transfer derivation, and most leaf UI; remove misplaced responsibility rather than replacing working code.

**[SEAM]** Phase 1 is closed. Phase 1.5 strengthens the preserved deterministic engine's control plane and content-authoring boundaries; it does not reopen runtime authority, replay, bootstrap, or simultaneous-turn design.

## Scope

Included:

- `/play` match lifecycle
- engine-to-live-UI event application
- turn resolution and opponent turns
- presentation sequencing and card-transfer animation
- `PlayGameContext`
- `PlayBoard` and its active child components
- replay/debug integration for `/play`
- governed engine operations and committed gameplay reactions
- folder-based location authoring with generated manifest output
- reusable rule capabilities needed by ordinary cards and locations
- mobile card interaction
- playgame CSS ownership and board sizing
- focused test and validation work needed to prove the refactor

Excluded:

- city-map architecture
- **[DEFER]** collection repair and collection-to-match wiring until the legacy-ID migration
- **[DEFER]** collection ownership and per-player possession validation until that migration; bootstrap snapshots still receive local structural validation
- the deprecated game route and deprecated game files
- a visual redesign of the card game
- a rewrite of the deterministic engine
- arbitrary runtime callbacks or executable code in content manifests
- inventing every conceivable card/location hook before a concrete rule needs it
- broad card balancing or content rewriting
- replacing SolidJS

## Problem Statement

The engine is already the strongest architectural layer: it has deterministic state, semantic events, a reducer, seeded randomness, resolution logic, and replay support.

The live application weakens that model because authority is distributed across:

- `contexts/PlayGameContext.tsx`
- `components/screens/play/PlayBoard.tsx`
- `services/playgame/script/actions.ts`
- `services/playgame/script/flows.ts`
- `services/playgame/presentation/eventAnimator.ts`

Presentation code currently decides when authoritative events are dispatched. Script code retains partially consumed engine event arrays and manually hands control from reveal animation to turn advancement.

That makes correctness depend on presentation branches. The known reveal handoff has three event-loss paths in one function:

1. `revealByPriorityFromEngine` only dispatches per-reveal slices beginning at `myIdx + 1`, so events before the first `CARD_FLIPPED` are never dispatched.
2. If the engine emitted flips but the UI already considers all of those cards revealed, the `activeFlipped.length === 0` return loses every event before `TURN_ENDED`, including the undispatched flip events.
3. If the engine emitted no flips, the `flippedIndices.length === 0` return likewise loses every event before `TURN_ENDED`.

In all three cases the function has already set `_revealsConsumedUpTo` to the `TURN_ENDED` position. `advanceTurnFromEngine` resumes there, so the live UI skips valid events even though headless resolution is correct.

This is not fundamentally a card component or CSS problem. It is an ownership problem.

Match setup has a second ownership gap. Both `/play` entry buttons navigate to the same parameterless route, the router mounts `ClassicPlayScreen` without match inputs, the debug picker reduces its selections to two bare `Deck` arrays, and the screen passes only an anonymous pre-built `MatchState` into `PlayGameProvider`. Match identity, participant identity, deck identity and revision, selected mode, and matchmaking metadata therefore never reach the session or are discarded before the provider mounts. The provider then defaults presentation metadata to `YOU` and `OPPONENT`.

The missing deck contract already causes gameplay divergence:

- Live opponent turns call `planEnemyTurnFromPool` in `services/playgame/script/actions.ts`. That planner selects definitions from the whole enabled manifest and `autoPlayRemoteSeat` mints new cards, while normal turn resolution keeps drawing cards into the real remote hand from the selected P1 deck. The remote deck and hand accumulate without governing what the opponent plays, so opponent deck selection is cosmetic.
- The headless driver already calls `planEnemyTurnFromHand`, so live and headless execution do not share the same opponent-card provenance.
- `MatchConstants` has no `startingHandSize`. The live opening sequence draws four cards for the local seat only, while `runMatch.ts` hard-codes three opening draws for each seat and explicitly documents the missing constant.
- `buildDebugMatchState` silently warns and skips an unknown card definition, producing a shorter deck instead of rejecting the match setup.
- `Deck` accepts `variantId`, but both normal and debug card construction use only `defId`; `CardInstance` has no retained variant selection. A chosen variant is therefore ignored.

These are bootstrap and provenance failures, not collection-wiring failures. **[BUILD NOW]** Establish a frozen, validated match descriptor even while the debug picker is the only deck source.

## Required Invariants

The refactor is successful only if all of these remain true:

1. **[SEAM]** The engine is the sole source of gameplay semantics.
2. **[BUILD NOW]** The match runtime is the sole owner of authoritative live state and event application.
3. **[SEAM]** Every accepted intent produces a complete ordered event transaction.
4. **[BUILD NOW]** The complete transaction is committed immediately in the local runtime and every event in it is applied exactly once.
5. **[SEAM]** Presentation consumes a read-only transition timeline; pacing advances a presentation cursor and cannot gate authoritative commitment.
6. **[BUILD AFTER]** Missing DOM elements, disabled animation, animation errors, or cancellation cannot alter the final match state because presentation never owns a partially committed transaction.
7. **[BUILD NOW]** Live execution and replay use the exact same framed-event fold.
8. **[BUILD NOW]** Live execution and headless replay finish with the same state and event log for the same seed and intents.
9. **[BUILD AFTER]** Components cannot directly mutate engine state.
10. **[BUILD AFTER]** Replay rendering remains read-only and does not run gameplay commands.
11. **[SEAM]** Viewer-relative presentation never changes absolute engine ownership.
12. **[BUILD NOW]** Every match session is created from one validated, deeply frozen `MatchBootstrap`; participant, deck, mode, and match metadata are retained by the session for its full lifetime.
13. **[SEAM]** The engine and reducer receive only mechanical inputs. Participant names, avatars, deck display names, and other presentation or matchmaking metadata never enter `MatchState`.
14. **[BUILD NOW]** Unless an explicit engine event creates a card, every card drawn or played by a seat originates from that seat's frozen bootstrap deck snapshot.
15. **[SEAM]** The canonical future durable match record is the validated bootstrap plus canonical genesis mechanical state and an ordered append-only sequence of committed transaction records. Any materialized `MatchState` snapshot is a revision-addressed cache of that fold, never a second authority; durable persistence is deferred.
16. **[BUILD NOW]** Accepted intent processing is single-writer and revisioned in process: every local source enters one FIFO queue, legality is decided at dequeue time, and a committed intent is applied at most once.
17. **[SEAM]** The storage contract makes acceptance, committed transaction, resulting revision, and the intent receipt one atomic operation; local rejections and duplicates produce typed results rather than gameplay events or presentation frames. Durable receipts and atomic persistence are deferred.
18. **[SEAM]** Full bootstrap data, canonical state, events, log, and frames stay behind explicit seat-projection APIs. Local play may initially use an all-seats pass-through implementation; exhaustive wire redaction and unknown-version serialization are deferred.
19. **[SEAM]** Gameplay randomness has stable, versioned semantic namespaces owned by bootstrap, resolution, and AI. Presentation/cosmetic code receives no gameplay RNG, and engine/runtime resolution receives no wall-clock input.
20. **[BUILD LAST]** Active presentation timelines have bounded size and lifetime, use structurally shared log-free states, and release all frame references after completion, abort, fast-forward, reset, or unmount.
21. **[BUILD NOW]** The product model is simultaneous staged turns: seats privately stage and revise, then lock; resolution begins only at the local readiness boundary. The first `END_TURN` must not resolve the turn immediately. Deadline policy remains deferred with authoritative clocks.
22. **[BUILD AFTER]** Presentation-run and match generations make stale cursor operations no-ops. Reset, disposal, remount, animation failure, and fast-forward cannot mutate a newer cursor or resurrect an old timeline.
23. **[BUILD AFTER]** Every effect-originated domain mutation passes through its governed operation before a past-tense event exists. Reducers remain blind event appliers and never enforce card/location policy.
24. **[BUILD AFTER]** One committed-event reaction dispatcher derives card and location reactions. Mutation producers, scripts, and presentation code never manually fire the same gameplay hook.
25. **[BUILD AFTER]** An ordinary card or location is authored in one content folder and cannot import engine implementation code. Exceptional built-ins may orchestrate governed operations but may not bypass them.
26. **[BUILD AFTER]** Continuous projections and committed mutations remain distinct. Recomputing an ongoing modifier or suppression may change effective power but never emits a gained/lost-power mutation or reaction.
27. **[BUILD AFTER]** A committed event or its immutable semantic envelope retains the historical source, cause, owner, reason, and before/after zone/lane facts required by reactions, replay, and presentation; consumers do not reconstruct those facts from post-event state.

## Target Architecture

```text
MatchBootstrap
      |
      v
MatchSession <---------------- Player / AI intent
  |  \
  |   +----------------------> participant / deck / mode metadata
  |
  | mechanical projection only
  v
MatchRuntime ----------------> deterministic engine: resolve / apply / replay
  |
  +---- authoritative state
  +---- canonical transaction records / receipts / revision
  +---- canonical event frames
        |
        | seat-projection API; immutable timeline adapter
        v
PresentationDirector
  |      owns frame iteration, read-only pacing, transfers, VFX, SFX
  |      invokes presentation hooks; cannot dispatch events
  v
PlayUiContext presentation cursor and Solid components
```

### Match Bootstrap

**[SEAM]** Every match begins with this descriptor. `MatchMode` and `ParticipantController` are domain types whose concrete values are defined at the entry/session boundary, not reducer concepts.

```ts
interface MatchBootstrap {
  readonly matchId: string;
  readonly mode: MatchMode;
  readonly seed: string;
  readonly rulesetId: string;
  readonly manifestVersion: number;
  readonly viewerSeat: Seat;
  readonly participants: Readonly<Record<Seat, {
    readonly participantId: string;
    readonly controller: ParticipantController;
    readonly displayName: string;
    readonly avatarId?: string;
  }>>;
  readonly decks: Readonly<Record<Seat, {
    readonly deckId: string;
    readonly revision: number;
    readonly name: string;
    readonly entries: Deck;
    readonly contentHash: string;
  }>>;
}
```

**[BUILD NOW]** Match setup validates both deck snapshots against the selected manifest and ruleset, copies them into session-owned data, and deeply freezes the complete bootstrap before constructing the runtime. The current debug picker is the first adapter that produces this contract; future collection and matchmaking adapters can replace it without changing the session boundary.

**[SEAM]** `MatchSession` retains the complete bootstrap behind a projection boundary and constructs `MatchRuntime` from only the mechanical projection: seed, resolved manifest and rules, and each seat's deck entries. Names, avatars, participant IDs, deck display names, and matchmaking metadata never enter reducer `MatchState`.

**[BUILD NOW]** `mode` is descriptive in this refactor. The Conquest and Ladder entry buttons may pass their respective mode strings into the bootstrap, but the value must not introduce mode-specific rules or ruleset branching in this plan.

**[SEAM]** The complete bootstrap is runtime-internal. `projectBootstrapForSeat` is the only normal consumer boundary; local/debug play may use an explicit trusted pass-through adapter. Replay/export authorization stays separate from live projection.

**[DEFER]** Opponent-data redaction policy, exhaustive serialization proofs, authorized wire replay export, and reconnect snapshot/tail payloads wait for a real multiplayer/server consumer.

### Match Runtime

The runtime owns:

- **[SEAM]** current authoritative `MatchState`
- **[SEAM]** initial state and seed
- **[SEAM]** the single FIFO queue for player, AI, system, and session-command intents
- **[SEAM]** local accepted-intent results and committed revision; durable receipts and sequence watermarks remain deferred
- **[SEAM]** engine resolution
- **[SEAM]** ordered in-memory transaction records and canonical event log
- **[SEAM]** authoritative transaction commitment
- **[SEAM]** exactly-once event application
- **[SEAM]** phase transitions
- **[SEAM]** presentation-timeline publication
- **[SEAM]** replay export inputs

The runtime does not own:

- **[SEAM]** DOM elements, CSS classes, animation durations, or card rectangles
- **[SEAM]** modal, inspector, pile-menu, or toast state
- **[SEAM]** clocks, deadlines, disconnect grace, transport backpressure, or distributed-worker leases

### Canonical Frame and Transition View

**[SEAM]** Phase 1.1 defines the only gameplay chronology. `Frame` is a
match-local integer (`0` is genesis), and each `FramedEvent` owns exactly one:

```ts
interface FramedEvent {
  frame: Frame;
  scope: TemporalScope;
  event: MatchEvent;
}

interface EventTransition {
  transactionId: string;
  /** Transaction-local playback order; not gameplay chronology. */
  index: number;
  framedEvent: FramedEvent;
  before: MatchState;
  after: MatchState;
}
```

**[SEAM]** `FramedEvent` is canonical and runtime-internal.
`EventTransition` is a short-lived materialized before/after view of that same
event, not another frame type. `ReplayStep.cursor` and transaction-local
`EventTransition.index` are playback coordinates and never gameplay clocks.
The shared builder derives `after` through the reducer without deep-cloning
each state or embedding a copied canonical log; reducer snapshots preserve
immutable structural sharing.

**[BUILD LAST]** Interactive timelines retain only a bounded active transaction and release it when consumed or invalidated; replay frames are generated lazily/on demand.

**[SEAM]** `projectBootstrapForSeat`, `projectStateForSeat`, and `projectTransactionForSeat` return distinct `SeatBootstrap`, `SeatMatchState`, and `SeatTransactionFrame` types rather than canonical types with secret fields set to `undefined`. Player-facing APIs accept only projected types; trusted local/debug play uses a separate adapter behind that boundary.

**[BUILD AFTER]** Implement the local projected-type adapter when `PresentationDirector` and provider consumers migrate.

**[DEFER]** Stable opaque opponent handles, exhaustive canonical-event redaction, unknown-protocol fail-closed behavior, and serialization leak tests wait for a networked hidden-information consumer.

### Commit and Presentation Contract

**[SEAM]** The runtime commits the complete accepted transaction immediately; `PresentationDirector` consumes a projected form of the same immutable transition timeline used by replay and owns iteration/pacing. A `PlayUiContext` cursor controls which already-committed transition the visible UI reflects.

**[SEAM]** The future durable unit is the validated bootstrap and canonical genesis mechanical state plus ordered append-only transaction records. The storage API reserves transaction identity, revision, actor/intent identity, ordered events, and checksum fields; a snapshot is only a cache at a stated revision.

**[DEFER]** Durable append, persisted checksums, snapshot-plus-tail recovery, receipt recovery, and overlap rejection are live-server work.

**[BUILD NOW]** Only a validated local transaction builder can reach commit. It verifies expected in-process revision, contiguous event sequence, and reducer invariants; invalid authoritative events fail the transaction instead of becoming silent no-ops.

**[BUILD LAST]** Add transaction event/byte bounds and replace full-log gameplay queries with bounded fold-maintained indexes if Phase 0 shows they are not required for the initial log-free frame decision.

**[DEFER]** Persisted deterministic checksums and storage compare-and-swap that arbitrates multiple owners wait for the live-server adapter.

**[SEAM]** The presentation contract supports transaction-scoped choreography and per-frame capture/animation:

```ts
interface MatchPresentationSink {
  beforeTransaction?(frames: readonly SeatTransactionFrame[]): void;
  beforeFrame?(frame: SeatTransactionFrame): void;
  afterFrame?(frame: SeatTransactionFrame, signal: AbortSignal): Promise<void> | void;
  afterTransaction?(): Promise<void> | void;
}
```

Commit and presentation behavior:

1. **[BUILD NOW]** Resolve the accepted intent and build its complete immutable transition timeline with the shared live/replay fold.
2. **[BUILD NOW]** Atomically within the local process commit the accepted result, transaction record, resulting revision, and final state, without invoking or awaiting presentation.
3. **[BUILD AFTER]** Publish the read-only projected timeline while the UI cursor still reflects the pre-transaction state; the runtime's responsibility ends at publication.
4. **[BUILD AFTER]** `PresentationDirector` calls `beforeTransaction`, then for each frame calls `beforeFrame`, advances the visible cursor to `frame.after`, awaits `afterFrame`, and finally calls `afterTransaction`.
5. **[BUILD AFTER]** If a hook aborts or throws, queue an idempotent same-generation microtask that snaps to transaction end and then surfaces the error without synchronous callback reentry.
6. **[BUILD AFTER]** If an intent arrives while presentation lags, enqueue it immediately, request fast-forward, cancel the active run, snap to committed end, and then drain; cursor lag never rejects the intent.

**[SEAM]** Presentation can delay only the visible cursor. It cannot suppress or partially commit gameplay state.

#### Concurrency Model

- **[BUILD NOW] P1 — single writer and total order:** one FIFO queue serves local player, AI, typed system intents, reset, and session commands. At most one transaction resolves or commits at a time, and dequeue order is the total local acceptance order. A remote-player adapter is only a seam.
- **[BUILD NOW] P2 — dequeue-time authority:** submission-time checks are advisory UX only. The runtime checks expected revision, phase, terminal state, seat authority, and rules against authoritative state when dequeued, then returns a typed result; an illegal request does not throw or halt the queue.
- **[BUILD NOW] Local idempotency and at-most-once commit:** the envelope reserves `matchId`, `intentId`, `expectedRevision`, and optional `intentSeq`; the local session supplies actor/seat. An in-memory retry map returns the original result without resolving twice, and a new stale request returns the current revision.
- **[DEFER] Durable idempotency:** authenticated actor derivation, lifetime receipt retention, durable sequence watermarks, receipt compaction, and recovery of original responses wait for the live server.
- **[BUILD NOW] Atomic, non-yielding local commit:** accepted result, in-memory transaction append, revision, and state update happen in one non-yielding critical section. Resolution/commit invokes no presentation callback; rejections and duplicates create typed local results, not gameplay transactions.
- **[DEFER] Durable atomic commit:** storage CAS, durable receipt/transaction atomicity, multi-owner conflict handling, and persistent audit records wait for the live-server adapter.
- **[BUILD AFTER] P3/P4 — generation-safe, idempotent cursor operations:** every presentation run has a generation; only the current generation may advance or snap, and repeated/stale snaps are no-ops.
- **[BUILD AFTER] P5 — reset, disposal, and remount:** queued reset/session disposal bumps generation; provider disposal aborts and invalidates its director, releases references, and prevents old continuations from writing cursor state; remount starts from latest committed projection.
- **[SEAM] P6 — no sink reentrancy:** presentation hooks receive no `submitIntent` capability. Presentation-triggered commands are deferred until the run completes or aborts.
- **[BUILD NOW] P7 — runtime-owned phase scheduling:** the runtime/session scheduler decides when local AI stages or locks and submits that intent to the common queue without waiting for presentation.

**[BUILD NOW]** The match model is simultaneous staged turns. Each seat may privately stage and revise, then lock. A system-owned resolution command closes the local turn only after both seats are ready; the first seat's `END_TURN` never resolves immediately. Phase 0 chooses deterministic canonical merge/order or explicit serialized staging-order semantics.

**[DEFER]** Deadline-driven reveal policy and proof against network-arrival timing wait for authoritative clocks and remote input.

### Context Split

**[SEAM]** Replace the current broad context with two responsibilities.

`MatchSessionContext` exposes:

- **[SEAM]** read-only current `SeatMatchState` and manifest
- **[SEAM]** match ID, mode, viewer seat, and participant/deck metadata from `SeatBootstrap`
- **[SEAM]** transaction/resolution status
- **[SEAM]** typed commands such as `submitIntent`, `undoPending`, and `resetMatch`
- **[SEAM]** replay-export commands rather than the canonical log as live context data

`PlayUiContext` exposes:

- **[SEAM]** inspector, portrait/pile menu, reservation, locked-result prompt, and replay-drawer state
- **[SEAM]** the read-only active presentation timeline and presented-frame cursor
- **[SEAM]** presentation-only flags

**[SEAM]** Visible board selectors read the seat projection at the presented-frame cursor (or latest authoritative projection when no transaction is active). Commands validate inside the runtime, never against the lagging presentation projection.

**[SEAM]** Neither context exposes a raw Solid setter for engine state.

## Migration Principles

1. **[SEAM]** Migrate vertically, one end-to-end behavior at a time.
2. **[BUILD NOW]** Add characterization tests before moving authority.
3. **[BUILD NOW]** Preserve semantic engine events and replay format only if Phase 0 proves that the vocabulary reconstructs every gameplay-visible transition.
4. **[SEAM]** Keep compatibility adapters temporary and visibly marked.
5. **[SEAM]** Never maintain two authoritative live states.
6. **[SEAM]** Do not combine the runtime migration with a visual CSS rewrite.
7. **[BUILD NOW]** Delete old control paths when their replacement passes; do not leave two active turn-resolution systems.
8. **[SEAM]** Do not land a narrowed Phase 1 that leaves a second authority or a partially migrated runtime.

## Phase 0: Characterization and Guardrails

### Objective

**[BUILD NOW]** Prove current engine behavior and encode live/headless parity before moving authority.

### Work

- **[BUILD NOW]** Add a runtime-level test fixture builder with explicit seed, decks, hands, lanes, phase, priority, and locations.
- **[BUILD NOW]** Add one reproducible seeded property generator for manifest-valid match setups and legal stage/unstage/lock sequences. Failures print a replayable generator seed. Run at least 200 generated matches per property in CI with a configurable faster local count.
- Add named generated properties beside `services/playgame/runtime` tests:
  - **[BUILD NOW] P-PARITY:** live runtime execution and headless fold of the same `(seed, decks, intents)` produce identical final state, ordered event log, turn, phase, priority, energy, and result
  - **[BUILD NOW] P-EXACTLY-ONCE:** a counting reducer proves every committed event index is applied once
  - **[BUILD NOW] P-PROVENANCE:** every observed card originates from that seat's frozen deck snapshot or an explicit creation event
  - **[BUILD NOW] P-FOLD:** after every local commit `N`, state equals the fold of log prefix `[0..N]` over genesis
  - **[BUILD NOW] P-NO-TIME:** fake wall-clock changes do not change logs and no `Date.now()`/`Math.random()` leak reaches resolution
  - **[BUILD AFTER] P-INTERLEAVE:** after the director/cursor harness lands, generated abort points and fast-forwards match no-presentation authoritative results
- **[BUILD LAST]** Perform and record a one-time reducer mutation check proving P-PARITY and P-FOLD fail, then immediately revert the mutation.
- **[BUILD NOW]** Add a two-debug-deck provenance characterization that fails on current live pool planning and passes after hand planning.
- **[BUILD NOW]** Characterize the current live-four-local versus headless-three-per-seat opening divergence before replacing both with one constant.
- **[BUILD NOW]** Add the headless intermediate-state helper and make it the only shared live/replay framed-event fold.
- **[BUILD NOW]** Audit every script action that originates engine events or directly changes authoritative state. The initial code-verified inventory is:
  - `drawFromDeck`, `dealPlayerCard`, and `drawHandCard`, which synthesize hand-entry/draw events
  - `revealLocation` and `revealNextLocation`, including `dispatchLocationRevealEffects` and its local `evalEffect` fallback
  - `captureEngineEndTurn`, `revealByPriorityFromEngine`, and `advanceTurnFromEngine`, which resolve, slice, and dispatch turn events
  - `autoPlayRemoteSeat`, which mints a card and dispatches add, stage, and energy events
  - `startResolving` and `finishResolving`, which directly set authoritative phase state
- **[BUILD NOW]** Classify each audited step as engine/runtime gameplay or presentation-only pacing. Location reveal and its effects move into engine resolution.
- **[BUILD NOW]** Characterize undo and decide whether `UNSTAGE_CARD`/`UNDO_TURN` already reproduce required single-card and LIFO semantics after staged triggers.
- **[BUILD NOW]** Enumerate gameplay-visible opening/turn transitions and prove the event vocabulary reconstructs them; if not, name the engine-schema change before implementation.
- **[BUILD NOW]** Decide and enforce card-instance representation so zones cannot retain stale copies of instance fields.
- **[SEAM]** Inventory each gameplay query that scans `state.log` and specify its eventual bounded tracked field/index.
- **[BUILD NOW]** Decide simultaneous staging semantics and record executable local examples; remote arrival-time proofs are deferred.
- **[SEAM]** Define versioned RNG namespace ownership for bootstrap, resolution, AI, and cosmetics, including stable semantic transaction identity.
- **[BUILD NOW]** Test that fake time, cosmetic draws, and independent fork creation order cannot change committed gameplay events.
- **[BUILD NOW]** Before implementation, run `npm run lint` and `npm run build` and record exact exit status/failures as the baseline.
- **[BUILD NOW]** Add focused tests for:
  - bootstrap deck provenance for both seats, including an explicitly engine-created-card exception
  - current live-four-local versus headless-three-per-seat opening behavior
  - end turn with no staged cards
  - end turn with no cards requiring a flip but with end-of-turn effects
  - one reveal with a triggered event cascade
  - multiple reveals in priority order
  - effects occurring between the final flip and `TURN_ENDED`
  - location reveal at the turn boundary
  - draw into a non-full hand
  - draw while hand is full
  - match end and locked result
  - local seat as `P0`
  - local seat as `P1`
- **[BUILD AFTER]** Add H1–H7 scripted director/cursor interleavings covering double-submit/player-AI overlap, dequeue illegality, error-snap/fast-forward, reset/unmount during hooks, stale failure snaps, sink deferral, and AI under slow presentation.
- **[DEFER]** Add durable recovery tests with pre/post-append failures, checksum/event/receipt parity, snapshot-plus-tail recovery, and overlapping-tail rejection when a durable adapter exists.
- **[BUILD NOW]** Add an exact parity assertion comparing:
  - final state
  - ordered event log
  - turn, phase, priority, energy, and result
- **[SEAM]** Keep DOM, animation timing, and presentation side effects out of runtime properties; P-INTERLEAVE uses a deterministic director/cursor harness.

### Exit Criteria

- **[BUILD NOW]** The no-flips loss is reproducible, headless behavior is locked, and tests fail on skip/double application.
- **[BUILD NOW]** Every authoritative script mutation has a disposition; event vocabulary and undo have code-backed decisions.
- **[BUILD NOW]** Deck provenance and the 4-vs-3 opening gap are captured without normalization.
- **[BUILD NOW]** Exact lint/build baselines are recorded.
- **[BUILD NOW]** The generator seed replays and the five BUILD NOW properties pass for at least 200 generated matches per property in CI.
- **[BUILD AFTER]** P-INTERLEAVE and H1–H7 pass once the presentation consumer exists.
- **[BUILD NOW]** Card-instance representation and simultaneous local staging order have code-backed decisions before Phase 1.
- **[SEAM]** Every full-log query has a named bounded-index replacement, without requiring that replacement in Phase 1.
- **[BUILD NOW]** RNG namespace and no-wall-clock tests prove cosmetic work, fork creation, and fake time cannot change gameplay events.
- **[BUILD LAST]** The recorded mutation check proves P-PARITY/P-FOLD can fail.

## Phase 1: Introduce `MatchSession` and `MatchRuntime`

### Objective

**[BUILD NOW]** Create a bootstrap-owned session and one non-DOM authoritative live owner.

### Work

- **[SEAM]** Keep Phase 1 local. Define storage, projection, concurrency, and coordinator interfaces, but add no routing, leases, sockets, clocks, reconnect, durable database, or operational retention service.
- **[BUILD NOW]** Add a playgame runtime module separate from Solid components and presentation.
- **[BUILD NOW]** Add `MatchSession.fromBootstrap(...)`; validate/copy/deep-freeze the bootstrap, retain it for the session lifetime, resolve manifest/ruleset, and construct `MatchRuntime` from mechanical inputs only.
- **[BUILD NOW]** Change the debug picker to construct a complete `MatchBootstrap` rather than `MatchState`, with explicit debug identity, revision, mode, and content hash values.
- **[BUILD NOW]** Validate each bootstrap deck before any `MatchState` exists:
  - `manifestVersion` matches the resolved manifest and `rulesetId` resolves to an available rules definition
  - exactly 12 entries, equal to `manifest.constants.deckSize`
  - every definition exists and is enabled for the selected ruleset
  - every supplied `variantId` exists on its card definition
  - uniqueness and copy-limit rules declared by the manifest/ruleset
  - a recomputed canonical entries hash equals `contentHash`
- **[BUILD NOW]** Add manifest/rules uniqueness and copy-limit declarations before enforcing them; do not hard-code collection policy in the adapter.
- **[BUILD NOW]** Replace debug warn-and-skip with a hard setup error and retain validated `variantId` through card creation/provenance.
- **[BUILD NOW]** Add `startingHandSize` to `MatchConstants`; live and headless draw it for both seats through one opening path.
- **[BUILD NOW]** Switch live AI from pool planning to hand planning; accepted AI plans reference authoritative hand instance IDs and submit normal staging intents.
- **[SEAM]** Define typed revisioned intent envelopes/results instead of reducer dispatch. Reserve actor/seat derivation, `intentId`, `expectedRevision`, and optional `intentSeq`; never authorize a client-supplied owner.
- **[BUILD NOW]** Implement one local FIFO single-writer queue for player, AI, system, reset, and disposal. Validate at dequeue; typed rejection does not halt drain.
- **[BUILD NOW]** Add an in-memory match-scoped retry map: duplicate keys return their original local result, stale revisions return current revision, and neither creates gameplay events or frames.
- **[DEFER]** Add durable receipts, authenticated actor binding, sequence watermarks, retention/compaction rules, and recovery of original results only with a live-server storage adapter.
- **[BUILD NOW]** Implement a local validated-commit boundary: non-yielding result/transaction/revision/state update, expected revision, contiguous events, and reducer invariants; it never awaits or invokes presentation.
- **[DEFER]** Implement reference durable storage, persisted checksums, revision CAS across owners, and failure recovery only with the server adapter.
- **[BUILD LAST]** Add transaction event/byte limits as final runtime hardening.
- **[BUILD NOW]** Route every live authoritative event/state mutation through the runtime; adapters may relay reads/typed commands but retain no authority.
- **[BUILD NOW]** Remove transaction/application cursor ownership from `_engineEvents`, `_engineFinalState`, and `_revealsConsumedUpTo`.
- **[BUILD NOW]** Guarantee local at-most-once transaction commitment and exactly-once reducer application.
- **[BUILD NOW]** Build immutable canonical frames with the shared live/replay builder and keep canonical values runtime-internal.
- **[SEAM]** Define projected bootstrap/state/transaction types and projection APIs; normal consumers cannot type-receive canonical state, frames, or logs.
- **[BUILD AFTER]** Implement the local trusted projection/pass-through adapter as provider and director consumers migrate.
- **[DEFER]** Implement exhaustive hidden-information redaction, protocol/integrity fields, unknown-variant fail-closed serialization, and leak tests with multiplayer transport.
- **[SEAM]** Frames use immutable structural sharing and no per-event deep clone; canonical log ownership stays outside frame snapshots.
- **[BUILD LAST]** Remove embedded canonical history from materialized state, add the chosen bounded gameplay indexes, bound/release timelines, and lazily generate replay frames.
- **[BUILD NOW]** Commit each complete accepted transaction immediately before presentation.
- **[SEAM]** Publish timelines through an optional adapter; runtime never registers/invokes sinks, and a missing director cannot affect gameplay.
- **[BUILD AFTER]** Implement projected publication and P3–P6 queued fast-forward, generation-safe snaps, reset/disposal/unmount invalidation, and deferred presentation-triggered commands.
- **[BUILD LAST]** Add configured in-process timeline publication bounds and reference-release assertions.
- **[DEFER]** Transport subscriber backpressure/drop policy waits for websockets.
- **[BUILD NOW]** Make runtime/session scheduling authoritative for local AI staging/locking; AI enters the queue without waiting for presentation.
- **[BUILD NOW]** Implement private staging/revision, per-seat locks, and one local system reveal command using the Phase 0 order decision.
- **[BUILD NOW]** Enforce gameplay RNG namespaces and deny gameplay RNG/time access to presentation/resolution respectively.
- **[BUILD NOW]** Keep local replay export based on session bootstrap, genesis, and in-memory transaction records without overlapping history.
- **[DEFER]** Seat-authorized wire export and reconnect payloads wait for multiplayer authorization/transport.
- **[SEAM]** Define a side-effect-free observer interface outside deterministic state, with low-cardinality/no-sensitive-data field policy.
- **[BUILD AFTER]** Emit local queue, transaction, frame, and presentation counters when runtime/director consumers exist.
- **[DEFER]** Emit recovery, redaction, reconnect-size, and access-controlled per-match traces only with those server consumers.
- **[BUILD NOW]** Carry `mode` unchanged in session/replay with no mode-specific rules branch.
- **[BUILD NOW]** Run the five BUILD NOW generated properties and RNG tests against the completed runtime.
- **[BUILD AFTER]** Run H1–H7 and P-INTERLEAVE against the completed runtime/director integration.
- **[DEFER]** Run recovery and wire projection serialization/leak/fail-closed tests when durable transport exists.

**[SEAM]** Use these internal review checkpoints in dependency order while landing the BUILD NOW portion of Phase 1 as one indivisible authority migration:

1. **[SEAM]** Contract-only types: bootstrap, transaction/revision, envelope/result, generation token, RNG namespaces, projected types, future persistence/limit interfaces, and lock/reveal state.
2. **[BUILD NOW]** Bootstrap validation, provenance, variants, card representation, and shared opening initialization.
3. **[BUILD NOW]** Pure transaction fold/committer, FIFO, in-memory retry/idempotency, and parity properties.
4. **[BUILD NOW]** Hand-based AI, phase scheduling, simultaneous reveal, and every live mutation behind typed commands.
5. **[BUILD NOW]** Session/debug adapters, local replay export, observer seam, old-authority deletion, and final BUILD NOW gates.

**[SEAM]** No intermediate checkpoint is independently mergeable if it leaves two authorities.

### Exit Criteria

- **[BUILD NOW]** A complete turn runs with no DOM/director; live runtime and headless fold produce identical final state/log.
- **[BUILD NOW]** P-PARITY, P-EXACTLY-ONCE, P-PROVENANCE, P-FOLD, and P-NO-TIME pass at configured CI depth.
- **[BUILD NOW]** No runtime API exposes a raw setter and no authoritative cursor remains in presentation/script state.
- **[BUILD NOW]** Live/replay use one framed-event fold and presentation absence cannot partially apply a transaction.
- **[BUILD NOW]** Both opening hands use `startingHandSize`; live/headless provenance matches and AI cannot play absent deck definitions without creation events.
- **[BUILD NOW]** Invalid ruleset/version/length/definition/variant/copy/hash rejects bootstrap without shortening a deck.
- **[BUILD NOW]** Local replay export contains bootstrap, genesis, and non-overlapping in-memory transactions.
- **[BUILD NOW]** Duplicate, stale, phase-invalid, rules-invalid, and dequeued-illegal local requests return typed results, add no gameplay events/frames, and do not halt FIFO.
- **[BUILD NOW]** The first seat lock does not resolve; the local system reveal uses the decided staging order.
- **[SEAM]** Normal UI/presentation APIs accept projected types only.
- **[BUILD AFTER]** Local projection integration and H1–H7/P-INTERLEAVE pass with the provider/director.
- **[BUILD LAST]** Frame retention is bounded/released, materialized state is log-free, and gameplay queries use bounded indexes.
- **[DEFER]** Durable recovery/receipt/checksum/CAS and exhaustive hidden-information serialization gates pass only when live-server adapters are built.
- **[SEAM]** Phase 1 lands as a complete BUILD NOW authority migration, never a partial runtime beside a second live path.

## Phase 1.1: Canonical Simulation Timeline

**[BUILD NOW]** Establish one match-local `Frame` and one `FramedEvent` stream
before location lifecycle or modifier provenance depends on chronology.

- **[BUILD NOW]** Genesis is frame `0`; every committed event owns exactly one
  globally contiguous frame.
- **[BUILD NOW]** `MatchRuntime` owns the committed head. Rejected intents,
  private plans, projections, playback, VFX, and wall-clock activity do not
  advance it.
- **[BUILD NOW]** Live commit, state log, runtime replay, engine replay, and
  transition materialization use the same framing/fold implementation.
- **[BUILD NOW]** Store explicit turn/phase scope on each framed event and keep
  future scheduling semantic (`turn + phase`) rather than guessing a frame.
- **[BUILD NOW]** Make `TURN_STARTED` the first frame of the new turn and the
  transition that changes `state.turn`; start-of-turn bookkeeping follows it.
- **[BUILD NOW]** Treat `EventTransition.index` and `ReplayStep.cursor` only as
  playback coordinates. They are never alternate gameplay clocks.
- **[BUILD NOW]** Store only `FramedEvent[]` in committed transactions and
  replay bundles. Retain raw `MatchEvent[]` only as temporary resolver output;
  do not maintain an unshipped legacy replay format.
- **[BUILD NOW]** Prove continuity, live/replay identity, turn mapping,
  lifecycle chronology, invalid-frame rejection, and private-plan
  non-advancement.

See `docs/agent-checkpoints/phase1.1-canonical-timeline.md`.

## Phase 1.15: Cross-Language Protocol Validation

**[BUILD NOW]** Establish one generated JSON Schema 2020-12 structural
contract before location lifecycle and capability-kernel work expands the
event vocabulary.

- **[BUILD NOW]** Validate match bootstrap, intent envelopes, framed events,
  and committed transactions from one versioned schema.
- **[BUILD NOW]** Consume that schema through Ajv in TypeScript and
  `jsonschema` plus `typify` in Rust; do not hand-maintain a parallel Rust
  protocol model.
- **[BUILD NOW]** Run the same valid/invalid conformance fixtures in both
  languages and fail CI on generated-schema drift.
- **[BUILD NOW]** Enforce JavaScript-safe integer limits at the shared wire
  boundary.
- **[SEAM]** Keep frame continuity, revision continuity, manifest existence,
  deck construction, and gameplay legality in the simulation. Portable shape
  validation must not become a second rules engine.
- **[SEAM]** Recognize every event discriminant now, but defer exhaustive
  payload closure for events whose envelope is being redesigned by Phase 1.5.
- **[DEFER]** Full match-state/replay serialization, multiplayer redaction,
  durable storage, compatibility adapters, and Rust simulation wait for their
  owning server phases.

See `docs/agent-checkpoints/phase1.15-cross-language-validation.md`.

## Phase 1.2: Location Deck and Lifecycle

**[BUILD AFTER]** Model locations as an authored deck with deterministic draw,
reorder, stage, reveal, replace, and zone lifecycle rules. Every lifecycle
coordinate uses the Phase 1.1 `Frame`; Phase 1.2 must not introduce
`FrameStamp` or another timeline implementation.

See `docs/playgame-phase1.2-location-deck-spec.md`.

## Phase 1.5: Capability Kernel, Committed Reactions, and Location Authoring

### Objective

**[BUILD AFTER]** Stabilize the deterministic engine contract before Solid providers and presentation bind to its event vocabulary.

An ordinary card or location should live in one content folder. When a new rule needs engine support, the implementation should add one reusable governed operation, policy, adjustment, or committed reaction—not scatter definition-ID checks or manual hook calls across resolution paths.

Phase 1.5 is a vertical refactor of the existing engine, not a replacement:

- preserve `MatchSession`, `MatchRuntime`, reducer application, transaction records, replay folding, seeded RNG, simultaneous staging/lock/reveal, and Phase 1 authority
- preserve the declarative effect/ongoing DSL where it is sufficient
- preserve exceptional built-ins only as orchestration adapters over governed operations
- add hooks only from proven content requirements; do not pre-invent a 40-hook public API
- make no provider, animator, board-component, CSS, or visual-design changes

### Rule-Source and Location Authoring Contract

**[SEAM]** Cards and locations remain distinct definitions with distinct setup/reveal rules, but both are typed rule sources that can declare triggered effects, ongoing projections, and operation policies supported by the engine.

**[BUILD AFTER]** Move each location from the centralized location table into a self-contained folder mirroring card authoring:

```text
services/playgame/engine/manifest/location-sets/core-v1/
  set.json
  locations.generated.ts
  locations/
    courthouse/
      location.json
    ...
```

This deliberately matches the active card-set layout. There is one generated index at the set root and no second hand-maintained registry.

Each location folder owns its definition ID, version/status, rarity, display data, cosmetics/assets, and declarative abilities. A strict loader/schema validator:

- rejects duplicate IDs, unknown operators/capabilities/hooks, invalid references, and malformed parameters
- emits deterministic generated output and fails CI on drift
- preserves all current location IDs and manifest-visible values during migration
- prevents content definitions from importing engine modules or supplying arbitrary executable callbacks

**[SEAM]** Locations behave conceptually as a neutral third deck: their setup order and reveal schedule differ from player cards, but once committed they participate in the same rule-source and reaction infrastructure.

### Governed Domain Operations

**[BUILD AFTER]** Put semantic commands before past-tense events. Every effect-originated mutation enters one governed operation family:

- play commitment and reveal; Phase 1 staging/lock scheduling remains unchanged
- move, destroy, banish, return, create, and transform
- power and cost changes
- draw and discard
- energy changes
- location reveal, replace, and destroy

Each operation follows one deterministic pipeline:

1. validate the proposed command and current phase/state
2. collect prohibitions from active rule sources
3. apply replacements
4. apply ordered adjustments
5. commit zero or more canonical events
6. dispatch reactions from those committed events

**[SEAM]** Only the operation implementation may create its corresponding mutation event during normal resolution. The reducer applies accepted past-tense events without consulting abilities. Replay applies the same events without rerunning operations or reactions.

**[BUILD AFTER]** Add an architectural boundary test with an explicit exception list for reducers, codecs, replay fixtures, and tests. Effect evaluators, built-ins, scripts, and content implementations may call governed operations but may not directly construct/apply mutation events or invoke the reducer.

Exceptional built-ins remain legal when a declarative effect cannot express orchestration. They must use the same operations as ordinary content, so policy gates and reactions cannot be skipped.

### Continuous Projection Versus Committed Mutation

**[SEAM]** The engine has two intentionally different rule paths:

- committed mutation changes authoritative stored state, emits events, and may trigger reactions
- continuous projection calculates an effective value from stored state plus active ongoing modifiers/policies and emits nothing

**[BUILD AFTER]** Formalize the existing `BLOCK_POWER_INCREASE` behavior as a complete reusable capability rather than a Courthouse special case. The power model must retain enough contribution/provenance information to suppress positive stored contributions without deleting them or confusing them with later reductions.

Courthouse is the acceptance slice:

- a card entering Courthouse with an earlier positive permanent increase displays no positive increase there
- that earlier increase remains stored and becomes effective again if the card leaves
- a positive permanent change attempted while the card is at Courthouse is denied, is not stored, and therefore does not appear after it leaves
- a card increased in hand retains the stored increase when played at Courthouse, but the increase is suppressed until it leaves
- positive ongoing/lane projections do not apply there
- negative power changes still commit and apply there
- entering/leaving or recomputing the projection does not emit gained/lost-power hooks

**[SEAM]** This same separation governs future cost, movement, destruction, targeting, and scoring restrictions: persistent state is not destructively rewritten merely because an ongoing policy suppresses its current effect.

### Committed-Event Reaction Dispatcher

**[BUILD AFTER]** Add one deterministic dispatcher that consumes each newly committed event plus an immutable semantic envelope. The envelope contains the event's historical facts at commit time, including:

- source and `cause`
- affected owner/controller
- semantic reason
- prior and resulting zone
- prior and resulting lane
- whether the transition was play-from-hand, move, creation, return, destruction, or banishment

Removed or moved cards cannot rely on a post-state lookup to recover these facts.

If the serialized replay/event format changes, version it explicitly and update compatibility fixtures at this boundary. Old events are either migrated deterministically or rejected by version; presentation and replay may not fabricate missing context heuristically.

**[SEAM]** Friendly authoring hooks lower to generic typed subscriptions in this dispatcher; they are not separate imperative call sites:

| Authoring hook | Exact committed meaning |
| --- | --- |
| `onCardPlayedHere` | A card committed from its owner's hand into this lane; staging, undo, move, create, and return do not count |
| `onCardRevealedHere` | A card in this lane committed its reveal |
| `onCardDestroyedHere` | A card was committed from this lane to the destroyed zone |
| `onCardBanishedHere` | A card was committed from this lane to the banished zone |
| `onCardGainedPowerHere` | A positive stored power mutation committed while the card was here |
| `onCardLostPowerHere` | A negative stored power mutation committed while the card was here |
| `onCardEnteredHere` | An existing card committed a lane-to-lane move into this lane; play/create/return do not count |
| `onCardLeftHere` | An existing card committed a lane-to-lane move out of this lane |
| `onCardCreatedHere` | A new card instance was committed into this lane |
| `onCardReturnedHere` | A previously removed card was committed back into this lane |

New names are added only when a real rule cannot be expressed unambiguously with the generic event filter and existing vocabulary.

**[BUILD AFTER]** Specify and characterize deterministic reaction ordering before migration: event order, affected-card reactions, source-card reactions, location order, seat priority, lane order, nested reaction queue order, and seeded RNG namespace. Add a bounded recursion/reaction budget that fails deterministically rather than hanging.

One semantic event is routed once. Producer call sites must not also call `fireLocationTrigger`, `evalEffect`, or equivalent manual reaction helpers. Reactions may issue new governed commands, which commit new events and re-enter the queue in the specified order.

### Migration Checkpoints

**[SEAM]** Land Phase 1.5 as reviewable vertical checkpoints. A checkpoint may merge only when every producer path for its migrated operation uses the new route; an individual operation may never have parallel governed and ungoverned semantics.

1. **[BUILD AFTER] Contract and characterization:** inventory all current mutation producers, manual card/location trigger sites, built-ins, and event fields; freeze current ordering and ordinary-content behavior with tests.
2. **[BUILD AFTER] Location folders:** add schema/generator/check commands, migrate every current location, and prove generated manifest parity before changing rule behavior.
3. **[BUILD AFTER] Power/Courthouse vertical slice:** govern power mutation/projection, add sufficient contribution provenance, implement the complete reusable capability, and pass the Courthouse matrix.
4. **[BUILD AFTER] Lifecycle reactions:** route play, reveal, move, destroy, banish, create, and return through committed semantic envelopes and the central dispatcher; migrate existing card/location hooks without behavior drift.
5. **[BUILD AFTER] Operation conformance:** govern remaining effect-originated mutation families, convert built-ins to operation clients, delete superseded manual trigger paths, and enable architectural gates.

### Exit Criteria

- **[BUILD AFTER]** All Phase 0/1 engine/runtime parity, provenance, exactly-once, fold, no-time, opening, and simultaneous-turn gates remain green.
- **[BUILD AFTER]** Every current location loads from one folder; generated IDs, data, cosmetics, and abilities match the pre-migration manifest except for explicitly approved Courthouse behavior.
- **[BUILD AFTER]** Adding an ordinary location changes only its folder and generated output; it does not require edits to evaluator, resolver, runtime, reducer, or presentation files.
- **[BUILD AFTER]** The Courthouse matrix proves stored-versus-effective power, hand buffs, enter/leave restoration, denied in-location gains, ongoing suppression, reductions, movement, replay, and both seats.
- **[BUILD AFTER]** Projection evaluation emits no mutation event or gained/lost-power reaction.
- **[BUILD AFTER]** Every migrated semantic event produces exactly one ordered reaction-dispatch opportunity; staging/undo and replay produce no phantom gameplay reactions.
- **[BUILD AFTER]** Effect evaluators and built-ins cannot bypass governed operations, and reducers contain no content policy or definition-ID branch.
- **[BUILD AFTER]** Committed events/envelopes contain enough historical context for reactions, replay, and later presentation without semantic state-diff guessing.
- **[BUILD AFTER]** Architecture tests reject direct mutation event construction/application and scattered manual trigger invocation outside the named kernel exceptions.
- **[BUILD AFTER]** Production build, lint baseline, content generation/validation, and deterministic reaction-budget tests pass.
- **[SEAM]** Phase 2 does not begin until these gates pass; Phase 1 remains closed throughout.

## Phase 2: Split the Provider Boundary

### Objective

**[BUILD AFTER]** Make Solid contexts reflect the Phase 1 authority boundary and consume the stabilized Phase 1.5 engine contract without rewriting the board.

Phase 2 is a consumer migration. It may expose projected committed events, reaction outcomes, and effective values, but it may not reimplement policies, call the capability kernel, or infer location hooks.

### Work

- **[BUILD AFTER]** Introduce `MatchSessionProvider` and `PlayUiProvider`.
- **[BUILD AFTER]** Expose projected bootstrap identity/metadata through `MatchSessionContext`, never inferred from `MatchState`.
- **[BUILD AFTER]** Replace `YOU`/`OPPONENT` defaults with bootstrap identity while keeping view-relative labels explicit.
- **[BUILD AFTER]** Adapt selectors to read-only `SeatMatchState` and Phase 1.5-enriched `SeatTransactionFrame`; canonical types and operation services do not cross the provider boundary.
- **[BUILD AFTER]** Move replay/debug window helpers behind a development adapter.
- **[BUILD AFTER]** Move modal/menu/inspector/reservation/prompt state and the non-authoritative presented cursor into `PlayUiProvider`.
- **[BUILD AFTER]** Replace component `dispatch`/`setEngineState` with typed commands and route undo through the chosen engine intent.
- **[BUILD AFTER]** Expose effective projected values and committed power-history/debug data through explicit read models; components never evaluate `BLOCK_POWER_INCREASE` or other capabilities.
- **[BUILD AFTER]** Keep all card/location reaction dispatch inside the engine transaction. Providers publish results and never duplicate, delay, or manually invoke reactions.
- **[BUILD AFTER]** Use a compatibility facade only transiently and remove it within this phase.

### Exit Criteria

- **[BUILD AFTER]** `PlayBoard` cannot mutate engine state; engine/UI state have separate owners.
- **[BUILD AFTER]** Match metadata comes from projected bootstrap, not `MatchState` or defaults.
- **[BUILD AFTER]** Reset, stage, undo, end-turn, and replay export use the session API.
- **[BUILD AFTER]** No provider/component imports governed operations, the capability registry, effect evaluation, or the reaction dispatcher.
- **[BUILD AFTER]** Live and replay providers expose the same projected event context and effective-value read models.
- **[BUILD AFTER]** Production code does not install debug globals unconditionally.

## Phase 3a: Convert the Event Animator to Frames

### Objective

**[BUILD AFTER]** Convert event animation to committed frames using the stabilized Phase 1.5 event/envelope vocabulary before changing opening choreography/script context.

### Work

- **[BUILD AFTER]** Refactor `eventAnimator.ts` to consume `SeatTransactionFrame`; canonical frames never reach presentation.
- **[BUILD AFTER]** Remove `ctx.dispatch(event)` and derive transfers from `frame.before`/`frame.after`.
- **[BUILD AFTER]** Implement per-frame/transaction hooks; reveal cinematic receives complete frames through `beforeTransaction`, not side-channel lookahead.
- **[BUILD AFTER]** Make `PresentationDirector` the sole iterator/hook/animation-wait owner; runtime only publishes.
- **[BUILD AFTER]** Move DOM anchors off `PlayScriptCtx` into the presentation sink/host.
- **[BUILD AFTER]** Preserve:
  - `deriveCardTransfers`
  - transfer coverage assertions
  - rectangle capture
  - FLIP layout animation
  - hand-slot reservations
  - VFX/SFX choreography
- **[BUILD AFTER]** Consolidate redundant structural choreography with card-transfer derivation.
- **[BUILD AFTER]** Choreography selects VFX/SFX from the committed semantic event and Phase 1.5 envelope — keyed by `(event.type, reason, cause.effectKind)` with `cause.sourceId` as the effect-origin anchor — never from state-diff shape alone. State diffing supplies geometry (rects) only.
- **[BUILD AFTER]** Consume and assert the mandatory cause, owner, reason, zone, and lane context established by Phase 1.5. If presentation discovers a missing semantic fact, fix the engine envelope and replay contract; do not add a presentation-only inference or shadow event schema.
- **[BUILD AFTER]** Add exhaustive choreography disposition for the stabilized lifecycle vocabulary: animation, structural transfer only, intentional no-op, or unsupported-event failure in development.
- **[BUILD AFTER]** Treat a projection-only effective-value change as frame-state presentation, not as a committed gained/lost-power event. A move may animate the projected number transition, but its semantic cause remains the move.
- **[BUILD AFTER]** Implement generation-safe failure snap and queued-intent fast-forward.
- **[BUILD AFTER]** Enforce the no-submission hook capability and defer presentation-triggered commands.
- **[BUILD AFTER]** On provider disposal abort/invalidate/unsubscribe, prevent stale writes, and remount from latest projection.
- **[BUILD LAST]** Add explicit assertions that disposal/abort/fast-forward releases every timeline/frame reference.

### Exit Criteria

- **[BUILD AFTER]** Animator has no dispatch and receives DOM anchors through its host.
- **[BUILD AFTER]** Zero-duration and missing-anchor execution produce identical gameplay; reveal order stays correct.
- **[BUILD AFTER]** Transaction choreography uses hooks rather than lookahead.
- **[BUILD AFTER]** Every stabilized event/reason pair has an explicit choreography disposition; presentation does not infer play/move/create/return or power-gain semantics from before/after diffs.
- **[BUILD AFTER]** Live and replay frames select identical choreography for the same committed transaction.
- **[BUILD AFTER]** Queued fast-forward, error-snap races, unmount/remount, and deferred sink actions pass H1–H7 without stale cursor writes.
- **[BUILD LAST]** Memory-retention assertions prove old timelines are released.
- **[BUILD AFTER]** Card-transfer coverage continues to pass.

## Phase 3b: Separate Opening Cinematics and Retire Script Authority

### Objective

**[BUILD AFTER]** Separate opening presentation from gameplay commands after the Phase 1.5 reaction contract and Phase 3a frame consumer are proven.

### Work

- **[BUILD AFTER]** Separate opening cinematics from turn resolution:
  - opening scripts may manipulate presentation state
  - opening draws, location reveal, location reactions, remote staging, and all other gameplay events go through `MatchRuntime`, governed operations, and the committed reaction dispatcher
- **[BUILD AFTER]** Preserve the characterized ordering between location reveals, their nested reactions, card reveals, and turn transitions; scripts may pace already-committed frames but cannot invoke `evalEffect`, operation services, or reaction dispatch.
- **[BUILD AFTER]** Apply every Phase 0 script-step disposition.
- **[BUILD AFTER]** Reduce `PlayScriptCtx` to presentation-only state with no engine mutation or borrowed DOM registry.
- **[BUILD AFTER]** Remove reveal/advance slicing and its retained engine fields.

### Exit Criteria

- **[BUILD AFTER]** No script step originates/dispatches/slices/suppresses events; opening gameplay comes from runtime frames.
- **[BUILD AFTER]** Opening location reactions appear in the same canonical transaction order in live play and replay, with no script-owned reaction path.
- **[BUILD AFTER]** `PlayScriptCtx` has no engine setter/dispatch/cursor/DOM registry.
- **[BUILD AFTER]** Opening and turn presentation consume the same committed-frame model.

## Phase 4: Decompose `PlayBoard`

### Objective

**[BUILD AFTER]** Reduce orchestration density after the runtime API is stable.

### Work

Extract cohesive units without changing the visual design:

- **[BUILD AFTER]** `usePlayBoardViewModel`
  - projections
  - viewer-relative seat mapping
  - interaction availability
  - result labels
- **[BUILD AFTER]** `MatchHud`
  - portraits
  - energy
  - turn indicator
- **[BUILD AFTER]** `LaneGrid`
  - locations
  - lane cards
  - power breakdowns
- **[BUILD AFTER]** `MatchActionBar`
  - end turn
  - undo
  - exit
- **[BUILD AFTER]** `PlayOverlays`
  - inspector
  - pile viewer
  - result prompt
  - replay drawer
- **[BUILD AFTER]** `OpeningPresentation`
  - opening-only lifecycle

**[BUILD AFTER]** The parent `PlayBoard` composes these units through session/presentation adapters and never assembles a mutable script engine context.

### Exit Criteria

- **[BUILD AFTER]** `PlayBoard` is a composition root; replay is read-only; children receive explicit view data/commands; no module bypasses session API.

## Phase 5: Component and Layout Refactors

### Objective

**[BUILD LAST]** Remove local duplication and global DOM ownership after architectural seams exist.

**[BUILD LAST]** The four sub-refactors below land as four independent commits with focused verification.

### Card Rendering

- **[BUILD LAST]** Extract a shared card surface/face renderer used by:
  - `BoardCard`
  - `HandCard`
  - `PileViewer`
  - inspector content where appropriate
- **[BUILD LAST]** Spell card silhouette (designer spec 2026-07-18): the
  shared renderer supports a shape variant keyed by `cardType`. Spells
  render as the Snap-style lollipop — circle head at full card width,
  stem body at ~80% card width — inside the SAME 9:16 bounding box as a
  rectangular card, so slots, drag, transfers, and rect-capture animation
  are untouched (clip-path/layout only). The energy-cost badge sits on
  the circle's upper-left; spells still show no power stat.
- **[BUILD LAST]** Keep zone-specific interaction/visibility in small adapters, use one explicit presentation model, and bind refs through the host.

### Board Sizing

- **[BUILD LAST]** Move playgame sizing variables to the `/play` root, observe the board host, and choose one `--board-w`/`--board-h` owner.
- **[BUILD LAST]** Prefer CSS sizing/local properties and retain JS only for geometry CSS cannot express.
- **[SEAM]** Shiny-engine and non-playgame global variables remain out of scope.

### Lane Maps

- **[BUILD LAST]** Render/position lane maps declaratively and remove imperative DOM/measurement code.
- **[BUILD LAST]** Remove unused random shuffle behavior.

### VFX Host

- **[BUILD LAST]** Make card-effect registries instance-scoped so hosts cannot clear each other.
- **[BUILD LAST]** Move/inject playgame-specific zone-anchor types at the presentation host.

### Exit Criteria

- **[BUILD LAST]** Sizing is locally owned, lane maps are declarative, card faces are canonical, and two surfaces cannot corrupt registries.

## Phase 6: Mobile Interaction Rewrite

### Objective

**[BUILD LAST]** Make tap-card/tap-lane the reliable primary phone interaction, with drag as enhancement.

### Work

- **[BUILD LAST]** Implement the primary accessible interaction:
  - tap a card to select it
  - show legal lanes
  - tap a legal lane to stage it
  - expose equivalent keyboard/button semantics
  - provide an explicit way to cancel selection or return a staged card to hand
- **[BUILD LAST]** Replace HTML5 drag with optional pointer capture and instance-local selection/drag state.
- **[BUILD LAST]** For enhanced drag, support:
  - touch
  - pen
  - mouse
  - cancelled pointers
  - scrolling/gesture threshold
  - drag preview
  - valid-lane highlighting
  - dropping a staged card back into hand
- **[BUILD LAST]** Derive lane capacity from manifest constants.
- **[SEAM]** Keep runtime as final legality authority.

### Exit Criteria

- **[BUILD LAST]** Touch-only staging/undo and keyboard/tap play work without drag.
- **[BUILD LAST]** Claimed drag does not scroll, boards share no drag state, and invalid drops never mutate the match.

## Phase 7: CSS, Content, and Tooling Debt

### CSS

- **[BUILD LAST]** Scope playgame rules and remove leaking generic selectors.
- **[BUILD LAST]** Split the stylesheet by responsibility:
  - tokens and sizing
  - board layout
  - cards
  - HUD and controls
  - overlays and replay
  - VFX
- **[BUILD LAST]** Remove duplicate selectors/keyframes and verified-stale comments without redesigning visuals.

### Content and Manifest

- **[BUILD LAST]** Extend the Phase 1.5 card/location schema and generated-module gates for remaining content/tooling debt; do not postpone location folderization or its drift check to this phase.
- **[SEAM]** Track missing portrait assets separately.

### Debug and Setup

- **[BUILD LAST]** Put the debug picker behind development mode.
- **[BUILD LAST]** Keep it as a `MatchBootstrap` adapter reusing canonical validation/initialization.
- **[BUILD LAST]** Make debug randomization seedable and reproducible.

### Exit Criteria

- **[BUILD LAST]** CSS isolation, reproducible card checks, production/debug routing, and non-duplicated debug bootstrap gates pass.

## Deferred Live-Server Risks

**[SEAM]** These are future integration risks, not Phase 1 implementation scope; Phase 1 preserves only their named seams.

- **[DEFER] Authoritative clocks and lifecycle:** coordinator-owned deadlines, disconnect grace, abandonment, garbage collection, and authenticated deadline/epoch system intents.
- **[DEFER] Durable transaction storage and recovery:** atomic durable receipt/transaction/revision append, persisted checksums, multi-owner revision CAS, snapshot-plus-tail recovery, original-response recovery, overlap rejection, and injected pre/post-append tests.
- **[DEFER] Wire projection and replay secrecy:** opponent redaction, stable opaque handles, seat-authorized replay export, protocol/integrity fields, unknown-version fail-closed serialization, and leak tests.
- **[DEFER] Reconnect:** rejoin authentication, projected snapshot/tail resume, durable recent-intent disposition, and timeout/reconnect/player race coverage.
- **[DEFER] Horizontal ownership:** production routing, leases, fencing tokens, and multi-owner CAS.
- **[DEFER] Transport backpressure:** websocket byte/message bounds and slow/disconnected subscriber policy.
- **[DEFER] Rolling compatibility:** protocol/projection compatibility windows, deploy sequencing, and fail-closed wire fallback tests.
- **[DEFER] Server observability:** recovery/redaction/reconnect-size metrics and access-controlled per-match traces, with no sensitive labels in general metrics.
- **[DEFER] Receipt archival and operational retention:** receipt TTL/archive, terminal retention, snapshot cadence, transaction/trace retention, deletion, and compaction watermarks.
- **[DEFER] Collection integration:** collection ID migration, collection-to-match wiring, and ownership/possession validation remain separate from this runtime plan.

## Module Disposition

### Preserve — **[SEAM]**

- deterministic engine and reducer
- deterministic effect/projection semantics that satisfy the Phase 1.5 contracts
- replay logic
- `cardTransfers.ts`
- most of `choreography.ts`
- `HandRow`
- `LocationTile`
- `EnergyBadge`
- `HiddenHandIndicator`
- `TurnOrb`
- `ReplayDrawer`
- `useLaneHighlight`
- debug deck definitions

### Refactor — tiered by the phase work above

- **[BUILD NOW]** runtime-facing portions of `router.tsx`, entry adapters, `ClassicPlayScreen.tsx`, `flows.ts`, `runner.ts`, replay export, manifest constants, and debug state construction
- **[BUILD AFTER]** Phase 1.5 operation/effect/projection boundaries, mutation-event construction, committed reaction routing, power contribution representation, location manifest loading/generation, and existing built-ins
- **[BUILD AFTER]** `PlayGameContext.tsx`, `PlayBoard.tsx`, `eventAnimator.ts`, and presentation-facing portions of `view.ts`/script integration
- **[BUILD LAST]** `BoardCard.tsx`, `HandCard.tsx`, `LaneSlots.tsx`, `PlayerPortraitMenu.tsx`, `PileViewer.tsx`, `inspector.ts`, `VfxHost.tsx`, and `playgame.css`

### Replace Narrowly

- **[BUILD NOW]** authoritative gameplay portions of `script/actions.ts`
- **[BUILD LAST]** `BoardSizer.tsx`, `useLaneMaps.ts`, and `useDragDrop.ts`

**[SEAM]** “Replace narrowly” retains proven algorithms/behavior and does not authorize a broad screen or engine rewrite.

## Verification Matrix

**[SEAM]** Each implementation phase runs the smallest relevant subset plus its tier gate before merge.

### Runtime and Engine

```sh
npx vitest run services/playgame/engine
npx vitest run services/playgame/runtime
```

**[BUILD NOW]** The runtime suite includes bootstrap/freeze/deck validation, both-seat provenance/shared hands, five BUILD NOW properties, local commit invariants, RNG/no-time guards, and simultaneous local lock/reveal.

**[BUILD AFTER]** Phase 1.5 adds:

- governed-operation boundary tests for every effect-originated mutation family
- deterministic committed-reaction ordering, nested queue, and reaction-budget tests
- event-envelope completeness and live/replay fold parity
- all current card/location trigger characterization tests
- the complete Courthouse stored/effective-power matrix
- generated location parity, schema rejection, and content-only authoring proof

**[BUILD AFTER]** Add P-INTERLEAVE and H1–H7 when the director exists in Phases 2/3.

**[BUILD LAST]** Add transaction-bound, retention, and bounded-index tests during hardening.

**[DEFER]** Add durable receipt/CAS/recovery/snapshot-tail and exhaustive wire redaction/version tests with server adapters.

### Presentation

```sh
npx vitest run services/playgame/presentation
```

### Repository Gates

```sh
npm run cards:generate:check
npm run cards:validate
npm run locations:generate:check
npm run locations:validate
npm run build
npm run lint
```

**[BUILD AFTER]** Phase 1.5 introduces the two location commands and makes all four content checks mandatory before its final checkpoint merges.

**[BUILD NOW]** Record existing unrelated lint/build failures and prove touched scope adds none; never weaken gates to hide them.

### Browser Proofs

**[BUILD LAST]** For each applicable UI vertical slice:

- load `/play`
- start a deterministic debug match and confirm both participants and selected deck identities come from its bootstrap
- enter once from Conquest and once from Ladder; confirm the mode is retained without changing gameplay rules
- stage and undo a card
- complete a no-card turn
- complete a multi-reveal turn
- inspect piles and cards
- export and replay the match
- repeat at a phone viewport
- repeat with animation disabled

## Commit Strategy

**[SEAM]** Keep commits reviewable and reversible:

1. **[BUILD NOW — COMPLETE]** Phase 0 characterization, properties, decisions, and baseline.
2. **[BUILD NOW — COMPLETE]** Phase 1 bootstrap/session/runtime authority, transactions, simultaneous scheduling, shared opening/AI fold, parity proof, and old-authority removal.
3. **[BUILD NOW — COMPLETE]** Phase 1.15 generated cross-language structural protocol, shared TypeScript/Rust fixtures, and live boundary validation.
4. **[BUILD AFTER]** Phase 1.5 contracts and characterization: producer/trigger inventory, operation/reaction semantics, event-envelope fields, ordering, architectural test skeletons.
5. **[BUILD AFTER]** Phase 1.5 location folders, schema/generator/check commands, complete location migration, and generated parity proof.
6. **[BUILD AFTER]** Phase 1.5 governed power operation, contribution/provenance representation, reusable Courthouse capability, and acceptance matrix.
7. **[BUILD AFTER]** Phase 1.5 committed lifecycle reaction dispatcher and migration of play/reveal/move/destroy/banish/create/return hooks.
8. **[BUILD AFTER]** Phase 1.5 remaining operation/built-in conformance, old manual-trigger deletion, architectural enforcement, and full exit gates.
9. **[BUILD AFTER]** Phase 2 provider split and facade removal.
10. **[BUILD AFTER]** Phase 3a animator frame conversion and DOM-ref relocation.
11. **[BUILD AFTER]** Phase 3b opening separation, script reduction, and slicing removal.
12. **[BUILD AFTER]** Phase 4 `PlayBoard` decomposition.
13. **[BUILD LAST]** Phase 5 shared card rendering.
14. **[BUILD LAST]** Phase 5 board sizing.
15. **[BUILD LAST]** Phase 5 declarative lane maps.
16. **[BUILD LAST]** Phase 5 instance-scoped VFX.
17. **[BUILD LAST]** Phase 6 tap-first mobile/pointer enhancement.
18. **[BUILD LAST]** Phase 7 CSS/content/tooling cleanup.

**[SEAM]** Do not combine Phase 1.5 engine behavior with Phase 2/3 provider or presentation migration. Do not combine component extraction and CSS cleanup with either.

## Stop Conditions

Stop and reassess rather than layering patches if:

- **[BUILD NOW]** runtime construction bypasses validated frozen bootstrap/decks, metadata enters `MatchState`, AI mints normal pool cards, runtime needs DOM, or two authorities exist
- **[SEAM]** normal UI APIs can receive canonical types rather than projected types
- **[BUILD NOW]** local intents bypass FIFO/dequeue validation, trust caller ownership, or commit outside the non-yielding local boundary
- **[DEFER]** when server work begins, any commit bypasses durable receipt/CAS or network timing becomes an unstated tiebreaker
- **[BUILD NOW]** first local seat lock resolves immediately, gameplay consumes cosmetic RNG/time, or live/headless parity is not exact
- **[BUILD AFTER]** a Phase 1.5 operation has both governed and ungoverned producer paths, or an effect/built-in constructs/applies its mutation event directly
- **[BUILD AFTER]** a reducer contains a content-policy/definition-ID branch, a normal location requires central engine edits, or content can execute arbitrary callbacks
- **[BUILD AFTER]** reaction dispatch remains scattered across producers, one event fires a hook twice, replay fires reactions, or staging/undo produces a play reaction
- **[BUILD AFTER]** an event/envelope lacks the historical facts needed after a card moves or disappears and a consumer compensates with post-state guessing
- **[BUILD AFTER]** a continuous projection emits a mutation/reaction, or stored contributions must be erased to suppress their effective value
- **[BUILD AFTER]** Phase 2 begins before Phase 1.5 exits, a provider imports the capability/operation kernel, or Phase 3 invents presentation-only semantic fields
- **[BUILD AFTER]** presentation still dispatches, sinks submit reentrantly, stale generations mutate cursors, or a compatibility facade becomes permanent
- **[SEAM]** engine semantics change only to animate an event
- **[BUILD LAST]** frame retention is unbounded, frames copy canonical history, or a full-log gameplay scan remains after the hardening tier
- **[DEFER]** durable recovery cannot fold genesis/snapshot plus tail when persistence is implemented

## Review Decisions and Remaining Questions

Decided:

- **[BUILD NOW]** `MatchRuntime` becomes the sole live authority and commits complete local transactions immediately.
- **[SEAM]** `PlayUiContext` paces read-only frames; `PresentationDirector`, not runtime, owns frame iteration/hooks/waits.
- **[BUILD AFTER]** Implement transaction/per-frame hooks, generation-safe snaps, reset/unmount invalidation, queued fast-forward, and sink deferral.
- **[BUILD NOW]** Live/replay use one framed-event fold.
- **[SEAM]** Bootstrap/genesis plus transaction records define the future durable canonical shape; snapshots are caches.
- **[DEFER]** Durable receipt/transaction/revision/checksum atomicity and CAS wait for server storage.
- **[BUILD NOW]** Local intent sources share one FIFO with dequeue validation, in-memory retry idempotency, at-most-once commit, and typed rejection.
- **[BUILD NOW]** Every session starts from validated frozen bootstrap; reducer inputs are mechanical only.
- **[SEAM]** Canonical types remain internal behind seat-projection APIs.
- **[DEFER]** Exhaustive redaction/fail-closed wire behavior waits for multiplayer transport.
- **[BUILD NOW]** Both-seat provenance, hand-based AI, `startingHandSize`, hard debug failure, and variants are fixed locally.
- **[BUILD NOW]** Local replay bundles bootstrap/genesis/in-memory transactions without overlap.
- **[BUILD NOW]** Turns use simultaneous local stage/lock/reveal with Phase 0 order semantics.
- **[DEFER]** Deadline readiness waits for authoritative clocks.
- **[SEAM]** Gameplay RNG namespaces and no-time boundaries are fixed now.
- **[BUILD LAST]** Log-free state, retention bounds, and tracked gameplay indexes are final hardening.
- **[DEFER]** Collection possession wiring, clocks/reconnect, fencing, transport backpressure, wire compatibility, and retention operations remain deferred.
- **[BUILD NOW]** Script-originated gameplay, including location reveal/effects, moves behind runtime resolution.
- **[BUILD AFTER]** Phase 1.5 precedes Phase 2; it strengthens engine extension seams without reopening Phase 1 authority.
- **[SEAM]** Cards and locations remain distinct definitions but share typed rule-source abilities; locations become folder-authored neutral-deck content.
- **[BUILD AFTER]** Governed operations are the exclusive normal mutation-event producers; reducers stay policy-blind and built-ins only orchestrate operations.
- **[BUILD AFTER]** One committed-event dispatcher owns reactions; friendly named location hooks lower to typed event subscriptions.
- **[SEAM]** Continuous projection changes do not become mutation events or gained/lost-power hooks.
- **[BUILD AFTER]** Courthouse suppresses prior/hand/ongoing positive contributions without erasing them, rejects new positive mutations while present, preserves reductions, and restores only previously stored contributions after leaving.
- **[BUILD LAST]** Tap-card/tap-lane is primary phone interaction; pointer drag is an enhancement.
- **[SEAM]** Phase 3 stays split and waits for the Phase 1.5 event contract; Phase 5 has four commits.

Phase 1.5 must answer with evidence:

1. **[BUILD AFTER]** Does every effect-originated mutation family have exactly one governed producer path and a tested policy/replacement/adjustment order?
2. **[BUILD AFTER]** Does the committed envelope retain enough historical context to distinguish play, move, create, return, destroy, and banish after the state changes?
3. **[BUILD AFTER]** Does every existing card/location reaction preserve characterized order, including nested reactions and opening location reveal?
4. **[BUILD AFTER]** Can every current ordinary location be represented in one folder without evaluator/resolver definition-ID branches?
5. **[BUILD AFTER]** Can power contributions distinguish prior positive gains from later reductions so Courthouse suppression/restoration is exact?
6. **[BUILD AFTER]** Do live execution and replay fold the same committed events while reactions run only during command resolution?

## Approval Decision

**[SEAM]** Phase 0 and Phase 1 are implemented and closed. Before Phase 1.5 implementation, reviewers explicitly approve or reject:

- the five-checkpoint Phase 1.5 delivery order before any Phase 2/3 work
- folder-authored locations with generated deterministic output and no arbitrary callbacks
- governed operations as exclusive normal mutation-event producers
- a single committed-event reaction dispatcher with the named hook meanings and deterministic nested ordering
- stored-versus-effective modifier separation and the exact Courthouse acceptance semantics
- enriched canonical event envelopes as an engine/replay contract consumed by later presentation
- the rule that missing Phase 3 semantic context returns to Phase 1.5 rather than being inferred in presentation

**[SEAM]** If accepted, implementation resumes at Phase 1.5 checkpoint 1 and proceeds in dependency order. DEFER items do not enter implementation commits.
