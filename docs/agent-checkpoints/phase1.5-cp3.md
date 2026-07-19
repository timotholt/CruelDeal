# Phase 1.5 Checkpoint 3 — Governed Power and Courthouse

Status: complete.

## Scope

Permanent card-power changes now enter one governed operation:

```text
services/playgame/engine/kernel/operations/power.ts
```

`ADD_POWER`, `SET_POWER`, `RESET_POWER`, hand-entry debuffs, and every current
power-changing built-in use that operation. The superseded
`effects/power-change.ts` helper is deleted, and the mutation-construction
inventory permits `CARD_POWER_CHANGED` only in the governed operation.

## Authoritative representation

`CardInstance.powerLedger` is the sole stored source of permanent power
history. There is no parallel `powerDelta` scalar or presentation-only power
log.

Each append-only entry contains:

- a unique contribution ID
- canonical `Frame`
- containing turn
- semantic `ADD`, `SET`, or `RESET` mutation
- the canonical effect cause

Folding the ledger determines the active permanent contributions and stored
delta. `SET` and `RESET` replace prior active contributions without deleting
history. Live ongoing `PowerModifierEntry` values remain deliberately separate:
they are recomputed continuous projections and are never authoritative stored
state.

Replay folds the same framed `CARD_POWER_CHANGED` events into the identical
ledger. The power inspector now displays the semantic history with both turn
and frame provenance.

## Courthouse capability

Courthouse is implemented entirely through the reusable
`BLOCK_POWER_INCREASE` policy. No definition-ID branch exists in the reducer,
operation, evaluator, or projection.

The acceptance matrix proves:

- prior hand and board buffs remain stored but are suppressed while present
- moving away restores only contributions that were previously accepted
- a new positive `ADD` or upward `SET` is rejected and not stored
- a downward `SET` and negative `ADD` commit normally
- `RESET` is rejected when it would increase visible power
- positive stored contributions are suppressed individually, so later
  reductions still apply
- positive card and lane ongoing projections are suppressed
- projection and movement never synthesize power-change events
- both player seats follow the identical policy
- live and replay folds retain identical semantic ledgers and canonical frames

## Verification

- focused power, mutation-boundary, runtime, presentation, and debug suites:
  143/143 green
- Phase 0 runtime/property gate with 200 generated cases: 71/71 green
- standalone apply, evaluator, resolver, query, location-primitive, and
  authored-content harnesses: green
- TypeScript protocol tests: 4/4 green
- Rust shared-protocol tests: 2/2 green
- protocol schema drift check: green
- card and location generated-index drift checks: green
- 128 active cards and 38 locations validate
- focused production lint for every migrated runtime/UI source: green
- production build: green

Checkpoint 4A subsequently moved this operation behind the transactional
kernel. See `phase1.5-cp4a-implementation.md`; C4B is the next active slice.
