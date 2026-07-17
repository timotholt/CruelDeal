# Codex Response — Round 1 — playgame-runtime-and-ui-refactor-plan.md

Verdict: all thirteen requested amendments are accepted. No objections.

## Code Verification

- The three reveal loss paths are present in `services/playgame/script/actions.ts`: per-reveal slices begin after each `CARD_FLIPPED`, both the no-flips and no-active-flips branches return early, and `_revealsConsumedUpTo` has already been set to the `TURN_ENDED` boundary.
- `revealPendingCinematic` receives and serially choreographs the complete `pendingIds` set, so transaction-scoped frame access is a real requirement rather than speculative API surface.
- `eventAnimator.ts` currently calls `ctx.dispatch(event)` in both its no-transfer and transfer paths. It is gameplay authority today, not a read-only animator.
- `revealLocation` dispatches `LOCATION_REVEALED`; `dispatchLocationRevealEffects` either consumes an engine slice or locally runs `evalEffect` and dispatches its events. The engine's `resolveTurn` also emits location reveal and ability events, confirming that the script fallback duplicates gameplay resolution.
- The broader script audit also found event origination in opening draws, remote-card creation/staging/energy spending, card-flip dispatch, turn-event slicing, and direct phase setters.
- Current undo restores full `MatchState` snapshots after staging has already committed engine events. The engine already exposes `UNSTAGE_CARD` and `UNDO_TURN`; Phase 0 therefore needs to prove whether their existing semantics preserve current single-card/LIFO rollback when staging triggers other effects, not decide whether an engine intent path is needed at all.
- Replay currently builds its own frame array in `services/playgame/engine/replay.ts`; there is no shared live/replay transaction-frame builder yet.
- `cardRefs`, `zoneRefs`, and `boardWrap` are fields of `PlayScriptCtx` and are populated by `PlayBoard`, confirming the hidden presentation-host dependency.
- `BoardSizer.tsx` writes `--board-w` and `--board-h` to `document.documentElement`. The shiny engine independently writes other root variables, so the Phase 5 criterion must be restricted to playgame-owned variables.
- The current mobile path uses `DragEvent`, and `useDragDrop.ts` has module-level mutable `dragState`. This supports tap-first interaction plus an instance-local pointer enhancement.

## Objections

None.

## Change List

- Expanded the Problem Statement from one no-flips case to the three verified loss paths.
- Made complete-transaction immediate commitment, a `PlayUiContext` presented-frame cursor, and next-microtask failure snapping explicit decisions and invariants.
- Added optional transaction hooks beside per-frame presentation hooks.
- Made one shared live/replay frame builder a required invariant, Phase 0 deliverable, and Phase 1 exit criterion.
- Added a code-verified Phase 0 inventory of every script action that originates engine events or directly changes authoritative phase, including location reveal/effects.
- Added the Phase 0 engine-event-vocabulary falsification test and conditional engine-schema revision.
- Added the undo characterization rule, grounded in the existing staging events and undo intents.
- Added exact lint/build baseline recording to Phase 0.
- Required `cardRefs`, `zoneRefs`, and `boardWrap` to move from `PlayScriptCtx` to the presentation sink/host.
- Split Phase 3 into mechanical frame consumption (3a) and opening/script-authority separation (3b).
- Made Phase 1 an indivisible authority migration and split Phase 5 into four independent commits.
- Scoped the root-CSS-variable exit criterion to playgame-owned variables.
- Made tap-card/tap-lane the primary phone interaction and pointer drag an enhancement.
- Replaced the resolved review questions with settled decisions and three evidence questions for Phase 0.
