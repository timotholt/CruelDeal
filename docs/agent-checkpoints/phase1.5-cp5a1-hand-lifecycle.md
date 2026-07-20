# Phase 1.5 C5A-1 — Hand Lifecycle Exit Evidence

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5A-1 is complete. Draw, discard, hand entry, and immediate gained-Power
reactions now pass through canonical kernel transactions.

## Canonical Design

- `DRAW_CARD` supports canonical top-deck draw and exact existing-card draw.
- `DISCARD_CARD` accepts only cards currently in the affected hand.
- `CARD_DRAWN` and `CARD_DISCARDED` are constructed only by
  `kernel/operations/hand.ts`.
- `CARD_POWER_CHANGED` is constructed only by
  `kernel/operations/power.ts`.
- Draw reactions use active post-transition hand-entry policy snapshots.
- Discard reactions use immutable pre-transition card-text snapshots.
- `onGainedPower` fires immediately after a committed positive stored-Power
  mutation and never from delayed turn polling.
- Courthouse-blocked gains, losses, unrevealed cards, empty decks, foreign
  exact-card selections, and full hands schedule no invalid reaction work.
- Nested effects and all reaction results remain atomic with the initiating
  kernel transaction.

## Clean Cutover

The superseded draw helper, hand-entry pseudo-effect, manual hand-entry
debuff path, delayed power-gain polling, and marker built-ins were deleted.
Panopticon AI and Adrenal Graft are ordinary typed authored content. No
fallback event field, alias, dual write, or compatibility adapter remains.

## Adjacent Correctness Fixes

- Enemy top-deck copy now uses canonical deck index zero.
- Hand-replacement built-ins may operate at capacity because banishing the
  replaced card frees the destination slot before creation.

## Proof

- Phase 1.5/kernel: 15 files, 94 tests green.
- Focused hand/power/builtin acceptance: 3 files, 32 tests green.
- Active cards: 128 validated.
- Active locations: 38 validated.
- Protocol schema current.
- Production Vite build green.
- Phase 1.5 lint green.
- Relevant TypeScript files have no type errors; the only filtered compiler
  error is the pre-existing deprecated location-catalog import.

## Next

C5A-2 governs cost and energy mutations. The existing unstage-refund behavior
must be made explicit while migrating: a staged card currently does not retain
the amount actually paid, so a later effective-cost change can alter its
refund. The next slice must preserve that rule with an explicit contract or
replace it deliberately—never inherit it accidentally.
