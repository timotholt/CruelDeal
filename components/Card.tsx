import React from 'react';
import { CardInstance, CardDefinition } from '../types';
import { UnifiedCardView } from './card/UnifiedCardView';

interface CardProps {
  card: CardInstance | CardDefinition;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  hidden?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  isDragging?: boolean;
  borderOverride?: string; 
  // Added variant prop to fix layout errors in sub-components
  variant?: 'default' | 'thumbnail' | 'board';
}

/**
 * Card Component
 * A high-performance wrapper that delegates all rendering to the UnifiedCardView engine.
 */
const CardComponent: React.FC<CardProps> = ({ 
  card, 
  onClick, 
  size = 'md', 
  hidden, 
  onPointerDown,
  isDragging,
  borderOverride
}) => {
  return (
    <UnifiedCardView
        card={card}
        size={size}
        hidden={hidden}
        isDragging={isDragging}
        onPointerDown={onPointerDown}
        onClick={onClick}
        borderOverride={borderOverride}
    />
  );
};

export const Card = React.memo(CardComponent, (prev, next) => {
    if (prev.size !== next.size || prev.isDragging !== next.isDragging || prev.hidden !== next.hidden || prev.borderOverride !== next.borderOverride) return false;
    
    const isInstance = (c: any): c is CardInstance => c && 'instanceId' in c;
    
    if (isInstance(prev.card) && isInstance(next.card)) {
        return prev.card.instanceId === next.card.instanceId && 
               prev.card.totalPower === next.card.totalPower && 
               prev.card.totalCost === next.card.totalCost &&
               prev.card.faceUp === next.card.faceUp;
    }
    
    const getDefinitionId = (card: CardInstance | CardDefinition) => 
        isInstance(card) ? card.definitionId : card.id;

    return getDefinitionId(prev.card) === getDefinitionId(next.card);
});