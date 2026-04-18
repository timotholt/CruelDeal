import { Show } from 'solid-js';
import { PremiumHeaderBase } from '../ui/PremiumHeaderBase';
import { t } from '../../services/localization';

interface SeasonThemeHUDProps {
    themeName: string;
    timeLeft: { dd: string; hh: string; mm: string; ss: string };
    isPremium: boolean;
    onDebugNext: () => void;
}

export const SeasonThemeHUD = (props: SeasonThemeHUDProps) => {
    return (
        <PremiumHeaderBase 
            class="pt-1 pb-2 px-2"
            innerClass="flex-col"
        >
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-3">
                    <h1 class="text-[1rem] font-black text-white italic tracking-tighter uppercase drop-shadow-lg leading-none">
                        {props.themeName}
                    </h1>
                    <button 
                        onClick={() => props.onDebugNext()}
                        class="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[0.4rem] font-black text-slate-500 hover:text-white hover:bg-white/10 transition-colors uppercase tracking-widest"
                    >
                        Debug: Next Season
                    </button>
                </div>
                
                <Show when={props.isPremium}>
                    <div class="flex items-center gap-1.5 bg-indigo-600/40 border border-indigo-300 px-2.5 py-0.5 rounded-sm shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                        <div class="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse" />
                        <span class="text-[0.6rem] font-black text-white italic tracking-tighter">{t('SEASON_PREMIUM_TAG')}</span>
                    </div>
                </Show>
            </div>
            
            <div class="flex items-center justify-between w-full mt-1.5 px-0.5">
                <span class="text-[0.55rem] font-black text-slate-400 uppercase tracking-widest leading-none">{t('SEASON_TIMELINE')}</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-[0.45rem] font-black text-indigo-400 uppercase leading-none mr-0.5">{t('SEASON_ENDS_IN')}:</span>
                    <span class="text-[0.65rem] font-black text-white italic tabular-nums leading-none tracking-tight drop-shadow-md">
                        {props.timeLeft.dd}:{props.timeLeft.hh}:{props.timeLeft.mm}:{props.timeLeft.ss}
                    </span>
                </div>
            </div>
        </PremiumHeaderBase>
    );
};
