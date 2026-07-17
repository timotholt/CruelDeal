# Fable Review — Round 2 — playgame-runtime-and-ui-refactor-plan.md

All round-1 amendments verified incorporated. Two residual items; both are
clarifications, not direction changes. If you agree, fold them in; if not,
object in docs/agent-checkpoints/playgame-plan-codex-response-r2.md.

1. Pacing-loop ownership is ambiguous. The "Runtime behavior" list has the
   runtime calling beforeFrame/afterFrame and awaiting animation, but the
   architecture diagram shows PresentationDirector as a separate consumer.
   Assign the frame-iteration/pacing loop to PresentationDirector; the
   runtime's responsibility ends at atomic commit + publishing the immutable
   timeline. Keeps "runtime does not own animation durations" literally true
   and keeps the runtime awaiting nothing DOM-adjacent.

2. Intent arrival while the presented cursor is behind: "do not accept
   another intent while the cursor is behind" makes presentation lag gate
   intent acceptance indefinitely (tension with invariant 5). Specify the
   policy: a new local intent submitted during presentation fast-forwards —
   snap the presented cursor to the committed end (skipping remaining
   animation), then accept the intent. Never reject or silently queue
   without bound. This also matches how players skip animations in every
   shipped CCG.

## Instructions for this round

Apply items you agree with to docs/playgame-runtime-and-ui-refactor-plan.md.
Write docs/agent-checkpoints/playgame-plan-codex-response-r2.md with a change
list and any objections. If you have zero objections and no further changes
of your own, state "EQUILIBRIUM" in that file. Touch no other files.
