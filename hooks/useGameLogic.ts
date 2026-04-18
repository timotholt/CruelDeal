
import { useTurnManager } from './useTurnManager';
import { useInputHandler } from './useInputHandler';
import { api } from '../services/api';
import { useUser } from '../contexts/UserContext';

export const useGameLogic = () => {
    const { user } = useUser();
    
    // 1. Game State & Phases
    const { 
        gameState, 
        events, 
        isResolving, 
        isWaiting, 
        setIsWaiting, 
        startResolution, 
        restartGame: engineRestart, 
        resign: engineResign 
    } = useTurnManager(user().id);

    // 2. Input & UI State
    const {
        pendingMoves,
        setPendingMoves,
        selectedCardIdx,
        setSelectedCardIdx,
        showUndoMenu,
        setShowUndoMenu,
        isResultsHidden,
        setIsResultsHidden,
        inspectingCard,
        setInspectingCard,
        inspectingLocation,
        setInspectingLocation,
        currentEnergy,
        handleCardClick,
        handleLaneClick,
        handleUndoAll,
        resetInput
    } = useInputHandler(gameState);

    // --- High Level Orchestration ---

    const handleEndTurn = async () => {
        const current = gameState();
        if (!current || current.phase !== 'planning' || isResolving() || isWaiting()) return;
        
        // Lock UI
        setIsWaiting(true);
        setShowUndoMenu(false);
        setSelectedCardIdx(null);

        try {
            // AUTHORITATIVE SUBMISSION
            // We no longer send the gameState. We only send our intents (moves).
            const response = await api.match.submit(user().id, pendingMoves());

            if (response.success && response.data) {
                const { opponentMoves } = response.data;
                // Proceed to Resolution (Client-side Replay/Simulation)
                startResolution(pendingMoves(), opponentMoves);
                setPendingMoves([]);
            } else {
                setIsWaiting(false);
            }
        } catch (e) {
            console.error("Failed to submit turn:", e);
            setIsWaiting(false);
        }
    };

    const restartGame = () => {
        engineRestart();
        resetInput();
    };

    const handleResign = () => {
        engineResign();
    };

    const onLocationClick = (laneIdx: number) => {
         if (isResolving() || isWaiting() || !gameState() || gameState()!.phase !== 'planning') return;
         handleLaneClick(laneIdx);
    };

    return {
        gameState,
        events,
        pendingMoves,
        setPendingMoves,
        isResolving,
        isWaiting,
        selectedCardIdx,
        setSelectedCardIdx,
        showUndoMenu,
        setShowUndoMenu,
        inspectingCard,
        setInspectingCard,
        inspectingLocation,
        setInspectingLocation,
        isResultsHidden,
        setIsResultsHidden,
        currentEnergy,
        restartGame,
        handleResign,
        handleEndTurn,
        handleUndoAll,
        handleCardClick,
        handleLocationClick: onLocationClick
    };
};
