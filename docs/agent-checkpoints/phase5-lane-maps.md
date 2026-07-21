# Phase 5 Slice 3 — Declarative Lane Maps

Date: 2026-07-20

Status: COMPLETE

Next active slice: Phase 5 instance-scoped VFX

## Delivered

- `LaneMap` declaratively owns one map element, lane identity, reveal state,
  and artwork URL inside each stable `LaneColumn`.
- Map artwork changes now come only from the projected `ResolvedLocation`.
  The presentation sink no longer looks up a location definition or writes a
  background image into the DOM.
- `useLanePresentationRefs` binds the stable map and location-tile elements by
  lane ID. `PlayBoard` no longer searches for `.lane-map` or `.location`
  elements with selectors.
- `LaneGrid` continues to key its collection by primitive stable lane IDs, so
  map, tile, and card-slot DOM identity survives lane movement and location
  replacement.
- No active map shuffle, random selection, DOM creation, append, or layout
  measurement path remains. The archived prototype stays outside runtime.

## Animation preservation

The existing location reveal preparation, clone, 700 ms two-sided flip, and
map opacity transition remain in the presentation sink with the same timing,
easing, cancellation, and cleanup. This slice changed only how that routine
obtains its elements and how the map image is rendered.

## Verification

- Focused lane-map/ref/location-sink/architecture gate: 5 files, 32 tests
  green.
- Declarative map proof verifies that one DOM element survives projected
  artwork and reveal-state updates.
- Ref lifecycle proof verifies deterministic bind and cleanup by lane ID.
- Production build: green.
- Touched-scope ESLint: green with no warnings.
- `git diff --check`: green.

## Exit decision

The declarative lane-map slice is complete and independently reviewable. The
remaining Phase 5 slice can make VFX registries instance-scoped and move
playgame-specific anchor typing behind the presentation host.
