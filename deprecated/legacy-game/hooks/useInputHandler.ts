
import { createSignal } from 'solid-js';
import { PendingMove, calculateRemainingEnergy, canPlayCardToLane, canInteractWithCard } from '../services/planning';
import { GameState, CardDefinition, CardInstance, LocationDefinition } from '../types';

export const useInputHandler = (gameState: () => GameState | null) => {
    const [pendingMoves, setPendingMoves] = createSignal<PendingMove[]>([]);
    const [selectedCardIdx, setSelectedCardIdx] = createSignal<number | null>(null);
    const [showUndoMenu, setShowUndoMenu] = createSignal(false);
    const [isResultsHidden, setIsResultsHidden] = createSignal(false);
    const [inspectingCard, setInspectingCard] = createSignal<CardDefinition | CardInstance | null>(null);
    const [inspectingLocation, setInspectingLocation] = createSignal<LocationDefinition | null>(null);

    const resetInput = () => {
        setPendingMoves([]);
        setSelectedCardIdx(null);
        setInspectingCard(null);
        setInspectingLocation(null);
        setShowUndoMenu(false);
        setIsResultsHidden(false);
    };

    const handleCardClick = (idx: number, isDragging: boolean) => {
        const current = gameState();
        if (isDragging || !current || !current.players) return;
        
        const card = current.players.p1.hand[idx];
        if (!card) return;

        // Toggle logic: If clicking the same card, deselect
        if (selectedCardIdx() === idx) {
            setSelectedCardIdx(null);
            return;
        }

        // Only allow selection if affordable with *remaining* energy
        if (canInteractWithCard(current, pendingMoves(), card, { type: 'hand' })) {
            setSelectedCardIdx(idx);
        } else {
            setSelectedCardIdx(null);
        }
        
        // Show inspector
        setInspectingCard(card);
    };

    const handleLaneClick = (laneIdx: number) => {
        const current = gameState();
        if (selectedCardIdx() === null || !current || !current.players) return false;

        const card = current.players.p1.hand[selectedCardIdx()!];
        if (!card) return false;

        // Authoritative play check
        if (canPlayCardToLane(current, pendingMoves(), card.instanceId, laneIdx, { type: 'hand' })) {
            setPendingMoves(prev => [...prev, { cardInstanceId: card.instanceId, laneIdx }]);
            // Deselect after play to allow selecting next card
            setSelectedCardIdx(null); 
            setInspectingCard(null); 
            return true;
        }
        
        return false;
    };

    const handleUndoAll = () => {
        setPendingMoves([]);
        setShowUndoMenu(false);
        setSelectedCardIdx(null);
    };

    const currentEnergy = () => {
        const current = gameState();
        return current ? calculateRemainingEnergy(current, pendingMoves()) : 0;
    };

    return {
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
    };
};
