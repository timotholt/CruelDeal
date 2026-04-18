
import React from 'react';
import { OfferItem } from '../../types';
import { CARDS } from '../../constants';
import { Card } from '../Card';
import { GameText } from '../ui/GameText';
import { useUI } from '../../contexts/UIContext';
import { CreditIcon, GoldIcon } from '../ui/CurrencyIcons';

interface OfferItemViewProps {
    item: OfferItem;
}

export const OfferItemView: React.FC<OfferItemViewProps> = ({ item }) => {
    const { inspect } = useUI();

    if (item.type === 'currency') {
        const isGold = item.currencyType === 'gold';
        return (
            <div 
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => inspect({ type: item.currencyType, amount: item.amount })}
            >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isGold ? 'bg-amber-500/10 border-amber-500/40' : 'bg-blue-500/10 border-blue-500/40'}`}>
                    {isGold ? <GoldIcon size="md" /> : <CreditIcon size="md" />}
                </div>
                <div className="text-center w-full px-2">
                    <div className="h-7 w-full mb-0.5">
                        <GameText 
                            text={item.amount.toLocaleString()} 
                            baseFontSize={1.25} 
                            className="text-white drop-shadow-md"
                        />
                    </div>
                    <div className={`text-[0.6rem] font-black uppercase tracking-[0.25em] ${isGold ? 'text-amber-500' : 'text-blue-500'}`}>
                        {item.currencyType}
                    </div>
                </div>
            </div>
        );
    }

    if (item.type === 'card') {
        const def = CARDS.find(c => c.id === item.definitionId);
        if (!def) return null;

        return (
            <div className="flex flex-col gap-2">
                <div 
                    className="aspect-[5/7] w-full cursor-pointer hover:scale-[1.02] transition-transform"
                    onClick={() => inspect(def)}
                >
                    <Card card={def} size="xs" variant="default" />
                </div>
                <div className="text-center">
                    <div className="text-[0.7rem] font-black text-white uppercase truncate">{def.name}</div>
                    <div className="text-[0.55rem] font-bold text-indigo-400 uppercase tracking-widest">New Variant</div>
                </div>
            </div>
        );
    }

    return null;
};
