
import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useSeasonPass } from '../../hooks/useSeasonPass';
import { MasteryHeader } from '../ui/SeasonMasteryHeader';
import { SeasonHeroSection } from '../season/SeasonHeroSection';
import { SeasonRewardTrack } from '../season/SeasonRewardTrack';
import { SeasonThemeHUD } from '../season/SeasonThemeHUD';
import { PremiumPassModal } from '../season/PremiumPassModal';
import { ScreenKey } from '../../types';
import { CARDS } from '../../constants';

interface SeasonScreenProps {
    activeScreen?: ScreenKey;
}

export const SeasonScreen: React.FC<SeasonScreenProps> = ({ activeScreen }) => {
    const { inspect } = useUI();
    const { 
        seasonPassData, 
        isSeasonLoading, 
        timeLeft, 
        progress, 
        actions 
    } = useSeasonPass();

    const [showPremiumModal, setShowPremiumModal] = useState(false);

    if (isSeasonLoading || !seasonPassData || !seasonPassData.rewards) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-md">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <span className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Syncing Sector Data...</span>
            </div>
        );
    }

    const level50Reward = (seasonPassData.rewards || []).find(r => r.level === 50);
    const heroCard = level50Reward?.cardDef || seasonPassData.rewards[0]?.cardDef || CARDS[0];

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative font-sans">
            
            <SeasonThemeHUD 
                themeName={seasonPassData.themeName}
                timeLeft={timeLeft}
                isPremium={seasonPassData.premiumActive}
                onDebugNext={actions.debugSwitchSeason}
            />

            <MasteryHeader 
                title="Season Mastery"
                level={progress.currentLevel}
                progressPercent={progress.percent}
                xpText={`${progress.currentXP} / ${progress.targetXP} XP`}
            />

            <div className="flex-1 flex-row overflow-hidden min-h-0 px-2 flex gap-x-3">
                <SeasonHeroSection 
                    seasonCard={heroCard}
                    variantName={seasonPassData.heroVariantName}
                    onInspect={inspect}
                    onGoPremium={() => setShowPremiumModal(true)}
                />

                <div className="flex-1 flex flex-col min-w-0">
                    <SeasonRewardTrack 
                        rewards={seasonPassData.rewards}
                        currentXPPercent={progress.percent}
                        onInspect={inspect}
                        isActiveView={activeScreen === 'SEASON'}
                    />
                </div>
            </div>

            <PremiumPassModal 
                isOpen={showPremiumModal} 
                onClose={() => setShowPremiumModal(false)} 
            />
        </div>
    );
};
