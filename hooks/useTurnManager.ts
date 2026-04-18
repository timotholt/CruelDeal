
import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameEvent } from '../types';
import { moveCardsToBoard, getNextReveal, revealCard, resolveEndOfTurn, startNextTurn, calculateWinner, stepExecutionQueue } from '../services/engine';
import { PendingMove } from '../services/planning';
import { api } from '../services/api';

export const useTurnManager = (userId: string) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [events, setEvents] = useState<GameEvent[]>([]);
    const [isResolving, setIsResolving] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    
    // Authorization: Client fetches authoritative state from Server
    useEffect(() => {
        const initMatch = async () => {
            const res = await api.match.start(userId);
            if (res.success && res.data) {
                setGameState(res.data);
            }
        };
        initMatch();
    }, [userId]);

    const gameStateRef = useRef(gameState);
    useEffect(() => { 
        gameStateRef.current = gameState; 
    }, [gameState]);

    const updateStateWithEvents = useCallback((newState: GameState) => {
        if (newState.eventQueue.length > 0) {
             const newEvents = [...newState.eventQueue];
             newState.eventQueue = [];
             setEvents(prev => [...prev, ...newEvents]);
        }
        setGameState(newState);
    }, []);

    const startResolution = useCallback((p1Moves: PendingMove[], p2Moves: PendingMove[]) => {
        if (!gameState) return;
        setIsWaiting(false);
        const newState = moveCardsToBoard(gameState, p1Moves, p2Moves);
        newState.phase = 'resolving';
        updateStateWithEvents(newState);
        setIsResolving(true);
    }, [gameState, updateStateWithEvents]);

    useEffect(() => {
        if (!isResolving) return;

        let active = true;

        const runLoop = async () => {
            if (!active || !gameStateRef.current) return;
            const currentState = gameStateRef.current;
            
            if (currentState.executionQueue.length > 0) {
                const prevDestroyed = currentState.players.p1.stats.destroyedCount + currentState.players.p2.stats.destroyedCount;
                const nextState = stepExecutionQueue(currentState);
                updateStateWithEvents(nextState);
                const newDestroyed = nextState.players.p1.stats.destroyedCount + nextState.players.p2.stats.destroyedCount;
                setTimeout(runLoop, newDestroyed > prevDestroyed ? 350 : 50);
                return;
            }

            const nextReveal = getNextReveal(currentState);
            if (nextReveal) {
                setTimeout(() => {
                    if (!active || !gameStateRef.current) return;
                    const s = revealCard(gameStateRef.current, nextReveal.laneIdx, nextReveal.slotIdx, nextReveal.owner);
                    updateStateWithEvents(s);
                    runLoop(); 
                }, 600);
                return;
            }

            const s = resolveEndOfTurn(currentState);
            if (s.executionQueue.length > 0) {
                updateStateWithEvents(s);
                setTimeout(runLoop, 50); 
                return;
            }
            
            let finalState = s;
            if (finalState.turn >= finalState.maxTurns) {
                finalState.phase = 'gameover';
                finalState.winner = calculateWinner(finalState);
                updateStateWithEvents(finalState);
                setIsResolving(false);
            } else {
                finalState = startNextTurn(finalState);
                updateStateWithEvents(finalState);
                if (finalState.executionQueue.length > 0) {
                    setTimeout(runLoop, 50);
                    return;
                }
                setIsResolving(false);
            }
        };

        const t = setTimeout(runLoop, 100);
        return () => {
            active = false;
            clearTimeout(t);
        };

    }, [isResolving, updateStateWithEvents]);

    const restartGame = useCallback(async () => {
        setGameState(null);
        setEvents([]);
        setIsResolving(false);
        setIsWaiting(false);
        const res = await api.match.start(userId);
        if (res.success && res.data) setGameState(res.data);
    }, [userId]);

    const resign = useCallback(() => {
        if (!gameState || gameState.winner) return;
        setGameState(prev => prev ? ({ ...prev, winner: 'p2', phase: 'gameover' }) : null);
    }, [gameState]);

    return {
        gameState,
        events,
        isResolving,
        isWaiting,
        setIsWaiting,
        startResolution,
        restartGame,
        resign
    };
};
