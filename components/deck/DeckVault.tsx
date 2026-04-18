import { For } from 'solid-js';
import { CardDefinition } from '../../types';
import { Card } from '../Card';

interface DeckVaultProps {
    cards: CardDefinition[];
    draggingCardId?: string;
    onPointerDown: (e: PointerEvent, card: CardDefinition) => void;
}

export const DeckVault = (props: DeckVaultProps) => {
    const slots = () => Array.from({ length: 12 }).map((_, i) => props.cards[i] || null);

    return (
        <div class="grid grid-cols-6 gap-1">
            <For each={slots()}>
                {(card, _idx) => (
                    <div class="aspect-[5/7] w-full relative">
                        {card ? (
                            <div 
                                class={`w-full h-full animate-pop group cursor-grab active:cursor-grabbing transition-opacity touch-none ${props.draggingCardId === card.id ? 'opacity-0' : 'opacity-100'}`}
                                onPointerDown={(e) => props.onPointerDown(e, card)}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <Card card={card} size="xs" variant="thumbnail" />
                            </div>
                        ) : (
                            <div class="w-full h-full rounded-md border border-slate-700/50 bg-slate-950/40 flex items-center justify-center shadow-inner">
                                <div class="w-1 h-1 rounded-full bg-slate-800" />
                            </div>
                        )}
                    </div>
                )}
            </For>
        </div>
    );
};
