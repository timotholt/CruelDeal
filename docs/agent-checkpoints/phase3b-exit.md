# Phase 3b Exit — Opening Presentation Without Gameplay Authority

Status: complete and exit-proven

Date: 2026-07-20

## Outcome

The engine builds the opening through governed rules commands and commits it as
one immutable runtime transaction before presentation begins. The client then
paces that already-committed `SeatTransactionTimeline` through the same
`PresentationDirector` used by normal turns.

The opening prelude may hide or show the playfield and display the title toast.
It cannot evaluate effects, call governed operations, dispatch reactions,
dispatch events, adopt frame state, or slice an event list. Binding the
presentation sink merely allows the director to consume the queued committed
opening.

## Exit-Criteria Evidence

### No script-owned gameplay or event slicing

- `services/playgame/script` no longer exists.
- `PlayScriptCtx`, `revealByPriorityFromEngine`,
  `advanceTurnFromEngine`, and `_revealsConsumedUpTo` no longer exist in the
  production tree.
- `openingPresentation.ts` accepts only presentation ports: the immutable
  timeline, a presentation sink, playfield events, and a toast surface.
- The Phase 3b architecture fence rejects gameplay evaluation, operation,
  reaction-dispatch, state-adoption, event-dispatch, and frame/event slicing
  capabilities in the opening presenter.

### Canonical location-reaction ordering in live play and replay

The focused `phase3b-0` fixture reveals an opening location whose committed
`onReveal` reaction creates a card. The Phase 3b proof asserts that:

1. `LOCATION_REVEALED` precedes the location-caused reaction in the canonical
   opening transaction.
2. Both frames occur at their canonical frame numbers in the live projected
   opening.
3. Every opening frame's frame number, projected event, and projected
   after-state is identical in the replay view.
4. Replay and live opening settle to the same final projected state.

There is no separate opening-reaction path for presentation to reorder.

### Script context removed rather than reduced

The old `PlayScriptCtx` was deleted instead of retained as an adapter. DOM
anchors belong to the presentation host/motion surface, visible cursor adoption
belongs to `PlayUiProvider`, and gameplay authority belongs to `MatchRuntime`.

### One committed-frame consumer for openings and turns

`PlayUiProvider` puts both the initial opening and subsequently published turn
transactions into the same FIFO `SeatTransactionTimeline` queue. The same
`PresentationDirector.present(timeline, sink)` path performs frame adoption,
animation waits, cancellation, fast-forward, and final settlement for both.

## Animation Preservation

Closing Phase 3b did not redesign card or location animation. The cosmetic
opening pacing was moved behind `startOpeningPresentation`, while existing card
motion, reveal, landing, location-flip, map-fade, and lane-motion routines keep
their accepted timing and behavior. Phase 4's animation-preservation contract
prevents component extraction from reopening those implementations.

## Validation

- Phase 3b focused runtime/provider/presentation gate: 38 tests green.
- Broader play/presentation regression gate from the animation-boundary slice:
  119 tests green.
- Touched-scope ESLint: green.
- Production build: green.
- `git diff --check`: green.

Every Phase 3b exit criterion is met. Phase 4 may begin.
