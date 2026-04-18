import React from 'react';
import { CardInstance, CardDefinition } from '../../types';
import { Card } from '../Card';

interface LaneGridProps {
    slots: (CardInstance | null)[];
    laneIdx: number;
    isOpponent: boolean;
    pendingCards: { card: CardInstance, handIndex: number }[]; 
    lastPendingCardId: string | null;
    draggingCardId?: string;
    onInspectCard: (card: CardInstance | CardDefinition) => void;
    onCardPointerDown: (e: React.PointerEvent, card: CardInstance, laneIdx: number) => void;
}

const LaneGridComponent: React.FC<LaneGridProps> = ({ 
    slots, 
    laneIdx,
    isOpponent, 
    pendingCards, 
    lastPendingCardId, 
    draggingCardId,
    onInspectCard,
    onCardPointerDown
}) => {
    // ABSOLUTE POSITIONING STRATEGY
    const getPosition = (slotIdx: number, isOpp: boolean) => {
        if (!isOpp) {
            return {
                top: slotIdx < 2 ? '0%' : '50%',
                left: (slotIdx % 2 === 0) ? '0%' : '50%',
                zIndex: slotIdx + 10 
            };
        } else {
            return {
                top: slotIdx < 2 ? '50%' : '0%',
                left: (slotIdx % 2 === 0) ? '50%' : '0%',
                zIndex: slotIdx + 10
            };
        }
    };

    return (
        <div className="relative w-full h-full isolate">
            {/* Grid Guides */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 pointer-events-none opacity-20">
                {[0,1,2,3].map(i => (
                    <div key={i} className="rounded-md border border-slate-500/30 bg-slate-800/20 w-full h-full"></div>
                ))}
            </div>

            {/* Render Cards */}
            {slots.map((card, currentSlotIdx) => {
                if (!card) return null;

                const isPending = !isOpponent && pendingCards.some(p => p.card.instanceId === card.instanceId);
                const isLocked = isPending && lastPendingCardId && card.instanceId !== lastPendingCardId;
                const isDraggingThis = card.instanceId === draggingCardId;
                
                const { top, left, zIndex } = getPosition(currentSlotIdx, isOpponent);

                return (
                    <div 
                      key={card.instanceId}
                      className={`
                          absolute w-[48%] h-[48%] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                          ${isDraggingThis ? 'opacity-0' : ''}
                      `}
                      style={{ top, left, zIndex }}
                    >
                        <div className={`w-full h-full ${isPending ? 'opacity-80' : ''} ${isLocked ? '!opacity-60 contrast-75 grayscale-[0.5]' : ''}`}>
                            <Card 
                              card={card} 
                              hidden={!card.faceUp} 
                              size="xs"
                              variant="board"
                              onPointerDown={isPending && !isLocked ? (e) => onCardPointerDown(e, card, laneIdx) : undefined}
                              onClick={() => card.faceUp && onInspectCard(card)}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const LaneGrid = React.memo(LaneGridComponent);