/**
 * Player-owned interaction preferences for the canonical play surface.
 *
 * Pointer dragging is always available. `tapToPlay` enables the optional
 * tap-card, tap-destination interaction path; it is off until the future
 * external settings UI explicitly enables it.
 */
export interface PlayInteractionSettings {
  readonly tapToPlay: boolean;
}

export const DEFAULT_PLAY_INTERACTION_SETTINGS: PlayInteractionSettings =
  Object.freeze({ tapToPlay: false });
