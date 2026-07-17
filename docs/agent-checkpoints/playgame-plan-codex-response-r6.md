# Codex Response — Round 6 — Cost-triage classification

## Result

The plan has been swept at requirement level. Every normative requirement has exactly one visible tier tag; descriptive diagnosis, code-shape examples, scope inventory, and nested examples inherit no independent census item. Where a tagged parent owns an untagged nested field/example list, the parent is the counted requirement, as stated in the Cost Model.

## Tier Census

The census is the literal count of visible tier tags in `docs/playgame-runtime-and-ui-refactor-plan.md`:

| Tier | Items |
| --- | ---: |
| SEAM | 89 |
| BUILD NOW | 109 |
| BUILD AFTER | 74 |
| BUILD LAST | 51 |
| DEFER | 36 |
| **Total** | **359** |

## Legitimate Downgrades

1. Durable receipt lifetime, receipt recovery, per-seat sequence watermarks, compaction rules, and authenticated actor binding moved from the Phase 1 build to **DEFER**. Phase 1 keeps the envelope/result seam and implements only an in-memory retry map.
2. Reference durable storage, persisted transaction/checksum records, snapshot-plus-tail recovery, injected pre/post-append recovery tests, and multi-owner revision CAS moved to **DEFER**. Phase 1 retains a non-yielding local commit boundary with in-process revision and invariant checks.
3. Exhaustive opponent-data redaction, stable opaque handles, protocol/integrity serialization, unknown-version fail-closed behavior, and serialization leak tests moved to **DEFER**. Explicit projected types remain a **SEAM**, and their trusted local pass-through consumer is **BUILD AFTER**.
4. Seat-authorized wire replay export and reconnect snapshot/tail payloads moved to **DEFER**. Local replay export from frozen bootstrap, genesis, and in-memory transaction records remains **BUILD NOW**.
5. Recovery/redaction/reconnect observability and access-controlled per-match traces moved to **DEFER**. The side-effect-free metrics interface remains a **SEAM**; local queue/transaction/presentation counters are **BUILD AFTER** with their emitters.
6. Transaction event/byte bounds moved from the Phase 1 commit boundary to **BUILD LAST**.
7. Removal of embedded canonical history, bounded gameplay-log indexes, lazy replay-frame generation, publication bounds, and reference-release assertions moved to **BUILD LAST**. Phase 0 still names every full-log query and its replacement; any index proven necessary to make the initial shared frame builder safe promotes to **BUILD NOW**.
8. The one-time mutation-check exercise moved from Phase 0 to **BUILD LAST**. The five core generated properties remain **BUILD NOW**.
9. `P-INTERLEAVE`, H1–H7 director/cursor interleavings, presented-cursor lifecycle behavior, generation races, queued fast-forward, and local projection integration moved to **BUILD AFTER**, when their provider/director consumers exist.
10. Deadline-driven readiness and proof against remote network arrival timing moved to **DEFER** with authoritative clocks. Local simultaneous stage/lock/reveal and a deterministic staging-order decision remain **BUILD NOW**.
11. Transport subscriber backpressure, reconnect, clocks/lifecycle, fencing, rolling wire compatibility, and operational receipt/transaction retention remain or were moved explicitly to **DEFER** with no Phase 1 implementation work.

## Objections

None. The retained BUILD NOW tier proves the game that exists today: sole runtime authority, bootstrap/deck validity, hand-based AI provenance, shared starting hands, local FIFO/dequeue legality, simultaneous lock/reveal, shared frame construction, exact fold/parity, and migration of all live authoritative mutations. Later tiers attach to explicit seams without forcing server infrastructure into the local refactor.

**EQUILIBRIUM**
