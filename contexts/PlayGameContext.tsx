/**
 * PlayGameContext — Step 8c.
 *
 * The Solid store now holds the engine's `MatchState` directly. There is
 * no bridge, no shadow copy, no old MatchState type. The engine is the
 * single source of truth.
 *
 * Architecture:
 *   - `engineState`  : Solid store wrapping engine MatchState. Mutations
 *                      happen through `dispatch(event)` (which calls apply()
 *                      and reconciles the store) or via direct path-based
 *                      Solid setter for UI-only fields (phase).
 *   - `ui`           : Separate store for purely-visual state that has no
 *                      engine counterpart: hand reservations, undo
 *                      history snapshots, isFlipped flag.
 *   - `manifest`     : BOOTSTRAP_MANIFEST — read-only, injected into every
 *                      selector call and exposed to VFX script actions.
 *   - `dispatch`     : apply(unwrap(state), event, manifest) → reconcile.
 *
 * @migrate:step-8c ✅ complete — bridge deleted, engine MatchState is store.
 */

import {
  createContext,
  onCleanup,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, reconcile, unwrap, type SetStoreFunction } from 'solid-js/store';
import type { MatchState as EngineMatchState } from '@/services/playgame/engine/types/state';
import type { MatchEvent } from '@/services/playgame/engine/types/events';
import { otherSeat, type CardId, type LaneIdx, type Seat } from '@/services/playgame/engine/types/ids';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import { apply } from '@/services/playgame/engine/apply';
import { resolve } from '@/services/playgame/engine/resolve';
import { createRng, type Rng } from '@/services/playgame/engine/rng';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { createInitialMatchState } from '@/services/playgame/engine/cli/initState';
import { exportReplayBundle, replayMatch } from '@/services/playgame/engine/replay';
import {
  type ResolvedCard,
  type UiState,
  resolveCard,
} from '@/services/playgame/view';
export type { UiState } from '@/services/playgame/view';

declare global {
  interface Window {
    __snapDebug?: {
      getLiveState: () => EngineMatchState;
      getLiveLog: () => readonly import('@/services/playgame/engine/types/state').MatchLogEntry[];
      getReplayBundle: () => ReturnType<typeof exportReplayBundle>;
      getReplayTimeline: () => ReturnType<typeof replayMatch>;
      getFrame: (index: number) => import('@/services/playgame/engine/replay').ReplayFrame | null;
      copyReplayJson: () => Promise<string>;
    };
  }
}

// ── Store type (top-level readonly stripped for Solid mutability) ─────────────
// Engine MatchState is deeply readonly by design.  Solid's store proxy is
// mutable at runtime; we just need TypeScript to stop complaining about the
// top-level fields.
type EngineStateStore = {
  -readonly [K in keyof EngineMatchState]: EngineMatchState[K];
};

// ── Initial state factory ────────────────────────────────────────────────────

/**
 * Build a fresh MatchState for the UI. Delegates to the engine's pure,
 * seed-driven `createInitialMatchState` so:
 *   - Both decks are pre-populated and shuffled deterministically.
 *   - Lane locations are picked deterministically from the manifest.
 *   - Priority coin-flip is seeded.
 * Same seed → identical starting state in UI, CLI, and (future) server.
 */
function createInitialEngineState(seed: string, manifest: Manifest): EngineMatchState {
  return createInitialMatchState(seed, manifest);
}

// ── Context value type ───────────────────────────────────────────────────────

export interface PlayGameContextValue {
  /** Engine state — single source of truth. */
  engineState: EngineMatchState;
  /** Solid setter for path-based engine state updates (use dispatch for game events). */
  setEngineState: SetStoreFunction<EngineStateStore>;
  /** Apply a game event to the engine state (apply → reconcile). */
  dispatch: (event: MatchEvent) => void;
  /** Game manifest (card/location defs). */
  manifest: Manifest;
  /** Absolute seat controlled by this viewer. */
  localSeat: Seat;
  /** The other seat in the current match. */
  remoteSeat: Seat;
  /** Viewer-facing metadata for both seats. */
  seatMeta: Record<Seat, { name: string }>;
  /** UI-only sidecar state (hand reservations, undo, flip flag). */
  ui: UiState;
  /** Setter for UI sidecar state. */
  setUi: SetStoreFunction<UiState>;
  /** True while end-turn resolution is running (derived from phase). */
  isResolving: Accessor<boolean>;
  /** Seeded RNG for engine turn resolution (maintained across turns). */
  engineRng: Rng;
  actions: {
    drawCard: () => ResolvedCard | null;
    stageCardInLane: (cardId: string, laneIdx: number) => boolean;
    undoPending: () => void;
    /** Rewind history until `cardId` is no longer staged. Returns true on success. */
    undoPendingCard: (cardId: string) => boolean;
    resetMatch: () => void;
  };
}

const Ctx = createContext<PlayGameContextValue>();

// ── Provider ─────────────────────────────────────────────────────────────────

export const PlayGameProvider = (props: {
  children: JSX.Element;
  initialState?: EngineMatchState;
  manifest?: Manifest;
  localSeat?: Seat;
  seatMeta?: Partial<Record<Seat, { name: string }>>;
}) => {
  const manifest: Manifest = props.manifest ?? BOOTSTRAP_MANIFEST;
  const seed = `match-${Date.now().toString(36)}`;
  const localSeat: Seat = props.localSeat ?? 'P0';
  const remoteSeat: Seat = otherSeat(localSeat);
  const seatMeta: Record<Seat, { name: string }> = {
    P0: props.seatMeta?.P0 ?? { name: localSeat === 'P0' ? 'YOU' : 'OPPONENT' },
    P1: props.seatMeta?.P1 ?? { name: localSeat === 'P1' ? 'YOU' : 'OPPONENT' },
  };

  const [engineState, setEngineState] = createStore<EngineStateStore>(
    (props.initialState ?? createInitialEngineState(seed, manifest)) as EngineStateStore,
  );

  const [ui, setUi] = createStore<UiState>({
    handReservations: [],
    history: [],
    isFlipped: false,
    lockedResult: null,
    showEndGamePrompt: false,
  });

  const isResolving: Accessor<boolean> = () => engineState.phase === 'RESOLVING';

  // RNG maintained across turns for determinism.
  let engineRng: Rng = createRng(seed);

  /**
   * Apply one engine event to the store via reconcile.
   * This is the single mutation gateway for game-logic changes.
   */
  const dispatch = (event: MatchEvent): void => {
    const next = apply(unwrap(engineState) as EngineMatchState, event, manifest);
    setEngineState(reconcile(next as EngineStateStore));
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Draw one card: pop the top of `state.deck[P0]` via the CARD_DRAWN
   * event. The deck is pre-populated + seeded by `createInitialMatchState()`,
   * so the draw order is deterministic and snapshot-able.
   *
   * If the deck is empty we simply no-op (callers can handle the null).
   */
  const drawCard = (): ResolvedCard | null => {
    if ((engineState.hand[localSeat] as unknown[]).length >= 7) return null;

    const deck = engineState.deck[localSeat] as readonly { id: string }[];
    if (deck.length === 0) return null;
    const top = deck[0];

    dispatch({
      type: 'CARD_DRAWN',
      owner: localSeat,
      cardId: top.id as CardId,
      toHand: true,
    });

    return resolveCard(top.id as CardId, unwrap(engineState) as EngineMatchState, manifest);
  };

  /**
   * Stage a card from hand to a lane. Validates via engine's resolve(),
   * applies events via dispatch(), saves a history snapshot for undo.
   */
  const stageCardInLane = (cardId: string, laneIdx: number): boolean => {
    const raw = unwrap(engineState) as EngineMatchState;
    // Quick guard: can't stage while resolving or lane full.
    if (raw.phase === 'RESOLVING') return false;
    const lanePair = raw.lanes[laneIdx as LaneIdx]?.cards;
    if ((lanePair?.[localSeat]?.length ?? 0) >= 4) return false;

    // Push undo snapshot BEFORE the mutation so we can restore it.
    // IMPORTANT: structuredClone so the snapshot doesn't share refs with the
    // live store. Solid's reconcile() mutates store-owned nodes in place, so
    // a shallow capture would get corrupted by later dispatches.
    setUi('history', (prev) => [...prev, structuredClone(raw)]);

    const events = resolve(
      raw,
      {
        type: 'STAGE_CARD',
        intentId: `stage-${cardId}-${Date.now()}`,
        owner: localSeat,
        cardId: cardId as CardId,
        lane: laneIdx as LaneIdx,
      },
      engineRng.fork(`stage:${cardId}`),
      manifest,
    );

    if (!events.length || events[0].type === 'INTENT_REJECTED') {
      // Undo the snapshot push if rejected.
      setUi('history', (prev) => prev.slice(0, -1));
      return false;
    }

    for (const e of events) dispatch(e);
    return true;
  };

  /** Pop the most recent staged card back to hand (undo). */
  const undoPending = (): void => {
    const snap = ui.history[ui.history.length - 1];
    if (!snap) return;
    setEngineState(reconcile(snap as EngineStateStore));
    setUi('history', (prev) => prev.slice(0, -1));
    // If the undone card was shown face-up, isFlipped stays as-is
    // (it would only be true mid-resolution, so undo won't be available then).
  };

  /**
   * Rewind history snapshots until `cardId` is no longer in `stagingOrder`.
   * This undoes the target card plus any cards staged after it (they may have
   * depended on energy freed by it, so LIFO rollback is the safe choice).
   */
  const undoPendingCard = (cardId: string): boolean => {
    if (engineState.phase === 'RESOLVING') return false;
    const hist = ui.history;
    // Walk from the newest snapshot backward. The first snapshot whose
    // stagingOrder does NOT contain cardId is the state we want to restore to.
    for (let i = hist.length - 1; i >= 0; i--) {
      const snap = hist[i] as EngineMatchState;
      if (!snap.stagingOrder.includes(cardId as CardId)) {
        setEngineState(reconcile(snap as EngineStateStore));
        setUi('history', (prev) => prev.slice(0, i));
        return true;
      }
    }
    return false;
  };

  const resetMatch = (): void => {
    const newSeed = `match-${Date.now().toString(36)}`;
    const fresh = createInitialEngineState(newSeed, manifest) as EngineStateStore;
    setEngineState(reconcile(fresh));
    setUi({ handReservations: [], history: [], isFlipped: false, lockedResult: null, showEndGamePrompt: false });
    engineRng = createRng(newSeed);
  };

  const value: PlayGameContextValue = {
    engineState: engineState as unknown as EngineMatchState,
    setEngineState,
    dispatch,
    manifest,
    localSeat,
    remoteSeat,
    seatMeta,
    ui,
    setUi,
    isResolving,
    engineRng,
    actions: {
      drawCard,
      stageCardInLane,
      undoPending,
      undoPendingCard,
      resetMatch,
    },
  };

  if (typeof window !== 'undefined') {
    window.__snapDebug = {
      getLiveState: () => structuredClone(unwrap(engineState) as EngineMatchState),
      getLiveLog: () => structuredClone((unwrap(engineState) as EngineMatchState).log),
      getReplayBundle: () =>
        exportReplayBundle(unwrap(engineState) as EngineMatchState, manifest, {
          localSeat,
        }),
      getReplayTimeline: () => {
        const live = unwrap(engineState) as EngineMatchState;
        return replayMatch({
          seed: live.seed,
          manifest,
          events: live.log.map((entry) => entry.event as MatchEvent),
        });
      },
      getFrame: (index: number) => {
        const live = unwrap(engineState) as EngineMatchState;
        const replay = replayMatch({
          seed: live.seed,
          manifest,
          events: live.log.map((entry) => entry.event as MatchEvent),
        });
        return replay.frames[index] ?? null;
      },
      copyReplayJson: async () => {
        const json = JSON.stringify(
          exportReplayBundle(unwrap(engineState) as EngineMatchState, manifest, {
            localSeat,
          }),
          null,
          2,
        );
        await navigator.clipboard.writeText(json);
        return json;
      },
    };
    onCleanup(() => {
      delete window.__snapDebug;
    });
  }

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
};

export const usePlayGame = (): PlayGameContextValue => {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlayGame must be used inside <PlayGameProvider>');
  return v;
};
