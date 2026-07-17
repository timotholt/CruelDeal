# Fable Review — Round 5 (part A) — Formal pass on the intent/commit/present protocol

Method: model the protocol as three actors — Runtime (R), PresentationDirector
(D), Intent sources (P: local player, AI, session commands) — and enumerate
interleavings the prose does not close. Each hole below is stated as the
interleaving that breaks, then the property that closes it.

## Holes found

### H1. No single-writer statement for the runtime
Interleaving: player END_TURN accepted; while its transaction resolves (or
in any future async resolution), the AI turn submits. Nothing in the plan
says intents are processed strictly one at a time.
Property P1 (single writer): the runtime processes intents from ONE FIFO
queue; at most one transaction is being resolved/committed at any time;
acceptance order is total. All sources (local player, AI, session commands
like reset) enter the same queue.

### H2. Validation-time vs application-time
Interleaving: intent validated on submission against state S_n; a queued
earlier intent commits S_n+1; the validated intent is now illegal but
already "accepted."
Property P2: legality is decided when the intent is DEQUEUED for
resolution, against the then-current authoritative state. Submission-time
checks are advisory UX only. A dequeued-illegal intent is rejected with a
typed result; it does not throw or halt the queue.

### H3. Two snap mechanisms can race
Interleaving: afterFrame throws → error-snap microtask queued. Before it
runs, the player submits an intent → fast-forward cancels the (already
dead) run and snaps. New transaction T2 commits and begins presenting. The
stale error-snap microtask now fires and snaps "to the end" — of which
transaction?
Property P3 (generation safety): every presentation run carries a
generation number; cursor mutations (advance, snap) are accepted only from
the run whose generation matches the current one. Stale snaps are no-ops.
Property P4 (idempotent snap): snapping an already-snapped cursor is a
no-op; both mechanisms may fire in any order within the same generation.

### H4. Reset/exit during presentation is unspecified at protocol level
Interleaving: resetMatch (or route unmount) arrives mid-afterFrame await.
Property P5: session commands flow through the same intent queue (P1) and
bump the match generation; generation bump aborts the active presentation
run via its AbortSignal, drops the timeline, and resets the cursor. Cursor
and timeline state live in PlayUiProvider and die with it on unmount; a
remount presents nothing and reflects authoritative state.

### H5. Sink reentrancy
Interleaving: a presentation sink (afterFrame/afterTransaction) submits an
intent — e.g. an auto-advance on animation completion. Fast-forward then
cancels the very run that is currently executing the submitting callback:
self-cancellation while awaited, undefined continuation.
Property P6: presentation sinks MUST NOT submit intents synchronously from
within their own hooks. Any presentation-triggered intent (auto-advance,
timeout skip) is deferred to a queue drain after the run completes or
aborts. Enforce by API shape: hooks receive no submitIntent capability.

### H6. "Block intent interleaving until snap completes" contradicts P1
Round-2 wording says intents are not accepted while the cursor is behind
(then fast-forward supersedes it). With P1's queue, "not accepted" should
be "queued": nothing is ever rejected because a cursor is behind; the
queue simply drains after the snap. Replace blocking language with queue
semantics to remove the ambiguity.

### H7. AI turn scheduling authority
The plan moves AI planning behind runtime-accepted intents but never says
WHO decides when the AI submits (currently script flow ordering). Property
P7: the runtime (or session) owns turn-phase scheduling; the AI controller
is invoked by the runtime after the player's transaction commits, and its
intent enters the same queue. Presentation pacing cannot delay AI intent
SUBMISSION (only its visible presentation), or a slow animation changes
match timing.

## Amendments requested

Add a "Concurrency Model" subsection to the Commit and Presentation
Contract codifying P1–P7, and reflect them in Phase 1 work/exit criteria:

- one FIFO intent queue, single-writer runtime, total intent order (P1)
- dequeue-time validation with typed rejection (P2)
- presentation-run generation numbers; stale cursor ops are no-ops (P3, P4)
- reset/unmount as generation bumps through the queue (P5)
- sinks receive no intent-submission capability; presentation-triggered
  intents defer to post-run (P6)
- runtime-owned AI scheduling decoupled from presentation pacing (P7)
- Phase 0/1 tests: scripted interleavings for H1–H7 (double-submit during
  presentation, error-snap racing fast-forward, reset mid-animation,
  dequeue-time illegality) — these become named characterization tests.
