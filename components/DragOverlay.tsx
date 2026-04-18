
import React from 'react';
import { useGame } from '../contexts/GameContext';
import { Card } from './Card';

export const DragOverlay: React.FC = () => {
    const { dragState } = useGame();
    
    if (!dragState) return null;

    /**
     * UNIFIED DRAG SCALING
     * We use the size class that corresponds to the origin to maintain 
     * perfect visual continuity during the gesture.
     */
    const dragSize = dragState.origin.type === 'hand' ? 'sm' : 'xs';

    return (
        <div 
            className="fixed z-[999] pointer-events-none opacity-90 transition-transform duration-75"
            style={{
                left: dragState.currentPos.x - dragState.offset.x,
                top: dragState.currentPos.y - dragState.offset.y,
                transform: 'scale(1.05)' // Subtle lift feel
            }}
        >
            <Card 
                card={dragState.card} 
                size={dragSize} 
                isDragging={false}
            />
        </div>
    );
};
