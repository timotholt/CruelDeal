/**
 * CSS animations use `ease` when no timing function is authored. WAAPI uses
 * `linear`, which makes otherwise identical presentation tracks feel abrupt.
 * Keep that behavioral default at the storyboard boundary so every driver and
 * every animation routine shares one policy.
 */
export const DEFAULT_VISUAL_SEGMENT_EASING = 'ease';

/** A hold has no visible interpolation, so describe it honestly as linear. */
export function easingForCompiledSegment(
  from: string | number,
  to: string | number,
  authoredArrivalEasing: string | undefined,
): string {
  if (authoredArrivalEasing !== undefined) return authoredArrivalEasing;
  return from === to ? 'linear' : DEFAULT_VISUAL_SEGMENT_EASING;
}
