/**
 * Designer-facing wall-clock budgets. These are presentation policy only and
 * must never enter canonical events, frames, state, or replay records.
 */
export const REVEAL_CINEMATIC_TIMING = Object.freeze({
  enterMs: 350,
  holdMs: 350,
  returnMs: 320,
});

/** CardMotionSession adds a 30 ms completion guard to each motion phase. */
export const REVEAL_CINEMATIC_TOTAL_MS =
  REVEAL_CINEMATIC_TIMING.enterMs
  + REVEAL_CINEMATIC_TIMING.holdMs
  + REVEAL_CINEMATIC_TIMING.returnMs
  + 60;
