
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../../contexts/UserContext';
import { CARDS } from '../../constants';
import { SlantedButton } from '../ui/SlantedButton';
import { GameText } from '../ui/GameText';

interface DeckSelectorProps {
    activeDeckId: number;
    onSelectDeck: (id: number) => void;
}

export const DeckSelectorClassic: React.FC<DeckSelectorProps> = ({ activeDeckId, onSelectDeck }) => {
    const { user } = useUser();
    const [flippedId, setFlippedId] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const centerActiveItem = useCallback((smooth: boolean = true) => {
        if (containerRef.current) {
            const container = containerRef.current;
            const activeElement = container.querySelector(`[data-active="true"]`) as HTMLElement;
            
            if (activeElement) {
                const elementOffset = activeElement.offsetLeft;
                const elementWidth = activeElement.offsetWidth;
                const containerWidth = container.offsetWidth;
                
                if (containerWidth === 0) return;
                const targetScroll = elementOffset - (containerWidth / 2) + (elementWidth / 2);
                container.scrollTo({ left: targetScroll, behavior: smooth ? 'smooth' : 'auto' });
            }
        }
    }, []);

    useEffect(() => { centerActiveItem(true); }, [activeDeckId, centerActiveItem]);
    useEffect(() => {
        const timer = setTimeout(() => centerActiveItem(true), 550);
        return () => clearTimeout(timer);
    }, [centerActiveItem]);

    const handleDeckClick = (id: number) => {
        if (activeDeckId === id) setFlippedId(flippedId === id ? null : id);
        else { onSelectDeck(id); setFlippedId(null); }
    };

    const getStats = (deckId: number) => {
        const cardIds = user.decks[deckId] || [];
        if (cardIds.length === 0) return { avgCost: 0, avgPower: 0, count: 0 };
        const deckCards = cardIds.map(id => CARDS.find(c => c.id === id)).filter(Boolean);
        const totalCost = deckCards.reduce((acc, c) => acc + (c?.baseCost || 0), 0);
        const totalPower = deckCards.reduce((acc, c) => acc + (c?.basePower || 0), 0);
        return {
            avgCost: (totalCost / deckCards.length).toFixed(1),
            avgPower: (totalPower / deckCards.length).toFixed(1),
            count: deckCards.length
        };
    };

    const deckIds = Object.keys(user.decks).map(Number).sort((a, b) => a - b);

    return (
        <div ref={containerRef} className="w-full flex overflow-x-auto pt-2 pb-0.5 px-3 gap-2 shrink-0 scrollbar-hide perspective-1000">
            {deckIds.map(i => {
                const isSelected = activeDeckId === i;
                const isFlipped = flippedId === i && isSelected;
                const stats = getStats(i);
                const deckName = user.deckNames[i] || 'UNTITLED';
                const isValid = stats.count === 12;
                const selectedVariant = isValid ? 'success' : 'danger';

                return (
                    <div key={i} data-active={isSelected} className="min-w-[7.5rem] h-14 relative shrink-0">
                        <div className={`w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                            <div className="absolute inset-0 backface-hidden">
                                <SlantedButton variant={isSelected ? selectedVariant : 'secondary'} fullWidth size="md" className="!h-full" onClick={() => handleDeckClick(i)}>
                                    <div className="flex flex-col items-center justify-center w-full h-full pointer-events-none pt-1 pb-0.5">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[0.45rem] font-black text-white/40 uppercase tracking-widest">Deck {i < 10 ? `0${i}` : i}</span>
                                            {!isValid && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.8)]" />}
                                        </div>
                                        <div className="flex-1 w-full min-h-0 flex items-center justify-center">
                                            <GameText text={deckName} baseFontSize={1.05} maxLines={2} className="text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                </SlantedButton>
                            </div>
                            <div className="absolute inset-0 backface-hidden rotate-y-180">
                                <SlantedButton variant={isValid ? 'success' : 'danger'} fullWidth size="md" className="!h-full" onClick={() => handleDeckClick(i)}>
                                    <div className="flex items-center justify-around w-full h-full px-1">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[0.4rem] font-black uppercase text-white/60 leading-none mb-1">Cost</span>
                                            <span className="text-sm font-black text-white italic">{stats.avgCost}</span>
                                        </div>
                                        <div className="w-px h-8 bg-white/20" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-[0.4rem] font-black uppercase text-white/60 leading-none mb-1">Power</span>
                                            <span className="text-sm font-black text-white italic">{stats.avgPower}</span>
                                        </div>
                                    </div>
                                </SlantedButton>
                            </div>
                        </div>
                    </div>
                );
            })}
            <style>{`.perspective-1000 { perspective: 1000px; } .transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); }`}</style>
        </div>
    );
};
