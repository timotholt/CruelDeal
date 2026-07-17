
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { GameState, GameEvent } from '../types';
import { moveCardsToBoard, getNextReveal, revealCard, resolveEndOfTurn, startNextTurn, calculateWinner, stepExecutionQueue } from '../services/engine';
import { PendingMove } from '../services/planning';
import { api } from '../services/api';

export const useTurnManager = (userId: string) => {
    const [gameState, setGameState] = createSignal<GameState | null>(null);
    const [events, setEvents] = createSignal<GameEvent[]>([]);
    const [isResolving, setIsResolving] = createSignal(false);
    const [isWaiting, setIsWaiting] = createSignal(false);
    
    // Authorization: Client fetches authoritative state from Server
    createEffect(() => {
        const uid = userId;
        const initMatch = async () => {
            const res = await api.match.start(uid);
            if (res.success && res.data) {
                setGameState(res.data);
            }
        };
        initMatch();
    });

    const updateStateWithEvents = (newState: GameState) => {
        if (newState.eventQueue.length > 0) {
             const newEvents = [...newState.eventQueue];
             newState.eventQueue = [];
             setEvents(prev => [...prev, ...newEvents]);
        }
        setGameState({ ...newState }); 
    };

    const startResolution = (p1Moves: PendingMove[], p2Moves: PendingMove[]) => {
        const current = gameState();
        if (!current) return;
        setIsWaiting(false);
        const newState = moveCardsToBoard(current, p1Moves, p2Moves);
        newState.phase = 'resolving';
        updateStateWithEvents(newState);
        setIsResolving(true);
    };

    createEffect(() => {
        if (!isResolving()) return;

        let active = true;
        let timerId: ReturnType<typeof setTimeout>;

        const runLoop = async () => {
            if (!active) return;
            const currentState = gameState();
            if (!currentState) return;
            
            if (currentState.executionQueue.length > 0) {
                const prevDestroyed = currentState.players.p1.stats.destroyedCount + currentState.players.p2.stats.destroyedCount;
                const nextState = stepExecutionQueue(currentState);
                updateStateWithEvents(nextState);
                const newDestroyed = nextState.players.p1.stats.destroyedCount + nextState.players.p2.stats.destroyedCount;
                timerId = setTimeout(runLoop, newDestroyed > prevDestroyed ? 350 : 50);
                return;
            }

            const nextReveal = getNextReveal(currentState);
            if (nextReveal) {
                timerId = setTimeout(() => {
                    if (!active) return;
                    const s = revealCard(gameState()!, nextReveal.laneIdx, nextReveal.slotIdx, nextReveal.owner);
                    updateStateWithEvents(s);
                    runLoop(); 
                }, 600);
                return;
            }

            const s = resolveEndOfTurn(currentState);
            if (s.executionQueue.length > 0) {
                updateStateWithEvents(s);
                timerId = setTimeout(runLoop, 50); 
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
                    timerId = setTimeout(runLoop, 50);
                    return;
                }
                setIsResolving(false);
            }
        };

        timerId = setTimeout(runLoop, 100);
        
        onCleanup(() => {
            active = false;
            clearTimeout(timerId);
        });
    });

    const restartGame = async () => {
        setGameState(null);
        setEvents([]);
        setIsResolving(false);
        setIsWaiting(false);
        const res = await api.match.start(userId);
        if (res.success && res.data) setGameState(res.data);
    };

    const resign = () => {
        const current = gameState();
        if (!current || current.winner) return;
        setGameState({ ...current, winner: 'p2', phase: 'gameover' });
    };

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
