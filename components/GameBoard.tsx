import { Show, For } from 'solid-js';
import { useGame } from '../contexts/GameContext';
import { Location } from './Location';
import { GameResultOverlay } from './game/GameResultOverlay';

export const GameBoard = () => {
    const { 
        gameState, 
        pendingMoves, 
        isResolving, 
        isResultsHidden, 
        selectedCardIdx, 
        dragState, 
        actions 
    } = useGame();

    return (
        <Show when={gameState()} fallback={
            <div class="flex-1 flex flex-col items-center justify-center">
                <div class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
                <span class="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Initializing Sector...</span>
            </div>
        }>
            {(s) => {
                const lastPendingCardId = () => pendingMoves().length > 0 ? pendingMoves()[pendingMoves().length - 1].cardInstanceId : null;
                
                return (
                    <div class="flex-1 relative flex flex-col justify-center overflow-hidden px-2 pb-0">
                        <div class="flex px-0.5 gap-1 h-full">
                           <For each={s().lanes}>
                               {(lane, idx) => (
                                   <Location 
                                      lane={lane}
                                      laneIndex={idx()}
                                      gameState={s()}
                                      onSelectForPlay={() => actions.handleLocationClick(idx())}
                                      isPlayable={selectedCardIdx() !== null && !isResolving()}
                                      selectedCardCost={selectedCardIdx() !== null ? s().players.p1.hand[selectedCardIdx()!]?.totalCost ?? null : null}
                                      pendingCards={pendingMoves().filter(m => m.laneIdx === idx()).map(m => {
                                          const hand = s().players.p1?.hand;
                                          const card = hand ? hand.find(c => c && c.instanceId === m.cardInstanceId) : null;
                                          return card ? { card, handIndex: 0 } : null;
                                      }).filter((p): p is { card: any, handIndex: number } => p !== null)}
                                      lastPendingCardId={lastPendingCardId()}
                                      onInspectCard={actions.inspectCard}
                                      onInspectLocation={actions.inspectLocation}
                                      onCardPointerDown={actions.handleCardPointerDownLane}
                                      draggingCardId={dragState()?.active ? dragState()!.card.instanceId : undefined}
                                   />
                               )}
                           </For>
                        </div>
            
                        {/* Victory Overlay */}
                        <Show when={s().winner && !isResultsHidden()}>
                            <GameResultOverlay winner={s().winner!} />
                        </Show>
                    </div>
                );
            }}
        </Show>
    );
};
