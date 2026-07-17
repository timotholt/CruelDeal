# Codex Response — Round 5 — APPLY

## Change list

- Added the round-4 durability contract: validated bootstrap plus canonical genesis state and append-only committed transaction records are authoritative; snapshots are revisioned caches; recovery, snapshot-tail, checksum, receipt-parity, and overlapping-replay-history tests are required.
- Merged F2, A1/A2/A6/A8, and formal P1/P2 into one concurrency/commit contract: one FIFO single-writer queue, dequeue-time validation, authenticated seat derivation, exact `expectedRevision`, idempotent receipts with at-most-once commit, sequence watermarks, atomic receipt/transaction/revision commit, revision CAS, validated bounded transactions, and receipts-not-events for rejected/duplicate/stale/unauthorized requests.
- Added formal P3–P7 once: presentation generations and idempotent snaps, queued fast-forward semantics, reset/disposal/unmount invalidation, non-reentrant sinks, and runtime-owned AI/phase scheduling. Added the H1–H7 scripted interleaving tests to Phase 0 and Phase 1 gates.
- Added the narrowed RNG ownership contract: versioned bootstrap/resolution/AI/cosmetic namespaces, stable semantic forks, no gameplay RNG in presentation, no order-sensitive long-lived root consumption, cosmetic/fork-order tests, and the wall-clock determinism guard.
- Added the bounded frame/state model: structural sharing without per-event deep clones, log-free materialized state, Phase 0 decisions for card-instance normalization and gameplay log-scan replacements, transaction and publication bounds, timeline release on every terminal path, and lazy replay frames.
- Added the hidden-information boundary across bootstrap, state, transactions, events, frames, reconnect, and replay authorization. Normal UI and `PresentationDirector` now accept only explicit projected types; projections are exhaustive, versioned, integrity-bearing, and fail closed, with serialization leak tests.
- Committed the product model to simultaneous private staging with per-seat lock and a system-owned reveal boundary. Phase 0 must decide canonical merge versus explicit serialized staging order; the first `END_TURN` cannot resolve immediately.
- Added the five Phase 1 internal review checkpoints, provider/director lifecycle rules, and side-effect-free bounded observability contract. Phase 1 remains one indivisible authority migration.
- Added the seeded Phase 0 generator, configurable CI depth of at least 200 cases, P-PARITY, P-EXACTLY-ONCE, P-PROVENANCE, P-FOLD, P-NO-TIME, P-INTERLEAVE, printed-seed replay helper, and the recorded reducer mutation check. Phase 1 explicitly gates on P-PARITY, P-EXACTLY-ONCE, and P-INTERLEAVE.
- Added one deferred live-server risk section for authoritative clocks/reconnect, fenced horizontal ownership, transport backpressure, rolling projection compatibility, and receipt/snapshot/log operational retention. The plan explicitly says not to expand Phase 1 into a general server implementation.
- Updated downstream phases, verification, commit strategy, stop conditions, and review decisions to remove superseded blocking/full-state/full-log wording while preserving the existing phase structure.

## Objections

None.

**EQUILIBRIUM**
