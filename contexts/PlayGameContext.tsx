/**
 * PlayGameContext — reactive Solid wrapper around the /play match state.
 *
 * The demo's state (`MatchState`) is held in a `createStore`. All actions
 * that mutate state do so via `setState(produce(draft => ...))` so Solid
 * observes the updates and re-renders dependent components.
 *
 * Actions are grouped on `ctx.actions`:
 *   - drawCard              deal a fresh card into the hand
 *   - stageCardInLane       hand -> lane, face-down (pending)
 *   - endTurn               reveal pending, run enemy play, advance turn
 *   - undoPending           pop last pending card back to hand
 *   - resetMatch            new match
 *
 * Usage: wrap the `/play` screen tree in <PlayGameProvider>, then
 *   const { state, actions } = usePlayGame();
 */

import {
  createContext,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, produce, type SetStoreFunction } from 'solid-js/store';
import {
  createMatchState,
  newCardInstance,
  pushHistory,
  randomCardDef,
  restoreState,
} from '@/services/playgame/state';
import type { CardInstance, MatchState } from '@/services/playgame/types';

export interface PlayGameContextValue {
  /** Live reactive state. Read-only from consumers. */
  state: MatchState;
  /** Raw setter, exposed for rare cases (most code should use actions). */
  setState: SetStoreFunction<MatchState>;
  /** Whether the end-turn resolution animation is currently running. */
  isResolving: Accessor<boolean>;
  actions: {
    drawCard: () => CardInstance | null;
    stageCardInLane: (cardId: string, laneIdx: number) => boolean;
    undoPending: () => void;
    endTurn: () => Promise<void>;
    resetMatch: () => void;
  };
}

const Ctx = createContext<PlayGameContextValue>();

export const PlayGameProvider = (props: { children: JSX.Element }) => {
  const [state, setState] = createStore<MatchState>(createMatchState());
  // Single source of truth: state.resolving (a store field). Components
  // read it reactively via this accessor so the legacy `isResolving()`
  // call sites keep working, and the script-engine actions that toggle
  // state.resolving directly stay in sync automatically.
  const isResolving: Accessor<boolean> = () => state.resolving;

  /** Deal a card from the pool into the hand (max 7). Returns the new card. */
  const drawCard = (): CardInstance | null => {
    if (state.hand.length >= 7) return null;
    const card = newCardInstance(randomCardDef());
    setState('hand', (h) => [...h, card]);
    return card;
  };

  /**
   * Move a card from hand to a lane. The card lands FACE-UP and is
   * tracked in `playedThisTurn` so the end-turn flow knows to flip it
   * face-down before the reveal cadence. Matches Marvel Snap: you see
   * your own plays commit visibly until END TURN locks them in.
   *
   * Returns `true` on success, `false` if blocked (lane full, etc.).
   */
  const stageCardInLane = (cardId: string, laneIdx: number): boolean => {
    const card = state.hand.find((c) => c.id === cardId);
    if (!card) return false;
    if (state.lanes[laneIdx].length >= 4) return false;

    setState(
      produce<MatchState>((s) => {
        pushHistory(s);
        s.hand = s.hand.filter((c) => c.id !== cardId);
        s.energy = Math.max(0, s.energy - card.cost);
        s.lanes[laneIdx].push({ ...card, placements: {} });
        s.playedThisTurn.push(cardId);
      }),
    );
    return true;
  };

  /** Pop the most recent pending card back to the hand (demo undo). */
  const undoPending = (): void => {
    setState(
      produce<MatchState>((s) => {
        const last = s.history.pop();
        if (!last) return;
        restoreState(s, last);
      }),
    );
  };

  /**
   * End the current turn. STUB for now — real resolution (reveal cinematic
   * + enemy play + location reveal + turn advance) comes in the animation
   * milestone. For now it just clears pending and bumps the turn counter.
   */
  const endTurn = async (): Promise<void> => {
    if (isResolving()) return;
    setState('resolving', true);
    try {
      setState(
        produce<MatchState>((s) => {
          s.pending = [];
          s.turn += 1;
          s.energyMax = Math.min(s.turn, 6);
          s.energy = s.energyMax;
        }),
      );
      const drawn = drawCard();
      void drawn;
    } finally {
      setState('resolving', false);
    }
  };

  const resetMatch = (): void => {
    setState(createMatchState());
  };

  const value: PlayGameContextValue = {
    state,
    setState,
    isResolving,
    actions: {
      drawCard,
      stageCardInLane,
      undoPending,
      endTurn,
      resetMatch,
    },
  };

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
};

export const usePlayGame = (): PlayGameContextValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayGame must be used inside <PlayGameProvider>');
  return v;
};
