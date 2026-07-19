# Phase 1.2 Checkpoint 4 — Governed Location Lifecycle

Status: complete in the current worktree.

## Outcome

Location and lane lifecycle changes now enter canonical state through
`locationLifecycle.ts`. Callers request an operation; the operation validates
the complete transition, returns an atomic event sequence, and folds that
sequence through the reducer. A rejected operation returns the exact input
state and no events.

The governed surface covers:

- slot reveal scheduling and cancellation;
- reveal, turn-face-down, and private seat disclosure;
- location movement and simultaneous swaps;
- atomic replacement with an explicit reveal policy;
- removal to discard, destroyed, or banished zones;
- deterministic return from an eligible zone to the location deck;
- location-card destruction as atomic revealed-Ruin replacement;
- lane creation, one-lane destruction, and destroy-all-other-lanes.

## Reveal authority

Reveal timing belongs to a lane's location slot. Turn-start resolution scans
the current active topology and reveals every face-down slot scheduled for the
current turn in topology order. It never derives a lane identity from
`turn - 1`, so lane creation, destruction, and reordering cannot redirect a
scheduled reveal.

Face state, reveal schedule, and seat knowledge remain independent:

- turning a card face down does not erase knowledge;
- private disclosure does not reveal the card mechanically;
- a public reveal grants both seats knowledge, increments `revealCount`, and
  clears the slot schedule;
- a later public re-reveal increments `revealCount` again.

## Replacement and conservation

`LOCATION_REPLACED` is one atomic event. Its policy is one of:

- `KEEP_SLOT_SCHEDULE`;
- `REVEAL_IMMEDIATELY`;
- `FACE_DOWN_UNSCHEDULED`;
- `SCHEDULE_AT_TURN`.

The outgoing instance is conserved in its declared destination before the new
instance occupies the same slot. Destroying a location delegates to this
operation with a revealed inert `Ruin`; there is no observable empty slot.

Lane destruction first enters `DESTROYING`, destroys occupants through normal
card rules, explicitly removes the location instance, and only then emits
`LANE_DESTROYED`. If any occupant survives, the entire operation rejects.
Destroyed lanes remain replay-addressable tombstones and are excluded from
targeting and scoring.

## Replay and projection

All new lifecycle facts are canonical `MatchEvent`s and therefore receive the
normal Phase 1.1 frame envelope. Replaying the returned event sequence from
the same input reconstructs the operation state exactly.

Seat projection exposes a face-down identity only when
`identityKnownTo` contains that seat. Private disclosure tests prove that one
seat can know a location while the other receives a redacted definition.

## Phase 1.5 seam

Phase 1.2 governs mutation production; it does not install the Phase 1.5
reaction dispatcher. The current reveal call sites still dispatch authored
location `onReveal` expressions after the governed reveal commits. Replay
folds the recorded mutation and reaction events and never reruns those
effects. Phase 1.5 will replace the manual dispatch seam with the centralized
reaction system without changing the lifecycle event vocabulary.

## Proof

- focused lifecycle/setup/state/replay/timeline Vitest gate: 92/92;
- lifecycle matrix: 40/40;
- standalone reducer gate: green;
- Phase 0 runtime/property gate: 71/71 with 200 generated cases;
- TypeScript protocol validation: 4/4;
- Rust protocol conformance: 2/2;
- protocol schema artifact: current;
- production Vite build: green;
- changed engine/runtime/protocol surface: no new TypeScript errors;
- `git diff --check`: green.

## Exit decision

Every Checkpoint 4 exit criterion is met. Checkpoint 5 can remove the fallback
location-selection and mutation paths and install permanent architecture
fences.
