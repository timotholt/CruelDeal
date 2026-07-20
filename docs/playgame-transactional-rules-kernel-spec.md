# Playgame Transactional Rules Kernel

Status: authoritative implementation specification  
Date: 2026-07-19  
Scope: Phase 1.5 Checkpoints 4 and 5 and the permanent engine/content boundary  
Compatibility policy: clean replacement; no legacy event, replay, fixture, or
internal API compatibility

## Authority

This document is the governing specification for:

- governed gameplay commands and operations;
- precommit policies, replacements, and adjustments;
- committed semantic transitions and historical envelopes;
- card and location reactions;
- deterministic nested effect resolution;
- the distinction between committed mutations and continuous projections;
- the capability boundary available to declarative content and exceptional
  built-ins.

It supersedes the implementation detail previously assigned to Phase 1.5
Checkpoints 4 and 5 in
`docs/playgame-runtime-and-ui-refactor-plan.md`. That plan remains the roadmap
authority for later provider, presentation, component, CSS, and hardening
phases.

Completed Phase 1.5 Checkpoints 1 through 3 remain historical evidence and
preconditions:

- `docs/agent-checkpoints/phase1.5-cp1.md`
- `docs/agent-checkpoints/phase1.5-cp2.md`
- `docs/agent-checkpoints/phase1.5-cp3.md`

Where an older active document conflicts with this specification on the engine
rule-control plane, this document wins.

## Executive Decision

CruelDeal will use a small deterministic transactional rules kernel.

The kernel is not a dependency graph, reactive subscription system, generic
event bus, entity-component system, or collection of manually invoked hooks.
It is one bounded ordered work loop over one private candidate `MatchState`.

The permanent execution law is:

> Content requests semantic work. Governed operations propose facts. Only the
> kernel commits facts and advances candidate state. Committed facts discover
> deterministic reactions, which request more semantic work.

Cards and locations remain distinct authored entities with different setup,
zone, reveal, and ownership rules. Once active, both are immutable rule sources
compiled into the same internal policy, reaction, and projection vocabulary.

Friendly names such as `onCardDestroyedHere` remain available to authors. They
compile to typed event filters and effects; they are not independent imperative
engine call sites.

## Product Goal

Adding an ordinary card or location should normally change one content folder
and generated output. It should not require editing:

- `resolve.ts`;
- `apply.ts`;
- `effects/evaluator.ts`;
- runtime/session code;
- replay code;
- providers;
- presentation;
- a central definition-ID switch;
- a producer-specific trigger call.

When content requires a genuinely new engine capability, the change should add
one reusable semantic command, policy, reaction vocabulary item, selector, or
projection shared by every caller.

The resulting engine must satisfy:

```text
same bootstrap
+ same manifest/ruleset
+ same accepted intents
+ same serialized RNG state
= same committed transitions
+ same Frames
+ same final MatchState
+ same reconciliation result
```

## Why the Existing Shape Must Change

The current evaluator and resolver repeatedly combine responsibilities:

- interpret an effect;
- resolve selectors;
- validate a mutation;
- construct a past-tense event;
- call `apply`;
- update a local state variable;
- manually invoke a card trigger;
- manually invoke a location trigger;
- append nested events;
- manage recursion and RNG scopes.

That makes correctness depend on every producer remembering every gate and
reaction. Existing characterization proves that generic effects and built-ins
already diverge for move, destroy, create, return, draw/hand entry, and
spawn-and-reveal.

Replacing `fireLocationTrigger` with a generic callback emitter would preserve
the underlying problem. The missing abstraction is exclusive transactional
control over command planning, event commitment, and reaction scheduling.

## Non-Goals

This specification does not:

- rewrite `MatchSession`, `MatchRuntime`, the reducer, replay folding, Frame
  authority, serialized RNG, or simultaneous staging/lock/reveal;
- build a persistent dependency graph;
- build a mutable subscription registry;
- make game content arbitrary executable JavaScript;
- move gameplay authority into providers or presentation;
- turn continuous projections into stored mutations;
- invent hooks without a concrete content requirement;
- require a Rust server now;
- preserve old internal types, replay bundles, fixtures, or adapters;
- optimize rule lookup before measurements justify it;
- perform Phase 2 or Phase 3 work.

## Architectural Context

The kernel sits inside the already authoritative runtime:

```text
MatchSession
  -> validates a revisioned player intent
  -> asks MatchRuntime to resolve one transaction
  -> RulesKernel resolves against private candidate state
  -> runtime Frames and atomically commits the completed transaction
  -> presentation consumes projected committed Frames
```

Replay has a different, intentionally smaller path:

```text
genesis + committed framed transitions
  -> blind reducer fold
  -> reconstructed MatchState
```

Replay never invokes the kernel, operation policies, the effect interpreter,
reactions, or gameplay RNG.

## Canonical Concepts

### Intent

An `Intent` is an authenticated player/session request such as stage, unstage,
lock, retreat, or another public match command. Runtime validation and
idempotency remain outside the rules kernel.

### Work Item

The kernel processes a small closed union of ordered work:

```ts
type KernelWork =
  | CommandWork
  | EffectWork
  | CommitWork;
```

- `CommandWork` requests one semantic operation.
- `EffectWork` interprets one immutable declarative effect node with frozen
  source context.
- `CommitWork` proposes one canonical past-tense event from its owning
  operation.

This queue replaces JavaScript recursion as the control-flow authority. It is
not persisted as gameplay state and is discarded when the transaction ends.

### Semantic Command

A command asks for a domain action in the present tense:

```ts
type GameCommand =
  | PlayCardCommand
  | RevealCardCommand
  | MoveCardCommand
  | DestroyCardCommand
  | BanishCardCommand
  | ReturnCardCommand
  | CreateCardCommand
  | DrawCardCommand
  | DiscardCardCommand
  | ChangePowerCommand
  | ChangeCostCommand
  | ChangeEnergyCommand
  | LocationLifecycleCommand
  | LaneLifecycleCommand;
```

Commands carry a mandatory immutable cause and resolve selectors at execution
time against the current candidate state. They are not past-tense facts and
are never replayed.

### Governed Operation

Exactly one operation family owns each mutation-event family. It may:

1. validate a command;
2. collect applicable precommit rules;
3. deny it;
4. replace it with other commands;
5. adjust its parameters;
6. produce ordered `KernelWork`;
7. propose its canonical mutation event.

An operation cannot call `apply`, invoke a reaction, publish a Frame, or mutate
state.

### Committed Transition

A committed transition retains both the reducer event and immutable semantic
facts captured from the exact transition:

```ts
interface CommittedTransition<E extends MatchEvent = MatchEvent> {
  readonly event: E;
  readonly semantics: SemanticEnvelope<E>;
}
```

The runtime attaches the existing canonical `Frame` when the completed
transaction is framed. Phase 1.5 does not add another chronology, timestamp,
framestamp, or persisted sequence counter.

### Semantic Envelope

The envelope contains facts that cannot be safely reconstructed after state
changes:

```ts
interface SemanticEnvelope<E extends MatchEvent = MatchEvent> {
  readonly eventType: E['type'];
  readonly cause: EffectRef | SystemCause;
  readonly reason: SemanticReason;
  readonly affectedEntity: EntityRef | null;
  readonly affectedOwner: Owner | null;
  readonly priorZone: CanonicalZone | null;
  readonly resultingZone: CanonicalZone | null;
  readonly priorLane: LaneId | null;
  readonly resultingLane: LaneId | null;
  readonly transition:
    | 'PLAY_FROM_HAND'
    | 'REVEAL'
    | 'MOVE_BETWEEN_LANES'
    | 'CREATE'
    | 'RETURN'
    | 'DESTROY'
    | 'BANISH'
    | 'DISCARD'
    | 'DRAW'
    | 'POWER_GAIN'
    | 'POWER_LOSS'
    | 'OTHER';
  readonly historicalLocation: LocationSnapshot | null;
}
```

Fields may be specialized by event type. Required semantic facts must be
represented by closed types rather than optional strings or presentation-time
state guessing.

### C4A Contract Authority

The executable prework contract is:

- `services/playgame/engine/kernel/contracts.ts`
- `services/playgame/engine/kernel/contracts.test.ts`

That contract is the exact C4A authority for:

- the target lifecycle event vocabulary;
- required prior/result zones and lane fields;
- before/after rule-source snapshot edges;
- deterministic reaction bands;
- clean replacement of ambiguous current event families;
- finite resolution budgets;
- typed kernel failure codes and atomic publication behavior;
- the permanent stored-power pilot.

The contract is behavior-neutral until a lifecycle family enters the kernel.
It does not extend the current reducer event union with parallel aliases.
During each migration slice, the old shape and all its callers are replaced
atomically.

The target vocabulary separates facts that the current shapes conflate:

| Target transition | Exact meaning |
| --- | --- |
| `CARD_REVEALED` | A card already in a lane committed its reveal |
| `CARD_PLAY_COMPLETED` | A hand-origin play finished its reveal lifecycle, including when On Reveal was suppressed |
| `CARD_CREATED` | A new card instance entered deck, hand, or lane |
| `CARD_ZONE_CHANGED` | An existing card changed a non-specialized zone |
| `CARD_MOVED` | An existing card moved lane-to-lane |
| `CARD_RETURNED_TO_LANE` | A removed existing card returned to a lane |

`CARD_FLIPPED` is replaced by `CARD_REVEALED` plus, only for a committed
hand-origin play, `CARD_PLAY_COMPLETED`. `CARD_ADDED_TO_DECK`,
`CARD_ADDED_TO_HAND`, and `CARD_ADDED_TO_LANE` collapse into the closed
`CARD_CREATED` transition. `CARD_MOVED_TO_ZONE` becomes the unambiguous
`CARD_ZONE_CHANGED` transition. There are no legacy aliases, fallback reads,
or dual dispatch paths.

### Rule Source

A rule source is an active card, active location, or system/ruleset entity whose
immutable definition contributes compiled rules.

Runtime instances refer to definitions by stable ID and version. Content
definitions do not register callbacks when an instance enters play and do not
unregister callbacks when it leaves.

### Reaction Invocation

A reaction invocation is an immutable snapshot created for one transition:

```ts
interface ReactionInvocation {
  readonly source: RuleSourceSnapshot;
  readonly rule: CompiledReactionRule;
  readonly event: CommittedTransition;
  readonly context: FrozenRuleContext;
  readonly order: ReactionOrderKey;
}
```

Once snapshotted, later nested changes cannot add, remove, or rewrite an
invocation belonging to the parent transition.

## The Three Runtime Rule Paths

Authored rules have three fundamental runtime paths.

### 1. Precommit Operation Rules

Precommit rules affect a proposed command before a mutation event exists:

```ts
type CompiledOperationRule =
  | ProhibitionRule
  | ReplacementRule
  | AdjustmentRule;
```

- A prohibition denies the command.
- A replacement substitutes typed semantic work.
- An adjustment changes typed command parameters.

Examples:

- Courthouse prohibits positive stored power mutation.
- A movement restriction prohibits moving a selected card.
- A future replacement may redirect destruction to banishment.
- A cost rule may adjust a proposed play cost.

Multiple applicable rules use explicit deterministic composition and ordering.
A prohibition, replacement, or adjustment never masquerades as a postcommit
reaction.

### 2. Postcommit Reactions

Reactions observe one committed transition and issue new `EffectWork` or
`CommandWork`. They cannot undo, rewrite, or suppress the parent event.

Examples:

- a destroyed card runs its death reaction;
- a location reacts to a card destroyed there;
- a destination location reacts to a moved card entering;
- a card reacts after another card is committed as played in its lane.

### 3. Continuous Projections

Projections compute effective values from current stored state and active
ongoing rules:

- effective power;
- effective cost;
- legal targets;
- ability presence;
- lane score;
- play/move/destruction restrictions that are queried continuously.

Projection evaluation emits no event, performs no RNG draw, and triggers no
reaction. Suppressing a stored modifier through a projection does not delete
that modifier.

## Content Compilation

Cards and locations retain friendly authored schemas. Bootstrap validation
compiles those schemas into a normalized immutable rule representation:

```ts
type CompiledRule =
  | CompiledOperationRule
  | CompiledReactionRule
  | CompiledProjectionRule;
```

For example:

```json
{
  "onCardDestroyedHere": [
    {
      "kind": "CHANGE_ENERGY",
      "owner": "EVENT_OWNER",
      "delta": 1
    }
  ]
}
```

lowers to the equivalent of:

```ts
{
  kind: 'REACTION',
  eventType: 'CARD_DESTROYED',
  transition: 'DESTROY',
  relationship: 'HISTORICAL_LOCATION_IS_SELF',
  effects: [/* normalized immutable EffectExpr */],
}
```

The runtime dispatcher does not contain a switch for each friendly hook name.
Unknown hook names, event types, filters, commands, selectors, or capabilities
fail content generation/validation.

No content JSON imports engine implementation code or embeds callbacks.

## Exceptional Built-ins

Some unusual cards may require TypeScript orchestration that the declarative
DSL cannot express economically. Such built-ins are allowed only through a
restricted capability surface:

```ts
interface BuiltinCapabilities {
  readonly query: ReadonlyGameQueries;
  readonly rng: ScopedGameplayRng;
  issue(command: GameCommand): void;
  evaluate(effect: EffectExpr, context: FrozenEffectContext): void;
}
```

Built-ins do not receive:

- mutable `MatchState`;
- `apply`;
- mutation-event constructors;
- the dispatcher;
- the transaction's internal queue;
- presentation/runtime services;
- wall-clock, network, filesystem, or unscoped randomness.

An exceptional built-in may orchestrate governed commands. It cannot implement
an alternate mutation path.

## No Dependency Graph

The kernel must not maintain edges between runtime entities.

There is no:

- card-to-card dependency graph;
- location-to-card dependency graph;
- observable registration lifecycle;
- mutable subscriber collection;
- cache invalidation protocol tied to card destruction or creation;
- automatic dependency tracking.

Instead, each command or event performs event-local rule discovery against a
precise state snapshot.

### Precommit Discovery

For a command:

```ts
collectOperationRules(beforeState, command, manifest)
```

enumerates currently eligible rule sources, filters their compiled precommit
rules, and sorts the resulting immutable rule invocations.

### Reaction Discovery

For a proposed event:

```ts
const before = candidateState;
const after = applyCandidate(before, event);
const envelope = captureSemantics(before, event, after);
const reactions = collectReactionInvocations(
  before,
  after,
  envelope,
  manifest,
);
```

The kernel then adopts `after` as its private candidate state and schedules the
already snapshotted reactions.

Discovery may consult both snapshots because transition semantics differ:

- leaving, destruction, banishment, and discard observe historical sources in
  `before`;
- entering, creation, return, and reveal observe destination/result sources
  in `after`;
- move observes the source context from `before` and destination/moved-card
  context from `after`;
- the envelope supplies the unambiguous transition classification.

### Scale

The active board contains few enough cards and locations that a deterministic
linear scan is the default. It is safer than a mutable graph and insignificant
next to presentation cost.

If profiling later proves lookup material, the manifest compiler may create
immutable indexes by operation/event type. Runtime eligibility must still be
filtered from current state; no live dependency graph is introduced.

Projection caches, if ever added, are nonauthoritative and keyed by canonical
state revision plus query arguments. The first implementation adds no new
cache.

## Transaction Work Loop

The kernel owns one private transaction object:

```ts
interface KernelTransaction {
  readonly initialState: MatchState;
  candidateState: MatchState;
  readonly work: Deque<KernelWork>;
  readonly transitions: CommittedTransition[];
  readonly rng: TransactionRng;
  readonly budget: ResolutionBudget;
}
```

Conceptual execution:

```ts
function resolveKernelTransaction(input: KernelInput): KernelResult {
  const tx = beginPrivateTransaction(input);

  while (!tx.work.isEmpty()) {
    tx.budget.consumeWorkItem();
    const work = tx.work.popFront();

    if (work.kind === 'EFFECT') {
      const expansion = interpretEffect(work, tx.candidateState);
      tx.work.prependInOrder(expansion);
      continue;
    }

    if (work.kind === 'COMMAND') {
      const rules = collectOperationRules(
        tx.candidateState,
        work.command,
        input.manifest,
      );
      const expansion = executeGovernedOperation(work, rules);
      tx.work.prependInOrder(expansion);
      continue;
    }

    const before = tx.candidateState;
    const after = applyCandidate(before, work.event, input.manifest);
    const transition = captureTransition(before, work.event, after);
    const reactions = collectReactionInvocations(
      before,
      after,
      transition,
      input.manifest,
    );

    tx.transitions.push(transition);
    tx.candidateState = after;
    tx.work.prependInOrder(lowerReactions(reactions));
  }

  return completePrivateTransaction(tx);
}
```

`prependInOrder` preserves the declared order while giving nested work
immediate deterministic execution before the parent's later sibling work. It
replaces recursive evaluator calls without changing characterized depth-first
gameplay order.

The kernel's candidate folds use the same reducer semantics as runtime and
replay. Only the completed transition array and resulting state leave the
private transaction.

## Atomicity and Failure

The session publishes either the complete resolved transaction or none of it.

Before publication, any of the following produces a typed deterministic kernel
failure and leaves authoritative session state/revision unchanged:

- reaction/work budget exhaustion;
- invalid operation output;
- missing mandatory semantic envelope data;
- invalid rule source;
- illegal direct event family;
- invalid RNG scope/use;
- reducer or reconciliation invariant failure.

The kernel does not publish a prefix of a failed transaction. Diagnostic
details may be returned to debug tooling but are not committed as partial
gameplay mutations.

Kernel failures are internal invariant failures, not player illegality. They
must not be converted to or stored as `RULES_INVALID`. The submitted intent
rejects with a typed kernel invariant error and remains retryable.

For the second `END_TURN` lock specifically, candidate resolution occurs before
the second lock receipt is accepted or stored. If resolution fails:

- no event or Frame is published;
- no receipt is stored for the second lock;
- revision, canonical state, and serialized RNG are unchanged;
- the second seat remains unlocked;
- the first seat's previously accepted lock remains intact;
- the failed intent ID may be retried.

This is the required runtime cutover behavior even though the pre-C4A runtime
currently accepts the second lock before resolving the turn. C4A must correct
that seam; it must not preserve the old sequencing for compatibility.

Normal policy denial is not a kernel failure. It produces the operation's
defined typed denied/no-op result and no mutation event.

## Deterministic Ordering

Ordering is explicit data. It must not depend on:

- object property enumeration;
- import order;
- callback registration time;
- hash-map implementation order;
- DOM order;
- wall time;
- incidental traversal of inactive content.

Every compiled rule retains its definition-local rule index. Every runtime
invocation receives an explicit order key constructed from relevant canonical
facts:

```ts
interface ReactionOrderKey {
  readonly timingBand: number;
  readonly prioritySeatRank: number;
  readonly laneOrdinal: number;
  readonly cardOrdinal: number;
  readonly ruleIndex: number;
  readonly sourceInstanceId: string;
}
```

Inapplicable dimensions use documented sentinel values. Stable instance ID is
the final tie-breaker, never the primary gameplay order.

The existing Phase 1.5 characterization suite is the migration oracle except
where Checkpoint 1 already declared corrected target behavior.

Required corrected ordering and classification:

- stage, unstage, and undo produce no committed gameplay reaction;
- create, play-from-hand, lane move, return, and reveal are mutually
  classified;
- committed hand-origin play fires played-here exactly once;
- create-and-reveal does not count as hand play;
- suppressed On Reveal still completes the play lifecycle;
- destruction snapshots the destroyed card and original location before any
  death reaction can replace or remove that location;
- destruction order is affected-card death reaction, followed by original
  location destruction reaction;
- lane-move order is source `onCardLeftHere`, destination
  `onCardEnteredHere`, then moved-card `onMove`;
- stored positive/negative power mutations alone produce gained/lost-power
  reactions;
- projection recomputation produces no mutation reaction.

Within a multi-source card-reaction band:

1. priority seat resolves first;
2. that seat's cards resolve by current active lane order;
3. cards within a lane resolve by canonical slot order;
4. the other seat follows under the same ordering;
5. rules on one source resolve by authored rule index.

Any intentional change from characterized behavior requires a named target
test and an explicit note in the checkpoint evidence.

The initial timing bands are executable data in
`REACTION_ORDER_PLANS`. In particular:

- reveal: affected-card On Reveal at 100, revealed-here location at 200;
- completed play: any-card-played-here cards at 100, played-here location at
  200;
- destroy: affected-card death at 100, original location at 200;
- move: source-left at 100, destination-entered at 200, moved-card at 300;
- stored power: affected-card gained-power at 100, location gained-power at
  200, location lost-power at 300.

Conditional bands that cannot both apply may still have distinct numbers.
Within a band, the full canonical order key remains timing band, priority seat,
lane, slot, authored rule index, and stable source instance ID.

## Friendly Reaction Vocabulary

The initial authoring vocabulary lowers to generic compiled reactions:

| Friendly hook | Exact committed meaning |
| --- | --- |
| `onCardPlayedHere` | A hand-origin play completed in this lane; stage, undo, create, move, and return do not count |
| `onCardRevealedHere` | A card in this lane committed its reveal |
| `onCardDestroyedHere` | A card committed from this lane to destroyed |
| `onCardBanishedHere` | A card committed from this lane to banished |
| `onCardGainedPowerHere` | A positive stored power mutation committed while the card was here |
| `onCardLostPowerHere` | A negative stored power mutation committed while the card was here |
| `onCardEnteredHere` | An existing card committed a lane-to-lane move into this lane |
| `onCardLeftHere` | An existing card committed a lane-to-lane move out of this lane |
| `onCardCreatedHere` | A new card instance committed into this lane |
| `onCardReturnedHere` | A previously removed card committed back into this lane |

Card-owned reactions such as `onDestroyed`, `onMove`, `onDiscarded`,
`onAnyCardPlayedHere`, turn-start, turn-end, and On Reveal use the same
dispatcher and immutable invocation representation.

New friendly names are added only when existing semantic event filters cannot
express the content rule unambiguously.

### Precommit Reveal-Timing Policy

Reveal timing for a hand-origin play is an operation policy, not an entry
reaction. Locations such as Cryobank author:

```json
{
  "kind": "REVEAL_TIMING_OVERRIDE",
  "target": {
    "kind": "SAME_LANE",
    "of": { "kind": "SELF" },
    "ownerFilter": "ANY_OWNER"
  },
  "timing": { "kind": "END_OF_GAME" },
  "stack": "MAX"
}
```

The stage command privately places the candidate card, evaluates active timing
policies against that candidate lane, and emits `CARD_REVEAL_SCHEDULED` in the
same atomic result as `CARD_STAGED` and the energy spend. This command output
does not dispatch a lifecycle reaction. `onCardEnteredHere` therefore retains
its exact lane-to-lane movement meaning and never fires for stage, unstage, or
undo.

Multiple policies compose by latest reveal: `END_OF_GAME` outranks every turn;
otherwise the largest evaluated turn wins. The winning timing is stored on the
card. Moving the card or replacing the source location does not retroactively
rewrite it. Unstage/undo clears it with the rest of the private play.

## Nested On Reveal and Deck Deployment

The kernel must support Wong/Jubilee/Odin-style nested resolution without
recursion hidden inside the evaluator.

Two different actions must remain distinct:

1. create a new card instance and reveal it;
2. move an existing card instance from deck to lane and reveal it.

The current `SPAWN_AND_REVEAL` primitive conflates these actions. C4C/C4D
deletes that primitive. New-instance behavior lowers to `CREATE_CARD` followed
by `REVEAL_CARD`; the resulting committed `CARD_REVEALED` transition discovers
`INVOKE_ON_REVEAL` with reason `NATURAL_REVEAL`. Deck behavior lowers to
`DEPLOY_FROM_DECK`.

### Create And Reveal

Create-and-reveal schedules `CREATE_CARD` and `REVEAL_CARD` as ordered sibling
work. The creation command commits `CARD_CREATED`, and all reactions caused by
that transition finish depth-first before `REVEAL_CARD` runs. The reveal command
then commits `CARD_REVEALED`, which schedules the card's natural On Reveal
invocation through the ordinary reaction dispatcher.

The complete created card reveal lifecycle, including its On Reveal effects and
nested work, finishes before the parent effect's next sibling continues. A
created card with no On Reveal ability still commits `CARD_REVEALED`, becomes
face-up, and contributes Power immediately. Create-and-reveal never emits
`CARD_PLAY_COMPLETED` and never counts as a hand-origin play.

Built-ins that create lane cards lower to the same `CREATE_CARD` /
`REVEAL_CARD` work during authored-effect expansion. They do not open a hidden
sub-transaction inside the evaluator. Security Detail and Riff Raff are the
initial production proofs: their created cards reveal, execute any authored
On Reveal text, obey the shared queue budget, and stop at lane capacity.

If creation is a normal no-op because the lane is full or the definition is
invalid, the paired reveal is also a normal no-op because no matching card
instance exists. No reveal or invocation event is fabricated.

### Deploy From Deck

`DEPLOY_FROM_DECK` is a governed command. At command execution time it:

1. checks the current candidate lane capacity;
2. selects from the current candidate deck using the effect's declared
   deterministic selection rule;
3. moves the selected existing instance from deck to lane;
4. preserves instance ID, stored power/cost history, and provenance;
5. commits the deck-to-lane semantic zone transition;
6. enters the ordinary reveal lifecycle depth-first before the parent effect
   continues.

An empty deck or full lane is a normal no-op, not a kernel failure. A failed
capacity check does not remove or reorder a deck card.

Deck deployment spends no energy, is not card creation, and does not count as
the hand-origin `CARD_PLAY_COMPLETED` transition. It therefore cannot
accidentally fire played-from-hand, created-here, or stage/undo behavior.

### Invoke On Reveal

`INVOKE_ON_REVEAL` is semantic command work with one of two reasons:

- `NATURAL_REVEAL`;
- `RETRIGGER`.

A natural reveal is discovered from `CARD_REVEALED`. A retrigger is issued
directly by card/location effect work. A retrigger does not fabricate another
`CARD_REVEALED` or `CARD_PLAY_COMPLETED` fact and does not re-fire played-here
reactions.

`INVOKE_ON_REVEAL` is not authored as the second half of create-and-reveal.
Doing so would bypass the reveal transition and could double-invoke the card
once `CARD_REVEALED` reactions are dispatched. `REVEAL_CARD` is the required
second command; natural invocation is exclusively discovered from its committed
`CARD_REVEALED` transition.

At the start of each invocation, the kernel snapshots:

- the card's whole authored On Reveal ability list;
- the effective Wong-style On Reveal multiplier.

The whole ability list repeats by that captured multiplier. Removing the
multiplier source during nested resolution does not cancel already scheduled
repetitions.

Each effect expression still executes against the current candidate state.
Selectors resolve once at the start of each effect execution, producing an
immutable ordered target list for that execution. Consequently, cards added by
an earlier repetition can participate in a later repetition, but a target
added while one target list is already running cannot splice itself into that
list.

Nested commands resolve depth-first before the next sibling effect or
repetition. Deck order, capacity, active rule sources, and projection values
are therefore always read from the candidate state produced by all earlier
work.

### Mandatory Create-And-Reveal Contract

C4D must include a Drone Pilot-style golden trace in which a revealing parent
creates an inert token in its lane:

1. the parent begins its natural On Reveal invocation;
2. `CREATE_CARD` commits `CARD_CREATED`;
3. created-here reactions finish;
4. `REVEAL_CARD` commits `CARD_REVEALED`;
5. the token's natural On Reveal invocation finishes, if it has one;
6. revealed-here reactions finish in canonical order;
7. only then does the parent's next authored sibling effect continue.

The trace must prove that the token is face-up and contributes Power in the
same resolution transaction, emits no `CARD_PLAY_COMPLETED`, and is not left on
the turn reveal schedule. A full lane must instead prove a clean no-op with no
created identity, reveal, invocation, or partial presentation fact.

### Mandatory Cascade Contract

C4D must include a golden trace for:

- an active ×2 On Reveal multiplier;
- a Jubilee-style card that deploys another card from its deck here;
- an Odin-style repeater that invokes the other On Reveal cards here;
- an otherwise inert deck;
- both unlimited test capacity and the ordinary four-slot lane.

With unlimited capacity, the exact depth-first trace produces six total deck
deployments:

1. Jubilee repetition one deploys the repeater;
2. repeater repetition one retriggers Jubilee, whose captured ×2 invocation
   deploys two cards;
3. repeater repetition two retriggers Jubilee, deploying two more;
4. Jubilee's original repetition two resumes and deploys one.

The repeater excludes itself. Its two executions come from the active
multiplier, not self-recursion.

With four slots and Wong plus Jubilee already present, only two further cards
can enter: the repeater and one nested deployment. Every later deployment is a
normal no-op and leaves the remaining deck intact. If a different card enters
before the repeater, the resulting trace changes deterministically because
capacity is checked at execution time.

The executable prework authority for these rules is
`DECK_DEPLOYMENT_CONTRACT`, `ON_REVEAL_INVOCATION_CONTRACT`, and
`WONG_JUBILEE_REPEATER_GOLDEN_TRACE` in
`services/playgame/engine/kernel/contracts.ts`.

## RNG

The existing serialized gameplay RNG is the only nondeterministic input.

The kernel and content prohibit:

- `Math.random`;
- `Date.now`;
- timers;
- locale-sensitive comparison;
- async resolution;
- network/filesystem reads;
- process-global mutable counters;
- separately seeded built-in RNGs.

Every random decision consumes the transaction-owned gameplay stream through a
purpose-labeled scope derived from stable semantic lineage:

- root intent/transaction purpose;
- originating source;
- compiled rule index;
- command/effect purpose;
- target ordinal where required.

Scope labels aid audit and testing; they do not create another chronology.
RNG before/after state remains part of the existing transaction and terminal
reconciliation proof.

## Reducer and Replay Contract

The reducer:

- accepts committed past-tense events;
- applies them blindly;
- contains no card/location definition checks;
- contains no operation policy;
- contains no reaction lookup;
- performs no RNG;
- invokes no content.

Replay folds `CommittedTransition.event` in Frame order. The semantic envelope
is retained for debug, protocol projection, and presentation choreography but
does not cause replay-time gameplay behavior.

The same genesis plus committed events must reproduce:

- every candidate/live checkpoint used by reconciliation;
- final `MatchState`;
- RNG cursor/state;
- lifecycle Frames and modifier provenance;
- projected seat state for the same viewer.

## Envelope and Event Replacement Policy

CruelDeal has no backward-compatibility requirement during active development.

When C4 replaces or enriches the event/transition schema:

- replace current types and callers atomically;
- regenerate current TypeScript/Rust schemas and fixtures;
- update current tests and replay builders;
- reject/remove obsolete replay fixtures;
- delete fallback reads, optional legacy aliases, adapters, and dual writes;
- do not version an internal format solely to preserve unshipped history.

Versioning remains appropriate at an actual external persisted/wire boundary,
but current development artifacts do not justify parallel schemas.

## Architectural Boundaries

### Event Construction

Normal mutation-event construction is allowed only in:

- the event type module;
- the owning governed operation;
- reducer/replay fixtures;
- tests and testkit builders.

### Direct Reducer Application

Direct `apply` use is allowed only in:

- the reducer implementation;
- the kernel's private commit fold;
- authoritative runtime/replay folds;
- explicit headless/testkit folds;
- tests.

`resolve.ts`, `effects/evaluator.ts`, `effects/builtins.ts`, content, providers,
and presentation are not permanent exceptions.

### Reaction Invocation

Only the kernel dispatcher may create a `ReactionInvocation`. No producer may
also call `fireLocationTrigger`, `fireCardTrigger`, `evalEffect`, or an
equivalent manual reaction path after proposing an event.

### Content Imports

Active card and location folders may import no engine implementation code.
Generated/compiled output depends only on public schema types and validated
data.

## Testing Strategy

### Kernel Laws

Tests must prove:

1. identical inputs produce byte-identical committed transitions;
2. each committed transition gets exactly one dispatch opportunity;
3. replay produces zero reaction invocations;
4. denied commands produce no mutation transition;
5. failed transactions publish no prefix;
6. rule discovery is independent of manifest object enumeration order;
7. rule ordering is independent of registration/import order;
8. nested reactions respect the shared budget and deterministic order;
9. before/after/envelope facts survive movement and removal;
10. live candidate folding equals final replay folding.

### Lifecycle Matrix

For both seats and every relevant lane:

- stage and unstage;
- hand-origin play;
- suppressed reveal;
- ordinary reveal;
- create;
- create-and-reveal;
- lane move;
- move where the source/destination location changes during nested work;
- destroy;
- destroy where the death reaction replaces the location;
- banish from every legal zone;
- discard;
- return;
- draw and generated hand entry;
- stored power gain/loss;
- projected power suppression/restoration.

### Property Tests

Seeded generated matches must prove:

- deterministic transition identity;
- terminal reconciliation;
- reaction exactly-once behavior;
- bounded termination;
- no ungoverned event producer;
- no replay-time reactions;
- no private-stage gameplay reactions.

Failures print a reproducible generator seed and enough transaction context to
replay the first divergence.

### Mutation Tests

The suite must fail if a mutation:

- drops an eligible reaction;
- dispatches one twice;
- reverses a specified ordering band;
- uses post-state guessing instead of an envelope fact;
- lets a built-in construct a mutation event;
- runs reactions during replay;
- allows projection recomputation to trigger gained/lost power;
- partially publishes on budget exhaustion.

## Migration Plan

No migrated operation may have governed and ungoverned production paths at the
same checkpoint exit.

### C4A — Kernel Foundation

Pilot:

- govern permanent stored-power mutation first;
- route `CHANGE_STORED_POWER` through the kernel;
- apply the existing Courthouse positive-power prohibition as its precommit
  policy;
- preserve power-ledger provenance and exact replay;
- prove one test-only smoke reaction through the queue without adding
  content-specific production behavior.

Stored power is the pilot because it already has one governed operation,
Courthouse policy coverage, provenance history, Frame/replay tests, and a
well-defined projection boundary. Lifecycle migration remains in C4B through
C4D.

Build:

- closed `KernelWork` and `GameCommand` contracts;
- private candidate transaction;
- bounded ordered work loop;
- governed commit seam;
- `CommittedTransition` and typed semantic envelope;
- event-local rule discovery;
- immutable `ReactionInvocation`;
- deterministic order keys;
- zero-content smoke reaction proving queue/replay separation.

Migrate direct candidate `apply` plumbing only as needed to prove one vertical
slice. Do not perform unrelated evaluator cleanup.

Exit:

- permanent stored power enters the kernel and replays identically;
- no dependency graph or runtime subscriber registry exists;
- a budget failure publishes nothing;
- envelope closure validates;
- runtime framing remains the only `Frame` authority.

The prework required to begin C4A is complete when
`docs/agent-checkpoints/phase1.5-cp4a-readiness.md` is green and
`npm run verify:playgame:phase15` passes.

### C4B — Destroy and Banish

Migrate:

- destroy and immunity/friendly-destroy policies;
- affected-card death reactions;
- historical-location destruction reactions;
- banish and banish-here reactions;
- lane-destruction occupants through the same destroy command.

Exit:

- original location snapshot survives nested replacement/destruction;
- every built-in uses governed commands;
- destroy/banish mutation events have no alternate producer;
- characterized ordering and both-seat matrices pass.

### C4C — Move, Enter, Leave, Create, and Return

Migrate:

- lane-to-lane movement;
- zone movement;
- return;
- creation in deck, hand, and lane;
- existing-instance deployment from deck to lane;
- destination capacity and movement policies;
- source-left, destination-entered, moved-card ordering.

Exit:

- create, move, and return cannot be confused by a shared event shape;
- deck deployment preserves the existing instance and cannot masquerade as
  creation;
- new and removed rule sources participate at the specified snapshot edge;
- lane topology changes do not invalidate stored subscriptions because none
  exist;
- generic effects and built-ins have identical policy/reaction routing.

### C4D — Play, Reveal, and Turn/Location Reactions

Migrate:

- committed hand-origin play classification;
- card On Reveal;
- natural and retriggered On Reveal invocation work;
- invocation-start multiplier/ability snapshots;
- depth-first nested invocation ordering;
- played-here and any-card-played-here;
- card/location turn-start and turn-end reactions;
- location reveal reactions;
- create-and-reveal;
- suppressed On Reveal.

Exit:

- private stage/unstage/undo fire no gameplay reaction;
- a committed play fires each eligible reaction exactly once;
- retriggering text emits no fake reveal or completed-play transition;
- Wong/Jubilee/repeater golden traces pass at unlimited and four-slot capacity;
- opening and ordinary gameplay use the same kernel path;
- existing reveal choreography consumes committed facts without controlling
  gameplay.

### C4 Exit

Checkpoint 4 closes when:

- every lifecycle family named above uses committed semantic envelopes and the
  central dispatcher;
- no manual lifecycle trigger remains;
- replay folds reaction results and never dispatches reactions;
- deterministic order, snapshot, budget, and atomicity tests pass;
- Phase 0/1, Phase 1.1/1.15, Phase 1.2, Phase 1.21/1.22, power/Courthouse,
  build, lint, schema, and cross-language validation gates remain green.

### C5A — Remaining Operation Conformance

Govern:

- draw and hand entry;
- discard;
- cost;
- energy/max-energy/next-turn energy;
- tags, counters, and text override;
- pending effects;
- transform;
- remaining location and lane lifecycle;
- turn and match lifecycle mutation families.

Every effect and built-in becomes a command/effect client of the kernel.

#### C5A-1 — Hand Lifecycle and Immediate Power Reactions

The first C5A slice governs:

- deck-to-hand draw by canonical top or explicit existing card instance;
- hand-to-discard transitions;
- immutable `onDiscarded` reaction snapshots;
- typed ongoing hand-entry policies;
- immediate `onGainedPower` reactions in the same private transaction.

`CARD_DRAWN`, `CARD_DISCARDED`, and `CARD_POWER_CHANGED` each have one owning
operation. Draw/discard clients submit `DRAW_CARD` or `DISCARD_CARD`; permanent
Power clients submit `CHANGE_STORED_POWER`. Content does not poll later state
to infer that one of these transitions happened.

Hand-entry policy is authored as typed ongoing content and is sampled from the
active post-transition source set. Discard reactions are sampled from the
discarded card's pre-transition text. Power-gain reactions are sampled from
the affected card immediately after a committed positive stored-Power change.
Blocked or no-op mutations schedule no reactions.

Every nested effect remains inside the initiating private transaction. Budget
failure publishes neither the initiating transition nor any reaction result.

#### C5A-2 — Cost, Energy, and Staged-Play Payment Provenance

The second C5A slice governs:

- permanent card-Cost `ADD` and effective-Cost `SET` mutations;
- current Energy, maximum Energy, and next-turn Energy bonus mutations;
- stage payment, unstage refund, undo refund, turn ramp, turn refill, and
  next-turn bonus consumption;
- exact payment provenance for unresolved hand-origin plays.

`CARD_COST_CHANGED` has one owning operation.
`ENERGY_CHANGED`, `MAX_ENERGY_CHANGED`, and
`NEXT_TURN_ENERGY_BONUS_CHANGED` have one owning operation. Every emitted
mutation records a non-empty semantic cause. The reducer rejects provenance-
free cost or Energy events rather than creating history that cannot explain
itself.

An unresolved play is stored canonically as:

```ts
interface StagedPlay {
  readonly cardId: CardId;
  readonly energyPaid: number;
}
```

`MatchState.stagedPlays` replaces the old ID-only staging order. `CARD_STAGED`
records the exact non-negative integer payment accepted by the stage
transaction. Unstage and undo refund only that stored amount; they never
re-project the card's Cost. A later permanent or ongoing Cost change therefore
cannot mint Energy, destroy Energy, or retroactively rewrite the historical
payment.

Reveal, unstage, destruction, banishment/zone removal, and turn cleanup close
the corresponding staged-play record. Movement and transformation retain it
until the original unresolved play closes. Invalid payment provenance rejects
the whole intent before any unstage/refund prefix is published.

Cost and Energy batches use private candidate folding, closed transition
semantics, deterministic command order, work/event budgets, and all-or-nothing
publication. They do not dispatch reactions in this slice, but they use the
same transaction kernel so future policies and reactions have one governed
extension point.

#### C5A-3 — Metadata, Pending Work, and Transform

C5A-3 is intentionally split into four ordered clean-cutover slices. Each
slice removes the superseded producer paths before the next begins; none may
leave a governed and ungoverned producer for the same mutation family.

##### C5A-3a — Card Metadata

Govern:

- authored persistent card-tag addition and removal;
- signed card-counter changes;
- setting and clearing card text overrides.

Engine-owned play, move, and destruction chronology is lifecycle state, not
card-tag metadata. `PLAYED_THIS_TURN`, `MOVED_THIS_TURN`,
`DESTROYED_THIS_TURN`, and `EVER_MOVED` are derived from lifecycle frames and
turn indexes and must never be stored in the card tag collection. Transform
metadata reset is exclusively deferred to C5A-3d, which removes the temporary
reducer-level `resetStats` behavior.

`CHANGE_CARD_TAG`, `CHANGE_CARD_COUNTER`, and `OVERRIDE_CARD_TEXT` are the only
commands for these mutations. One card-metadata operation exclusively proposes
`CARD_TAG_ADDED`, `CARD_TAG_REMOVED`, `CARD_COUNTER_CHANGED`, and
`CARD_TEXT_OVERRIDDEN`.

The operation resolves a stable card instance at command execution, validates
complete provenance, and snapshots object payloads before they cross the
operation boundary. Tag addition uses exact runtime payload identity, so
source-bearing tags of the same kind but different sources coexist; removal is
deliberately kind-scoped. Adding an exact existing tag, removing an absent tag
kind, applying a zero counter delta, and writing a semantically identical text
override are exact no-ops. Semantic text equality is recursive and independent
of object-key insertion order. Counter names must be non-empty and both the
requested delta and resulting value must be safe integers.

Text removal uses one compositional `BLANKED_TEXT` representation containing
the materialized remaining abilities and truthful rules text. Sequential
On-Reveal, Ongoing, and all-text removals therefore compose instead of
reinterpreting the printed definition. If the effective text was copied, its
source provenance remains attached to `BLANKED_TEXT` until copied text is
explicitly cleared.

Committed semantics retain the affected card ID, cause and reason, plus:

- prior/result tag presence for tag changes;
- prior value, result value, and signed change for counters;
- immutable prior/result override snapshots for text changes.

Card metadata commands preserve caller order and fold each commit into private
candidate state before planning the next command. Invalid commands, invalid
reducer results, missing semantics, or exhausted budgets publish no prefix.

##### C5A-3b — Location Metadata by Stable Identity

Govern:

- location-tag addition and removal;
- owner-neutral and owner-scoped location-counter changes.

Location metadata targets `LocationCardInstanceId`, never a lane as the
mutation identity. A lane is mutable placement: its location card may be
replaced, destroyed into Ruin, returned, or shifted before nested work runs.
Lane-oriented authored selectors are resolved at command execution to the
exact current location-card instance, and the resulting command/event carries
that stable identity.

One location-metadata operation exclusively proposes the location tag/counter
events. Reducer application patches that exact location record and must not
look up whichever card happens to occupy the lane later. Committed semantics
retain the location-card ID, its lane snapshot when applicable, definition
identity, cause/reason, and the same closed prior/result metadata facts used by
card metadata.

No-op, validation, ordering, candidate folding, budget, and atomicity rules
match C5A-3a. The cutover replaces lane-keyed mutation events and helpers
outright; there is no lane fallback or dual event shape.

##### C5A-3c — Stable-ID Pending Scheduling

Every pending effect has a match-unique stable pending-effect ID. Scheduling
and consumption address that ID; structural object equality is not an
identity mechanism. IDs are allocated deterministically from canonical match
state and are replayed as committed data. Wall time, object identity, array
position, and a second Frame-like chronology are forbidden.

One pending-effect operation exclusively proposes schedule and consume
transitions. A scheduled item captures the immutable effect payload, timing,
source context, owner/lane context, and provenance required to execute after
the original source has moved or left play. Duplicate IDs are invalid, and
consuming an absent ID is a defined no-op or typed invariant according to the
owning command contract—not an equality search for a similar payload.

When an item becomes due, ordering is:

1. snapshot the exact pending item by stable ID;
2. commit consumption of that ID into private candidate state;
3. interpret the snapshotted effect;
4. resolve all nested work under the same transaction and budget.

Consume-before-effect prevents nested resolution from observing and firing the
same pending item again. Atomic publication still means a later failure
publishes neither the consumption nor any effect result. Multiple due items
use their canonical pending order with stable ID as the final tie-breaker.

The clean cutover replaces payload-based
`PENDING_EFFECT_REMOVED` equality, direct queue filtering, and producer-owned
schedule events. No compatibility read of ID-less pending state remains.

##### C5A-3d — Transform After Stored-Power Reset

`TRANSFORM_CARD` becomes the only transform command, and one transform
operation exclusively proposes `CARD_TRANSFORMED`. Selection of the target
definition uses the transaction's scoped deterministic RNG and is fixed before
the transform sequence is enqueued.

For a transform that requests stat reset, ordering is mandatory:

1. execute governed `CHANGE_STORED_POWER { kind: 'RESET' }` against the old
   card identity and definition;
2. commit and resolve any resulting stored-Power reactions;
3. only then commit `CARD_TRANSFORMED`.

`CARD_TRANSFORMED` never writes, replaces, or clears the Power ledger. This
keeps Power policy and reaction routing exclusive and ensures that reset
semantics observe the pre-transform definition. If the Power reset or any
nested reaction fails, the transform is not published.

The transform commit preserves the card instance, owner, zone, lane, staged
payment record, and lifecycle classification while changing definition
identity and applying the transform operation's explicitly declared metadata
reset policy. It is not creation, play, movement, return, or reveal and emits
none of those reactions. Evaluator and built-in clients issue the same command;
neither constructs or applies `CARD_TRANSFORMED` directly.

All reset and transform work is one private atomic transaction. The cutover
removes the optional reducer-level `resetStats` behavior and all direct
transform-event producers rather than retaining a legacy transform path.

### C5B — Delete Superseded Control Paths

Delete:

- manual trigger helpers;
- evaluator-owned mutation commits;
- built-in direct event construction;
- direct `apply` migration exceptions;
- fallback event/envelope fields;
- dual schemas and compatibility aliases;
- obsolete characterization expectations replaced by target behavior.

### C5C — Permanent Architecture Gates

Enable AST/import/source fences that fail on:

- mutation-event construction outside owning operations;
- `apply` outside the allowlist;
- reaction invocation outside the dispatcher;
- active content importing engine implementation;
- providers/presentation importing kernel capabilities;
- unscoped gameplay randomness;
- missing semantic envelope closure.

### Phase 1.5 Exit

Phase 1.5 is complete only when:

- an ordinary card or location is authored in one folder;
- all active content compiles to valid immutable rules;
- every effect-originated mutation passes through one governed operation;
- every committed transition has complete historical semantics;
- every reaction is discovered exactly once from an event-local snapshot;
- the engine contains no dependency graph or mutable subscription lifecycle;
- reducers and replay remain policy/reaction blind;
- projections remain mutation-free;
- exceptional built-ins have only restricted command/query/RNG capabilities;
- terminal reconciliation passes across generated matches;
- no legacy or parallel engine route remains.

## Stop Conditions

Stop and redesign the current slice before merging if:

- the implementation introduces a persistent dependency graph;
- a content source registers/unregisters callbacks at runtime;
- `evalEffect` or a built-in still applies its own event;
- one lifecycle mutation has both kernel and manual reaction routes;
- a reaction reads post-state to guess a destroyed/moved entity's history;
- replay needs the dispatcher to reproduce state;
- a projection emits a mutation or reaction;
- the kernel publishes a partial failed transaction;
- ordering relies on incidental collection/import order;
- a new compatibility layer is proposed for unshipped internal data;
- provider or presentation code receives kernel mutation capabilities.

## What This Architecture Deliberately Optimizes

The kernel optimizes for:

- one mutation authority;
- local content authoring;
- deterministic resolution;
- exact replay;
- explicit ordering;
- bounded failure;
- testable architecture laws;
- clean future Rust translation.

It deliberately does not optimize for:

- minimum number of TypeScript types;
- arbitrary plugin callbacks;
- preserving every old fixture;
- speculative scale;
- clever incremental dependency invalidation.

The engine remains a small deterministic state machine. The kernel makes its
existing state/event flow exclusive and explicit rather than distributing that
flow across every effect producer.
