/**
 * Canonical timing policy for card motion.
 *
 * Interaction landing is the short correction from the released pointer to a
 * slot. Committed hand-to-lane flight is the full presentation journey from a
 * remote hand anchor to the board. They intentionally have different values,
 * but belong to the same policy so the two paths cannot drift accidentally.
 */
export const CARD_MOTION_TIMING = {
  interactionLandingMs: 120,
  committedHandToLaneMs: 700,
} as const;
