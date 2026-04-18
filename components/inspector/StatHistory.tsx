import { For } from 'solid-js';
import { StatModifier } from '../../types';

interface StatHistoryProps {
    modifiers: StatModifier[];
    type: 'cost' | 'power';
    side: 'left' | 'right';
}

export const StatHistory = (props: StatHistoryProps) => {
    
    const renderStatModifier = (m: StatModifier) => {
        const isBase = m.type === 'BASE';
        let valueColor = 'text-white';
        let sign = '';

        if (!isBase) {
            if (props.type === 'power') {
                if (m.value > 0) { valueColor = 'text-emerald-400'; sign = '+'; }
                if (m.value < 0) { valueColor = 'text-red-400'; }
            } else {
                if (m.value > 0) { valueColor = 'text-red-400'; sign = '+'; }
                if (m.value < 0) { valueColor = 'text-emerald-400'; }
            }
        }

        return (
            <div class="flex justify-between items-center w-full mb-0.5 last:mb-0 bg-black/60 rounded-[2px] px-1.5 py-1 border border-white/5">
                <span class="text-slate-400 text-[0.45rem] font-bold uppercase tracking-tight truncate max-w-[3.5rem]">
                    {m.source}
                </span>
                <span class={`font-black text-[0.65rem] leading-none italic ${valueColor}`}>
                    {sign}{m.value}
                </span>
            </div>
        );
    };

    // Positioned relative to the card's visual bounds
    const positionClass = () => props.side === 'left' 
        ? "right-full mr-1" 
        : "left-full ml-1";

    return (
        <div class={`absolute top-1/2 -translate-y-1/2 ${positionClass()} w-24 pointer-events-auto z-[60]`}>
             <div class="bg-slate-900/95 border border-white/10 rounded-lg p-1 shadow-2xl flex flex-col max-h-40 overflow-y-auto">
                <div class="flex flex-col gap-0.5">
                    <For each={props.modifiers}>
                        {(modifier) => renderStatModifier(modifier)}
                    </For>
                </div>
             </div>
        </div>
    );
};
