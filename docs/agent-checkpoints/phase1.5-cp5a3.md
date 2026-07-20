# Phase 1.5 C5A-3 — Metadata, Pending Work, and Transform

Status: in progress — C5A-3a and C5A-3b complete; C5A-3c and C5A-3d planned

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

Status: complete

`CHANGE_LOCATION_TAG` and `CHANGE_LOCATION_COUNTER` now exclusively govern
location-card metadata. Commands and events carry `LocationCardInstanceId`;
lane-oriented authored selectors are lowered once to current stable IDs before
mutation work starts. Reducer application patches that exact opaque location
record even after movement, replacement, or removal from a lane.

Owner-neutral and owner-scoped counters use one injective canonical key
encoding (`neutral:<name>` and `owner:<owner>:<name>`). Names remain
unrestricted, so neutral `P0:uses` cannot collide with owner-P0 `uses`.

Exit evidence:

- one pure operation is the sole producer of the three location metadata
  events;
- lane-keyed event fields and the lifecycle helper wrappers were removed
  outright;
- private candidate folding, exact no-ops, signed safe-integer arithmetic,
  provenance snapshots, semantic transition facts, budgets, and rollback are
  covered;
- adversarial tests prove a planned event still mutates the destroyed old
  instance after Ruin replacement and never touches Ruin;
- moved, discarded, destroyed, and missing stable identities are covered;
- neutral, P0, P1, and collision-shaped counter names are covered;
- Phase 1.5 is green at 19 files and 133 tests, focused location/evaluator
  scripts pass, and the production build is green.

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

C5A-3 is not complete. C5A-3a and C5A-3b are complete and exit-proven. C5A-3c
and C5A-3d remain planned and must not be reported as implemented until their
code, architecture fences, and full validation evidence land.
