# Phase 5 Slice 2 — Local Board Sizing

Date: 2026-07-20

Status: COMPLETE

Next active slice: Phase 5 declarative lane maps

## Delivered

- `AppViewport` remains the sole owner of the application's fixed 9:16 frame.
- `.playgame-root` is now the sole owner of playgame board, lane, location,
  card, and hand geometry variables.
- The play root consumes its fixed host through `100cqw` / `100cqh`; browser
  and host resizing therefore update geometry through CSS without a JS write.
- The redundant `.board.play-frame` width/height variable override is gone.
- The unused `BoardSizer` global writer and its `document.documentElement`
  mutation path are deleted. The parked city-map surface now consumes the
  same local CSS geometry contract.
- The narrow-phone gap overrides are scoped to `.playgame-root`, so they no
  longer change unrelated application surfaces.

No compatibility fallback, alias, resize listener, or dual-write path remains.

## 9:16 proof

`AppViewport` computes frame width as the minimum of device width, 9/16 of
device height, and the desktop cap; frame height is always width times 16/9.
This letterboxes a 9:21 phone rather than stretching the game. In live browser
verification at a 2560×1440 viewport, the host measured 430×764.4375 with a
0.562505 ratio (9/16 within subpixel rounding), and the page logged no errors.

## Geometry and animation safety

The board still fills exactly 100% of that host. Lane/card dimensions retain
their existing formulas and values, and no motion, transform, drag, reveal,
or presentation source changed. Container units replace only the authority
that supplies `--board-w` and `--board-h`.

## Verification

- Focused architecture/provider/drag/topology gate: 4 files, 34 tests green.
- Production build: green.
- Touched-scope ESLint: green with no warnings.
- `git diff --check`: green.
- Live 9:16 frame measurement: green; browser errors: none.

## Exit decision

The Phase 5 board-sizing slice is complete and independently reviewable. Lane
map ownership can now move into declarative lane rendering without reopening
viewport or board geometry authority.
