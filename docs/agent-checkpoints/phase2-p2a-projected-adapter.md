# Phase 2 P2A — Projected Session Adapter

Status: complete

Date: 2026-07-20

Authority: `docs/playgame-runtime-and-ui-refactor-plan.md`, Phase 2, and
`docs/agent-checkpoints/phase2-provider-boundary-readiness.md`

## Delivered boundary

- Added `LocalMatchSessionAdapter` as the only trusted local bridge between
  canonical `MatchSession` authority and the future player-facing providers.
- Projected bootstrap metadata contains deck counts and display metadata, but
  not seeds, deck entries, content hashes, or canonical card identities.
- Player commands accept opaque seat card tokens. The adapter resolves them
  internally, rejects canonical IDs, enemy tokens, and stale/wrong-zone
  tokens, and returns receipts that do not expose committed transaction
  records.
- Opening and committed transactions are materialized as
  `SeatTransactionTimeline`/`SeatTransactionFrame`. Each frame retains its
  canonical temporal coordinate while exposing only redacted before/after
  state and a projected animation event.
- Added player-safe card-stat and lane-power read models. Canonical power
  ledgers, card IDs, location IDs, and effect source IDs are converted to
  visible values and source labels before crossing the adapter.
- Production providers and components remain unchanged in P2A. The single
  provider cutover and deletion of `PlayGameContext` belong to P2B.

## Boundary proofs

Focused tests prove:

1. setup/opening projection does not expose bootstrap or state secrets;
2. hidden opponent identities remain hidden;
3. opaque owned tokens stage and unstage normally;
4. canonical IDs, enemy tokens, stale tokens, and wrong-zone tokens reject;
5. committed subscribers receive only projected frame timelines;
6. command results contain no canonical transaction;
7. undo-last uses internal authority without returning a card ID;
8. hidden cards have no stat read model; and
9. stat/lane read models contain labels rather than canonical provenance IDs.

## Gates

- Focused adapter/projection tests: **2 files, 9 tests passed**.
- Runtime/property gate with `PLAYGAME_PROPERTY_CASES=200`:
  **13 files, 88 tests passed**.
- Complete Phase 1.5 verifier: **passed** — 33 files/281 permanent
  architecture tests, the 88-test runtime gate, 30 TypeScript protocol tests,
  2 Rust protocol tests, generated-schema/content checks, 130 cards, 38
  locations, and the production build.
- Strict ESLint over every changed production/test TypeScript file:
  **passed with zero warnings**.
- `git diff --check`: **passed**.

## Next slice

P2B replaces the combined `PlayGameContext` with `MatchSessionProvider` and
`PlayUiProvider`, migrates all production consumers to projected types, ports
the existing provider synchronization contracts, and deletes the old provider
and tests in the same checkpoint.
