
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';

export const Jumper: CardDefinition = {
    id: 'c5',
    name: 'Jumper',
    rarity: 'Rare',
    baseCost: 2,
    basePower: 3,
    tags: ['OnReveal', 'Move'],
    baseText: 'On Reveal: Move this card to the location to the right.',
    effect: 'JumperEffect',
    imageUrl: getImg(5),

    // Assets
    sfxOnPlay: 'sfx_equip_tech',
    sfxOnReveal: 'sfx_teleport_short',
    vfxOnReveal: 'vfx_warp_trail',
};

export const JumperEffect: OnRevealEffect = (state, source, context) => {
    const currentLaneIdx = context.laneIndex;
    const targetLaneIdx = currentLaneIdx + 1;
    
    if (targetLaneIdx < 3) {
        // Use DI Action
        return context.actions.moveCard(state, source.instanceId, targetLaneIdx);
    }
    return state;
};
