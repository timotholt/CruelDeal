
import React, { useMemo } from 'react';
import { CARDS } from '../../constants';
import { Card } from '../Card';
import { CardDefinition } from '../../types';
import { useUser } from '../../contexts/UserContext';

interface CollectionGridProps {
    scrollRef: React.RefObject<HTMLDivElement>;
    ownedIds: string[];
    activeDeckIds: string[];
    draggingCardId?: string;
    onPointerDown: (e: React.PointerEvent, card: CardDefinition | null) => void;
}

export const CollectionGrid: React.FC<CollectionGridProps> = ({ 
    scrollRef, ownedIds, activeDeckIds, draggingCardId, onPointerDown 
}) => {
    const { collectionSort, collectionFilterSearch, collectionFilterTags } = useUser();

    const filteredAndSortedCards = useMemo(() => {
        let results = [...CARDS];

        if (collectionFilterSearch) {
            const query = collectionFilterSearch.toLowerCase();
            results = results.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.baseText.toLowerCase().includes(query)
            );
        }

        if (collectionFilterTags.length > 0) {
            results = results.filter(c => {
                return collectionFilterTags.some(tag => {
                    if (tag === 'None') return c.tags.length === 0;
                    return c.tags.includes(tag);
                });
            });
        }

        return results.sort((a, b) => {
            const aOwned = ownedIds.includes(a.id);
            const bOwned = ownedIds.includes(b.id);
            if (aOwned !== bOwned) return aOwned ? -1 : 1;

            if (collectionSort === 'Cost') return a.baseCost - b.baseCost;
            if (collectionSort === 'Power') return b.basePower - a.basePower;
            if (collectionSort === 'Newest') {
                const aIdx = CARDS.findIndex(c => c.id === a.id);
                const bIdx = CARDS.findIndex(c => c.id === b.id);
                return bIdx - aIdx;
            }
            return a.name.localeCompare(b.name);
        });
    }, [ownedIds, collectionSort, collectionFilterSearch, collectionFilterTags]);

    return (
        <div className="w-full h-full flex flex-col">
            {/* Optimized for 5-column layout with tight spacing */}
            <div 
                ref={scrollRef} 
                className="flex-1 overflow-hidden px-2.5 pt-2 pb-52 touch-none select-none"
                onPointerDown={(e) => onPointerDown(e, null)} 
            >
                 {filteredAndSortedCards.length === 0 ? (
                     <div className="w-full py-20 flex flex-col items-center justify-center text-slate-700 pointer-events-none">
                         <svg className="w-12 h-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                         <span className="text-[0.6rem] font-black uppercase tracking-widest">No matching cards</span>
                     </div>
                 ) : (
                     <div className="grid grid-cols-5 gap-x-1.5 gap-y-2.5 justify-items-center">
                         {filteredAndSortedCards.map((def) => {
                             const isOwned = ownedIds.includes(def.id);
                             const inDeck = activeDeckIds.includes(def.id);
                             const isDragging = draggingCardId === def.id;
                             
                             let stateClasses: string;
                             if (isDragging) {
                                 stateClasses = 'opacity-0';
                             } else if (!isOwned) {
                                 stateClasses = 'opacity-40 grayscale scale-95';
                             } else if (inDeck) {
                                 stateClasses = 'opacity-50 grayscale'; 
                             } else {
                                 stateClasses = 'hover:scale-105'; 
                             }

                             return (
                                 <div 
                                    key={def.id} 
                                    className={`relative transition-all duration-300 rounded-md w-full flex justify-center ${stateClasses}`}
                                    onPointerDown={(e) => {
                                        e.stopPropagation(); 
                                        onPointerDown(e, def);
                                    }}
                                    onContextMenu={(e) => e.preventDefault()}
                                 >
                                     <div className="w-full aspect-[5/7] rounded-md transition-all duration-300 cursor-grab active:cursor-grabbing">
                                         <Card 
                                            card={def} 
                                            size="xs" 
                                            variant="default" 
                                         />
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 )}
                 
                 <div className="h-12 w-full flex items-center justify-center mt-12 mb-8 pointer-events-none">
                     <div className="text-[0.55rem] text-slate-800 font-black uppercase tracking-[0.5em]">Terminal Archive End</div>
                 </div>
            </div>
        </div>
    );
}
