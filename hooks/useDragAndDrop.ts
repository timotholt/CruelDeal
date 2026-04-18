
import { createSignal, createEffect, onCleanup } from 'solid-js';
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
    gameState: () => GameState | null;
    pendingMoves: () => PendingMove[];
    isResolving: () => boolean;
    setPendingMoves: (moves: PendingMove[]) => void;
    setInspectingCard: (c: CardInstance | CardDefinition | null) => void;
    setInspectingLocation: (l: LocationDefinition | null) => void;
    setSelectedCardIdx: (i: number | null) => void;
    setShowUndoMenu: (b: boolean) => void;
    onDrop?: (success: boolean) => void;
}

export const useDragAndDrop = (props: UseDragAndDropProps) => {
    const [dragState, setDragState] = createSignal<DragState | null>(null);
    let hasMoved = false;

    const handleCardPointerDown = (
        e: PointerEvent, 
        card: CardInstance, 
        origin: { type: 'hand', index: number } | { type: 'lane', laneIdx: number }
    ) => {
        if (props.isResolving()) return;

        const currentGameState = props.gameState();
        if (!currentGameState) return;

        // Check if interaction is allowed (Energy check happens here)
        if (!canInteractWithCard(currentGameState, props.pendingMoves(), card, origin)) return;

        hasMoved = false;
        
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
    };

    createEffect(() => {
        const currentDrag = dragState();
        if (!currentDrag) return;

        const handleMove = (e: PointerEvent) => {
            const dist = Math.sqrt(Math.pow(e.clientX - currentDrag.startPos.x, 2) + Math.pow(e.clientY - currentDrag.startPos.y, 2));
            
            // 8px threshold to start "active" dragging to distinguish from tap/inspect
            if (!currentDrag.active && dist > 8) {
                hasMoved = true;
                setDragState(prev => prev ? { ...prev, active: true, currentPos: { x: e.clientX, y: e.clientY } } : null);
                
                // Now we are sure it's a drag, lock other UI
                props.setSelectedCardIdx(null);
                props.setShowUndoMenu(false);
                props.setInspectingCard(null);
                props.setInspectingLocation(null);
            } else if (currentDrag.active) {
                setDragState(prev => prev ? { ...prev, currentPos: { x: e.clientX, y: e.clientY } } : null);
            }
        };

        const handleUp = (e: PointerEvent) => {
            const drag = dragState();
            if (!drag) return;

            // If it never met the drag threshold, treat as a potential click/tap
            if (!hasMoved) {
                setDragState(null);
                return;
            }

            const elements = Array.from(document.elementsFromPoint(e.clientX, e.clientY));
            const laneZone = elements.find(el => el.getAttribute('data-drop-zone') === 'lane');
            const handZone = elements.find(el => el.getAttribute('data-drop-zone') === 'hand');

            let success = false;
            const currentGameState = props.gameState();

            if (laneZone && currentGameState) {
                const laneIdx = parseInt(laneZone.getAttribute('data-lane-idx') || '0', 10);
                // Validate if dropping to this lane is possible (Capacity check)
                if (canPlayCardToLane(currentGameState, props.pendingMoves(), drag.card.instanceId, laneIdx, drag.origin)) {
                    const existing = props.pendingMoves().filter(m => m.cardInstanceId !== drag.card.instanceId);
                    props.setPendingMoves([...existing, { cardInstanceId: drag.card.instanceId, laneIdx }]);
                    success = true;
                }
            } else if (handZone || (!laneZone && !handZone)) {
                // Return to hand if dropped in hand zone or empty space
                if (drag.origin.type === 'lane') {
                    props.setPendingMoves(props.pendingMoves().filter(m => m.cardInstanceId !== drag.card.instanceId));
                    success = true;
                }
            }

            props.onDrop?.(success);
            setDragState(null);
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointercancel', handleUp);

        onCleanup(() => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointercancel', handleUp);
        });
    });

    return {
        dragState,
        handleCardPointerDown
    };
};
