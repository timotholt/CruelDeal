# Phase 1.5 C5A-3 — Metadata, Pending Work, and Transform

Status: in progress — C5A-3a complete; C5A-3b through C5A-3d planned

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Checkpoint Goal

C5A-3 moves the remaining card/location metadata, pending-effect scheduling,
and transform mutation families behind exclusive governed operations. Each
family must have one command path, one event producer, complete committed
semantics, deterministic ordering, private candidate folding, finite budgets,
and all-or-nothing publication.

There is no compatibility requirement. Each slice removes its superseded
event shape, helper, direct producer, fallback read, and dual-write path before
exit.

## Ordered Slices

### C5A-3a — Card Metadata

Status: complete

Govern authored persistent card tags, signed counters, and text override
set/clear through:

- `CHANGE_CARD_TAG`;
- `CHANGE_CARD_COUNTER`;
- `OVERRIDE_CARD_TEXT`.

The card-metadata operation must be the sole producer of
`CARD_TAG_ADDED`, `CARD_TAG_REMOVED`, `CARD_COUNTER_CHANGED`, and
`CARD_TEXT_OVERRIDDEN`. It must preserve exact prior/result semantics, reject
invalid provenance and counter arithmetic, make redundant mutations exact
no-ops, and publish no prefix on failure.

Play, move, and destruction chronology is lifecycle state rather than card-tag
metadata. The reducer must not directly store `PLAYED_THIS_TURN`,
`MOVED_THIS_TURN`, `DESTROYED_THIS_TURN`, or `EVER_MOVED` tags. Transform
metadata reset remains explicitly owned by C5A-3d.

Exit evidence:

- evaluator and built-in clients use only the governed commands;
- raw event-construction and direct-apply fences prove exclusive ownership;
- the superseded `operations/cardMutations.ts` helper surface is deleted;
- engine-owned played, moved, and destroyed markers are lifecycle indexes,
  with authored `HAS_TAG`/query behavior preserved by derived status reads;
- tag payload identity, kind-scoped removal, counter arithmetic, semantic text
  equality, compositional blanking, copied-text provenance, no-op, payload
  snapshot, ordered-batch, budget, and rollback behavior are covered;
- `npm run verify:playgame:phase15` is green:
  - Phase 1.5: 18 files, 125 tests;
  - Phase 0/runtime: 12 files, 80 tests with 200 generated matches per
    property run;
  - TypeScript protocol: 5 tests;
  - Rust protocol: 2 tests;
  - protocol schema, 128 cards, 38 locations, lint, and production build.

### C5A-3b — Location Metadata by Stable Identity

Status: planned after C5A-3a

Replace lane-keyed location metadata mutation with
`LocationCardInstanceId`-keyed commands and events. Lane selectors resolve to
the exact current location instance at command execution. Nested replacement,
Ruin, movement, or lane topology changes must never redirect an already
planned metadata mutation to a different location card.

Exit requires sole event ownership, exact identity semantics, owner-scoped
counter coverage, nested replacement tests, and removal of lane fallback
shapes.

### C5A-3c — Stable-ID Pending Scheduling

Status: planned after C5A-3b

Give every pending effect a deterministic match-unique stable ID. Schedule and
consume by ID rather than structural equality. When due, snapshot the item,
commit its consumption first, and then execute its frozen effect within the
same atomic transaction.

Exit requires deterministic ID allocation, stable multi-item ordering,
consume-before-effect reentrancy coverage, exact replay/reconciliation, and
removal of ID-less pending state and direct queue filtering.

### C5A-3d — Transform After Stored-Power Reset

Status: planned after C5A-3c

Make one transform operation the sole `CARD_TRANSFORMED` producer. A resetting
transform must execute governed stored-Power reset and its nested reactions
before the transform commit. The transform reducer event must never mutate the
Power ledger.

Exit requires evaluator/built-in parity, deterministic scoped-RNG selection,
reset-before-transform trace tests, atomic rollback coverage, lifecycle
classification tests, and removal of reducer-level `resetStats` and all direct
transform event producers.

## Ordering and Stop Rules

The implementation order is fixed: C5A-3a, C5A-3b, C5A-3c, C5A-3d. A later
slice may begin only after the earlier mutation family has one canonical path
and its focused tests are green.

Stop and redesign a slice if it introduces:

- parallel governed and direct producers;
- lane identity as a substitute for location-card identity;
- structural pending-effect equality as identity;
- effect-before-consume pending execution;
- Power-ledger mutation inside `CARD_TRANSFORMED`;
- a compatibility alias, fallback, adapter, or dual-write path;
- partial publication after a failed nested transaction.

## Current Exit Decision

C5A-3 is not complete. C5A-3a is complete and exit-proven. C5A-3b is the next
implementation slice. C5A-3c and C5A-3d remain planned and must not be reported
as implemented until their code, architecture fences, and full validation
evidence land.
