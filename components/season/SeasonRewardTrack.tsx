import React, { useRef, useEffect } from 'react';
import { SeasonPassReward } from '../../types';
import { SeasonRewardButtonV2 } from '../ui/SeasonRewardButtonV2';

interface SeasonRewardTrackProps {
    rewards: SeasonPassReward[];
    currentXPPercent: number;
    onInspect: (reward: any) => void;
    isActiveView: boolean;
}

export const SeasonRewardTrack: React.FC<SeasonRewardTrackProps> = ({ 
    rewards, 
    currentXPPercent, 
    onInspect,
    isActiveView
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeLevelRef = useRef<HTMLDivElement>(null);

    // Self-contained scroll management
    useEffect(() => {
        if (isActiveView) {
            const timer = setTimeout(() => {
                if (activeLevelRef.current && scrollContainerRef.current) {
                    const container = scrollContainerRef.current;
                    const activeItem = activeLevelRef.current;
                    const targetScroll = activeItem.offsetTop - (container.offsetHeight / 2) + (activeItem.offsetHeight / 2);
                    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [isActiveView]);

    return (
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto pl-3 pr-2 py-4 space-y-3 scrollbar-hide pb-24"
        >
            {rewards.map((reward) => (
                <div 
                    key={reward.level} 
                    ref={reward.isActive ? activeLevelRef : null}
                    className="relative w-full overflow-visible"
                >
                    <SeasonRewardButtonV2 
                        level={reward.level}
                        progressPercent={currentXPPercent}
                        isClaimed={reward.isClaimed}
                        isActive={reward.isActive}
                        isLocked={reward.isLocked}
                        rewardType={reward.type as any}
                        rewardAmount={reward.amount}
                        cardDef={reward.cardDef}
                        onClick={() => onInspect({
                            type: 'level_info',
                            level: reward.level,
                            rewardType: reward.type,
                            rewardAmount: reward.amount,
                            isClaimed: reward.isClaimed,
                            cardDef: reward.cardDef
                        })}
                    />
                </div>
            ))}
        </div>
    );
};