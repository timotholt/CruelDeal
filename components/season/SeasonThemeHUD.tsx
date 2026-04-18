import React from 'react';
import { PremiumHeaderBase } from '../ui/PremiumHeaderBase';
import { t } from '../../services/localization';

interface SeasonThemeHUDProps {
    themeName: string;
    timeLeft: { dd: string; hh: string; mm: string; ss: string };
    isPremium: boolean;
    onDebugNext: () => void;
}

export const SeasonThemeHUD: React.FC<SeasonThemeHUDProps> = ({ 
    themeName, 
    timeLeft, 
    isPremium, 
    onDebugNext 
}) => {
    return (
        <PremiumHeaderBase 
            className="pt-1 pb-2 px-2"
            innerClassName="flex-col"
        >
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <h1 className="text-[1rem] font-black text-white italic tracking-tighter uppercase drop-shadow-lg leading-none">
                        {themeName}
                    </h1>
                    <button 
                        onClick={onDebugNext}
                        className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[0.4rem] font-black text-slate-500 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest"
                    >
                        Debug: Next Season
                    </button>
                </div>
                
                {isPremium && (
                    <div className="flex items-center gap-1.5 bg-indigo-600/40 border border-indigo-300 px-2.5 py-0.5 rounded-sm shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                        <span className="text-[0.6rem] font-black text-white italic tracking-tighter">{t('SEASON_PREMIUM_TAG')}</span>
                    </div>
                )}
            </div>
            
            <div className="flex items-center justify-between w-full mt-1.5 px-0.5">
                <span className="text-[0.55rem] font-black text-slate-400 uppercase tracking-widest leading-none">{t('SEASON_TIMELINE')}</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-[0.45rem] font-black text-indigo-400 uppercase leading-none mr-0.5">{t('SEASON_ENDS_IN')}:</span>
                    <span className="text-[0.65rem] font-black text-white italic tabular-nums leading-none tracking-tight drop-shadow-md">
                        {timeLeft.dd}:{timeLeft.hh}:{timeLeft.mm}:{timeLeft.ss}
                    </span>
                </div>
            </div>
        </PremiumHeaderBase>
    );
};