# Phase 1 Checkpoint 3 — Pure Match Runtime

Status: complete. This checkpoint adds the pure, non-DOM `MatchRuntime` and
the shared live/replay transaction fold. It does not wire the runtime into
scripts, contexts, Solid components, or presentation.

## Runtime authority

`services/playgame/runtime/matchRuntime.ts` now provides
`createMatchRuntime(validatedBootstrap)`.

- It constructs canonical mechanical genesis from the validated bootstrap's
  seed and frozen per-seat decks, then commits the symmetric opening draws as
  revision 1 under a `SYSTEM` transaction identity.
- It owns current `MatchState`, the monotonically increasing match revision,
  append-only committed transaction records, and in-memory intent receipts.
- It exposes only read access, revisioned intent submission, committed
  transaction subscription, and replay export. It imports no DOM, Solid, or
  presentation code.
- Replay export contains the validated bootstrap descriptor, canonical
  pre-opening genesis, and the ordered non-overlapping transaction records.

## Queue, acceptance, and receipts

All accepted player-facing work enters one FIFO queue. Submission defensively
copies the envelope and schedules a single microtask drain. The drain is
synchronous and single-writer: no resolver, validation, commit, receipt write,
or subscriber publication is awaited, and only one queue item can resolve or
commit at a time.

Acceptance runs against authoritative dequeue-time state in this order:

1. match-scoped `(matchId, seat, intentId)` duplicate lookup;
2. match identity and seat/embedded-owner authority;
3. exact expected revision;
4. terminal result and phase legality;
5. deterministic engine rules.

The runtime derives the engine intent's `owner` and `intentId` from the
envelope rather than trusting payload fields. Duplicate requests return the
stored original receipt before stale-revision evaluation. New stale requests
include the current revision. Match, seat, terminal, phase, and rules failures
return typed illegal receipts and do not append transactions, frames, or
events. An engine `INTENT_REJECTED` used to report a deterministic rules
failure is converted to a receipt and is not committed to the canonical log.

## Validated commit and shared frames

`services/playgame/engine/transactionFrames.ts` is the promoted canonical
fold. Runtime commitment, engine replay, and the engine testkit now use this
one reducer/frame implementation. Each frame retains structurally shared
`before`/`after` states; there are no state deep clones.

Before authority changes, the local commit boundary builds the whole candidate
timeline and verifies:

- a non-empty, zero-based contiguous frame/event sequence;
- exact one-entry canonical-log growth for every event;
- unchanged match seed and chained before/after references;
- a final state equal to the last frame;
- no silent no-op for authoritative mutation events.

Only after those checks pass does one non-yielding block update state,
transaction records, revision, and the accepted receipt. Subscribers are
called afterward and therefore see the complete committed timeline and final
authority. Subscriber failure cannot roll back the match or halt the queue.

## Event vocabulary

- Added `TURN_RESOLUTION_STARTED { turn }`. `resolve(END_TURN)` emits it first,
  and the reducer validates the turn and sets `phase: 'RESOLVING'`.
- Added `newDefId` to `LOCATION_REPLACED`. The evaluator emits it and the
  reducer uses it after validating `oldId`, so replay no longer creates a
  replacement with an empty definition ID.
- Reducer and resolver vocabulary tests cover both schema changes.

## Contract and interleaving coverage

The four checkpoint-1 `test.fails` contracts are ordinary passing tests now:

1. concurrent submissions commit in FIFO order;
2. H2 queues a request that is legal at submission and becomes rules-illegal
   against the state produced by the earlier queued transaction;
3. H1 concurrent double-submit returns one accepted receipt and one duplicate
   with one commit;
4. committed transaction event indices are observed and logged exactly once.

Additional runtime tests cover symmetric opening ownership, atomic subscriber
visibility, structural sharing, match mismatch, seat spoofing, stale revision,
rules rejection, terminal rejection, rejection-log purity, rejected-receipt
retry, malformed-work queue recovery, resolution-start phase frames, and
replay refolding to current state.

## Verification

- `npm run test:playgame:phase0` — pass with 200 generated cases per property.
- `npx vitest run services/playgame/runtime` — pass: 8 files, 38 passing tests,
  and 5 still-legitimate expected failures reserved for checkpoint 4 live
  wiring.
- `npx tsx services/playgame/engine/apply.test.ts` — pass.
- `npx tsx services/playgame/engine/resolve.test.ts` — pass.
- `npx tsx services/playgame/engine/replay.test.ts` — pass.
- `npx tsx services/playgame/engine/effects/evaluator.test.ts` — pass.
- Focused ESLint over every changed engine/runtime TypeScript file — pass with
  zero warnings.
- `git diff --check` — pass.

## Explicitly unchanged

- `services/playgame/script/`
- `contexts/`
- `components/`
- live AI, simultaneous per-seat lock scheduling, provider/session adapters,
  and presentation cursor/director wiring; these remain checkpoint 4 or later.
