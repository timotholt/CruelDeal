
import { CardDefinition, CardInstance } from '../types';
import { getImg } from '../utils/assets';
import { generateInstanceId } from '../utils/id';
import { OnRevealEffect } from '../types';

export const Scout: CardDefinition = {
    id: 'c4',
    name: 'Scout',
    rarity: 'Common',
    baseCost: 1,
    basePower: 2,
    tags: ['OnReveal'],
    baseText: 'On Reveal: Add a +1 Power Copy of this card to your hand.',
    effect: 'ScoutEffect',
    imageUrl: getImg(4),
};

export const ScoutEffect: OnRevealEffect = (state, source, context) => {
    // Create the new instance data
    const newId = generateInstanceId();
    
    const newCard: CardInstance = {
        ...JSON.parse(JSON.stringify(source)),
        instanceId: newId,
        // Zone/Slot will be set by addCardToHand
        zone: 'HAND',
        laneIndex: null,
        slotIndex: null,
        faceUp: true,
        turnPlayed: null,
        powerModifiers: [...source.powerModifiers],
        costModifiers: [...source.costModifiers]
    };
    
    // Apply the specific Scout buff to the copy
    newCard.powerModifiers.push({ source: 'Scout Ability', value: 1, type: 'PERMANENT' });
    newCard.totalPower += 1;
    newCard.currentPower += 1;

    // Attempt to add to hand using DI Action
    return context.actions.addCardToHand(state, newCard);
};
