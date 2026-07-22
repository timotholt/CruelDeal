# Effect-Resolution Timeline and Player Wire Implementation Checkpoint

Status: complete  
Started: 2026-07-21  
Governing spec:
`docs/playgame-effect-resolution-timeline-and-wire-spec.md`

## Objective

Implement one canonical frame timeline that records both mechanical events and
effect-resolution truth, then project it through explicit default-deny seat
frames delivered as atomic presentation blocks.

## Repository policy

- No backward compatibility.
- Replace superseded types and call sites cleanly.
- Do not preserve dual canonical histories or protocol adapters.
- Preserve all existing animation choreography.

## Resume instructions

1. Read the governing spec completely.
2. Read this checkpoint.
3. Inspect `git status --short`; preserve unrelated user work.
4. Resume the first unchecked slice below.
5. Update this file after every proven slice.
6. Run the narrow gate listed for the slice before moving forward.

## Known unrelated work to preserve

At start, the working tree also contained untracked work outside this
migration, including:

- `components/game-surfaces/`
- `docs/card-location-raster-surface-spec.md`

Do not edit, stage, delete, or otherwise absorb those paths into this phase.

## Implementation slices

- [x] Slice 0: characterization fixtures and architecture fences
- [x] Slice 1: deterministic kernel resolution transcript
- [x] Slice 2: `CanonicalFrame` clean cutover
- [x] Slice 3: authority/player protocol split and seat projection
- [x] Slice 4: public/private revisions, receipts, and resync
- [x] Slice 5: MatchClient and presentation-block cutover
- [x] Slice 6: replay UI, authority matrix, Rust parity, and full gates

## Proven Slice 0–1 implementation

- The generic kernel now returns one ordered, success-only resolution
  transcript beside its committed transitions.
- Invocation and attempt ordinals are deterministic and frame-free.
- Parent/child invocation nesting and completion checksums are kernel-owned.
- Authored effect boundaries snapshot ordered candidate entity references.
- Governed Power, destroy, and move policy paths report typed target outcomes.
- Destroy and move restrictions return their actual blocker provenance rather
  than lossy booleans.
- The test-only authored-effect seam now uses the same `AUTHORED` invocation
  boundary as production.
- Concrete tests prove mixed affected/blocked destruction, real blocker
  identity, Courthouse Power blocking, zero-candidate invocations, and generic
  nested resolution.

The shared fix belongs in the kernel work loop and operation planners:

- the kernel allocates deterministic invocation/attempt ordinals;
- effect expansion reports source/ability/candidate snapshot;
- governed command planning reports typed outcome metadata;
- successful outcome metadata is paired with its `COMMIT` work;
- state-preserving outcomes remain in the ordered transcript;
- runtime frames the successful transcript exactly once after atomic kernel
  completion.

## Proven Slice 2 implementation

- `FramedEvent` and `framedEvents` are removed from active TypeScript,
  generated schemas, schema source, and conformance fixtures.
- `CanonicalFrame` carries exactly one mechanical fact, one semantic trace
  fact, or an affected target plus its mechanical fact.
- Trace-only frames advance the authoritative timeline without mutating any
  other mechanical state.
- Kernel invocation ordinals are promoted to deterministic
  transaction-scoped invocation and attempt IDs at the framing boundary.
- Combined kernel batches rebase their local invocation ordinals before one
  transaction is framed, preventing identity collisions without moving frame
  authority into the kernel.
- Resolution steps survive setup, opening, live intent resolution, RNG
  bookkeeping, CLI matches, runtime commits, export, and replay folding.
- The protocol schema rejects empty frames, affected outcomes without events,
  and state-preserving outcomes paired with events.

## Proven Slice 3 implementation

- Authority records and player delivery now have separate v2 schema roots,
  validators, generated artifacts, and cross-language fixtures.
- The player-wire schema is independently authored and cannot import or accept
  canonical frames, canonical identifiers, bootstrap internals, or RNG state.
- Canonical effect entities, abilities, invocation identities, attempts,
  animation events, and visible state are projected field-by-field through an
  explicit seat allowlist.
- Hidden entities and abilities remain semantically represented without
  leaking their canonical identity; observable objects use seat-scoped opaque
  tokens that differ between P0 and P1.
- Every retained player frame carries an authoritative seat-visible after-state
  and each atomic block carries validated pre/post states plus a deterministic
  post-state checksum.
- Client-side block adoption rejects match/seat mismatches, revision gaps,
  invalid frame order, pre-state drift, checksum mismatch, and incomplete
  visible-state chains.
- The superseded v1 schema, fixture, player transaction DTO, projector, and
  client applier are deleted rather than retained as adapters.
- TypeScript and Rust validate the same authority-v2 and player-wire-v2 golden
  fixture suites.

## Last proven state

- `npm run test:engine:regression` passes in 2m 30s.
  - Log: `.test-logs/engine/engine-regression-2026-07-22T00-17-53-824Z.log`
  - Stable link: `.test-logs/engine/latest.log`
- `npm run typecheck:playgame` passes.
- Focused Slice 5 client/provider/presentation tests pass: 10 files, 90 tests.
- Expanded authority/replay gate passes: 10 files, 95 tests.
- TypeScript protocol tests pass: 2 files, 32 tests.
- Rust protocol tests pass: 2 tests.
- Focused Slice 4 runtime/protocol/adapter tests pass: 73 tests.
- `npm run protocol:schema:check` passes.
- `npm run test:engine:kernel` passes: 34 files, 284 tests.
- `npm run test:playgame:phase0` passes with 200 generated cases per property.
- Focused canonical timeline/runtime/replay tests pass: 65 tests.
- Focused protocol/projection tests pass: 38 tests.
- Focused effect-resolution and Courthouse tests pass: 12 tests.
- Rust protocol schema and shared-fixture tests pass: 2 tests.
- The transcript remains ephemeral and is discarded on failed transactions.

## Proven Slice 4 implementation

- Public match revision and per-seat private plan revisions are separate.
- Private stage, unstage, undo, and lock-state changes advance only the acting
  seat's plan revision.
- Public commits advance only `publicRevision` and reset both plan domains
  after locked plans resolve.
- Runtime receipts distinguish accepted private edits, accepted waiting locks,
  accepted public commits, exact duplicates, illegal commands, stale public
  revision, and stale private plan revision.
- Player command envelopes are v2 player-wire payloads containing only opaque
  seat tokens, public lane values, public revision, and that seat's plan
  revision. The command never supplies or overrides the authenticated seat.
- The local adapter validates the player-wire command envelope before resolving
  opaque tokens to canonical card IDs inside the authority boundary.
- Seat snapshots are v2 and carry public revision, viewer plan revision, frame,
  interaction status, and seat-visible state.
- Player-wire v2 now includes command envelopes, block acknowledgements, resync
  requests, and resync responses. TypeScript and Rust validate the same shared
  fixture cases.
- The local adapter retains at most one complete unacknowledged presentation
  block for the viewer. Resync redelivers that whole block only when the client
  is exactly at the block base revision; ACK clears it; otherwise resync returns
  a fresh snapshot.

## Next concrete action

The effect-resolution timeline and player-wire implementation checkpoint is
complete. Next work should start from the next architecture checkpoint/spec,
not by reopening this migration.

## Proven Slice 5 implementation

- `MatchClient` now exposes `SeatPresentationBlock` delivery through
  `subscribePresentationBlocks`; the player-facing client contract no longer
  exposes committed transaction timelines.
- Match initialization carries the opening as one complete presentation block.
- The local adapter projects, retains, redelivers, and ACKs the same complete
  block shape.
- The serialized-loopback authority test client crosses the JSON boundary with
  blocks, preventing tests from depending on local-only transaction timelines.
- `PlayUiContext` queues presentation blocks, converts each block to the
  existing animation timeline at the director boundary, and ACKs after
  playback/snap handling.
- Existing card movement/flip choreography remains isolated in the presentation
  director and sinks; this slice changes transport and queue shape only.
- `MatchSessionContext` applies contiguous blocks strictly and has a bounded
  setup/opening visual-lag adoption path when authority has advanced beyond
  the visual setup cursor.

## Proven Slice 6 implementation

- Developer replay steps now carry the canonical `EffectTraceEntry`, a typed
  effect summary, and annotated effect JSON behind the authorized debug
  capability.
- The replay drawer renders effect summaries and raw effect JSON alongside
  mechanical event summaries/JSON.
- Effect summaries resolve canonical card, location, lane, player, zone, and
  system references through the same replay name resolver used by mechanical
  events.
- Replay presentation tests prove invocation-start, target-resolution
  affected/blocked style copy, blocker name resolution, and invocation
  completion summaries.
- The registered authority gate now includes match-client contract,
  authority architecture, live opening, local adapter, opening authority,
  replay presentation, PlayUi architecture, provider, and interleaving suites.
- The durable engine regression map documents replay effect presentation and
  atomic block-delivery coverage.
- TypeScript protocol, Rust protocol, content drift, manifest validation,
  engine typechecking, kernel, runtime properties, and authority matrix all
  pass through `npm run test:engine:regression`.
