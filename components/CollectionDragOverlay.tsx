import React from 'react';
import { CollectionDragState } from '../hooks/useCollectionDrag';
import { Card } from './Card';

interface CollectionDragOverlayProps {
    dragState: CollectionDragState | null;
}

export const CollectionDragOverlay: React.FC<CollectionDragOverlayProps> = ({ dragState }) => {
    if (!dragState || !dragState.active) return null;

    return (
        <div 
            className="fixed z-[9999] pointer-events-none opacity-90 transition-transform duration-75 will-change-transform"
            style={{
                left: dragState.currentPos.x - dragState.offset.x,
                top: dragState.currentPos.y - dragState.offset.y,
                width: dragState.rect.width,
                height: dragState.rect.height,
                transform: 'scale(1.1) rotate(2deg)',
            }}
        >
            <Card 
                card={dragState.card} 
                size="xs" 
                variant={dragState.origin === 'vault' ? 'thumbnail' : 'default'} 
            />
            {/* Soft Shadow lift effect */}
            <div className="absolute inset-0 bg-black/40 blur-xl -z-10 translate-y-4 scale-90 rounded-xl" />
        </div>
    );
};