
import React from 'react';
import { CardDefinition } from '../../types';
import { GameText } from '../ui/GameText';

interface DeckStatsProps {
    cards: CardDefinition[];
}

export const DeckStats: React.FC<DeckStatsProps> = ({ cards }) => {
    // Cost Distribution 1-6
    const distribution = Array.from({ length: 6 }).map((_, i) => {
        const cost = i + 1;
        const count = cards.filter(c => c.baseCost === cost).length;
        return { cost, count };
    });

    const maxCount = Math.max(...distribution.map(d => d.count), 1);
    const avgCost = cards.length > 0 
        ? (cards.reduce((acc, c) => acc + c.baseCost, 0) / cards.length).toFixed(1)
        : 0;

    return (
        <div className="flex items-end justify-between px-2 h-12 gap-6">
            <div className="flex-1 flex items-end justify-start gap-1 h-full max-w-[10rem]">
                {distribution.map(d => {
                    const height = (d.count / maxCount) * 100;
                    return (
                        <div key={d.cost} className="flex-1 flex flex-col items-center gap-1 group">
                            <div 
                                className={`w-full bg-indigo-500/30 rounded-t-sm transition-all duration-500 relative ${d.count > 0 ? 'bg-indigo-500' : 'bg-slate-800'}`}
                                style={{ height: `${Math.max(10, height)}%` }}
                            >
                                {d.count > 0 && <div className="absolute top-0 inset-x-0 h-0.5 bg-indigo-300 blur-[1px]"></div>}
                            </div>
                            <span className="text-[0.4rem] font-black text-slate-500">{d.cost}</span>
                        </div>
                    );
                })}
            </div>
            
            <div className="flex flex-col items-end justify-center mb-4">
                <div className="text-[0.55rem] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                    AVG COST
                </div>
                <div className="h-6 w-full flex items-center justify-end">
                    <GameText text={avgCost.toString()} baseFontSize={1.1} className="text-white font-black italic tabular-nums" />
                </div>
            </div>

            <div className="flex flex-col items-end justify-center mb-4">
                <div className="text-[0.55rem] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                    COUNT
                </div>
                <div className="h-6 w-full flex items-center justify-end">
                    <GameText 
                        text={`${cards.length}/12`} 
                        baseFontSize={1.1} 
                        className={`font-black italic tabular-nums ${cards.length === 12 ? 'text-emerald-400' : 'text-slate-400'}`} 
                    />
                </div>
            </div>
        </div>
    );
};
