
import { CardGem } from './CardGem';

interface CardBadgeProps {
    value: () => number | string;
    type: 'cost' | 'power';
    colorClass: () => string;
}

export const CardBadge = (props: CardBadgeProps) => {
    const isCost = () => props.type === 'cost';

    const badgeSize = '1.05em'; 
    const offset = '-0.05em'; 

    const style = () => {
        const position = isCost() 
            ? { top: offset, left: offset } 
            : { top: offset, right: offset };
        
        return { 
            ...position
        };
    };
    
    const backgroundColor = () => isCost() ? '#2563eb' : '#dc2626';
    const accentColor = () => isCost() ? 'rgba(147,197,253,0.95)' : 'rgba(254,202,202,0.95)';

    return (
        <CardGem
            value={props.value()}
            backgroundColor={backgroundColor()}
            foregroundColor="currentColor"
            accentColor={accentColor()}
            glowColor={backgroundColor()}
            size={badgeSize}
            class={`absolute z-30 ${props.colorClass()}`}
            style={style()}
            ariaLabel={`${props.type} ${props.value()}`}
        />
    );
};
