# Playgame Effect-Resolution Timeline and Player Wire Contract

Status: ready for implementation  
Date: 2026-07-21  
Compatibility policy: clean replacement; no legacy protocol, replay, fixture,
adapter, fallback read, or dual-write path

## Authority and scope

This specification governs the next playgame architecture slice:

- deterministic effect invocation and target-resolution evidence;
- the canonical frame envelope stored in authoritative match history;
- canonical replay and reconciliation of state-changing and state-preserving
  frames;
- seat-safe projection of those frames;
- atomic player presentation blocks;
- player command receipts, revision domains, reconnect, and resync contracts;
- developer replay presentation of source, candidates, affected targets,
  blockers, and outcomes;
- TypeScript/Rust protocol conformance for the resulting data model.

It supersedes:

- the one-event-only `FramedEvent` shape in Phase 1.1;
- the player-wire model section of
  `docs/playgame-deterministic-server-authority-plan.md`;
- the mixed authority/player `ProtocolMessage` union in protocol version 1.

The remaining deterministic-authority, transactional-kernel, presentation,
and authority-independent testing invariants continue to apply unless this
specification explicitly replaces one of their types.

## Executive decision

CruelDeal will have one ordered canonical match timeline. It will not add a
second effect log beside the event/replay history.

Every committed frame represents one deterministic resolution moment and may
contain:

1. one mechanical event;
2. one effect-resolution trace entry; or
3. both.

At least one must be present.

An affected target normally shares a frame with the mechanical event that
changed it. A blocked, invalidated, or legal-no-change target receives a
state-preserving frame with a trace entry and no mechanical event. Effect
invocation start and completion also receive state-preserving frames.

The engine and kernel produce this truth. Replay, player projection,
presentation, analytics, and debug UI consume it; none of them reconstructs
targeting or blocking from card text or final state.

The player transport sends a complete committed presentation block as one
message. It never streams individual resolution frames. Interaction remains
locked until the client presents or fast-forwards the complete block and
adopts its authoritative post-state.

## Product goal

From one committed match record the system must be able to answer, for every
effect execution:

- What invoked the effect?
- Which concrete ability or authored rule executed?
- Was this a natural invocation, a repeat, or a nested invocation?
- Which targets were selected?
- In what deterministic order were they processed?
- Which targets were affected?
- Which targets were blocked, invalidated, or unchanged?
- What blocked an attempted operation and why?
- Which mechanical event, if any, committed for each attempt?
- What did each player have permission to see?
- What state should the client display after every visible frame?

The same bootstrap, ruleset, accepted commands, and RNG sequence must regenerate
the same frames, invocation identities, target order, outcomes, mutations,
state hashes, and final match state.

## Core problem

The existing canonical record stores only successful committed mechanical
events. `EffectRef.sourceId` explains the cause of an emitted event, but it
does not represent an effect invocation, its complete target selection, or an
attempt that a policy prevented.

Blocked governed operations are currently normal no-ops. Because they emit no
mechanical event, the canonical record loses all evidence that:

- the target was selected;
- a destroy, power, movement, or other operation was attempted;
- a card, location, or system rule blocked it;
- later targets continued resolving in deterministic order.

This makes the engine mechanically deterministic but semantically incomplete
for replay, presentation, explainability, remote clients, and cross-language
verification. Repairing that information in presentation would create a
second rules engine and would still be unable to recover blocked attempts.

## Non-goals

This phase does not:

- change card or location balance;
- change end-turn choreography or animation timing;
- require every trace frame to produce a visible animation or delay;
- let card content author arbitrary replay strings or client instructions;
- make the browser apply gameplay rules or infer effect outcomes;
- expose canonical IDs, RNG state, hidden deck order, or authority ledgers to
  player clients;
- build the production Rust match server, matchmaking, or durable storage;
- retain protocol version 1 or adapt old replay bundles.

## Terminology

### Frame

A match-local, deterministic, monotonically increasing simulation coordinate.
It is not wall-clock time, a browser animation frame, a transaction index, or
a replay cursor.

### Mechanical event

A past-tense fact accepted by the reducer, such as `CARD_DESTROYED`,
`CARD_POWER_CHANGED`, or `TURN_STARTED`.

### Effect invocation

One execution of one concrete authored or system ability. Repeats create new
invocations even when the source and ability are the same.

### Candidate target

An entity selected when an invocation evaluates its selector. Candidate order
is immutable for that invocation.

### Target attempt

One governed operation applied to one candidate in deterministic order. An
effect that requests two different operations against the same card has two
target attempts.

### Affected target

A target attempt whose governed operation committed a mechanical event.
`affected` is derived from target outcomes; it is not a second stored list.

### Blocked target

A target attempt actively prevented by a policy, replacement, immunity, or
other rule source.

### Invalidated target

A candidate selected at invocation start that no longer satisfies the
operation preconditions when its turn to resolve arrives.

### No-change target

A legal target attempt that required no state mutation. This is distinct from
being blocked or invalidated.

The term `destination` remains reserved for movement and zone destinations.
Target selection uses `candidates` and `target`.

## Canonical types

The exact names may move between files during implementation, but the shape
and invariants are normative.

### Identities

```ts
type EffectInvocationId = string & EffectInvocationIdBrand;
type EffectAttemptId = string & EffectAttemptIdBrand;

interface AbilityRef {
  readonly kind:
    | 'ON_REVEAL'
    | 'ONGOING'
    | 'TRIGGERED'
    | 'LOCATION'
    | 'SPELL'
    | 'SYSTEM';
  readonly ruleId: string;
  readonly ruleIndex: number;
}
```

Invocation and attempt IDs are deterministic transaction-local identities.
They must derive from authoritative transaction/work order, never UUIDs,
wall-clock time, process identity, or object identity.

Recommended construction:

```text
<transactionId>:invoke:<invocationOrdinal>
<invocationId>:attempt:<attemptOrdinal>
```

An `AbilityRef` identifies authored rule structure, not localized card text.
Changing display copy must not change deterministic identity.

### Entity references

```ts
type CanonicalEntityRef =
  | { readonly kind: 'CARD'; readonly cardId: CardId }
  | { readonly kind: 'LOCATION'; readonly locationId: LocationCardInstanceId }
  | { readonly kind: 'LANE'; readonly laneId: LaneId }
  | { readonly kind: 'PLAYER'; readonly owner: Owner }
  | { readonly kind: 'ZONE'; readonly owner: Owner | null; readonly zone: string }
  | { readonly kind: 'SYSTEM'; readonly systemId: string };
```

References are discriminated. A generic untyped `sourceId: string` is not
sufficient for new trace records.

### Outcome vocabulary

```ts
type EffectTargetResult =
  | 'AFFECTED'
  | 'BLOCKED'
  | 'INVALIDATED'
  | 'NO_CHANGE';

type EffectOutcomeReason =
  | 'CANNOT_BE_DESTROYED'
  | 'CANNOT_BE_MOVED'
  | 'CANNOT_GAIN_POWER'
  | 'CANNOT_LOSE_POWER'
  | 'CANNOT_BE_REVEALED'
  | 'LANE_FULL'
  | 'TARGET_LEFT_ZONE'
  | 'TARGET_NO_LONGER_MATCHES'
  | 'SOURCE_INACTIVE'
  | 'ALREADY_SATISFIED'
  | 'EMPTY_SELECTION'
  | 'RULE_REPLACED_OPERATION'
  | 'OTHER_RULE';
```

The implementation may extend this closed enum only for a concrete engine
capability. It may not put presentation prose in the canonical reason field.
Human-readable text is derived by the client/debug presenter.

### Effect trace entries

```ts
interface EffectInvocationStarted {
  readonly kind: 'EFFECT_INVOCATION_STARTED';
  readonly invocationId: EffectInvocationId;
  readonly parentInvocationId: EffectInvocationId | null;
  readonly source: CanonicalEntityRef;
  readonly ability: AbilityRef;
  readonly invocationReason:
    | 'NATURAL'
    | 'RETRIGGER'
    | 'REACTION'
    | 'SCHEDULED'
    | 'SYSTEM';
  readonly depth: number;
  readonly candidates: readonly CanonicalEntityRef[];
}

interface EffectTargetResolved {
  readonly kind: 'EFFECT_TARGET_RESOLVED';
  readonly invocationId: EffectInvocationId;
  readonly attemptId: EffectAttemptId;
  readonly attemptOrdinal: number;
  readonly operation: string;
  readonly target: CanonicalEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly CanonicalEntityRef[];
  readonly reason: EffectOutcomeReason | null;
}

interface EffectInvocationCompleted {
  readonly kind: 'EFFECT_INVOCATION_COMPLETED';
  readonly invocationId: EffectInvocationId;
  readonly attempted: number;
  readonly affected: number;
  readonly blocked: number;
  readonly invalidated: number;
  readonly unchanged: number;
}

type EffectTraceEntry =
  | EffectInvocationStarted
  | EffectTargetResolved
  | EffectInvocationCompleted;
```

The completion counters are checksums over earlier target outcomes, not an
alternative target list. A consumer derives affected or blocked entity arrays
from `EFFECT_TARGET_RESOLVED` entries.

### Canonical frame

```ts
interface CanonicalFrame {
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: MatchEvent | null;
  readonly effect: EffectTraceEntry | null;
}
```

Required invariants:

1. `event` and `effect` cannot both be null.
2. Every frame advances the canonical timeline exactly once.
3. A frame with `event: null` changes no mechanical state except the state's
   current timeline coordinate.
4. `AFFECTED` requires a non-null mechanical event in the same frame.
5. `BLOCKED`, `INVALIDATED`, and `NO_CHANGE` require `event: null`.
6. Ordinary system/game events may have `effect: null`.
7. Invocation start and completion frames have `event: null`.
8. A frame has at most one mechanical event and at most one trace entry. The
   existing one-event animation granularity therefore remains intact.
9. A reaction or nested effect receives its own invocation and frames; it is
   never folded invisibly into its parent's outcome.

`FramedEvent` is replaced by `CanonicalFrame`. The implementation must not keep
both as canonical record shapes.

## Selection and resolution law

### Candidate snapshot

An effect evaluates its selector once when its invocation begins. The ordered
candidate list is stored on `EFFECT_INVOCATION_STARTED` and is immutable for
that invocation.

The system does not rerun the selector after every target. This aligns with the
transactional-kernel contract that selector targets are immutable for one
effect execution.

### Per-target revalidation

Before processing each candidate, the governed operation revalidates the
candidate against current candidate state:

- if it is still legal and commits a fact: `AFFECTED`;
- if a policy prevents the operation: `BLOCKED`;
- if it left the required zone or stopped qualifying: `INVALIDATED`;
- if the operation is legal but already satisfied: `NO_CHANGE`.

Processing continues in the original candidate order unless the complete
kernel transaction fails an invariant or resolution budget. A blocked target
does not abort later targets.

### Repeats and nesting

Each actual execution receives a unique invocation ID.

For Wong-like repetition, the same source and ability produce multiple sibling
or parent-linked invocations. For Jubilee/Thor-like nesting, the pulled card's
On Reveal invocation references the invocation that caused the deploy/reveal.
The trace therefore records depth-first order without relying on `sourceId`
alone.

`parentInvocationId` must reference an invocation that started earlier in the
same committed transaction. Invocation completion must be properly nested.

### Empty selection

An invocation with no candidates still produces start and completion frames.
It does not synthesize a fake target. The completion counts are zero. The
invocation start may carry the semantic reason `EMPTY_SELECTION` only if the
final chosen shape adds a start-level reason field; it must not invent a target
outcome.

## Kernel integration

The kernel remains the exclusive rules-control plane.

The kernel work loop must produce an ephemeral ordered resolution transcript
alongside committed mechanical transitions. The runtime frames both together
once, after the complete all-or-nothing kernel transaction succeeds.

The transcript is not a second persisted history. It exists only long enough
for the authoritative runtime to construct `CanonicalFrame[]`.

Required kernel responsibilities:

- allocate deterministic invocation and attempt ordinals;
- capture the immutable candidate list;
- preserve parent/child invocation relationships;
- report governed-operation outcomes, blocker sources, and stable reasons;
- associate each successful attempt with its committed mechanical event;
- emit start and completion evidence even for zero-target invocations;
- discard the complete candidate transcript if the kernel transaction fails.

Required runtime responsibilities:

- assign transaction identity and canonical frame numbers;
- convert the successful kernel transcript plus transitions into one ordered
  `CanonicalFrame[]` sequence;
- commit frames, revision, state, and RNG advancement atomically;
- persist canonical frames exactly once;
- materialize short-lived before/after transitions for presentation;
- release materialized states after presentation.

Content definitions may select targets and request semantic work. They may not
construct trace records, choose invocation IDs, claim an outcome, identify a
blocker, or emit player-facing replay prose.

## Canonical replay and reconciliation

The canonical match record stores `CanonicalFrame[]`, not separate event and
effect collections.

```ts
interface CommittedTransactionRecord {
  readonly transactionId: string;
  readonly matchId: string;
  readonly baseRevision: MatchRevision;
  readonly revision: MatchRevision;
  readonly intent: CommittedIntentIdentity;
  readonly frames: readonly CanonicalFrame[];
  readonly rngDrawsBefore: number;
  readonly rngDrawsAfter: number;
}
```

Replay folding applies the optional mechanical event and always advances the
timeline coordinate. State-preserving trace frames are first-class replay
steps. They are not removed merely because the reducer state is otherwise
equal.

Reconciliation regenerates and compares:

- exact frame count and continuity;
- scope per frame;
- mechanical event or null;
- effect trace or null;
- invocation and attempt identities;
- candidate order;
- parent/child nesting;
- target results, blockers, and reasons;
- RNG coordinates;
- state after every frame;
- final mechanical state.

A mismatch in trace data is a reconciliation failure even if the final
mechanical state happens to match.

## Protocol separation

The existing protocol version 1 mixes authority-only and player-safe payloads.
It is replaced by two explicit schema families.

### Authority record protocol

Used for persistence, reconciliation, trusted workers, and TypeScript/Rust
engine conformance. It may contain canonical IDs, bootstrap data, accepted
intent identity, canonical frames, and RNG coordinates. It never crosses the
normal player client boundary.

### Player wire protocol

Used by `MatchClient` and future remote transports. It contains only
authenticated seat-bound commands, receipts, seat-safe snapshots, atomic
presentation blocks, and resync responses.

No `ProtocolMessage` union may accept both authority and player payload kinds.
No player-wire validator imports canonical `MatchState`, canonical IDs,
`Manifest`, canonical bootstrap, or RNG types.

Because CruelDeal has no backward-compatibility requirement, implementation
must delete the protocol-v1 schema, fixtures, validators, and dual message
union when the new schema families cut over.

## One timeline, two representations

The full canonical frame and limited player frame are not two gameplay
systems. They are an authority object and its pure read projection.

```text
Canonical committed transaction
  ├─ CanonicalFrame[]                     authoritative truth
  ├─ project for P0 → SeatPresentationBlock(P0)
  └─ project for P1 → SeatPresentationBlock(P1)
```

The canonical transaction is the only committed transaction. A seat
presentation block is deliberately not named `PlayerTransaction`: it is a
delivery and presentation artifact derived from one canonical transaction.

The canonical frame is the full frame:

- canonical entity identities;
- complete effect trace;
- complete mechanical event;
- authoritative scope and frame number;
- persistence/replay/reconciliation authority.

The seat presentation frame is the limited frame:

- the same canonical frame number;
- seat-scoped opaque references;
- only information visible or safely revealable to that seat;
- authoritative seat-visible after-state;
- no gameplay authority.

Non-negotiable rules:

1. There is one frame counter, owned by canonical match authority.
2. A seat frame never invents, renumbers, or reorders a canonical frame.
3. Seat projection is a pure exhaustive function of canonical before/frame/
   after state plus viewer seat and display catalog.
4. A seat frame cannot be accepted back into the authority as gameplay input.
5. A seat presentation block is never folded to reconstruct canonical state.
6. The canonical record never stores seat frames as a second history.
7. The authority may cache an immutable serialized seat block for reliable
   delivery and exact duplicate redelivery; that cache is not match truth.
8. Private planning edits are not canonical transactions and do not allocate
   canonical frames.

Projection may omit a canonical frame only when that frame exposes no safe
event/trace information and does not change the seat-visible projection. Frame
number gaps are therefore allowed. If a hidden authority frame changes
seat-visible state but its cause cannot be exposed, projection retains a
limited frame with `event: null`, `effect: null`, and the new safe `after`
state. It never asks the client to infer the hidden operation.

The distinction answers two separate questions:

- `CanonicalFrame`: what actually happened according to the engine?
- `SeatPresentationFrame`: what may this player display at that canonical
  moment?

Neither representation competes with the transaction boundary. A transaction
is the all-or-nothing commit and publication envelope; frames are the ordered
resolution moments inside it. Temporal turn scopes label frames independently,
so a committed transaction may legally cross a turn boundary.

## Seat-safe references

```ts
type SeatEntityRef =
  | { readonly kind: 'CARD'; readonly token: SeatCardToken }
  | { readonly kind: 'LOCATION'; readonly token: SeatLocationToken }
  | { readonly kind: 'LANE'; readonly laneId: LaneId }
  | { readonly kind: 'PLAYER'; readonly owner: Owner }
  | { readonly kind: 'ZONE'; readonly owner: Owner | null; readonly zone: string }
  | { readonly kind: 'SYSTEM'; readonly systemId: string }
  | { readonly kind: 'HIDDEN'; readonly category: 'CARD' | 'LOCATION' | 'RULE' };
```

Projection rules:

- canonical IDs never cross the player boundary;
- stable seat-scoped tokens are used for visible or positionally observable
  entities;
- the same canonical entity receives different tokens for different seats;
- hidden identity is omitted even if a stable board object remains targetable;
- a hidden blocker that cannot safely be correlated projects as `HIDDEN` plus
  a safe outcome reason;
- projection must retain that an attempt was blocked even when blocker
  identity is redacted;
- projection may remove authority-only frames, so player-visible canonical
  frame numbers can contain gaps;
- projected frame order must remain strictly increasing.

### Default-deny projection construction

Projection is an explicit allowlist, not a redaction pass.

Every `SeatPresentationFrame`, `SeatAnimationEvent`, `SeatEffectTraceEntry`,
`SeatEntityRef`, and `SeatVisibleMatchState` is constructed field-by-field from
approved values. Projectors use exhaustive discriminated-union switches and
return fresh player DTOs.

The following are forbidden at the authority/player boundary:

- spreading a canonical frame, event, trace, entity, state, bootstrap, or
  transaction into a player DTO;
- copying a canonical object and deleting or omitting secret fields;
- generic `pick`, `omit`, serializer-replacer, or key-name blacklist helpers;
- casting a canonical object to a seat-safe type;
- returning a canonical nested object by reference because its current fields
  happen to appear safe;
- treating schema validation as a sanitizer after over-copying data.

The required construction pattern is:

```ts
function projectFrameForSeat(
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
): SeatPresentationFrame | null {
  const event = projectEventForSeat(transition, viewerSeat);
  const effect = projectEffectForSeat(transition, viewerSeat);
  const after = projectMatchStateForSeat(
    transition.after,
    viewerSeat,
  );

  if (event === null && effect === null
      && seatStatesEqual(
        projectMatchStateForSeat(transition.before, viewerSeat),
        after,
      )) {
    return null;
  }

  return {
    index: transition.index,
    frame: transition.frame,
    scope: {
      turn: transition.scope.turn,
      phase: transition.scope.phase,
    },
    event,
    effect,
    after,
  };
}
```

This example is normative in construction style, not exact function naming.
Each nested projector follows the same field-by-field rule. An exhaustive
`switch` ends in `assertNever`; adding a new canonical event, trace variant,
entity kind, or sensitive field must fail compilation or a projection test
until an explicit player representation is chosen.

The player-wire schema validates the already-projected DTO. It is a final
contract gate, not the mechanism that removes secrets.

Architecture and leakage tests must:

- reject canonical-object spreads in player projection modules;
- inject recognizable secret canaries into canonical IDs, RNG state, deck
  order, pending effects, rule internals, and authority metadata;
- project every event, trace, entity, snapshot, and block variant for both
  seats;
- prove that no canary or canonical key appears anywhere in serialized player
  output;
- prove that adding an unhandled canonical union member makes the projector
  fail rather than silently forwarding it.

## Player presentation frame

The client must not apply a second gameplay reducer to reconstruct intermediate
states. Each visible frame therefore carries its authoritative seat-safe
after-state.

```ts
interface SeatPresentationFrame {
  readonly index: number;
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: SeatAnimationEvent | null;
  readonly effect: SeatEffectTraceEntry | null;
  readonly after: SeatVisibleMatchState;
}
```

The frame's `before` state is:

- the block's `preState` for index zero; or
- the preceding visible frame's `after` state.

This avoids duplicating every before-state while preserving a complete,
transport-independent presentation timeline. Repeated JSON state compresses
well; correctness is preferred over a client rules reducer. A later measured
optimization may replace full after-states with a generic validated patch, but
only if it retains identical authority and test coverage.

## Atomic presentation block

```ts
interface SeatPresentationBlock {
  readonly version: 2;
  readonly transactionId: string;
  readonly matchId: string;
  readonly viewerSeat: Seat;
  readonly basePublicRevision: PublicRevision;
  readonly publicRevision: PublicRevision;
  readonly firstFrame: Frame;
  readonly lastFrame: Frame;
  readonly preState: SeatVisibleMatchState;
  readonly frames: readonly SeatPresentationFrame[];
  readonly postState: SeatVisibleMatchState;
  readonly postStateHash: string;
}
```

Required behavior:

1. The authority completes and commits the entire transaction before
   publishing the block.
2. One committed transaction is delivered as one complete block.
3. There is no normal player API for subscribing to individual frames.
4. The client validates the complete block before starting presentation.
5. Interaction locks before the first frame is presented.
6. Presentation walks the supplied frames and never mutates gameplay truth.
7. Animation failure, missing anchors, timeout, backgrounding, or user
   fast-forward adopts `postState` and releases the lock.
8. Successful presentation also adopts `postState`; the last visible frame's
   `after` must equal it.
9. The next command cannot be submitted until the block is closed.
10. A gap in public revision triggers resync rather than partial playback.

Once a transaction is committed and presentation begins, the complete block
may include identities that become visible in later presentation frames. A
modified client could inspect those facts slightly early, but cannot submit a
command during the locked atomic block. Pre-commit hidden information remains
strictly secret.

## Revision domains

A single revision cannot correctly represent both public match commits and
private per-seat staging edits.

```ts
type PublicRevision = number;
type PlanRevision = number;
```

- `publicRevision` advances only when an authoritative public transaction
  commits.
- each seat owns a private `planRevision` that advances for stage, unstage,
  undo, and lock-state changes visible only to that seat;
- one player's private edits do not stale the other player's commands;
- opponent plan revisions and edit activity never cross the player boundary;
- a command that changes only private planning returns a private receipt and
  no public presentation block;
- the turn-resolution commit consumes the locked plans and advances the public
  revision once.

## Authenticated command and receipt contract

Authentication binds a connection/session to one match and one seat. A player
command does not choose or override its authoritative seat.

```ts
interface SeatCommandEnvelope {
  readonly version: 2;
  readonly commandId: string;
  readonly matchId: string;
  readonly expectedPublicRevision: PublicRevision;
  readonly expectedPlanRevision: PlanRevision;
  readonly command: SeatCommand;
}
```

`SeatCommand` uses only opaque seat tokens and public lane/player values. It
never contains canonical card or location IDs.

Every command is idempotent by authenticated
`{ matchId, seat, commandId }`. Duplicate delivery returns the exact original
receipt and never reapplies a plan edit, consumes RNG, resolves effects, or
publishes another block.

Receipt outcomes are a closed union:

- accepted private plan change;
- accepted lock/waiting state;
- accepted public commit with the resulting presentation block identity;
- duplicate with the exact original receipt;
- illegal command with stable code;
- stale private revision;
- stale public revision / resync required;
- terminal match.

Free-form diagnostic messages may accompany a receipt but are not used for
client control flow.

## Snapshot, reconnect, and resync

A seat snapshot contains:

- protocol/engine/ruleset/content version agreement;
- authenticated match and viewer-seat identity;
- current public revision and frame;
- that seat's current private plan revision and private visible plan;
- current seat-safe visible state;
- interaction status (`PLANNING`, `WAITING`, `PRESENTING`, or `TERMINAL`).

Reconnect policy:

- if no unpresented committed block is retained for the seat, adopt the latest
  snapshot and do not replay missed cosmetic animation;
- if the authority retains one complete unacknowledged block and the client is
  exactly at its base revision, it may redeliver that complete block;
- never resume in the middle of a presentation block;
- never send a suffix beginning at an arbitrary frame;
- a checksum, revision, or version mismatch returns a fresh snapshot;
- reconnect does not change authoritative gameplay state.

## Replay and developer UI

The developer replay inspector reads the same canonical frames used for
reconciliation. It does not maintain a replay-only effect model.

For each frame it displays, when applicable:

- source and ability;
- invocation and parent invocation;
- candidate count and ordered candidates on invocation start;
- target, attempted operation, and target ordinal;
- `AFFECTED`, `BLOCKED`, `INVALIDATED`, or `NO_CHANGE`;
- blocker identity or redacted blocker category;
- stable reason rendered as human-readable text;
- the mechanical event, if any;
- exact canonical or seat-projected JSON in the existing JSON block.

Example summaries:

```text
Killmonger began On Reveal: 5 targets selected.
Killmonger attempted DESTROY on Drone: affected.
Killmonger attempted DESTROY on Guard: blocked by Armor
  (cannot be destroyed).
Killmonger completed: 4 affected, 1 blocked.
```

Human-readable summaries are derived at display time. They are never stored as
canonical truth and never supplied by card content.

Normal player clients do not gain developer replay authority. A future
player-facing combat log may consume seat-projected trace entries through a
separately authorized read model.

## Presentation compatibility

Existing animation choreography is protected:

- `SeatAnimationEvent` remains the only input to the existing event animator;
- trace-only frames produce no animation or delay by default;
- a frame containing both event and trace animates through the existing event
  routine;
- optional future target highlighting/VFX consumes the trace through a
  separate cue compiler;
- the presentation director controls ordering and lock lifetime;
- content, projection, and transport never specify CSS classes, durations,
  DOM anchors, or animation routines.

The end-turn sequence remains local lock, remote fly-in, priority reveals,
then non-priority reveals. This specification adds semantic evidence; it does
not reorder or restyle those animations.

## Required example contracts

### Killmonger plus Armor

- candidate list contains every qualifying one-cost board card in deterministic
  order;
- protected cards resolve as `BLOCKED` with Armor as `blockedBy` and
  `CANNOT_BE_DESTROYED`;
- unprotected cards resolve as `AFFECTED` in frames containing
  `CARD_DESTROYED`;
- affected plus blocked plus invalidated plus unchanged equals attempted;
- later candidates resolve after a blocked candidate.

### Enchantress lane subset

- candidate list contains the eligible cards in the selected lane;
- cards whose ongoing ability is disabled resolve as `AFFECTED` with the
  corresponding mechanical event;
- cards that ceased to expose an applicable ongoing effect before their turn
  resolve as `INVALIDATED` or `NO_CHANGE` according to governed operation law;
- cards in other lanes never appear as candidates.

### Courthouse power gate

- a power-increase attempt against a card at Courthouse records the target;
- outcome is `BLOCKED`;
- `blockedBy` identifies the revealed Courthouse location;
- reason is `CANNOT_GAIN_POWER`;
- there is no `CARD_POWER_CHANGED` event;
- moving the card later does not invent a historical power increase.

### Repeated and nested On Reveal

- two executions of the same source ability have distinct invocation IDs;
- a nested pulled card's invocation has the causing invocation as parent;
- candidate snapshots and target outcomes are independent per invocation;
- depth-first work order and replay frame order match exactly;
- lane-capacity no-ops remain visible as `BLOCKED` or `NO_CHANGE` according to
  the governed play/deploy policy.

## Validation and correctness gates

### Structural/schema gates

- authority and player protocol schemas are generated from one source each;
- TypeScript and Rust validate the same golden valid/invalid fixtures;
- every discriminated union is closed and exhaustively handled;
- invalid null/null frames are rejected;
- invalid outcome/event combinations are rejected;
- canonical IDs and authority-only fields are rejected by player-wire schema;
- non-JSON values, symbols, functions, and unsafe integers are rejected.

### Kernel and timeline gates

- every invocation starts and completes exactly once;
- each target outcome references one active invocation;
- attempt ordinals are contiguous and deterministic;
- candidates are immutable and outcomes follow candidate order;
- parent invocations start before children and complete after them when
  depth-first semantics require nesting;
- completion counters exactly equal earlier outcomes;
- affected outcomes contain one matching mechanical event;
- blocked/invalidated/no-change frames leave mechanical state unchanged;
- all frames are contiguous internally and map to the correct turn/phase;
- failed kernel transactions publish no frames, state, RNG, or receipts;
- direct execution and replay agree after every frame;
- regeneration compares effect trace, not only final state.

### Projection and security gates

- each canonical frame projects independently for P0 and P1;
- no canonical entity ID appears in either seat payload;
- hidden identity and blocker projection follow seat visibility law;
- filtered frames preserve order and valid before/after chaining;
- the last projected after-state equals the block post-state;
- a serialized/deserialized block produces the same timeline as direct local
  projection;
- malformed or revision-gapped blocks lock out application and request resync;
- the complete block is published once, never one frame at a time.

### Authority matrix gates

The shared `MATCH_AUTHORITY_TEST_DRIVERS` suite runs the same cases against
every registered authority:

- private staging revision isolation;
- duplicate command idempotency;
- atomic end-turn publication;
- Killmonger/Armor mixed outcomes;
- Enchantress lane subset;
- Courthouse blocked power;
- repeated/nested invocation order;
- zero candidates and all-blocked outcomes;
- target invalidation during sequential resolution;
- reconnect before, during, and after a retained block;
- animation failure/fast-forward correction;
- terminal match behavior;
- developer replay authorization;
- seat redaction.

No authority may skip or weaken a shared contract.

### Presentation regression gates

- existing card transfer, flip, reveal zoom, location reveal, and end-turn
  choreography tests remain unchanged and green;
- trace-only frames do not add accidental animation delay;
- affected frames continue using the existing event animation routine;
- interaction remains locked for the complete atomic block;
- browser smoke play completes through opponent staging, both reveal orders,
  nested effects, replay inspection, reconnect correction, and match close.

## Implementation slices

### Slice 0 — Characterization and contract fixtures

1. Add failing reference tests for mixed affected/blocked outcomes, all-blocked,
   empty selection, invalidation, repeats, and nesting.
2. Add architecture fences forbidding presentation-side target/blocker
   inference.
3. Freeze existing animation choreography tests.
4. Add golden canonical and two-seat projected JSON examples.

Exit: the missing information is demonstrated by tests without changing
gameplay behavior.

### Slice 1 — Kernel resolution transcript

1. Add deterministic invocation/attempt allocation to the kernel transaction.
2. Capture selector snapshots, attempts, outcomes, blockers, and nesting.
3. Return the transcript only on successful all-or-nothing resolution.
4. Prove current governed no-ops now have typed outcomes.

Exit: kernel tests can inspect complete semantic resolution without Frames,
transport, replay, or presentation involvement.

### Slice 2 — Canonical frame cutover

1. Replace `FramedEvent` with `CanonicalFrame`.
2. Replace `framedEvents` with `frames` in transaction records and replay
   exports.
3. Make fold/apply advance state-preserving trace frames correctly.
4. Frame successful kernel transcripts exactly once at runtime commit.
5. Update reconciliation to compare exact traces and per-frame state.
6. Delete superseded types, readers, fixtures, and adapters.

Exit: canonical replay contains affected and blocked attempts in one timeline
and direct/replay parity holds after every frame.

### Slice 3 — Protocol split and seat projection

1. Replace the mixed protocol-v1 message/schema with authority-record and
   player-wire schemas.
2. Add seat-safe effect/entity projection.
3. Add authoritative per-visible-frame after-states.
4. Generate TypeScript/Rust types or validators from the new schema sources.
5. Delete protocol-v1 schema, fixtures, validators, and compatibility code.

Exit: both seats receive valid, secret-safe, fully materializable atomic
blocks and Rust validates the same fixtures.

### Slice 4 — Commands, receipts, revisions, and resync

1. Split public and private plan revisions.
2. Add authenticated seat-bound opaque command envelopes.
3. Add durable-shape idempotent receipts and exact duplicate behavior.
4. Add snapshot/block acknowledgement and whole-block reconnect policy.
5. Add revision/checksum resync behavior.

Exit: serialized loopback satisfies the complete remote-authority lifecycle
without importing canonical state into the client.

### Slice 5 — MatchClient and presentation cutover

1. Make `MatchClient` consume complete `SeatPresentationBlock` objects.
2. Build `SeatTransactionTimeline` directly from supplied projected states.
3. Keep existing event animators unchanged.
4. Add bounded fast-forward/post-state correction for every terminal path.
5. Delete any client projected gameplay reducer or frame-stream subscription.

Exit: direct and serialized authorities produce indistinguishable UI behavior
and one atomic publication per committed transaction.

### Slice 6 — Replay UI and complete gates

1. Render typed effect summaries and raw JSON in developer replay.
2. Add name resolution for seat-safe and canonical entity refs.
3. Add the full authority matrix, security, property, reconciliation,
   cross-language, and browser smoke gates.
4. Add the new suites to `npm run test:engine:regression` and top-level
   verification.

Exit: every required example and invariant is proven under every registered
authority.

## Completion criteria

This architecture is complete only when:

- there is one canonical frame timeline and no parallel effect history;
- blocked attempts survive canonical replay and player projection;
- source, ability, candidates, outcomes, blockers, and nesting are explicit;
- player clients receive one complete validated presentation block per public
  commit;
- clients do not run gameplay rules to materialize intermediate frames;
- public and private revision domains cannot stale or leak one another;
- duplicate commands cannot duplicate state, RNG, frames, or presentation;
- reconnect never resumes midway through a block;
- canonical IDs and hidden authority data never cross the player boundary;
- existing animation choreography remains green;
- TypeScript and Rust pass the same protocol fixtures;
- direct, serialized-loopback, and every later remote authority pass the same
  player-visible contracts;
- searches find no `FramedEvent`, `framedEvents`, mixed authority/player
  protocol union, protocol-v1 compatibility path, or presentation-side
  targeting inference in active playgame code.

## Recommended first action

Begin with Slice 0 and implement the Killmonger/Armor, Enchantress,
Courthouse, zero-target, and repeated/nested invocation fixtures before
changing the canonical frame type. Those fixtures define the semantic truth
that the remaining migration must preserve and prevent the frame cutover from
becoming a naming-only refactor.
