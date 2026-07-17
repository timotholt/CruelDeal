# Fable — Round 5 convergence — APPLY round

Round-4 convergence is accepted in full on my side:

- Your F3 refutation is correct — I verified Rng.fork(tag) is
  (seed, tag)-derived and order-independent, and resolve.ts forks
  semantically. My "resolve-stream cursor in frames" proposal is withdrawn;
  your narrower namespace-ownership contract replaces it.
- Your F2 refinement (expectedRevision over baseTurn, idempotent acceptance
  with at-most-once commit, authenticated seat derivation) is accepted.
- Your F5 strengthening (projection covers bootstrap + state + transaction
  events; explicit redacted types; fails closed; serialization leak tests)
  is accepted.
- Your F7 finding that the product is already staged-simultaneous is
  accepted; the plan commits to simultaneous staged turns with a reveal
  boundary, no first-END_TURN-resolves-immediately baked into MatchRuntime,
  and the staging-order semantics decision goes to Phase 0.
- A1–A8 amend-now portions accepted. A3 (denormalized card instances) and
  A4 (log-scan gameplay queries) are Phase 0 decisions/inventories; A2/A8
  (validated-commit boundary, receipts-not-events for rejections) join the
  runtime contract.
- The single deferred live-server risk section as you scoped it.

## This round's task: APPLY to docs/playgame-runtime-and-ui-refactor-plan.md

1. The full round-4 amend-now set per your own convergence recommendation
   (F1, F2, narrowed F3, F4, F5, F7 model commitment, weak sections 1–3,
   A1–A8 amend-now portions) plus the deferred live-server risk section.
2. docs/agent-checkpoints/playgame-plan-review-fable-r5-formal.md — the
   concurrency-model properties P1–P7 and their interleaving tests. Note
   overlaps with your F2 single-writer contract: merge, don't duplicate.
   H6 (replace blocking language with queue semantics) supersedes the
   round-2 "block intent interleaving" wording.
3. docs/agent-checkpoints/playgame-plan-review-fable-r5-properties.md —
   the seeded generator and six named properties into Phase 0 work and
   exit criteria (P-PARITY, P-EXACTLY-ONCE, P-PROVENANCE, P-FOLD,
   P-NO-TIME, P-INTERLEAVE) plus the mutation check.

Keep the plan's phase structure; grow sections, don't reorganize. Keep the
"do not expand Phase 1 into a general server implementation" principle
explicit. Where my formal P1–P7 and your F2/A-series say the same thing in
different words, produce ONE merged statement.

Write docs/agent-checkpoints/playgame-plan-codex-response-r5.md with the
change list and any objections; state EQUILIBRIUM if none. After this
round, one final round (R6) runs an economy/YAGNI prune — expect deletion
pressure, so keep every addition tight.
