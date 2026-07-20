# Phase 1.5 C5A-2 — Cost and Energy Exit Evidence

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5A-2 governs Cost, current Energy, maximum Energy, next-turn Energy bonuses,
and the exact payment/refund lifecycle of staged plays through canonical kernel
transactions.

## Canonical Design

- `CHANGE_COST` accepts permanent `ADD` or effective-Cost `SET` mutations.
- `CHANGE_ENERGY` targets `CURRENT`, `MAXIMUM`, or `NEXT_TURN_BONUS`.
- `CARD_COST_CHANGED` is constructed only by
  `kernel/operations/cost.ts`.
- All three Energy mutation events are constructed only by
  `kernel/operations/energy.ts`.
- Every Cost and Energy event carries complete non-empty provenance.
- `stagedPlays` stores `{ cardId, energyPaid }` for each unresolved
  hand-origin play.
- Unstage and undo refund the committed `energyPaid`; they never recompute
  Cost from later state.
- Reveal, unstage, destruction, banishment/zone removal, and turn cleanup
  close payment provenance.
- Invalid commands, reducer invariants, and exhausted budgets publish no
  partial transaction.

## Clean Cutover

The ID-only `stagingOrder`, public direct Cost mutation helpers, evaluator-
owned Cost/Energy event construction, built-in Energy construction, and
resolve-owned Energy construction were removed. No fallback payment field,
optional provenance, alias, dual write, or compatibility adapter remains.

## Proof

- Phase 1.5/kernel: 17 files, 111 tests green.
- Phase 0/runtime: 12 files, 80 tests green with 200 generated property cases.
- Focused modified runtime, presentation, and context coverage: 12 files,
  139 tests green.
- Standalone reducer, resolver, and evaluator executable suites green.
- TypeScript protocol: 5 tests green.
- Rust protocol: 2 tests green.
- Protocol schema artifact current.
- Active cards: 128 validated.
- Active locations: 38 validated.
- Production Vite build green.
- Phase 1.5 lint green.
- Architecture scans prove sole Cost/Energy event ownership and the absence of
  production `stagingOrder`, `stagedEnergyCost`, `adjustCardCost`, and
  `setCardCost`.

## Next

After the full exit gate is recorded here, C5A-3 governs the next remaining
mutation family from the Phase 1.5 inventory: tags, counters, text override,
pending effects, and transform.
