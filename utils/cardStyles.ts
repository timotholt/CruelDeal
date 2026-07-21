
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
    if (!card) return {
        def: { name: 'Unknown', imageUrl: '', rarity: 'Common', tags: [], id: '', basePower: 0, baseCost: 0, baseText: '', effect: '' } as CardDefinition,
        currentPower: 0,
        currentCost: 0,
        powerColor: 'text-white',
        costColor: 'text-white',
        primaryColor: RARITY_COLORS.Common,
        glowColor: 'rgba(255,255,255,0.1)',
        rarity: 'Common' as CardRarity
    };

    const isInstance = (c: any): c is CardInstance => c && typeof c === 'object' && 'instanceId' in c;
    const def = isInstance(card) ? card.def : card;

    if (!def || typeof def !== 'object' || !('name' in def)) return {
        def: { name: 'Unknown', imageUrl: '', rarity: 'Common', tags: [], id: '', basePower: 0, baseCost: 0, baseText: '', description: '', effect: '' } as CardDefinition,
        currentPower: 0,
        currentCost: 0,
        powerColor: 'text-white',
        costColor: 'text-white',
        primaryColor: RARITY_COLORS.Common,
        glowColor: 'rgba(255,255,255,0.1)',
        rarity: 'Common' as CardRarity
    };
    
    // Stats
    const currentPower = isInstance(card) ? card.totalPower : def.basePower;
    const currentCost = isInstance(card) ? card.totalCost : def.baseCost;
    
    const modifiersFor = (stat: 'cost' | 'power') => isInstance(card)
        ? (stat === 'cost' ? card.costModifiers : card.powerModifiers).filter(modifier => modifier.type !== 'BASE')
        : [];
    const colorFor = (stat: 'cost' | 'power') => {
        const modifiers = modifiersFor(stat);
        const hasModifier = modifiers.some(modifier => modifier.value !== 0);
        if (!hasModifier) return stat === 'cost' ? 'text-blue-400' : 'text-yellow-400';

        const hasHarmfulModifier = stat === 'cost'
            ? modifiers.some(modifier => modifier.value > 0)
            : modifiers.some(modifier => modifier.value < 0);
        return hasHarmfulModifier ? 'text-red-400' : 'text-emerald-400';
    };
    const powerColor = colorFor('power');
    const costColor = colorFor('cost');

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
