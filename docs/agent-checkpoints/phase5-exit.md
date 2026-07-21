# Phase 5 Exit — Component and Layout Refactors

Date: 2026-07-20

Status: COMPLETE

Next active phase: Phase 6 tap-first mobile interaction

## Delivered

- One canonical `CardFace` renders board, hand, and pile card content while
  zone adapters retain geometry, visibility, and interaction ownership.
- The play root is the sole owner of play geometry variables inside the fixed
  9:16 application viewport.
- Stable lane columns declaratively render their map artwork and expose typed
  presentation refs without DOM queries or imperative background mutation.
- Every mounted `VfxHost` owns a distinct card-effects registry. The registry,
  its timers, subscriptions, dedupe state, and cleanup cannot cross match or
  preview boundaries.
- The generic VFX host accepts string anchor keys. Play-specific
  `ZoneAnchorKey` typing now begins at `PlayPresentationHost`, where it belongs.

## Animation preservation

No choreography, duration, easing, reveal apex/hold, card transfer flight,
landing, location flip, map fade, drag handoff, or lane topology motion was
changed. Phase 5 changed ownership and rendering seams only.

## Verification

- Registry isolation proves that identical card IDs in two host instances do
  not share layers, subscribers, cleanup, or post-disposal mutations.
- Architecture fences reject a global card-effects singleton and play-specific
  anchor imports in the generic VFX host.
- Canonical card rendering, declarative lane maps, local board sizing, and
  presentation animation suites remain green.
- Touched-scope ESLint and the production build are green.

## Exit decision

All four Phase 5 slices are complete and independently committed. Phase 6 can
add a tap-card/tap-lane primary interaction without reopening card rendering,
board sizing, lane-map ownership, or VFX lifetime authority.
