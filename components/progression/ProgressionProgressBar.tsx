
import React from 'react';
import { ProgressionRewardType } from '../../types';
import { getColors } from './progressionUtils';

interface ProgressionProgressBarProps {
    type: ProgressionRewardType;
    currentXP: number;
    targetXP: number;
    isLapping: boolean;
}

const ProgressionProgressBarComponent: React.FC<ProgressionProgressBarProps> = ({
    type,
    currentXP,
    targetXP,
    isLapping
}) => {
    const styles = getColors(type);
    const percent = (currentXP / targetXP) * 100;

    // Numerical bars shouldn't "rubber band" back to 0 when they lap.
    // Transition is disabled when resetting to 0 for a new lap.
    const isAtStart = percent === 0;
    const transitionClass = isAtStart 
        ? 'transition-none' 
        : 'transition-[width] duration-[200ms] ease-out';

    return (
        <div className={`
            flex-1 h-[1.7rem] ${styles.bgTrack} border-2 border-white/20 border-r-0 rounded-l-full overflow-hidden shadow-inner relative
            ${isLapping ? 'ring-1 ring-white shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''}
        `}>
            <div 
                className={`h-full bg-gradient-to-r ${styles.color} ${transitionClass}`} 
                style={{ width: `${isLapping ? 100 : percent}%` }} 
            />
            
            <div className="absolute inset-0 flex items-center justify-end pr-4 py-0 pointer-events-none">
                <span className="text-[0.8rem] text-white font-black italic tracking-wider drop-shadow-md tabular-nums">
                    {isLapping ? targetXP : currentXP} / {targetXP} CL
                </span>
            </div>
        </div>
    );
};

export const ProgressionProgressBar = React.memo(ProgressionProgressBarComponent);
