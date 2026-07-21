
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';

export const Annihilator: CardDefinition = {
    id: 'c10',
    name: 'Annihilator',
    rarity: 'Legendary',
    baseCost: 5,
    basePower: 4,
    tags: ['OnReveal', 'Destroy'],
    baseText: 'On Reveal: Destroy ALL other cards at this location.',
    effect: 'AnnihilatorEffect',
    imageUrl: getImg(10),
};

export const AnnihilatorEffect: OnRevealEffect = (state, source, context) => {
    const targets = queryUnits(state, {
        laneIndex: context.laneIndex,
        excludeInstanceId: source.instanceId
    });
    
    let currentState = state;
    targets.forEach(t => {
        // Use DI Action
        currentState = context.actions.destroyCard(currentState, t.instanceId);
    });
    
    return currentState;
};
