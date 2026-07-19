# Phase 1.5 Checkpoint 1 — Capability-Kernel Contracts and Inventory

Status: complete. The contract decisions, producer/reaction inventory,
collision characterization, architecture inventory fence, and canonical
live/replay Frame proof are committed as executable evidence. No producer,
reaction, reducer, runtime, provider, presentation, or UI migration has
started.

Baseline:

- plan commit: `8e86f6b`
- annotated tag: `phase-1.5-baseline`
- Phase 0/1 authority remains closed
- the existing uncommitted Courthouse slice is treated as acceptance evidence,
  not as the final power representation

## Audit result

The reducer is centralized, but authoritative event construction currently has
six production surfaces:

1. `services/playgame/engine/resolve.ts`
2. `services/playgame/engine/effects/evaluator.ts`
3. `services/playgame/engine/effects/builtins.ts`
4. `services/playgame/engine/effects/power-change.ts`
5. `services/playgame/engine/draw.ts`
6. `services/playgame/runtime/opening.ts`

Reactions are attached to selected producer call sites rather than committed
semantic events. The same canonical event can therefore receive different
policy gates and reactions depending on which effect or built-in emitted it.

Concrete examples:

- generic destroy checks restrictions and invokes card/location destroyed
  hooks; Corporate Climber constructs `CARD_DESTROYED` directly and bypasses
  them
- generic move checks `BLOCK_MOVE` and invokes destination/card hooks; four
  built-ins construct `CARD_MOVED` directly and bypass them
- generic create/draw/return paths invoke selected entry reactions; built-in
  variants often do not
- `CARD_STAGED` immediately invokes location `onCardEnteredHere`, although the
  stage is private and reversible
- created-and-revealed cards currently invoke played-here reactions
- location reveal/effect dispatch is duplicated between normal turn
  resolution and runtime opening

The Phase 1.5 operation boundary is therefore necessary. It is not merely a
folder-organization change.

## Governed-operation inventory

| Operation family | Current canonical events | Highest-risk bypass or collision |
| --- | --- | --- |
| Play commitment/reveal | `CARD_STAGED`, `CARD_FLIPPED`, OR window events | private stage is conflated with entry; played-here is inferred after reveal and can use the wrong lane |
| Power | `CARD_POWER_CHANGED` | reset and hand-entry paths still bypass the current Courthouse seam; scalar state loses contribution identity |
| Cost | `CARD_COST_CHANGED` | evaluator and built-ins construct the same mutation independently |
| Destroy | `CARD_DESTROYED` | Corporate Climber bypasses immunity, friendly-destroy policy, deathrattle, and location reaction |
| Banish/discard | `CARD_BANISHED`, `CARD_DISCARDED` | origin zone/lane/owner and semantic reason are incomplete |
| Move/return | `CARD_MOVED`, `CARD_MOVED_TO_ZONE`, `CARD_RETURNED_TO_LANE` | overlapping meanings; built-ins bypass gates/hooks; no left-location reaction |
| Create/draw/hand entry | `CARD_ADDED_TO_*`, `CARD_DRAWN` | create events also reposition existing cards; hand-entry reactions are producer-specific |
| Transform | `CARD_TRANSFORMED` | built-in and evaluator producers; reset behavior is embedded in transform |
| Energy | energy/max/next-turn events | effect-originated max/bonus events lack cause |
| Location lifecycle | reveal/replace/destroy/shift events | reveal is duplicated; destroy/shift have reducers but no production operation |
| Status/scheduling | tag/text/counter/pending events | provenance and phase-specific effect kind are incomplete |

Migration order:

1. contract and characterization fences
2. location authoring with behavior/order parity
3. power/Courthouse vertical slice
4. destroy
5. move/zone move/return
6. create/draw/discard/hand entry
7. play/reveal and location lifecycle
8. cost, energy, status, pending, turn, and final architecture fences

No operation may have governed and ungoverned production paths at the same
checkpoint exit.

## Reaction contract

The target dispatcher consumes one committed event plus an immutable semantic
envelope. It snapshots subscribers and historical facts at commit time before
running any nested reaction.

Required envelope fields vary by event but include:

- source and precise effect phase/kind
- affected owner/controller
- semantic reason
- prior/resulting zone
- prior/resulting lane
- transition classification: hand play, lane move, creation, return,
  destruction, banishment, discard, reveal, or projection-only change
- original location identity/definition when a location reaction is eligible

The dispatcher owns one deterministic queue and one shared reaction budget.
Producer functions, built-ins, replay, providers, and presentation never
manually fire gameplay hooks.

Target behavior:

- private stage, unstage, and undo fire no committed gameplay reaction
- committed hand-origin play fires played-here exactly once
- create, play, move, and return are mutually classified
- suppressed On Reveal still counts as a committed play
- create-and-reveal does not count as hand play
- destroy retains its origin lane and original location subscriber even if a
  deathrattle removes/replaces the location
- lane move ordering is source-left, destination-entered, then moved-card
  reaction
- gained/lost-power hooks come only from committed stored mutations
- replay folds reaction results but never reruns the dispatcher

## Phase 1.1 `Frame`: deterministic sub-turn chronology

Turn number is too coarse for modifier provenance, play order, nested reactions,
and presentation. Wall-clock timestamps are forbidden because they would make
resolution and replay nondeterministic.

Phase 1.1 owns the only gameplay chronology:

- `Frame`: match-local canonical event order (`0` is genesis)
- `FramedEvent`: exactly one semantic event at one `Frame`
- committed transaction revision and ID
- transaction-local playback index

Phase 1.5 consumes that chronology; it must not add a `FrameStamp`, another
counter, or a second framing implementation:

```ts
interface CommittedFrameAddress {
  /** Canonical match-wide event coordinate. Sufficient for total ordering. */
  readonly frame: Frame;
  /** Commit grouping/debug address; not a second ordering authority. */
  readonly transactionRevision: number;
  readonly eventIndex: number;
}
```

`frame` is the canonical comparison key. The runtime attaches transaction
revision and event index when it commits the transaction; they must agree with
the same frame. A future log-free materialized state may change storage without
changing `Frame` semantics.

A frame belongs to a canonical gameplay event, not a CSS animation frame and
not a private staging preview.

Cards may retain bounded lifecycle frames such as `playedAt` or
`lastEnteredLaneAt` when rules require O(1) ordering queries. Full history
remains in committed transaction records; materialized card state does not copy
the entire match log.

## Power representation decision

`powerDelta: number` cannot be the source of truth.

Example:

1. a card gains `+4`
2. it enters Courthouse, which suppresses positive contributions
3. it then receives `-2`

The scalar becomes `+2`. From that number alone, the engine cannot know that
the correct effective Courthouse contribution is `-2` while the correct
restored contribution after leaving is `+2`.

A timestamp or stamp on the scalar does not restore the lost information.

Use active semantic modifier objects:

```ts
interface PowerModifier {
  readonly id: string;
  readonly delta: number;
  readonly cause: EffectRef;
  readonly appliedAt: Frame;
}

type PowerMutation =
  | { readonly kind: 'ADD'; readonly delta: number }
  | { readonly kind: 'SET'; readonly value: number }
  | { readonly kind: 'RESET' };
```

Operation semantics:

- `ADD` appends one active modifier
- `SET` replaces the active modifier set with one base-relative modifier
- `RESET` clears the active modifier set
- denied operations emit no mutation event and add no modifier
- ongoing modifiers remain live projections and never enter this ledger

Stored permanent power is:

```text
basePower + sum(active modifier deltas)
```

At Courthouse, effective permanent power is:

```text
basePower + sum(active modifier deltas where delta < 0)
```

Positive ongoing/lane contributions are suppressed separately by the
projection policy. Negative contributions remain effective.

For the example above:

- active modifiers: `[+4, -2]`
- stored value outside Courthouse: `base + 2`
- effective value inside Courthouse: `base - 2`

The existing `powerDelta` may remain temporarily as a derived/cache
compatibility field while selectors migrate. `powerLog` becomes stamped
semantic history rather than the source of active modifier state.

Each mutation event carries only the mutation and cause. The reducer maintains
the card's modifier collection; events do not resend the full array.

## Location-authoring audit

All 37 active locations already lower completely to the JSON-safe effect DSL.
There are no location `CALL_BUILTIN` effects or executable callbacks, so the
folder migration can be behavior-neutral.

The new layout mirrors cards:

```text
services/playgame/engine/manifest/location-sets/core-v1/
  set.json
  locations.generated.ts
  locations/<def-id>/location.json
```

Each authored file explicitly includes the currently derived definition data
plus authoring-only metadata:

- `status`
- `implementationNote`
- `poolOrder`

`poolOrder` is load-bearing. Current seeded location selection consumes
`Object.values(manifest.locations)` insertion order. Alphabetically generated
modules would silently change deterministic matches. The migration preserves
the current `0..36` catalog order explicitly, validates uniqueness/contiguity,
and constructs the runtime location record in that order.

Checkpoint 2 adds:

- strict authored-location and recursive DSL validation
- deterministic generator/check
- location loader
- normalized 37-location parity fixture
- seeded location-selection parity
- asset-workbench JSON support
- `locations:generate`, `locations:generate:check`, and
  `locations:validate`

The centralized TypeScript catalog is archived only after bootstrap, card
cross-reference validation, assets, tests, and all active imports use the new
loader.

## Architecture fences

Final canonical-event construction allowlist:

- event type declarations
- `services/playgame/engine/operations/**`
- tests and engine testkit

Final direct-`apply()` allowlist:

- reducer implementation
- operation commit helper
- transaction/replay folds
- runtime private-plan and authoritative transaction folds
- headless CLI fold
- tests and testkit

`evaluator.ts`, `builtins.ts`, `resolve.ts`, `draw.ts`, and
`runtime/opening.ts` are migration sources, not permanent exceptions.

## Checkpoint-1 verification

- `lifecycle-reaction-characterization.test.ts` freezes seven current
  producer-specific collisions: stage/unstage, generic versus built-in move,
  destroy, create, return, hand entry, and spawn-and-reveal.
- `phase15-mutation-boundary.characterization.test.ts` uses the TypeScript AST
  to lock every current mutation-event constructor and manual reaction call
  surface. Any new bypass surface fails the inventory fence.
- `phase15-frame-continuity.test.ts` proves that transaction-local indexes may
  reset while canonical `Frame` values continue, and that replay consumes the
  exact live `FramedEvent` sequence without a second chronology.
- The three focused Checkpoint-1 files pass 10/10 tests.
- The Phase 0 runtime/property gate remains green at 71/71 tests with 200
  generated cases.

The modifier-ledger `+4, -2`, `SET`, and `RESET` acceptance cases belong to
Checkpoint 3, where the scalar `powerDelta` source of truth is removed. They
must be executable target tests before that migration begins and green before
Checkpoint 3 exits; Checkpoint 1 intentionally does not add a second temporary
power representation.
