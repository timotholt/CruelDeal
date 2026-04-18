
import { CardDefinition, OngoingEffectFunction } from '../types';
import { getImg } from '../utils/assets';
import { addContinuousCostModifier } from '../services/statHelpers';

export const Death: CardDefinition = {
    id: 'c15',
    name: 'Death',
    rarity: 'Legendary',
    baseCost: 8,
    basePower: 12,
    tags: ['Ongoing'],
    baseText: 'Costs 1 less for each card destroyed this game.',
    effect: 'DeathCostEffect',
    imageUrl: getImg(15),
};

/**
 * Death's passive ability functions in hand and on board.
 * It sums the total destroyed cards from both players' stats.
 */
export const DeathCostEffect: OngoingEffectFunction = (state, laneIdx, slotIdx, source) => {
    const totalDestroyed = state.players.p1.stats.destroyedCount + state.players.p2.stats.destroyedCount;
    
    if (totalDestroyed > 0) {
        addContinuousCostModifier(source, { 
            source: 'Death Ambience', 
            value: -totalDestroyed, 
            type: 'CONTINUOUS' 
        });
    }
};
