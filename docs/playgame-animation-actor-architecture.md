# Playgame Animation Actor Architecture

Status: superseded and consolidated

Superseded by: `docs/playgame-compiled-animation-timeline-spec.md`

This document has no active requirements. Its actor-pool, visual-ownership,
face-readiness, choreography, and verification decisions were incorporated
into the compiled animation timeline specification, which is the sole active
authority for animation actors, timing, completion, cancellation, failure,
and verification.

Do not implement against older copies of this document. In particular, the
active specification replaces the former 16-actor assumption and imperative
`animateTo()` lifecycle.
