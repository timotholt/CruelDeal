import { Show, For, createMemo } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { Card } from './Card';

export const PlayerHand = () => {
    const { gameState, pendingMoves, dragState, actions } = useGame();

    return (
        <Show when={gameState()} fallback={<div class="flex-none min-h-[4.2rem]" />}>
            {(s) => {
                const visibleCards = createMemo(() => s().players.p1.hand
                    .map((card, index) => ({ card, originalIndex: index }))
                    .filter(({ card }) => !pendingMoves().some(m => m.cardInstanceId === card.instanceId))
                );

                const count = () => visibleCards().length;

                const spacing = createMemo(() => {
                    let gapClass = 'gap-1';
                    let wrapperWidthClass = 'max-w-[3.4rem]';
                
                    const c = count();
                    if (c <= 3) {
                        gapClass = 'gap-3';
                        wrapperWidthClass = 'max-w-[4rem]';
                    } else if (c >= 6) {
                        gapClass = 'gap-0.5';
                        wrapperWidthClass = 'max-w-[2.8rem]';
                    }
                    return { gapClass, wrapperWidthClass };
                });

                return (
                    <div 
                        class="flex-none flex items-center justify-center px-2 py-0.5 min-h-[4.2rem] overflow-visible"
                        data-drop-zone="hand"
                    >
                        <div class={`flex items-center justify-center w-full max-w-lg h-full transition-all duration-300 ${spacing().gapClass}`}>
                            <For each={visibleCards()}>
                                {({ card, originalIndex }) => {
                                    const isDraggingThis = () => dragState()?.active && dragState()!.card.instanceId === card.instanceId && dragState()!.origin.type === 'hand';

                                    return (
                                        <div 
                                            class={`
                                                flex-1 min-w-0 ${spacing().wrapperWidthClass} transition-all duration-200 
                                                ${isDraggingThis() ? 'opacity-0' : ''}
                                            `}
                                        >
                                            <div class="w-full aspect-[5/7]">
                                                <Card 
                                                    card={card} 
                                                    size="sm" 
                                                    onClick={() => actions.handleCardClick(originalIndex, !!dragState()?.active)}
                                                    onPointerDown={(e: PointerEvent) => actions.handleCardPointerDownHand(e, card, originalIndex)}
                                                />
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                );
            }}
        </Show>
    );
};
