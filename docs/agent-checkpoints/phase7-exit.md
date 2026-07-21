# Phase 7 Exit — CSS, Content, and Tooling

Date: 2026-07-20

Status: COMPLETE

Next active work: deferred live-server integration risks require a separately
authorized plan.

## Delivered

- Playgame CSS is rooted at `.playgame-root`, including portal content, and is
  split into explicit token, board, overlay, card, HUD, VFX, and responsive
  ownership modules.
- Production `/play` no longer manufactures a debug match. Development setup
  is gated, dynamically loaded, bootstrap-valid, and deterministic by seed.
- Card and location module indexes are generated artifacts with drift checks.
- Cards and locations validate definition identity, authored references, and
  required assets against the active manifests.
- `CardDef` now encodes the real domain rule: characters and devices have
  `basePower`; spells do not. All 20 active spell definitions dropped the
  meaningless compatibility field, and validation rejects its return.
- `npm run verify:playgame:phase7` is the single reproducible exit gate.

## Verification

- Phase 7 verifier: green.
  - 130 active cards validated with zero warnings.
  - 38 locations validated: 37 playable and one system Ruin.
  - generated card/location indexes and protocol schema are current.
  - touched-scope ESLint is green.
  - manifest structural checks are green.
  - 6 focused Phase 7 files, 54 tests, are green.
  - production Vite build is green.
- Broader playgame UI, debug, presentation, protocol, runtime, and manifest
  regression sweep: 49 files and 273 tests green.
- The broader sweep exposed and fixed one stale replay fixture that supplied
  one-card decks after the canonical opening contract began requiring four.
- `git diff --check` is green.

## Animation preservation

This content/tooling slice did not alter presentation choreography, animation
durations, transforms, easing, or VFX declarations.

## Exit decision

Phase 7 is complete. The local `/play` runtime and UI refactor plan has no
remaining implementation phase. Live-server durability, wire security,
reconnect, horizontal ownership, backpressure, clocks, and production protocol
cutover remain intentionally deferred and should begin under their own spec.
