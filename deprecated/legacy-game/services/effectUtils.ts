import { GameState, PlayerID, CardInstance } from '../types';

/**
 * Calculates how many times an ability should trigger based on the current context.
 * Implements the "Order of Operations" for multipliers: Base * Location * Ongoing.
 */
export const getAbilityMultiplier = (
    state: GameState, 
    laneIdx: number, 
    player: PlayerID, 
    card: CardInstance,
    triggerTag: string = 'OnReveal' // Default to OnReveal for backward compatibility/simplicity
): number => {
    let multiplier = 1;
    const lane = state.lanes[laneIdx];

    // 1. Location Layer (e.g., Nebula)
    // Only doubles OnReveal effects
    if (triggerTag === 'OnReveal' && lane.location.def.effect === 'NebulaEffect') {
        multiplier *= 2;
    }

    // 2. Future Layers: Ongoing Effects (e.g. Wong)
    // To be implemented: Scan lane for cards with 'DoubleReveal' tag/effect

    return multiplier;
};