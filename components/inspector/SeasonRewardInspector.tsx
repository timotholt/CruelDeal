import { Show } from 'solid-js';
import { SeasonRewardInfo } from '../../contexts/UIContext';
import { RewardItemVisual } from '../ui/RewardItemVisual';
import { t } from '../../services/localization';

interface SeasonRewardInspectorProps {
    reward: SeasonRewardInfo;
}

export const SeasonRewardInspector = (props: SeasonRewardInspectorProps) => {
    return (
        <div class="flex flex-col items-center animate-pop">
            <div class={`mb-6 relative transition-all duration-500 ${props.reward.isClaimed ? 'grayscale-[0.2] brightness-90' : ''}`}>
                <RewardItemVisual 
                    type={props.reward.rewardType as any}
                    amount={props.reward.rewardAmount}
                    level={props.reward.level}
                    size="xl"
                    cardDef={props.reward.cardDef}
                />
                
                <Show when={props.reward.isClaimed}>
                    <div class="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div class="bg-emerald-500 text-slate-950 text-[0.8rem] font-black uppercase tracking-[0.4em] px-8 py-1 rotate-[-12deg] border-y-2 border-white shadow-[0_0_30px_rgba(16,185,129,0.6)] ring-2 ring-white/30">
                            {t('UI_CLAIMED')}
                        </div>
                    </div>
                </Show>
            </div>

            <div class="text-center max-w-[18rem]">
                <h2 class="text-2xl font-black italic tracking-tighter mb-2 uppercase leading-none drop-shadow-md text-white">
                    {props.reward.isClaimed ? t('UI_CLAIMED') : `LEVEL ${props.reward.level} REWARD`}
                </h2>
                
                <div class={`w-full h-px mb-4 mx-auto max-w-[12rem] ${props.reward.isClaimed ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                
                <p class="font-medium text-sm leading-relaxed px-4 italic text-white">
                    {props.reward.isClaimed 
                        ? "This reward has already been added to your collection. Great work, Commander!" 
                        : "Continue climbing the Season Track to claim this reward."
                    }
                </p>
            </div>
        </div>
    );
};
