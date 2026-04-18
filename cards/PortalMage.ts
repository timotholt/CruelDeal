
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { createCardInstance } from '../services/factories';
import { pickRandomCard } from '../services/queries';

export const PortalMage: CardDefinition = {
    id: 'c9',
    name: 'Portal Mage',
    rarity: 'Legendary',
    baseCost: 4,
    basePower: 4,
    tags: ['OnReveal', 'Summon'],
    baseText: 'On Reveal: Add two random 1-cost cards here.',
    effect: 'PortalMageEffect',
    imageUrl: getImg(9),
};

export const PortalMageEffect: OnRevealEffect = (state, source, context) => {
    let s = state;
    const newCardIds: string[] = [];

    // 1. Create and Add Cards (Face Down)
    for (let i = 0; i < 2; i++) {
        const def = pickRandomCard(context.gameRegistry, { cost: 1 });
        if (def) {
            // Create instance (Default creation is faceUp=false for BOARD, but being explicit is good)
            const newCard = createCardInstance(def, source.owner, 'BOARD');
            newCard.faceUp = false; 
            newCard.created = true;
            
            // Use DI Action to place in lane
            s = context.actions.addCardToLane(s, newCard, context.laneIndex);
            
            // Track ID
            newCardIds.push(newCard.instanceId);
        }
    }

    // 2. Queue Reveal Tasks
    // We want the cards to reveal sequentially.
    // The executionQueue is a LIFO stack. 
    // If we want [Card 1 Reveal] then [Card 2 Reveal], 
    // we must Push [Reveal Card 2] then Push [Reveal Card 1].
    // Pop -> Reveal Card 1. Pop -> Reveal Card 2.
    // So we iterate in reverse order of the `newCardIds` array.
    
    newCardIds.reverse().forEach(id => {
        s.executionQueue.push({
            type: 'REVEAL_CARD',
            sourceId: id
        });
    });
    
    return s;
};
