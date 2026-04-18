import { createMemo } from 'solid-js';
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
  onCardPointerDown: (e: PointerEvent, card: CardInstance, laneIdx: number) => void;
  draggingCardId?: string;
}

export const Location = (props: LocationProps) => {
  const playerPower = createMemo(() => calculateLanePower(props.lane, 'p1', props.gameState));
  const opponentPower = createMemo(() => calculateLanePower(props.lane, 'p2', props.gameState));

  const winningPlayer = createMemo(() => {
     if (playerPower() > opponentPower()) return 'p1';
     if (opponentPower() > playerPower()) return 'p2';
     return 'tie';
  });

  const winningClass = createMemo(() => winningPlayer() === 'p1' 
    ? 'border-green-500/30 bg-green-900/10' 
    : (winningPlayer() === 'p2' ? 'border-red-500/30 bg-red-900/10' : 'border-slate-700')
  );

  const p1ProjectedSlots = createMemo(() => getProjectedLaneState(props.gameState, props.laneIndex, props.pendingCards));
  const p2Slots = () => props.lane.p2Slots;

  return (
    <div 
        class={`flex-1 flex flex-col ${winningClass()} relative transition-colors duration-500`}
        data-drop-zone="lane"
        data-lane-idx={props.laneIndex}
    >
      {/* OPPONENT GRID (Top) */}
      <div class="w-full flex-none flex items-start justify-center pt-1">
          <div class="w-full p-0.5 aspect-[10/14]">
             <LaneGrid 
                slots={p2Slots()} 
                laneIdx={props.laneIndex}
                isOpponent={true} 
                pendingCards={[]} 
                lastPendingCardId={null}
                onInspectCard={props.onInspectCard}
                onCardPointerDown={() => {}} 
             />
          </div>
      </div>

      {/* CENTER (Power & Location Card) */}
      <LocationCenter 
        locationDef={props.lane.location.def}
        playerPower={playerPower()}
        opponentPower={opponentPower()}
        winningPlayer={winningPlayer()}
        onInspect={() => props.onInspectLocation(props.lane.location.def)}
      />

      {/* PLAYER GRID (Bottom) */}
      <div 
        onClick={(_e) => props.isPlayable && props.onSelectForPlay()}
        class={`w-full flex-none flex items-end justify-center relative transition-all pb-1
            ${props.isPlayable ? 'bg-green-500/10 cursor-pointer hover:bg-green-500/20' : ''}
        `}
      >
         <div class="w-full p-0.5 aspect-[10/14] z-10">
            <LaneGrid 
                slots={p1ProjectedSlots()} 
                laneIdx={props.laneIndex}
                isOpponent={false} 
                pendingCards={props.pendingCards} 
                lastPendingCardId={props.lastPendingCardId}
                draggingCardId={props.draggingCardId}
                onInspectCard={props.onInspectCard}
                onCardPointerDown={props.onCardPointerDown}
             />
         </div>
      </div>
    </div>
  );
};