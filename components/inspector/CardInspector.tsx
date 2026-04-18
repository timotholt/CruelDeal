import React from 'react';
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

export const CardInspector: React.FC<CardInspectorProps> = ({ card, user, onUpgrade, borderOverride }) => {
    const isInstance = (c: any): c is CardInstance => c && 'instanceId' in c;
    const def = isInstance(card) ? card.def : card as CardDefinition;
    
    const isOwned = user.collection.includes(def.id);
    const currentRarity = user.cardRarities[def.id] || def.rarity;
    const rarityPath: CardRarity[] = ["Common", "Rare", "Epic", "Legendary"];
    const nextRarity = rarityPath[rarityPath.indexOf(currentRarity) + 1];
    const costMap: Record<string, number> = { "Rare": 100, "Epic": 400, "Legendary": 1000 };
    const upgradeCost = nextRarity ? costMap[nextRarity] : null;

    const finalBorder = borderOverride || (!isOwned ? 'white' : undefined);

    return (
        <div className="flex flex-col items-center w-full max-w-[18rem] animate-pop">
            {/* 1. HERO AREA */}
            <div className="relative flex items-center justify-center mb-8 w-full">
                <div className="relative z-40 shadow-[0_0_5rem_rgba(0,0,0,1)]">
                    {isInstance(card) && (
                        <>
                            <div className="absolute -left-1 top-0 bottom-0 pointer-events-none z-50">
                                <StatHistory modifiers={card.costModifiers} type="cost" side="left" />
                            </div>
                            <div className="absolute -right-1 top-0 bottom-0 pointer-events-none z-50">
                                <StatHistory modifiers={card.powerModifiers} type="power" side="right" />
                            </div>
                        </>
                    )}
                    <Card 
                        card={{ ...def, rarity: currentRarity }} 
                        size="lg" 
                        borderOverride={finalBorder}
                    />
                </div>
            </div>

            {/* 2. ABILITY BOX */}
            <div className="w-full text-center mb-6 px-4 flex items-center justify-center">
                <KeywordText 
                    className="text-[0.8rem] leading-snug" 
                    text={isInstance(card) ? card.currentText : def.baseText} 
                />
            </div>

            {/* 3. ACTIONS */}
            {!isInstance(card) && nextRarity && (
                <div className="w-full mb-8 px-4">
                    <SlantedButton 
                        variant="success" 
                        fullWidth 
                        size="md"
                        onClick={(e) => { e.stopPropagation(); onUpgrade(def.id); }}
                        disabled={user.credits < (upgradeCost || 0)}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <div className="flex flex-col items-start leading-none py-1">
                                <span className="text-[0.5rem] opacity-70 font-black tracking-widest uppercase">{t('INSPECT_UPGRADE_TO')}</span>
                                <span className="text-[0.7rem] font-bold">{nextRarity.toUpperCase()}</span>
                            </div>
                            <div className="h-6 w-px bg-white/20"></div>
                            <span className="text-sm font-black italic tabular-nums">{upgradeCost} {t('STORE_CREDITS')}</span>
                        </div>
                    </SlantedButton>
                </div>
            )}

            {/* 4. FLAVOR SLATE */}
            {def.flavorText && (
                <div className="w-full px-6">
                    <div className="relative p-[1px] bg-indigo-500/20 rounded-sm">
                        <div className="bg-slate-950/80 p-3 rounded-sm flex flex-col items-center justify-center shadow-inner border border-white/5">
                            <div className="w-6 h-0.5 bg-indigo-500/30 mb-2 rounded-full" />
                            <p className="text-[0.6rem] text-indigo-200/50 italic leading-relaxed font-sans text-center max-w-[90%] tracking-tight">
                                "{def.flavorText}"
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};