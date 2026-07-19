# Phase 1.5 Checkpoint 4A — Transactional Kernel Foundation

Status: complete  
Date: 2026-07-19  
Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Result

C4A is implemented and exit-proven.

Permanent stored Power is the first production mutation governed by the
transactional rules kernel. The old operation and public Power mutation
wrappers are deleted; there is one command, one event-producing operation, and
one private candidate-fold seam.

The next implementation slice is C4B: destroy and banish.

## Kernel Foundation

`services/playgame/engine/kernel/` now owns:

- the closed `GameCommand` and `KernelWork` unions;
- a private depth-first work deque;
- deterministic reaction ordering;
- immutable committed transitions and reaction invocations;
- finite work, event, reaction, effect-depth, and entity budgets;
- typed `KernelFailure` results and `KernelInvariantError`;
- all-or-nothing completion with no partial result on failure.

The kernel has no Frame, revision, receipt, replay, wall-clock, or RNG
authority. Those remain outside the rules loop.

## Stored-Power Pilot

All production permanent-Power writers now call:

```text
CHANGE_STORED_POWER
  -> kernel/operations/power.ts
  -> kernel/powerTransaction.ts
  -> CARD_POWER_CHANGED
```

The operation validates and proposes commit work. It never calls the reducer.
The match-specific kernel seam privately folds the event, captures the exact
before/after semantic envelope, and returns only a completed candidate.

The envelope records:

- affected card, owner, zone, and lane;
- prior and resulting stored delta;
- prior and resulting effective projected Power;
- signed stored change and `POWER_GAIN`/`POWER_LOSS` classification;
- immutable cause and reason.

`ADD`, `SET`, and `RESET` all use this path, including evaluator effects,
hand-entry debuffs, bespoke built-ins, and transform stat resets.

## Courthouse Policy

Courthouse remains generic content through `BLOCK_POWER_INCREASE`.

The operation evaluates the prohibition before proposing a commit, using the
same pure projection pipeline as `getCardPower`. The projection covers
individual stored contributions, Ongoing modifiers, Courthouse suppression,
and `SHURI_DOUBLED`.

Denied changes are normal no-ops. They publish no event, add no ledger entry,
and schedule no reaction.

## Removed Alternate Paths

- deleted `engine/operations/power.ts`;
- deleted `setCardPower`, `adjustCardPower`, and `resetCardPower`;
- removed every `resolveCardPower*` production call;
- removed direct Power-ledger writes from `CARD_TRANSFORMED`;
- transform resets now emit `CHANGE_STORED_POWER(RESET)` before the transform;
- architecture fences permit raw `CARD_POWER_CHANGED` construction only in
  `kernel/operations/power.ts`.

The Phase 1.95 `DRAW_ON_POWER_GAIN` content scanner remains deliberately
unchanged in C4A. The C4A contract requires a zero-content queue proof and
forbids unrelated content-specific evaluator cleanup.

## Runtime Failure Atomicity

The second `END_TURN` lock now resolves and validates the complete candidate
before its receipt or lock is accepted.

A kernel/invariant failure:

- rejects with `KernelInvariantError`;
- is never stored as `RULES_INVALID`;
- stores no receipt and consumes no intent ID;
- changes no revision, Frame, canonical state, serialized RNG, or transaction;
- retains the already accepted first lock and both private plans;
- permits the identical second-lock intent to retry.

## Proof

Focused C4A coverage proves:

- nested depth-first work and canonical reaction ordering;
- one test-only smoke reaction scheduled exactly once;
- budget exhaustion exposes no partial transaction;
- ADD/SET/RESET semantic-envelope closure;
- the full Courthouse acceptance/denial matrix;
- pure post-mutation projection parity;
- framed ledger provenance and exact live/replay equality;
- transform reset bypass elimination;
- second-lock runtime atomicity and retry;
- sole mutation ownership and replay/kernel separation;
- no kernel Frame or RNG authority.

Canonical gate:

```bash
npm run verify:playgame:phase15
```

Evidence at close:

- Phase 1.5/kernel suite: 12 files, 64 tests, all green;
- runtime/property suite: 12 files, 80 tests, all green at 200 cases;
- TypeScript protocol suite: 5/5 green;
- Rust protocol suite: 2/2 green;
- schema and generated card/location drift checks: green;
- 128 cards and 38 locations validate;
- production build: green.
