import React from 'react';
import { Lane, GameState, CardInstance, CardDefinition, LocationDefinition } from '../types';
import { calculateLanePower, getProjectedLaneState } from '../services/selectors';
import { LaneGrid } from './board/LaneGrid';
import { LocationCenter } from './game/LocationCenter';

interface LocationProps {
  lane: Lane;
  laneIndex: number;
  gameState: GameState;
  onSelectForPlay: () => void;
  isPlayable: boolean;
  selectedCardCost: number | null;
  pendingCards: { card: CardInstance, handIndex: number }[]; 
  lastPendingCardId: string | null;
  onInspectCard: (card: CardInstance | CardDefinition) => void;
  onInspectLocation: (location: LocationDefinition) => void;
  onCardPointerDown: (e: React.PointerEvent, card: CardInstance, laneIdx: number) => void;
  draggingCardId?: string;
}

const LocationComponent: React.FC<LocationProps> = ({ 
    lane, laneIndex, gameState, onSelectForPlay, isPlayable, 
    pendingCards, lastPendingCardId, onInspectCard, onInspectLocation, onCardPointerDown, draggingCardId
}) => {
  
  const playerPower = calculateLanePower(lane, 'p1', gameState);
  const opponentPower = calculateLanePower(lane, 'p2', gameState);

  let winningPlayer: 'p1' | 'p2' | 'tie' = 'tie';
  if (playerPower > opponentPower) winningPlayer = 'p1';
  if (opponentPower > playerPower) winningPlayer = 'p2';

  const winningClass = winningPlayer === 'p1' 
    ? 'border-green-500/30 bg-green-900/10' 
    : (winningPlayer === 'p2' ? 'border-red-500/30 bg-red-900/10' : 'border-slate-700');

  const p1ProjectedSlots = getProjectedLaneState(gameState, laneIndex, pendingCards);
  const p2Slots = lane.p2Slots;

  return (
    <div 
        className={`flex-1 flex flex-col ${winningClass} relative transition-colors duration-500`}
        data-drop-zone="lane"
        data-lane-idx={laneIndex}
    >
      {/* OPPONENT GRID (Top) */}
      <div className="w-full flex-none flex items-start justify-center pt-1">
          <div className="w-full p-0.5 aspect-[10/14]">
             <LaneGrid 
                slots={p2Slots} 
                laneIdx={laneIndex}
                isOpponent={true} 
                pendingCards={[]} 
                lastPendingCardId={null}
                onInspectCard={onInspectCard}
                onCardPointerDown={() => {}} 
             />
          </div>
      </div>

      {/* CENTER (Power & Location Card) */}
      <LocationCenter 
        locationDef={lane.location.def}
        playerPower={playerPower}
        opponentPower={opponentPower}
        winningPlayer={winningPlayer}
        onInspect={() => onInspectLocation(lane.location.def)}
      />

      {/* PLAYER GRID (Bottom) */}
      <div 
        onClick={isPlayable ? onSelectForPlay : undefined}
        className={`w-full flex-none flex items-end justify-center relative transition-all pb-1
            ${isPlayable ? 'bg-green-500/10 cursor-pointer hover:bg-green-500/20' : ''}
        `}
      >
         <div className="w-full p-0.5 aspect-[10/14] z-10">
            <LaneGrid 
                slots={p1ProjectedSlots} 
                laneIdx={laneIndex}
                isOpponent={false} 
                pendingCards={pendingCards} 
                lastPendingCardId={lastPendingCardId}
                draggingCardId={draggingCardId}
                onInspectCard={onInspectCard}
                onCardPointerDown={onCardPointerDown}
             />
         </div>
      </div>
    </div>
  );
};

export const Location = React.memo(LocationComponent);