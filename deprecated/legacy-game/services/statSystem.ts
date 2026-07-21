
import { GameState, CardInstance } from '../types';
import { ONGOING_EFFECTS } from './ongoingEffects';
import { resetContinuousStats, addContinuousModifier } from './statHelpers';

// --- Continuous Effects Engine ---

export const applyContinuousEffects = (state: GameState): GameState => {
  // Note: This mutates the provided state object (which should be a clone or draft)
  
  // 1. Collect all cards that can have stats (Hand + Board)
  const allCards = [
      ...state.players.p1.hand, ...state.players.p2.hand,
      ...state.lanes.flatMap(l => [...l.p1Slots, ...l.p2Slots])
  ];

  // 2. Reset totals to Base+Permanent
  allCards.forEach(card => {
      if (!card) return;
      resetContinuousStats(card);
  });

  // 3. Apply Location Effects (Layer 1) - Only applies to board
  state.lanes.forEach(lane => {
      [...lane.p1Slots, ...lane.p2Slots].forEach(card => {
          if (!card) return;
          
          if (lane.location.def.effect === 'PowerPlantEffect') {
             addContinuousModifier(card, { source: lane.location.def.name, value: 1, type: 'CONTINUOUS' });
          }
      });
  });

  // 4. Apply Ongoing Effects (Layer 2)
  const runEffect = (source: CardInstance, lIdx: number, sIdx: number) => {
      if (source.def.tags.includes('Ongoing')) {
          const effectFn = ONGOING_EFFECTS[source.def.effect];
          if (effectFn) {
              effectFn(state, lIdx, sIdx, source);
          }
      }
  };

  // Process Board (Must be faceUp)
  state.lanes.forEach((lane, laneIdx) => {
     lane.p1Slots.forEach((c, i) => c && c.faceUp && runEffect(c, laneIdx, i));
     lane.p2Slots.forEach((c, i) => c && c.faceUp && runEffect(c, laneIdx, i));
  });

  // Process Hands (Passive cost/power mods work in hand)
  state.players.p1.hand.forEach(c => runEffect(c, -1, -1));
  state.players.p2.hand.forEach(c => runEffect(c, -1, -1));

  return state;
};
