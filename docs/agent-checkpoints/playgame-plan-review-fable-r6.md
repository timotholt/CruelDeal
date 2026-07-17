# Fable Review — Round 6 — Cost-triage classification pass

Five review rounds were additive. This round is economic triage so the
plan stays buildable by a solo developer. NOT a deletion round — a
classification round. Every requirement introduced in rounds 1–5 (and any
pre-existing work item whose cost changed because of them) gets exactly one
tag:

- **SEAM** — contract/API shape decided now; zero or near-zero build cost.
  Example candidates: "frame builder may not deep-clone", "sinks receive no
  intent-submission capability", "UI consumes only projected types" (with
  local pass-through), RNG namespace ownership rules, "log is canonical"
  wording, event-vocabulary versioning policy statements.
- **BUILD NOW** — implemented in Phase 0/1; proves core correctness of the
  game that exists today. Candidates: parity/provenance/fold properties,
  AI-from-hand switch, startingHandSize, bootstrap with debug decks,
  single-writer intent queue, generation-safe cursor, deck validation,
  interleaving characterization tests.
- **BUILD AFTER** — implemented during Phases 2–4 when its consumer
  appears. Candidates: presented-cursor lifecycle tests, P-INTERLEAVE
  property, projection pass-through implementation, observability counters
  the director/session actually emit.
- **BUILD LAST** — Phases 5–7 era hardening with local value but no
  ordering dependency. Candidates: transaction size bounds, A4 log-scan
  index replacement (unless Phase 0 proves it blocks the log-free state
  decision — then it promotes), memory-retention assertions, mutation
  check automation.
- **DEFER** — recorded in the deferred live-server risk section; no work.
  Candidates: durable receipts/CAS revisions/checksum persistence,
  redaction serialization tests, reconnect protocol, clocks/timeouts,
  backpressure, receipt retention, split-brain fencing, A7 projection
  versioning.

My candidate placements above are suggestions, not decisions — you make
the call per item, and you know the code cost better. Decision rule, in
priority order:
1. Does skipping it now make a later tier MORE expensive or unsafe to add?
   If yes → SEAM at minimum (shape the contract, defer the build).
2. Does it catch bugs in the game as it exists today (local, debug decks,
   bot opponent)? If yes → BUILD NOW/AFTER by phase of its consumer.
3. Does it only matter once a real server/multiplayer exists? → DEFER,
   however architecturally satisfying it is.
4. When torn between adjacent tiers, choose the LATER one.

## Task

1. Sweep the entire plan. Tag every requirement inline (e.g. bold
   **[SEAM]**, **[BUILD NOW]**, ...) or restructure each phase's work list
   under tier headings — your choice, but the tag must be visible at the
   requirement level, not the section level.
2. Add a short "Cost Model" section near the top: what BUILD NOW sums to
   (rough relative size, e.g. in review-commit units), and the measurable
   gate each tier ends with (named tests green = tier proven).
3. Anything already implemented (GameTextV3 etc.) is out of scope.
4. If a round-1..5 requirement should be DOWNGRADED (e.g. something we
   marked amend-now that is really DEFER), do it and list it — this is the
   round where deletion pressure is legitimate.
5. Write docs/agent-checkpoints/playgame-plan-codex-response-r6.md with
   the tier census (count of items per tier), the downgrade list, any
   objections; state EQUILIBRIUM if none.
