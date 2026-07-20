# Phase 3a — Presentation Director Readiness

Status: ready to implement

Date: 2026-07-20

Next active phase: Phase 3a — Convert the Event Animator to Frames

## Authority and Scope

The governing roadmap is `docs/playgame-runtime-and-ui-refactor-plan.md`,
especially the commit/presentation contract, concurrency model, Phase 3a work
and exit criteria, and verification matrix. The visual turn-resolution contract
is `docs/playgame-endturn-choreography.md`.

`docs/playgame-transactional-rules-kernel-spec.md` remains authoritative for
engine semantics and committed event envelopes. If presentation lacks a
semantic fact, Phase 3a returns that defect to the engine contract. It does not
invent a presentation-only event, infer gameplay meaning from state diffs, or
put policy into choreography.

Phase 3a owns committed-frame iteration, presentation hooks and waits,
generation-safe cursor advancement, animator host dependencies, and exhaustive
choreography disposition. It does not own Phase 3b's opening-storyboard
separation, reveal/advance slicing deletion, or complete retirement of script
context. It does not change gameplay rules, event order, card-transfer
semantics, layout, CSS, or visual design.

## Clean-Cutover Rule

CruelDeal has no backward-compatibility requirement during active development.
Each Phase 3a slice replaces its old owner and migrates all current callers and
tests in the same checkpoint. Do not retain a compatibility director, legacy
iterator, alias hook, fallback frame shape, dual cursor, or dual DOM-anchor
registry. There must be one production iterator and one current-generation
cursor owner at every merge point.

## Current Census

### Already delivered by Phase 2

- `LocalMatchSessionAdapter` publishes projected `SeatTransactionTimeline` and
  `SeatTransactionFrame` values with projected `before` and `after` states.
  Canonical transitions do not cross the provider boundary.
- `MatchSessionProvider` owns projected match/session state and commands;
  `PlayUiProvider` owns presented state and UI sidecars.
- `eventAnimator.ts`, `committedTimeline.ts`, and the script pacing actions
  already consume projected seat frames rather than canonical transitions.
- `deriveCardTransfers`, transfer coverage checks, rectangle capture, governed
  motion sessions, hand reservations, FLIP layout movement, and VFX/SFX
  choreography are existing assets to preserve.
- Provider disposal guards and basic unmount/remount tests exist, but they do
  not constitute the complete director-generation or H1-H7 proof.

### Remaining ownership defects

- No `PresentationDirector` implementation exists. Timeline iteration, frame
  adoption, animation waits, timeout handling, and cleanup currently live in
  `paceTimeline` inside `services/playgame/script/actions.ts`.
- `PlayBoard.tsx` creates and cancels the generic script runner, starts opening
  pacing, and chains an accepted end-turn timeline into `resolveTurnFlow`.
- `PlayUiContext.tsx` exposes `beginTurnPresentation`,
  `presentCommittedFrame`, and `finishTurnPresentation`, but those cursor writes
  carry no presentation generation and have no stale-write rejection.
- `services/playgame/script/runner.ts` uses a mutable `cancelled` boolean rather
  than a current-generation run with an `AbortSignal`.
- `eventAnimator.ts` accepts the broad `PlayScriptCtx`, reads DOM registries and
  presentation services from it, and advances the visible frame through a
  callback currently named `dispatchPresentedFrame`.
- `PlayScriptCtx` still owns `boardEl`, `toastArea`, `cardRefs`, `zoneRefs`,
  `deckEl`, and `motionSurface`; `PlayBoard` assembles those host concerns.
- `describeEventChoreography` has a broad `dispatch-only` default. It does not
  yet prove an explicit animation, structural-only, intentional-no-op, or
  development-failure disposition for every stabilized event/reason pair.
- The general H1-H7 director/cursor interleaving suite and generated
  `P-INTERLEAVE` property are not yet implemented.

## Required Contract

The runtime commits complete transactions without invoking or awaiting
presentation. The projected timeline is then offered to one
`PresentationDirector`. For each accepted run, the director:

1. obtains a new presentation generation and `AbortSignal`;
2. calls `beforeTransaction` with the complete projected frame list;
3. calls `beforeFrame`, adopts `frame.after` through the UI cursor, and awaits
   `afterFrame` for each frame in order;
4. calls `afterTransaction` after the final frame;
5. performs a same-generation, idempotent snap on failure, timeout, abort, or
   queued fast-forward; and
6. releases the active timeline and rejects every stale-generation cursor
   write.

Presentation hooks receive no intent-submission capability. An intent arriving
while presentation lags enters the normal runtime queue, requests fast-forward,
and drains after the visible cursor reaches committed state. Presentation lag
must never reject an otherwise valid intent or change authoritative output.

The presentation host owns DOM anchors, motion surface, sound, VFX, toast, and
geometry services. The animator receives a projected frame plus that narrow
host/sink contract; it does not receive `PlayScriptCtx`, runtime authority, a
canonical state, or a gameplay dispatch function.

## Delivery Slices

### P3A-0 — Characterization and contract fence

- Freeze current opening and end-turn frame order, zero-duration behavior,
  missing-anchor completion, reveal facing, transfers, reservations, and
  location reveal pacing.
- Inventory every stabilized projected event/reason pair and record its desired
  choreography disposition.
- Add architecture contracts for one iterator, projected frames only, no
  gameplay dispatch, no sink submission capability, and host-owned anchors.
- Add the deterministic director/cursor harness used by H1-H7 and
  `P-INTERLEAVE`.

Exit: the harness can present, abort, fast-forward, and remount a synthetic
projected transaction without DOM or runtime mutation.

### P3A-1 — Director and generation lifecycle

- Introduce the single `PresentationDirector` and explicit transaction/frame
  hooks.
- Put generation, abort, same-generation idempotent snap, queued fast-forward,
  timeout/error settlement, and deferred sink actions behind its API.
- Make `PlayUiProvider` the owner of the director and current presented cursor.
- Prove stale completion, error-snap, and old-provider continuations are no-ops.

Exit: P3/P4/P5/P6 behavior is executable without `PlayBoard` or the script
runner.

### P3A-2 — Production iterator cutover

- Route opening and accepted turn timelines into the director.
- Move timeline iteration, frame adoption, animation waiting, and terminal snap
  out of `paceTimeline` and the generic script runner.
- Preserve presentation-only opening/turn storyboards for Phase 3b, but remove
  their ability to iterate or partially adopt a committed transaction.
- Delete the superseded production iterator and cursor callbacks in the same
  cutover; do not leave a fallback path.

Exit: runtime publishes, the director iterates, and `PlayBoard` only supplies
host wiring and user commands.

### P3A-3 — Animator host cutover

- Introduce the narrow presentation host/sink contract for anchors, geometry,
  motion, reservations, VFX/SFX, toast, and frame adoption hooks.
- Remove `PlayScriptCtx` from `eventAnimator.ts` and move `cardRefs`, `zoneRefs`,
  board/deck/toast elements, and motion services behind the host.
- Preserve `deriveCardTransfers`, coverage assertions, rectangle capture,
  governed motion sessions, hand reservations, FLIP layout animation, and
  best-effort missing-anchor behavior.
- Rename/remove dispatch terminology so frame adoption cannot be confused with
  engine event dispatch.

Exit: animator and choreography modules depend only on projected frames and the
narrow presentation host.

### P3A-4 — Exhaustive choreography and exit proof

- Give every stabilized event/reason pair an explicit animation,
  structural-only, intentional-no-op, or unsupported-in-development
  disposition.
- Select semantic VFX/SFX from committed event type, reason, and cause; use
  state differences only for geometry.
- Prove live and replay select identical choreography for the same projected
  transaction.
- Complete H1-H7, `P-INTERLEAVE`, architecture fences, source deletion, and the
  full validation matrix.

Exit: every BUILD AFTER criterion below is green and no superseded production
path remains.

## Hard Exit Matrix

| Gate | Required proof |
| --- | --- |
| Sole iterator | `PresentationDirector` alone owns frame iteration, hooks, waits, fast-forward, and terminal snap. Runtime only publishes. |
| Read-only animator | Animator has no engine dispatch or submit capability and receives anchors/services only through its host. |
| Frame parity | Zero-duration and missing-anchor runs produce the same gameplay and reveal order as normal presentation. |
| Hook ordering | Transaction choreography uses `beforeTransaction`, per-frame hooks, and `afterTransaction`; there is no lookahead or retained event slicing. |
| Explicit semantics | Every stabilized event/reason pair has an explicit disposition; presentation does not infer play, move, create, return, or power-gain semantics from state diffs. |
| Live/replay parity | The same projected transaction selects the same choreography in live play and replay. |
| H1/H2 | Player/AI overlap, double submission, and dequeue illegality preserve the one runtime FIFO and typed rejection behavior while presentation is slow. |
| H3/H4 | Error-snap and fast-forward races are generation-safe and idempotent. |
| H5 | Reset, disposal, and unmount abort and invalidate the run; remount starts from latest committed projection with no stale cursor write. |
| H6 | Intents queue while presentation lags; cursor lag does not reject them, and sink-triggered commands defer until run settlement. |
| H7 | Runtime/session AI scheduling proceeds independently of presentation speed. |
| `P-INTERLEAVE` | Generated abort points and fast-forward injections produce authoritative state/log identical to the no-presentation run. |
| Transfer preservation | Card-transfer coverage, motion handoff, reservations, facing, and location-reveal ordering remain green. |
| Clean cutover | No legacy iterator, compatibility director, alternate frame schema, dual cursor, or `PlayScriptCtx` DOM-anchor path remains in production. |

The roadmap's old-timeline reference-release assertion is tagged **BUILD LAST**.
It remains required hardening work but is explicitly not a Phase 3a merge gate.
Durable server, transport, and reconnect work remains deferred.

## Validation Commands

Run the focused presentation/provider slice first:

```sh
npx vitest run \
  services/playgame/presentation \
  services/playgame/script \
  contexts/PlayProviders.test.tsx \
  contexts/PlayProviders.architecture.test.ts \
  components/screens/play/playPresentationArchitecture.test.ts
```

Run the authority and deterministic regression gates:

```sh
npm run test:playgame:phase0
npm run test:playgame:phase15
npm run protocol:schema:check
npm run protocol:test:ts
npm run protocol:test:rust
```

Run content and repository gates:

```sh
npm run cards:generate:check
npm run cards:validate
npm run locations:generate:check
npm run locations:validate
npm run build
npm run lint
git diff --check
```

The new director suite must run H1-H7 and `P-INTERLEAVE` at the configured CI
property depth. Existing unrelated lint failures may be recorded, but Phase 3a
must add no warning and may not weaken a gate. The roadmap's browser matrix is
tagged **BUILD LAST** and is not promoted to a Phase 3a merge gate here.

## Stop Conditions

Stop and redesign rather than layering a patch if:

- a second iterator or cursor exists during or after a merge;
- runtime commitment awaits a presentation hook;
- animator/choreography receives canonical frames or runtime commands;
- a hook can synchronously submit an intent;
- stale generations can advance or snap current presentation;
- an intent is rejected because the visible cursor lags;
- presentation invents semantic fields or infers gameplay meaning from state
  differences;
- opening-script authority or Phase 3b slicing work is mixed into this phase;
- transfer/facing/order behavior is recalibrated instead of preserved; or
- a compatibility facade, alias, fallback, or dual-write path is proposed.
