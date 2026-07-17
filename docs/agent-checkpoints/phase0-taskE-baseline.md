# Phase 0 Task E — Pre-refactor lint/build/test baseline

Recorded 2026-07-17 at commit `06c7166` (before any Phase 0 implementation
landed). Every later phase gate compares against these exact numbers:
"no new failures" means no growth beyond this baseline in the touched scope.

## npm run lint

- Exit code: **1**
- Totals: **620 problems (269 errors, 351 warnings)**
- Failures are broad and preexisting across the repo; none are in the new
  Phase 0 directories (`services/playgame/engine/testkit/`,
  `services/playgame/runtime/`).

## npm run build

- Exit code: **0** (build succeeds)

## npx vitest run services/playgame/engine

- **22 test files fail to collect** with `No test suite found` — the legacy
  engine tests are script-style (console PASS/FAIL prints, no describe/it)
  and were written for direct execution, not vitest collection. Their
  assertions still print PASS when executed.
- `manifest/manifest.test.ts` additionally asserts 106 cards; the manifest
  now has 128. Preexisting content drift, not a Phase 0 regression.
- 131 individual tests that do collect pass; 0 test-level failures.
- Phase 1 may convert legacy script-style tests to real vitest suites; that
  conversion is tracked work, not silent baseline erosion.

## npx vitest run services/playgame/runtime (new Phase 0 suites)

- 3 files, **16 passed, 3 expected-fail** — the expected failures are the
  three characterized reveal event-loss paths from the Problem Statement,
  encoded as failing contract tests that must FLIP TO PASSING when
  MatchRuntime lands (Phase 1 gate).

## Gate rule

A phase merge is blocked only by NEW failures relative to this record:
lint errors above 269 in touched files, build exit != 0, engine test-level
failures above 0, or any regression in the Phase 0 runtime suites.
