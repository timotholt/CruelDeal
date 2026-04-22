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
 *                      engine counterpart: incoming animation buffer, undo
 *                      history snapshots, isFlipped flag.
 *   - `manifest`     : BOOTSTRAP_MANIFEST — read-only, injected into every
 *                      selector call and exposed to VFX script actions.
 *   - `dispatch`     : apply(unwrap(state), event, manifest) → reconcile.
 *
 * @migrate:step-8c ✅ complete — bridge deleted, engine MatchState is store.
 */

import {
  createContext,
  useContext,
  type Accessor,
  type JSX,
} from 'solid-js';
import { createStore, reconcile, unwrap, type SetStoreFunction } from 'solid-js/store';
import type { MatchState as EngineMatchState, MatchPhase } from '@/services/playgame/engine/types/state';
import type { MatchEvent } from '@/services/playgame/engine/types/events';
import type { CardId, LaneIdx } from '@/services/playgame/engine/types/ids';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import { apply } from '@/services/playgame/engine/apply';
import { resolve } from '@/services/playgame/engine/resolve';
import { createRng, type Rng } from '@/services/playgame/engine/rng';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { mkLocationId } from '@/services/playgame/engine/types/ids';
import {
  type ResolvedCard,
  type UiState,
  resolveCard,
  randomManifestCardDef,
  newEngineCardInstance,
} from '@/services/playgame/view';
export type { UiState } from '@/services/playgame/view';

// ── Store type (top-level readonly stripped for Solid mutability) ─────────────
// Engine MatchState is deeply readonly by design.  Solid's store proxy is
// mutable at runtime; we just need TypeScript to stop complaining about the
// top-level fields.
type EngineStateStore = {
  -readonly [K in keyof EngineMatchState]: EngineMatchState[K];
};

// ── Initial state factory ────────────────────────────────────────────────────

function createInitialEngineState(seed: string, manifest: Manifest): EngineMatchState {
  const locationDefIds = Object.keys(manifest.locations);
  // Shuffle and pick 3 location defs for this match.
  const shuffled = [...locationDefIds].sort(() => Math.random() - 0.5);
  const laneLocDefIds = shuffled.slice(0, 3);

  const lanes: EngineMatchState['lanes'] = [
    {
      idx: 0,
      location: laneLocDefIds[0]
        ? { id: mkLocationId(laneLocDefIds[0]), defId: laneLocDefIds[0], lane: 0, tags: [] }
        : null,
      locationRevealed: false,
      cards: { PLAYER: [], OPP: [] },
    },
    {
      idx: 1,
      location: laneLocDefIds[1]
        ? { id: mkLocationId(laneLocDefIds[1]), defId: laneLocDefIds[1], lane: 1, tags: [] }
        : null,
      locationRevealed: false,
      cards: { PLAYER: [], OPP: [] },
    },
    {
      idx: 2,
      location: laneLocDefIds[2]
        ? { id: mkLocationId(laneLocDefIds[2]), defId: laneLocDefIds[2], lane: 2, tags: [] }
        : null,
      locationRevealed: false,
      cards: { PLAYER: [], OPP: [] },
    },
  ] as EngineMatchState['lanes'];

  // Turn 1 state is equivalent to "genesis state (turn 0, maxEnergy 0)"
  // then the turn-1 start-of-turn bookkeeping applied:
  //   maxEnergy[P|O] += 1 → 1
  //   currentEnergy = maxEnergy + bonus(0) → 1
  // We pre-apply this here rather than running a synthetic event cascade.
  return {
    turn: 1,
    maxEnergy: { PLAYER: 1, OPP: 1 },
    nextTurnEnergyBonus: { PLAYER: 0, OPP: 0 },
    phase: 'AWAITING_INTENT' as MatchPhase,
    seed,
    priority: Math.random() < 0.5 ? 'PLAYER' : 'OPP',
    energy: { PLAYER: 1, OPP: 1 },
    deck: { PLAYER: [], OPP: [] },
    hand: { PLAYER: [], OPP: [] },
    cards: {},
    lanes,
    pending: [],
    stagingOrder: [],
    pendingEffects: [],
    log: [],
    lastPlayedBy: { PLAYER: null, OPP: null },
    result: null,
  } as unknown as EngineMatchState;
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
  /** UI-only sidecar state (incoming buffer, undo, flip flag). */
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
    endTurn: () => Promise<void>;
    resetMatch: () => void;
  };
}

const Ctx = createContext<PlayGameContextValue>();

// ── Provider ─────────────────────────────────────────────────────────────────

export const PlayGameProvider = (props: { children: JSX.Element }) => {
  const manifest: Manifest = BOOTSTRAP_MANIFEST;
  const seed = `match-${Date.now().toString(36)}`;

  const [engineState, setEngineState] = createStore<EngineStateStore>(
    createInitialEngineState(seed, manifest) as EngineStateStore,
  );

  const [ui, setUi] = createStore<UiState>({
    incoming: [],
    history: [],
    isFlipped: false,
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
   * Draw one card: pick from manifest, add to engine hand, push a
   * ResolvedCard to `ui.incoming` for animation.
   *
   * @migrate:step-1.2 Replace randomManifestCardDef with engine deck draw
   * once the deck is pre-populated (Tier 1.2 card-model redesign).
   */
  const drawCard = (): ResolvedCard | null => {
    if ((engineState.hand['PLAYER'] as unknown[]).length >= 7) return null;

    const def = randomManifestCardDef(manifest);
    if (!def) return null;

    const inst = newEngineCardInstance(def, 'PLAYER');
    const event: MatchEvent = {
      type: 'CARD_ADDED_TO_HAND',
      owner: 'PLAYER',
      cardId: inst.id,
      defId: def.defId,
      spawnSource: { kind: 'DECK_CREATION' },
    };
    dispatch(event);

    // Build a ResolvedCard from the freshly-added engine card for the animation buffer.
    const resolved = resolveCard(inst.id, unwrap(engineState) as EngineMatchState, manifest);
    if (resolved) setUi('incoming', (prev) => [...prev, resolved]);
    return resolved;
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
    if ((lanePair?.['PLAYER']?.length ?? 0) >= 4) return false;

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
        owner: 'PLAYER',
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

  /**
   * End-turn stub. The real resolution flow is owned by the VFX script
   * (`resolveTurnFlow` in flows.ts). This stub exists only for interface
   * consistency; PlayScreen never calls it.
   *
   * @migrate:step-9 Delete when the VFX flow fully replaces this stub.
   */
  const endTurn = async (): Promise<void> => {
    // no-op: PlayScreen drives resolution via script.run(resolveTurnFlow()).
  };

  const resetMatch = (): void => {
    const newSeed = `match-${Date.now().toString(36)}`;
    const fresh = createInitialEngineState(newSeed, manifest) as EngineStateStore;
    setEngineState(reconcile(fresh));
    setUi({ incoming: [], history: [], isFlipped: false });
    engineRng = createRng(newSeed);
  };

  const value: PlayGameContextValue = {
    engineState: engineState as unknown as EngineMatchState,
    setEngineState,
    dispatch,
    manifest,
    ui,
    setUi,
    isResolving,
    engineRng,
    actions: {
      drawCard,
      stageCardInLane,
      undoPending,
      undoPendingCard,
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
