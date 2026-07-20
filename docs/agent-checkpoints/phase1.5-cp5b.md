# Phase 1.5 C5B — Delete Superseded Control Paths

Status: implemented and exit-proven

Date: 2026-07-20

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5B is complete. Simulation now has one mutation route:

`present-tense command -> rules transaction -> owning operation -> event ->
private candidate fold -> reaction discovery`

The legacy evaluator, imperative builtin registry, manual reveal/trigger
helpers, per-domain transaction executors, injected mini-interpreters, and
their direct reducer calls have been deleted.

## Canonical Surface

- `effects/rulesInterpreter.ts` lowers authored rules onto the canonical work
  queue.
- `effects/builtinCommandPlanner.ts` is a pure command planner.
- `kernel/rulesTransaction.ts` owns the only simulation-side call to `apply`.
- Domain transaction modules retain only semantic capture and deterministic
  reaction collection used by the shared queue.
- Test-only authored-effect seeding lives under `engine/testkit` and enters the
  same canonical work loop.

## Clean Cutover

- No compatibility aliases, adapters, fallback reads, or dual executors remain.
- `effects/evaluator.ts` and `effects/builtins.ts` no longer exist.
- Old `evalEffect`, `revealPlayedCard`, `triggerOnReveal`, domain command
  wrappers, and standalone `resolve*Transaction` APIs no longer exist.
- Obsolete characterization tests now assert canonical reveal, pending-effect,
  provenance, and rollback behavior.
- A permanent source fence fails if any deleted file/API or kernel-side direct
  reducer call returns.

## Exit Evidence

- [x] Phase 1.5 gate: 32 files, 270/270 tests
- [x] focused canonical interpreter regression suite
- [x] Phase 0 generated runtime gate: 12 files, 83/83 at 200 cases per property
- [x] Phase 1.5 lint gate
- [x] production build
- [x] architecture fence for deleted control paths
- [x] one simulation-side reducer client

## Next Slice

C5C promotes the complete architecture-law set to permanent gates: mutation
event ownership, reducer allowlists, reaction-dispatch ownership, content
import boundaries, presentation isolation, scoped randomness, and semantic
envelope closure.
