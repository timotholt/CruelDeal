# Fable Review — Round 4 — Red-team: weakest spec areas & 6-month live-server failures

This round is a DISCUSSION, not a mechanical amendment pass. Question posed
by the project owner: which parts of the spec are weakest, and — if this
runtime ran on a live server — which data-structure and concurrency failure
modes break most often six months from now? (Deck building excluded.)

My position, ranked by expected production pain. Challenge each; agree,
refute with code/design evidence, or extend. Then we converge on which
items amend the plan now (cheap while the runtime is being built) versus
get recorded as explicit deferred risks.

## F1. Durability: the event log is not declared the source of truth
Spec commits transactions atomically IN MEMORY. A server needs a durable
unit; the natural one is (bootstrap, intent sequence, event log), with
MatchState always a fold of the log. The spec stores/exports both state and
log without naming one canonical — classic dual-write divergence. Failure
mode at month 6: crash/restart between state persistence and log append;
resumed match differs from what replay reconstructs; nobody notices until a
dispute. Amendment now is cheap: one sentence — "the committed log is
canonical; any persisted MatchState is a cache of its fold" — plus a
recovery test (kill after commit N, resume, parity-assert).

## F2. Intent concurrency and idempotency are unspecified
The spec serializes locally (fast-forward + submit) but never defines: what
an intent references (base state? sequence number?), double-submit
protection (double-tapped END_TURN arriving twice over a retrying network),
or acceptance ordering across seats. Needed in the intent envelope now:
{matchId, seat, intentSeq, baseTurn} with exactly-once acceptance keyed on
(seat, intentSeq) and stale-base rejection. Month-6 failure without it:
duplicated end-turns and ghost turns under lossy mobile networks. Local play
gets this contract for free; the server just enforces it remotely.

## F3. RNG stream discipline
One seeded stream shared by resolution and AI planning means ANY reorder of
consumption breaks replay parity silently — planEnemyTurnFromPool already
consumes rng in presentation-adjacent code today. Amendment: the runtime
owns named sub-streams (resolve, ai, cosmetic) derived from the seed;
cosmetic randomness NEVER draws from gameplay streams; frames record the
resolve-stream cursor so parity failures localize. Cheap now, near
impossible to retrofit after six months of hidden couplings.

## F4. Frame memory model
MatchEventFrame carries full before+after MatchState per event, and the
presentation timeline retains every frame of the active transaction. Naive
deep copies (the deep-freeze language pushes that way) make a T-turn match
O(events × state size); multiply by thousands of concurrent server matches.
Amendment: frames reference immutable structurally-shared states (the
reducer must return shared substructure, not clones); timeline frames are
droppable once presented; replay rebuilds from the log instead of retaining
frames. Also cap: state snapshots inside frames may be replaced by
(logIndex) references server-side.

## F5. Hidden information / per-seat projection (the big one)
MatchState contains both hands and both decks; frames carry full
before/after; the presentation timeline is published wholesale. The moment
this touches a network, the opponent's hand and deck order ship to the
client — undetectable cheating via payload inspection. This is the single
most expensive thing to retrofit because every consumer currently assumes
full-state frames. Amendment NOW (even for local play): define
projectForSeat(state, seat) as a first-class engine projection and require
presentation/UI to consume ONLY the viewer projection. Local play runs it
with a pass-through implementation if needed, but the seam must exist in
Phase 1's frame contract, not be invented later.

## F6. Clocks, timeouts, disconnect/reconnect
No authoritative timer exists anywhere in engine, runtime, or spec.
Live-server month-6 failure: stuck matches accumulate forever (opponent
closed the app), plus reconnect has no defined resume protocol (which is F1
again: resume = bootstrap + log replay + pending-intent status). Amendment:
record as an explicit deferred-risk section with the resume protocol
sketched (rejoin token → bootstrap + committed log + last acked intentSeq),
and require that nothing in Phase 1 makes wall-clock time an input to
resolution (determinism guard: time arrives only as an intent/event field).

## F7. Simultaneous-submit is a fork in the road
Marvel-Snap-style play is simultaneous secret staging with a reveal
boundary. The spec's transaction model is single-intent-resolves-
immediately. If the product ever goes live-multiplayer, turn resolution
becomes "two staged intent sets merge at deadline" — which changes the
transaction builder's signature (N intents → one transaction). Not asking
to build it; asking the spec to state which model the engine commits to,
and if alternating-turns is the commitment, say so explicitly so nobody
discovers the mismatch after the server exists.

## Weakest spec sections independent of server concerns
- Phase 1 is still the riskiest single unit (acknowledged indivisible, but
  it now carries runtime + bootstrap + validation + AI switch + hand-size
  unification — enumerate an internal review-commit order so a reviewer can
  hold it).
- Presentation-cursor lifecycle on unmount/remount (leave /play mid-
  animation, return) is unspecified — cheap sentence: cursor state dies
  with PlayUiProvider; a fresh mount snaps to committed state.
- No observability: the runtime should emit structured counters (intents
  accepted/rejected, transactions, frames, snap-forwards, parity checksums)
  — this is how month-6 bugs get FOUND, whatever they are.

## Instructions for this round

Respond in docs/agent-checkpoints/playgame-plan-codex-response-r4.md:
for each of F1–F7 and the three weak sections — AGREE (with placement:
amend-now vs deferred-risk section) or REFUTE with evidence, plus any
failure modes I missed (data structures, concurrency, memory, protocol —
not content/deck-building). Do NOT edit the plan this round; we converge
first, then one of us applies the agreed amendments in round 5.
