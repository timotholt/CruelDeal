
import React from 'react';
import { useGame } from '../contexts/GameContext';
import { Location } from './Location';
import { GameResultOverlay } from './game/GameResultOverlay';

export const GameBoard: React.FC = () => {
    const { 
        gameState, 
        pendingMoves, 
        isResolving, 
        isResultsHidden, 
        selectedCardIdx, 
        dragState, 
        actions 
    } = useGame();

    if (!gameState) return (
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">Initializing Sector...</span>
        </div>
    );

    // Helper for LIFO logic
    const lastPendingCardId = pendingMoves.length > 0 ? pendingMoves[pendingMoves.length - 1].cardInstanceId : null;

    return (
        <div className="flex-1 relative flex flex-col justify-center overflow-hidden px-2 pb-0">
            <div className="flex px-0.5 gap-1 h-full">
               {gameState.lanes.map((lane, idx) => (
                   <Location 
                      key={lane.location.id} 
                      lane={lane}
                      laneIndex={idx}
                      gameState={gameState}
                      onSelectForPlay={() => actions.handleLocationClick(idx)}
                      isPlayable={selectedCardIdx !== null && !isResolving}
                      selectedCardCost={selectedCardIdx !== null ? gameState.players.p1.hand[selectedCardIdx]?.totalCost ?? null : null}
                      pendingCards={pendingMoves.filter(m => m.laneIdx === idx).map(m => {
                          const hand = gameState.players.p1?.hand;
                          const card = hand ? hand.find(c => c && c.instanceId === m.cardInstanceId) : null;
                          return card ? { card, handIndex: 0 } : null;
                      }).filter((p): p is { card: any, handIndex: number } => p !== null)}
                      lastPendingCardId={lastPendingCardId}
                      onInspectCard={actions.inspectCard}
                      onInspectLocation={actions.inspectLocation}
                      onCardPointerDown={actions.handleCardPointerDownLane}
                      draggingCardId={dragState?.active ? dragState.card.instanceId : undefined}
                   />
               ))}
            </div>

            {/* Victory Overlay */}
            {gameState.winner && !isResultsHidden && (
                <GameResultOverlay winner={gameState.winner} />
            )}
        </div>
    );
};
