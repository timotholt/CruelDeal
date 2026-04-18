
import { GameState, PlayerID, CardInstance } from '../../types';
import { calculateLanePower } from '../selectors';

export const getNextReveal = (state: GameState): { laneIdx: number, slotIdx: number, owner: PlayerID } | null => {
    const priorityPlayer = state.priority;
    const nonPriorityPlayer = state.priority === 'p1' ? 'p2' : 'p1';

    const unrevealedCards: CardInstance[] = [];

    // 1. Collect all unrevealed cards from the board
    for (const lane of state.lanes) {
        for (const card of [...lane.p1Slots, ...lane.p2Slots]) {
            if (card && !card.faceUp) {
                unrevealedCards.push(card);
            }
        }
    }

    if (unrevealedCards.length === 0) {
        return null;
    }

    // 2. Separate by player
    const priorityPlayerUnrevealed = unrevealedCards.filter(c => c.owner === priorityPlayer);
    const nonPriorityPlayerUnrevealed = unrevealedCards.filter(c => c.owner === nonPriorityPlayer);

    // 3. Sort each player's cards by playOrder (lower is earlier = First In First Out)
    priorityPlayerUnrevealed.sort((a, b) => (a.playOrder ?? Infinity) - (b.playOrder ?? Infinity));
    
    // FIX: Non-priority player should ALSO reveal in play order (First In First Out), not reverse order.
    // They just reveal AFTER the priority player is done.
    nonPriorityPlayerUnrevealed.sort((a, b) => (a.playOrder ?? Infinity) - (b.playOrder ?? Infinity));

    // 4. Determine the very next card to reveal
    const nextCardToReveal = priorityPlayerUnrevealed[0] ?? nonPriorityPlayerUnrevealed[0];
    
    if (nextCardToReveal) {
        return {
            laneIdx: nextCardToReveal.laneIndex!,
            slotIdx: nextCardToReveal.slotIndex!,
            owner: nextCardToReveal.owner
        };
    }

    return null;
};

export const calculateWinner = (state: GameState): PlayerID | 'draw' => {
    let p1Wins = 0;
    let p2Wins = 0;

    state.lanes.forEach(lane => {
        const p1 = calculateLanePower(lane, 'p1', state);
        const p2 = calculateLanePower(lane, 'p2', state);
        if (p1 > p2) p1Wins++;
        if (p2 > p1) p2Wins++;
    });

    if (p1Wins > p2Wins) return 'p1';
    if (p2Wins > p1Wins) return 'p2';
    
    const totalP1 = state.lanes.reduce((acc, l) => acc + calculateLanePower(l, 'p1', state), 0);
    const totalP2 = state.lanes.reduce((acc, l) => acc + calculateLanePower(l, 'p2', state), 0);

    if (totalP1 > totalP2) return 'p1';
    if (totalP2 > totalP1) return 'p2';

    return 'draw';
};
