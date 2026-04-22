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
import { mountBridge, type Bridge } from '@/services/playgame/engine/adapter';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';

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

  // ─── Engine bridge (Step 8a, shadow mode) ────────────────────────────
  // @migrate:step-8b — The bridge currently OBSERVES. In Step 8b it will
  // become authoritative: UI actions will wait for engine events before
  // mutating old state, and the script engine will subscribe to the
  // event stream instead of mutating state directly.
  // @migrate:step-8c — The old `state` store disappears entirely and
  // this Provider wraps only the engine's MatchState.
  let bridge: Bridge = mountBridge(state, BOOTSTRAP_MANIFEST, {
    seed: `match-${Date.now().toString(36)}`,
  });
  const assertParity = (label: string): void => {
    if (bridge.active) bridge.assertParity(state, label);
  };

  /** Deal a card from the pool into the hand (max 7). Returns the new card. */
  const drawCard = (): CardInstance | null => {
    if (state.hand.length >= 7) return null;
    const card = newCardInstance(randomCardDef());
    setState('hand', (h) => [...h, card]);
    // @migrate:step-8b — Replace with engine-driven draw (CARD_DRAWN
    // event from a pre-populated deck). For now we sync after the fact.
    bridge.syncHandCard(card.id, card.name, 'PLAYER');
    assertParity('drawCard');
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
    // @migrate:step-8b — This is the obvious consolidation point:
    // resolve({STAGE_CARD}) becomes authoritative, apply() drives both
    // the engine state AND (via a reducer-to-old translator) the UI.
    bridge.stage(cardId, laneIdx as 0 | 1 | 2, 'PLAYER');
    assertParity('stageCardInLane');
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
      // @migrate:step-8b — Replace this entire stub with bridge.endTurn()
      // once the VFX layer consumes engine events. The stub + shadow
      // run-ahead is fine for now because the UI's /play flow in
      // components/screens/PlayScreen.tsx uses the `script` engine's
      // resolveTurnFlow(), not this context method, for real resolution.
      bridge.endTurn();
      assertParity('endTurn(stub)');
      const drawn = drawCard();
      void drawn;
    } finally {
      setState('resolving', false);
    }
  };

  const resetMatch = (): void => {
    const fresh = createMatchState();
    setState(fresh);
    // Re-seed the bridge so the shadow matches the freshly-reset UI.
    bridge = mountBridge(fresh, BOOTSTRAP_MANIFEST, {
      seed: `match-${Date.now().toString(36)}`,
    });
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
