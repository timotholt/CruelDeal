# Card and Location Raster Surface Implementation

Date: 2026-07-21

Spec: `docs/card-location-raster-surface-spec.md`

## Delivered

- Added renderer-safe card, location, lane, status, hit-test, and VFX contracts.
- Added pure seat-safe appearance mappers with deterministic static-content keys.
- Added canonical-resolution card and location canvas rasterizers.
- Added bounded LRU bitmap caches with in-flight request deduplication, bitmap
  disposal, reset hooks, and metrics.
- Split static card/location content from system-owned backs, borders, live
  stats, persistent statuses, lane scores, and bounded transient effects.
- Converted hand, lane, pile, inspector, transfer, undo, card reveal, and
  location reveal paths to canonical surface models.
- Replaced visual DOM cloning with freshly mounted temporary surface instances.
- Replaced inspector DOM-child discovery with canonical surface hit testing.
- Deleted the superseded face components, render-plan model, and render cache.
- Added import fences, hidden-identity checks, mapper/cache tests, renderer
  tests, motion tests, and canonical interaction fixtures.

## Verified

- `npm run test:architecture`: 125 tests passed.
- Focused surface/presentation/interaction suite: 87 tests passed.
- `npm run typecheck:playgame` and `npm run typecheck:app` passed after the
  surface implementation. Subsequent concurrent engine timeline edits made the
  shared worktree typechecks fail in engine/runtime files unrelated to this
  surface change; the final production build still passed after the last
  surface edit.
- `npm run build`: passed.
- `git diff --check`: passed.

Live browser evidence confirmed that card and location fronts use actual canvas
bitmaps, backs expose no private text, inspector surfaces are newly mounted at
full opacity with the same static render key, and location score plates remain
lane-owned and scale correctly around the canonical location surface.

The uninterrupted browser sequence covering stage, undo, end-turn, location
reveal, and replay could not be completed in this pass because unrelated engine
files were changing concurrently and repeatedly hot-reloaded the local game
back to login/deck selection. Deterministic drag, undo, reveal, handoff, and
cleanup suites are green; repeat the browser sequence once the shared dev
server is stable.
