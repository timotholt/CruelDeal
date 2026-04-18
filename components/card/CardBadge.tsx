
import { GameText } from '../ui/GameText';

interface CardBadgeProps {
    value: () => number | string;
    type: 'cost' | 'power';
    colorClass: () => string;
}

export const CardBadge = (props: CardBadgeProps) => {
    const isCost = () => props.type === 'cost';
    
    /**
     * ULTRA-COMPACT PROPORTIONAL BADGE
     * Scaled down to 1.05em for a minimalist "HUD" feel.
     */
    const badgeSize = '1.05em'; 
    const offset = '-0.05em'; 

    const style = () => {
        const position = isCost() 
            ? { top: offset, left: offset } 
            : { top: offset, right: offset };
        
        return { 
            width: badgeSize, 
            height: badgeSize,
            filter: 'drop-shadow(0 0.06em 0.1em rgba(0,0,0,0.8))',
            ...position
        };
    };
    
    const bgColor = () => isCost() ? '#2563eb' : '#dc2626';

    return (
        <div 
            class="absolute z-30 pointer-events-none"
            style={style()}
        >
            <svg viewBox="0 0 100 100" class="w-full h-full overflow-visible">
                <path 
                    d="M50 5 L95 25 L95 75 L50 95 L5 75 L5 25 Z" 
                    fill={bgColor()}
                    stroke="rgba(255,255,255,0.3)"
                    stroke-width="12"
                />
            </svg>
            
            <div class="absolute inset-0 flex items-center justify-center pt-[5%]">
                <div class={`w-[70%] h-[70%] ${props.colorClass()}`}>
                    <GameText 
                        text={props.value().toString()} 
                        baseFontSize={0.8} 
                        maxScale={1.0}
                        class="font-black italic drop-shadow-md" 
                    />
                </div>
            </div>
        </div>
    );
};
