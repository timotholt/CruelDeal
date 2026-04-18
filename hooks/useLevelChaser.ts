
import { useState, useEffect } from 'react';
import { audio } from '../services/audio';
import { REWARD_SEQUENCE } from '../services/api/mockData';

const TICK_RATE = 70;
const LAP_PAUSE = 100;
const CLIMAX_DURATION = 3000; // Increased from 2000 to 3000 for longer decay
const INITIAL_STABILIZATION_DELAY = 1500;
const SHIFT_DURATION = 600; 
const SETTLE_DELAY = 500; // Hold on final number for 0.5s

export const useLevelChaser = (targetLevel: number, increment: number, onComplete: () => void) => {
    const [isTicking, setIsTicking] = useState(increment > 0);
    const [isWaitingToStart, setIsWaitingToStart] = useState(increment > 0);
    const [isShifted, setIsShifted] = useState(false);
    const [visualLevel, setVisualLevel] = useState(targetLevel - increment);
    const [visualGain, setVisualGain] = useState(increment);
    const [lappingIndices, setLappingIndices] = useState<Set<number>>(new Set());
    const [isFlare, setIsFlare] = useState(false);

    // 1. Orchestrated Sequence: Wait -> Shift -> Start Ticking
    useEffect(() => {
        if (increment > 0) {
            let active = true;
            const sequence = async () => {
                // Stage 1: Absolute Center Stabilization
                await new Promise(resolve => setTimeout(resolve, INITIAL_STABILIZATION_DELAY));
                if (!active) return;
                
                // Stage 2: Slide to left to make room for Gain
                setIsShifted(true);
                
                // Stage 3: Wait for animation, then begin numerical chase
                await new Promise(resolve => setTimeout(resolve, SHIFT_DURATION));
                if (!active) return;
                setIsWaitingToStart(false);
            };
            sequence();
            return () => { active = false; };
        } else {
            const timer = setTimeout(() => setIsWaitingToStart(false), 0);
            return () => clearTimeout(timer);
        }
    }, [increment]);

    // 2. The Ticking Loop
    useEffect(() => {
        if (isWaitingToStart) return;

        if (!isTicking || visualLevel >= targetLevel) {
            if (isTicking) {
                // We reached the end! 
                const timer = setTimeout(() => setIsTicking(false), 0);
                
                const finishSequence = async () => {
                    // Hold on the final number (0 gain)
                    await new Promise(resolve => setTimeout(resolve, SETTLE_DELAY));
                    
                    setIsShifted(false); // Slide back to perfect center
                    setIsFlare(true);
                    audio.play('sfx_victory', 0.6);
                    onComplete();
                    setTimeout(() => setIsFlare(false), CLIMAX_DURATION);
                };
                
                finishSequence();
                return () => clearTimeout(timer);
            }
            return;
        }

        const nextLevel = visualLevel + 1;
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

        return () => clearTimeout(timer);
    }, [isTicking, isWaitingToStart, visualLevel, targetLevel, onComplete]);

    return {
        visualLevel,
        visualGain,
        isTicking: isTicking && !isWaitingToStart,
        isShifted,
        lappingIndices,
        isFlare
    };
};
