import { Show } from 'solid-js';
import { PlayerID } from '../../types';
import { t } from '../../services/localization';

interface GameResultOverlayProps {
    winner: PlayerID | 'draw';
}

export const GameResultOverlay = (props: GameResultOverlayProps) => {
    
    const resultDetails = () => {
        let title = t('RESULT_DRAW');
        let subtitle = t('RESULT_TIE_GAME');
        let gradient = 'from-slate-400 to-slate-600';

        if (props.winner === 'p1') {
            title = t('RESULT_VICTORY');
            subtitle = t('RESULT_OPP_DEFEATED');
            gradient = 'from-yellow-400 to-amber-600';
        } else if (props.winner === 'p2') {
            title = t('RESULT_DEFEAT');
            subtitle = t('RESULT_SECTOR_LOST');
            gradient = 'from-red-500 to-red-700';
        }
        return { title, subtitle, gradient };
    };

    return (
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-pop touch-none">
            {/* Ambient Background Glow */}
            <div class={`absolute inset-0 opacity-20 bg-gradient-to-b ${resultDetails().gradient}`} />
            
            <div class="relative z-10 flex flex-col items-center">
                <h1 class={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b ${resultDetails().gradient} mb-2 drop-shadow-2xl tracking-tighter`}>
                    {resultDetails().title}
                </h1>
                
                <div class="w-full h-px bg-white/20 mb-4" />
                
                <div class="text-white/70 text-sm font-bold tracking-[0.2em] uppercase">
                    {resultDetails().subtitle}
                </div>

                <Show when={props.winner === 'p1'}>
                    <div class="mt-8 flex flex-col items-center animate-slide-up">
                        <div class="text-xs text-yellow-400 font-bold mb-1">{t('RESULT_REWARD')}</div>
                        <div class="bg-slate-900 border border-yellow-500/30 px-6 py-2 rounded-full flex items-center gap-2 shadow-xl">
                            <div class="w-4 h-4 rounded-full bg-blue-400 shadow-[0_0_0.625rem_rgba(96,165,250,0.8)]" />
                            <span class="font-black text-white text-lg">+24 {t('STORE_CREDITS')}</span>
                        </div>
                    </div>
                </Show>
            </div>

            <style>{`
                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
                    opacity: 0;
                }
            `}</style>
        </div>
    );
};