
import { GameState, EffectContext, ActionSet } from '../../types';
import { CARDS } from '../../constants';
import { cloneState, executeDestroy, addCardToHand, moveCard, addCardToLane, modifyPower, queueEvent } from '../mutations';
import { applyContinuousEffects } from '../statSystem';
import { findCardInState } from '../selectors';
import { resolveEffect } from '../effects';
import { queueAbility } from '../triggers';

// Internal helper to avoid circular dependency in ActionSet creation
const createActionSet = (): ActionSet => ({
    destroyCard: (s, id) => executeDestroy(s, id),
    addCardToHand: (s, c) => addCardToHand(s, c),
    moveCard: (s, id, t) => moveCard(s, id, t),
    addCardToLane: (s, c, l) => addCardToLane(s, c, l),
    modifyPower: (s, id, d, src) => modifyPower(s, id, d, src),
    recalcState: (s) => applyContinuousEffects(s),
    playSfx: (s, sfxId) => queueEvent(s, { type: 'SFX_PLAY', sfxId })
});

/**
 * Executes EXACTLY ONE task from the stack.
 * Used by the UI loop to provide visual pacing (wait between steps).
 */
export const stepExecutionQueue = (state: GameState): GameState => {
    let s = cloneState(state);
    
    if (s.executionQueue.length === 0) return s;

    // POP from the end (Top of Stack)
    const task = s.executionQueue.pop()!;

    switch (task.type) {
        case 'TRIGGER_ABILITY': {
            const lookup = findCardInState(s, task.sourceId);
            
            if (lookup) {
                const { card, laneIdx, slotIdx, owner, location } = lookup;
                
                const isDestroyTrigger = task.triggerTag === 'OnDestroy';
                const isDiscardTrigger = task.triggerTag === 'OnDiscard';
                
                let isValid: boolean;
                if (isDestroyTrigger) {
                    isValid = location === 'board' || location === 'destroyed';
                } else if (isDiscardTrigger) {
                    isValid = location === 'discard';
                } else {
                    isValid = location === 'board';
                }

                if (isValid) {
                    const ctx: EffectContext = {
                        player: owner,
                        laneIndex: laneIdx ?? 0, 
                        slotIndex: slotIdx ?? 0,
                        gameRegistry: CARDS,
                        actions: createActionSet() 
                    };

                    s = resolveEffect(card.def.effect, s, card, ctx);
                }
            }
            break;
        }

        case 'REVEAL_CARD': {
            const lookup = findCardInState(s, task.sourceId);
            
            // Only reveal if it's currently on the board
            if (lookup && lookup.location === 'board') {
                 const { card, laneIdx, slotIdx, owner } = lookup;
                 
                 // Only reveal if currently hidden (idempotency)
                 if (!card.faceUp) {
                     card.faceUp = true;
                     s = applyContinuousEffects(s);
                     
                     // Visuals
                     if (card.def.sfxOnReveal) {
                         s = queueEvent(s, { type: 'SFX_PLAY', sfxId: card.def.sfxOnReveal });
                     }
                     if (card.def.vfxOnReveal) {
                         s = queueEvent(s, { type: 'VFX_PLAY', vfxId: card.def.vfxOnReveal, laneIdx, slotIdx, playerId: owner });
                     }
                     
                     // Trigger Ability
                     // This pushes the TRIGGER_ABILITY task to the stack, 
                     // so it executes immediately after this task finishes (LIFO).
                     if (card.def.tags.includes('OnReveal')) {
                         s = queueAbility(s, card, 'OnReveal');
                     }
                     
                     s.history.push(`${card.def.name} was revealed (Summon).`);
                 }
            }
            break;
        }

        case 'EXECUTE_DISCARD': {
            const lookup = findCardInState(s, task.sourceId);
            if (lookup && lookup.location === 'hand') {
                    const { card, owner } = lookup;
                    const playerState = s.players[owner];
                    
                    playerState.hand = playerState.hand.filter(c => c.instanceId !== task.sourceId);
                    playerState.discardPile.push(card);

                    card.zone = 'DISCARDED';
                    s = queueEvent(s, { type: 'SFX_PLAY', sfxId: 'sfx_ui_click' });
                    s.history.push(`${card.def.name} was discarded.`);

                    // Support for Wolverine / Swarm style discard triggers
                    if (card.def.tags.includes('OnDiscard')) {
                        s = queueAbility(s, card, 'OnDiscard');
                    }
            }
            break;
        }

        case 'RUN_EFFECT': {
            const lookup = findCardInState(s, task.sourceId);
            if (lookup) {
                const { card, laneIdx, slotIdx, owner } = lookup;
                const ctx: EffectContext = {
                    player: owner,
                    laneIndex: laneIdx ?? 0, 
                    slotIndex: slotIdx ?? 0,
                    gameRegistry: CARDS,
                    actions: createActionSet(),
                    params: task.params
                };
                s = resolveEffect(task.effectId, s, card, ctx);
            }
            break;
        }
    }

    return applyContinuousEffects(s);
};

/**
 * Drains the entire queue synchronously. 
 * Use this for fast-forwarding or non-visual logic (like start of game).
 */
export const processExecutionQueue = (state: GameState): GameState => {
    let s = state;
    let ops = 0;
    const MAX_OPS = 100;

    while (s.executionQueue.length > 0 && ops < MAX_OPS) {
        s = stepExecutionQueue(s);
        ops++;
    }
    return s;
};
