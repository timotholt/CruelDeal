
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CardInstance, CardDefinition, LocationDefinition, GameState } from '../types';
import { canInteractWithCard, canPlayCardToLane, PendingMove } from '../services/planning';

export interface DragState {
    active: boolean;
    card: CardInstance;
    origin: { type: 'hand', index: number } | { type: 'lane', laneIdx: number };
    startPos: { x: number, y: number };
    currentPos: { x: number, y: number };
    offset: { x: number, y: number };
    rect: DOMRect;
}

interface UseDragAndDropProps {
    gameState: GameState;
    pendingMoves: PendingMove[];
    isResolving: boolean;
    setPendingMoves: (moves: PendingMove[]) => void;
    setInspectingCard: (c: CardInstance | CardDefinition | null) => void;
    setInspectingLocation: (l: LocationDefinition | null) => void;
    setSelectedCardIdx: (i: number | null) => void;
    setShowUndoMenu: (b: boolean) => void;
    onDrop?: (success: boolean) => void;
}

export const useDragAndDrop = ({
    gameState,
    pendingMoves,
    isResolving,
    setPendingMoves,
    setInspectingCard,
    setInspectingLocation,
    setSelectedCardIdx,
    setShowUndoMenu,
    onDrop
}: UseDragAndDropProps) => {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const hasMovedRef = useRef(false);
    
    // Use a ref for pending moves to avoid stale closure during the move lifecycle
    const pendingMovesRef = useRef(pendingMoves);
    useEffect(() => {
        pendingMovesRef.current = pendingMoves;
    }, [pendingMoves]);

    const handleCardPointerDown = useCallback((
        e: React.PointerEvent, 
        card: CardInstance, 
        origin: { type: 'hand', index: number } | { type: 'lane', laneIdx: number }
    ) => {
        if (isResolving) return;

        // Check if interaction is allowed (Energy check happens here)
        if (!canInteractWithCard(gameState, pendingMovesRef.current, card, origin)) return;

        hasMovedRef.current = false;
        
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        setDragState({
            active: false, // Start as inactive until threshold is met
            card,
            origin,
            startPos: { x: e.clientX, y: e.clientY },
            currentPos: { x: e.clientX, y: e.clientY },
            offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
            rect
        });
    }, [gameState, isResolving]);

    useEffect(() => {
        if (!dragState) return;

        const handleMove = (e: PointerEvent) => {
            const dist = Math.sqrt(Math.pow(e.clientX - dragState.startPos.x, 2) + Math.pow(e.clientY - dragState.startPos.y, 2));
            
            // 8px threshold to start "active" dragging to distinguish from tap/inspect
            if (!dragState.active && dist > 8) {
                hasMovedRef.current = true;
                setDragState(prev => prev ? { ...prev, active: true, currentPos: { x: e.clientX, y: e.clientY } } : null);
                
                // Now we are sure it's a drag, lock other UI
                setSelectedCardIdx(null);
                setShowUndoMenu(false);
                setInspectingCard(null);
                setInspectingLocation(null);
            } else if (dragState.active) {
                setDragState(prev => prev ? { ...prev, currentPos: { x: e.clientX, y: e.clientY } } : null);
            }
        };

        const handleUp = (e: PointerEvent) => {
            if (!dragState) return;

            // If it never met the drag threshold, treat as a potential click/tap
            if (!hasMovedRef.current) {
                setDragState(null);
                return;
            }

            const elements = Array.from(document.elementsFromPoint(e.clientX, e.clientY));
            const laneZone = elements.find(el => el.getAttribute('data-drop-zone') === 'lane');
            const handZone = elements.find(el => el.getAttribute('data-drop-zone') === 'hand');

            let success = false;

            if (laneZone) {
                const laneIdx = parseInt(laneZone.getAttribute('data-lane-idx') || '0', 10);
                // Validate if dropping to this lane is possible (Capacity check)
                if (canPlayCardToLane(gameState, pendingMovesRef.current, dragState.card.instanceId, laneIdx, dragState.origin)) {
                    const existing = pendingMovesRef.current.filter(m => m.cardInstanceId !== dragState.card.instanceId);
                    setPendingMoves([...existing, { cardInstanceId: dragState.card.instanceId, laneIdx }]);
                    success = true;
                }
            } else if (handZone || (!laneZone && !handZone)) {
                // Return to hand if dropped in hand zone or empty space
                if (dragState.origin.type === 'lane') {
                    setPendingMoves(pendingMovesRef.current.filter(m => m.cardInstanceId !== dragState.card.instanceId));
                    success = true;
                }
            }

            onDrop?.(success);
            setDragState(null);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);

        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
        };
    }, [dragState, gameState, setPendingMoves, onDrop, setSelectedCardIdx, setShowUndoMenu, setInspectingCard, setInspectingLocation]);

    return {
        dragState,
        handleCardPointerDown
    };
};
