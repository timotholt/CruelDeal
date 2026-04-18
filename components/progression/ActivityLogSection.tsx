import { createSignal, createMemo, createEffect, For, Show } from 'solid-js';
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

export const ActivityLogSection = (props: ActivityLogSectionProps) => {
    const [activeFilter, setActiveFilter] = createSignal<FilterType>('all');

    createEffect(() => {
        activeFilter();
        props.onFlipItem(null);
    });

    const handleScroll = () => {
        if (props.flippedItemId) props.onFlipItem(null);
    };

    const handleBackgroundClick = (e: MouseEvent) => {
        if (e.target === e.currentTarget && (props.flippedItemId || props.closingItemId)) {
            props.onFlipItem(null);
        }
    };

    const filteredLogs = createMemo(() => {
        if (activeFilter() === 'all') return props.logs;
        return props.logs.filter(log => log.type === activeFilter());
    });

    const filters: { id: FilterType; icon: any; variant: any }[] = [
        { id: 'all', icon: <span class="text-[0.7rem] font-black italic">{t('HIST_ALL').toUpperCase()}</span>, variant: 'primary' },
        { id: 'card', icon: <div class="scale-75"><CardIcon size="sm" /></div>, variant: 'primary' },
        { id: 'booster', icon: <div class="scale-90"><BoosterIcon size="sm" /></div>, variant: 'success' },
        { id: 'credits', icon: <div class="scale-75"><CreditIcon size="sm" /></div>, variant: 'blue' },
        { id: 'gold', icon: <div class="scale-[0.85]"><GoldIcon size="sm" /></div>, variant: 'warning' },
        { id: 'tokens', icon: <div class="scale-75"><TokenIcon size="sm" /></div>, variant: 'danger' },
        { id: 'box', icon: <div class="scale-90"><OmegaBoxIcon size="sm" /></div>, variant: 'primary' },
    ];

    return (
        <div class="flex flex-col h-full overflow-hidden">
            <div class="shrink-0 pt-6">
                <div class="flex items-center gap-1 px-4 justify-center pb-3">
                    <For each={filters}>
                        {(f) => (
                            <SlantedButton
                                variant={activeFilter() === f.id ? f.variant : 'ghost'}
                                size="xs"
                                class="!w-[12vw] max-w-[2.8rem] shrink-0 !transition-none !h-[1.5rem]"
                                onClick={() => setActiveFilter(f.id)}
                            >
                                {f.icon}
                            </SlantedButton>
                        )}
                    </For>
                </div>

                <div class="mt-1 px-6 pb-3 text-center">
                    <span class="text-[0.5rem] font-black text-white/40 uppercase tracking-[0.3em] italic">
                        {t('UI_SHOWING_LAST_LOGS')}
                    </span>
                </div>
            </div>

            <div 
                onScroll={handleScroll}
                onClick={handleBackgroundClick}
                class="flex-1 overflow-y-auto px-2 pb-24 custom-scrollbar"
            >
                <div class="space-y-2 perspective-[1000px]">
                    <Show when={filteredLogs().length > 0} fallback={
                        <div class="h-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl bg-white/5">
                            <span class="text-[0.55rem] font-black text-white/20 uppercase tracking-[0.4em]">{t('UI_LOG_EMPTY')}</span>
                        </div>
                    }>
                        <For each={filteredLogs()}>
                            {(item) => (
                                <ActivityLogItem 
                                    item={item} 
                                    isFlipped={props.flippedItemId === item.id || props.closingItemId === item.id}
                                    onFlip={() => props.onFlipItem(props.flippedItemId === item.id ? null : item.id)}
                                />
                            )}
                        </For>
                    </Show>
                </div>
                <div class="h-10 w-full" />
            </div>
        </div>
    );
};
