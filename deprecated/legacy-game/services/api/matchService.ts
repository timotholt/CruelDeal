
import { GameState } from '../../types';
import { PendingMove } from '../planning';
import { generateAiMoves } from '../ai';
import { simulateNetwork, verifySession, ApiError } from './apiUtils';
import { matchStore } from './mockDb';
import { createInitialGameState, moveCardsToBoard, getNextReveal, revealCard, resolveEndOfTurn, startNextTurn, calculateWinner, processExecutionQueue } from '../engine';

/**
 * AUTHORITATIVE MATCH SERVICE
 * This simulates a server-side game engine.
 * Rule: Never trust client input, only intents.
 */
export const matchService = {
    /**
     * Initialize a new authoritative match on the server.
     */
    async startMatch(userId: string): Promise<GameState> {
        verifySession(userId);
        await simulateNetwork(800, 1200);

        // 1. Authoritative Initialization
        const initialState = createInitialGameState();
        
        // 2. Persist in "Server" memory
        matchStore.authoritativeMatchState = initialState;

        return initialState;
    },

    /**
     * Submit turn moves for validation and AI response.
     * Note: Client NO LONGER sends gameState.
     */
    async submitTurn(userId: string, playerMoves: PendingMove[]): Promise<{ opponentMoves: PendingMove[] }> {
        verifySession(userId);
        await simulateNetwork(500, 800);

        const serverState = matchStore.authoritativeMatchState;
        if (!serverState) {
            throw new ApiError('ERR_NO_MATCH', 'Active match session not found on server.');
        }

        // 1. AUTHORITATIVE VALIDATION (The "Anti-Cheat" Layer)
        let usedEnergy = 0;
        playerMoves.forEach(move => {
            const card = serverState.players.p1.hand.find(c => c.instanceId === move.cardInstanceId);
            if (!card) {
                throw new ApiError('ERR_INVALID_MOVE', `Card ${move.cardInstanceId} is not in your authoritative hand.`);
            }
            usedEnergy += card.totalCost;

            const lane = serverState.lanes[move.laneIdx];
            const currentLaneCount = lane.p1Slots.filter(s => s !== null).length;
            if (currentLaneCount >= 4) {
                throw new ApiError('ERR_INVALID_MOVE', `Lane ${move.laneIdx} is already full on the server.`);
            }
        });

        if (usedEnergy > serverState.players.p1.energy) {
            throw new ApiError('ERR_INSUFFICIENT_ENERGY', 'Calculated energy spend exceeds server-side balance.');
        }

        // 2. AUTHORITATIVE SIMULATION
        // We generate AI moves using our PRIVATE server state
        const opponentMoves = generateAiMoves(serverState);

        // 3. SERVER-SIDE STATE UPDATE
        // Before returning to client, we update the server's version of the state
        // to match what the client will resolve. This ensures the NEXT turn 
        // validation is based on the correct board.
        
        let nextServerState = moveCardsToBoard(serverState, playerMoves, opponentMoves);
        
        // Simulate the resolution internally on the server to stay in sync
        // revealing cards, running effects, etc.
        let resolved = false;
        while (!resolved) {
            if (nextServerState.executionQueue.length > 0) {
                nextServerState = processExecutionQueue(nextServerState);
                continue;
            }
            const nextReveal = getNextReveal(nextServerState);
            if (nextReveal) {
                nextServerState = revealCard(nextServerState, nextReveal.laneIdx, nextReveal.slotIdx, nextReveal.owner);
                continue;
            }
            
            // End of turn logic
            nextServerState = resolveEndOfTurn(nextServerState);
            if (nextServerState.executionQueue.length > 0) continue;

            if (nextServerState.turn < nextServerState.maxTurns) {
                nextServerState = startNextTurn(nextServerState);
                resolved = true;
            } else {
                nextServerState.phase = 'gameover';
                nextServerState.winner = calculateWinner(nextServerState);
                resolved = true;
            }
        }

        matchStore.authoritativeMatchState = nextServerState;

        return { opponentMoves };
    }
};
