
import { GameState, CardInstance, CardDefinition, PlayerID } from '../types';

// --- Definition Queries (The Atlas) ---

export interface CardCriteria {
    cost?: number;
    power?: number;
    tags?: string[];
    rarity?: string;
    excludeIds?: string[];
}

/**
 * Filters the provided pool of CardDefinitions (the Atlas).
 */
export const queryCards = (pool: CardDefinition[], criteria: CardCriteria): CardDefinition[] => {
    if (!pool) return [];
    return pool.filter(def => {
        if (criteria.excludeIds?.includes(def.id)) return false;
        if (criteria.cost !== undefined && def.baseCost !== criteria.cost) return false;
        if (criteria.power !== undefined && def.basePower !== criteria.power) return false;
        if (criteria.rarity && def.rarity !== criteria.rarity) return false;
        if (criteria.tags && !criteria.tags.every(t => def.tags.includes(t))) return false;
        return true;
    });
};

/**
 * Picks a random card definition matching the criteria.
 */
export const pickRandomCard = (pool: CardDefinition[], criteria: CardCriteria): CardDefinition | null => {
    const matches = queryCards(pool, criteria);
    if (matches.length === 0) return null;
    return matches[Math.floor(Math.random() * matches.length)];
};

// --- Instance Queries (The Board/State) ---

export interface UnitCriteria {
    owner?: PlayerID;
    laneIndex?: number;
    location?: 'board' | 'hand'; // Default 'board' if undefined
    
    // Filters
    excludeInstanceId?: string;
    cost?: number; // Checks TOTAL cost (current game state)
    power?: number; // Checks TOTAL power
    tags?: string[];
}

/**
 * Finds CardInstances in the GameState matching the criteria.
 */
export const queryUnits = (state: GameState, criteria: UnitCriteria): CardInstance[] => {
    if (!state) return [];
    const candidates: CardInstance[] = [];

    // 1. Scope Selection
    const checkBoard = !criteria.location || criteria.location === 'board';
    const checkHand = criteria.location === 'hand';

    if (checkBoard && state.lanes) {
        state.lanes.forEach((lane, idx) => {
             // Optimization: Skip entire lanes if laneIndex specified
             if (criteria.laneIndex !== undefined && criteria.laneIndex !== idx) return;

             if (!criteria.owner || criteria.owner === 'p1') {
                 (lane.p1Slots || []).forEach(c => c && candidates.push(c));
             }
             if (!criteria.owner || criteria.owner === 'p2') {
                 (lane.p2Slots || []).forEach(c => c && candidates.push(c));
             }
        });
    }

    if (checkHand && state.players) {
        if (!criteria.owner || criteria.owner === 'p1') candidates.push(...(state.players.p1?.hand || []));
        if (!criteria.owner || criteria.owner === 'p2') candidates.push(...(state.players.p2?.hand || []));
    }

    // 2. Filtering
    return candidates.filter(c => {
        if (!c) return false;
        if (criteria.excludeInstanceId && c.instanceId === criteria.excludeInstanceId) return false;
        
        if (criteria.cost !== undefined && c.totalCost !== criteria.cost) return false;
        if (criteria.power !== undefined && c.totalPower !== criteria.power) return false;
        if (criteria.tags && !criteria.tags.every(t => c.def?.tags?.includes(t))) return false;

        return true;
    });
};
