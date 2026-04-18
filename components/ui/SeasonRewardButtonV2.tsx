import { Show } from 'solid-js';
import { HexBadge } from './HexBadge';
import { RewardItemVisual, SeasonRewardType } from './RewardItemVisual';
import { CardDefinition } from '../../types';

export type { SeasonRewardType };

interface SeasonRewardButtonV2Props {
    level: number;
    progressPercent: number; // 0-100
    isClaimed: boolean;
    isActive: boolean;
    rewardType: SeasonRewardType;
    rewardAmount?: string | number;
    rewardImageUrl?: string; // Optional: for mini card rendering
    cardDef?: CardDefinition; // Optional: full definition for level 50
    onClick: () => void;
    class?: string;
    isLocked?: boolean;
}

export const SeasonRewardButtonV2 = (props: SeasonRewardButtonV2Props) => {
    // Fill logic: Claimed rewards are 100% full, active is partial, locked is 0
    const barWidth = () => props.isClaimed ? 100 : (props.isActive ? props.progressPercent : 0);
    
    // Unified 'Claimed' filter for solid objects
    const claimedFilter = "grayscale-[0.7] brightness-[0.6]";
    
    return (
        <div 
            class={`
                h-10 w-full relative flex items-center cursor-pointer select-none overflow-visible 
                transition-all duration-300 ease-out
                ${props.isActive ? 'z-20 drop-shadow-[0_0_12px_rgba(165,180,252,0.6)] scale-[1.02]' : 'z-0'}
                ${props.class || ""}
            `}
            onClick={() => props.onClick()}
        >
            <div class="flex items-center w-full relative h-full">
                
                {/* 1. LEVEL BADGE (z-50) */}
                <div class="relative z-50 -mr-4 shrink-0">
                    <HexBadge 
                        variant="primary" 
                        size="sm" 
                        glow={props.isActive}
                        class={props.isClaimed ? claimedFilter : ''}
                    >
                        {props.level}
                    </HexBadge>
                </div>

                {/* 2. PROGRESS TRACK (z-10) */}
                <div class={`
                    flex-1 h-5 bg-indigo-950/60 border border-indigo-400/40 rounded-full overflow-hidden shadow-black/40 relative z-10 transition-all duration-300
                    ${props.isClaimed ? claimedFilter : ''}
                `}>
                    
                    {/* XP BAR FILL */}
                    <div 
                        class={`h-full transition-all duration-700 bg-gradient-to-r from-indigo-700 via-indigo-400 to-purple-600`}
                        style={{ width: `${barWidth()}%` }}
                    >
                        <Show when={props.isActive}>
                            <div class="absolute inset-0 bg-white/10 animate-[pulse_2s_infinite]" />
                        </Show>
                    </div>

                    {/* Progress Percentage Overlay */}
                    <div class="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
                        <span class="text-[0.5rem] font-black italic tabular-nums text-white/50 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                            {props.isActive ? `${props.progressPercent}%` : (props.isClaimed ? '100%' : '')}
                        </span>
                    </div>
                </div>

                {/* 
                    3. REWARD VISUAL OVERLAY (z-30)
                */}
                <div class={`absolute inset-0 flex items-center justify-center z-30 pl-6 transition-all duration-300 ${props.isClaimed ? claimedFilter : ''}`}>
                    <RewardItemVisual 
                        type={props.rewardType} 
                        amount={props.rewardAmount} 
                        imageUrl={props.rewardImageUrl} 
                        level={props.level} 
                        cardDef={props.cardDef}
                    />
                </div>

                {/* 4. CLAIMED BANNER OVERLAY (z-40) */}
                <Show when={props.isClaimed}>
                    <div class="absolute inset-0 flex items-center justify-center z-40 pointer-events-none pl-6">
                        <div class="bg-emerald-500 text-slate-950 text-[0.45rem] font-black uppercase tracking-[0.25em] px-3 py-0.5 rotate-[-10deg] border-y border-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105 ring-1 ring-white/20">
                            CLAIMED
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
