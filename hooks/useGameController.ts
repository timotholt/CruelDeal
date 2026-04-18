
import React, { useCallback } from 'react';
import { useGameLogic } from './useGameLogic';
import { useDragAndDrop } from './useDragAndDrop';
import { useEventSystem } from './useEventSystem';
import { CardDefinition, CardInstance, LocationDefinition } from '../types';
// Fixed: Get inspector methods from useUI instead of useUser
import { useUI } from '../contexts/UIContext';

export const useGameController = (onExit?: () => void) => {
    const logic = useGameLogic();
    // Fixed: Get inspector methods from useUI instead of useUser
    const { inspect, closeInspector } = useUI();
    const eventSystem = useEventSystem(logic.events);

    const dnd = useDragAndDrop({
        gameState: logic.gameState!,
        pendingMoves: logic.pendingMoves,
        isResolving: logic.isResolving,
        setPendingMoves: logic.setPendingMoves,
        setInspectingCard: logic.setInspectingCard,
        setInspectingLocation: logic.setInspectingLocation,
        setSelectedCardIdx: logic.setSelectedCardIdx,
        setShowUndoMenu: logic.setShowUndoMenu,
        onDrop: (success) => {
            if (success) eventSystem.playSnap();
        }
    });

    const handleCardClick = useCallback((idx: number, isDragging: boolean) => {
        if (isDragging || !logic.gameState || !logic.gameState.players) return;
        
        const card = logic.gameState.players.p1.hand[idx];
        if (card) {
            eventSystem.playClick();
            // Trigger logic selection (handles energy/playability checks)
            // Note: handleCardClick in logic might still block selection if resolving
            logic.handleCardClick(idx, isDragging);
            // Always show inspection on explicit click regardless of phase
            inspect(card);
        }
    }, [eventSystem, logic, inspect]);

    const wrappedCloseInspector = useCallback(() => {
        eventSystem.playClick();
        closeInspector();
        logic.setInspectingCard(null);
        logic.setInspectingLocation(null);
    }, [eventSystem, closeInspector, logic]);

    const wrappedInspectCard = useCallback((c: CardInstance | CardDefinition) => {
        eventSystem.playClick();
        inspect(c);
        logic.setInspectingCard(c);
    }, [eventSystem, inspect, logic]);

    const wrappedInspectLocation = useCallback((l: LocationDefinition) => {
        eventSystem.playClick();
        inspect(l);
        logic.setInspectingLocation(l);
    }, [eventSystem, inspect, logic]);

    const handleUndoAll = useCallback(() => {
        eventSystem.playClick();
        logic.handleUndoAll();
    }, [eventSystem, logic]);

    const handleEndTurn = useCallback(() => {
        eventSystem.playClick();
        logic.handleEndTurn();
    }, [eventSystem, logic]);

    const handleResign = useCallback(() => {
        eventSystem.playClick();
        logic.handleResign();
    }, [eventSystem, logic]);

    const restartGame = useCallback(() => {
        eventSystem.playClick();
        logic.restartGame();
    }, [eventSystem, logic]);

    const toggleResults = useCallback((val: boolean) => {
        eventSystem.playClick();
        logic.setIsResultsHidden(val);
    }, [eventSystem, logic]);

    const handleLocationClick = useCallback((laneIdx: number) => {
        if (logic.selectedCardIdx !== null) eventSystem.playSnap();
        logic.handleLocationClick(laneIdx);
    }, [eventSystem, logic]);

    return {
        ...logic,
        dragState: dnd.dragState,
        activeVfx: eventSystem.activeVfx,
        actions: {
            handleCardClick,
            handleUndoAll,
            handleEndTurn,
            handleResign,
            restartGame,
            handleExit: () => { eventSystem.playClick(); onExit?.(); },
            toggleResults,
            closeInspector: wrappedCloseInspector,
            inspectCard: wrappedInspectCard,
            inspectLocation: wrappedInspectLocation,
            handleLocationClick,
            handleCardPointerDownHand: (e: React.PointerEvent, card: CardInstance, index: number) => 
                dnd.handleCardPointerDown(e, card, { type: 'hand', index }),
            handleCardPointerDownLane: (e: React.PointerEvent, card: CardInstance, laneIdx: number) => 
                dnd.handleCardPointerDown(e, card, { type: 'lane', laneIdx })
        }
    };
};
