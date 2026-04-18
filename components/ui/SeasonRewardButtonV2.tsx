import React from 'react';
import { HexBadge } from './HexBadge';
import { RewardItemVisual, SeasonRewardType } from './RewardItemVisual';
import { CardDefinition } from '../../types';

// Export type for convenience when using the button
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
    className?: string;
}

export const SeasonRewardButtonV2: React.FC<SeasonRewardButtonV2Props> = ({
    level,
    progressPercent,
    isClaimed,
    isActive,
    rewardType,
    rewardAmount,
    rewardImageUrl,
    cardDef,
    onClick,
    className = ""
}) => {
    // Fill logic: Claimed rewards are 100% full, active is partial, locked is 0
    const barWidth = isClaimed ? 100 : (isActive ? progressPercent : 0);
    
    // Unified 'Claimed' filter for solid objects
    const claimedFilter = "grayscale-[0.7] brightness-[0.6]";
    
    return (
        <div 
            className={`
                h-10 w-full relative flex items-center cursor-pointer select-none overflow-visible 
                transition-all duration-300 ease-out
                ${isActive ? 'z-20 drop-shadow-[0_0_12px_rgba(165,180,252,0.6)] scale-[1.02]' : 'z-0'}
                ${className}
            `}
            onClick={onClick}
        >
            <div className="flex items-center w-full relative h-full">
                
                {/* 1. LEVEL BADGE (z-50) */}
                <div className="relative z-50 -mr-4 shrink-0">
                    <HexBadge 
                        variant="primary" 
                        size="sm" 
                        glow={isActive}
                        className={isClaimed ? claimedFilter : ''}
                    >
                        {level}
                    </HexBadge>
                </div>

                {/* 2. PROGRESS TRACK (z-10) */}
                <div className={`
                    flex-1 h-5 bg-indigo-950/60 border border-indigo-400/40 rounded-full overflow-hidden shadow-black/40 relative z-10 transition-all duration-300
                    ${isClaimed ? claimedFilter : ''}
                `}>
                    
                    {/* XP BAR FILL */}
                    <div 
                        className={`h-full transition-all duration-700 bg-gradient-to-r from-indigo-700 via-indigo-400 to-purple-600`}
                        style={{ width: `${barWidth}%` }}
                    >
                        {isActive && <div className="absolute inset-0 bg-white/10 animate-[pulse_2s_infinite]" />}
                    </div>

                    {/* Progress Percentage Overlay */}
                    <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
                        <span className="text-[0.5rem] font-black italic tabular-nums text-white/50 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                            {isActive ? `${progressPercent}%` : (isClaimed ? '100%' : '')}
                        </span>
                    </div>
                </div>

                {/* 
                    3. REWARD VISUAL OVERLAY (z-30)
                */}
                <div className={`absolute inset-0 flex items-center justify-center z-30 pl-6 transition-all duration-300 ${isClaimed ? claimedFilter : ''}`}>
                    <RewardItemVisual 
                        type={rewardType} 
                        amount={rewardAmount} 
                        imageUrl={rewardImageUrl} 
                        level={level} 
                        cardDef={cardDef}
                    />
                </div>

                {/* 4. CLAIMED BANNER OVERLAY (z-40) */}
                {isClaimed && (
                    <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none pl-6">
                        <div className="bg-emerald-500 text-slate-950 text-[0.45rem] font-black uppercase tracking-[0.25em] px-3 py-0.5 rotate-[-10deg] border-y border-white shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105 ring-1 ring-white/20">
                            CLAIMED
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};