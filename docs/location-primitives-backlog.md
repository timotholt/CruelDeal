# Location Primitive Implementation Notes

This note tracks the engine primitives added to turn the disabled Vantaris
locations into playable locations. The goal was to avoid one-off location
hacks: each primitive below unlocks a family of Snap-style location effects.

Current status: the primitive families below are implemented, and all Vantaris
locations are authored as playable manifest data. `services/playgame/engine/location-primitives.test.ts`
contains focused coverage for location event context, location counters,
`BLOCK_PLAY`, and delayed end-game reveal.

## Current Engine Shape

The location catalog already keeps disabled location designs in the manifest
with rarity 0 and an `UNIMPLEMENTED -` description.

Useful primitives that already exist:

- `EffectExpr`: `ADD_POWER`, `SET_POWER`, `ADJUST_COST`, `DESTROY`, `MOVE`, `DRAW`,
  `DISCARD`, `ADD_CARD_TO_LANE`, `ADD_CARD_TO_HAND`,
  `ADJUST_NEXT_TURN_ENERGY_BONUS`, `ADD_PENDING`, `FOREACH`, `CONDITIONAL`.
- `OngoingExpr`: `POWER_ADD`, `COST_ADD`, `LANE_POWER_MULTIPLIER`,
  `ON_REVEAL_MULTIPLIER`, `BOOST_ONGOINGS`, `DISABLE_ONGOING`,
  `DISABLE_ON_REVEAL`, `BLOCK_PLAY`.
- Selectors: `SAME_LANE`, `OTHER_LANES`, `WHERE`, `RANDOM_N`, `MIN_POWER_OF`,
  `MAX_POWER_OF`, `HAND_OF`, `ALL_CARDS`.
- Time: generic `SCHEDULED` pending effects support `START_OF_NEXT_TURN` and
  `END_OF_NEXT_TURN`.
- State already has a `BANISHED` zone and a `CARD_BANISHED` event, but the DSL
  does not yet expose a `BANISH` effect.

Important gaps in existing primitives:

- `BLOCK_PLAY` exists in the type system, but staging validation does not appear
  to consult it yet.
- `LocationAbilities.atTurnEnd` exists, but `resolveTurn` currently has a
  migration comment instead of dispatching it.
- Location abilities do not yet have card-event trigger slots such as
  "when a card is played here" or "when a card is destroyed here."
- Locations do not have counters, so "first/next card here" needs new memory.

## Primitive Group A: Shared Trigger Context

Add an event payload to `EvalCtx` for reactive triggers:

- `eventCard: CardId | null`
- `eventLane: LaneIdx | null`
- `eventOwner: Owner | null`

Add selector:

- `EVENT_CARD`: resolves to the triggering card.

Extend owner references and owner filters:

- Add concrete owners to selector filters: `P0`, `P1`.
- Add event-relative owners: `EVENT_OWNER`, `EVENT_OPP_OWNER`.
- Allow effect owner fields to use `EVENT_OWNER` where meaningful.

Why this matters:

- Location triggers should keep `SELF` as the location, while `EVENT_CARD`
  names the card that caused the trigger.
- Red Needle can target a random friendly card relative to the destroyed card.
- Pawn Shop can give next-turn energy to the player who played the card.
- Organ Bank can target P0 and P1 separately from a neutral location source.

## Primitive Group B: Location Trigger Slots

Add these to `LocationAbilities`:

- `atTurnStart?: EffectExpr[]`
- dispatch existing `atTurnEnd?: EffectExpr[]`
- `onCardPlayedHere?: EffectExpr[]`
- `onCardEnteredHere?: EffectExpr[]`
- `onCardDestroyedHere?: EffectExpr[]`

Recommended semantics:

- `onCardPlayedHere` fires after the card is revealed, matching the current
  engine's card-level `onAnyCardPlayedHere` definition of "played."
- `onCardEnteredHere` fires when a card is placed into a lane by staging,
  spawning, or moving. This is the right hook for "cards added here."
- `onCardDestroyedHere` fires after `CARD_DESTROYED`, using the destroyed card's
  pre-destroy lane as `eventLane`.
- `atTurnStart` fires after `TURN_STARTED` and before normal draw.
- `atTurnEnd` fires before `TURN_ENDED` cleanup.

## Primitive Group C: Turn Predicates

Add:

- `NumExpr.CURRENT_TURN`

Then existing `NUM_CMP` can express:

- turn is 4
- turn is at least 5
- turn is before final turn

This is better than a bespoke `TURN_CMP` predicate because it composes with
`IF_ELSE`, `CONDITIONAL`, and future numeric logic.

## Primitive Group D: Location Memory

Add runtime state:

- `LocationInstance.counters: Record<string, number>`

Add DSL atoms:

- `NumExpr.LOCATION_COUNTER`
  - fields: `name: string`, `lane?: Selector`, `owner?: OwnerRef`
  - default lane should be `SELF` when `SELF` is a location.
- `EffectExpr.MODIFY_LOCATION_COUNTER`
  - fields: `lane: Selector`, `name: string`, `owner?: OwnerRef`, `delta: NumExpr`

Use owner-scoped counters for "first/next card each player plays here":

- `name: 'played-here'`, `owner: EVENT_OWNER`

Use unscoped counters for global one-shots:

- `name: 'first-card-played'`

## Primitive Group E: Prevention and Gating Auras

Revise or replace current `BLOCK_PLAY` with lane-first semantics:

- `BLOCK_PLAY`
  - `laneOf: Selector`
  - `ownerFilter?: OwnerFilter`
  - `cardPred?: Predicate`
  - `when?: Predicate`

Wire it into `resolveStage` before emitting `CARD_STAGED`.

Add:

- `BLOCK_MOVE`
  - prevents `MOVE` effects from moving matching cards out of a lane.
  - needed by The Cage.
- `BLOCK_POWER_INCREASE`
  - suppresses positive permanent power deltas from `ADD_POWER` / `SET_POWER`.
  - should also cause power projection to ignore positive ongoing modifiers
    targeting that card.
- `DELAY_REVEAL`
  - prevents matching face-down cards from being revealed until a condition.
  - first supported condition should be `END_OF_GAME`.

## Primitive Group F: Ability Predicates

Add generic ability predicates over effective text:

- `HAS_ABILITY`
  - fields: `target: Selector`, `slot: 'ON_REVEAL' | 'ONGOING' | 'ACTIVATE' | 'ANY'`
- `HAS_NO_ABILITY`
  - fields: `target: Selector`

These should inspect effective abilities, not only printed definitions:

- respect copied text
- respect blanked text
- respect removed ongoing text

This may also require tightening existing `HAS_ONGOING`, which currently reads
mostly like printed-definition logic.

## Primitive Group G: Lifecycle Effects

Add:

- `BANISH`
  - emits the existing `CARD_BANISHED` event.
- `RETURN_TO_LANE`
  - moves existing cards from `DESTROYED` or `DISCARD` back to a lane.
  - fields: `target: Selector`, `to: Selector`, `revealed?: boolean`.
  - default `revealed` should be `true` for destroyed cards returning to play.
- `TRANSFORM_CARD`
  - replaces an existing card's `defId` with a random or specified card from a
    `PoolRef`.
  - should emit a new `CARD_TRANSFORMED` event.
  - recommended default: preserve owner, lane, zone, reveal state, and current
    power/cost deltas unless a transform explicitly asks to reset them.

## Disabled Location Mapping

| Location | Effect | Required primitives |
| --- | --- | --- |
| Chrome Beach | No cards can be played here after turn 5. | `CURRENT_TURN`; lane-based `BLOCK_PLAY`; `resolveStage` BLOCK_PLAY integration |
| Organ Bank | After turn 4, give each player's lowest-Power card here +3 Power. | `atTurnEnd` dispatch; `CURRENT_TURN`; concrete owner filters or owner iteration |
| Gun Store | Cards added to this location have +2 Power. | `onCardEnteredHere`; `EVENT_CARD` |
| Red Needle | When a card is destroyed here, give a random friendly card here +2 Power. | `onCardDestroyedHere`; `EVENT_CARD`; `EVENT_OWNER` owner filter |
| Black Halo | Cards with On Reveal have +2 Power here. | `HAS_ABILITY(slot: 'ON_REVEAL')` |
| The Cage | Cards cannot move from this location. | `BLOCK_MOVE`; MOVE evaluator integration |
| Courthouse | Cards here cannot have their Power increased. | `BLOCK_POWER_INCREASE`; ADD_POWER/SET_POWER integration; ongoing power projection integration |
| The Meat Market | Destroy the first card played here. | `onCardPlayedHere`; location counters; `EVENT_CARD`; `DESTROY` |
| Debt Alley | The first card each player plays here gets -2 Power. | `onCardPlayedHere`; owner-scoped location counters; `EVENT_CARD`; `EVENT_OWNER` |
| Skyrail | After you play a card here, move it to another location if possible. | `onCardPlayedHere`; `EVENT_CARD`; existing `MOVE` + `OTHER_LANES` |
| Cryobank | Cards played here are not revealed until the end of the game. | `DELAY_REVEAL`; end-game delayed reveal pass |
| Civil Court | Cards with no ability have +3 Power here. | `HAS_NO_ABILITY` |
| Backdoor | The next card each player plays here triggers its On Reveal twice. | `onCardPlayedHere`; owner-scoped location counters; `EVENT_CARD`; existing `TRIGGER_ON_REVEAL` |
| Scrap Yard | Destroyed cards are returned here on turn 5. | `atTurnStart`; `CURRENT_TURN`; `RETURN_TO_LANE`; destroyed-zone selectors; capacity policy |
| Pawn Shop | Banish each card you play here to earn +1 Energy next turn. | `onCardPlayedHere`; `EVENT_CARD`; `BANISH`; `ADJUST_NEXT_TURN_ENERGY_BONUS` with `EVENT_OWNER` |
| Overclock Room | The first card each player plays here gets +4 Power. | `onCardPlayedHere`; owner-scoped location counters; `EVENT_CARD` |
| Black Clinic | Transform the next card you play here into a random 5-Cost card. | `onCardPlayedHere`; owner-scoped location counters; `EVENT_CARD`; `TRANSFORM_CARD`; existing `COST_RANGE` pool |

## Implementation Order Used

1. Add `CURRENT_TURN`, `HAS_ABILITY`, `HAS_NO_ABILITY`, and concrete/event owner
   references. These are low-risk projection/evaluator atoms.
2. Dispatch `atTurnEnd` and add `atTurnStart`. This unlocks Organ Bank and
   gives time-based locations a real home.
3. Add the location card-event trigger framework and `EVENT_CARD` context. This
   unlocks Gun Store, Red Needle, Skyrail, and the one-shot family.
4. Add location counters. This unlocks Meat Market, Debt Alley, Backdoor,
   Overclock Room, and Black Clinic's one-shot timing.
5. Wire prevention/gating auras: `BLOCK_PLAY`, `BLOCK_MOVE`,
   `BLOCK_POWER_INCREASE`, `DELAY_REVEAL`.
6. Add lifecycle effects: `BANISH`, `RETURN_TO_LANE`, `TRANSFORM_CARD`.

The biggest architectural chunk was Group B plus Group D: once location event
triggers and location counters existed, most of the disabled design space became
normal DSL authoring instead of bespoke engine work.
