import { CardInstance, CardDefinition } from '../types';
import { UnifiedCardView } from './card/UnifiedCardView';

interface CardProps {
  card: CardInstance | CardDefinition;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  hidden?: boolean;
  onPointerDown?: (e: PointerEvent) => void;
  isDragging?: boolean;
  borderOverride?: string; 
  variant?: 'default' | 'thumbnail' | 'board';
}

/**
 * Card Component
 * A high-performance wrapper that delegates all rendering to the UnifiedCardView engine.
 */
export const Card = (props: CardProps) => {
  return (
    <UnifiedCardView
        card={props.card}
        size={props.size ?? 'md'}
        hidden={props.hidden}
        isDragging={props.isDragging}
        onPointerDown={props.onPointerDown}
        onClick={props.onClick}
        borderOverride={props.borderOverride}
    />
  );
};