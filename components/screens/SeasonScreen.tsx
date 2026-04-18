import { createSignal, Show } from 'solid-js';
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

export const SeasonScreen = (props: SeasonScreenProps) => {
    const ui = useUI();
    const seasonPass = useSeasonPass();

    const [showPremiumModal, setShowPremiumModal] = createSignal(false);

    const level50Reward = () => (seasonPass.seasonPassData()?.rewards || []).find(r => r.level === 50);
    const heroCard = () => level50Reward()?.cardDef || seasonPass.seasonPassData()?.rewards?.[0]?.cardDef || CARDS[0];

    return (
        <Show 
            when={!seasonPass.isSeasonLoading() && seasonPass.seasonPassData() && seasonPass.seasonPassData()!.rewards} 
            fallback={
                <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/20 backdrop-blur-md">
                    <div class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <span class="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Syncing Sector Data...</span>
                </div>
            }
        >
            <div class="w-full h-full flex flex-col bg-transparent overflow-hidden relative font-sans">
                
                <SeasonThemeHUD 
                    themeName={seasonPass.seasonPassData()!.themeName}
                    timeLeft={seasonPass.timeLeft()}
                    isPremium={seasonPass.seasonPassData()!.premiumActive}
                    onDebugNext={seasonPass.actions.debugSwitchSeason}
                />

                <MasteryHeader 
                    title="Season Mastery"
                    level={seasonPass.progress().currentLevel}
                    progressPercent={seasonPass.progress().percent}
                    xpText={`${seasonPass.progress().currentXP} / ${seasonPass.progress().targetXP} XP`}
                />

                <div class="flex-1 flex-row overflow-hidden min-h-0 px-2 flex gap-x-3">
                    <SeasonHeroSection 
                        seasonCard={heroCard()}
                        variantName={seasonPass.seasonPassData()!.heroVariantName}
                        onInspect={ui.inspect}
                        onGoPremium={() => setShowPremiumModal(true)}
                    />

                    <div class="flex-1 flex flex-col min-w-0">
                        <SeasonRewardTrack 
                            rewards={seasonPass.seasonPassData()!.rewards}
                            currentXPPercent={seasonPass.progress().percent}
                            onInspect={ui.inspect}
                            isActiveView={props.activeScreen === 'SEASON'}
                        />
                    </div>
                </div>

                <PremiumPassModal 
                    isOpen={showPremiumModal()} 
                    onClose={() => setShowPremiumModal(false)} 
                />
            </div>
        </Show>
    );
};
