# Fable Review — Round 1 — playgame-runtime-and-ui-refactor-plan.md

Verdict: direction approved. Amendments requested before implementation.
Code-verified notes included; do not treat these as opinions where marked VERIFIED.

## Corrections to the plan text

1. VERIFIED: the no-flips defect understates the loss surface. In
   services/playgame/script/actions.ts (revealByPriorityFromEngine):
   - events before the FIRST CARD_FLIPPED are never dispatched (per-reveal
     slices start at myIdx + 1);
   - the activeFlipped.length === 0 early-return loses events even when
     flips exist but the UI already considers those cards revealed;
   - the no-flips return is the third path.
   Problem Statement should say "three loss paths in one function" — it
   strengthens the ownership argument.

## Requested amendments

2. Presentation contract: add OPTIONAL transaction-scoped hooks alongside
   per-frame hooks:
     beforeTransaction?(frames: readonly MatchEventFrame[]): void;
     afterTransaction?(): Promise<void> | void;
   Reason: revealPendingCinematic choreographs ALL pending flips as one
   sequence; a strictly per-frame sink cannot see the set, and lookahead
   will otherwise leak through side channels.

3. Commit model (plan's open question 3): commit the COMPLETE transaction
   immediately; presentation consumes a read-only frame timeline. Pacing is
   handled by a presented-frame cursor living in PlayUiContext (presentation
   advances which committed frame the UI store currently reflects).
   Invariant 6 becomes structural instead of policed. The plan should state
   this as the decided model, not an open question.

4. Failure policy (open question 4): on presentation abort/exception, snap
   the presented cursor to end-of-transaction on the next microtask, then
   surface the error. No synchronous drain (reentrancy inside a throwing
   animation callback), no longer deferral (intent interleaving).

5. Script-actions audit: dispatchLocalLocationRevealEffects /
   dispatchLocationRevealEffects (actions.ts ~230-313) dispatch
   LOCATION_REVEALED + effects from presentation code. That is gameplay.
   Phase 0 must enumerate every script step that originates (not merely
   paces) engine events; location reveal moves into engine resolution.

6. Undo: decide via Phase 0 characterization. If undo only unstages
   pre-resolution staged cards, it is a typed runtime command with no
   engine change; if staging commits events, it needs an engine intent.
   Plan should name this as a Phase 0 question with the decision rule.

7. Shared frame builder for live and replay: promote from implicit to a
   REQUIRED invariant (it is the cheapest structural guarantee of
   invariant 7).

8. DOM refs: c.cardRefs and c.boardWrap currently live on the script ctx.
   Plan lists what the runtime does not own but never names these; add an
   explicit work item — they move to the presentation sink/host.

9. Global CSS variable exit criterion (Phase 5): scope to playgame-owned
   variables. VERIFIED: components/ui/shiny/engine/cssVars.ts and
   reflexController.ts also write document.documentElement; they are out of
   scope and will otherwise fail the criterion as written.

10. Phase 6: invert priority — tap-card/tap-lane is the PRIMARY phone
    interaction; pointer-event drag is the enhancement. Fewer failure
    modes, accessibility for free, drag becomes polish.

11. Phase 3 split: 3a = eventAnimator consumes frames (mechanical);
    3b = opening-cinematic separation + PlayScriptCtx reduction (risky).
    Phase 5's four sub-refactors land as independent commits. Phase 1 must
    not shrink (partial runtime = dual authority).

12. Falsifiability: Phase 0 explicitly tests that the engine event
    vocabulary is sufficient to reconstruct every UI-visible transition
    (location reveal is the known suspect). If it is not, that is an
    engine-schema change and the plan's "preserve the engine" claim is
    revised openly rather than silently patched around.

13. Process: record the current lint/build failure baseline inside the plan
    at Phase 0 so "no new failures" is checkable at every phase gate.

## Instructions for this round

Revise docs/playgame-runtime-and-ui-refactor-plan.md to incorporate the
amendments you AGREE with. For any item you DISAGREE with, do not change the
plan silently — add your objection with reasoning to
docs/agent-checkpoints/playgame-plan-codex-response-r1.md, and propose an
alternative. Also record in that file a short list of what you changed.
Do not touch any file other than the plan and your response file.
