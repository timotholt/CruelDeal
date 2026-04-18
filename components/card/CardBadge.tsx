
import React from 'react';
import { GameText } from '../ui/GameText';

interface CardBadgeProps {
    value: number;
    type: 'cost' | 'power';
    colorClass: string;
}

export const CardBadge: React.FC<CardBadgeProps> = ({ value, type, colorClass }) => {
    const isCost = type === 'cost';
    
    /**
     * ULTRA-COMPACT PROPORTIONAL BADGE
     * Scaled down to 1.05em for a minimalist "HUD" feel.
     */
    const badgeSize = '1.05em'; 
    const offset = '-0.05em'; 

    const position = isCost 
        ? { top: offset, left: offset } 
        : { top: offset, right: offset };
    
    const bgColor = isCost ? '#2563eb' : '#dc2626';

    return (
        <div 
            className="absolute z-30 pointer-events-none"
            style={{ 
                width: badgeSize, 
                height: badgeSize,
                filter: 'drop-shadow(0 0.06em 0.1em rgba(0,0,0,0.8))',
                ...position
            }}
        >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <path 
                    d="M50 5 L95 25 L95 75 L50 95 L5 75 L5 25 Z" 
                    fill={bgColor}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="12"
                />
            </svg>
            
            <div className="absolute inset-0 flex items-center justify-center pt-[5%]">
                <div className={`w-[70%] h-[70%] ${colorClass}`}>
                    <GameText 
                        text={value.toString()} 
                        baseFontSize={0.8} 
                        maxScale={1.0}
                        className="font-black italic drop-shadow-md" 
                    />
                </div>
            </div>
        </div>
    );
};
