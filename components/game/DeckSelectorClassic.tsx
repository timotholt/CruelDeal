import { createSignal, createEffect, onCleanup, For } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { CARDS } from '../../constants';
import { SlantedButton } from '../ui/SlantedButton';
import { GameText } from '../ui/GameText';

interface DeckSelectorProps {
    activeDeckId: number;
    onSelectDeck: (id: number) => void;
}

/**
 * DECK SELECTOR CLASSIC
 * Flat horizontal carousel for consistent deck selection.
 */
export const DeckSelectorClassic = (props: DeckSelectorProps) => {
    const user = useUser();
    const [flippedId, setFlippedId] = createSignal<number | null>(null);
    let containerRef: HTMLDivElement | undefined;

    const centerActiveItem = (smooth: boolean = true) => {
        if (containerRef) {
            const container = containerRef;
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
    };

    createEffect(() => {
        // Track activeDeckId to re-center
        void props.activeDeckId;
        centerActiveItem(true);
    });

    createEffect(() => {
        const timer = setTimeout(() => centerActiveItem(true), 550);
        onCleanup(() => clearTimeout(timer));
    });

    const handleDeckClick = (id: number) => {
        if (props.activeDeckId === id) setFlippedId(flippedId() === id ? null : id);
        else { props.onSelectDeck(id); setFlippedId(null); }
    };

    const getStats = (deckId: number) => {
        const cardIds = user.user.decks[deckId] || [];
        if (cardIds.length === 0) return { avgCost: "0.0", avgPower: "0.0", count: 0 };
        const deckCards = cardIds.map(id => CARDS.find(c => c.id === id)).filter((c): c is any => !!c);
        const totalCost = deckCards.reduce((acc, c) => acc + (c.baseCost || 0), 0);
        const totalPower = deckCards.reduce((acc, c) => acc + (c.basePower || 0), 0);
        return {
            avgCost: (totalCost / Math.max(1, deckCards.length)).toFixed(1),
            avgPower: (totalPower / Math.max(1, deckCards.length)).toFixed(1),
            count: deckCards.length
        };
    };

    const deckIds = () => Object.keys(user.user.decks).map(Number).sort((a, b) => a - b);

    return (
        <div ref={(el) => containerRef = el} class="w-full flex overflow-x-auto pt-2 pb-0.5 px-3 gap-2 shrink-0 scrollbar-hide perspective-1000">
            <For each={deckIds()}>
                {(i) => {
                    const isSelected = () => props.activeDeckId === i;
                    const isFlipped = () => flippedId() === i && isSelected();
                    const stats = getStats(i);
                    const deckName = () => user.user.deckNames[i] || 'UNTITLED';
                    const isValid = stats.count === 12;
                    const selectedVariant = isValid ? 'success' : 'danger';

                    return (
                        <div data-active={isSelected()} class="min-w-[7.5rem] h-14 relative shrink-0">
                            <div class={`w-full h-full relative transition-transform duration-500 transform-style-3d ${isFlipped() ? 'rotate-y-180' : ''}`}>
                                <div class="absolute inset-0 backface-hidden">
                                    <SlantedButton variant={isSelected() ? (selectedVariant as any) : 'secondary'} fullWidth size="md" class="!h-full" onClick={() => handleDeckClick(i)}>
                                        <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none pt-1 pb-0.5">
                                            <div class="flex items-center gap-1">
                                                <span class="text-[0.45rem] font-black text-white/40 uppercase tracking-widest">Deck {i < 10 ? `0${i}` : i}</span>
                                                {!isValid && <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.8)]" />}
                                            </div>
                                            <div class="flex-1 w-full min-h-0 flex items-center justify-center">
                                                <GameText text={deckName()} baseFontSize={1.05} maxLines={2} class="text-white drop-shadow-md" />
                                            </div>
                                        </div>
                                    </SlantedButton>
                                </div>
                                <div class="absolute inset-0 backface-hidden rotate-y-180">
                                    <SlantedButton variant={isValid ? 'success' : 'danger'} fullWidth size="md" class="!h-full" onClick={() => handleDeckClick(i)}>
                                        <div class="flex items-center justify-around w-full h-full px-1">
                                            <div class="flex flex-col items-center">
                                                <span class="text-[0.4rem] font-black uppercase text-white/60 leading-none mb-1">Cost</span>
                                                <span class="text-sm font-black text-white italic">{stats.avgCost}</span>
                                            </div>
                                            <div class="w-px h-8 bg-white/20" />
                                            <div class="flex flex-col items-center">
                                                <span class="text-[0.4rem] font-black uppercase text-white/60 leading-none mb-1">Power</span>
                                                <span class="text-sm font-black text-white italic">{stats.avgPower}</span>
                                            </div>
                                        </div>
                                    </SlantedButton>
                                </div>
                            </div>
                        </div>
                    );
                }}
            </For>
            <style>{`.perspective-1000 { perspective: 1000px; } .transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; } .rotate-y-180 { transform: rotateY(180deg); }`}</style>
        </div>
    );
};
