import { Switch, Match, createMemo, Show } from 'solid-js';
import { OfferItem, OfferItemCurrency, OfferItemCard } from '../../types';
import { CARDS } from '../../constants';
import { Card } from '../Card';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import { useUI } from '../../contexts/UIContext';
import { CreditIcon, GoldIcon } from '../ui/CurrencyIcons';

interface OfferItemViewProps {
    item: OfferItem;
}

export const OfferItemView = (props: OfferItemViewProps) => {
    const ui = useUI();

    return (
        <Switch fallback={null}>
            <Match when={props.item.type === 'currency'}>
                {(() => {
                    const item = props.item as OfferItemCurrency;
                    const isGold = item.currencyType === 'gold';
                    return (
                        <div 
                            class="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-800 transition-colors"
                            onClick={() => ui.inspect({ type: item.currencyType, amount: item.amount } as any)}
                        >
                            <div class={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${isGold ? 'bg-amber-500/10 border-amber-500/40' : 'bg-blue-500/10 border-blue-500/40'}`}>
                                {isGold ? <GoldIcon size="md" /> : <CreditIcon size="md" />}
                            </div>
                            <div class="text-center w-full px-2">
                                <div class="h-7 w-full mb-0.5">
                                    <GameText 
                                        text={item.amount.toLocaleString()} 
                                        baseFontSize={1.25} 
                                        class="text-white drop-shadow-md"
                                    />
                                </div>
                                <div class={`text-[0.6rem] font-black uppercase tracking-[0.25em] ${isGold ? 'text-amber-500' : 'text-blue-500'}`}>
                                    {item.currencyType}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </Match>
            <Match when={props.item.type === 'card'}>
                {(() => {
                    const item = props.item as OfferItemCard;
                    const def = createMemo(() => CARDS.find(c => c.id === item.definitionId));
                    
                    return (
                        <Show when={def()}>
                            {(d) => (
                                <div class="flex flex-col gap-2">
                                    <div 
                                        class="aspect-[5/7] w-full cursor-pointer hover:scale-[1.02] transition-transform"
                                        onClick={() => ui.inspect(d())}
                                    >
                                        <Card card={d()} size="xs" variant="default" />
                                    </div>
                                    <div class="text-center">
                                        <div class="text-[0.7rem] font-black text-white uppercase truncate">{d().name}</div>
                                        <div class="text-[0.55rem] font-bold text-indigo-400 uppercase tracking-widest">New Variant</div>
                                    </div>
                                </div>
                            )}
                        </Show>
                    );
                })()}
            </Match>
        </Switch>
    );
};
