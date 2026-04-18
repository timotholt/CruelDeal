import { Show, Switch, Match } from 'solid-js';
import { CreditIcon, GoldIcon, CardIcon, BoosterIcon, OmegaBoxIcon, TokenIcon } from './CurrencyIcons';
import { CardDefinition } from '../../types';
import { Card } from '../Card';

export type SeasonRewardType = 'gold' | 'credits' | 'card' | 'booster' | 'box' | 'tokens';

interface RewardItemVisualProps {
    type: SeasonRewardType;
    amount?: string | number;
    imageUrl?: string;
    level?: number;
    class?: string;
    size?: 'sm' | 'lg' | 'xl';
    cardDef?: CardDefinition; 
}

export const RewardIconGraphic = (props: { 
    type: SeasonRewardType; 
    level?: number; 
    size: 'sm' | 'lg' | 'xl';
    cardDef?: CardDefinition;
    amount?: string | number;
}) => {
    const isHero = () => props.size === 'xl';
    const iconSize = () => props.size; 

    return (
        <Switch fallback={null}>
            <Match when={props.type === 'gold'}>
                <GoldIcon size={iconSize()} animate={isHero()} />
            </Match>
            <Match when={props.type === 'credits'}>
                <CreditIcon size={iconSize()} />
            </Match>
            <Match when={props.type === 'tokens'}>
                <TokenIcon size={iconSize()} animate={isHero()} />
            </Match>
            <Match when={props.type === 'card'}>
                <Show when={props.cardDef} fallback={<CardIcon size={iconSize()} />}>
                    <div class={`${isHero() ? 'w-44' : (props.size === 'lg' ? 'w-36' : 'w-9')} aspect-[5/7] flex items-center justify-center shadow-2xl`}>
                        <Card 
                            card={props.cardDef!} 
                            size={isHero() ? 'lg' : (props.size === 'lg' ? 'md' : 'xs')} 
                            borderOverride="white" 
                        />
                    </div>
                </Show>
            </Match>
            <Match when={props.type === 'booster'}>
                <BoosterIcon size={iconSize()} />
            </Match>
            <Match when={props.type === 'box'}>
                <OmegaBoxIcon size={iconSize()} />
            </Match>
        </Switch>
    );
};

export const RewardItemVisual = (props: RewardItemVisualProps) => {
    const isLarge = () => props.size === 'lg' || props.size === 'xl';
    
    return (
        <div class={`flex flex-col items-center justify-center pointer-events-none w-full h-full ${props.class || ''}`}>
            {/* ICON LAYER */}
            <div class="flex items-center justify-center transition-transform duration-500">
                <RewardIconGraphic type={props.type} level={props.level} size={props.size || 'sm'} cardDef={props.cardDef} amount={props.amount} />
            </div>
            
            {/* TEXT LABEL LAYER */}
            <Show when={props.amount && props.type !== 'card'}>
                <div class={`${isLarge() ? 'mt-4' : 'mt-1'} flex flex-col items-center justify-center leading-none w-full`}>
                    <span class={`
                        ${props.size === 'xl' ? 'text-4xl' : (props.size === 'lg' ? 'text-xl' : 'text-[0.55rem]')} 
                        font-black uppercase tracking-tighter text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] text-center italic
                    `}>
                        {props.amount} {props.type}
                    </span>
                </div>
            </Show>
        </div>
    );
};
