import React from 'react';
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

export const SeasonHeroSection: React.FC<SeasonHeroSectionProps> = ({ 
    seasonCard, 
    variantName = "DEASODE VARIANT",
    onInspect, 
    onGoPremium 
}) => {
    const { user, seasonPassData } = useUser();
    
    const isOwned = user.level >= 50;
    const isPremiumActive = seasonPassData?.premiumActive ?? false;

    // Premium users get a warmer, more intense glow
    const glowColor = isPremiumActive ? "165, 180, 252" : "99, 102, 241";

    return (
        <div className="w-[44%] h-full shrink-0 border-r border-white/5 overflow-hidden relative flex flex-col items-center justify-center px-1 pb-20">
            
            {/* HERO LIGHTING SYSTEM */}
            <AtmosphericGlow color={glowColor} opacity={isPremiumActive ? 0.6 : 0.4} />

            {/* SEASON EXCLUSIVE LABEL */}
            <div className="relative z-10 text-center w-full mb-[1.5em]">
                <h2 className="text-[0.75rem] font-black text-indigo-100 tracking-[0.25em] uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,1)] leading-tight italic">
                    {t('SEASON_EXCLUSIVE').split(' ').join('\n')}
                </h2>
            </div>

            {/* VARIANT BADGE */}
            <div className="relative z-30 mb-[0.5em]">
                <div className={`${isPremiumActive ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-800 border-slate-600'} px-3 py-0.5 rounded-full border shadow-2xl transition-colors duration-1000`}>
                    <span className="text-[0.55rem] font-black text-white italic uppercase tracking-widest whitespace-nowrap drop-shadow-sm">
                        {variantName}
                    </span>
                </div>
            </div>

            {/* HERO ASSET */}
            <div 
                className="relative z-20 mb-[1.5em] cursor-pointer transition-transform active:scale-95 flex items-center justify-center group"
                onClick={() => onInspect(seasonCard, { borderOverride: 'white' })}
            >
                <div className={`transition-all duration-1000 ${isPremiumActive ? 'drop-shadow-[0_0_4rem_rgba(165,180,252,0.8)]' : 'drop-shadow-[0_0_3.5rem_rgba(99,102,241,0.6)]'}`}>
                    <Card card={seasonCard} size="md" borderOverride="white" />
                </div>

                {/* Ownership Overlay */}
                {isOwned && (
                    <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                        <div className="bg-emerald-500/90 backdrop-blur-sm text-slate-950 text-[0.8rem] font-black uppercase tracking-[0.4em] px-6 py-1 rotate-[-15deg] border-y-2 border-white shadow-2xl ring-2 ring-white/20">
                            OWNED
                        </div>
                    </div>
                )}
            </div>

            <div className="relative z-10 text-center w-full mb-[1em]">
                <h2 className="text-[0.65rem] font-black text-white/90 tracking-widest uppercase drop-shadow-md">
                    {t('SEASON_LVL_50')}
                </h2>
            </div>
            
            <div className="relative z-10 w-full flex justify-center px-2">
                {isOwned ? (
                    <div className="bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 rounded skew-x-[-12deg] w-full max-w-[8.5rem] flex items-center justify-center">
                        <span className="text-[0.6rem] font-black text-emerald-400 italic uppercase tracking-widest skew-x-[12deg]">Achievement Unlocked</span>
                    </div>
                ) : (
                    <SlantedButton 
                        variant="warning" 
                        size="sm" 
                        className="w-full max-w-[8.5rem] shadow-2xl"
                        onClick={onGoPremium}
                    >
                        <span className="text-[0.65rem] font-black tracking-tight leading-none uppercase">{t('SEASON_GO_PREMIUM')}</span>
                    </SlantedButton>
                )}
            </div>
        </div>
    );
};