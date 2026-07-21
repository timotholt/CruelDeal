
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OngoingEffectFunction } from '../types';
import { addContinuousModifier } from '../services/statHelpers';
import { queryUnits } from '../services/queries';

export const Commander: CardDefinition = {
    id: 'c3',
    name: 'Commander',
    rarity: 'Rare',
    baseCost: 3,
    basePower: 3,
    tags: ['Ongoing', 'Buff'],
    baseText: 'On Going: Your other cards at this location have +1 Power.',
    effect: 'CommanderEffect',
    imageUrl: getImg(3),
};

export const CommanderEffect: OngoingEffectFunction = (state, laneIndex, slotIndex, source) => {
     // Find friendly cards in this lane, excluding self
     const targets = queryUnits(state, {
         laneIndex,
         owner: source.owner,
         excludeInstanceId: source.instanceId
     });

     targets.forEach(target => {
         addContinuousModifier(target, { source: source.def.name, value: 1, type: 'CONTINUOUS' });
     });
};
