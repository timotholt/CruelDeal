
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  scrollRef: React.RefObject<HTMLElement>;
  vaultRef: React.RefObject<HTMLElement>;
  archiveRef: React.RefObject<HTMLElement>;
}

// Gesture Constants
const DRAG_MOVE_THRESHOLD = 12; // Pixels moved before we definitely lock into 'Drag' mode
const SCROLL_MIN_THRESHOLD = 6;  // Pixels moved before we definitely lock into 'Scroll' mode
const PICKUP_DELAY = 220;       
const FRICTION = 0.95; 
const MIN_VELOCITY = 0.1;

export const useCollectionDrag = ({ onAdd, onRemove, scrollRef, vaultRef, archiveRef }: UseCollectionDragProps) => {
    const { user } = useUser();
    const { inspect } = useUI();
    const [dragState, setDragState] = useState<CollectionDragState | null>(null);
    
    const stateRef = useRef({
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
    });

    const inertiaFrameRef = useRef<number | null>(null);
    const dragTargetRef = useRef<HTMLElement | null>(null);
    const pickupTimerRef = useRef<number | null>(null);

    const runInertia = useCallback(() => {
        function step() {
            const el = scrollRef.current;
            if (!el) return;
            const g = stateRef.current;
            el.scrollTop -= g.velocity;
            g.velocity *= FRICTION;
            if (el.scrollTop <= 0 || el.scrollTop >= el.scrollHeight - el.clientHeight) g.velocity = 0;
            if (Math.abs(g.velocity) > MIN_VELOCITY) {
                inertiaFrameRef.current = requestAnimationFrame(step);
            } else {
                g.velocity = 0;
                inertiaFrameRef.current = null;
            }
        }
        step();
    }, [scrollRef]);

    const stopInertia = useCallback(() => {
        if (inertiaFrameRef.current !== null) {
            cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = null;
        }
    }, []);

    const handlePointerDown = useCallback((
        e: React.PointerEvent, 
        card: CardDefinition | null,
        origin: 'archive' | 'vault'
    ) => {
        if (e.button !== 0) return;
        stopInertia();

        const target = e.currentTarget as HTMLElement;
        dragTargetRef.current = target;
        try { 
            // Lock all pointer events to this element until release
            target.setPointerCapture(e.pointerId); 
        } catch {
            // Silently fail if scroll container is not ready
        }

        const rect = target.getBoundingClientRect();
        const startPos = { x: e.clientX, y: e.clientY };
        
        const isOwned = user.collection.includes(card?.id || '');
        const inDeck = user.decks[user.activeDeckId]?.includes(card?.id || '');
        const canDrag = card && (origin === 'vault' || (isOwned && !inDeck));

        stateRef.current = {
            isScrolling: false,
            isDragging: false,
            isIntentLocked: false,
            startPos,
            lastValidPos: startPos,
            startScrollTop: scrollRef.current?.scrollTop || 0,
            hasCard: !!card,
            lastY: e.clientY,
            lastTime: performance.now(),
            velocity: 0,
            samples: []
        };

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
            pickupTimerRef.current = window.setTimeout(() => {
                stateRef.current.isIntentLocked = true;
                // If we aren't scrolling, and enough time passed, we are likely dragging
                if (!stateRef.current.isScrolling) {
                    stateRef.current.isDragging = true;
                }
            }, PICKUP_DELAY);
        }
    }, [scrollRef, stopInertia, user]);

    useEffect(() => {
        if (!dragState) return;

        const handlePointerMove = (e: PointerEvent) => {
            const g = stateRef.current;
            const now = performance.now();
            const dt = now - g.lastTime;
            const deltaX = e.clientX - g.startPos.x;
            const deltaY = e.clientY - g.startPos.y;
            const moveDist = Math.hypot(deltaX, deltaY);

            g.lastValidPos = { x: e.clientX, y: e.clientY };

            if (dt > 0) {
                const dy = e.clientY - g.lastY;
                g.samples.push({ dy, dt });
                if (g.samples.length > 3) g.samples.shift();
                const totalDy = g.samples.reduce((sum, s) => sum + s.dy, 0);
                const totalDt = g.samples.reduce((sum, s) => sum + s.dt, 0);
                g.velocity = totalDy / (totalDt / 16.67);
                g.lastY = e.clientY;
                g.lastTime = now;
            }

            // GESTURE ARBITRATION
            if (!g.isScrolling && !g.isDragging) {
                // If they move primarily horizontal OR the pickup timer finished, it's a DRAG
                if (Math.abs(deltaX) > DRAG_MOVE_THRESHOLD || (g.isIntentLocked && moveDist > DRAG_MOVE_THRESHOLD)) {
                    g.isDragging = true;
                    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
                } 
                // If they move primarily vertical and intent isn't locked, it's a SCROLL
                else if (Math.abs(deltaY) > SCROLL_MIN_THRESHOLD && !g.isIntentLocked) {
                    g.isScrolling = true;
                    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
                }
            }

            if (g.isScrolling && scrollRef.current) {
                scrollRef.current.scrollTop = g.startScrollTop - deltaY;
                return;
            }

            if (g.isDragging) {
                if (e.cancelable) e.preventDefault();
                if (!dragState.active && moveDist > DRAG_MOVE_THRESHOLD) {
                    setDragState(prev => prev ? { ...prev, active: true } : null);
                }
                setDragState(prev => prev ? { ...prev, currentPos: { x: e.clientX, y: e.clientY } } : null);
            }
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
            if (dragTargetRef.current) {
                try { dragTargetRef.current.releasePointerCapture(e.pointerId); } catch {
                    // Silently fail if pointer capture cannot be released
                }
                dragTargetRef.current = null;
            }

            const g = stateRef.current;
            const endX = e.type === 'pointercancel' ? g.lastValidPos.x : e.clientX;
            const endY = e.type === 'pointercancel' ? g.lastValidPos.y : e.clientY;
            const moveDist = Math.hypot(endX - g.startPos.x, endY - g.startPos.y);

            const isInside = (ref: React.RefObject<HTMLElement>, x: number, y: number) => {
                if (!ref.current) return false;
                const rect = ref.current.getBoundingClientRect();
                return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            };

            // RESOLVE INTERACTION
            if (g.isDragging && dragState.active && g.hasCard) {
                // Was definitely a drag
                if (dragState.origin === 'archive' && isInside(vaultRef, endX, endY)) {
                    onAdd(dragState.card.id);
                } else if (dragState.origin === 'vault' && isInside(archiveRef, endX, endY)) {
                    onRemove(dragState.card.id);
                }
            } 
            else if (!g.isScrolling && !g.isDragging && g.hasCard) {
                // If the finger release happened within a small radius of the start,
                // and we didn't scroll or drag, it's a Tap.
                if (moveDist < DRAG_MOVE_THRESHOLD) {
                    inspect(dragState.card);
                }
            }

            // Final inertia scroll
            if (g.isScrolling && Math.abs(g.velocity) > MIN_VELOCITY) {
                inertiaFrameRef.current = requestAnimationFrame(runInertia);
            }

            setDragState(null);
            g.isScrolling = false;
            g.isDragging = false;
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: false });
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
        };
    }, [dragState, inspect, onAdd, onRemove, scrollRef, vaultRef, archiveRef, runInertia]);

    return { dragState, handlePointerDown };
};
