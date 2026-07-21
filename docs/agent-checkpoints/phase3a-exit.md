# Phase 3a Exit — Atomic Presentation Director

Status: complete and exit-proven

Date: 2026-07-20

## Outcome

The runtime commits an entire turn before notifying presentation. The client
receives one immutable `SeatTransactionTimeline` block containing every ordered
frame and its final projected state. It does not receive a stream of frames
while the engine is resolving.

`PlayUiProvider` locks interaction synchronously when that complete block is
enqueued. `PresentationDirector` is the sole owner of local frame iteration,
animation waits, fast-forward, cancellation, failure snap, and final cursor
settlement. A second committed block waits FIFO behind the active block, and
the interaction lock remains raised across the queue with no unlock gap.

The production transport contract is `SEAT_COMMITTED_TRANSACTION`: one packet
with ordered `events[]` and mandatory `postState`. A missing post-state,
isolated frame payload, or out-of-order frame list is rejected. The retained
`FRAMED_EVENT` schema validates canonical replay payloads only; no runtime or
client subscription publishes individual frames.

## Security Boundary

- Private staging publishes no transaction and creates no replay step.
- An enemy staged card exposes only an opaque token, owner, lane, and facedown
  state. Its definition identity is absent until the committed reveal event.
- Once a turn is committed, its complete projected presentation block may
  contain identities that become visible later in that presentation. This is
  intentional: the server/runtime decision is already irreversible and the
  client is interaction-locked for the complete presentation.
- The UI lock is not an anti-cheat boundary against a modified client. Runtime
  authority, ownership, revision, phase, and legality checks remain the
  security boundary for accepted gameplay commands.

## Removed Superseded Paths

- The generic presentation script runner and its actions/flows were removed.
- The alternate committed-timeline planner was removed.
- `PlayBoard` no longer iterates or partially applies committed events.
- The animator no longer receives runtime dispatch or command capability.
- There is no frame-stream subscription API or compatibility adapter.

## Proof

- Exhaustive choreography classifies all 56 stabilized projected event names;
  unknown events fail closed.
- H1-H7 cover complete-block FIFO/no lock gap, failure and timeout snap,
  idempotent fast-forward, stale completion, disposal/remount, deferred work,
  and runtime/AI progress independent of presentation speed.
- `P-INTERLEAVE` generates 1–12 frame transactions and injects animation
  failure, cancellation, and fast-forward at varied points. At CI depth, 200
  cases across four modes produce 800 green runs. Every run settles to the
  committed final projection, stale hooks cannot rewrite the cursor, and the
  authoritative state plus transaction/log fixture is byte-identical to the
  no-presentation baseline.
- Browser proof observed an identity-redacted facedown enemy staged card,
  followed by its later reveal, while the game advanced normally.

## Validation

- Focused presentation/provider/runtime suites: green.
- Phase 0 deterministic gate: 86 tests green.
- Phase 1.5 deterministic/content gate: 281 tests green.
- TypeScript and Rust protocol validation: green.
- Card and location generation/validation: green.
- Production build and touched-scope ESLint: green.
- `git diff --check`: green.

Phase 3b is the next active phase.
