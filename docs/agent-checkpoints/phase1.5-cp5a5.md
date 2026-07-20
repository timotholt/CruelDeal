# Phase 1.5 C5A-5 — Governed Staged Play and Reveal Timing

Status: implemented and exit-proven

Date: 2026-07-20

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5A-5 is complete only when staged play is one governed transaction and
private planning is an intent plan, not an alternate committed event history.
There is no compatibility requirement: the old inverse event and every reader
of it must be deleted.

## Canonical Contract

`STAGE_PLAY` accepts only:

- `intentId`;
- authenticated `owner`;
- `cardId`;
- destination `lane`;
- immutable `cause`.

The caller cannot provide Cost, payment, reveal timing, card placement, or a
past-tense event. Against the current private candidate, the operation:

1. validates phase, owner, a hand-resident card, definition, active lane,
   capacity, and play policy;
2. computes effective Cost while the card is still in hand;
3. validates current Energy;
4. commits `CARD_STAGED` with exact payment provenance;
5. requests the exact governed current-Energy spend;
6. resolves reveal timing after the card occupies its candidate lane;
7. requests `SET_CARD_REVEAL_TIMING`.

The ordinary non-zero-cost trace is exactly:

```text
CARD_STAGED
ENERGY_CHANGED
CARD_REVEAL_SCHEDULED
```

`CARD_STAGED` must leave `revealTiming` null. Only
`SET_CARD_REVEAL_TIMING` may produce `CARD_REVEAL_SCHEDULED`.

## Private Planning Contract

Runtime planning stores ordered stage intents only. It never caches accepted
stage event batches as authority.

- Projection deterministically refolds the complete owner plan from the
  authoritative base plus that owner's deterministic controller prelude.
- Adding a stage validates the complete resulting sequence before replacing
  the plan.
- Removing an older stage removes the requested intent, then refolds and
  validates every remaining intent in order.
- If that suffix becomes invalid, removal is rejected and the prior plan is
  retained unchanged.
- Undo clears the owner's plan and controller prelude.
- Unstage and undo commit no transaction, event, Frame, reaction, refund, or
  replay record.
- Exact Energy restoration is the natural result of refolding from the same
  authoritative base.
- Lock re-resolves both owners' intent plans in canonical priority-owner and
  per-owner order, then commits those stage transactions with turn resolution.

`CARD_UNSTAGED` is absent from the active event alphabet, reducer, protocol,
timeline, runtime projection, replay narration, presentation transfers, and
Energy reasons.

## Adversarial Exit Matrix

| Domain | Required proof |
|---|---|
| Exact trace | Ordinary stage emits only staged, exact spend, and explicit timing in that order. |
| Default timing | No override schedules the current turn with stage-system provenance. |
| Post-placement policy | Same-lane delayed/end-of-game policy observes the card after placement and wins deterministically. |
| Effective Cost | Permanent and live hand-only reductions determine `energyPaid`; loss of the hand-only modifier after placement does not change payment provenance. |
| Zero Cost | A clamped zero-cost card records `ENERGY_CHANGED` with canonical `delta: 0`, preserving the exact trace without reducing Energy. |
| Multi-digit Cost/Energy | Safe-integer two-digit payment is neither truncated nor layout-shaped by engine code. |
| Invalid numeric state | Unsafe Cost or Energy rejects atomically with no committed prefix and no input mutation. |
| Ownership/zone | Missing card, wrong owner, non-hand card, and unknown definition reject atomically. |
| Lane policy | Missing, inactive, destroyed, or full lane and active block-play policy reject atomically. |
| Phase | Setup, resolving, and ended states cannot stage. |
| Determinism | Equal state plus equal command yields equal events, transitions, usage, and state. |
| Budget/reducer failure | Failure after the first proposed step publishes no partial result and preserves the input state. |
| Reactions | Staging and timing scheduling discover no gameplay lifecycle reaction. |
| Ordered plan | Multiple stages fold in intent order, consuming candidate Energy and capacity at each step. |
| Remove suffix | Removing an older stage refolds later stages rather than replaying cached event batches. |
| Failed removal | If the remaining suffix is illegal, the plan and projected state remain unchanged. |
| Undo | Clears only the requesting owner plan and restores its projection exactly to authoritative base plus valid prelude. |
| Seat isolation | One owner's unstage/undo cannot erase or expose the other owner's private plan. |
| Lock parity | The locked committed stage trace equals a fresh canonical refold of accepted intents. |
| Replay parity | Genesis plus committed locked-turn frames reconstructs authoritative state; private edits are absent. |
| Presentation parity | Stage transfer remains hand-to-lane; no inverse committed transfer exists. |
| Protocol parity | Active schemas accept governed stage/timing events and have no unstage variant. |
| Source ownership | Only staged-play operation constructs `CARD_STAGED`; only reveal-timing operation constructs `CARD_REVEAL_SCHEDULED`. |
| Clean cutover | No active production source contains `CARD_UNSTAGED`, cached planning events, refund reason, wrapper, alias, or fallback field. |

## Permanent Architecture Gates

The C5A-5 architecture test must enforce:

- sole event construction by the two owning operation modules;
- no implicit reveal timing in the `CARD_STAGED` reducer case;
- no caller-supplied `energyPaid` on `StagePlayCommand`;
- no active `CARD_UNSTAGED` token;
- no direct stage-time Energy or reveal-timing transaction in the intent
  resolver;
- runtime private planning stores intents and refolds rather than retaining
  stage event batches.

## Exit Evidence

Exit gates passed:

- [x] focused staged-play, replay, presentation, runtime, architecture, and
  exit contracts: 38/38
- [x] runtime private-plan/refold contracts: 14/14
- [x] Phase 1.5 suite: 254/254
- [x] Phase 0 generated-match suite: 83/83
- [x] TypeScript protocol conformance: 30/30
- [x] Rust protocol conformance: 2/2
- [x] protocol schema freshness
- [x] active card validation: 130 cards (15 pre-existing spell-basePower
  warnings)
- [x] active location validation: 38 locations
- [x] production build
- [x] targeted lint for all C5A-5 production and contract files
- [x] source ownership and clean-cutover scans
- [x] replay reconciliation

## Stop Conditions

Do not mark C5A-5 complete if any of the following remains:

- `CARD_STAGED` writes reveal timing implicitly;
- a caller supplies payment or timing to `STAGE_PLAY`;
- stage payment is recomputed after placement;
- stage, payment, and timing use different public transaction budgets;
- runtime treats cached event arrays as private-plan authority;
- unstage/undo emits a mechanical inverse or refund;
- `CARD_UNSTAGED` remains anywhere in active production;
- removing one intent can partially replace or corrupt the prior plan;
- lock commits a different stage trace than fresh deterministic refolding;
- replay includes private planning edits.
