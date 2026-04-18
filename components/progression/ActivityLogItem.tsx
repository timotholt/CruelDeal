import { createMemo, Show } from 'solid-js';
import { ActivityLogEntry } from '../../types';
import { RewardIconGraphic } from '../ui/RewardItemVisual';
import { GameText } from '../ui/GameText';

interface ActivityLogItemProps {
    item: ActivityLogEntry;
    isFlipped: boolean;
    onFlip: () => void;
}

const formatTimeAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export const ActivityLogItem = (props: ActivityLogItemProps) => {
    const gainHeader = createMemo(() => {
        if (props.item.type === 'card') return props.item.cardDef?.name || 'New Variant';
        
        const delta = props.item.delta || 1;
        if (props.item.type === 'box' && delta === 1 && !props.item.isBulk) return 'Omega Box';
        
        const prefix = props.item.isBulk ? 'Bulk: ' : '';
        let label = props.item.type.charAt(0).toUpperCase() + props.item.type.slice(1);
        if (props.item.type === 'booster') label = 'Boosters';
        if (props.item.type === 'box') label = delta > 1 ? 'Omega Boxes' : 'Omega Box';

        return `${prefix}${delta.toLocaleString()} ${label}`;
    });

    return (
        <Show when={!props.item.isSpend}>
            <div 
                class="w-full h-[3.5rem] relative cursor-pointer select-none"
                style={{ perspective: '1000px' }}
                onClick={() => props.onFlip()}
            >
                <div 
                    class="w-full h-full relative transition-transform duration-300"
                    style={{ 
                        "transform-style": 'preserve-3d',
                        transform: props.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                >
                    {/* FRONT FACE */}
                    <div class="absolute inset-0 backface-hidden flex items-center px-3 bg-black/40 border border-white/20 rounded-lg shadow-lg">
                        <div class="w-[15%] flex items-center justify-center">
                            <div class={props.item.type === 'card' ? 'scale-75' : 'scale-[1.35]'}>
                                <RewardIconGraphic type={props.item.type as any} size="sm" cardDef={props.item.cardDef} />
                            </div>
                        </div>

                        <div class="flex-1 flex flex-col justify-center pl-4 min-w-0">
                            <div class="h-[1.1rem]">
                                <GameText text={gainHeader()} baseFontSize={0.9} class="text-white font-black italic uppercase !justify-start" />
                            </div>
                            <div class="h-[0.8rem] opacity-60 mt-0.5">
                                 <GameText text={props.item.title} baseFontSize={0.55} maxLines={1} class="text-indigo-300 font-bold uppercase !justify-start" />
                            </div>
                        </div>
                        
                        <div class="w-[27%] flex flex-col items-end justify-center opacity-80">
                             <span class="text-[0.6rem] font-bold text-white uppercase tabular-nums">{props.item.date}</span>
                             <span class="text-[0.4rem] font-black text-white/30 uppercase tabular-nums">{formatTimeAMPM(props.item.time)}</span>
                        </div>
                    </div>

                    {/* BACK FACE */}
                    <div 
                        class="absolute inset-0 backface-hidden flex flex-col justify-center px-4 bg-indigo-950 border border-indigo-400/40 rounded-lg shadow-2xl"
                        style={{ transform: 'rotateY(180deg)' }}
                    >
                        <span class="text-[0.45rem] font-black text-indigo-400 uppercase tracking-[0.25em] mb-1">Transaction ID</span>
                        <div class="h-6 flex items-center">
                            <GameText text={props.item.id} baseFontSize={0.65} italic={false} class="text-white font-bold select-all !justify-start" />
                        </div>
                        <div class="absolute inset-x-0 bottom-0 h-[1px] bg-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                    </div>
                </div>

                <style>{`.backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }`}</style>
            </div>
        </Show>
    );
};
