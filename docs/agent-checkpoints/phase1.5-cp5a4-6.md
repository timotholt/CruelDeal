# Phase 1.5 C5A-4 through C5A-6 — Remaining Lifecycle Governance

Status: C5A-4 implemented and exit-proven; C5A-5 ready to build

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Why These Checkpoints Exist

C5A-3 closed metadata, pending work, and transformation, but the mutation
inventory still exposes three ungoverned domains:

1. location cards and lane topology;
2. staged-play placement and reveal timing;
3. setup, turn, and match boundaries.

C5B deletion is blocked until each domain has one owning operation and all old
producer paths are removed. No compatibility wrappers, event aliases, dual
schemas, or fallback reads are permitted.

## C5A-4 — Governed Location Cards and Lane Topology

### Exit evidence

- One canonical `GameCommand` queue and one shared transaction budget now own
  location reveal, authored effects, nested card/location reactions, and lane
  topology.
- The old location lifecycle façade and generic location/lane mutation APIs
  are deleted; source fences restrict event production to owning operations.
- All registered builtins lower onto the canonical queue. Continuation-sensitive
  effects use typed internal work rather than nested transactions.
- Reducer and protocol ingress strictly validate every governed location/lane
  event, including non-empty cause and stable identity fields.
- Phase 1.5: 236/236 tests passed.
- Phase 0: 82/82 tests passed with 1,000 generated matches per property run.
- TypeScript and Rust protocol conformance, schema freshness, manifest
  validation, build, lint, and diff checks passed.

### C5A-4a — Location-Card Lifecycle

- Replace generic placeholder location commands with explicit commands.
- Make one operation the sole producer of every location-card/deck lifecycle
  event.
- Require cause on setup location events.
- Target reveal schedules by both lane slot and stable location identity.
- Preserve atomic replacement, simultaneous swap, and Ruin-only destruction.

### C5A-4b — Reveal Reactions and Topology

- Resolve location reveal and its snapshotted On-Reveal work in one private
  transaction and shared budget.
- Replace generic lane commands with explicit create/destroy/destroy-other
  commands.
- Compose occupant destruction, reaction work, location removal, exact pending
  cancellation, and lane finalization atomically.
- Allocate lane IDs only from private candidate state.

### C5A-4c — Clean Cutover

- Migrate setup, evaluator, opening, and turn-flow callers.
- Delete the old location mutation façade and public wrappers.
- Update protocol, replay, projection, presentation, tests, and source fences.
- Prove setup/replay/RNG parity and the complete adversarial matrix in the
  governing specification.

## C5A-5 — Governed Staged Play and Reveal Timing

- Add `STAGE_PLAY` and `SET_CARD_REVEAL_TIMING`.
- The kernel computes payment and owns the exact
  `CARD_STAGED -> ENERGY_CHANGED -> CARD_REVEAL_SCHEDULED` trace.
- Remove implicit timing mutation from `CARD_STAGED`.
- Delete `CARD_UNSTAGED` completely; unstage and undo remain private plan
  refolds.
- Prove payment, timing, play-policy, rollback, replay, and runtime parity.

## C5A-6 — Governed Match Lifecycle

- Add one system-only operation for setup completion, resolution start, turn
  end/start, and match end.
- Compute terminal results inside the operation.
- Complete setup only after opening.
- Resolve delayed final-turn reveals before `TURN_ENDED`.
- Enforce the strict phase graph and exact turn progression.
- Prove terminal, timeline, replay, reconciliation, and rollback behavior.

## Fixed Build Order

1. C5A-4a
2. C5A-4b
3. C5A-4c
4. C5A-5
5. C5A-6
6. C5B evaluator-bridge and superseded-path deletion
7. C5C permanent architecture gates

Independent compatibility residue may be deleted in parallel only when it
does not touch lifecycle command/event contracts or the files owned by the
active checkpoint.

## Stop Conditions

Stop and redesign before merging if any slice:

- leaves direct and governed producers for one event;
- uses lane identity as a substitute for location-card identity;
- manually pairs a location reveal with a second trigger call;
- nests a second independent transaction budget inside lane destruction;
- publishes a partial lane teardown or setup;
- retains `CARD_UNSTAGED` as committed history;
- lets a caller inject Energy payment, lane identity, or final match result;
- introduces compatibility aliases or dual event shapes.
