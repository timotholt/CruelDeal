import { Show } from 'solid-js';
import { Card } from '../Card';
import { SlantedButton } from '../ui/SlantedButton';
import { CardDefinition } from '../../types';
import { AtmosphericGlow } from './AtmosphericGlow';
import { useUser } from '../../contexts/UserContext';
import { t } from '../../services/localization';

interface SeasonHeroSectionProps {
    seasonCard: CardDefinition;
    variantName?: string;
    onInspect: (card: CardDefinition, options?: { borderOverride?: string }) => void;
    onGoPremium: () => void;
}

export const SeasonHeroSection = (props: SeasonHeroSectionProps) => {
    const userContext = useUser();
    
    const isOwned = () => userContext.user.level >= 50;
    const isPremiumActive = () => userContext.seasonPassData()?.premiumActive ?? false;

    // Premium users get a warmer, more intense glow
    const glowColor = () => isPremiumActive() ? "165, 180, 252" : "99, 102, 241";

    return (
        <div class="w-[44%] h-full shrink-0 border-r border-white/5 overflow-hidden relative flex flex-col items-center justify-center px-1 pb-20">
            
            {/* HERO LIGHTING SYSTEM */}
            <AtmosphericGlow color={glowColor()} opacity={isPremiumActive() ? 0.6 : 0.4} />

            {/* SEASON EXCLUSIVE LABEL */}
            <div class="relative z-10 text-center w-full mb-[1.5em]">
                <h2 class="text-[0.75rem] font-black text-indigo-100 tracking-[0.25em] uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,1)] leading-tight italic">
                    {t('SEASON_EXCLUSIVE').split(' ').join('\n')}
                </h2>
            </div>

            {/* VARIANT BADGE */}
            <div class="relative z-30 mb-[0.5em]">
                <div class={`${isPremiumActive() ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-800 border-slate-600'} px-3 py-0.5 rounded-full border shadow-2xl transition-colors duration-1000 flex items-center justify-center`}>
                    <span class="text-[0.55rem] font-black text-white italic uppercase tracking-widest whitespace-nowrap drop-shadow-sm leading-none">
                        {props.variantName || "SEASON VARIANT"}
                    </span>
                </div>
            </div>

            {/* HERO ASSET */}
            <div 
                class="relative z-20 mb-[1.5em] cursor-pointer transition-transform active:scale-95 flex items-center justify-center group"
                onClick={() => props.onInspect(props.seasonCard, { borderOverride: 'white' })}
            >
                <div class={`transition-all duration-1000 ${isPremiumActive() ? 'drop-shadow-[0_0_4rem_rgba(165,180,252,0.8)]' : 'drop-shadow-[0_0_3.5rem_rgba(99,102,241,0.6)]'}`}>
                    <Card card={props.seasonCard} size="md" borderOverride="white" />
                </div>

                {/* Ownership Overlay */}
                <Show when={isOwned()}>
                    <div class="absolute inset-0 flex items-center justify-center z-40 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <div class="bg-emerald-500/90 backdrop-blur-sm text-slate-950 text-[0.8rem] font-black uppercase tracking-[0.4em] px-6 py-1 rotate-[-15deg] border-y-2 border-white shadow-2xl ring-2 ring-white/20">
                            OWNED
                        </div>
                    </div>
                </Show>
            </div>

            <div class="relative z-10 text-center w-full mb-[1em]">
                <h2 class="text-[0.65rem] font-black text-white/90 tracking-widest uppercase drop-shadow-md">
                    {t('SEASON_LVL_50')}
                </h2>
            </div>
            
            <div class="relative z-10 w-full flex justify-center px-2">
                <Show when={isOwned()} fallback={
                    <SlantedButton 
                        variant="warning" 
                        size="sm" 
                        class="w-full max-w-[8.5rem] shadow-2xl"
                        onClick={() => props.onGoPremium()}
                    >
                        <span class="text-[0.65rem] font-black tracking-tight leading-none uppercase">{t('SEASON_GO_PREMIUM')}</span>
                    </SlantedButton>
                }>
                    <div class="bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded skew-x-[-12deg] w-full max-w-[8.5rem] flex items-center justify-center">
                        <span class="text-[0.6rem] font-black text-emerald-400 italic uppercase tracking-widest skew-x-[12deg]">Achievement Unlocked</span>
                    </div>
                </Show>
            </div>
        </div>
    );
};
