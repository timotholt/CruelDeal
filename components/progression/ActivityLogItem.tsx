import React, { useMemo } from 'react';
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

export const ActivityLogItem: React.FC<ActivityLogItemProps> = React.memo(({ item, isFlipped, onFlip }) => {
    const gainHeader = useMemo(() => {
        if (item.type === 'card') return item.cardDef?.name || 'New Variant';
        
        const delta = item.delta || 1;
        if (item.type === 'box' && delta === 1 && !item.isBulk) return 'Omega Box';
        
        const prefix = item.isBulk ? 'Bulk: ' : '';
        let label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
        if (item.type === 'booster') label = 'Boosters';
        if (item.type === 'box') label = delta > 1 ? 'Omega Boxes' : 'Omega Box';

        return `${prefix}${delta.toLocaleString()} ${label}`;
    }, [item]);

    if (item.isSpend) return null;

    return (
        <div 
            className="w-full h-[3.5rem] relative cursor-pointer select-none"
            style={{ perspective: '1000px' }}
            onClick={onFlip}
        >
            <div 
                className="w-full h-full relative transition-transform duration-300"
                style={{ 
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
            >
                {/* FRONT FACE */}
                <div className="absolute inset-0 backface-hidden flex items-center px-3 bg-black/40 border border-white/20 rounded-lg shadow-lg">
                    <div className="w-[15%] flex items-center justify-center">
                        <div className={item.type === 'card' ? 'scale-75' : 'scale-[1.35]'}>
                            <RewardIconGraphic type={item.type as any} size="sm" cardDef={item.cardDef} />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center pl-4 min-w-0">
                        <div className="h-[1.1rem]">
                            <GameText text={gainHeader} baseFontSize={0.9} className="text-white font-black italic uppercase !justify-start" />
                        </div>
                        <div className="h-[0.8rem] opacity-60 mt-0.5">
                             <GameText text={item.title} baseFontSize={0.55} maxLines={1} className="text-indigo-300 font-bold uppercase !justify-start" />
                        </div>
                    </div>
                    
                    <div className="w-[27%] flex flex-col items-end justify-center opacity-80">
                         <span className="text-[0.6rem] font-bold text-white uppercase tabular-nums">{item.date}</span>
                         <span className="text-[0.4rem] font-black text-white/30 uppercase tabular-nums">{formatTimeAMPM(item.time)}</span>
                    </div>
                </div>

                {/* BACK FACE */}
                <div 
                    className="absolute inset-0 backface-hidden flex flex-col justify-center px-4 bg-indigo-950 border border-indigo-400/40 rounded-lg shadow-2xl"
                    style={{ transform: 'rotateY(180deg)' }}
                >
                    <span className="text-[0.45rem] font-black text-indigo-400 uppercase tracking-[0.25em] mb-1">Transaction ID</span>
                    <div className="h-6 flex items-center">
                        <GameText text={item.id} baseFontSize={0.65} italic={false} className="text-white font-bold select-all !justify-start" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                </div>
            </div>

            <style>{`.backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }`}</style>
        </div>
    );
});