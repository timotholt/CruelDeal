# Phase 1.5 C5A-6 — Governed Match Lifecycle

Status: implemented and exit-proven

Date: 2026-07-20

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5A-6 is complete. One system-only match-lifecycle operation is the exclusive
producer of setup completion, resolution start, turn end/start, and match end.
Callers submit present-tense commands; they cannot inject turns, priority
results, or terminal score objects.

## Canonical Contract

The governed command vocabulary is:

- `COMPLETE_SETUP`
- `BEGIN_RESOLUTION`
- `END_TURN`
- `START_TURN`
- `END_MATCH`

The operation derives boundary payloads from private candidate state and emits
only:

- `MATCH_SETUP_COMPLETED`
- `TURN_RESOLUTION_STARTED`
- `TURN_ENDED`
- `TURN_STARTED`
- `MATCH_ENDED`

Each committed boundary captures prior/result phase, turn, priority, staged
play state, tracked-variable snapshots, and terminal result in its semantic
envelope.

## Corrected Ordering

- Location setup leaves the match in `SETUP`.
- The engine-owned opening transaction performs opening-hand draws, the first
  location reveal and reactions, turn-one draws, then commits
  `MATCH_SETUP_COMPLETED` as its terminal event.
- On the final turn, ordinary turn-end work and every due delayed reveal
  complete before `TURN_ENDED`.
- `END_MATCH { reason: "FINAL_SCORE" }` computes the settled result inside the
  owning operation.
- Concession supplies only the conceding owner and closes the active turn
  through `RESOLVING -> BETWEEN_TURNS -> ENDED`.

## Clean Cutover

- `resolve.ts`, `locationSetup.ts`, and `opening.ts` construct no lifecycle
  events and do not call the reducer.
- The opening builder moved from runtime ownership to the engine; no adapter or
  compatibility export remains.
- The old setup-complete-before-opening behavior was deleted.
- Mutation inventory and permanent architecture fences name exactly one
  lifecycle event-construction surface.

## Exit Evidence

- [x] C5A-6 lifecycle and rollback matrix: 8/8
- [x] affected runtime/UI and architecture suites: 45/45
- [x] Phase 1.5 permanent gate: 31 files, 266/266
- [x] Phase 0 generated-match gate: 12 files, 83/83 at 200 cases per property
- [x] TypeScript protocol conformance: 30/30
- [x] Rust protocol conformance: 2/2
- [x] protocol schema freshness
- [x] card generator freshness and 130 active cards validated
- [x] location generator freshness and 38 locations validated
- [x] production build
- [x] targeted lint and diff checks
- [x] live/replay reconciliation remains green

The permanent Phase 1.5 test command now includes the C5A-6 architecture fence.

## Next Slice

C5B deletes superseded evaluator/control paths. C5C then promotes the complete
architecture fence set to the permanent Phase 1.5 exit gate.
