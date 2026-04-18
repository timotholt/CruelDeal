
import { GameState, CardInstance } from '../types';
import { getAbilityMultiplier } from './effectUtils';

/**
 * Generic Trigger System.
 * Queues an ability to be executed by the engine.
 * Handles logic for Multipliers (e.g. Locations, Relics).
 */
export const queueAbility = (
    state: GameState,
    card: CardInstance,
    triggerTag: string // e.g. 'OnReveal', 'OnDestroy', 'OnDiscard'
): GameState => {
    const s = state;

    // 1. Validation: Does card have the tag?
    if (!card.def.tags.includes(triggerTag)) {
        return s;
    }

    // 2. Determine Context & Multiplier
    // We use the LIVE state of the card.
    const laneIdx = card.laneIndex;
    const owner = card.owner;

    let multiplier = 1;
    
    // Only calculate multiplier if on board
    if (laneIdx !== null && laneIdx !== undefined && laneIdx >= 0) {
        multiplier = getAbilityMultiplier(s, laneIdx, owner, card, triggerTag);
    }

    // 3. Push to Execution Queue
    // In a Stack system, we push. If multiplier > 1, we push multiple times.
    // Pop 1: Resolves. Pop 2: Resolves. Correct.
    for (let i = 0; i < multiplier; i++) {
        s.executionQueue.push({
            type: 'TRIGGER_ABILITY',
            sourceId: card.instanceId,
            triggerTag: triggerTag // Passed for validation in engine
        });
    }

    return s;
};

/**
 * Scans the board for cards with the specified tag and queues their abilities.
 * Respects playOrder for sequence.
 * Used for StartOfTurn / EndOfTurn.
 */
export const queueTagTriggers = (state: GameState, tag: 'StartOfTurn' | 'EndOfTurn'): GameState => {
    let s = state;
    const cardsToTrigger: { card: CardInstance, playOrder: number }[] = [];

    // Scan all lanes
    s.lanes.forEach((lane) => {
        // P1 Slots
        lane.p1Slots.forEach((card) => {
            if (card && card.faceUp && card.def.tags.includes(tag)) {
                cardsToTrigger.push({ card, playOrder: card.playOrder ?? 0 });
            }
        });
        // P2 Slots
        lane.p2Slots.forEach((card) => {
            if (card && card.faceUp && card.def.tags.includes(tag)) {
                cardsToTrigger.push({ card, playOrder: card.playOrder ?? 0 });
            }
        });
    });

    // Sort by playOrder (1, 2, 3...)
    cardsToTrigger.sort((a, b) => a.playOrder - b.playOrder);

    // STACK LOGIC:
    // We want to process Card 1, then Card 2, then Card 3.
    // Stack is LIFO (Pop).
    // So we must Push Card 3, then Card 2, then Card 1.
    // Stack: [..., 3, 2, 1]
    // Pop -> 1. Pop -> 2. Pop -> 3.
    
    // Reverse the array before pushing to stack
    cardsToTrigger.reverse().forEach(({ card }) => {
        s = queueAbility(s, card, tag);
    });

    return s;
}
