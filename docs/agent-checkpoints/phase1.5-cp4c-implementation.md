# Phase 1.5 Checkpoint 4C — Governed Placement Lifecycle

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Result

C4C is implemented and exit-proven.

Lane movement, card creation, return, general zone changes, and deployment of
an existing deck instance now enter one transactional placement route.
Authored effects and built-ins issue present-tense commands; only
`kernel/operations/placement.ts` constructs their committed mutation events.

The next slice is C4D: play, reveal, and nested On Reveal invocation.

## Canonical Routes

```text
MOVE_CARD
  -> kernel/policies/movement.ts
  -> CARD_MOVED
  -> prior location onCardLeftHere
  -> destination location onCardEnteredHere
  -> moved card onMove

RETURN_CARD
  -> CARD_RETURNED_TO_LANE
  -> destination location onCardReturnedHere

CREATE_CARD
  -> CARD_CREATED
  -> destination location onCardCreatedHere (lane)
  -> active hand-entry policies (hand)

CHANGE_CARD_ZONE
  -> CARD_ZONE_CHANGED
  -> active hand-entry policies (hand)

DEPLOY_FROM_DECK
  -> select current existing deck instance
  -> CARD_ZONE_CHANGED to lane
```

`CARD_CREATED` is exclusively identity creation. `CARD_ZONE_CHANGED` is
exclusively movement of an existing identity. The old add-to-zone and
move-to-zone event families no longer exist in `MatchEvent`, reducers,
projections, presentation adapters, protocol schemas, or active tests.

The old `SPAWN_AND_REVEAL` authored primitive is deleted. Creation and
deployment are separate commands; reveal invocation is added by C4D.

## Operation and Policy Ownership

The placement operation owns:

- non-empty cause validation;
- current card and definition existence;
- active destination lane validation;
- hand and lane capacity;
- legal prior zones for return;
- no-op detection;
- current-deck selection for deployment;
- preservation of an existing instance during zone changes and deployment;
- construction of the four canonical placement events.

The pure movement policy owns `BLOCK_MOVE`. Generic and built-in movement can
no longer bypass it.

Denied placement is a normal no-op. No event or reaction is scheduled.

## Frozen Semantic Snapshots

The placement transaction captures immutable before/after facts at commit:

- card owner, zone, lane, and lane ordinal;
- prior and resulting face-up location instances;
- the exact relevant location ability lists;
- the moved card's effective `onMove` list;
- cause and semantic reason.

Reaction order is explicit:

1. prior location `onCardLeftHere` at timing band 100;
2. destination location `onCardEnteredHere` at timing band 200;
3. moved card `onMove` at timing band 300.

Return uses only `onCardReturnedHere`. Lane creation uses only
`onCardCreatedHere`. Neither masquerades as movement or hand-origin play.
Creating or changing a card into hand schedules the existing active hand-entry
policy at the contract's timing band.

## Existing-Instance Deployment

`DEPLOY_FROM_DECK` checks capacity before choosing from the current candidate
deck. It commits `CARD_ZONE_CHANGED`, not `CARD_CREATED`.

The deployment proof preserves:

- card ID;
- definition and owner;
- spawn provenance;
- stored power ledger;
- stored cost delta/history;
- tags and counters.

An empty deck, no selector match, or full lane is a normal no-op. Deployment
does not spend energy and does not count as a hand-origin play.

## Migrated Producers

- authored `MOVE`;
- authored `CREATE_CARDS_IN_ZONE`;
- authored `MOVE_CARD_TO_ZONE`;
- authored `RETURN_TO_LANE`;
- four movement built-ins;
- all built-in hand/lane creation paths;
- Leon's lane-to-hand return;
- Trauma Team;
- token creation for Security Detail and Riff Raff;
- discarded-card recovery.

Discarded-card recovery now correctly moves the existing instance to hand
instead of attempting to mint a duplicate identity.

## Authoring Surface

Location manifests now accept the precise hooks:

```json
{
  "onCardLeftHere": [],
  "onCardEnteredHere": [],
  "onCardCreatedHere": [],
  "onCardReturnedHere": []
}
```

`onCardEnteredHere` means lane-to-lane movement. Creation and return have their
own hooks, so location authors do not depend on ambiguous post-state inference.

## Proof

Focused C4C coverage proves:

- generic and built-in movement share policy and reaction routing;
- exact left → entered → moved-card reaction order;
- generic and built-in creation share `onCardCreatedHere`;
- generic and built-in return share `onCardReturnedHere`;
- creation does not fire movement, play, or reveal semantics;
- deployment preserves the complete existing card instance;
- the mutation inventory has one placement event-construction surface;
- protocol validation accepts the canonical events;
- replay/property provenance recognizes `CARD_CREATED`;
- no compatibility event shape remains in the active event union.

Canonical gate:

```bash
npm run verify:playgame:phase15
```
