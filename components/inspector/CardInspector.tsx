import { Show } from 'solid-js';
import { CardInstance, CardDefinition, CardRarity, UserProfile } from '../../types';
import { Card } from '../Card';
import { StatHistory } from './StatHistory';
import { KeywordText } from '../ui/KeywordText';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';

interface CardInspectorProps {
    card: CardInstance | CardDefinition;
    user: UserProfile;
    onUpgrade: (id: string) => void;
    borderOverride?: string;
}

export const CardInspector = (props: CardInspectorProps) => {
    const isInstance = (c: any): c is CardInstance => c && typeof c === 'object' && 'instanceId' in c;
    const def = () => {
        if (!props.card) return { name: 'Unknown', rarity: 'Common', id: 'unknown' } as CardDefinition;
        return isInstance(props.card) ? props.card.def : props.card as CardDefinition;
    };
    
    const isOwned = () => props.user.collection.includes(def().id);
    const currentRarity = () => props.user.cardRarities[def().id] || def().rarity;
    const rarityPath: CardRarity[] = ["Common", "Rare", "Epic", "Legendary"];
    const nextRarity = () => rarityPath[rarityPath.indexOf(currentRarity()) + 1];
    const costMap: Record<string, number> = { "Rare": 100, "Epic": 400, "Legendary": 1000 };
    const upgradeCost = () => nextRarity() ? costMap[nextRarity() as string] : null;

    const finalBorder = () => props.borderOverride || (!isOwned() ? 'white' : undefined);

    return (
        <div class="flex flex-col items-center w-full max-w-[18rem] animate-pop">
            {/* 1. HERO AREA */}
            <div class="relative flex items-center justify-center mb-8 w-full">
                <div class="relative z-40 shadow-[0_0_5rem_rgba(0,0,0,1)]">
                    <Show when={isInstance(props.card)}>
                        <div class="absolute -left-1 top-0 bottom-0 pointer-events-none z-50">
                            <StatHistory modifiers={(props.card as CardInstance).costModifiers} type="cost" side="left" />
                        </div>
                        <div class="absolute -right-1 top-0 bottom-0 pointer-events-none z-50">
                            <StatHistory modifiers={(props.card as CardInstance).powerModifiers} type="power" side="right" />
                        </div>
                    </Show>
                    <Card 
                        card={{ ...def(), rarity: currentRarity() }} 
                        size="lg" 
                        borderOverride={finalBorder()}
                    />
                </div>
            </div>

            {/* 2. ABILITY BOX */}
            <div class="w-full text-center mb-6 px-4 flex items-center justify-center">
                <KeywordText 
                    class="text-[0.8rem] leading-snug" 
                    text={isInstance(props.card) ? (props.card as CardInstance).currentText : def().baseText} 
                />
            </div>

            {/* 3. ACTIONS */}
            <Show when={!isInstance(props.card) && nextRarity()}>
                <div class="w-full mb-8 px-4">
                    <SlantedButton 
                        variant="success" 
                        fullWidth 
                        size="md"
                        onClick={(e) => { e.stopPropagation(); props.onUpgrade(def().id); }}
                        disabled={props.user.credits < (upgradeCost() || 0)}
                    >
                        <div class="flex items-center justify-center gap-3">
                            <div class="flex flex-col items-start leading-none py-1">
                                <span class="text-[0.5rem] opacity-70 font-black tracking-widest uppercase">{t('INSPECT_UPGRADE_TO')}</span>
                                <span class="text-[0.7rem] font-bold">{nextRarity()?.toUpperCase()}</span>
                            </div>
                            <div class="h-6 w-px bg-white/20" />
                            <span class="text-sm font-black italic tabular-nums">{upgradeCost()} {t('STORE_CREDITS')}</span>
                        </div>
                    </SlantedButton>
                </div>
            </Show>

            {/* 4. FLAVOR SLATE */}
            <Show when={def().flavorText}>
                <div class="w-full px-6">
                    <div class="relative p-[1px] bg-indigo-500/20 rounded-sm">
                        <div class="bg-slate-950/80 p-3 rounded-sm flex flex-col items-center justify-center shadow-inner border border-white/5">
                            <div class="w-6 h-0.5 bg-indigo-500/30 mb-2 rounded-full" />
                            <p class="text-[0.6rem] text-indigo-200/50 italic leading-relaxed font-sans text-center max-w-[90%] tracking-tight">
                                "{def().flavorText}"
                            </p>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};
