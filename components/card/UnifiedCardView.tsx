
import { createMemo, Show } from 'solid-js';
import { CardDefinition, CardInstance } from '../../types';
import { getCardVisualState } from '../../utils/cardStyles';
import { CardBadge } from './CardBadge';
import { GameText } from '../ui/GameText';

interface UnifiedCardViewProps {
    card: CardInstance | CardDefinition;
    size: 'xs' | 'sm' | 'md' | 'lg';
    hidden?: boolean;
    isDragging?: boolean;
    onPointerDown?: (e: PointerEvent) => void;
    onClick?: () => void;
    borderOverride?: string;
}

const SCALE_MAP = {
    xs: 0.5,   // Board
    sm: 0.75,  // Hand
    md: 1.0,   // Standard
    lg: 1.8    // Inspector
};

export const UnifiedCardView = (props: UnifiedCardViewProps) => {
    const scale = () => SCALE_MAP[props.size];
    
    // Derived state should be reactive to props.card changes
    const visual = createMemo(() => getCardVisualState(props.card));

    // Base card width at md scale
    const baseWidth = 5.2; // rem

    return (
        <Show when={!props.hidden} fallback={
            <div 
                class="w-full h-full bg-indigo-950 flex items-center justify-center overflow-hidden shadow-inner cursor-pointer"
                style={{ 
                    "font-size": `${scale()}rem`,
                    "border-radius": '0.5em',
                    "border": '0.12em solid rgba(129, 140, 248, 0.4)',
                    "aspect-ratio": '5/7'
                }}
                onPointerDown={(e) => props.onPointerDown?.(e)}
                onClick={() => props.onClick?.()}
            >
                <div class="w-1/2 h-1/2 rounded-full bg-indigo-500/20 animate-pulse blur-xl" />
                <div class="absolute font-black text-indigo-300/30 italic rotate-[-45deg] tracking-tighter" style={{ "font-size": '1.5em' }}>SNAP</div>
            </div>
        }>
            <div
                onPointerDown={(e) => props.onPointerDown?.(e)}
                onClick={() => props.onClick?.()}
                class={`
                    relative select-none touch-none overflow-hidden transition-opacity duration-200 group
                    ${props.isDragging ? 'opacity-0' : 'opacity-100'}
                `}
                style={{ 
                    width: `${baseWidth * scale()}rem`,
                    "font-size": `${scale()}rem`, // Master scale for all 'em' units
                    "aspect-ratio": '5/7',
                    "border-radius": '0.45em',
                    "box-shadow": `0 0 0.6em ${visual().glowColor}, inset 0 0 0.5em rgba(0,0,0,0.6)`,
                    "border": `0.15em solid ${props.borderOverride || visual().primaryColor}`,
                    "background-color": '#0f172a'
                }}
            >
                {/* 1. Art Layer */}
                <div class="absolute inset-0 bg-black">
                    <img 
                        src={visual().def.imageUrl} 
                        alt={visual().def.name} 
                        class="w-full h-full object-cover pointer-events-none transition-transform duration-700 [@media(hover:hover)]:group-hover:scale-105 opacity-90" 
                        referrerPolicy="no-referrer"
                    />
                </div>

                {/* 2. Polish Overlays */}
                <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70 pointer-events-none" />
                <div class="absolute inset-0 border border-white/10 pointer-events-none rounded-[inherit]" />

                {/* 3. Badges */}
                <CardBadge value={() => visual().currentCost} type="cost" colorClass={() => visual().costColor} />
                <CardBadge value={() => visual().currentPower} type="power" colorClass={() => visual().powerColor} />

                {/* 4. Nameplate Overlay */}
                <div 
                    class="absolute inset-x-0 pointer-events-none flex flex-col items-center justify-end bg-gradient-to-t from-black via-black/90 to-transparent"
                    style={{ 
                        bottom: 0,
                        height: '35%',
                        "padding-bottom": '0.3em',
                        "padding-left": '0.45em',
                        "padding-right": '0.45em'
                    }}
                >
                     <div class="w-full h-[35%]">
                        <GameText 
                            text={visual().def.name} 
                            baseFontSize={1.1} 
                            maxScale={4.0} 
                            class="font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
                        />
                     </div>
                </div>
            </div>
        </Show>
    );
};
