
import { GameState, PlayerID } from '../../types';
import { MAX_ENERGY } from '../../config';
import { PendingMove } from '../planning';
import { cloneState, playCardFromHand, drawCard, queueEvent } from '../mutations';
import { calculateLanePower } from '../selectors';
import { queueTagTriggers, queueAbility } from '../triggers';
import { applyContinuousEffects } from '../statSystem';

export const moveCardsToBoard = (state: GameState, p1Moves: PendingMove[], p2Moves: PendingMove[]): GameState => {
    let s = cloneState(state);
    p1Moves.forEach(move => { s = playCardFromHand(s, move.cardInstanceId, move.laneIdx); });
    p2Moves.forEach(move => { s = playCardFromHand(s, move.cardInstanceId, move.laneIdx); });
    return applyContinuousEffects(s);
};

// Updated: Only queues the reveal ability, does NOT drain queue automatically
export const revealCard = (state: GameState, laneIdx: number, slotIdx: number, owner: PlayerID): GameState => {
    let s = cloneState(state);
    const lane = s.lanes[laneIdx];
    const slot = owner === 'p1' ? lane.p1Slots[slotIdx] : lane.p2Slots[slotIdx];

    if (!slot) return s;

    slot.faceUp = true;
    s = applyContinuousEffects(s); 

    if (slot.def.tags.includes('OnReveal')) {
        s = queueAbility(s, slot, 'OnReveal');
    }

    if (slot.def.sfxOnReveal) {
        s = queueEvent(s, { type: 'SFX_PLAY', sfxId: slot.def.sfxOnReveal });
    }
    if (slot.def.vfxOnReveal) {
        s = queueEvent(s, { type: 'VFX_PLAY', vfxId: slot.def.vfxOnReveal, laneIdx, slotIdx, playerId: owner });
    }

    return s;
};

// Updated: Only queues, doesn't drain
export const resolveEndOfTurn = (state: GameState): GameState => {
    let s = cloneState(state);
    s = queueTagTriggers(s, 'EndOfTurn');
    return s;
};

// Updated: Only queues, doesn't drain
export const startNextTurn = (state: GameState): GameState => {
    let s = cloneState(state);
    
    s.turn++;
    s.players.p1.energy = Math.min(s.turn, MAX_ENERGY);
    s.players.p2.energy = Math.min(s.turn, MAX_ENERGY);
    
    s = drawCard(s, 'p1');
    s = drawCard(s, 'p2');

    const p1Power = s.lanes.reduce((acc, l) => acc + calculateLanePower(l, 'p1', s), 0);
    const p2Power = s.lanes.reduce((acc, l) => acc + calculateLanePower(l, 'p2', s), 0);
    
    if (p1Power > p2Power) s.priority = 'p1';
    else if (p2Power > p1Power) s.priority = 'p2';

    s = queueTagTriggers(s, 'StartOfTurn');

    s.phase = 'planning';
    return applyContinuousEffects(s);
};
