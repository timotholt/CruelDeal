import { createMemo, For, Show } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { CARDS } from '../../constants';
import { Card } from '../Card';
import { CardDefinition } from '../../types';
import { useUser } from '../../contexts/UserContext';

interface CollectionGridProps {
    scrollRef: (el: HTMLDivElement) => void;
    ownedIds: string[];
    activeDeckIds: string[];
    draggingCardId?: string;
    onPointerDown: (e: PointerEvent, card: CardDefinition | null) => void;
}

export const CollectionGrid = (props: CollectionGridProps) => {
    const user = useUser();
    let parentRef: HTMLDivElement | undefined;

    const filteredAndSortedCards = createMemo(() => {
        let results = [...CARDS];
        const search = user.collectionFilterSearch();
        const tags = user.collectionFilterTags();
        const sortOption = user.collectionSort();
        const ownedIds = props.ownedIds;

        if (search) {
            const query = search.toLowerCase();
            results = results.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.baseText.toLowerCase().includes(query)
            );
        }

        if (tags.length > 0) {
            results = results.filter(c => {
                return tags.some(tag => {
                    if (tag === 'None') return c.tags.length === 0;
                    return c.tags.includes(tag);
                });
            });
        }

        return results.sort((a, b) => {
            const aOwned = ownedIds.includes(a.id);
            const bOwned = ownedIds.includes(b.id);
            if (aOwned !== bOwned) return aOwned ? -1 : 1;

            if (sortOption === 'Cost') return a.baseCost - b.baseCost;
            if (sortOption === 'Power') return b.basePower - a.basePower;
            if (sortOption === 'Newest') {
                const aIdx = CARDS.findIndex(c => c.id === a.id);
                const bIdx = CARDS.findIndex(c => c.id === b.id);
                return bIdx - aIdx;
            }
            return a.name.localeCompare(b.name);
        });
    });

    const COLS = 5;
    const rowCount = () => Math.ceil(filteredAndSortedCards().length / COLS);
    
    // Each card is roughly 5.2rem wide (at md scale), but here size='xs'.
    // size='xs' in Card component is scale 0.5.
    // Width is roughly 2.6rem + gaps.
    // Height is roughly 3.6rem.
    // I'll use a fixed height for virtual rows.
    const ROW_HEIGHT = 100; // px estimated

    const virtualizer = createVirtualizer({
        get count() { return rowCount(); },
        getScrollElement: () => parentRef ?? null,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });

    return (
        <div class="w-full h-full flex flex-col">
            <div 
                ref={(el) => {
                    parentRef = el;
                    props.scrollRef(el);
                }} 
                class="flex-1 overflow-y-auto scrollbar-hide px-2.5 pt-2 pb-52 touch-none select-none"
                onPointerDown={(e) => props.onPointerDown(e, null)} 
            >
                 <Show 
                    when={filteredAndSortedCards().length > 0} 
                    fallback={
                        <div class="w-full py-20 flex flex-col items-center justify-center text-slate-700 pointer-events-none">
                            <svg class="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <span class="text-[0.6rem] font-black uppercase tracking-widest">No matching cards</span>
                        </div>
                    }
                >
                     <div 
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                         <For each={virtualizer.getVirtualItems()}>
                            {(virtualRow) => {
                                const rowIdx = virtualRow.index;
                                const rowCards = () => filteredAndSortedCards().slice(rowIdx * COLS, (rowIdx + 1) * COLS);

                                return (
                                    <div 
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                        class="grid grid-cols-5 gap-x-1.5 justify-items-center"
                                    >
                                        <For each={rowCards()}>
                                            {(def) => {
                                                const isOwned = () => props.ownedIds.includes(def.id);
                                                const inDeck = () => props.activeDeckIds.includes(def.id);
                                                const isDragging = () => props.draggingCardId === def.id;
                                                
                                                const stateClasses = () => {
                                                    if (isDragging()) {
                                                        return 'opacity-0';
                                                    } else if (!isOwned()) {
                                                        return 'opacity-40 grayscale scale-95';
                                                    } else if (inDeck()) {
                                                        return 'opacity-50 grayscale'; 
                                                    } else {
                                                        return 'hover:scale-105'; 
                                                    }
                                                };

                                                return (
                                                    <div 
                                                        class={`relative transition-all duration-300 rounded-md w-full flex justify-center ${stateClasses()}`}
                                                        onPointerDown={(e) => {
                                                            e.stopPropagation(); 
                                                            props.onPointerDown(e, def);
                                                        }}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                    >
                                                        <div class="w-full aspect-[5/7] rounded-md transition-all duration-300 cursor-grab active:cursor-grabbing">
                                                            <Card 
                                                                card={def} 
                                                                size="xs" 
                                                                variant="default" 
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                );
                            }}
                         </For>
                     </div>
                 </Show>
                 
                 <div class="h-12 w-full flex items-center justify-center mt-12 mb-8 pointer-events-none">
                     <div class="text-[0.55rem] text-slate-800 font-black uppercase tracking-[0.5em]">Terminal Archive End</div>
                 </div>
            </div>
        </div>
    );
}
