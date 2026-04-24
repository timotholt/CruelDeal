# Event-Driven Renderer Migration Spec

## Purpose

Move Cruel Deal toward a renderer where `MatchEvent` is the animation contract
without losing the existing feel of the game.

This is a migration spec, not a rewrite plan. The first implementation must
wrap and preserve existing animation beats before any old animation code is
deleted.

## Current Animation System

The current presentation layer has three cooperating systems:

- `services/playgame/script/flows.ts`
  - Storyboard-level sequencing: opening sequence, turn resolution, waits,
    reveal ordering, draw beats, location reveal timing.
- `services/playgame/script/actions.ts`
  - Event-to-UI bridge plus imperative animations.
  - Owns draw animation, location reveal cinematic, enemy fly-in, reveal
    slicing, move FLIP animation, turn banners, and state dispatch timing.
- `services/vfx/**` and `src/styles/playgame.css`
  - Reusable animation primitives: flying card, layout FLIP, reveal cinematic,
    deck slide, `Timeline`, CSS keyframes, toast banners, VFX classes.

This means the existing system already has a useful shape:

```txt
engine MatchEvent stream
  -> script flow chooses narrative order
  -> actions dispatch events at animation-safe moments
  -> vfx helpers/CSS perform visible motion
```

The new event-driven renderer should formalize that middle layer, not bypass it.

## Core Fear To Protect Against

We do not want a "clean" renderer refactor that causes any of these regressions:

- cards reveal in the wrong order
- On Reveal events dispatch before the flip lands visually
- move effects snap instead of FLIP-sliding
- draw cards appear in hand before the deck-slide animation
- location reveals lose the current multi-stage cinematic
- turn banners, timing pauses, and player readability disappear
- old CSS hover/layout transitions get overwritten by animation shorthand
- replay diverges from live turn resolution

## Non-Negotiable Invariants

1. **Engine remains visual-free.**
   `services/playgame/engine/**` never imports DOM, Solid, VFX, CSS, or timers.

2. **State changes happen through engine events.**
   Game state mutations still flow through `dispatch(event)` / `apply()`.

3. **Animation timing can delay dispatch.**
   Some events must be dispatched only when the animation reaches the right beat.
   Example: `CARD_FLIPPED` should dispatch during the reveal cinematic callback,
   not as soon as the event stream is captured.

4. **Narrative order beats raw event order where necessary.**
   The current reveal slicing contract is important:
   events between one `CARD_FLIPPED` and the next belong to that card's reveal
   beat and should animate before the next card flips.

5. **Existing animation helpers are assets, not debt.**
   `revealPendingCinematic`, `flyFaceDownToSlot`, `slideFromDeckToHand`, and
   `playLayoutSlide` should be reused by the event choreography layer.

6. **No animation is removed until its replacement is visually equivalent.**
   Deletion requires a before/after checklist and screenshot or manual QA note.

## Proposed Architecture

Add a small adapter layer:

```txt
services/playgame/presentation/choreography.ts
services/playgame/presentation/eventAnimator.ts
```

### `choreography.ts`

Pure-ish mapping from event type to animation intent. It should not directly
mutate the DOM.

```ts
type AnimationIntent =
  | { kind: 'dispatch-only' }
  | { kind: 'card-flip'; cardId: CardId }
  | { kind: 'card-move'; cardId: CardId; durationMs: number }
  | { kind: 'card-draw'; cardId: CardId; owner: Owner }
  | { kind: 'power-flash'; cardId: CardId; delta: number }
  | { kind: 'destroy-burst'; cardId: CardId }
  | { kind: 'location-reveal'; lane: LaneIdx }
  | { kind: 'toast'; text: string; durationMs: number };
```

The mapping may be simple at first:

```ts
function describeEventAnimation(event: MatchEvent): AnimationIntent {
  switch (event.type) {
    case 'CARD_MOVED':
      return { kind: 'card-move', cardId: event.cardId, durationMs: 360 };
    case 'CARD_POWER_CHANGED':
      return { kind: 'power-flash', cardId: event.cardId, delta: event.delta };
    default:
      return { kind: 'dispatch-only' };
  }
}
```

### `eventAnimator.ts`

Side-effectful executor that receives:

- `MatchEvent`
- current `PlayScriptCtx`
- resolved `AnimationIntent`

It may:

- capture DOM rects before dispatch
- dispatch the event
- wait for Solid to render
- run VFX helpers
- wait for animation completion

This layer replaces scattered branches inside `dispatchPerRevealEvent` and
`advanceTurnFromEngine` over time.

```ts
async function animateEvent(ctx: PlayScriptCtx, event: MatchEvent): Promise<void> {
  const intent = describeEventAnimation(event);
  await runAnimationIntent(ctx, event, intent);
}
```

## Event Ownership Matrix

Events fall into three buckets.

### Script-Owned Cinematic Events

These already have authored storyboard timing. Do not convert them first.

| Event | Current owner | Rule |
| --- | --- | --- |
| `CARD_FLIPPED` | `revealByPriorityFromEngine` + `revealPendingCinematic` | Keep cinematic callback dispatch. |
| `LOCATION_REVEALED` | `revealLocation` / `revealNextLocation` | Keep 6-stage location cinematic. |
| `CARD_DRAWN` | `drawHandCard` / `commitIncomingToHand` | Keep deck-slide and hand layout FLIP. |

### Safe First Adapter Events

These are good first candidates because current handling is already simple or
partially missing.

| Event | Current behavior | First adapter behavior |
| --- | --- | --- |
| `CARD_MOVED` | special-case FLIP slide in two places | Move to `animateEvent` using existing `playLayoutSlide`. |
| `CARD_POWER_CHANGED` | mostly dispatch-only | Dispatch plus small flash/pulse. |
| `CARD_DESTROYED` | mostly dispatch-only | Capture rect, dispatch, then burst/fade if element exists. |
| `CARD_BANISHED` | dispatch-only | Optional dissolve later; dispatch-only initially. |
| `CARD_DISCARDED` | dispatch-only | Optional hand discard animation later. |
| `CARD_ADDED_TO_HAND` | special-cased for local owner | Preserve existing queue + commit path. |

### Bookkeeping Events

These should usually remain dispatch-only.

| Event examples | Behavior |
| --- | --- |
| `TURN_ENDED`, `TURN_STARTED`, `ENERGY_CHANGED`, `MAX_ENERGY_CHANGED` | Dispatch, then let UI react. |
| `LOCATION_COUNTER_CHANGED`, `CARD_COUNTER_CHANGED` | Dispatch-only unless later surfaced visually. |
| `OR_WINDOW_OPEN`, `OR_WINDOW_CLOSE`, `RECURSION_LIMIT_HIT` | Dispatch-only/debug-only for now. |

## Migration Phases

### Phase 0: Inventory and Spec

Status: this document.

Deliverables:

- Preserve a written inventory of current animation owners.
- Define invariants and event ownership matrix.
- No live animation behavior changes.

### Phase 1: Adapter Shell, Dispatch-Only Default

Add:

- `presentation/choreography.ts`
- `presentation/eventAnimator.ts`

Wire only one call site at first:

- replace `dispatchPerRevealEvent(c, ev)` internals with `animateEvent(c, ev)`
- default behavior dispatches exactly as today
- `CARD_MOVED` uses existing `playLayoutSlide`

Success criteria:

- `CARD_MOVED` behavior is unchanged.
- No other event animation changes.
- Existing tests/build pass.

### Phase 2: Duplicate Existing Branches Into Adapter

Move existing event-specific branches without changing behavior:

- local `CARD_ADDED_TO_HAND`
- `CARD_MOVED` in `advanceTurnFromEngine`

Success criteria:

- `actions.ts` becomes thinner.
- Event behavior stays visually equivalent.
- Manual QA: Dune Sapper move, draw to hand, normal turn reveal.

### Phase 3: Add Missing Micro-Animations

Only after Phase 2 is stable:

- `CARD_POWER_CHANGED`: flash/pulse affected card
- `CARD_DESTROYED`: burst/fade
- `CARD_BANISHED`: quick dissolve
- `CARD_RETURNED_TO_LANE`: pop/halo
- `CARD_TRANSFORMED`: glitch flash

These must be additive and small. They should not change event dispatch order.

### Phase 4: Optional Particle Overlay

Introduce the canvas particle overlay after the event adapter is stable.

Do not make particles required for the core event animation system. They are
ornamentation, not state synchronization.

### Phase 5: Delete Old Branches

Only delete old animation paths when:

- the adapter owns the equivalent event
- behavior has a test/manual QA note
- there is no duplicate dispatch
- no event in replay/live mode diverges

## Guardrails

### Code Guardrails

- Never call `apply()` directly from choreography.
- Never mutate engine state from VFX helpers.
- Never measure DOM after dispatch when a FLIP animation needs the old rect.
- Never dispatch a script-owned cinematic event from both the cinematic and
  the generic adapter.
- Keep animation functions idempotent when the DOM element is missing:
  dispatch still happens.

### Review Checklist

Every event animation PR should answer:

- Which `MatchEvent` types changed?
- Which old animation path is being preserved or replaced?
- Does dispatch timing change?
- What happens if the target DOM element is missing?
- Is replay mode affected?
- Was the old branch deleted, duplicated, or left in place?

### Test/QA Checklist

Minimum manual QA before deleting any old path:

- opening sequence: board fade, location fade, 4-card opening draw
- normal turn: player staged cards flip face-down, enemy fly-in, priority reveal
- card move On Reveal: no snap frame, correct destination
- card draw from On Reveal: hand layout stays stable
- location reveal turns 1-3: cinematic still stages correctly
- replay drawer: entering replay does not trigger live animations

## Recommended First Implementation

Do **not** start with a full renderer rewrite.

Start with this tiny slice:

1. Add `describeEventAnimation(event)`.
2. Add `animateEvent(ctx, event)`.
3. Route only `dispatchPerRevealEvent` through it.
4. Keep `CARD_MOVED` behavior exactly as it is.
5. Default every other event to dispatch-only.

That creates the new architecture while keeping the old game feel intact.

