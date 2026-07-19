# Phase 1.5 C4A Readiness

Status: complete  
Date: 2026-07-19  
Scope: behavior-neutral prework required before kernel implementation  
Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Decision

C4A is ready to implement.

The implementation slice is deliberately narrow:

1. build the private bounded work loop and governed commit seam;
2. migrate permanent stored-power mutation as the only production operation;
3. enforce the existing Courthouse positive-power prohibition as a precommit
   policy;
4. prove one test-only smoke reaction through the queue;
5. preserve power ledger, Frame, RNG, replay, and reconciliation behavior;
6. leave destroy/move/play lifecycle migration for C4B through C4D.

This checkpoint does not implement the dispatcher or migrate runtime behavior.

## Executable Contracts Added

`services/playgame/engine/kernel/contracts.ts` now freezes:

- the clean target lifecycle vocabulary;
- the exact prior/result zone matrix;
- mandatory owner, cause, and entity semantics;
- exact before/after rule-source snapshot edges;
- deterministic reaction timing bands and tie-break dimensions;
- private planning events that never dispatch gameplay reactions;
- current lifecycle event shapes that must be deleted at cutover;
- the permanent stored-power pilot;
- finite work/event/reaction/effect-depth/entity budgets;
- typed invariant failure codes;
- all-or-nothing kernel failure publication semantics.
- existing-instance deck deployment semantics;
- natural versus retriggered On Reveal invocation;
- Wong multiplier, ability-list, selector, and nested-work snapshot timing;
- the mandatory Wong/Jubilee/repeater C4D golden trace.

`services/playgame/engine/kernel/contracts.test.ts` makes those decisions
executable and guards them before runtime migration begins.

## Clean Event Cutover

C4A and later lifecycle slices must replace old types and callers atomically.
No aliases or parallel reads are allowed.

| Current ambiguous shape | Clean replacement |
| --- | --- |
| `CARD_FLIPPED` | `CARD_REVEALED`, plus `CARD_PLAY_COMPLETED` only for hand-origin play |
| `CARD_ADDED_TO_DECK` | `CARD_CREATED` with deck destination |
| `CARD_ADDED_TO_HAND` | `CARD_CREATED` with hand destination |
| `CARD_ADDED_TO_LANE` | `CARD_CREATED` with lane destination |
| `CARD_MOVED_TO_ZONE` | `CARD_ZONE_CHANGED` |

Stage and unstage remain private planning events. They do not enter committed
reaction dispatch.

## Atomic Failure Contract

A policy denial is a normal denied/no-op command result.

A kernel invariant failure is not player illegality and must never be stored as
`RULES_INVALID`. It rejects the submission with a typed internal error.

No failed transaction may:

- publish an event or Frame;
- store the failing receipt;
- advance revision or serialized RNG;
- mutate canonical state;
- retain the second `END_TURN` lock;
- prevent retry of the failed intent ID.

If the first seat already locked successfully, that accepted lock remains. The
second lock and resolution are accepted atomically only after the candidate
transaction succeeds.

The current runtime accepts the second lock receipt before turn resolution.
That behavior is a named C4A migration defect, not a compatibility requirement.

## Ordering Decisions

The stable ordering key is:

1. timing band;
2. priority-seat rank;
3. active lane ordinal;
4. canonical card slot;
5. authored rule index;
6. stable source instance ID.

Required initial timing bands include:

- destroy: affected card 100, original location 200;
- move: source-left 100, destination-entered 200, moved-card 300;
- stored power: affected-card gained-power 100, location gained 200, location
  lost 300;
- reveal: card On Reveal 100, location revealed-here 200;
- completed play: any-card-played-here 100, location played-here 200.

## Pilot Proof Obligations

The stored-power vertical slice must prove:

- every positive and negative stored mutation uses one governed command;
- Courthouse blocks positive stored power without deleting prior ledger
  history;
- moving away from Courthouse restores the visibility of previously committed
  stored power through projection;
- projection recomputation emits no gained/lost-power reaction;
- accepted mutation cause/provenance survives in `PowerLedgerEntry`;
- replay folds committed power facts and never runs the dispatcher;
- one nested test reaction is deterministic and exactly once;
- budget exhaustion publishes no prefix;
- runtime remains the only Frame authority.

## Repeatable Gate

Run:

```bash
npm run verify:playgame:phase15
```

The gate executes:

- scoped Phase 1.5 lint;
- focused Phase 1.5/kernel/ledger/replay/RNG tests;
- the 200-case runtime property suite;
- TypeScript and Rust protocol tests plus schema drift check;
- card and location generation drift checks and manifest validation;
- production build.

The repository-wide `tsc --noEmit` baseline is currently red across unrelated
legacy UI, authoring, city-map, deprecated content, and presentation files. The
new kernel contract files are lint-clean and compile through Vitest/Vite. C4A
must not add errors to that baseline; repairing the unrelated global type debt
is outside this checkpoint.

## Implementation Boundaries

C4A may add implementation under:

- `services/playgame/engine/kernel/`;
- the stored-power owning operation;
- the minimum runtime publication seam required for atomic completion;
- focused kernel/runtime tests;
- exports and architecture fences.

C4A must not:

- migrate destroy, move, create, return, play, or reveal early;
- add a dependency graph or mutable subscription registry;
- introduce a second Frame or RNG authority;
- preserve old internal shapes with compatibility adapters;
- let replay dispatch reactions;
- let a built-in or evaluator commit a mutation directly for the migrated
  operation;
- turn a kernel invariant failure into player illegality.

## C4D Nested-Reveal Prework

The architecture now explicitly reserves:

- `DEPLOY_FROM_DECK` for moving an existing instance from deck to lane;
- `INVOKE_ON_REVEAL` for both natural and retriggered ability execution;
- `CREATE_CARD` for actual new instances.

The current `SPAWN_AND_REVEAL` effect is not preserved. It must lower either to
creation plus invocation or to existing-instance deck deployment.

On Reveal multipliers and the ability list snapshot once per invocation.
Effect expressions read current candidate state, selectors snapshot once per
effect execution, and nested commands resolve depth-first. Retriggers do not
emit fake reveal, completed-play, or played-here facts.

These decisions do not expand the C4A implementation slice. They prevent C4A's
work-loop types from being designed in a way that blocks the later C4D cascade.

## Evidence at Readiness Close

- focused Phase 1.5 suite: 9 files, 46 tests, all green;
- new kernel/source runner scoped lint: green;
- Phase 0 runtime suite: 12 files and 79 tests green at 200 generated cases;
- production build: green;
- protocol schema check: green;
- no production gameplay behavior changed by this prework.

The next action is C4A implementation, beginning with the private transaction
types/work loop and permanent stored-power vertical slice.
