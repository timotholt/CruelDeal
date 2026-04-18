import { createSignal, createEffect, onCleanup } from 'solid-js';
import { CardDefinition } from '../types';
import { useUser } from '../contexts/UserContext';
import { useUI } from '../contexts/UIContext';

export interface CollectionDragState {
  card: CardDefinition;
  origin: 'archive' | 'vault';
  startPos: { x: number; y: number };
  currentPos: { x: number; y: number };
  offset: { x: number; y: number };
  rect: DOMRect;
  active: boolean;
}

interface UseCollectionDragProps {
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  scrollRef: () => HTMLElement;
  vaultRef: () => HTMLElement;
  archiveRef: () => HTMLElement;
}

// Gesture Constants
const DRAG_MOVE_THRESHOLD = 12; // Pixels moved before we definitely lock into 'Drag' mode
const SCROLL_MIN_THRESHOLD = 6;  // Pixels moved before we definitely lock into 'Scroll' mode
const PICKUP_DELAY = 220;       
const FRICTION = 0.95; 
const MIN_VELOCITY = 0.1;

/**
 * useCollectionDrag
 * Custom hook for high-performance drag and drop within the collection screens.
 * Handles gesture arbitration between scrolling and dragging.
 */
export const useCollectionDrag = (props: UseCollectionDragProps) => {
    const user = useUser();
    const ui = useUI();
    const [dragState, setDragState] = createSignal<CollectionDragState | null>(null);
    
    // Non-reactive internal state for performance and synchronous accuracy
    const state = {
        isScrolling: false,
        isDragging: false,
        isIntentLocked: false, 
        startPos: { x: 0, y: 0 },
        lastValidPos: { x: 0, y: 0 },
        startScrollTop: 0,
        hasCard: false,
        lastY: 0,
        lastTime: 0,
        velocity: 0,
        samples: [] as { dy: number, dt: number }[]
    };

    let inertiaFrame: number | null = null;
    let dragTarget: HTMLElement | null = null;
    let pickupTimer: number | null = null;

    const runInertia = () => {
        function step() {
            const el = props.scrollRef();
            if (!el) return;
            el.scrollTop -= state.velocity;
            state.velocity *= FRICTION;
            if (el.scrollTop <= 0 || el.scrollTop >= el.scrollHeight - el.clientHeight) state.velocity = 0;
            if (Math.abs(state.velocity) > MIN_VELOCITY) {
                inertiaFrame = requestAnimationFrame(step);
            } else {
                state.velocity = 0;
                inertiaFrame = null;
            }
        }
        step();
    };

    const stopInertia = () => {
        if (inertiaFrame !== null) {
            cancelAnimationFrame(inertiaFrame);
            inertiaFrame = null;
        }
    };

    const handlePointerDown = (
        e: PointerEvent, 
        card: CardDefinition | null,
        origin: 'archive' | 'vault'
    ) => {
        if (e.button !== 0) return;
        stopInertia();

        const target = e.currentTarget as HTMLElement;
        dragTarget = target;
        try { 
            // Lock all pointer events to this element until release
            target.setPointerCapture(e.pointerId); 
        } catch {
            // Silently fail if scroll container is not ready
        }

        const rect = target.getBoundingClientRect();
        const startPos = { x: e.clientX, y: e.clientY };
        
        const isOwned = user.user.collection.includes(card?.id || '');
        const inDeck = user.user.decks[user.user.activeDeckId]?.includes(card?.id || '');
        const canDrag = card && (origin === 'vault' || (isOwned && !inDeck));

        state.isScrolling = false;
        state.isDragging = false;
        state.isIntentLocked = false;
        state.startPos = startPos;
        state.lastValidPos = startPos;
        state.startScrollTop = props.scrollRef()?.scrollTop || 0;
        state.hasCard = !!card;
        state.lastY = e.clientY;
        state.lastTime = performance.now();
        state.velocity = 0;
        state.samples = [];

        setDragState({
            card: card || ({} as CardDefinition),
            origin,
            active: false,
            startPos,
            currentPos: startPos,
            rect,
            offset: card ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 },
        });

        if (canDrag) {
            pickupTimer = window.setTimeout(() => {
                state.isIntentLocked = true;
                // If we aren't scrolling, and enough time passed, we are likely dragging
                if (!state.isScrolling) {
                    state.isDragging = true;
                }
            }, PICKUP_DELAY);
        }
    };

    createEffect(() => {
        const ds = dragState();
        if (!ds) return;

        const handlePointerMove = (e: PointerEvent) => {
            const now = performance.now();
            const dt = now - state.lastTime;
            const deltaX = e.clientX - state.startPos.x;
            const deltaY = e.clientY - state.startPos.y;
            const moveDist = Math.hypot(deltaX, deltaY);

            state.lastValidPos = { x: e.clientX, y: e.clientY };

            if (dt > 0) {
                const dy = e.clientY - state.lastY;
                state.samples.push({ dy, dt });
                if (state.samples.length > 3) state.samples.shift();
                const totalDy = state.samples.reduce((sum, s) => sum + s.dy, 0);
                const totalDt = state.samples.reduce((sum, s) => sum + s.dt, 0);
                state.velocity = totalDy / (totalDt / 16.67);
                state.lastY = e.clientY;
                state.lastTime = now;
            }

            // GESTURE ARBITRATION
            if (!state.isScrolling && !state.isDragging) {
                // If they move primarily horizontal OR the pickup timer finished, it's a DRAG
                if (Math.abs(deltaX) > DRAG_MOVE_THRESHOLD || (state.isIntentLocked && moveDist > DRAG_MOVE_THRESHOLD)) {
                    state.isDragging = true;
                    if (pickupTimer) clearTimeout(pickupTimer);
                } 
                // If they move primarily vertical and intent isn't locked, it's a SCROLL
                else if (Math.abs(deltaY) > SCROLL_MIN_THRESHOLD && !state.isIntentLocked) {
                    state.isScrolling = true;
                    if (pickupTimer) clearTimeout(pickupTimer);
                }
            }

            if (state.isScrolling && props.scrollRef()) {
                props.scrollRef().scrollTop = state.startScrollTop - deltaY;
                return;
            }

            if (state.isDragging) {
                if (e.cancelable) e.preventDefault();
                if (!ds.active && moveDist > DRAG_MOVE_THRESHOLD) {
                    setDragState(prev => prev ? { ...prev, active: true } : null);
                }
                setDragState(prev => prev ? { ...prev, currentPos: { x: e.clientX, y: e.clientY } } : null);
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (pickupTimer) clearTimeout(pickupTimer);
            if (dragTarget) {
                try { dragTarget.releasePointerCapture(e.pointerId); } catch {
                    // Silently fail if pointer capture cannot be released
                }
                dragTarget = null;
            }

            const endX = e.type === 'pointercancel' ? state.lastValidPos.x : e.clientX;
            const endY = e.type === 'pointercancel' ? state.lastValidPos.y : e.clientY;
            const moveDist = Math.hypot(endX - state.startPos.x, endY - state.startPos.y);

            const isInside = (el: HTMLElement, x: number, y: number) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            };

            const dsNow = dragState();
            // RESOLVE INTERACTION
            if (state.isDragging && dsNow?.active && state.hasCard) {
                // Was definitely a drag
                if (dsNow.origin === 'archive' && isInside(props.vaultRef(), endX, endY)) {
                    props.onAdd(dsNow.card.id);
                } else if (dsNow.origin === 'vault' && isInside(props.archiveRef(), endX, endY)) {
                    props.onRemove(dsNow.card.id);
                }
            } 
            else if (!state.isScrolling && !state.isDragging && state.hasCard && dsNow) {
                // If the finger release happened within a small radius of the start,
                // and we didn't scroll or drag, it's a Tap.
                if (moveDist < DRAG_MOVE_THRESHOLD) {
                    ui.inspect(dsNow.card);
                }
            }

            // Final inertia scroll
            if (state.isScrolling && Math.abs(state.velocity) > MIN_VELOCITY) {
                requestAnimationFrame(runInertia);
            }

            setDragState(null);
            state.isScrolling = false;
            state.isDragging = false;
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        onCleanup(() => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        });
    });

    onCleanup(() => {
        if (pickupTimer) clearTimeout(pickupTimer);
        stopInertia();
    });

    return { dragState, handlePointerDown };
};
