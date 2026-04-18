
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';
import { findCardInState } from '../services/selectors';

export const Venom: CardDefinition = {
    id: 'c11',
    name: 'Venom',
    rarity: 'Epic',
    baseCost: 3,
    basePower: 3,
    tags: ['OnReveal', 'Destroy', 'Buff'],
    baseText: 'On Reveal: Destroy your other cards at this location. Add their Power to this card.',
    effect: 'VenomEffect',
    imageUrl: getImg(11),
    // sfxOnReveal removed: Sound is now handled inside the effect to support multiple triggers (e.g. Nebula)
};

export const VenomEffect: OnRevealEffect = (state, source, context) => {
    // 0. Play Sound (Explicitly here so it plays every time the effect triggers)
    const s = context.actions.playSfx(state, 'sfx_grenade_explode');

    // 1. Identify Initial Targets
    const initialTargets = queryUnits(s, {
        laneIndex: context.laneIndex,
        owner: source.owner,
        excludeInstanceId: source.instanceId
    });
    
    // 2. Queue Bite Tasks (STACK Approach)
    // We want to eat Target A, then Target B.
    // Stack: [B, A]. Pop -> A. Pop -> B.
    // So we must push B, then push A.
    
    initialTargets.reverse().forEach(target => {
        s.executionQueue.push({
            type: 'RUN_EFFECT',
            effectId: 'VenomEatEffect',
            sourceId: source.instanceId,
            params: { targetId: target.instanceId }
        });
    });

    return s;
};

export const VenomEatEffect: OnRevealEffect = (state, source, context) => {
    const targetId = context.params?.targetId;
    if (!targetId) return state;

    let s = state;

    // 1. Recalculate State (Important: Ensure buffs from previous victims are gone or applied)
    s = context.actions.recalcState(s);

    // 2. Find Target
    const targetLookup = findCardInState(s, targetId);
    
    // 3. Check if target is still valid (on board)
    if (targetLookup && targetLookup.location === 'board') {
        const powerToAbsorb = targetLookup.card.totalPower;
        
        // 4. Venom Absorb
        s = context.actions.modifyPower(s, source.instanceId, powerToAbsorb, 'Venom Absorb');
        
        // 5. Destroy Target (Might trigger OnDestroy, pushing to Stack)
        s = context.actions.destroyCard(s, targetId);
    }
    
    return s;
};
