import React from 'react';
import { PlayerID } from '../../types';
import { t } from '../../services/localization';

interface GameResultOverlayProps {
    winner: PlayerID | 'draw';
}

export const GameResultOverlay: React.FC<GameResultOverlayProps> = ({ winner }) => {
    
    let title = t('RESULT_DRAW');
    let subtitle = t('RESULT_TIE_GAME');
    let gradient = 'from-slate-400 to-slate-600';

    if (winner === 'p1') {
        title = t('RESULT_VICTORY');
        subtitle = t('RESULT_OPP_DEFEATED');
        gradient = 'from-yellow-400 to-amber-600';
    } else if (winner === 'p2') {
        title = t('RESULT_DEFEAT');
        subtitle = t('RESULT_SECTOR_LOST');
        gradient = 'from-red-500 to-red-700';
    }

    return (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-pop touch-none">
            {/* Ambient Background Glow */}
            <div className={`absolute inset-0 opacity-20 bg-gradient-to-b ${gradient}`}></div>
            
            <div className="relative z-10 flex flex-col items-center">
                <h1 className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b ${gradient} mb-2 drop-shadow-2xl tracking-tighter`}>
                    {title}
                </h1>
                
                <div className="w-full h-px bg-white/20 mb-4"></div>
                
                <div className="text-white/70 text-sm font-bold tracking-[0.2em] uppercase">
                    {subtitle}
                </div>

                {winner === 'p1' && (
                    <div className="mt-8 flex flex-col items-center animate-slide-up">
                        <div className="text-xs text-yellow-400 font-bold mb-1">{t('RESULT_REWARD')}</div>
                        <div className="bg-slate-900 border border-yellow-500/30 px-6 py-2 rounded-full flex items-center gap-2 shadow-xl">
                            <div className="w-4 h-4 rounded-full bg-blue-400 shadow-[0_0_0.625rem_rgba(96,165,250,0.8)]"></div>
                            <span className="font-black text-white text-lg">+24 {t('STORE_CREDITS')}</span>
                        </div>
                    </div>
                )}
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