
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OngoingEffectFunction } from '../types';
import { addContinuousModifier } from '../services/statHelpers';
import { queryUnits } from '../services/queries';

export const OmniBot: CardDefinition = {
    id: 'c8',
    name: 'Omni-Bot',
    rarity: 'Epic',
    baseCost: 3,
    basePower: 2,
    tags: ['Ongoing', 'Buff'],
    baseText: 'On Going: +2 Power for each other card you have here.',
    effect: 'OmniBotEffect',
    imageUrl: getImg(8),
};

export const OmniBotEffect: OngoingEffectFunction = (state, laneIndex, slotIndex, source) => {
     const others = queryUnits(state, {
         laneIndex,
         owner: source.owner,
         excludeInstanceId: source.instanceId
     });
     
     if (others.length > 0) {
        addContinuousModifier(source, { source: source.def.name, value: others.length * 2, type: 'CONTINUOUS' });
     }
};
