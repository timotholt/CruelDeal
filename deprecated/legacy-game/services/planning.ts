
import { GameState, CardInstance } from '../types';
import { findCardInState } from './selectors';

export type PendingMove = { cardInstanceId: string, laneIdx: number };

/**
 * Calculates the remaining energy for P1 based on current game state and pending moves.
 */
export const calculateRemainingEnergy = (gameState: GameState | null, pendingMoves: PendingMove[]): number => {
    if (!gameState || !gameState.players) return 0;
    
    const usedEnergy = pendingMoves.reduce((sum, m) => {
        const lookup = findCardInState(gameState, m.cardInstanceId);
        return sum + (lookup ? lookup.card.totalCost : 0);
    }, 0);
    return Math.max(0, gameState.players.p1.energy - usedEnergy);
};

/**
 * Determines if a card interaction (drag start) is valid.
 */
export const canInteractWithCard = (
    gameState: GameState | null, 
    pendingMoves: PendingMove[], 
    card: CardInstance, 
    origin: { type: 'hand' | 'lane', laneIdx?: number }
): boolean => {
    if (!gameState) return false;
    
    // 1. Phase Check
    if (gameState.phase !== 'planning') return false;

    // 2. LIFO Check (Must be the top of the stack if on board)
    if (origin.type === 'lane') {
        const lastMove = pendingMoves[pendingMoves.length - 1];
        if (!lastMove || lastMove.cardInstanceId !== card.instanceId) return false;
    }

    // 3. Energy Check (If playing from hand)
    if (origin.type === 'hand') {
        const currentEnergy = calculateRemainingEnergy(gameState, pendingMoves);
        if (card.totalCost > currentEnergy) return false;
    }

    return true;
};

/**
 * Determines if a card can be dropped into a specific lane.
 * Authoritative check for both Drag-and-Drop and Tap-to-Play.
 */
export const canPlayCardToLane = (
    gameState: GameState | null,
    pendingMoves: PendingMove[],
    cardInstanceId: string,
    targetLaneIdx: number,
    origin: { type: 'hand' | 'lane', laneIdx?: number }
): boolean => {
    if (!gameState) return false;

    // 1. Energy Check (Only if moving from hand)
    if (origin.type === 'hand') {
        const lookup = findCardInState(gameState, cardInstanceId);
        if (!lookup) return false;
        
        const remainingEnergy = calculateRemainingEnergy(gameState, pendingMoves);
        // Strict energy check
        if (lookup.card.totalCost > remainingEnergy) return false;
    }

    // 2. Validation: Cannot move a pending card directly from one lane to another (simplification for UI)
    if (origin.type === 'lane' && origin.laneIdx !== targetLaneIdx) return false;

    // 3. Capacity Check
    const lane = gameState.lanes[targetLaneIdx];
    const usedSlots = lane.p1Slots.filter(s => s !== null).length;
    const pendingHere = pendingMoves.filter(m => m.laneIdx === targetLaneIdx).length;
    
    let effectivePendingHere = pendingHere;
    if (origin.type === 'lane' && origin.laneIdx === targetLaneIdx) {
        effectivePendingHere -= 1; // Don't delete the card we are currently holding
    }

    // Max 4 slots per lane
    if (usedSlots + effectivePendingHere >= 4) return false;

    return true;
};
