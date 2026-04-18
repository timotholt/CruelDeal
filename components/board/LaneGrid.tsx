import { For, Show } from 'solid-js';
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
    onCardPointerDown: (e: PointerEvent, card: CardInstance, laneIdx: number) => void;
}

export const LaneGrid = (props: LaneGridProps) => {
    // ABSOLUTE POSITIONING STRATEGY
    const getPosition = (slotIdx: number, isOpp: boolean) => {
        if (!isOpp) {
            return {
                top: slotIdx < 2 ? '0%' : '50%',
                left: (slotIdx % 2 === 0) ? '0%' : '50%',
                'z-index': slotIdx + 10 
            };
        } else {
            return {
                top: slotIdx < 2 ? '50%' : '0%',
                left: (slotIdx % 2 === 0) ? '50%' : '0%',
                'z-index': slotIdx + 10
            };
        }
    };

    return (
        <div class="relative w-full h-full isolate">
            {/* Grid Guides */}
            <div class="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1 pointer-events-none opacity-20">
                <For each={[0, 1, 2, 3]}>
                    {() => (
                        <div class="rounded-md border border-slate-500/30 bg-slate-800/20 w-full h-full" />
                    )}
                </For>
            </div>

            {/* Render Cards */}
            <For each={props.slots}>
                {(card, currentSlotIdx) => (
                    <Show when={card}>
                        {(c) => {
                            const isPending = () => !props.isOpponent && props.pendingCards.some(p => p.card.instanceId === c().instanceId);
                            const isLocked = () => isPending() && props.lastPendingCardId && c().instanceId !== props.lastPendingCardId;
                            const isDraggingThis = () => c().instanceId === props.draggingCardId;
                            
                            const pos = () => getPosition(currentSlotIdx(), props.isOpponent);

                            return (
                                <div 
                                  class={`
                                      absolute w-[48%] h-[48%] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                                      ${isDraggingThis() ? 'opacity-0' : ''}
                                  `}
                                  style={pos()}
                                >
                                    <div class={`w-full h-full ${isPending() ? 'opacity-80' : ''} ${isLocked() ? '!opacity-60 contrast-75 grayscale-[0.5]' : ''}`}>
                                        <Card 
                                          card={c()} 
                                          hidden={!c().faceUp} 
                                          size="xs"
                                          variant="board"
                                          onPointerDown={isPending() && !isLocked() ? (e: PointerEvent) => props.onCardPointerDown(e, c(), props.laneIdx) : undefined}
                                          onClick={() => c().faceUp && props.onInspectCard(c())}
                                        />
                                    </div>
                                </div>
                            );
                        }}
                    </Show>
                )}
            </For>
        </div>
    );
};