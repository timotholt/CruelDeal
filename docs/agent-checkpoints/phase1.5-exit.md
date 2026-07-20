# Phase 1.5 — Final Exit Evidence

Status: implemented and exit-proven

Date: 2026-07-20

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

Phase 1.5 is complete. Gameplay content now enters one deterministic
transactional rules kernel; no active evaluator, manual trigger, direct
effect-mutation, or pool-based simulation route remains.

Phase 2 may consume the stabilized engine contract. It must not reopen engine
authority or add provider-side rule execution.

## Contract Matrix

| Exit contract | Permanent evidence |
| --- | --- |
| Ordinary cards and locations are authored locally | Every active definition folder contains its canonical JSON source and is imported by its generated set module. Generator drift and validators run in the aggregate verifier. |
| Active content compiles to immutable rules | Card/location validation covers all active definitions; content imports are fenced away from engine capabilities. |
| Effect mutations use governed operations | Event-constructor ownership and reducer-call allowlists cover every canonical event variant. |
| Transitions retain historical semantics | Semantic-envelope routing is exhaustive and capture occurs from each event's before/event/after transition before reaction discovery. |
| Reactions are discovered once from an event-local snapshot | The kernel owns the sole reaction-collector call sites; lifecycle and nested-reaction golden tests prove ordering and exactly-once behavior. |
| No dependency graph or mutable subscriptions | AST gates reject registration/subscription calls in the kernel and effect planner. |
| Reducers and replay are policy-blind | The reducer cannot import kernel/effect policy; replay folds framed facts without dispatching reactions. |
| Projections remain mutation-free | Projection imports and calls are fenced from reducers, kernel transactions, and the rules interpreter; event ownership prevents projection event construction. |
| Exceptional built-ins have restricted capabilities | The built-in planner has an explicit query/data/command-type import allowlist and cannot call mutation executors. |
| Terminal reconciliation succeeds | Runtime tests reconcile terminal live state against genesis plus committed transactions, including generated matches and rollback on reconciliation failure. |
| No legacy or parallel route remains | The evaluator, imperative built-ins, manual trigger APIs, per-domain executors, and definition-pool AI planner are deleted and fenced from returning. |

## Final Verification

- [x] Phase 1.5 suite: 33 files, 281/281 tests
- [x] Phase 0 runtime/generated-match suite: 12 files, 83/83 tests at 200
  generated cases per property
- [x] scoped Phase 1.5 lint
- [x] protocol schema drift check
- [x] TypeScript protocol conformance: 30/30
- [x] Rust protocol conformance: 2/2
- [x] card generated-module drift check and 130 active definitions validated
- [x] location generated-module drift check and 38 definitions validated
- [x] production build
- [x] canonical hand-based AI smoke test

The repository-wide lint command still includes known unrelated legacy and
worktree failures. Phase 1.5's owned lint gate and all changed files are clean.

## Next Phase

Begin Phase 2 with a contract census of the existing Solid providers and their
consumers. Replace the provider contract in one cutover: `MatchSessionProvider`
owns projected match/session data, `PlayUiProvider` owns presentation-only
state, and neither receives kernel mutation capabilities.
