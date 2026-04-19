import { createSignal, onCleanup, untrack } from 'solid-js';

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
export const useSynchronizedAction = (props: UseSynchronizedActionProps) => {
    const [status, setStatus] = createSignal<ActionStatus>('idle');
    const [holdProgress, setHoldProgress] = createSignal(0);
    const [isHolding, setIsHolding] = createSignal(false);
    let timerId: number | null = null;

    const holdDuration = () => props.holdDuration ?? 0;
    const resetDelay = () => props.resetDelay ?? 4000;

    const execute = async () => {
        if (status() !== 'idle') return;

        setStatus('processing');
        
        const success = await props.onAction();

        if (success) {
            setStatus('success');
            
            setTimeout(() => {
                setStatus('idle');
                setHoldProgress(0);
            }, resetDelay());
        } else {
            setStatus('idle');
            setHoldProgress(0);
        }
    };

    const cancelHold = () => {
        if (timerId !== null) clearInterval(timerId);
        timerId = null;
        setIsHolding(false);
        if (untrack(() => status()) === 'idle') setHoldProgress(0);
    };

    const startHold = () => {
        const dur = holdDuration();
        if (untrack(() => status()) !== 'idle' || dur <= 0) return;
        const onAction = props.onAction;
        const resetDelayVal = resetDelay();
        const setHP = setHoldProgress;
        const setS = setStatus;

        setIsHolding(true);
        const startTime = Date.now();
        const ANIM_DELAY = 250;
        
        timerId = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            
            // The visual bar only starts moving after ANIM_DELAY
            const visualElapsed = Math.max(0, elapsed - ANIM_DELAY);
            const remainingDur = Math.max(1, dur - ANIM_DELAY);
            const p = Math.min((visualElapsed / remainingDur) * 100, 100);
            
            setHP(p);
            
            // The actual interaction still completes at the full duration
            if (elapsed >= dur) {
                cancelHold();
                
                (async () => {
                   if (untrack(() => status()) !== 'idle') return;
                   setS('processing');
                   const success = await onAction();
                   if (success) {
                       setS('success');
                       setTimeout(() => {
                           setS('idle');
                           setHP(0);
                       }, resetDelayVal);
                   } else {
                       setS('idle');
                       setHP(0);
                   }
                })();
            }
        }, 16);
    };

    onCleanup(() => { if (timerId !== null) clearInterval(timerId); });

    return {
        status,
        holdProgress,
        isHolding,
        execute: () => holdDuration() > 0 ? undefined : execute(), // Return a function that calls execute
        actualExecute: execute,
        bind: {
            onPointerDown: startHold,
            onPointerUp: cancelHold,
            onPointerLeave: cancelHold
        }
    };
};
