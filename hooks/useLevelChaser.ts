import { createSignal, createEffect, onCleanup } from 'solid-js';
import { audio } from '../services/audio';
import { REWARD_SEQUENCE } from '../services/api/mockData';

const TICK_RATE = 70;
const LAP_PAUSE = 100;
const CLIMAX_DURATION = 3000; 
const INITIAL_STABILIZATION_DELAY = 1500;
const SHIFT_DURATION = 600; 
const SETTLE_DELAY = 500;

export const useLevelChaser = (targetLevel: () => number, increment: () => number, onComplete: () => void) => {
    const [isTicking, setIsTicking] = createSignal(increment() > 0);
    const [isWaitingToStart, setIsWaitingToStart] = createSignal(increment() > 0);
    const [isShifted, setIsShifted] = createSignal(false);
    const [visualLevel, setVisualLevel] = createSignal(targetLevel() - increment());
    const [visualGain, setVisualGain] = createSignal(increment());
    const [lappingIndices, setLappingIndices] = createSignal<Set<number>>(new Set());
    const [isFlare, setIsFlare] = createSignal(false);

    createEffect(() => {
        const inc = increment();
        if (inc > 0) {
            let active = true;
            setIsTicking(true);
            setIsWaitingToStart(true);
            setVisualLevel(targetLevel() - inc);
            setVisualGain(inc);

            const sequence = async () => {
                await new Promise(resolve => setTimeout(resolve, INITIAL_STABILIZATION_DELAY));
                if (!active) return;
                
                setIsShifted(true);
                
                await new Promise(resolve => setTimeout(resolve, SHIFT_DURATION));
                if (!active) return;
                setIsWaitingToStart(false);
            };
            sequence();
            onCleanup(() => { active = false; });
        } else {
            setIsWaitingToStart(false);
            setIsTicking(false);
            setIsShifted(false);
            setVisualLevel(targetLevel());
            setVisualGain(0);
        }
    });

    createEffect(() => {
        if (isWaitingToStart()) return;

        const currentTicking = isTicking();
        const currentVisual = visualLevel();
        const currentTarget = targetLevel();

        if (!currentTicking || currentVisual >= currentTarget) {
            if (currentTicking) {
                setIsTicking(false);
                
                const finishSequence = async () => {
                    await new Promise(resolve => setTimeout(resolve, SETTLE_DELAY));
                    setIsShifted(false);
                    setIsFlare(true);
                    audio.play('sfx_victory', 0.6);
                    onComplete();
                    setTimeout(() => setIsFlare(false), CLIMAX_DURATION);
                };
                finishSequence();
            }
            return;
        }

        const nextLevel = currentVisual + 1;
        const newLaps = new Set<number>();
        
        REWARD_SEQUENCE.forEach((conf, i) => {
            if ((nextLevel + conf.offset) % conf.capacity === 0) {
                newLaps.add(i);
            }
        });

        const timer = setTimeout(() => {
            if (newLaps.size > 0) {
                setLappingIndices(newLaps);
                audio.play('sfx_ui_click', 1.4);
                setTimeout(() => setLappingIndices(new Set()), 100);
            }
            
            setVisualLevel(nextLevel);
            setVisualGain(prev => Math.max(0, prev - 1));
            audio.play('sfx_ui_hover', 0.3);
        }, TICK_RATE + (newLaps.size > 0 ? LAP_PAUSE : 0));

        onCleanup(() => clearTimeout(timer));
    });

    return {
        visualLevel,
        visualGain,
        isTicking: () => isTicking() && !isWaitingToStart(),
        isShifted,
        lappingIndices,
        isFlare
    };
};
