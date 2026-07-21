
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';

export const Saboteur: CardDefinition = {
    id: 'c7',
    name: 'Saboteur',
    rarity: 'Rare',
    baseCost: 2,
    basePower: 1,
    tags: ['OnReveal', 'Debuff'],
    baseText: 'On Reveal: Give all enemy cards here -1 Power.',
    effect: 'SaboteurEffect',
    imageUrl: getImg(7),
};

export const SaboteurEffect: OnRevealEffect = (state, source, context) => {
    const targets = queryUnits(state, {
        laneIndex: context.laneIndex,
        owner: source.owner === 'p1' ? 'p2' : 'p1'
    });
    
    let currentState = state;
    targets.forEach(target => {
        currentState = context.actions.modifyPower(currentState, target.instanceId, -1, 'Saboteur');
    });
    
    return currentState;
};
