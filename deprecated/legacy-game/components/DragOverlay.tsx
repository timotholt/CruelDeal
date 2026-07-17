import { Show } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { Card } from './Card';

export const DragOverlay = () => {
    const { dragState } = useGame();
    
    return (
        <Show when={dragState()}>
            {(d) => {
                const dragSize = () => d().origin.type === 'hand' ? 'sm' : 'xs';

                return (
                    <div 
                        class="fixed z-[999] pointer-events-none opacity-90 transition-transform duration-75"
                        style={{
                            left: `${d().currentPos.x - d().offset.x}px`,
                            top: `${d().currentPos.y - d().offset.y}px`,
                            transform: 'scale(1.05)' // Subtle lift feel
                        }}
                    >
                        <Card 
                            card={d().card} 
                            size={dragSize()} 
                            isDragging={false}
                        />
                    </div>
                );
            }}
        </Show>
    );
};
