# Phase 4 Exit — `PlayBoard` Composition Root

Date: 2026-07-20

Status: COMPLETE

Next active phase: Phase 5 — component and layout refactors

## Delivered ownership

`PlayBoard` is now a 443-line composition root. It retains the lifecycle that
must coordinate the match session, presentation host, drag/drop controller,
replay cursor, and component refs, while delegating cohesive rendering and
projection responsibilities:

- `usePlayBoardViewModel` owns viewer-relative projections, replay selection,
  interaction locks, lane power views, pile views, and result labels.
- `MatchHud` owns the fixed opponent resource header and transfer anchors.
- `LaneGrid` owns the stable lane collection and location/card composition.
- `MatchActionBar` owns exit, turn, deck, undo-energy, and end-turn controls.
- `PlayOverlays` owns replay, card inspection, pile inspection, and match-result
  portals.
- Opening presentation remains in the dedicated
  `services/playgame/presentation/openingPresentation` routine introduced
  before this extraction.

Children receive explicit immutable view data and commands. None of the new
modules imports or mutates the match runtime, and no compatibility facade was
introduced.

## Stable DOM and animation contract

This phase did not modify `src/styles/playgame.css`, animation timing,
transforms, easing, flyers, card-face adoption, or presentation sequencing.
The existing presentation and VFX routines remain the only owners of motion.

`LaneGrid` iterates the primitive stable lane IDs rather than transient view
objects. Solid therefore preserves each lane and its card descendants across
unrelated state updates, retaining the DOM identity required by drag/drop,
rect capture, transfer flight, reveal, landing, and lane-topology animation.

The architecture fence rejects inline timers, animation imports, duplicate
lane-row ownership, direct view selectors in `PlayBoard`, and reintroduction of
header/action/overlay markup into the composition root.

## Exit proof

- Play/presentation gate: 27 files, 121 tests green.
- Focused `usePlayBoardViewModel` behavior proof covers active-lane filtering,
  viewer deck projection, and reactive interaction locking.
- Touched-scope ESLint: green with no warnings.
- Production build: green.
- `git diff --check`: green.
- Live route health: `http://127.0.0.1:4000/play` returned HTTP 200. The clean
  QA browser correctly reached the authentication boundary; authenticated
  match rendering remains covered by the provider, interleaving, drag/drop,
  topology, motion, sink, and architecture suites above.

## Exit decision

Every Phase 4 exit criterion is met. Phase 5 may begin as four independent
slices: shared card rendering, board sizing, declarative lane maps, and
instance-scoped VFX.
