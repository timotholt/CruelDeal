
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';
import { findCardInState } from '../services/selectors';

export const Carnage: CardDefinition = {
    id: 'c13',
    name: 'Carnage',
    rarity: 'Epic',
    baseCost: 2,
    basePower: 2,
    tags: ['OnReveal', 'Destroy', 'Buff'],
    baseText: 'On Reveal: Destroy your other cards here. +2 Power for each destroyed.',
    effect: 'CarnageEffect',
    imageUrl: getImg(13),
    sfxOnPlay: 'sfx_equip_tech',
};

/**
 * Carnage On Reveal:
 * Identifies all friendly revealed cards at the location (excluding self)
 * and queues individual destruction tasks to ensure correct execution order.
 */
export const CarnageEffect: OnRevealEffect = (state, source, context) => {
    // 1. Identify valid targets: friendly, at this lane, NOT self, and must be faceUp (revealed)
    const targets = queryUnits(state, {
        laneIndex: context.laneIndex,
        owner: source.owner,
        excludeInstanceId: source.instanceId
    }).filter(c => c.faceUp);
    
    let s = state;

    // 2. Queue "Eat" tasks in reverse order for LIFO stack processing
    // We want the engine to process them one by one so "On Destroy" effects like Nova trigger correctly in between.
    [...targets].reverse().forEach(target => {
        s.executionQueue.push({
            type: 'RUN_EFFECT',
            effectId: 'CarnageEatEffect',
            sourceId: source.instanceId,
            params: { targetId: target.instanceId }
        });
    });

    if (targets.length > 0) {
        s = context.actions.playSfx(s, 'sfx_grenade_explode');
    }

    return s;
};

/**
 * Carnage Sub-routine:
 * Handles the destruction of a specific target and the subsequent buff to Carnage.
 */
export const CarnageEatEffect: OnRevealEffect = (state, source, context) => {
    const targetId = context.params?.targetId;
    if (!targetId) return state;

    let s = state;

    // 1. Recalculate to ensure we have the latest board state
    s = context.actions.recalcState(s);

    // 2. Verify target still exists and is on board (not destroyed by something else in the queue)
    const targetLookup = findCardInState(s, targetId);
    
    if (targetLookup && targetLookup.location === 'board' && targetLookup.card.faceUp) {
        // 3. Grant the +2 Power Buff
        s = context.actions.modifyPower(s, source.instanceId, 2, 'Carnage Hunger');
        
        // 4. Destroy the card
        s = context.actions.destroyCard(s, targetId);
    }
    
    return s;
};
