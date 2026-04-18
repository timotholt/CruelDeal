
import React from 'react';

interface LevelHeroProps {
    level: number;
    gain: number;
    isTicking: boolean;
    isShifted: boolean;
    isFlare: boolean;
}

export const LevelHero: React.FC<LevelHeroProps> = React.memo(({ level, gain, isTicking, isShifted, isFlare }) => (
    <div className="shrink-0 pb-2 flex flex-col items-center relative overflow-visible w-full">
        <div className="relative w-full flex justify-center items-center h-14 overflow-visible">
            <div 
                className={`flex items-center gap-2 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isShifted ? '-translate-x-6' : 'translate-x-0'}`}
                style={{ willChange: 'transform' }}
            >
                {/* LABEL GROUP */}
                <div className="flex flex-col items-end text-right gap-0 opacity-80 shrink-0">
                    <span className="text-[0.45rem] font-bold tracking-[0.3em] text-white leading-none uppercase">Collection</span>
                    <span className="text-[0.5rem] font-black tracking-[0.3em] text-white leading-none uppercase">Level</span>
                </div>
                
                {/* NUMBER GROUP */}
                <div className="relative flex items-center overflow-visible shrink-0">
                    {/* Size reduced from 2.4rem to 1.6rem (~33% reduction) */}
                    <div className={`text-[1.6rem] font-black italic tracking-tighter text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] leading-none transition-all ${isTicking ? 'animate-intensity-pulse' : ''} ${isFlare ? 'animate-completion-flare' : ''}`}>
                        {level.toLocaleString()}
                    </div>
                    
                    {/* 
                        THE GAIN INDICATOR 
                        Strictly gated by isShifted to prevent immediate visibility on screen load.
                        Size reduced from 1.8rem to 1.2rem (~33% reduction).
                    */}
                    {isShifted && gain >= 0 && (
                        <div className="absolute left-full ml-3 flex items-center animate-gain-reveal">
                            <span className="text-[1.2rem] font-black italic tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] leading-none">
                                +{gain}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <style>{`
            @keyframes gain-reveal {
                from { opacity: 0; transform: translateX(1rem); }
                to { opacity: 1; transform: translateX(0); }
            }
            .animate-gain-reveal {
                animation: gain-reveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
        `}</style>
    </div>
));
