# Playgame Card Transfer Animation Spec

## Goal

Every card zone change must produce a predictable base animation, regardless of:

- player: `P0` or `P1`
- viewer seat: local bottom player or remote top player
- source zone: deck, hand, lane, discard, destroyed, banished, generated/offboard
- destination zone: deck, hand, lane, discard, destroyed, banished, removed/offboard
- event shape: draw, stage, move, return, create, destroy, discard, banish, transform, replace

Specific cards, effects, events, or locations may override the animation, but the base transfer must always exist first. Overrides inherit from the base behavior and replace only the pieces they explicitly customize.

This system is a presentation adapter over engine events. It must not change engine semantics.

## Core Principle

All structural card animations are normalized into a single concept:

```ts
type CardTransfer = {
  cardId: CardId;
  owner: Owner;
  from: CardZoneRef;
  to: CardZoneRef;
  reason: MatchEvent['type'];
  face: 'preserve' | 'faceUp' | 'faceDown';
  timing: TransferTiming;
  style: TransferStyle;
  layout: TransferLayoutPlan;
};
```

Engine events remain semantic. Presentation converts each event into zero or more `CardTransfer`s by comparing `beforeState`, `event`, and `afterState`.

If a card's zone or lane changes and no transfer is produced, dev mode must throw.

## Zone Model

```ts
type CardZoneRef =
  | { kind: 'DECK'; owner: Owner }
  | { kind: 'HAND'; owner: Owner; index?: number }
  | { kind: 'LANE'; owner: Owner; lane: LaneIdx; index?: number }
  | { kind: 'DISCARD'; owner: Owner }
  | { kind: 'DESTROYED'; owner: Owner }
  | { kind: 'BANISHED'; owner: Owner }
  | { kind: 'GENERATED'; owner: Owner; sourceId?: string }
  | { kind: 'OFFBOARD' };
```

The renderer supplies DOM anchors for every visible or logical zone:

```ts
type ZoneAnchorKey =
  | `${Owner}:deck`
  | `${Owner}:hand`
  | `${Owner}:discard`
  | `${Owner}:destroyed`
  | `${Owner}:banished`
  | `${Owner}:lane:${LaneIdx}`
  | `generated`;
```

Visible card refs remain keyed by card instance id. Zone refs are used when the source or destination card element is absent.

## Base Transfer Routes

The base route is selected from source/destination visibility:

```ts
type TransferRoute =
  | 'visible-to-visible'
  | 'visible-to-anchor'
  | 'anchor-to-visible'
  | 'anchor-to-anchor'
  | 'layout-only';
```

Base behavior:

- `visible-to-visible`: clone/fly from old card rect to new card rect, hide real destination during flight, then reveal it.
- `visible-to-anchor`: clone/fly from old card rect to destination zone anchor, shrink/fade on arrival.
- `anchor-to-visible`: clone/fly from source zone anchor to destination card rect, hide destination during flight, then reveal it.
- `anchor-to-anchor`: pulse source/destination anchors, no card clone.
- `layout-only`: run FLIP layout slides for affected lists when the same card element is already stable.

## Event Normalization

Every structural event maps through one normalizer:

```ts
function deriveCardTransfers(
  before: MatchState,
  event: MatchEvent,
  after: MatchState,
): readonly CardTransfer[];
```

Base mappings:

| Event | From | To |
| --- | --- | --- |
| `CARD_DRAWN` | `DECK(owner)` | `HAND(owner)` |
| `CARD_STAGED` | `HAND(owner)` | `LANE(owner, lane)` |
| `CARD_UNSTAGED` | `LANE(owner, previousLane)` | `HAND(owner)` |
| `CARD_MOVED` | `LANE(owner, fromLane)` | `LANE(owner, toLane)` |
| `CARD_MOVED_TO_ZONE` | zone from `before.cards[cardId]` | event destination |
| `CARD_RETURNED_TO_LANE` | zone from `before.cards[cardId]` | `LANE(owner, lane)` |
| `CARD_ADDED_TO_HAND` | `GENERATED(owner)` | `HAND(owner)` |
| `CARD_ADDED_TO_LANE` | `GENERATED(owner)` | `LANE(owner, lane)` |
| `CARD_ADDED_TO_DECK` | `GENERATED(owner)` | `DECK(owner)` |
| `CARD_DISCARDED` | zone from `before.cards[cardId]` | `DISCARD(owner)` |
| `CARD_DESTROYED` | zone from `before.cards[cardId]` | `DESTROYED(owner)` |
| `CARD_BANISHED` | zone from `before.cards[cardId]` | `BANISHED(owner)` |
| `CARD_TRANSFORMED` | no transfer | in-place transform VFX |
| `DECK_SHUFFLED` | no transfer | deck anchor pulse |

If an event mutates multiple cards, it returns multiple transfers in event order.

## Transfer Style

```ts
type TransferStyle = {
  route: TransferRoute;
  durationMs: number;
  easing: string;
  zIndex: number;
  arc?: 'none' | 'small' | 'large';
  spin?: 'none' | 'subtle' | 'flip';
  opacity?: 'preserve' | 'fadeOut' | 'fadeIn';
  scale?: { from?: number; to?: number };
  sfx?: string;
};
```

Base defaults:

- lane to lane: `360ms`, visible-to-visible, small arc, preserve face.
- hand to lane: `300ms`, visible-to-visible, faceDown if staged unresolved.
- lane to hand: `340ms`, visible-to-visible, faceUp.
- deck to hand: `360ms` slide, faceDown-to-faceUp flip.
- generated to hand: `300ms` anchor-to-visible, pop on arrival.
- generated to lane: `300ms` anchor-to-visible, faceUp unless event says otherwise.
- visible to discard/destroyed/banished: `280ms` visible-to-anchor, shrink/fade.
- pile to lane: `340ms` anchor-to-visible, faceUp if `CARD_RETURNED_TO_LANE.revealed`.
- pile to hand: `340ms` anchor-to-visible, faceUp.
- deck to deck / pile to pile: anchor pulse only.

## Inheritance And Overrides

Animations are resolved in layers. Later layers override earlier layers.

```ts
type TransferAnimationLayer =
  | 'base'
  | 'route'
  | 'event'
  | 'effect'
  | 'card'
  | 'location'
  | 'debug';
```

Resolution order:

1. Base defaults.
2. Route defaults, based on `from.kind -> to.kind`.
3. Event overrides, based on event type.
4. Effect overrides, based on `event.cause.effectKind` and `sourceId`.
5. Card overrides, based on moving card `defId`.
6. Location overrides, based on causing location `defId`.
7. Debug/test overrides.

Each override is partial:

```ts
type TransferAnimationOverride = {
  match: TransferAnimationMatcher;
  style?: Partial<TransferStyle>;
  timing?: Partial<TransferTiming>;
  face?: CardTransfer['face'];
  suppressBaseFlight?: boolean;
  extraVfx?: VfxCue[];
  extraSfx?: SfxCue[];
};
```

Overrides must not skip structural coverage unless they set `suppressBaseFlight: true` and provide a replacement structural animation.

Examples:

- `Skyrail`: override lane-to-lane route with a larger arc and faster travel.
- `Leon`: lane-to-hand can use a "snap back" style but still inherits lane-to-hand base.
- `Trauma Team`: destroyed-to-lane uses pile-to-lane base plus revive glow.
- `Banish`: visible-to-banished uses base visible-to-anchor plus harsher fade.
- `Riff Raff`: generated-to-lane uses base generated-to-lane plus token pop stagger.

## Layout Plan

Every transfer declares which keyed lists may reflow:

```ts
type TransferLayoutPlan = {
  captureBefore: readonly CardZoneRef[];
  slideAfter: readonly CardZoneRef[];
};
```

Base rules:

- hand source or destination: capture and slide that hand.
- lane source or destination: capture and slide that lane side.
- deck/pile anchors: no card list slide unless a visible pile viewer is open.
- multi-card events: capture all touched lists once before dispatch, dispatch event, then slide all touched lists once.

The current `captureHandRects` helper should become generic:

```ts
captureCardRects(ids, cardRefs)
playCardLayoutSlide(rects, cardRefs)
```

## Sequencing

Single-event flow:

1. Snapshot `beforeState`.
2. Derive affected card ids and list ids.
3. Capture card/list rects.
4. Dispatch event.
5. Wait for render.
6. Derive `afterState`.
7. Build transfers.
8. Run structural transfer flights.
9. Run list FLIP slides.
10. Run additive VFX/SFX.
11. Resolve promise.

For events where the destination element does not exist until after dispatch, the animator hides the destination element until the flyer lands.

For events where the source element disappears after dispatch, the animator must clone from the captured pre-dispatch rect.

## Player And Viewer Independence

Transfer derivation uses absolute owners (`P0`, `P1`).

Rect lookup resolves through the current viewer layout:

- local seat may be `P0` or `P1`
- local hand is visible
- remote hand may be hidden and represented only by an anchor/count indicator
- both players' lanes are visible

The transfer system must never special-case "bottom means P0". It asks the view layer for anchors by owner and zone.

## Replay Requirements

Replay scrubbing should not run animations while jumping between frames. It should render exact frame state.

Optional replay playback can use the same `CardTransfer` system by feeding:

```ts
before = frames[i].state
event = frames[i + 1].event
after = frames[i + 1].state
```

Replay debug should expose transfers for inspection:

- event
- card id
- from zone
- to zone
- chosen route
- override layers applied
- missing anchor fallback, if any

## Failure Rules

In dev/debug mode:

- Throw if a card changes zone/lane and no transfer is produced.
- Throw if a produced transfer references a missing card in both `before` and `after`.
- Throw if the destination is visible but no card ref appears after render.
- Throw if an anchor key is required and missing.
- Throw if an override suppresses base flight without providing replacement structural behavior.

In production:

- Fall back to dispatch-only only for missing DOM refs.
- Never fall back for invalid transfer data produced by the engine adapter.

## Coverage Matrix

Required base coverage:

| From / To | Deck | Hand | Lane | Discard | Destroyed | Banished |
| --- | --- | --- | --- | --- | --- | --- |
| Deck | pulse | draw/insert | summon-to-lane | move-to-pile | move-to-pile | move-to-pile |
| Hand | return-to-deck | hand-reorder | stage/play | discard | destroy-from-hand | banish |
| Lane | return-to-deck | return-to-hand | lane-move | discard | destroy | banish |
| Discard | return-to-deck | recover-to-hand | revive-to-lane | pulse | move-pile | banish |
| Destroyed | return-to-deck | recover-to-hand | revive-to-lane | move-pile | pulse | banish |
| Banished | return-to-deck | recover-to-hand | return-to-lane | move-pile | move-pile | pulse |
| Generated | add-to-deck | add-to-hand | add-to-lane | generated-to-pile | generated-to-pile | generated-to-banished |

"Destroy from hand" may be rare, but the base route must exist because the engine supports generic zone movement.

## Implementation Plan

1. Add `presentation/cardTransfers.ts`
   - `zoneOfCard(before, cardId)`
   - `destinationToZoneRef(event.destination, owner)`
   - `deriveCardTransfers(before, event, after)`
   - dev assertions

2. Add `presentation/transferStyles.ts`
   - base route defaults
   - override registry
   - layer resolver

3. Add `presentation/zoneAnchors.ts`
   - `ZoneAnchorRegistry`
   - `bindZoneAnchor(key)`
   - rect lookup helpers

4. Replace hand-only animation helpers
   - `captureHandRects` -> `captureCardRects`
   - `playLayoutSlide` -> `playCardLayoutSlide`

5. Refactor `eventAnimator.ts`
   - snapshot before
   - dispatch event
   - snapshot after
   - derive transfers
   - run transfer animator
   - then additive VFX/SFX

6. Add tests
   - one test per engine event mapping
   - coverage matrix smoke test
   - dev failure when a zone-changing event has no mapping
   - override inheritance tests

## Acceptance Criteria

- A card returning from lane to hand animates for both `P0` and `P1`.
- A card revived from destroyed to lane animates from destroyed pile anchor to slot.
- A card generated into lane animates from generated anchor to slot.
- Destroy/discard/banish animate out to the correct owner pile.
- Hand and lane neighbors slide smoothly for every transfer that changes list membership.
- Replay frame scrubbing remains instant and exact.
- Dev mode crashes on missing structural animation coverage.
- Overrides can customize style without duplicating route logic.
