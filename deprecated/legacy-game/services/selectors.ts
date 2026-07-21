import { GameState, CardInstance, PlayerID, Lane, StatModifier } from '../types';

export const findCardInState = (state: GameState, instanceId: string): { card: CardInstance, location: 'hand' | 'deck' | 'board' | 'discard' | 'destroyed' | 'banished', owner: PlayerID, laneIdx?: number, slotIdx?: number } | null => {
    if (!state || !state.players) return null;

    // Search Hands
    if (state.players.p1?.hand) {
        const p1HandCard = (state.players.p1.hand || []).find(c => c && c.instanceId === instanceId);
        if (p1HandCard) return { card: p1HandCard, location: 'hand', owner: 'p1' };
    }
    if (state.players.p2?.hand) {
        const p2HandCard = (state.players.p2.hand || []).find(c => c && c.instanceId === instanceId);
        if (p2HandCard) return { card: p2HandCard, location: 'hand', owner: 'p2' };
    }

    // Search Board
    if (state.lanes) {
        for (let l = 0; l < state.lanes.length; l++) {
            const lane = state.lanes[l];
            if (!lane) continue;
            
            // Fixed: Explicitly typed slots to avoid 'never' inference
            const p1Slots = (lane.p1Slots as (CardInstance | null)[]);
            const p1SlotIdx = p1Slots.findIndex(s => s?.instanceId === instanceId);
            if (p1SlotIdx !== -1) return { card: lane.p1Slots[p1SlotIdx]!, location: 'board', owner: 'p1', laneIdx: l, slotIdx: p1SlotIdx };
            
            const p2Slots = (lane.p2Slots as (CardInstance | null)[]);
            const p2SlotIdx = p2Slots.findIndex(s => s?.instanceId === instanceId);
            if (p2SlotIdx !== -1) return { card: lane.p2Slots[p2SlotIdx]!, location: 'board', owner: 'p2', laneIdx: l, slotIdx: p2SlotIdx };
        }
    }

    // Search Piles
    if (state.players.p1?.discardPile) {
        const p1Discard = (state.players.p1.discardPile || []).find(c => c && c.instanceId === instanceId);
        if (p1Discard) return { card: p1Discard, location: 'discard', owner: 'p1' };
    }
    if (state.players.p2?.discardPile) {
        const p2Discard = (state.players.p2.discardPile || []).find(c => c && c.instanceId === instanceId);
        if (p2Discard) return { card: p2Discard, location: 'discard', owner: 'p2' };
    }
    
    // Search Decks
    if (state.players.p1?.deck) {
        const p1DeckCard = (state.players.p1.deck || []).find(c => c && c.instanceId === instanceId);
        if (p1DeckCard) return { card: p1DeckCard, location: 'deck', owner: 'p1' };
    }
    if (state.players.p2?.deck) {
        const p2DeckCard = (state.players.p2.deck || []).find(c => c && c.instanceId === instanceId);
        if (p2DeckCard) return { card: p2DeckCard, location: 'deck', owner: 'p2' };
    }

    // Search Destroyed
    if (state.players.p1?.destroyedPile) {
        const p1Destroyed = (state.players.p1.destroyedPile || []).find(c => c && c.instanceId === instanceId);
        if (p1Destroyed) return { card: p1Destroyed, location: 'destroyed', owner: 'p1' };
    }
    if (state.players.p2?.destroyedPile) {
        const p2Destroyed = (state.players.p2.destroyedPile || []).find(c => c && c.instanceId === instanceId);
        if (p2Destroyed) return { card: p2Destroyed, location: 'destroyed', owner: 'p2' };
    }

     // Search Banished
    if (state.players.p1?.banishedPile) {
        const p1Banished = (state.players.p1.banishedPile || []).find(c => c && c.instanceId === instanceId);
        if (p1Banished) return { card: p1Banished, location: 'banished', owner: 'p1' };
    }
    if (state.players.p2?.banishedPile) {
        const p2Banished = (state.players.p2.banishedPile || []).find(c => c && c.instanceId === instanceId);
        if (p2Banished) return { card: p2Banished, location: 'banished', owner: 'p2' };
    }

    return null;
}

export const calculateLanePower = (lane: Lane, player: PlayerID, _gameState: GameState): number => {
  if (!lane) return 0;
  // Fixed: Cast to array of nullable instances to avoid inference issues in loop
  const slots = (player === 'p1' ? lane.p1Slots : lane.p2Slots) as (CardInstance | null)[];
  let power = 0;
  slots.forEach(card => {
      if (card && card.faceUp) {
          power += card.totalPower;
      }
  });
  return power;
};

/**
 * Calculates the visual stats of a card if it were to be played in the given lane.
 */
const projectCardStats = (originalCard: CardInstance, lane: Lane): CardInstance => {
    const card = {
        ...originalCard,
        powerModifiers: [...(originalCard.powerModifiers || [])],
        costModifiers: [...(originalCard.costModifiers || [])]
    };

    card.powerModifiers = card.powerModifiers.filter(m => m.type !== 'CONTINUOUS');
    const currentP = card.powerModifiers.reduce((sum, m) => sum + m.value, 0);
    card.totalPower = currentP;

    if (lane.location?.def?.effect === 'PowerPlantEffect') {
        const mod: StatModifier = { source: lane.location.def.name, value: 1, type: 'CONTINUOUS' };
        card.powerModifiers.push(mod);
        card.totalPower += 1;
    }

    return card;
};

export const getProjectedLaneState = (
    gameState: GameState,
    laneIndex: number,
    pendingCards: { card: CardInstance, handIndex?: number }[]
): (CardInstance | null)[] => {
    if (!gameState || !gameState.lanes) return [null, null, null, null];
    const lane = gameState.lanes[laneIndex];
    if (!lane) return [null, null, null, null];
    
    const slots = [...(lane.p1Slots || [])];
    const realCount = slots.filter(s => s !== null).length;

    pendingCards.forEach((move, i) => {
        const targetIndex = realCount + i;
        if (targetIndex < 4) {
            const projectedCard = projectCardStats(move.card, lane);
            slots[targetIndex] = projectedCard;
        }
    });

    return slots as (CardInstance | null)[];
};