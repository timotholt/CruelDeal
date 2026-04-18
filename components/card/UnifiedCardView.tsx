
import React from 'react';
import { CardDefinition, CardInstance } from '../../types';
import { getCardVisualState } from '../../utils/cardStyles';
import { CardBadge } from './CardBadge';
import { GameText } from '../ui/GameText';

interface UnifiedCardViewProps {
    card: CardInstance | CardDefinition;
    size: 'xs' | 'sm' | 'md' | 'lg';
    hidden?: boolean;
    isDragging?: boolean;
    onPointerDown?: (e: React.PointerEvent) => void;
    onClick?: () => void;
    borderOverride?: string;
}

/**
 * UNIFIED PROPORTIONAL ENGINE (EM-BASED)
 * 
 * Design Basis:
 * - 1em = The card's current scale.
 * - Internal UI elements are defined in 'em' so they grow/shrink 
 *   perfectly with the container's font-size.
 */
const SCALE_MAP = {
    xs: 0.5,   // Board
    sm: 0.75,  // Hand
    md: 1.0,   // Standard
    lg: 1.8    // Inspector
};

export const UnifiedCardView: React.FC<UnifiedCardViewProps> = ({
    card, size, hidden, isDragging, onPointerDown, onClick, borderOverride
}) => {
    const scale = SCALE_MAP[size];
    const { 
        def, currentPower, currentCost, 
        powerColor, costColor, primaryColor, glowColor 
    } = getCardVisualState(card);

    // Base card width at md scale
    const baseWidth = 5.2; // rem

    if (hidden) {
        return (
            <div 
                className="w-full h-full bg-indigo-950 flex items-center justify-center overflow-hidden shadow-inner cursor-pointer"
                style={{ 
                    fontSize: `${scale}rem`,
                    borderRadius: '0.5em',
                    border: '0.12em solid rgba(129, 140, 248, 0.4)',
                    aspectRatio: '5/7'
                }}
                onPointerDown={onPointerDown}
                onClick={onClick}
            >
                <div className="w-1/2 h-1/2 rounded-full bg-indigo-500/20 animate-pulse blur-xl" />
                <div className="absolute font-black text-indigo-300/30 italic rotate-[-45deg] tracking-tighter" style={{ fontSize: '1.5em' }}>SNAP</div>
            </div>
        );
    }

    const finalBorderColor = borderOverride || primaryColor;

    return (
        <div
            onPointerDown={onPointerDown}
            onClick={onClick}
            className={`
                relative select-none touch-none overflow-hidden transition-opacity duration-200 group
                ${isDragging ? 'opacity-0' : 'opacity-100'}
            `}
            style={{ 
                width: `${baseWidth * scale}rem`,
                fontSize: `${scale}rem`, // Master scale for all 'em' units
                aspectRatio: '5/7',
                borderRadius: '0.45em',
                boxShadow: `0 0 0.6em ${glowColor}, inset 0 0 0.5em rgba(0,0,0,0.6)`,
                border: `0.15em solid ${finalBorderColor}`,
                backgroundColor: '#0f172a'
            }}
        >
            {/* 1. Art Layer */}
            <div className="absolute inset-0 bg-black">
                <img 
                    src={def.imageUrl} 
                    alt={def.name} 
                    className="w-full h-full object-cover pointer-events-none transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-105 opacity-90" 
                />
            </div>

            {/* 2. Polish Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none" />
            <div className="absolute inset-0 border border-white/10 pointer-events-none rounded-[inherit]" />

            {/* 3. Badges */}
            <CardBadge value={currentCost} type="cost" colorClass={costColor} />
            <CardBadge value={currentPower} type="power" colorClass={powerColor} />

            {/* 4. Nameplate Overlay */}
            <div 
                className="absolute inset-x-0 pointer-events-none flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/90 to-transparent"
                style={{ 
                    bottom: 0,
                    height: '35%',
                    paddingBottom: '0.3em',
                    paddingLeft: '0.45em',
                    paddingRight: '0.45em'
                }}
            >
                 <div className="w-full h-[35%]">
                    <GameText 
                        text={def.name} 
                        baseFontSize={1.1} 
                        maxScale={4.0} 
                        className="font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
                    />
                 </div>
            </div>
        </div>
    );
};
