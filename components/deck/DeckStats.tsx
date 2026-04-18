import { createMemo, For } from 'solid-js';
import { CardDefinition } from '../../types';
import { GameText } from '../ui/GameText';

interface DeckStatsProps {
    cards: CardDefinition[];
}

export const DeckStats = (props: DeckStatsProps) => {
    // Cost Distribution 1-6
    const distribution = createMemo(() => Array.from({ length: 6 }).map((_, i) => {
        const cost = i + 1;
        const count = props.cards.filter(c => c.baseCost === cost).length;
        return { cost, count };
    }));

    const maxCount = () => Math.max(...distribution().map(d => d.count), 1);
    const avgCost = () => props.cards.length > 0 
        ? (props.cards.reduce((acc, c) => acc + c.baseCost, 0) / props.cards.length).toFixed(1)
        : "0.0";

    return (
        <div class="flex items-end justify-between px-2 h-12 gap-6">
            <div class="flex-1 flex items-end justify-start gap-1 h-full max-w-[10rem]">
                <For each={distribution()}>
                    {(d) => {
                        const height = () => (d.count / maxCount()) * 100;
                        return (
                            <div class="flex-1 flex flex-col items-center gap-1 group">
                                <div 
                                    class={`w-full transition-all duration-500 relative ${d.count > 0 ? 'bg-indigo-500' : 'bg-slate-800 bg-indigo-500/30'} rounded-t-sm`}
                                    style={{ height: `${Math.max(10, height())}%` }}
                                >
                                    {d.count > 0 && <div class="absolute top-0 inset-x-0 h-0.5 bg-indigo-300 blur-[1px]" />}
                                </div>
                                <span class="text-[0.4rem] font-black text-slate-500">{d.cost}</span>
                            </div>
                        );
                    }}
                </For>
            </div>
            
            <div class="flex flex-col items-end justify-center mb-4">
                <div class="text-[0.55rem] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                    AVG COST
                </div>
                <div class="h-6 w-full flex items-center justify-end">
                    <GameText text={avgCost().toString()} baseFontSize={1.1} class="text-white font-black italic tabular-nums" />
                </div>
            </div>

            <div class="flex flex-col items-end justify-center mb-4">
                <div class="text-[0.55rem] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                    COUNT
                </div>
                <div class="h-6 w-full flex items-center justify-end">
                    <GameText 
                        text={`${props.cards.length}/12`} 
                        baseFontSize={1.1} 
                        class={`font-black italic tabular-nums ${props.cards.length === 12 ? 'text-emerald-400' : 'text-slate-400'}`} 
                    />
                </div>
            </div>
        </div>
    );
};
