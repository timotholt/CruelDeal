# Phase 1 Checkpoint 4 — Live Runtime Authority

Status: complete. Live `/play` setup, planning, AI, turn locking, resolution,
opening, and presentation handoff now use `MatchRuntime` as the sole gameplay
authority.

## Bootstrap and provider wiring

- The debug picker now produces a complete `MatchBootstrap` with `mode:
  'DEBUG'`, stable debug participant identities (`YOU` and `OPPONENT`), deck
  IDs/revisions/names, canonical content hashes, and both selected deck entry
  lists.
- `ClassicPlayScreen` validates that bootstrap before mounting play. Bootstrap
  validation recognizes `DEBUG` as a descriptive mode without changing rules.
- `PlayGameProvider` accepts only a `ValidatedMatchBootstrap`, creates the
  runtime, initializes its Solid store from runtime state, and subscribes to
  committed timelines. A subscription adopts the already-validated final fold;
  it never resolves or applies gameplay events itself.
- The city-map experiment was moved onto the same validated bootstrap/provider
  boundary so `PlayGameProvider` has no legacy `initialState` authority path.

## Private planning, undo, locks, and AI

- `STAGE_CARD` is accepted into a per-seat private planning stack. Its working
  projection is a deterministic fold from the committed turn base, while its
  events do not enter committed transactions or replay history.
- `UNSTAGE_CARD` removes the targeted stage and its dependent suffix;
  `UNDO_TURN` clears the seat's stack. Both refold from the turn base. The old
  `structuredClone` snapshot history restore is gone.
- A characterization test stages on revealed Gun Store, verifies the `+2`
  entry effect, and proves suffix/full-turn undo returns the exact turn base
  without adding a committed transaction.
- `END_TURN` privately locks a seat. With two non-AI seats, the first lock does
  not change phase or commit a transaction. The second lock triggers one
  `SYSTEM` resolution transaction.
- For local AI matches, the runtime schedules ordinary P1 `STAGE_CARD` and
  `END_TURN` envelopes. Planning uses `planEnemyTurnFromHand`, so every play
  references a real authoritative hand instance. The live pool-planner seam
  was deleted.
- At resolution, the runtime deterministically merges each seat's retained
  private order with the priority owner first, re-resolves every stage against
  the canonical merge, emits `TURN_RESOLUTION_STARTED`, and commits the full
  reveal/bookkeeping/location transaction before publishing frames.

## Opening and presentation

- Revision 1 is the shared symmetric opening transaction. It draws
  `startingHandSize` cards for both seats, reveals the first location, and
  includes its ordered reveal effects.
- `openingSequence` no longer deals or reveals authoritatively. It only paces
  the already-committed opening frames and existing board/toast choreography.
- `eventAnimator` now accepts a committed `MatchEventFrame` and derives
  transfers from `frame.before`/`frame.after`. It does not call `apply`,
  dispatch an event, or write engine state.
- Turn presentation iterates every committed frame in order. The pacing index
  preserves all events before the first flip, when flips are already visible,
  and when no flips exist. Animation failures are caught as presentation-only
  failures; canonical state and the Solid store were finalized before pacing.
- `_engineEvents`, `_engineFinalState`, `_revealsConsumedUpTo`,
  `liveRevealHandoff.ts`, and `liveRemoteSeatPlanner.ts` were deleted.

## Live-authority audit

- No component calls gameplay `dispatch` or `setEngineState`.
- Context commands are the only component-facing stage, targeted unstage,
  latest undo, and end-turn mutation surface.
- No live code imports `planEnemyTurnFromPool` or the removed
  `planLiveRemoteSeat` seam. The pool planner remains defined only for legacy
  simulations and engine tests.
- Focused ESLint over all changed production files passes with zero warnings;
  `git diff --check` passes.

## Required gates

- `npm run test:playgame:phase0` — pass at `PLAYGAME_PROPERTY_CASES=200`.
- `npx vitest run services/playgame/runtime` — pass: 8 files, 45 tests.
- `npm run build` — pass (`vite build`, 1181 modules transformed).

## Reactive store regression fix

The turn-2 accepted-stage/no-render bug was an adapter ownership defect, not a
runtime projection defect:

- Provider initialization already used `structuredClone(runtime.state())`, so
  the store root did not initially alias the runtime root.
- `MatchRuntime.state()` returns `visibleState()`, which folds the viewer's
  private planning stack over the committed base. It correctly contained the
  staged card, reduced energy, hand removal, and lane insertion.
- The alias was reintroduced by later calls to
  `reconcile(timeline.finalState)` / `reconcile(runtime.state())`. Solid's
  reconciler can retain newly inserted array members from the source graph. A
  turn-1 committed sync demonstrably left newly drawn hand card objects shared
  between runtime authority and the Solid store. Subsequent projections could
  therefore hit identity short-circuits instead of producing all required
  reactive writes. This is why the failure appeared after the first committed
  turn even though initialization was cloned.
- Default `reconcile` array keying was not the primary defect, and the runtime
  was not returning the committed base. Both concerns are removed from this
  boundary by no longer reconciling runtime-owned object graphs at all.

`PlayGameProvider` now adopts both private working projections and committed
timeline final states by cloning the snapshot and replacing every top-level
Solid-store branch. The store root remains stable for consumers, while no
runtime-owned object or array can become a store-owned node. The same helper is
used by `stageCardInLane`, `undoPendingCard`, the post-`END_TURN` sync, and the
committed-transaction subscriber.

`contexts/PlayGameContext.test.tsx` is the regression test. It mounts the real
provider and records a Solid effect over the presented state. The deterministic
Street Destroy versus Swarm fixture verifies reactive observations for an
accepted turn-1 stage, targeted unstage, restage, committed end-turn, and the
reported accepted turn-2 stage. Each stage assertion covers staging order,
energy, hand removal, and lane insertion. The Vitest config now supplies the
same `@` alias used by application modules so provider tests run under jsdom.

Post-fix verification:

- `npx vitest run contexts/PlayGameContext.test.tsx` — pass: 1 file, 1 test.
- `npm run test:playgame:phase0` — pass at `PLAYGAME_PROPERTY_CASES=200`: 8
  files, 45 tests.
- `npx vitest run services/playgame/runtime` — pass: 8 files, 45 tests.
- `npm run build` — pass (`vite build`, 1181 modules transformed).

## Opening hand-reservation regression fix

The turn-1 `scrap-rat` interactivity bug was a presentation-sidecar lifecycle
defect. `animateEvent` reserved a local hand destination before its deal
animation, but released it only after every transfer completed successfully.
`paceTimeline` correctly treats animation failures as non-authoritative and
catches them, so a rejected animation left that reservation in
`ui.handReservations` with no later owner to remove it. `PlayBoard` then
correctly excluded the reserved card from `interactiveHand`, producing the
observed `draggable=false` wrapper despite the card being affordable.

Reservation ownership is now explicit and failure-safe:

- Each presentation beat reserves its resolved local hand destinations and
  releases exactly those IDs in a `finally`, whether its animation completes
  or throws.
- The committed-timeline presenter clears all hand reservations in its own
  `finally`, covering normal completion, skipped/failed frames, and early
  cancellation.
- Script cancellation has an immediate cleanup hook. `PlayBoard` registers
  reservation clearing there, so aborting an in-flight presentation cannot
  leave the UI sidecar gated while animation timers settle.
- `PlayBoard` now uses the pure `selectInteractiveHand` selector, allowing the
  presentation regression to assert against the same filtering rule as the
  live surface.

`contexts/PlayGameContext.test.tsx` now runs the real committed opening timeline
for the deterministic Street Destroy versus Swarm provider fixture. It asserts
that `handReservations` is empty after opening presentation and that every
turn-1 hand card whose cost is within current energy is present in
`selectInteractiveHand`. `services/playgame/presentation/handReservations.test.ts`
covers successful per-beat release, thrown animation cleanup, and immediate
script-abort cleanup. The earlier stage/unstage/end-turn/turn-2 provider
regression remains green in the same focused run.

Post-fix verification:

- `npx vitest run contexts/PlayGameContext.test.tsx services/playgame/presentation/handReservations.test.ts`
  — pass: 2 files, 4 tests (including the first provider regression).
- Focused ESLint over all files touched by this fix — pass with zero warnings.
- `npm run test:playgame:phase0` — pass at `PLAYGAME_PROPERTY_CASES=200`: 8
  files, 45 tests.
- `npx vitest run services/playgame/runtime contexts` — pass: 9 files, 47
  tests.
- `npm run build` — pass (`vite build`, 1183 modules transformed).

## Third fix round — projection adoption and committed-frame pacing

### Root-cause analysis

The five live symptoms were presentation-adoption failures; the runtime fold
and replay transaction remained correct.

1. The committed-transaction subscriber replaced the Solid store with
   `timeline.finalState`. That state is the canonical committed fold, while a
   player's not-yet-canonical staged cards live in the viewer's private working
   projection. The committed snapshot and later stage/unstage sync therefore
   competed as two different store sources. During resolution, clearing the
   private plan before the presenter had consumed its corresponding canonical
   `CARD_STAGED` frames also created a window in which already-visible local
   cards could disappear.
2. The provider initialized the store from the already-final opening state and
   adopted every later transaction's final fold in its subscriber. The
   presentation loop still iterated event metadata, but `animateEvent` no
   longer had a dispatch point that advanced the presented Solid state. The
   destination hand cards and revealed locations were consequently visible
   before their deal/reveal animations, and later location reveals could appear
   halfway through unrelated resolution animation.

### Fixes

- `MatchRuntime.projectWorkingState(baseState)` is now the single read-only
  projector for “committed presentation base + current private plan.” It skips
  a private stage once the supplied committed frame already contains that card,
  preventing entry effects or energy changes from being folded twice.
- `PlayGameProvider` funnels stage, unstage, ordinary committed adoption, frame
  adoption, and cancellation fast-forward through one cloned working-projection
  adoption path. A committed subscriber synchronously captures the viewer's
  projected resolution frames before the consumed private plans are released.
  Thus local staged cards remain visible until their canonical stage frame, and
  remote cards already visible in the current projection are not erased by a
  bare committed fold.
- The presented store now begins at genesis, while runtime authority remains at
  the committed opening final state. `__snapDebug.getLiveState()` and
  `getLiveLog()` read the runtime directly, so debugging continues to report
  live authority rather than the intentionally lagging display frame.
- `animateEvent` now exposes a presentation dispatch point between source-rect
  capture and destination animation. Each committed frame advances the Solid
  store at that point. `LOCATION_REVEALED` advances only inside its reveal beat,
  after the hidden-tile lead-in; `CARD_FLIPPED` retains the existing reveal
  cinematic and advances before its dependent event frames. Opening cards
  therefore enter one at a time with the deck-to-hand fly-in, lane 1 reveals as
  its own final opening beat, and turn-resolution locations reveal at their
  canonical frame positions.
- The provider regression now starts from an empty presented opening hand,
  records incremental deal frames and the lane-1 reveal boundary, and stages a
  real card before triggering the real AI/system resolution commit. It asserts
  that the staged card remains in the presented lane before the frame walk, then
  walks the transaction and verifies the final turn projection. A second
  adoption regression directly verifies that re-adopting a committed base while
  a private stage exists preserves hand removal, staging order, and lane
  placement.

### Interim scope / residual snap behavior

Opening and full turn-resolution transactions now walk every committed frame;
this covers the requested CP4 pacing surface, including lane 2. Transactions
without an opening or turn-resolution presentation driver still adopt their
final working projection immediately. Presentation cancellation or exhausted
best-effort animation failure also fast-forwards the display to the runtime's
latest working projection. These are display-only snaps and do not gate, replay,
or mutate runtime authority; Phase 3a's presented-frame cursor remains the
general replacement.

Third-round verification:

- `npm run test:playgame:phase0` — pass at `PLAYGAME_PROPERTY_CASES=200`.
- `npx vitest run services/playgame/runtime contexts` — pass: 9 files, 48 tests.
- `npm run build` — pass (`vite build`, 1183 modules transformed).
- `git diff --check` — pass.

## Fourth fix round — deadlock-proof opening presentation

### Verified cause

The live stall was the requestAnimationFrame-gating shape, not an anchor
chicken-and-egg:

- `animateEvent` advances the committed frame before reserving the new hand
  destination and starting its fly-in. A missing card or zone anchor already
  falls back to a resolved no-animation path, so projection advancement does
  not require a destination rectangle.
- When a hand destination does exist, `slideFromDeckToHand` previously created
  a promise whose completion timers were installed only inside
  `requestAnimationFrame`. If that callback was throttled or never delivered,
  the promise never settled. The observed single hidden, non-draggable hand
  wrapper is the exact post-dispatch reservation state immediately before that
  await. The walk could therefore never reach its next committed frame.
- The generic transfer path had the same unbounded `requestAnimationFrame`
  await before applying its CSS transition.

### Deadlock-impossible construction

- Deck-to-hand fly-ins now treat disconnected or absent DOM destinations as an
  immediate no-animation success. When an anchor exists, an independent wall
  timer always removes the flyer, restores the real card's visibility, and
  settles the promise even if no animation frame is delivered.
- The generic transfer next-paint wait races `requestAnimationFrame` against a
  short timer fallback.
- Every committed presentation frame is additionally enclosed by a five-second
  deadline. Completion, rejection, and timeout all commit that frame exactly
  once. After the deadline, the callback is closed so a late animation
  continuation cannot replay an older presented projection out of order.
  Reservations are cleared immediately on failure/timeout and again at the
  timeline terminal boundary.
- This makes the plan invariant explicit: committed state progression never
  depends on DOM anchors, rectangles, paint delivery, audio, or animation
  callbacks. Animation remains best-effort pacing over already-committed
  authority.

### Regression and live verification

`contexts/PlayGameContext.test.tsx` now runs the real opening frame walk with
empty `cardRefs`, empty `zoneRefs`, no deck element, and no lane/location DOM
anchors. With fake timers it observes the incremental local deal sizes
`[1, 2, 3]`, then asserts the presented projection finishes at hand 3, deck 9,
and lane 1 revealed, with no retained hand reservation.

A clean full-page browser run on `/play` with Street Destroy versus Swarm
verified both sides of the contract:

- At seven seconds, the presented hand was mid-walk with two card wrappers and
  one active reservation, proving that working animations still pace rather
  than snap the opening immediately.
- At fourteen seconds, the hand had three wrappers and all three were
  draggable, the deck showed 9, lane 1 showed `RED NEEDLE` while lanes 2 and 3
  remained `???`, turn 1 controls were enabled, and the console had no errors.

Fourth-round verification:

- `npx vitest run contexts/PlayGameContext.test.tsx` — pass: 1 file, 3 tests.
- Focused ESLint over the fourth-round implementation and regression files —
  pass with zero warnings.
- `npm run test:playgame:phase0` — pass at
  `PLAYGAME_PROPERTY_CASES=200`: 8 files, 45 tests.
- `npx vitest run services/playgame/runtime contexts` — pass: 9 files, 48
  tests.
- `npm run build` — pass (`vite build`, 1183 modules transformed).
- `git diff --check` — pass.
