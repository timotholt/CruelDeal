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
  /**
   * Engine bridge — exposed so the VFX script layer can drive end-turn
   * resolution from engine events (Step 8b).
   *
   * @migrate:step-8c Wrap bridge directly as the store; remove this field.
   */
  bridge: Bridge;
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

  // ─── Engine bridge (Step 8b, authoritative for turn resolution) ─────
  // Step 8a: bridge observed (shadow mode).
  // Step 8b: bridge is authoritative for end-turn events. The VFX script
  //   flow calls bridge.endTurn() via captureEngineEndTurn(), gets the
  //   event stream, and drives reveal order + turn advancement from it.
  //   Enemy cards are staged through bridge.stage() in enemyPlayRandom()
  //   so the engine sees both sides before producing CARD_FLIPPED events.
  // @migrate:step-8c — The old `state` store disappears entirely and
  //   this Provider wraps only the engine's MatchState.
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
    // @migrate:step-8c — Replace with engine-driven draw (CARD_DRAWN
    // event from a pre-populated deck). Deck pre-population is gated on
    // the full card-model redesign (Tier 1.2). For now we sync after the fact.
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
    // Engine bridge: stage the card so the engine's staging order
    // matches the UI. The bridge's endTurn() (called by captureEngineEndTurn
    // in the VFX flow) will then emit CARD_FLIPPED events for it.
    // @migrate:step-8c — resolve({STAGE_CARD}) becomes fully authoritative;
    // apply() drives both engine state AND (via translator) the UI.
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
      // NOTE: This stub is never called by the real game flow in PlayScreen.tsx
      // (which uses script.run(resolveTurnFlow()) instead). The real bridge.endTurn()
      // call is in captureEngineEndTurn() in the VFX script flow.
      // @migrate:step-8c — Delete this stub entirely; the VFX flow owns turn resolution.
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
    bridge,
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
