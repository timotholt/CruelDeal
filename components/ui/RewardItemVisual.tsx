
import React from 'react';
import { CreditIcon, GoldIcon, CardIcon, BoosterIcon, OmegaBoxIcon, TokenIcon } from './CurrencyIcons';
import { CardDefinition } from '../../types';
import { Card } from '../Card';

export type SeasonRewardType = 'gold' | 'credits' | 'card' | 'booster' | 'box' | 'tokens';

interface RewardItemVisualProps {
    type: SeasonRewardType;
    amount?: string | number;
    imageUrl?: string;
    level?: number;
    className?: string;
    size?: 'sm' | 'lg' | 'xl';
    cardDef?: CardDefinition; 
}

/**
 * REWARD ITEM VISUAL
 * Focused on pure centering of the icon graphic.
 */
export const RewardItemVisual: React.FC<RewardItemVisualProps> = ({ 
    type, 
    amount, 
    level, 
    className = "",
    size = 'sm',
    cardDef
}) => {
    const isLarge = size === 'lg' || size === 'xl';
    
    return (
        <div className={`flex flex-col items-center justify-center pointer-events-none w-full h-full ${className}`}>
            {/* ICON LAYER */}
            <div className="flex items-center justify-center transition-transform duration-500">
                <RewardIconGraphic type={type} level={level} size={size} cardDef={cardDef} amount={amount} />
            </div>
            
            {/* TEXT LABEL LAYER */}
            {amount && type !== 'card' && (
                <div className={`${isLarge ? 'mt-4' : 'mt-1'} flex flex-col items-center justify-center leading-none w-full`}>
                    <span className={`
                        ${size === 'xl' ? 'text-4xl' : (size === 'lg' ? 'text-xl' : 'text-[0.55rem]')} 
                        font-black uppercase tracking-tighter text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] text-center italic
                    `}>
                        {amount} {type}
                    </span>
                </div>
            )}
        </div>
    );
};

export const RewardIconGraphic: React.FC<{ 
    type: SeasonRewardType; 
    level?: number; 
    size?: 'sm' | 'lg' | 'xl';
    cardDef?: CardDefinition;
    amount?: string | number;
}> = ({ type, level: _level, size = 'sm', cardDef, amount: _amount }) => {
    const isHero = size === 'xl';
    const iconSize = size; 

    switch (type) {
        case 'gold': return <GoldIcon size={iconSize} animate={isHero} />;
        case 'credits': return <CreditIcon size={iconSize} />;
        case 'tokens': return <TokenIcon size={iconSize} animate={isHero} />;
        case 'card': 
            if (cardDef) {
                return (
                    <div className={`${isHero ? 'w-44' : (size === 'lg' ? 'w-36' : 'w-9')} aspect-[5/7] flex items-center justify-center shadow-2xl`}>
                        <Card 
                            card={cardDef} 
                            size={isHero ? 'lg' : (size === 'lg' ? 'md' : 'xs')} 
                            borderOverride="white" 
                        />
                    </div>
                );
            }
            return <CardIcon size={iconSize} />;
        case 'booster': return <BoosterIcon size={iconSize} />;
        case 'box': return <OmegaBoxIcon size={iconSize} />;
        default: return null;
    }
};
