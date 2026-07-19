# Phase 1.5 Checkpoint 4B — Governed Destroy and Banish

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Result

C4B is implemented and exit-proven.

Destroy and banish now enter the transactional rules kernel as present-tense
commands. Their mutation events have one production constructor, all built-ins
use the governed route, and lane destruction sends every occupant through the
same destruction command and policies as authored effects.

The next implementation slice is C4C: move, enter, leave, create, and return.

## Canonical Routes

```text
DESTROY_CARD
  -> kernel/policies/destruction.ts
  -> kernel/operations/lifecycle.ts
  -> CARD_DESTROYED
  -> affected card onDestroyed
  -> original location onCardDestroyedHere

BANISH_CARD
  -> kernel/operations/lifecycle.ts
  -> CARD_BANISHED
  -> original location onCardBanishedHere
```

`kernel/operations/lifecycle.ts` is the sole production constructor for
`CARD_DESTROYED` and `CARD_BANISHED`. It proposes immutable commit work and
never invokes the reducer.

The match-specific lifecycle transaction privately folds candidates, captures
before/after semantics, snapshots reactions, and publishes a result only after
the bounded kernel queue completes.

## Destruction Policy

The pure destruction policy owns:

- lane-origin validation;
- `DESTROY_IMMUNE`;
- generic `BLOCK_DESTROY`;
- owner-relative `BLOCK_FRIENDLY_DESTROY`;
- lane and target filtering for friendly-destroy protection.

Denied destruction is a normal no-op. It emits no event and schedules no
reaction.

Both-seat tests prove that friendly card sources are blocked and enemy card
sources remain eligible for each protected owner.

## Frozen Historical Reactions

`CARD_DESTROYED` captures, before candidate mutation:

- card identity, owner, zone, lane, and slot;
- the card's effective `onDestroyed` effects;
- the face-up location instance and definition at the prior lane;
- the original location's `onCardDestroyedHere` effects;
- immutable cause and semantic reason.

Reaction work is discovered once at commit time. The affected card resolves at
timing band 100 and the original location at timing band 200.

This fixes the old post-state lookup defect. If `onDestroyed` replaces or
removes the location, the already-snapshotted original location reaction still
runs exactly once.

`CARD_BANISHED` captures the same prior placement and location facts.
`onCardBanishedHere` runs only when the card committed from a face-up
location's lane. Hand, deck, discard, and destroyed-zone banishment has no
historical location reaction.

## Nested Resolution

Nested destruction remains depth-first:

1. parent destroy commits;
2. affected-card death work runs;
3. any nested destroy and its reactions complete;
4. the parent original-location reaction runs.

The evaluator bridge returns already-resolved nested event batches to the same
private candidate fold. Those commits are explicitly marked so the dispatcher
does not discover their reactions twice. This bridge is kernel-owned migration
plumbing, not a second lifecycle producer; C4D deletes it when all authored
effect interpretation lives directly on the work queue.

## Migrated Producers

- authored `DESTROY`;
- authored `BANISH`;
- resolved-spell cleanup;
- Corporate Climber;
- all three replacement-card built-ins that banish the replaced hand card;
- lane destruction and destroy-all-other-lanes occupants.

Corporate Climber now receives normal immunity, friendly-destroy, death, and
location behavior. It gains the pre-destruction Power only of cards whose
governed destruction actually committed.

## Authoring Surface

Location manifests now accept:

```json
{
  "onCardBanishedHere": []
}
```

The hook is included in location schema validation, implementation audit, and
ability-presence projection. Content remains declarative; no location imports
engine code.

## Proof

Focused C4B coverage proves:

- generic and built-in destruction share policies and reactions;
- destruction protection is owner-correct for both seats;
- affected-card then original-location ordering;
- the original location survives nested replacement as a frozen rule source;
- nested destruction is depth-first and reactions are not duplicated;
- lane occupants use ordinary governed destruction;
- lane destruction remains atomic when an occupant survives;
- banish-here receives frozen lane and owner context for both seats;
- spell cleanup and replacement built-ins use governed banish;
- raw destroy/banish construction has one production surface;
- kernel replay of already-resolved effect batches does not double-dispatch.

Canonical gate:

```bash
npm run verify:playgame:phase15
```

Evidence at close:

- Phase 1.5/kernel suite: 12 files, 73 tests, all green;
- runtime/property suite: 12 files, 80 tests, all green at 200 cases;
- location lifecycle and architecture suite: green;
- evaluator and active-content effect suites: green;
- TypeScript and Rust protocol suites: green;
- schema and generated card/location drift checks: green;
- 128 cards and 38 locations validate;
- production build: green.
