
import { GameState, CardInstance, Lane, PlayerID, LaneSlots, GameEvent } from '../types';
import { MAX_HAND_SIZE } from '../config';
import { findCardInState } from './selectors';
import { queueAbility } from './triggers';

// --- Helpers ---

export const cloneState = (state: GameState): GameState => {
  return JSON.parse(JSON.stringify(state));
};

// Helper type to extract the union of all event payloads (without 'id')
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
type EventPayload = DistributiveOmit<GameEvent, 'id'>;

export const queueEvent = (state: GameState, event: EventPayload): GameState => {
    const id = Math.random().toString(36).substring(2, 9);
    const fullEvent = { ...event, id } as GameEvent;
    state.eventQueue.push(fullEvent);
    return state;
};

// Exported for use in Engine
export const compactLane = (lane: Lane, player: PlayerID) => {
    const slots = player === 'p1' ? lane.p1Slots : lane.p2Slots;
    const activeCards = slots.filter((c): c is CardInstance => c !== null);
    
    // Reset slots
    const newSlots: LaneSlots = [null, null, null, null];
    
    activeCards.forEach((card, idx) => {
        newSlots[idx] = card;
        card.slotIndex = idx; // Update internal index
    });

    if (player === 'p1') lane.p1Slots = newSlots;
    else lane.p2Slots = newSlots;
};

// --- Atomic Mutations ---

export const executeDestroy = (state: GameState, instanceId: string): GameState => {
    let s = state;
    const lookup = findCardInState(s, instanceId);
    
    if (!lookup || lookup.location !== 'board') return s;

    const { card, laneIdx, slotIdx, owner } = lookup;

    // 1. Remove from Lane (Atomic)
    if (owner === 'p1') s.lanes[laneIdx!].p1Slots[slotIdx!] = null;
    else s.lanes[laneIdx!].p2Slots[slotIdx!] = null;
    
    // Close gap immediately
    compactLane(s.lanes[laneIdx!], owner);

    // 2. Update Card State
    card.zone = 'DESTROYED';
    card.laneIndex = null;
    card.slotIndex = null;

    // 3. Update Game Stats
    const playerState = s.players[owner];
    playerState.stats.destroyedCount++;
    playerState.stats.destroyedPower += card.totalPower;

    // 4. Visuals - Trigger both VFX and SFX for the "Pop" feel
    s = queueEvent(s, { type: 'VFX_PLAY', vfxId: 'vfx_explosion_small', laneIdx, slotIdx, playerId: owner });
    s = queueEvent(s, { type: 'SFX_PLAY', sfxId: 'sfx_destroy_digital' });
    
    // 5. Move to Pile
    playerState.destroyedPile.push(card);

    // 6. Queue OnDestroy Effects (Stack: LIFO)
    if (card.def.tags.includes('OnDestroy')) {
        s = queueAbility(s, card, 'OnDestroy');
    }

    s.history.push(`${card.def.name} was destroyed.`);
    return s;
};

export const addCardToHand = (state: GameState, card: CardInstance): GameState => {
    const s = cloneState(state);
    const hand = s.players[card.owner].hand;
    
    if (hand.length >= MAX_HAND_SIZE) {
        s.history.push(`Hand full! ${card.def.name} failed to spawn.`);
        return s;
    }

    card.zone = 'HAND';
    card.laneIndex = null;
    card.slotIndex = null;
    card.faceUp = true; 
    
    hand.push(card);
    return s;
};

export const drawCard = (state: GameState, player: PlayerID): GameState => {
    const s = cloneState(state);
    const deck = s.players[player].deck;
    const hand = s.players[player].hand;

    if (deck.length === 0) return s;

    if (hand.length >= MAX_HAND_SIZE) {
        s.history.push(`Hand full! Player ${player} could not draw.`);
        return s;
    }

    const card = deck.shift()!;
    card.zone = 'HAND';
    card.faceUp = true;
    
    hand.push(card);
    return s;
};

export const playCardFromHand = (state: GameState, instanceId: string, laneIdx: number): GameState => {
    let s = cloneState(state);
    const lookup = findCardInState(s, instanceId);
    
    if (!lookup || lookup.location !== 'hand') return s;
    const { card, owner } = lookup;

    const lane = s.lanes[laneIdx];
    const slots = owner === 'p1' ? lane.p1Slots : lane.p2Slots;
    const emptyIdx = slots.findIndex(s => s === null);

    if (emptyIdx === -1) return s;

    const playerState = s.players[owner];
    if (playerState.energy < card.totalCost) return s;
    playerState.energy -= card.totalCost;

    playerState.hand = playerState.hand.filter(c => c.instanceId !== instanceId);

    card.zone = 'BOARD';
    card.laneIndex = laneIdx;
    card.slotIndex = emptyIdx;
    card.faceUp = false;
    card.turnPlayed = s.turn;
    card.playOrder = s.nextPlayOrder++;

    slots[emptyIdx] = card;

    if (card.def.sfxOnPlay) {
        s = queueEvent(s, { type: 'SFX_PLAY', sfxId: card.def.sfxOnPlay });
    } else {
        s = queueEvent(s, { type: 'SFX_PLAY', sfxId: 'sfx_card_play' });
    }

    return s;
};

export const addCardToLane = (state: GameState, card: CardInstance, laneIdx: number): GameState => {
    const s = cloneState(state);
    const lane = s.lanes[laneIdx];
    const slots = card.owner === 'p1' ? lane.p1Slots : lane.p2Slots;

    const emptyIdx = slots.findIndex(s => s === null);
    
    if (emptyIdx === -1) {
        s.history.push(`Lane ${laneIdx + 1} full! ${card.def.name} failed to spawn.`);
        return s;
    }

    card.zone = 'BOARD';
    card.laneIndex = laneIdx;
    card.slotIndex = emptyIdx;
    
    slots[emptyIdx] = card;
    
    return s;
};

export const discardCard = (state: GameState, instanceId: string): GameState => {
     const s = cloneState(state);
     const lookup = findCardInState(s, instanceId);
     if (!lookup || lookup.location !== 'hand') return s;
     
     if (lookup.card.pendingDiscard) return s;
     lookup.card.pendingDiscard = true;

     s.executionQueue.push({
         type: 'EXECUTE_DISCARD',
         sourceId: instanceId
     });

     return s;
};

export const modifyPower = (state: GameState, instanceId: string, delta: number, source: string): GameState => {
    const s = cloneState(state);
    const lookup = findCardInState(s, instanceId);
    if (!lookup) return s;
    
    lookup.card.powerModifiers.push({ source, value: delta, type: 'PERMANENT' });
    return s;
};

export const modifyCost = (state: GameState, instanceId: string, delta: number, source: string): GameState => {
    const s = cloneState(state);
    const lookup = findCardInState(s, instanceId);
    if (!lookup) return s;
    
    lookup.card.costModifiers.push({ source, value: delta, type: 'PERMANENT' });
    return s;
};

export const moveCard = (state: GameState, instanceId: string, targetLaneIdx: number): GameState => {
    const s = cloneState(state);
    const lookup = findCardInState(s, instanceId);
    if (!lookup || lookup.location !== 'board') return s;
    
    const { card, laneIdx, slotIdx, owner } = lookup;
    if (laneIdx === targetLaneIdx) return s;

    const targetLane = s.lanes[targetLaneIdx];
    const targetSlots = owner === 'p1' ? targetLane.p1Slots : targetLane.p2Slots;
    const emptyIdx = targetSlots.findIndex(slot => slot === null);
    
    if (emptyIdx === -1) return s;

    if (owner === 'p1') s.lanes[laneIdx!].p1Slots[slotIdx!] = null;
    else s.lanes[laneIdx!].p2Slots[slotIdx!] = null;
    
    compactLane(s.lanes[laneIdx!], owner);

    targetSlots[emptyIdx] = card;
    card.laneIndex = targetLaneIdx;
    card.slotIndex = emptyIdx;
    
    s.history.push(`${card.def.name} moved from Lane ${laneIdx! + 1} to Lane ${targetLaneIdx + 1}`);

    return s;
};
