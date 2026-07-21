
import { GameState } from '../types';
import { PendingMove } from './planning';
import { calculateLanePower } from './selectors';

/**
 * DETERMINISTIC HEURISTIC AI (Zero Cost)
 * This AI simulates potential lane outcomes to make "smarter" choices
 * without requiring external API calls.
 */
export const generateAiMoves = (gameState: GameState): PendingMove[] => {
    const moves: PendingMove[] = [];
    const hand = [...gameState.players.p2.hand];
    let currentEnergy = gameState.players.p2.energy;

    // 1. Sort hand by "Efficiency" (Power per Cost)
    // We want to play cards that give us the most 'bang for buck'
    hand.sort((a, b) => (b.totalPower / (b.totalCost || 1)) - (a.totalPower / (a.totalCost || 1)));

    // 2. Evaluate Lanes
    const laneAnalysis = gameState.lanes.map((lane, idx) => {
        const p1Power = calculateLanePower(lane, 'p1', gameState);
        const p2Power = calculateLanePower(lane, 'p2', gameState);
        const diff = p2Power - p1Power;
        const p2SlotsUsed = lane.p2Slots.filter(s => s !== null).length;
        
        return {
            idx,
            diff,          // Negative means we are losing
            slotsOpen: 4 - p2SlotsUsed,
            isWinnable: p2SlotsUsed < 4,
            priorityScore: 0
        };
    });

    // 3. Assign Priority Scores to Lanes
    laneAnalysis.forEach(lane => {
        // Priority 1: Lanes where we are slightly losing (we want to flip them)
        if (lane.diff < 0 && lane.diff >= -5) lane.priorityScore = 10;
        // Priority 2: Lanes we are winning but it's close (we want to secure them)
        else if (lane.diff >= 0 && lane.diff <= 3) lane.priorityScore = 8;
        // Priority 3: Empty lanes or lanes where we are losing heavily
        else if (lane.diff < -5) lane.priorityScore = 5;
        // Priority 4: Already won lanes (low priority to over-commit)
        else lane.priorityScore = 2;

        // Penalty for almost full lanes
        if (lane.slotsOpen === 1) lane.priorityScore -= 2;
        if (lane.slotsOpen === 0) lane.priorityScore = -100;
    });

    // 4. Match Cards to Lanes
    for (const card of hand) {
        if (card.totalCost <= currentEnergy) {
            // Sort lanes by current priority score for THIS specific card
            const targetLanes = [...laneAnalysis]
                .filter(l => l.slotsOpen > 0)
                .sort((a, b) => b.priorityScore - a.priorityScore);

            if (targetLanes.length > 0) {
                const bestLane = targetLanes[0];
                
                moves.push({ cardInstanceId: card.instanceId, laneIdx: bestLane.idx });
                
                // Update local tracking for subsequent cards in the same turn
                currentEnergy -= card.totalCost;
                bestLane.slotsOpen--;
                // Increase power diff for that lane in our simulation
                bestLane.diff += card.totalPower;
                // Re-evaluate priority slightly so we don't put EVERY card in one lane if not needed
                bestLane.priorityScore -= 4; 
            }
        }
    }

    return moves;
};
