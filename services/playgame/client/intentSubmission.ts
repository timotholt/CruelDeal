/**
 * Allow browser-owned pending intent state to paint before authority work runs.
 * The follow-up task prevents a local synchronous resolver from occupying the
 * same pre-paint checkpoint as the user's command submission.
 */
export const continueAfterIntentPendingPaint = (): Promise<void> => new Promise(
  resolve => requestAnimationFrame(() => setTimeout(resolve, 0)),
);
