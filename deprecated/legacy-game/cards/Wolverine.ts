
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';

export const Wolverine: CardDefinition = {
    id: 'c14',
    name: 'Wolverine',
    rarity: 'Legendary',
    baseCost: 2,
    basePower: 2,
    tags: ['OnDestroy', 'OnDiscard', 'Buff', 'Summon'],
    baseText: 'When this is discarded or destroyed, regenerate it at a random location with +2 Power.',
    effect: 'WolverineEffect',
    imageUrl: getImg(14),
    sfxOnPlay: 'sfx_deploy_soldier',
};

/**
 * Wolverine Effect:
 * Triggers when the card is destroyed or discarded.
 * Finds a random valid lane and places the card there with a permanent power boost.
 */
export const WolverineEffect: OnRevealEffect = (state, source, context) => {
    let s = state;

    // 1. Apply the +2 Power Buff (Permanent)
    s = context.actions.modifyPower(s, source.instanceId, 2, 'Healing Factor');

    // 2. Determine potential lanes (0, 1, 2) and shuffle them for random pick
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    
    // 3. Find the first lane with space
    const targetLaneIdx = lanes.find(idx => {
        const lane = s.lanes[idx];
        const slots = source.owner === 'p1' ? lane.p1Slots : lane.p2Slots;
        return slots.some(slot => slot === null);
    });

    if (targetLaneIdx !== undefined) {
        // 4. "Regenerate": Remove from current pile (Destroyed/Discarded) and place on board
        const playerState = s.players[source.owner];
        
        // Remove from piles
        playerState.destroyedPile = playerState.destroyedPile.filter(c => c.instanceId !== source.instanceId);
        playerState.discardPile = playerState.discardPile.filter(c => c.instanceId !== source.instanceId);

        // Update card state
        source.zone = 'BOARD';
        source.faceUp = true; // Always revealed when regenerating
        
        // Add to lane
        s = context.actions.addCardToLane(s, source, targetLaneIdx);
        
        // Visuals
        s = context.actions.playSfx(s, 'sfx_teleport_short');
        s.history.push(`${source.def.name} regenerated at Lane ${targetLaneIdx + 1}!`);
    } else {
        s.history.push(`${source.def.name} had no space to regenerate.`);
    }

    return s;
};
