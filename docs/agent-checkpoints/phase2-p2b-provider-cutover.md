# Phase 2 P2B — Provider Cutover

Status: complete

Date: 2026-07-20

Authority: `docs/playgame-runtime-and-ui-refactor-plan.md`, Phase 2, and
`docs/agent-checkpoints/phase2-provider-boundary-readiness.md`

## Delivered

- Replaced the combined `PlayGameContext` with one production provider stack:
  `MatchSessionProvider` owns the projected session contract and
  `PlayUiProvider` owns presentation state.
- Migrated classic play, city-map play, `PlayBoard`, drag/drop, replay,
  inspectors, pile viewers, card motion, choreography, and script pacing to
  opaque seat tokens, `SeatVisibleMatchState`, and `SeatTransactionFrame`.
- Deleted `PlayGameContext.tsx` and its superseded test in the same cutover.
  No compatibility facade, fallback read, alias, or dual provider remains.
- Added projected replay, lane-power, card-stat, banished-pile, and effective
  lane-total read models. Components do not import canonical state, card IDs,
  transitions, ledgers, or governed engine operations.
- Preserved a viewer's private staged plan while committed presentation frames
  advance by composing projected states only. The adapter does not retain
  canonical transitions or accept projected tokens as canonical fallbacks.
- Kept card dealing, staging, drag/drop, hand reservations, FLIP motion,
  reveal facing, location flips, VFX/SFX, and missing-anchor completion on the
  existing presentation paths.

## Permanent proofs

`PlayProviders.architecture.test.ts` now rejects:

- resurrection of `PlayGameContext`;
- canonical `MatchState`, `CardId`, `EventTransition`, or committed authority
  timelines in play contexts/components;
- engine policy imports in presentation consumers;
- trusted adapter/session imports outside the explicit provider/screen
  construction boundary; and
- classic or city-map play that bypasses `PlayProviders`.

The five former combined-provider synchronization contracts now pass against
the split provider stack: opening projection, stage/unstage/end-turn
reactivity, private-plan preservation, atomic resolution lock/reveal order,
and missing-anchor opening completion.

## Verification

- Split provider, presentation, script, drag/drop, and play-component suites:
  **19 files, 64 tests passed**.
- Focused projected boundary matrix: **10 files, 34 tests passed**.
- Permanent Phase 1.5 architecture gate: **33 files, 281 tests passed**.
- Runtime/property gate with 200 generated cases: **13 files, 88 tests
  passed**.
- TypeScript protocol tests: **30 passed**.
- Rust protocol tests: **2 passed**.
- Generated protocol schema, 130-card manifest, and 38-location manifest:
  **current and valid**.
- Strict ESLint over every changed TypeScript file: **zero warnings**.
- Production build and `git diff --check`: **passed**.

## Next slice

P2C completes UI-state ownership, gates replay/debug helpers behind development
authority, and proves disposal/remount and stale-generation behavior before
Phase 2 closes.
