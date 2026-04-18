
import React from 'react';
import { HexBadge } from './HexBadge';

interface SeasonProgressProps {
    level: number;
    progressPercent: number;
    xpText?: string;
    className?: string;
}

export const SeasonProgress: React.FC<SeasonProgressProps> = ({ 
    level, 
    progressPercent,
    xpText,
    className = ""
}) => {
    return (
        <div className={`flex items-center justify-center w-full max-w-[16rem] ${className}`}>
            <div className="relative flex items-center">
                {/* LEVEL BADGE */}
                <div className="relative z-20 -mr-3">
                    <HexBadge variant="primary" size="sm" glow>
                        {level}
                    </HexBadge>
                </div>

                {/* XP BAR CONTAINER - Tuned for balanced visibility */}
                <div className="h-5 w-48 bg-indigo-950/80 border border-indigo-400/40 rounded-full overflow-hidden shadow-[inset_0_1px_6px_rgba(0,0,0,0.7)] p-[1px] relative z-10">
                    {/* VIBRANT FILL */}
                    <div 
                        className="h-full bg-gradient-to-r from-indigo-700 via-indigo-400 to-purple-600 rounded-full relative transition-all duration-1000 ease-out"
                        style={{ 
                            width: `${progressPercent}%`,
                            boxShadow: '0 0 10px rgba(129, 140, 248, 0.4)' 
                        }}
                    >
                        {/* High-frequency shimmer */}
                        <div className="absolute inset-0 bg-white/5 animate-[pulse_3s_infinite]"></div>
                    </div>
                    
                    {xpText && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[0.55rem] font-black text-white/90 uppercase italic tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ml-2">
                                {xpText}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
