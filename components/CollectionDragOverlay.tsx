import { Show } from 'solid-js';
import { CollectionDragState } from '../hooks/useCollectionDrag';
import { Card } from './Card';

interface CollectionDragOverlayProps {
    dragState: () => CollectionDragState | null;
}

export const CollectionDragOverlay = (props: CollectionDragOverlayProps) => {
    return (
        <Show when={props.dragState()}>
            {(state) => (
                <div 
                    class="fixed z-[9999] pointer-events-none opacity-90 transition-transform duration-75 will-change-transform"
                    style={{
                        left: `${state().currentPos.x - state().offset.x}px`,
                        top: `${state().currentPos.y - state().offset.y}px`,
                        width: `${state().rect.width}px`,
                        height: `${state().rect.height}px`,
                        transform: 'scale(1.1) rotate(2deg)',
                    }}
                >
                    <Card 
                        card={state().card} 
                        size="xs" 
                        variant={state().origin === 'vault' ? 'thumbnail' : 'default'} 
                    />
                    {/* Soft Shadow lift effect */}
                    <div class="absolute inset-0 bg-black/40 blur-xl -z-10 translate-y-4 scale-90 rounded-xl" />
                </div>
            )}
        </Show>
    );
};
