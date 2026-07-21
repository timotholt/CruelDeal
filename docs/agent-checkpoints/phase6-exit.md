# Phase 6 Exit — Tap-First Card Interaction

Date: 2026-07-20

Status: COMPLETE

Next active phase: Phase 7 CSS, content, and tooling cleanup

## Delivered

- `setupCardInteraction` is the one instance-local authority for tap,
  keyboard, mouse, pen, and touch card interaction.
- A playable hand card can be selected without dragging. All currently legal
  lanes are highlighted, including the next empty slot, and tapping a legal
  lane stages through the canonical match action.
- Selecting a staged card highlights the hand return target; tapping it, or
  pressing Delete/Backspace, invokes the canonical targeted undo action.
- Enter/Space select and play; Escape cancels selection. Hand cards and local
  lane targets expose keyboard focus and accessible action labels.
- Pointer drag remains an enhancement with its existing visual clone, landing
  duration, easing, pointer capture, and card-motion lease behavior unchanged.
- UI capacity checks now consume `manifest.constants.laneCapacity`; the
  runtime remains final legality authority.
- Selection, drag, in-flight tap state, targets, and cleanup all live inside
  the mounted controller. There is no module-global interaction state.

## Animation preservation

Tap actions reuse the established `PlayMotionSurface` card-motion session and
accepted-drop handoff. Existing drag, transfer, reveal, flip, map, and lane
choreography was not edited.

## Verification

- Focused interaction/card-motion/architecture gate: 3 files, 40 tests green.
- Mouse, pen, and touch stage through the same pointer controller.
- Tests cover tap staging, tap undo, keyboard selection/cancellation/staging,
  below-threshold gestures, pointer cancellation, and accepted visual handoff.
- Architecture fences reject hard-coded four-card UI capacity and require the
  manifest constant at the composition root.
- Touched-scope ESLint, production build, and `git diff --check` are green.
- Clean in-app and Chrome sessions reached the phone-sized login surface but
  did not expose an authenticated match, so no authenticated state was
  bypassed for live interaction testing.

## Exit decision

Phase 6 is complete. Tap/keyboard are reliable primary controls, pointer drag
remains intact as an enhancement, and all paths converge on canonical staging
or undo actions with runtime validation.
