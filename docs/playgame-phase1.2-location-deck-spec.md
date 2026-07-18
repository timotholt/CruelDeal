# Phase 1.2 — First-Class Location Deck

## Status

Implementation active. Checkpoint 1 is complete; checkpoint 2 is next.

This phase sits after the Phase 1.1 canonical frame/chronology work and before
Phase 1.5 governed operations, reactions, and folder-based location authoring.
It does not reopen the Phase 1 runtime-authority design.

## Executive Decision

Locations become first-class, deckable game pieces with their own system-owned
deck.

Every match bootstrap supplies exactly three frozen deck snapshots:

1. the P0 player deck
2. the P1 player deck
3. the location deck

The location deck is passed through `MatchSession` to `MatchRuntime`; the engine
must no longer discover locations by enumerating the manifest during state
initialization.

Locations are **location cards**, but they are not ordinary player cards.
`LocationCardDef` and `LocationCardInstance` share generic deck/bootstrap
mechanics with `CardDef` and `CardInstance` while retaining separate zones,
operations, validation, and events. A location card can never enter a player's
deck, hand, or lane-card slot, and a player card can never enter the location
deck or a lane's location slot.

## Product Goal

Locations should be as easy to reason about as a third deck:

```text
P0 deck          -> controlled by P0
P1 deck          -> controlled by P1
Location deck    -> controlled by the match system
```

Every lane owns exactly one location slot. During pre-game setup, each lane
draws and plays one location card face-down into its own slot:

```text
Left lane draws Courthouse from the location deck
Left lane plays Courthouse face-down into its location slot
```

The first turn cannot begin until all three slots are occupied face-down. At
the configured start of a turn, the location card scheduled for that turn is
revealed before players can act.

Replacing, moving, swapping, destroying, revealing, concealing, or privately
showing location cards should then be expressed as canonical game operations
and events rather than direct lane-state mutation. This gives replay,
seat-specific information, reactions, presentation, and future location rules
one authoritative history.

A lane and its location card are different entities. Destroying a location
card atomically swaps that card for a revealed, inert `Ruin`; it never leaves
the active lane's location slot empty. Destroying a lane removes the whole
gameplay space—including its location slot—from the active board. Lane
identity is stable and independent of its current left-to-right position so
future rules can create, remove, or reorder lanes without renumbering existing
history.

## Core Problem

The current engine does not have a location-deck concept. Initial state creation
selects three definitions directly from `manifest.locations` and embeds
instances in lanes. That collapses three separate responsibilities:

- defining which locations exist
- selecting which locations belong to this match
- placing locations into lanes

Because selection and placement happen as initializer logic rather than
gameplay operations:

- the match bootstrap is not the complete input to the simulation
- replays cannot identify a supplied location-deck snapshot
- setup does not produce the same semantic history as later location changes
- replacement and swap effects lack a natural source/destination model
- location selection depends on manifest enumeration details
- future collection, mode, scenario, or matchmaking code has no clean seam for
  supplying a location pool or ordered deck

The fix is not another location-selection helper. The missing abstraction is a
first-class location deck plus a governed location lifecycle.

## Required Invariants

Phase 1.2 is complete only when all of the following are true:

1. Every normal match is created from P0, P1, and location deck snapshots.
2. `MatchRuntime` remains the sole live authority for deck and lane state.
3. The manifest defines possible content; it never silently decides match
   content during runtime initialization.
4. Location-deck order is deterministic and part of replayable match input.
5. Initial lane population occurs through canonical location draw/play events.
6. A location card instance has exactly one zone at a time.
7. Every lane owns exactly one location slot, and that slot stores at most one
   location card instance ID.
8. A location card definition or instance can never enter a player-card
   container.
9. A player card definition or instance can never enter a location container.
10. Replacing, moving, swapping, destroying, banishing, and returning a
    location use location operations; callers do not mutate lanes directly.
11. At `MATCH_SETUP_COMPLETED`, every lane location slot is occupied by a
    face-down location card and no location has mechanically revealed.
12. A location card's face state is distinct from which seats know its
    identity.
13. A seat projection never exposes a location card identity or future deck
    order that the seat is not allowed to know.
14. Every canonical location event receives the Phase 1.1 frame envelope.
15. Replay folds committed location events but never reruns setup selection or
    gameplay reactions.
16. Presentation observes location events and cannot decide whether they
    commit.
17. The same validated bootstrap, seed, ruleset, and intents produce the same
    location card instances, events, frames, and final state.
18. Every lane has a stable `LaneId`; its current ordinal position is derived
    from canonical active-lane order and is never its identity.
19. Destroying a location card and destroying its lane are separate governed
    operations.
20. A destroyed lane is removed from active play but retained as an immutable
    replay-addressable tombstone.
21. Ordinary cards, locations, scoring, and player intents cannot target a
    lane in `CREATING`, `DESTROYING`, or `DESTROYED` state unless a governed
    lifecycle operation explicitly permits it.
22. The core ruleset permits at most three active lanes. Destroyed lane
    tombstones do not count toward that maximum.
23. Creating a lane creates a new `LaneId`; it does not resurrect or reuse a
    destroyed lane identity.
24. At least one lane must remain active. A three-lane match may destroy at
    most two lanes; destruction of the final lane is rejected atomically.
25. Destroying a location card replaces it with the revealed, inert `Ruin`
    location card in one atomic event. It never creates an observable
    locationless lane and does not destroy the lane.
26. Lane destruction destroys every player card in that lane through the
    ordinary governed card-destruction path. Immunity, destruction gates, and
    destruction reactions are not bypassed.

## Non-Goals

Phase 1.2 does not:

- merge `CardDef` and `LocationCardDef`
- merge `CardInstance` and `LocationCardInstance`
- permit players to put locations in ordinary decks
- introduce location ownership or collection entitlements
- create player-authored location decks as a product feature
- implement player-accessible lane creation
- implement the Phase 1.5 reaction dispatcher
- invent every future location hook
- migrate location card definitions into folders
- redesign location UI or presentation
- add executable callbacks to content definitions
- make reducers responsible for location policy

Phase 1.2 establishes the representation and lifecycle that Phase 1.5 will use.

## Terminology

Use these terms consistently:

- **location card definition** — immutable manifest content describing a
  location card
- **location deck entry** — a reference to a location card definition in a
  match deck snapshot
- **location card instance** — the runtime identity created from one deck entry
- **location slot** — the single location position belonging to a lane
- **location deck** — the system-controlled ordered source of location
  instances
- **location staging** — the transient zone between drawing a location and
  playing it into a lane
- **location operation** — the governed command that validates policy and
  produces past-tense events
- **lane ID** — stable identity that survives lane reordering or destruction
- **active lane order** — the current left-to-right sequence of targetable
  lanes
- **lane tombstone** — retained destroyed-lane state used by replay,
  provenance, and historical event references

Use “location card” in product and engine language. Do not shorten it to
“player card” or accept it through ordinary card APIs; the domain types remain
distinct.

## Target Bootstrap Contract

The public shape should preserve the existing `decks` concept while making the
third deck explicit and statically typed:

```ts
type MatchDeckSlot = Seat | 'LOCATIONS';

interface DeckBootstrapBase<TEntry> {
  readonly deckId: string;
  readonly revision: number;
  readonly name: string;
  readonly entries: readonly TEntry[];
  readonly contentHash: string;
}

interface PlayerDeckBootstrap
  extends DeckBootstrapBase<PlayerDeckEntry> {
  readonly kind: 'PLAYER';
}

interface LocationCardDeckEntry {
  readonly defId: LocationCardDefId;
}

interface LocationDeckBootstrap
  extends DeckBootstrapBase<LocationCardDeckEntry> {
  readonly kind: 'LOCATION';
  /**
   * Location entries are already in canonical draw order.
   * MatchRuntime must not reshuffle them.
   */
  readonly order: 'PRESERVE';
}

interface MatchBootstrap {
  // Existing match, participant, seed, ruleset, and manifest fields remain.
  readonly decks: Readonly<{
    readonly P0: PlayerDeckBootstrap;
    readonly P1: PlayerDeckBootstrap;
    readonly LOCATIONS: LocationDeckBootstrap;
  }>;
}
```

`LOCATIONS` is a deck slot, not a third seat. It has no participant, readiness
state, energy, hand, or player intent queue.

The location deck's `entries` are an ordered draw list. This is deliberately
more explicit than the current player-deck behavior: the producer of the
bootstrap decides location membership and order, and `MatchRuntime` preserves
it. This prevents the engine from applying a second hidden selection policy.

Player-deck shuffle semantics do not need to change in Phase 1.2.

## Default Location Deck Factory

Normal/debug match creation needs an adapter that supplies the new bootstrap
field:

```ts
interface LocationDeckFactory {
  build(input: {
    readonly manifest: Manifest;
    readonly ruleset: MatchRuleset;
    readonly seed: string;
  }): LocationDeckBootstrap;
}
```

The default compatibility factory:

1. reads eligible location card definitions before the runtime is constructed
2. performs the current seeded, rarity-weighted sampling without replacement
3. continues sampling to produce a complete ordered permutation, not only the
   first three entries
4. freezes that exact order in `LocationDeckBootstrap.entries`
5. computes `contentHash` over the canonical ordered entries and construction
   policy version

The first three entries must initially match the current three-location
selection for the same manifest, ruleset, and seed. Remaining entries form the
reserve used by replacement/draw effects.

The compatibility factory is an entry adapter, not simulation authority. Once
the bootstrap exists, the runtime must not enumerate `manifest.locations` to
select substitutes.

Future modes may supply a curated location deck, a scenario-defined order, or a
different factory without changing runtime or reducer contracts.

## Validation

Bootstrap validation must reject a match before runtime construction when:

- the `LOCATIONS` deck is missing
- `kind` does not match the deck slot
- the location deck is smaller than
  `initialLaneCount + minimumReserveCount`
- an entry does not resolve to an enabled `LocationCardDef`
- a player deck entry resolves only as a location
- a location deck entry resolves only as a player card
- the deck exceeds the ruleset copy limit
- duplicate locations appear when the ruleset requires uniqueness
- the ordered content does not match `contentHash`
- the deck, entries, or nested values are mutable after validation

Ruleset configuration should own lane topology and location-deck constraints
separately:

```ts
interface LaneRules {
  readonly initialLaneCount: number;
  readonly maximumActiveLaneCount: number;
}

interface LocationDeckRules {
  readonly minimumReserveCount: number;
  readonly copyLimit: number;
}
```

The normal core ruleset should initially require one unique location per entry
and enough entries to populate every initial lane. Its `LaneRules` sets both
`initialLaneCount` and `maximumActiveLaneCount` to `3`. Tests may use an
explicit fixture ruleset with a smaller deck; production validation must not
silently accept it.

Collection ownership validation remains out of scope.

## Runtime State

Normalize location state instead of embedding mutable location objects directly
inside lanes:

```ts
type LocationZone =
  | 'DECK'
  | 'STAGING'
  | 'LANE'
  | 'DISCARD'
  | 'DESTROYED'
  | 'BANISHED';

type LocationCardFace = 'FACE_DOWN' | 'FACE_UP';

interface LocationCardInstance {
  readonly id: LocationCardInstanceId;
  readonly defId: LocationCardDefId;
  readonly sourceDeckEntry: number;
  readonly zone: LocationZone;
  readonly laneId: LaneId | null;
  readonly pendingLaneId: LaneId | null;
  /**
   * Mechanical orientation. FACE_UP means globally revealed and active.
   * It is not the same thing as private identity knowledge.
   */
  readonly face: LocationCardFace;
  /**
   * Seats that have learned this instance's identity while it is face-down.
   * Knowledge is tied to this instance and does not transfer to a replacement.
   */
  readonly identityKnownTo: ReadonlySet<Seat>;
  readonly revealCount: number;
  readonly tags: readonly string[];
  readonly counters: Readonly<Record<string, number>>;
  /** Canonical Phase 1.1 gameplay frames; never a second location timestamp. */
  readonly createdAt: Frame;
  readonly drawnAt?: Frame;
  readonly playedAt?: Frame;
  readonly revealedAt?: Frame;
}

interface LocationDeckState {
  readonly drawPile: readonly LocationCardInstanceId[];
  readonly staging: readonly LocationCardInstanceId[];
  readonly discardPile: readonly LocationCardInstanceId[];
  readonly destroyed: readonly LocationCardInstanceId[];
  readonly banished: readonly LocationCardInstanceId[];
}

interface LocationSlotState {
  readonly laneId: LaneId;
  readonly locationCardId: LocationCardInstanceId | null;
  /**
   * Default core rules schedule the initial left/center/right lane IDs for
   * their corresponding turn-start reveals. Effects may reschedule or cancel
   * this boundary.
   */
  readonly revealAtTurn: number | null;
}

type LaneStatus = 'CREATING' | 'ACTIVE' | 'DESTROYING' | 'DESTROYED';

interface LaneState {
  readonly id: LaneId;
  readonly status: LaneStatus;
  /** Every lane owns this slot from lane creation onward. */
  readonly locationSlot: LocationSlotState;
  readonly createdAt: Frame;
  readonly destroyedAt?: Frame;
}

interface LaneTopologyState {
  /**
   * Canonical current left-to-right order. Contains ACTIVE lanes only.
   * Position is derived from this list and is never used as stable identity.
   */
  readonly activeLaneOrder: readonly LaneId[];
  /**
   * Includes active lanes and destroyed tombstones.
   */
  readonly lanesById: Readonly<Record<LaneId, LaneState>>;
}

interface MatchState {
  // Existing match fields remain.
  readonly laneTopology: LaneTopologyState;
  readonly locationDeck: LocationDeckState;
  readonly locationCards: Readonly<
    Record<LocationCardInstanceId, LocationCardInstance>
  >;
}
```

`STAGING` is necessary because drawing and playing are separate canonical
events. A valid state must exist between them. A staged location card records
its intended lane but is not yet that lane's active location card.

`DISCARD`, `DESTROYED`, and `BANISHED` remain distinct semantic destinations.
Rules may later return discarded or destroyed locations to the deck; banished
locations are outside normal recovery.

Lanes own slots and slots reference instance IDs. The location-card registry is
the single source of instance facts.

### Stable lane identity and dynamic topology

`LaneId` replaces array index as the canonical lane reference everywhere in
gameplay state, operations, events, reactions, and replay. Player-card
instances must likewise store `laneId`, not a positional index.

The initial core match still creates exactly three lanes in deterministic
left-to-right order. Their initial positions may be projected as 0, 1, and 2,
but those numbers are presentation/order facts. If the left lane is destroyed,
the former center lane remains the same `LaneId`; it merely becomes the first
entry in `activeLaneOrder`.

Destroyed lanes remain in `lanesById` as tombstones. This preserves:

- historical event and frame references
- the original location-slot identity
- destruction provenance
- deterministic replay and debugging

Normal selectors enumerate `activeLaneOrder`. A destroyed lane disappears from
the playable board, board layout, scoring, and normal target selection.
Historical/debug selectors may resolve its tombstone explicitly.

The core ruleset enforces `activeLaneOrder.length <= 3`. A future lane-creation
operation may add a new lane only while fewer than three active lanes exist.
The new lane receives a new deterministic `LaneId`, a new location slot, and an
explicit insertion position in `activeLaneOrder`; it never reuses a destroyed
lane's identity.

### Face state and player knowledge

`face` and `identityKnownTo` solve different problems:

- `FACE_UP` is a mechanical reveal. The location is globally active, both seats
  may know its identity, and the committed reveal may trigger reveal behavior.
- `FACE_DOWN` is a mechanical state. Its globally revealed behavior has not
  occurred or it has subsequently been turned face-down.
- `identityKnownTo` permits an effect to show a face-down location card to P0,
  P1, or both without mechanically revealing it.

Privately showing a location must not emit `LOCATION_REVEALED`, run global
reveal behavior, or flip the shared location card. It changes only canonical
seat knowledge.

Knowledge is attached to a location card instance. If that card is replaced,
knowledge of the old instance does not disclose the new instance. Once a seat
has learned an instance's identity, normal concealment cannot make the human
player forget it; a visual effect may obscure it, but rules and AI information
must still treat that seat as knowing it.

## Setup Frames

Phase 1.1 owns the global frame counter and event envelope. Phase 1.2 consumes
that mechanism; it does not create a second sequence number.

Game setup occupies canonical frames before the first playable turn. A typical
setup history is:

```text
Frame 0   MATCH_SETUP_STARTED
Frame 1   PLAYER_DECK_INITIALIZED(P0)
Frame 2   PLAYER_DECK_INITIALIZED(P1)
Frame 3   LOCATION_DECK_INITIALIZED
Frame 4   LOCATION_DRAWN(location card A, target lane-left)
Frame 5   LOCATION_PLAYED(location card A, lane-left, FACE_DOWN)
Frame 6   LOCATION_SLOT_REVEAL_SCHEDULED(lane-left, turn 1)
Frame 7   LOCATION_DRAWN(location card B, target lane-center)
Frame 8   LOCATION_PLAYED(location card B, lane-center, FACE_DOWN)
Frame 9   LOCATION_SLOT_REVEAL_SCHEDULED(lane-center, turn 2)
Frame 10  LOCATION_DRAWN(location card C, target lane-right)
Frame 11  LOCATION_PLAYED(location card C, lane-right, FACE_DOWN)
Frame 12  LOCATION_SLOT_REVEAL_SCHEDULED(lane-right, turn 3)
...       opening hands and other setup events
Frame N   MATCH_SETUP_COMPLETED
```

The exact relative order of player-deck initialization, location setup, and
opening-hand draws must be specified once by the setup transaction builder and
regression-tested. It may not depend on UI mounting order.

`MATCH_SETUP_COMPLETED` has a hard postcondition: all three lane-owned location
slots exist, all three contain a location card, and all three cards are
face-down. Until that postcondition holds, the match cannot enter its first
turn or accept player gameplay intents.

Each event is framed by the runtime at commit time. Definitions and reducers
never allocate or advance the frame number.

## Turn-Start Reveal Boundary

The core ruleset assigns each lane a turn-start reveal boundary. Under the
default three-lane rules, the initially left, center, and right lane IDs reveal
at the start of turns 1, 2, and 3 respectively. Later position changes do not
rewrite those assigned identities or schedules.

At each turn boundary, the runtime commits one deterministic opening
transaction:

```text
TURN_STARTED(turn)
LOCATION_REVEALED(location card scheduled for this turn)
<committed reveal reactions, when Phase 1.5 exists>
TURN_READY(turn)
```

`TURN_READY` is the boundary after which player gameplay intents may be
accepted. This guarantees that “reveal at the start of the turn” cannot race
with a staged play or depend on presentation timing.

Effects may reveal a location card early, turn it face-down, or change/cancel a
slot's scheduled reveal. The governed operation owns those decisions. The
turn-start scheduler reads canonical slot state and reveals the face-down
location card currently occupying that slot. Moving a card does not move the
lane-owned schedule; replacing it before the boundary means the replacement is
the card revealed at that boundary.

## Canonical Location Events

Phase 1.2 introduces or normalizes these past-tense facts:

```ts
type LocationEvent =
  | {
      readonly type: 'LOCATION_DECK_INITIALIZED';
      readonly instanceIds: readonly LocationCardInstanceId[];
    }
  | {
      readonly type: 'LOCATION_DRAWN';
      readonly locationCardId: LocationCardInstanceId;
      readonly targetLaneId: LaneId;
      readonly drawIndex: number;
    }
  | {
      readonly type: 'LOCATION_PLAYED';
      readonly locationCardId: LocationCardInstanceId;
      readonly laneId: LaneId;
      readonly face: 'FACE_DOWN';
    }
  | {
      readonly type: 'LOCATION_SLOT_REVEAL_SCHEDULED';
      readonly laneId: LaneId;
      readonly turn: number | null;
      readonly reason: LocationRevealScheduleReason;
    }
  | {
      readonly type: 'LOCATION_REVEALED';
      readonly locationCardId: LocationCardInstanceId;
      readonly laneId: LaneId;
      readonly reason: LocationRevealReason;
      readonly revealCount: number;
    }
  | {
      readonly type: 'LOCATION_TURNED_FACE_DOWN';
      readonly locationCardId: LocationCardInstanceId;
      readonly laneId: LaneId;
      readonly reason: LocationConcealReason;
    }
  | {
      /**
       * Discloses identity without changing face state or firing reveal rules.
       */
      readonly type: 'LOCATION_SHOWN_TO_SEATS';
      readonly locationCardId: LocationCardInstanceId;
      readonly seats: readonly Seat[];
      readonly reason: LocationDisclosureReason;
    }
  | {
      readonly type: 'LOCATION_MOVED';
      readonly locationCardId: LocationCardInstanceId;
      readonly fromLaneId: LaneId;
      readonly toLaneId: LaneId;
    }
  | {
      readonly type: 'LOCATIONS_SWAPPED';
      readonly left: {
        readonly locationCardId: LocationCardInstanceId;
        readonly fromLaneId: LaneId;
        readonly toLaneId: LaneId;
      };
      readonly right: {
        readonly locationCardId: LocationCardInstanceId;
        readonly fromLaneId: LaneId;
        readonly toLaneId: LaneId;
      };
    }
  | {
      readonly type: 'LOCATION_REMOVED_FROM_LANE';
      readonly locationCardId: LocationCardInstanceId;
      readonly laneId: LaneId;
      readonly destination: 'DISCARD' | 'BANISHED';
      readonly reason: LocationRemovalReason;
    }
  | {
      /**
       * Atomic slot mutation. Destruction always uses oldDestination
       * DESTROYED, a Ruin instance as the replacement, and REVEAL_IMMEDIATELY.
       */
      readonly type: 'LOCATION_REPLACED';
      readonly laneId: LaneId;
      readonly oldLocationCardId: LocationCardInstanceId;
      readonly newLocationCardId: LocationCardInstanceId;
      readonly oldDestination: 'DISCARD' | 'DESTROYED' | 'BANISHED';
      readonly revealPolicy: LocationReplacementRevealPolicy;
      readonly reason: LocationReplacementReason;
    }
  | {
      readonly type: 'LOCATION_RETURNED_TO_DECK';
      readonly locationCardId: LocationCardInstanceId;
      readonly from: 'STAGING' | 'DISCARD' | 'DESTROYED';
      readonly placement: 'TOP' | 'BOTTOM';
    };
```

`LOCATIONS_SWAPPED` is intentionally atomic. Representing a simultaneous swap
as two ordinary moves would either create an invalid occupied-lane transition
or expose a misleading intermediate state to reactions and presentation.

`LOCATION_REPLACED` is the authoritative atomic slot mutation. A governed
replacement operation may first stage or draw its incoming card, but it commits
the outgoing disposition and incoming occupant together:

1. prepare or draw the incoming location card
2. validate the outgoing destination and incoming reveal policy
3. atomically replace the slot occupant and disposition the outgoing card
4. reveal the incoming card immediately only when the governing rule says so

This preserves every meaningful fact without exposing a transient empty slot.
For destruction, there is no alternate event or reducer path:
`LOCATION_REPLACED` dispositions the old card to `DESTROYED`, installs a fresh
`Ruin` instance, and reveals it in that same event.

`LOCATION_REVEALED` is a public mechanical reveal. It turns the instance
face-up, discloses it to both seats, clears its pending scheduled reveal, and
participates in reveal reactions.

`LOCATION_SHOWN_TO_SEATS` is private information disclosure. It does not change
the card's face, activate the location, consume its scheduled reveal, or fire
reveal reactions.

`LOCATION_TURNED_FACE_DOWN` changes mechanical face state but does not erase
knowledge already learned by either seat. A subsequent mechanical reveal is a
new reveal transition and increments `revealCount`; Phase 1.5 policy determines
which reveal reactions are eligible to repeat.

## Governed Location Operations

Callers request operations; operations validate state and policy, then produce
events:

```ts
initializeLocationDeck(...)
drawLocationForLane(...)
playStagedLocation(...)
scheduleLocationSlotReveal(...)
revealLocation(...)
turnLocationFaceDown(...)
showLocationToSeats(...)
moveLocation(...)
swapLocations(...)
removeLocation(...)
replaceLocationFromDeck(...)
replaceLocationCard(...)
returnLocationToDeck(...)
```

Required operation behavior:

- `drawLocationForLane` fails with a typed result when the draw pile is empty,
  the lane is invalid, or another location is already staged for that request.
- `playStagedLocation` requires the named instance to be in `STAGING` and the
  target location slot to be empty.
- `playStagedLocation` places the pre-game and replacement location card
  face-down unless an explicit rule requests a different governed operation
  afterward.
- `scheduleLocationSlotReveal` updates the lane-owned slot's canonical reveal
  boundary; it does not use a UI timer.
- `revealLocation` changes mechanical face state, discloses identity to both
  seats, and consumes the active schedule.
- `showLocationToSeats` updates only seat knowledge and cannot invoke
  mechanical reveal behavior.
- `turnLocationFaceDown` cannot erase a seat's existing identity knowledge.
- `moveLocation` requires an empty destination location slot.
- `swapLocations` requires two distinct occupied lanes and produces one atomic
  event.
- `replaceLocationFromDeck` is a transaction-level orchestration of governed
  operations, not a reducer shortcut.
- `replaceLocationCard` changes which instance occupies the slot; it never
  rewrites an existing instance's `defId`. Its source is explicit:
  `DRAW_FROM_LOCATION_DECK`, `EXISTING_LOCATION_CARD`, or a governed
  `CREATE_LOCATION_CARD` capability when a future rule explicitly permits
  creation outside the bootstrap deck.
- every replacement states its reveal policy explicitly:
  `KEEP_SLOT_SCHEDULE`, `REVEAL_IMMEDIATELY`, `FACE_DOWN_UNSCHEDULED`, or
  `SCHEDULE_AT_TURN`.
- `removeLocation` retains the origin lane and location identity in its event
  even after state changes.
- direct construction of these location mutation events outside their
  operation module is forbidden after migration.

Phase 1.2 establishes these lifecycle operations. Phase 1.5 adds shared
capability gates and committed-event reactions around them.

## Lane Lifecycle

Lane lifecycle is distinct from location-card lifecycle.

A non-destructive discard or banish operation may leave an active lane with an
empty slot when a rule explicitly says so. “Destroy location” never uses that
path: it atomically replaces the instance with the revealed, inert `Ruin`
system location. Destroying a lane removes the lane itself from the board.

### Canonical lane-destruction events

```ts
type LaneLifecycleEvent =
  | {
      readonly type: 'LANE_DESTRUCTION_STARTED';
      readonly laneId: LaneId;
      readonly priorPosition: number;
      readonly reason: LaneDestructionReason;
    }
  | {
      readonly type: 'LANE_DESTROYED';
      readonly laneId: LaneId;
      readonly priorPosition: number;
      readonly reason: LaneDestructionReason;
    };
```

`destroyLane(...)` is a transaction-level governed operation:

1. validate that the lane is active, at least two lanes are currently active,
   and lane destruction is permitted
2. snapshot every player card and the location card currently in that lane
3. prove that the complete transaction leaves no entity pointing at the lane
4. emit `LANE_DESTRUCTION_STARTED` and mark the lane `DESTROYING`
5. destroy player-card occupants through the ordinary governed destruction
   operation, including immunity, gates, `onDestroyed`, and location reactions
6. remove the location card through `removeLocation(...)`
7. cancel the location slot's reveal schedule
8. emit `LANE_DESTROYED`, remove the ID from `activeLaneOrder`, and retain the
   lane in `lanesById` as a `DESTROYED` tombstone

An effect that needs to move occupants elsewhere does so through governed move
operations before requesting lane destruction. The engine must not silently
choose a destination or convert a protected card into banishment.

The runtime validates and commits the complete lane-destruction transaction
atomically. If any required transition is illegal and the rule does not carry
an explicit governed override, no partial destruction transaction commits.
If a card survives ordinary destruction, or a destruction reaction leaves a
card pointing at the lane, the complete lane destruction is rejected.

`destroyAllOtherLanes(survivorLaneId)` applies the same transaction to every
other active lane. It is atomic across the complete group: a failure in any
target lane rolls back all target-lane destruction. The survivor becomes the
only entry in `activeLaneOrder`, which makes normal board projection center it.

After `LANE_DESTROYED`:

- the lane is absent from the playable board and normal seat projection
- it cannot receive cards or a location card
- it does not participate in scoring
- it does not count toward the three-active-lane maximum
- its tombstone remains addressable by replay, history, and debugging

Destroying the lane and merely destroying the card in its location slot must
never share an event or reducer path.

### Lane creation

`createLane(...)` fills vacancies left by destruction:

1. reject when three active or creating lanes already exist
2. allocate a new deterministic `LaneId`
3. create a `CREATING` lane with its own empty `LocationSlotState`
4. insert it at an explicit left-to-right position only when activation commits
5. draw/place a location card or apply another explicit location policy
6. assign an explicit reveal policy
7. activate the lane and add it to `activeLaneOrder`

It may never reuse a destroyed lane ID. Restoring a destroyed historical lane,
if ever supported, would be a separate `restoreLane(...)` rule with different
semantics.

The core ruleset's maximum remains three. Creation therefore fills a vacancy
left by destruction; it never creates a four-lane board.

## Reducer Responsibility

Reducers remain blind, deterministic event appliers.

They may:

- move a location ID between declared zones
- update the instance's zone/lane/reveal facts
- update a lane's `locationSlot.locationCardId`
- update a slot's canonical reveal schedule
- update canonical seat-knowledge facts
- apply canonical lane status and `activeLaneOrder` transitions
- preserve canonical deck order
- reject impossible developer states in test/assertion builds

They may not:

- choose a location card definition
- consult rarity
- decide whether an effect is immune
- trigger a location ability
- allocate a frame
- invent follow-up events
- silently repair an invalid operation

Policy belongs before event construction. Reactions belong after canonical
commit in Phase 1.5.

## Runtime and Replay Ownership

`MatchSession` retains the full three-deck bootstrap.

Its mechanical projection supplies:

```ts
{
  seed,
  ruleset,
  manifest,
  playerDecks: {
    P0: bootstrap.decks.P0.entries,
    P1: bootstrap.decks.P1.entries,
  },
  locationDeck: bootstrap.decks.LOCATIONS.entries,
}
```

`MatchRuntime`:

- creates stable location card instance IDs from ordered bootstrap entries
- commits setup and gameplay location transactions
- owns all location zone state
- assigns Phase 1.1 frames
- appends events to the canonical log
- publishes immutable presentation frames

Replay/export must include:

- the complete location deck bootstrap snapshot
- its content hash and revision
- the canonical setup events
- all later location lifecycle events

A replay fold begins from canonical genesis and applies recorded events. It does
not rerun the location deck factory or rarity selection.

State checksums must include the active lane order, every active or tombstoned
lane ID/status, location card instance identity, lane-slot references, face
state, reveal schedule, seat knowledge, every location zone, and draw-pile
order.

## Seat Projection and Hidden Information

The complete bootstrap and authoritative state are trusted runtime data. Normal
gameplay UI and AI consumers receive a seat projection.

For a projected location card:

- if it is `FACE_UP`, both seats receive its `defId`
- if it is `FACE_DOWN` and the viewer is in `identityKnownTo`, that viewer
  receives its `defId` plus its face-down orientation
- otherwise the viewer receives only a location-card back, public slot
  occupancy, and other explicitly public facts

The projection of the location draw pile exposes its count, not its ordered
identities. A private `LOCATION_SHOWN_TO_SEATS` event is projected only to the
named seats; other seats may receive a redacted no-op frame when sequence
continuity requires it.

AI legality and decision inputs must use the AI seat's projection rather than
trusted state. Debug/replay tooling may request a separately authorized
all-information projection.

Replacing a known location card creates or plays a different instance.
Knowledge of the removed instance never authorizes disclosure of the incoming
instance.

## Content and Authoring Boundary

The manifest remains the catalog of definitions:

```text
manifest.locations[defId] -> LocationCardDef
```

The bootstrap determines which definitions participate in this match and in
what order:

```text
bootstrap.decks.LOCATIONS.entries -> ordered location deck
```

The runtime owns the instantiated game pieces:

```text
state.locationCards[id] -> LocationCardInstance
```

This separation prepares Phase 1.5's folder-based location authoring:

```text
location folder -> generated LocationCardDef -> manifest catalog
                                      \
                                       -> location deck factory
                                            -> match bootstrap
                                                 -> runtime instances
```

Adding or editing an ordinary location should ultimately touch its content
folder only. Phase 1.2 does not implement that authoring migration, but it must
not introduce runtime imports from individual location card definitions.

## Compatibility Decisions

### The types say “location card”

Phase 1.2 renames the existing domain types:

```text
LocationDef       -> LocationCardDef
LocationInstance  -> LocationCardInstance
lane.location     -> lane.locationSlot.locationCardId
```

This is not cosmetic. It records that a location is an instantiated, deckable
game piece while keeping it outside ordinary player-card APIs.

### Locations are not player cards

Use shared generic infrastructure only where the invariants are genuinely the
same:

```ts
interface DeckBootstrapBase<TEntry> { ... }
interface OrderedPile<TInstanceId> { ... }
```

Do not create a broad `CardInstance | LocationCardInstance` API and branch on
`kind` throughout the engine. That would trade current location special cases
for pervasive type switches.

### The system controls the deck

The location deck has a `LOCATIONS` slot but no player owner. System intents or
rules request location operations. A lane is a target, not an actor with a
hand.

### Lane identity is not lane position

All canonical gameplay references use `LaneId`. Left, center, right, and
numeric position are projections of `activeLaneOrder`.

Destruction removes an ID from that order; it does not renumber or mutate the
identity of surviving lanes. Future creation inserts a new ID into the order
and may occur only below the three-active-lane maximum.

### The bootstrap order is authoritative

The default factory may use rarity and seeded randomness, but its output is
frozen before runtime construction. The runtime preserves that order. This
makes scenario decks, exact debug fixtures, and replay identity straightforward.

### Swap is atomic; replacement is composed

A swap is one simultaneous state transition. Replacement is a meaningful
sequence of removal, draw, play, and optional reveal. The event model must
reflect those different semantics.

Changing a lane's location card means changing the instance in its slot, not
mutating the old instance into a different definition. This keeps provenance,
private knowledge, reveal history, and replay unambiguous.

### Setup is gameplay history

Setup uses the same event/frame authority as the rest of the match. It is not a
bag of pre-populated state that exists outside replay chronology.

## Migration Plan

### Checkpoint 1 — Contracts and Characterization

- capture current first-three-location selection across a large fixed seed set
- capture current reveal timing and lane order
- add the typed third deck to bootstrap and runtime configuration
- add location-deck validation and content hashing
- implement the compatibility location deck factory
- keep current state initialization temporarily behind an adapter

Exit gate:

- existing seed/location behavior is characterized
- a match cannot reach runtime construction without three valid decks
- the compatibility factory's first three entries match the old selector

### Checkpoint 2 — Location Deck and Lane-Slot State

- rename `LocationDef` to `LocationCardDef`
- rename `LocationInstance` to `LocationCardInstance`
- introduce stable `LaneId`, `LaneStatus`, `activeLaneOrder`, and
  `lanesById`
- migrate card, location, event, selector, and replay lane references from
  positional indices to `LaneId`
- add the `LocationCardInstance` registry and location deck zones
- instantiate the ordered location deck deterministically
- give every lane one persistent `LocationSlotState`
- change slots to reference `locationCardId`
- add mechanical face state, reveal schedule, and canonical seat knowledge
- update selectors and projections to resolve location card instances by ID
- keep presentation behavior unchanged

Exit gate:

- every location card instance exists in exactly one zone
- every lane reference resolves to one `LANE` instance
- all surviving lane identities remain stable when active order changes
- active lane count never exceeds three
- unknown face-down identities and future deck order are redacted per seat
- no duplicated embedded location state remains

### Checkpoint 3 — Canonical Setup

- add location deck initialization, draw, and play operations/events
- build initial lanes through the setup transaction
- play all three initial location cards face-down
- assign the default lane-owned turn-start reveal schedule
- frame every setup event using Phase 1.1 authority
- remove direct lane population from initial-state construction

Exit gate:

- a complete setup replay reconstructs the same initial playable state
- `MATCH_SETUP_COMPLETED` guarantees three occupied face-down location slots
- no player gameplay intent is accepted before setup completes
- setup ordering is deterministic and UI-independent
- runtime never chooses initial locations from the manifest

### Checkpoint 4 — Lifecycle Migration

- migrate reveal to the governed operation
- migrate face-down and reveal-rescheduling effects
- migrate private location disclosure through seat-knowledge events/projections
- migrate shift/move to `LOCATION_MOVED`
- migrate simultaneous swaps to `LOCATIONS_SWAPPED`
- migrate destruction to atomic Ruin replacement and migrate independent
  banishment/removal
- add governed lane destruction and tombstone retention
- route all `LOCATION_REPLACED` producers through the governed atomic
  replacement operation
- route every producer through the location operation module

Exit gate:

- no production caller directly constructs a location lifecycle mutation event
- replace, move, swap, location destruction, lane destruction, and reveal
  replay exactly
- no destroyed lane remains on the playable board or participates in scoring

### Checkpoint 5 — Cleanup and Architecture Fences

- remove `pickLaneLocations` from runtime/initial-state construction
- remove manifest-enumeration selection from the engine
- remove deprecated location mutation paths after all callers migrate
- add import and producer fences
- add a fence against canonical gameplay state/events using positional lane
  indices
- add a fence against direct `activeLaneOrder` or lane-status mutation outside
  reducers
- document the Phase 1.5 reaction seam over committed location events

Exit gate:

- location selection exists only in bootstrap-producing adapters
- location mutation authority exists only in governed operations/runtime commit
- the manifest is content lookup, never implicit match input

## Required Tests

### Bootstrap

- missing `LOCATIONS` deck is rejected
- unknown or disabled location card definition is rejected
- a player-card definition in the location deck is rejected
- a location card definition in a player deck is rejected
- duplicate/copy-limit policy is enforced
- ordered content hash mismatch is rejected
- validated bootstrap is deeply frozen

### Determinism and Parity

- the compatibility factory preserves the current first three picks across the
  characterization seed corpus
- identical bootstrap/seed/intents produce identical instance IDs, events,
  frames, and checksums
- manifest object insertion order cannot change a supplied location deck
- presentation timing and DOM availability cannot change location state

### State Invariants

- each instance appears in exactly one location zone
- every lane location reference resolves
- no two lanes reference the same instance
- `activeLaneOrder` contains only unique `ACTIVE` lane IDs
- every active ID resolves in `lanesById`
- destroyed lane IDs remain in `lanesById` and are absent from
  `activeLaneOrder`
- deleting the leftmost lane does not change the IDs of surviving lanes
- active plus creating lane count never exceeds three
- no staged instance occupies a lane
- draw/play/remove/return transitions conserve instances
- empty-deck operations fail without partial events

### Lifecycle

- setup draws and plays one location per lane in canonical lane order
- setup completes only with all three lane-owned slots occupied face-down
- default lane reveal happens at its configured turn-start boundary before
  player intents are accepted
- early reveal consumes or supersedes the scheduled reveal without revealing
  twice accidentally
- reveal rescheduling and cancellation are deterministic
- private disclosure changes only the named seat's knowledge
- private disclosure does not flip the card or run reveal behavior
- turning a card face-down does not erase knowledge already acquired
- replacement does not leak the incoming card through knowledge of the removed
  instance
- replacement prepares its source card, then atomically dispositions the old
  occupant and installs the new occupant with the declared reveal policy
- swap commits atomically
- move rejects an occupied destination
- face state follows the instance when it moves or swaps; the reveal schedule
  belongs to the lane slot
- destroyed, discarded, and banished destinations remain distinct
- destroying a location card emits exactly one atomic replacement by fresh,
  revealed inert Ruin and leaves its active lane intact
- destroying a lane removes it from board layout, targeting, and scoring
- no operation may destroy the final active lane
- destroy-all-other-lanes works with the survivor initially at left, center,
  or right and leaves that stable ID as the sole projected lane
- after lane creation, two active lanes occupy equal left/right screen regions
  regardless of their stable IDs or prior positions
- every lane occupant uses ordinary destruction behavior; a protected
  survivor rejects the complete lane transaction
- face-down cards destroyed with their lane never reveal afterward
- lane destruction leaves no player card or location card pointing at the
  destroyed lane
- a rejected lane destruction commits no partial events
- destroyed lanes remain replay-addressable tombstones
- a creation request at three active/creating lanes is rejected

### Replay

- setup plus event log folds to the live state checksum
- replay never calls the location deck factory
- replay never reruns location reactions
- draw-pile order survives export/import

### Architecture Fences

- runtime initialization cannot import/use the location pool selector
- reducers cannot import RNG, manifest selection, operations, or reactions
- content definitions cannot import runtime or operation code
- location mutation events have only governed production sites
- canonical gameplay events and instances reference `LaneId`, never array index
- only canonical lane lifecycle events may change lane status or
  `activeLaneOrder`

## Phase 1.2 Exit Checklist

Phase 1.2 is done when:

- [ ] `MatchBootstrap` requires P0, P1, and `LOCATIONS` deck snapshots.
- [ ] The default entry/debug adapter builds a deterministic location deck.
- [ ] The location deck order and content hash are frozen match input.
- [ ] Runtime state contains normalized `LocationCardInstance` values and
      explicit zones.
- [ ] Every gameplay lane reference uses stable `LaneId`, not array position.
- [ ] Match state owns `activeLaneOrder` and replayable `lanesById` tombstones.
- [ ] Every lane owns exactly one `LocationSlotState`.
- [ ] Initial lanes are populated through canonical draw/play setup events.
- [ ] All three initial location cards are face-down when setup completes.
- [ ] Lane slots reveal at configured turn-start boundaries before play begins.
- [ ] Mechanical reveal and per-seat identity knowledge are separate.
- [ ] Seat projection hides unknown face-down identities and future deck order.
- [ ] Governed lane destruction removes the lane from the playable board and
      leaves no orphaned entities.
- [ ] Destroyed lanes do not score, accept targets, or count toward the
      three-lane maximum.
- [ ] The state model permits future creation of a new lane ID below the
      three-lane maximum without resurrecting a tombstone.
- [ ] Setup events carry Phase 1.1 frames.
- [ ] Replay reconstructs setup without rerunning selection.
- [ ] Replace, move, swap, reveal, destroy, banish, and return use governed
      location lifecycle operations.
- [ ] No runtime initializer chooses locations from `manifest.locations`.
- [ ] No location is stored as a player card or vice versa.
- [ ] Compatibility, determinism, state-invariant, replay, and architecture
      fences are green.
- [ ] Phase 1 runtime authority and player-deck provenance remain green.

## Deferred Questions

These decisions are intentionally not required for Phase 1.2:

- whether players may eventually select or own a location deck
- whether some modes use shared, asymmetric, or scenario-specific location
  decks
- whether discarded/destroyed locations can normally be recycled
- how a server redacts unseen future location deck order
- whether multiple location slots per lane ever exist
- whether a rule may create a location not present in the bootstrap deck
- which content capability first exposes lane creation, its insertion policy,
  and how its new location card/reveal schedule are selected

Phase 1.2 should preserve extension seams for those rules without implementing
them speculatively.
