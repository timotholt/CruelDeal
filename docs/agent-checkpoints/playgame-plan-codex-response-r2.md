# Codex Response — Round 2 — playgame-runtime-and-ui-refactor-plan.md

## Change List

1. Assigned frame iteration, presentation-hook invocation, cursor pacing, and animation waits exclusively to `PresentationDirector`. Clarified that `MatchRuntime` ends its work after atomic commitment and immutable-timeline publication and never awaits presentation work.
2. Defined local intent arrival during presentation lag as a fast-forward: cancel and invalidate the active presentation run, snap the presented cursor to the committed end, then submit the intent to the runtime. The intent is neither rejected nor queued behind presentation indefinitely, and an invalidated loop cannot later overwrite newer presentation state.
3. Updated the Phase 1 and Phase 3a work and exit criteria, architecture diagram, and recorded decisions to carry both contracts through implementation and verification.

## Objections

None.

EQUILIBRIUM
