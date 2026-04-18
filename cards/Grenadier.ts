
import { CardDefinition } from '../types';
import { getImg } from '../utils/assets';
import { OnRevealEffect } from '../types';
import { queryUnits } from '../services/queries';

export const Grenadier: CardDefinition = {
  id: 'c2',
  name: 'Grenadier',
  rarity: 'Common',
  baseCost: 1,
  basePower: 1,
  tags: ['OnReveal', 'Destroy'],
  baseText: 'On Reveal: Destroy a random 1-cost card at this location.',
  effect: 'GrenadierEffect',
  imageUrl: getImg(2),
  
  // Assets
  sfxOnPlay: 'sfx_equip_light',
  sfxOnReveal: 'sfx_grenade_explode',
  vfxOnReveal: 'vfx_explosion_small',
};

export const GrenadierEffect: OnRevealEffect = (state, source, context) => {
    // Find all 1-cost cards at this location (excluding self)
    const targets = queryUnits(state, {
        laneIndex: context.laneIndex,
        cost: 1,
        excludeInstanceId: source.instanceId
    });
    
    if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        // Use DI Action
        return context.actions.destroyCard(state, target.instanceId);
    }
    return state;
};
