
import { CardDefinition, CardInstance, CardRarity } from '../types';

export const RARITY_COLORS: Record<CardRarity, string> = {
    'Common': '#94a3b8',    // slate-400
    'Rare': '#60a5fa',      // blue-400
    'Epic': '#a855f7',      // purple-500
    'Legendary': '#f59e0b'  // amber-500
};

export const EFFECT_GLOWS: Record<string, string> = {
    'OnReveal': 'rgba(234, 179, 8, 0.4)',  // yellow
    'Ongoing': 'rgba(59, 130, 246, 0.4)',   // blue
    'Destroy': 'rgba(239, 68, 68, 0.4)',    // red
    'Move': 'rgba(168, 85, 247, 0.4)',      // purple
    'Discard': 'rgba(148, 163, 184, 0.4)',  // slate
    'Summon': 'rgba(16, 185, 129, 0.4)',    // emerald
};

export const getCardVisualState = (card: CardInstance | CardDefinition) => {
    const isInstance = (c: any): c is CardInstance => c && 'instanceId' in c;
    const def = isInstance(card) ? card.def : card;
    
    // Stats
    const currentPower = isInstance(card) ? card.totalPower : def.basePower;
    const currentCost = isInstance(card) ? card.totalCost : def.baseCost;
    
    const powerColor = currentPower > def.basePower ? 'text-emerald-400' : (currentPower < def.basePower ? 'text-red-400' : 'text-white');
    const costColor = currentCost < def.baseCost ? 'text-emerald-400' : (currentCost > def.baseCost ? 'text-red-400' : 'text-white');

    // Aesthetics
    const rarity = def.rarity || 'Common';
    const primaryColor = RARITY_COLORS[rarity];
    
    const effectTag = def.tags.find(t => EFFECT_GLOWS[t]);
    const glowColor = effectTag ? EFFECT_GLOWS[effectTag] : 'rgba(255,255,255,0.1)';

    return {
        def,
        currentPower,
        currentCost,
        powerColor,
        costColor,
        primaryColor,
        glowColor,
        rarity
    };
};
