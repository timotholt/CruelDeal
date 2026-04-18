import { Motion } from "@motionone/solid";
import { getColors } from './progressionUtils';
import { ProgressionRewardType } from '../../types';

interface ProgressionProgressBarProps {
    type: ProgressionRewardType;
    currentXP: number;
    targetXP: number;
    isLapping: boolean;
}

export const ProgressionProgressBar = (props: ProgressionProgressBarProps) => {
    const styles = () => getColors(props.type);
    const percent = () => (props.currentXP / props.targetXP) * 100;

    return (
        <div class={`
            flex-1 h-[1.7rem] ${styles().bgTrack} border-2 border-white/20 border-r-0 rounded-l-full overflow-hidden shadow-inner relative
            ${props.isLapping ? 'ring-1 ring-white shadow-[0_0_10px_rgba(255,255,255,0.4)]' : ''}
        `}>
            <Motion.div 
                animate={{ width: `${props.isLapping ? 100 : percent()}%` }}
                transition={{ 
                    duration: props.currentXP === 0 ? 0 : 0.1, 
                    easing: [0.16, 1, 0.3, 1] 
                }}
                class={`h-full bg-gradient-to-r ${styles().color}`}
            />
            
            <div class="absolute inset-0 flex items-center justify-end pr-4 py-0 pointer-events-none">
                <span class="text-[0.8rem] text-white font-black italic tracking-wider drop-shadow-md tabular-nums">
                    {props.isLapping ? props.targetXP : props.currentXP} / {props.targetXP} CL
                </span>
            </div>
        </div>
    );
};
