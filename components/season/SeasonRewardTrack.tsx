import { createEffect, onCleanup, For } from 'solid-js';
import { SeasonPassReward } from '../../types';
import { SeasonRewardButtonV2 } from '../ui/SeasonRewardButtonV2';

interface SeasonRewardTrackProps {
    rewards: SeasonPassReward[];
    currentXPPercent: number;
    onInspect: (reward: any) => void;
    isActiveView: boolean;
}

export const SeasonRewardTrack = (props: SeasonRewardTrackProps) => {
    let scrollContainerRef: HTMLDivElement | undefined;
    let activeLevelRef: HTMLDivElement | undefined;

    createEffect(() => {
        if (props.isActiveView) {
            const timer = setTimeout(() => {
                const container = scrollContainerRef;
                const activeItem = activeLevelRef;
                if (activeItem && container) {
                    const targetScroll = activeItem.offsetTop - (container.offsetHeight / 2) + (activeItem.offsetHeight / 2);
                    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
                }
            }, 600);
            onCleanup(() => clearTimeout(timer));
        }
    });

    return (
        <div 
            ref={(el) => scrollContainerRef = el}
            class="flex-1 overflow-y-auto pl-3 pr-2 py-4 space-y-3 scrollbar-hide pb-24"
        >
            <For each={props.rewards}>
                {(reward) => (
                    <div 
                        ref={(el) => { if (reward.isActive) activeLevelRef = el; }}
                        class="relative w-full overflow-visible"
                    >
                        <SeasonRewardButtonV2 
                            level={reward.level}
                            progressPercent={props.currentXPPercent}
                            isClaimed={reward.isClaimed}
                            isActive={reward.isActive}
                            isLocked={reward.isLocked}
                            rewardType={reward.type as any}
                            rewardAmount={reward.amount}
                            cardDef={reward.cardDef}
                            onClick={() => props.onInspect({
                                type: 'level_info',
                                level: reward.level,
                                rewardType: reward.type,
                                rewardAmount: reward.amount,
                                isClaimed: reward.isClaimed,
                                cardDef: reward.cardDef
                            })}
                        />
                    </div>
                )}
            </For>
        </div>
    );
};
