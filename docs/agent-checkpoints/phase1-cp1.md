# Phase 1 Checkpoint 1 — Runtime Contract Seams

Status: contract-only checkpoint complete. No live authority, engine resolution,
queue, validation, commit, script, context, component, or presentation behavior
was migrated.

## Scope implemented

### `services/playgame/runtime/contracts.ts`

- `MatchBootstrap`, `MatchMode`, `ParticipantController`, participant metadata,
  and immutable per-seat deck snapshots.
- Structural bootstrap-validation contracts:
  `MatchBootstrapValidationIssueCode`, `MatchBootstrapValidationIssue`,
  `ValidatedMatchBootstrap`, and `MatchBootstrapValidationResult`.
  Collection ownership and possession validation are explicitly deferred.
- `MatchRevision`, `CommittedIntentIdentity`, and
  `CommittedTransactionRecord`, including reserved optional pre/post checksum
  fields for the deferred durable adapter.
- `MatchEventFrame` and `MatchTransactionFrames` with JSDoc requiring reducer
  structural sharing, no per-event deep clone or copied canonical log, bounded
  active retention, lazy replay construction, and release on every terminal
  presentation path.
- `RuntimeIntent`, which strips reducer-level `owner` and `intentId` from the
  payload, plus the revisioned `IntentEnvelope` carrying `matchId`, session seat,
  `intentId`, `expectedRevision`, and optional `intentSeq`.
- Discriminated acceptance results for `accepted`, `duplicate`, `stale`, and
  `illegal`, with bounded illegality reason codes.
- `IntentReceiptKey` and `InMemoryIntentReceiptMap` as types only. Receipt
  construction, retention behavior, durable receipts, and watermarks remain
  deferred to their planned checkpoints.

### `services/playgame/runtime/rngNamespaces.ts`

- Versioned top-level namespace ownership for `bootstrap`, `resolution`, `ai`,
  and `cosmetic` RNG use.
- Typed namespace helpers over the existing order-independent `Rng.fork`.
- `forkSemanticRng` for stable transaction/operation identity within an owned
  namespace. No existing engine resolution path was changed.

### `services/playgame/runtime/projection.ts`

- Explicit opaque `ProjectedBootstrap`, `ProjectedState`,
  `ProjectedTransaction`, and `SeatTransactionFrame` types.
- Trusted-local projection/read helpers are visibly named escape hatches and
  are the only implementation in this checkpoint. They pass through canonical
  references without redaction or deep cloning while keeping canonical payloads
  inaccessible through ordinary projected fields.
- Hidden-information redaction, exhaustive event projection, protocol
  serialization, and leak proofs remain deferred as required by the plan.

### `services/playgame/runtime/index.ts`

- Runtime contract barrel only.

## Expected-failing checkpoint-3 inventory

`services/playgame/runtime/__tests__/contracts/checkpoint3-runtime.contract.test.ts`
adds four `test.fails` contracts:

1. Concurrent submissions drain and commit in FIFO order.
2. Legality is checked against authoritative state at dequeue time.
3. A duplicate intent returns its original receipt and does not commit again.
4. Every event index in an accepted transaction is applied exactly once.

The tests describe the checkpoint-3 harness API and dynamically load
`checkpoint3RuntimeHarness.ts`, which is intentionally absent in this
contract-only checkpoint. Checkpoint 3 supplies that adapter around the real
runtime; the assertions then become ordinary green behavioral tests without a
CP1 queue or commit stub becoming a second authority.

## Verification

- `npm run test:playgame:phase0` — exit 0 at `PLAYGAME_PROPERTY_CASES=200`.
- Inventory after this checkpoint: 16 passing behavior/property tests and 9
  expected failures (the existing 5 are unchanged, plus the 4 checkpoint-3
  contracts).
- Focused TypeScript check for all new runtime and contract-test files — pass.
- Focused ESLint check for all new runtime and contract-test files — pass with
  zero warnings.
- `git diff --check` — pass.

## Explicitly unchanged

- `services/playgame/script/`
- `contexts/`
- `components/`
- engine event schemas, reducer behavior, resolution behavior, and RNG call
  sites
- bootstrap validation implementation, bootstrap ownership/freeze, FIFO drain,
  retry-map behavior, transaction commitment, frame construction, AI, opening,
  and simultaneous lock/reveal behavior
