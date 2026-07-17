# Codex Response — Round 4 — Red-team discussion

## Overall position

The runtime-first direction remains correct, but the plan is not yet safe as a server-facing contract. F1, F2, F4, and F5 need amendments while the runtime boundary is being introduced. F6 belongs primarily in an explicit deferred-risk section, with a determinism guard added now. F7 needs a product/engine-model decision now, although I disagree that the transaction builder must necessarily take an array of intents.

The highest-risk omission is F5. The plan currently says `MatchSessionContext` exposes both seats' frozen deck entries and defines frames with full `MatchState` values. A later network adapter could not make that safe merely by hiding card faces in components.

## F1. Durability: event log as source of truth

**AGREE — amend now, with a more precise canonical record.**

Code evidence:

- `services/playgame/engine/types/state.ts:316-354` embeds `log` inside `MatchState`.
- `services/playgame/engine/apply.ts:35-41` appends every applied event, including diagnostic/no-op events, and `appendLog` at `:644-646` copies the complete log array for each event.
- `services/playgame/engine/replay.ts:45-70` folds a supplied `initialState` and event array, while `exportReplayBundle` at `:73-94` exports both `initialState` and events derived from the current state's embedded log.
- Replay validation checks referenced definitions but does not require `initialState.log` to be empty (`replay.ts:136-147`). A non-genesis initial state can therefore carry an existing log and then have an overlapping event array applied to it.

The canonical durable unit should be:

1. the validated bootstrap and a canonical genesis mechanical state (or enough data to derive it exactly), and
2. an ordered append-only sequence of **committed transaction records**.

Each transaction record needs at least `transactionId`, committed match revision, accepted intent identity/actor, ordered events, and a deterministic post-state checksum. Persisted `MatchState` snapshots are caches at a stated revision. The accepted-intent receipt/dedup record must be committed atomically with the transaction record; it is protocol truth, but state is still reconstructed from the committed event transactions.

The review's proposed recovery test is necessary. It should inject failures before and after the durable append, recover from the last durable revision, fold the log, and assert state checksum, event sequence, and accepted-intent response parity. A snapshot-plus-tail recovery case is also needed once snapshots exist.

The plan should not call both independently persisted state and log authoritative. It should also forbid replay exports whose initial state already contains events represented by the exported tail.

## F2. Intent concurrency and idempotency

**AGREE — amend now, but replace `baseTurn` with an exact committed revision.**

The engine is not starting from zero: every `MatchIntent` already has `intentId`, and its comment explicitly anticipates server dedup (`services/playgame/engine/types/intents.ts:1-16`). What is absent is an acceptance ledger and concurrency contract. Current local IDs are sometimes time-derived (`contexts/PlayGameContext.tsx:213-225`), and nothing records an accepted ID or returns the prior result on retry.

`baseTurn` is too coarse. Several legal staging and undo intents occur in one turn, so two requests can share a turn while observing different authoritative states. The envelope should carry an exact `expectedRevision` (committed transaction/log revision), plus `matchId`, a client-generated `intentId`, and an optional monotonic per-client/per-seat `intentSeq` for gap and reorder detection. The authenticated server/session must derive the seat; it must not trust a client-supplied `owner` as authorization.

The guarantee should be worded as **idempotent acceptance with at-most-once commit**, not an impossible end-to-end exactly-once network delivery claim:

- one single-writer queue/critical section serializes accepted intents per match;
- `(matchId, authenticated actor/seat, intentId)` maps durably to the original accepted or rejected response for the match's lifetime;
- a retry returns that response without resolving or committing again;
- a new intent with a stale `expectedRevision` is rejected with the current revision;
- acceptance, transaction append, resulting revision, and receipt are one atomic durable operation;
- resolution and commitment do not `await`, invoke presentation, or otherwise yield inside the critical section.

There is also a code-backed lifecycle hole: `resolve()` routes `END_TURN` directly to `resolveTurn`, ignores the end-turn intent's owner, and has no general phase or terminal-state check (`services/playgame/engine/resolve.ts:36-48`). UI guards are not a server contract. Phase legality, seat authority, terminal-state rejection, and revision checks belong at the runtime acceptance boundary.

## F3. RNG stream discipline

**REFUTE as stated; AGREE with a narrower amend-now contract.**

The code does not use one order-sensitive shared stream in the way described. `Rng.fork(tag)` derives a generator from `(parent seed, tag)` and explicitly makes fork order irrelevant (`services/playgame/engine/rng/index.ts:24-25,75-79`). Resolution already uses semantic forks such as `reveal:${owner}:${cardId}`, `eot:${cardId}:${j}`, `priority:${nextTurn}`, draw debuffs, and location reveal (`services/playgame/engine/resolve.ts:209-219,249-267,530-570`). AI also forks to an `ai:${owner}:hand` namespace and then by card/lane (`services/playgame/engine/ai.ts:145-176`). Replay folds recorded events and consumes no RNG (`services/playgame/engine/replay.ts:45-64`).

Therefore a mutable “resolve-stream cursor” in every frame would add the wrong coupling: the current RNG exposes no cursor, forked-stream order is intentionally irrelevant, and event replay does not rerun resolution.

The actual weakness is that stream namespace ownership is conventional and the plan only says “keep deterministic RNG ownership.” Amend now to require:

- top-level namespaces for bootstrap, resolution, AI, and cosmetic randomness;
- gameplay forks derived from stable semantic identity including match revision/transaction identity where repetition is possible;
- no presentation/cosmetic code receiving a gameplay RNG;
- no long-lived root generator whose consumption order affects a later transaction;
- a versioned RNG/tagging scheme in replay/protocol metadata if intent re-simulation across engine versions is expected;
- tests proving that adding cosmetic draws or reordering independent fork creation cannot change committed gameplay events.

This is especially relevant because current presentation/script code receives `engineRng` and performs fallback gameplay evaluation (`services/playgame/script/actions.ts:244-259`). Phase 1/3b already intends to remove that fallback; the RNG boundary should make the prohibition explicit.

## F4. Frame memory model

**AGREE — amend now.**

The current reducer already uses immutable spreads and structural sharing rather than full deep copies (`services/playgame/engine/apply.ts:1-13`), so deep freezing does not itself require cloning every frame. The plan's frame shape can be viable for a short active transaction if it preserves that sharing.

The retention problem is nevertheless real and worse around logs:

- every applied event allocates a new complete `state.log` prefix (`apply.ts:644-646`);
- energy, power, and cost histories are also append-only arrays (`apply.ts:82-97,128-150`);
- `TURN_ENDED` recreates every card object even when most tags did not change (`apply.ts:488-508`);
- replay eagerly retains a state frame for every event (`replay.ts:54-64`);
- some effects scan the full embedded log to answer a turn-local question (`services/playgame/engine/effects/builtins.ts:645-655`).

Retaining all before/after states therefore retains all historical log-prefix arrays and can make allocation and retained references approach quadratic growth in event count, even when most mechanical substructure is shared.

Amend now to state that:

- the frame builder may not deep-clone `MatchState` per event;
- authoritative state snapshots do not embed a copied canonical log; needed history queries use bounded/materialized indexes or tracked fields;
- the presentation owner releases a consumed transaction timeline and invalidates all references when complete, aborted, fast-forwarded, or unmounted;
- replay frames are generated lazily/on demand outside the interactive client use case rather than retained for every live server match;
- durable snapshots are revision-addressed caches, not frame-retention devices;
- transactions have event-count/byte limits so a pathological effect cascade cannot allocate an unbounded timeline before commit.

“Server frames may use log-index references” is a reasonable implementation option, not the primary contract. The primary contract is bounded retention plus structural sharing and a log-free materialized state.

## F5. Hidden information and per-seat projection

**AGREE — amend now, and strengthen the proposed seam. This is the largest issue.**

Code/design evidence:

- `MatchState` contains both seats' complete `deck`, `hand`, and `cards` maps (`services/playgame/engine/types/state.ts:347-354`).
- Current view helpers accept full state and can resolve either seat's hand (`services/playgame/view.ts:145-160`). `PlayBoard` currently reads the remote hand/deck from that same state, even if it renders only counts (`components/screens/play/PlayBoard.tsx:107-141`).
- `MatchEventFrame` in the plan contains full before/after states.
- The plan currently says `MatchSessionContext` exposes frozen deck metadata **and entries for both seats**. That leaks an opponent's list even if order and current hand are later hidden.

`projectForSeat(state, seat)` alone is insufficient. Raw events can leak the same secret: `CARD_DRAWN` identifies an opponent card, `CARD_ADDED_TO_HAND` carries `defId`, and an opaque card ID becomes revealing if the client ever received the complete `cards` map or deck order. The required public boundary is a seat-projected **bootstrap/session descriptor plus projected transaction frames/events**.

Amend now so that:

- full state, full bootstrap deck snapshots, canonical log, and canonical frames remain server/runtime-internal;
- `projectBootstrapForSeat`, `projectStateForSeat`, and `projectTransactionForSeat` produce explicit redacted types, not `MatchState` with fields set to `undefined`;
- opponent hand identities and deck order are absent; unknown cards use stable opaque handles only where presentation needs continuity;
- event payloads are redacted or replaced with viewer-safe presentation events before publication;
- deck-entry visibility is an explicit game policy (normally own entries only, with opponent metadata/count/hash as allowed);
- replay/export authorization is separate from live projection; a reconnect receives a projected snapshot plus projected tail, not the full bootstrap/log;
- UI and `PresentationDirector` accept only projected types, including in local play, so a network-unsafe consumer cannot become the default API;
- serialization tests assert that an opponent definition, variant, hand identity, and deck order never occur in the viewer payload before they become public.

A “pass-through for local play” is acceptable only behind the projection interface and only for a trusted all-seats/debug viewer. It must not define the normal player-facing type.

## F6. Clocks, timeouts, disconnect, and reconnect

**AGREE — put the operational feature in an explicit deferred-risk section, while adding the determinism boundary now.**

There is no authoritative clock or resume protocol in the current engine/runtime plan. Current `Date.now()` use creates local match seeds and staging IDs in `PlayGameContext`, but resolution itself receives seeded RNG and does not read time. That separation should be preserved.

The deferred-risk section should define the future shape:

- an external authoritative match coordinator owns deadlines, disconnect grace, abandonment, and garbage collection;
- expiration submits a typed, authenticated system intent carrying a deadline/epoch identity and expected match revision;
- the deterministic engine resolves that fact without reading wall-clock time;
- reconnect authenticates a rejoin token outside bootstrap/log data, sends the latest seat-projected snapshot/revision plus a projected event tail, and reports the durable disposition of the client's last intent IDs/sequences;
- timeout and reconnect races are serialized through the same per-match revision/receipt mechanism as normal intents.

Do not specify resume as “bootstrap + full log” for a player client; that conflicts with F5 and becomes increasingly expensive. Full bootstrap/log replay is an internal recovery path. Client resume should be projected snapshot plus delta.

## F7. Simultaneous-submit model

**AGREE — decide the model now; REFUTE that `N intents -> one transaction` is the only valid implementation.**

The current product flow is already staged-simultaneous, not alternating-turn: the local seat stages cards, the AI stages its cards face-down, and `resolveTurn` then reveals both sides in priority order (`services/playgame/script/flows.ts:88-119`; `resolve.ts:209-219`). However, one `END_TURN` currently resolves immediately, and there is no per-seat ready/locked state (`resolve.ts:36-48`).

The plan should commit to **simultaneous staged turns with a reveal boundary**. In a two-player coordinator, each seat may submit and revise private staging transactions; each seat then locks; one system-owned resolution transaction runs only when the readiness/deadline policy says the turn is closed.

That does not require the low-level frame builder to take `N` intents. Staging can be serialized into private authoritative state, and a system resolution command can build one transaction from the locked state. What must not be baked into `MatchRuntime` is “the first player's `END_TURN` immediately resolves.”

There is a deeper semantic issue to settle in Phase 0: `resolveStage` immediately fires `onCardEnteredHere` location effects (`services/playgame/engine/resolve.ts:80-110`). If two remote staging requests race, arrival order can affect gameplay before reveal. The plan must choose either a deterministic canonical merge/order at the lock boundary or explicitly commit to serialized staging-order semantics. Network arrival timing must never be an unstated gameplay tiebreaker.

## Weak section 1. Phase 1 review-commit order

**AGREE — amend now.**

Phase 1 is still indivisible as a merge, but it needs internal review commits/checkpoints in dependency order:

1. contract-only types and failing tests: bootstrap, committed transaction record/revision, intent receipt, RNG namespaces, projection types, and frame-retention rules;
2. bootstrap validation, provenance, variants, and shared opening initialization;
3. pure runtime transaction builder/committer, canonical log/recovery fold, shared replay frames, checksums, and idempotent acceptance tests;
4. hand-based AI and migration of every authoritative live mutation path behind typed runtime commands;
5. session/debug adapters, projected publication, replay export, deletion of old authority paths, and final parity/recovery/security gates.

No intermediate commit is independently mergeable if it leaves two authorities. This ordering is for review and bisection on the Phase 1 branch.

## Weak section 2. Presentation cursor unmount/remount

**AGREE — amend now, with invalidation stronger than “snap on fresh mount.”**

Current cancellation only sets `ctx.cancelled = true` (`services/playgame/script/runner.ts:59-72`). Already-running awaited actions and callbacks can continue, and `PlayBoard` merely calls `script.cancel()` on cleanup (`components/screens/play/PlayBoard.tsx:236-238`). This proves lifecycle invalidation is not theoretical.

The contract should say that disposing `PlayUiProvider` aborts and generation-invalidates its director, unsubscribes it, releases timeline/frame references, and prevents all old microtasks/promises from writing cursor state. A newly mounted provider starts from the runtime's latest committed seat projection with no active presentation timeline. If the session itself was disposed, remount creates or recovers a session; it does not resurrect the old UI cursor.

Tests should cover unmount during `beforeFrame`, awaited `afterFrame`, failure-snap microtask, and fast-forward followed by remount.

## Weak section 3. Observability

**AGREE — amend now.**

The current code has a script `onStep` callback and development replay globals, but no runtime observability contract. Add a side-effect-free observer/metrics interface outside deterministic state. At minimum record:

- accepted, duplicate, stale, unauthorized, phase-invalid, and rules-invalid intents by bounded reason code;
- transaction revision, event count/bytes, resolution duration, commit duration, and recovery count;
- pre/post deterministic state checksum and checksum mismatch;
- published/consumed/dropped/fast-forwarded frames and presentation failures;
- reconnect snapshot/tail size and projection/redaction failures.

Do not label metrics with match IDs, participant IDs, card definitions, or raw rejection text. Those are high-cardinality or hidden-information leaks. Per-match correlation belongs in access-controlled structured logs/traces with sampling and retention policy.

## Additional failure modes the review missed

### A1. Split-brain match ownership

Two server workers can both pass a local in-memory lock and commit different revision `N+1` transactions. **Amend-now runtime/storage contract:** commits use compare-and-swap on the durable match revision. **Deferred server risk:** routing/leases require fencing tokens; a stale lease holder cannot commit.

### A2. Silent no-op events and invalid lifecycle transitions

`apply()` deliberately applies blindly and logs events even when bodies return unchanged state (`apply.ts:35-41`; examples include unknown/missing cards and capacity checks). Corrupt or duplicated transaction events can therefore be preserved as apparently valid history, while `resolve()` lacks general phase/terminal guards. **Amend now:** only validated transaction builders feed commit; commit asserts contiguous sequence, expected pre-revision, reducer invariants, and checksum. Invalid authoritative events fail the transaction rather than becoming logged no-ops.

### A3. Denormalized card instances can become stale

`MatchState` stores canonical-looking `CardInstance` objects in `cards`, `deck`, and `hand`, while lanes store IDs (`state.ts:347-350`). `patchCard` updates only `cards`; hand/deck array objects are not refreshed (`apply.ts:569-576,607-617`). Existing selectors often recover by mapping an array entry's ID back through `cards`, but serialization or a new consumer can read stale zone, cost, power, tags, or variant data from the embedded copies. **Amend now or make an explicit Phase 0 decision:** normalize all zones to `CardId[]` with `cards` as the only instance table, or prove and enforce that zone arrays are ID-only views. This is a state-structure issue, not deck-building scope.

### A4. Full-log gameplay queries become latency cliffs

Some builtins scan `state.log` to answer “played here this turn” (`builtins.ts:645-655`). With append-only history, repeated triggers turn into growing work per event and also prevent removing the log from materialized state. **Amend now:** enumerate gameplay log queries and replace them with fold-maintained bounded indexes/tracked variables before adopting the durable-log model.

### A5. Transaction explosion and publication backpressure

Effect recursion has diagnostics, but the runtime plan has no maximum transaction events/bytes, publication queue bound, or slow-subscriber policy. One pathological cascade or disconnected UI can retain a large frame graph and block resources. **Amend now:** bound transaction construction and make presentation publication latest-committed/bounded with explicit drop/fast-forward semantics. Server websocket backpressure remains a deferred transport risk.

### A6. Receipt retention and intent-sequence gaps

Dedup works only while the server remembers the key. Early garbage collection replays an old intent; indefinite global retention leaks memory. **Amend now:** scope receipts to the match, retain them through terminal retention/recovery, and use monotonic sequences to reject keys older than the durable per-seat watermark. Archive/TTL policy is a deferred operational choice.

### A7. Projection/version compatibility and integrity

A canonical event may not have a safe projected representation after a schema change. Falling back to serializing the canonical event would leak data. **Amend now:** projection is exhaustive over the event union and fails closed for unknown protocol variants; projected payloads carry protocol/revision information and integrity checks. Compatibility windows and rolling-deploy policy belong in deferred server risks.

### A8. Rejection spam pollutes canonical gameplay history

`reject()` returns `INTENT_REJECTED` as a `MatchEvent` (`resolve.ts:51-53`), and `apply()` appends diagnostic events to `state.log` even though they do not change mechanical state (`apply.ts:35-41,522-527`). A retry storm or hostile client can therefore grow the canonical log, replay, frames, and snapshots without advancing the match. **Amend now:** rejected/duplicate/stale/unauthorized requests produce durable protocol receipts and bounded audit/metrics records, not gameplay transactions or presentation frames. Keep a diagnostic event in the canonical log only when it records a deterministic resolution condition that is necessary to explain the committed result.

## Convergence recommendation for round 5

Amend the plan now for F1, F2, the narrower F3 contract, F4, F5, F7, all three weak sections, and A1-A8's stated amend-now portions. Add one explicit deferred live-server risk section for authoritative clocks/reconnect, horizontal ownership/leases, transport backpressure, rolling compatibility, receipt archival, and operational retention.

Do not expand Phase 1 into a general server implementation. The purpose of these amendments is to prevent the local runtime contract from making durability, idempotency, projection, memory bounds, or simultaneous-turn coordination expensive or unsafe to add later.
