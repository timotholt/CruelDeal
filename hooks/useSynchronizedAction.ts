
import { useState, useCallback, useRef, useEffect } from 'react';

export type ActionStatus = 'idle' | 'processing' | 'success' | 'error';

interface UseSynchronizedActionProps {
    onAction: () => Promise<boolean>;
    holdDuration?: number;
    resetDelay?: number;
}

/**
 * useSynchronizedAction
 * Encapsulates the visual logic for a transaction.
 * Synchronizes component-local success state with context-level data commitment.
 */
export const useSynchronizedAction = ({ 
    onAction, 
    holdDuration = 0,
    resetDelay = 4000 
}: UseSynchronizedActionProps) => {
    const [status, setStatus] = useState<ActionStatus>('idle');
    const [holdProgress, setHoldProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const timerRef = useRef<number | null>(null);

    const execute = useCallback(async () => {
        if (status !== 'idle') return;

        setStatus('processing');
        
        // The onAction call (performSynchronizedAction in Context) handles the delay internally.
        // It only resolves AFTER the theatrical window closes and the data is committed.
        const success = await onAction();

        if (success) {
            // Flip to success at the EXACT same time header updates and sound plays
            setStatus('success');
            
            // Auto-reset button state after user sees results
            setTimeout(() => {
                setStatus('idle');
                setHoldProgress(0);
            }, resetDelay);
        } else {
            // Revert on failure or insufficient funds
            setStatus('idle');
            setHoldProgress(0);
        }
    }, [onAction, status, resetDelay]);

    const cancelHold = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsHolding(false);
        if (status === 'idle') setHoldProgress(0);
    }, [status]);

    const startHold = useCallback(() => {
        if (status !== 'idle' || holdDuration <= 0) return;
        setIsHolding(true);
        const startTime = Date.now();
        
        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min((elapsed / holdDuration) * 100, 100);
            setHoldProgress(p);
            
            if (p >= 100) {
                cancelHold();
                execute();
            }
        }, 16);
    }, [status, holdDuration, execute, cancelHold]);

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    return {
        status,
        holdProgress,
        isHolding,
        execute: holdDuration > 0 ? undefined : execute, // Direct click if no hold
        bind: {
            onPointerDown: startHold,
            onPointerUp: cancelHold,
            onPointerLeave: cancelHold
        }
    };
};
