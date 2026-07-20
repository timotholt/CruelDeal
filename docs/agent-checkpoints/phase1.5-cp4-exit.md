# Phase 1.5 Checkpoint 4 — Exit Evidence

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

Checkpoint 4 is complete. C5A may begin.

The kernel now governs the complete C4 scope:

- stored permanent Power and Courthouse policy;
- destroy and banish;
- move, enter, leave, create, return, and existing-instance deployment;
- play, reveal, nested On Reveal, played-here, turn, and location reactions.

Every migrated family has a canonical command/operation route, committed
semantic envelope, immutable reaction discovery, deterministic ordering, and a
bounded private transaction. Replay folds committed results and never
redispatches reactions.

## Exit Checklist

- [x] Every C4 lifecycle family uses committed semantic envelopes.
- [x] No active manual location/play/reveal lifecycle trigger remains.
- [x] Private stage/unstage/undo dispatch no gameplay reactions.
- [x] Create, return, move, deployment, reveal, and hand play are distinct.
- [x] Generic effects and built-ins use governed lifecycle routes.
- [x] Production token built-ins reveal through the parent queue.
- [x] Nested On Reveal is depth-first and lane-capacity safe.
- [x] Original rule-source snapshots survive nested source removal/replacement.
- [x] Budget failure publishes no partial transaction.
- [x] Replay/snapshot parity and deterministic RNG tests pass.
- [x] Active location content conforms to exact lifecycle hook meanings.
- [x] No compatibility event aliases, fallback reads, or dual-write paths are
  active.

## Remaining Manual Surfaces

The mutation-boundary fence intentionally still reports only C5A-owned work:

- draw/hand-entry debuffs;
- discard-card reaction dispatch;
- power-gain draw polling;
- cost, energy, tag, counter, text, pending-effect, transform, turn/match, and
  remaining location/lane mutation families.

These are not alternate C4 lifecycle producers. They are the explicit input to
C5A and are kept visible by the characterization inventory.

## Gates at Close

- Phase 1.5/kernel: 14 files, 87 tests green;
- Phase 0 runtime/property: 12 files, 80 tests green at 200 property cases;
- legacy executable engine suites: AI, apply, content effects, location
  primitives, replay, and resolve green;
- active cards: 128 validated;
- active locations: 38 validated;
- generated card/location modules current;
- TypeScript protocol: 5 tests green;
- Rust protocol: 2 tests green;
- protocol schema current;
- production Vite build green;
- Phase 1.5 lint green.

The final verification command remains:

```bash
npm run verify:playgame:phase15
```

## Next

C5A governs the remaining mutation families listed in the specification.
C5B then deletes the superseded evaluator/control paths. No backward
compatibility layer is required or permitted.
