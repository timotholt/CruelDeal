import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ActivityLogEntry, ProgressionRewardType } from '../../types';
import { SlantedButton } from '../ui/SlantedButton';
import { BoosterIcon, CreditIcon, GoldIcon, TokenIcon, OmegaBoxIcon, CardIcon } from '../ui/CurrencyIcons';
import { ActivityLogItem } from './ActivityLogItem';
import { t } from '../../services/localization';

type FilterType = 'all' | ProgressionRewardType;

interface ActivityLogSectionProps {
    logs: ActivityLogEntry[];
    flippedItemId: string | null;
    closingItemId: string | null;
    onFlipItem: (id: string | null) => void;
}

export const ActivityLogSection: React.FC<ActivityLogSectionProps> = ({ 
    logs, 
    flippedItemId,
    closingItemId,
    onFlipItem 
}) => {
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Unflip if filter changes
    useEffect(() => {
        onFlipItem(null);
    }, [activeFilter, onFlipItem]);

    // Unflip if user scrolls for cinematic cleanup
    const handleScroll = useCallback(() => {
        if (flippedItemId) onFlipItem(null);
    }, [flippedItemId, onFlipItem]);

    const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
        // Tap-to-close logic for empty space
        if (e.target === e.currentTarget && (flippedItemId || closingItemId)) {
            onFlipItem(null);
        }
    }, [flippedItemId, closingItemId, onFlipItem]);

    const filteredLogs = useMemo(() => {
        if (activeFilter === 'all') return logs;
        return logs.filter(log => log.type === activeFilter);
    }, [logs, activeFilter]);

    const filters: { id: FilterType; icon: React.ReactNode; variant: any }[] = [
        { id: 'all', icon: <span className="text-[0.7rem] font-black italic">{t('HIST_ALL').toUpperCase()}</span>, variant: 'primary' },
        { id: 'card', icon: <div className="scale-75"><CardIcon size="sm" /></div>, variant: 'primary' },
        { id: 'booster', icon: <div className="scale-90"><BoosterIcon size="sm" /></div>, variant: 'success' },
        { id: 'credits', icon: <div className="scale-75"><CreditIcon size="sm" /></div>, variant: 'blue' },
        { id: 'gold', icon: <div className="scale-[0.85]"><GoldIcon size="sm" /></div>, variant: 'warning' },
        { id: 'tokens', icon: <div className="scale-75"><TokenIcon size="sm" /></div>, variant: 'danger' },
        { id: 'box', icon: <div className="scale-90"><OmegaBoxIcon size="sm" /></div>, variant: 'primary' },
    ];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 pt-6">
                <div className="flex items-center gap-1 px-4 justify-center pb-3">
                    {filters.map((f) => (
                        <SlantedButton
                            key={f.id}
                            variant={activeFilter === f.id ? f.variant : 'ghost'}
                            size="xs"
                            className="!w-[12vw] max-w-[2.8rem] shrink-0 !transition-none !h-[1.5rem]"
                            onClick={() => setActiveFilter(f.id)}
                        >
                            {f.icon}
                        </SlantedButton>
                    ))}
                </div>

                <div className="mt-1 px-6 pb-3 text-center">
                    <span className="text-[0.5rem] font-black text-white/40 uppercase tracking-[0.3em] italic">
                        {t('UI_SHOWING_LAST_LOGS')}
                    </span>
                </div>
            </div>

            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                onClick={handleBackgroundClick}
                className="flex-1 overflow-y-auto px-2 pb-24 custom-scrollbar"
            >
                <div className="space-y-2 perspective-[1000px]">
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map((item) => (
                            <ActivityLogItem 
                                key={item.id}
                                item={item} 
                                isFlipped={flippedItemId === item.id || closingItemId === item.id}
                                onFlip={() => onFlipItem(flippedItemId === item.id ? null : item.id)}
                            />
                        ))
                    ) : (
                        <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                            <span className="text-[0.55rem] font-black text-white/20 uppercase tracking-[0.4em]">{t('UI_LOG_EMPTY')}</span>
                        </div>
                    )}
                </div>
                <div className="h-10 w-full" />
            </div>
        </div>
    );
};