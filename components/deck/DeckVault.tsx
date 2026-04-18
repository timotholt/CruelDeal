import React from 'react';
import { CardDefinition } from '../../types';
import { Card } from '../Card';

interface DeckVaultProps {
    cards: CardDefinition[];
    draggingCardId?: string;
    onPointerDown: (e: React.PointerEvent, card: CardDefinition) => void;
}

export const DeckVault: React.FC<DeckVaultProps> = ({ cards, draggingCardId, onPointerDown }) => {
    const slots = Array.from({ length: 12 }).map((_, i) => cards[i] || null);

    return (
        <div className="grid grid-cols-6 gap-1">
            {slots.map((card, idx) => (
                <div key={idx} className="aspect-[5/7] w-full relative">
                    {card ? (
                        <div 
                            className={`w-full h-full animate-pop group cursor-grab active:cursor-grabbing transition-opacity touch-none ${draggingCardId === card.id ? 'opacity-0' : 'opacity-100'}`}
                            onPointerDown={(e) => onPointerDown(e, card)}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <Card card={card} size="xs" variant="thumbnail" />
                        </div>
                    ) : (
                        <div className="w-full h-full rounded-md border border-slate-700/50 bg-slate-950/40 flex items-center justify-center shadow-inner">
                            <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};