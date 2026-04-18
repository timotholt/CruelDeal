
import { useGameLogic } from './useGameLogic';
import { useDragAndDrop } from './useDragAndDrop';
import { useEventSystem } from './useEventSystem';
import { CardDefinition, CardInstance, LocationDefinition } from '../types';
import { useUI } from '../contexts/UIContext';

export const useGameController = (onExit?: () => void) => {
    const logic = useGameLogic();
    const { inspect, closeInspector } = useUI();
    const eventSystem = useEventSystem(logic.events);

    const dnd = useDragAndDrop({
        gameState: logic.gameState,
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

    const handleCardClick = (idx: number, isDragging: boolean) => {
        const currentGameState = logic.gameState();
        if (isDragging || !currentGameState || !currentGameState.players) return;
        
        const card = currentGameState.players.p1.hand[idx];
        if (card) {
            eventSystem.playClick();
            // Trigger logic selection (handles energy/playability checks)
            logic.handleCardClick(idx, isDragging);
            // Always show inspection on explicit click regardless of phase
            inspect(card);
        }
    };

    const wrappedCloseInspector = () => {
        eventSystem.playClick();
        closeInspector();
        logic.setInspectingCard(null);
        logic.setInspectingLocation(null);
    };

    const wrappedInspectCard = (c: CardInstance | CardDefinition) => {
        eventSystem.playClick();
        inspect(c);
        logic.setInspectingCard(c);
    };

    const wrappedInspectLocation = (l: LocationDefinition) => {
        eventSystem.playClick();
        inspect(l);
        logic.setInspectingLocation(l);
    };

    const handleUndoAll = () => {
        eventSystem.playClick();
        logic.handleUndoAll();
    };

    const handleEndTurn = () => {
        eventSystem.playClick();
        logic.handleEndTurn();
    };

    const handleResign = () => {
        eventSystem.playClick();
        logic.handleResign();
    };

    const restartGame = () => {
        eventSystem.playClick();
        logic.restartGame();
    };

    const toggleResults = (val: boolean) => {
        eventSystem.playClick();
        logic.setIsResultsHidden(val);
    };

    const handleLocationClick = (laneIdx: number) => {
        if (logic.selectedCardIdx() !== null) eventSystem.playSnap();
        logic.handleLocationClick(laneIdx);
    };

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
            handleCardPointerDownHand: (e: PointerEvent, card: CardInstance, index: number) => 
                dnd.handleCardPointerDown(e, card, { type: 'hand', index }),
            handleCardPointerDownLane: (e: PointerEvent, card: CardInstance, laneIdx: number) => 
                dnd.handleCardPointerDown(e, card, { type: 'lane', laneIdx })
        }
    };
};
