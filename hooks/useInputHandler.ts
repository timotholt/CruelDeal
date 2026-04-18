
import { useState } from 'react';
import { PendingMove, calculateRemainingEnergy, canPlayCardToLane, canInteractWithCard } from '../services/planning';
import { GameState, CardDefinition, CardInstance, LocationDefinition } from '../types';

export const useInputHandler = (gameState: GameState | null) => {
    const [pendingMoves, setPendingMoves] = useState<PendingMove[]>([]);
    const [selectedCardIdx, setSelectedCardIdx] = useState<number | null>(null);
    const [showUndoMenu, setShowUndoMenu] = useState(false);
    const [isResultsHidden, setIsResultsHidden] = useState(false);
    const [inspectingCard, setInspectingCard] = useState<CardDefinition | CardInstance | null>(null);
    const [inspectingLocation, setInspectingLocation] = useState<LocationDefinition | null>(null);

    const resetInput = () => {
        setPendingMoves([]);
        setSelectedCardIdx(null);
        setInspectingCard(null);
        setInspectingLocation(null);
        setShowUndoMenu(false);
        setIsResultsHidden(false);
    };

    const handleCardClick = (idx: number, isDragging: boolean) => {
        if (isDragging || !gameState || !gameState.players) return;
        
        const card = gameState.players.p1.hand[idx];
        if (!card) return;

        // Toggle logic: If clicking the same card, deselect
        if (selectedCardIdx === idx) {
            setSelectedCardIdx(null);
            return;
        }

        // Only allow selection if affordable with *remaining* energy
        if (canInteractWithCard(gameState, pendingMoves, card, { type: 'hand' })) {
            setSelectedCardIdx(idx);
        } else {
            setSelectedCardIdx(null);
        }
        
        // Show inspector
        setInspectingCard(card);
    };

    const handleLaneClick = (laneIdx: number) => {
        if (selectedCardIdx === null || !gameState || !gameState.players) return false;

        const card = gameState.players.p1.hand[selectedCardIdx];
        if (!card) return false;

        // Authoritative play check
        if (canPlayCardToLane(gameState, pendingMoves, card.instanceId, laneIdx, { type: 'hand' })) {
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

    const currentEnergy = gameState ? calculateRemainingEnergy(gameState, pendingMoves) : 0;

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
