import React from 'react';
import { SeasonRewardInfo } from '../../contexts/UIContext';
import { RewardItemVisual } from '../ui/RewardItemVisual';
import { t } from '../../services/localization';

interface SeasonRewardInspectorProps {
    reward: SeasonRewardInfo;
}

export const SeasonRewardInspector: React.FC<SeasonRewardInspectorProps> = ({ reward }) => {
    const isClaimed = reward.isClaimed;

    return (
        <div className="flex flex-col items-center animate-pop">
            <div className={`mb-6 relative transition-all duration-500 ${isClaimed ? 'grayscale-[0.2] brightness-90' : ''}`}>
                <RewardItemVisual 
                    type={reward.rewardType as any}
                    amount={reward.rewardAmount}
                    level={reward.level}
                    size="xl"
                    cardDef={reward.cardDef}
                />
                
                {isClaimed && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <div className="bg-emerald-500 text-slate-950 text-[0.8rem] font-black uppercase tracking-[0.4em] px-8 py-1 rotate-[-12deg] border-y-2 border-white shadow-[0_0_30px_rgba(16,185,129,0.6)] ring-2 ring-white/30">
                            {t('UI_CLAIMED')}
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center max-w-[18rem]">
                <h2 className="text-2xl font-black italic tracking-tighter mb-2 uppercase leading-none drop-shadow-md text-white">
                    {isClaimed ? t('UI_CLAIMED') : `LEVEL ${reward.level} REWARD`}
                </h2>
                
                <div className={`w-full h-px mb-4 mx-auto max-w-[12rem] ${isClaimed ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                
                <p className="font-medium text-sm leading-relaxed px-4 italic text-white">
                    {isClaimed 
                        ? "This reward has already been added to your collection. Great work, Commander!" 
                        : "Continue climbing the Season Track to claim this reward."
                    }
                </p>
            </div>
        </div>
    );
};