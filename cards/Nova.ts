
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';

export const Nova: CardDefinition = {
    id: 'c12',
    name: 'Nova',
    rarity: 'Rare',
    baseCost: 1,
    basePower: 2,
    tags: ['OnDestroy', 'Buff'],
    baseText: 'On Destroy: Give all your other cards +1 Power.',
    effect: 'NovaEffect',
    imageUrl: getImg(12),
};

export const NovaEffect: OnRevealEffect = (state, source, context) => {
    // 1. Find all friendly cards on board (excluding self, though self is likely already destroyed/dying)
    const targets = queryUnits(state, {
        owner: source.owner,
        excludeInstanceId: source.instanceId,
        location: 'board'
    });
    
    let s = state;
    targets.forEach(target => {
        s = context.actions.modifyPower(s, target.instanceId, 1, 'Nova Force');
    });

    return s;
};
