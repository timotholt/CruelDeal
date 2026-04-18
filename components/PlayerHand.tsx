
import React from 'react';
import { useGame } from '../contexts/GameContext';
import { Card } from './Card';

export const PlayerHand: React.FC = () => {
    const { gameState, pendingMoves, dragState, actions } = useGame();

    if (!gameState) return <div className="flex-none min-h-[4.2rem]" />;

    const visibleCards = gameState.players.p1.hand
        .map((card, index) => ({ card, originalIndex: index }))
        .filter(({ card }) => !pendingMoves.some(m => m.cardInstanceId === card.instanceId));

    const count = visibleCards.length;

    /**
     * HAND SPACING LOGIC
     * Using strict max-widths and small gaps to prevent 'the snap' 
     * when the hand count changes.
     */
    let gapClass = 'gap-1';
    let wrapperWidthClass = 'max-w-[3.4rem]';

    if (count <= 3) {
        gapClass = 'gap-3';
        wrapperWidthClass = 'max-w-[4rem]';
    } else if (count >= 6) {
        gapClass = 'gap-0.5';
        wrapperWidthClass = 'max-w-[2.8rem]';
    }

    return (
        <div 
            className="flex-none flex items-center justify-center px-2 py-0.5 min-h-[4.2rem] overflow-visible"
            data-drop-zone="hand"
        >
            <div className={`flex items-center justify-center w-full max-w-lg h-full transition-all duration-300 ${gapClass}`}>
                {visibleCards.map(({ card, originalIndex }) => {
                    const isDraggingThis = dragState?.active && dragState.card.instanceId === card.instanceId && dragState.origin.type === 'hand';

                    return (
                        <div 
                            key={card.instanceId} 
                            className={`
                                flex-1 min-w-0 ${wrapperWidthClass} transition-all duration-200 
                                ${isDraggingThis ? 'opacity-0' : ''}
                            `}
                        >
                            <div className="w-full aspect-[5/7]">
                                <Card 
                                    card={card} 
                                    size="sm" 
                                    onClick={() => actions.handleCardClick(originalIndex, !!dragState?.active)}
                                    onPointerDown={(e) => actions.handleCardPointerDownHand(e, card, originalIndex)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
