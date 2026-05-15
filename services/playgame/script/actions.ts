/**
 * Script Engine — named actions. Step 8c: all state mutations now go through
 * the engine's MatchState (dispatch → apply → reconcile) or the UI sidecar.
 * The old MatchState type and bridge are gone.
 *
 * Each action returns a `Step` that resolves when its visible effect is
 * complete. Actions read what they need off `ctx`.
 */

import { type SetStoreFunction } from 'solid-js/store';
import { unwrap } from 'solid-js/store';
import { flyFaceDownToSlot } from '@/services/vfx/animations/fly-face-down';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import type { Step } from './runner';
import type { MatchState as EngineMatchState, MatchPhase } from '../engine/types/state';
import type { MatchEvent } from '../engine/types/events';
import { type CardId, type LaneIdx, type Seat } from '../engine/types/ids';
import type { ZoneAnchorKey } from '../presentation/cardTransfers';
import type { Manifest } from '../engine/manifest/types';
import type { Rng } from '../engine/rng';
import { resolveTurn } from '../engine/resolve';
import { evalEffect, type EffectCtx } from '../engine/effects/evaluator';
import { planEnemyTurnFromPool } from '../engine/ai';
import { animateEvent } from '../presentation/eventAnimator';
import {
  type UiState,
  newEngineCardInstance,
} from '../view';
import { showToast } from '../toast';

// ── Context type ──────────────────────────────────────────────────────────────

/** Ctx fields the actions expect. */
export interface PlayScriptCtx extends Record<string, unknown> {
  /** Live engine state (Solid store proxy). Use dispatch() for game mutations. */
  state: EngineMatchState;
  /**
   * Solid store setter for direct path-based engine state updates.
   * Use only for phase changes and other non-event UI state; all game
   * mutations should go through dispatch().
   */
  setState: SetStoreFunction<Record<string, unknown>>;
  /** Apply a game event to the engine state. */
  dispatch: (event: MatchEvent) => void;
  /** Helper to change the match phase (RESOLVING ↔ AWAITING_INTENT). */
  setPhase: (phase: MatchPhase) => void;
  /** UI sidecar state (hand reservations, undo history, flip flag). */
  ui: UiState;
  /** Setter for UI sidecar. */
  setUi: SetStoreFunction<UiState>;
  /** Game manifest for card/location def lookups and engine calls. */
  manifest: Manifest;
  /** Absolute seat controlled by this viewer. */
  localSeat: Seat;
  /** The other seat in the current match. */
  remoteSeat: Seat;
  /** Seeded RNG for engine turn resolution (fork per turn). */
  engineRng: Rng;
  /** Board root element (`.board`). */
  boardEl: HTMLElement;
  /** Board-wrap element (`.board-wrap`) — the VFXEngine mount point. */
  boardWrap: HTMLElement;
  /** Toast area element (`.toast-area`). */
  toastArea: HTMLElement;
  /** Map from card id -> its live DOM element (from VfxHost). */
  cardRefs: Map<string, HTMLElement>;
  /** Map from logical card zone anchor -> live DOM element (from VfxHost). */
  zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
  /** Queue of card defs to deal from, pre-seeded by the flow. */
  drawQueue: import('../engine/manifest/types').CardDef[];
  /** Deck anchor element — visual origin for draw slides. */
  deckEl?: HTMLElement;
  /** Optional SFX hook. */
  sfx?: (name: string) => void;
  /** True once the caller cancels (e.g. on screen unmount). */
  cancelled?: boolean;
  /**
   * Engine events computed by `captureEngineEndTurn()`. Consumed by the
   * `*FromEngine` actions that follow for reveal order and turn advancement.
   */
  _engineEvents?: readonly MatchEvent[];
  /** Final engine state after full turn resolution (from resolveTurn). */
  _engineFinalState?: EngineMatchState;
  /**
   * Index into `_engineEvents` where `revealByPriorityFromEngine` stopped
   * dispatching (exclusive — equals the `TURN_ENDED` index, or
   * `events.length` if that event is absent). `advanceTurnFromEngine`
   * resumes from this index so turn-bookkeeping events aren't double-
   * applied and per-reveal events (already animated inline with each
   * flip) aren't re-dispatched.
   */
  _revealsConsumedUpTo?: number;
}

const dispatchEventWithPresentation = async (c: PlayScriptCtx, event: MatchEvent): Promise<void> => {
  await animateEvent(c, event);
};

// ── Screen / UI visibility ───────────────────────────────────────────────────

export const setBoardVisible = (on: boolean): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const root = c.boardEl.closest('.playgame-root') as HTMLElement | null;
  if (root) root.classList.toggle('board-hidden', !on);
  return new Promise<void>((r) => setTimeout(r, 620));
};

// ── Toasts ───────────────────────────────────────────────────────────────────

export const toast = (text: string, opts: { duration?: number } = {}): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const duration = opts.duration ?? 1400;
  showToast(c.toastArea, text, { duration });
  return new Promise<void>((r) => setTimeout(r, duration + 100));
};

// ── Location tiles ───────────────────────────────────────────────────────────

export const hideLocationTiles = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  for (let i = 0; i < 3; i++) {
    const el = c.boardEl.querySelector(`.location[data-lane="${i}"]`) as HTMLElement | null;
    if (!el) continue;
    el.style.transition = 'none';
    el.style.opacity = '0';
  }
  return Promise.resolve();
};

export const fadeInLocationTile = (laneIndex: number, ms = 400): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const el = c.boardEl.querySelector(`.location[data-lane="${laneIndex}"]`) as HTMLElement | null;
  if (!el) return Promise.resolve();
  el.style.opacity = '0';
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '1';
  return new Promise<void>((r) => setTimeout(r, ms));
};

// ── Card draw pipeline ────────────────────────────────────────────────────────

/**
 * Pull cards from the local engine deck and route each CARD_DRAWN event
 * through the presentation adapter. The reducer still owns the DECK→HAND
 * mutation; the adapter owns hidden hand-slot reservation and deck-slide timing.
 *
 * Deck is pre-populated and seed-driven by `createInitialMatchState()`.
 * The explicit `drawQueue` ctx is kept for test fixtures that pre-seed
 * specific cards; when empty, we pop from the engine deck.
 */
export const drawFromDeck = (count = 1): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;

  for (let i = 0; i < count; i++) {
    if ((c.state.hand[c.localSeat] as unknown[]).length >= c.manifest.constants.handCap) return;

    // `drawQueue` override path — for tests / scripted intros.
    const override = c.drawQueue.shift() as import('../engine/manifest/types').CardDef | undefined;
    if (override) {
      const inst = newEngineCardInstance(override, c.localSeat);
      await animateEvent(c, {
        type: 'CARD_ADDED_TO_HAND',
        owner: c.localSeat,
        cardId: inst.id,
        defId: override.defId,
        spawnSource: { kind: 'DECK_CREATION' },
      });
      continue;
    }

    // Real-deck path: pop the top card off `state.deck[P0]` via the
    // reducer-owned CARD_DRAWN event. Deck is already seeded + shuffled.
    const deck = c.state.deck[c.localSeat] as readonly { id: string }[];
    if (deck.length === 0) break;
    const top = deck[0];
    await animateEvent(c, {
      type: 'CARD_DRAWN',
      owner: c.localSeat,
      cardId: top.id as CardId,
      toHand: true,
    });
  }
};

/**
 * Deal one card to the player's hand — single-card draw (backward-compat
 * shortcut for the opening sequence).
 */
export const dealPlayerCard = (
  def?: import('../engine/manifest/types').CardDef,
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if (def) {
    // Pre-specified card: add through the same event-driven hand-entry path.
    const inst = newEngineCardInstance(def, c.localSeat);
    const event: MatchEvent = {
      type: 'CARD_ADDED_TO_HAND',
      owner: c.localSeat,
      cardId: inst.id,
      defId: def.defId,
      spawnSource: { kind: 'DECK_CREATION' },
    };
    await animateEvent(c, event);
  } else {
    await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
  }
};

// ── Location reveal ───────────────────────────────────────────────────────────

const engineLocationRevealSlice = (
  c: PlayScriptCtx,
  lane: LaneIdx,
  locationId: string,
): readonly MatchEvent[] | null => {
  const events = c._engineEvents ?? [];
  const revealIdx = events.findIndex((event) =>
    event.type === 'LOCATION_REVEALED' &&
    event.lane === lane &&
    event.locationId === locationId,
  );
  if (revealIdx < 0) return null;

  // Location reveal is the final phase of resolveTurn; everything after the
  // LOCATION_REVEALED event belongs to that reveal's location ability slice.
  return events.slice(revealIdx + 1);
};

const dispatchLocalLocationRevealEffects = async (
  c: PlayScriptCtx,
  lane: LaneIdx,
  locationId: string,
): Promise<void> => {
  const raw = unwrap(c.state) as EngineMatchState;
  const loc = raw.lanes[lane].location;
  if (!loc || loc.id !== locationId) return;

  const locDef = c.manifest.locations[loc.defId];
  const effects = locDef?.abilities.onReveal ?? [];
  let s = raw;
  for (let idx = 0; idx < effects.length; idx++) {
    const effectCtx: EffectCtx = {
      state: s,
      manifest: c.manifest,
      self: loc.id,
      selfKind: 'location',
      selfLane: lane,
      selfOwner: null,
      rng: c.engineRng.fork(`location-reveal:${loc.id}:${idx}`),
      source: { sourceId: loc.id, effectKind: 'LOCATION', exprIdx: idx },
      depth: 0,
    };
    const result = evalEffect(s, effects[idx], effectCtx, c.manifest);
    for (const event of result.events) {
      await dispatchEventWithPresentation(c, event);
    }
    s = result.state;
  }
};

const dispatchLocationRevealEffects = async (
  c: PlayScriptCtx,
  lane: LaneIdx,
  locationId: string,
): Promise<void> => {
  const engineSlice = engineLocationRevealSlice(c, lane, locationId);
  if (engineSlice) {
    for (const event of engineSlice) {
      await dispatchEventWithPresentation(c, event);
    }
    return;
  }

  await dispatchLocalLocationRevealEffects(c, lane, locationId);
};

/**
 * Reveal one location with a 6-stage cinematic. The engine's
 * LOCATION_REVEALED event sets `locationRevealed = true` at stage 5.
 */
export const revealLocation = (laneIndex: number): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const laneEl = c.boardEl.querySelector(
    `.lane-map[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;
  const tileEl = c.boardEl.querySelector(
    `.location[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;

  if (tileEl) {
    tileEl.style.transition = 'none';
    tileEl.style.opacity = '0';
  }

  if (laneEl) {
    laneEl.style.transition = 'opacity 1300ms ease';
    laneEl.style.opacity = '1';
  }
  await new Promise<void>((r) => setTimeout(r, 1300));
  await new Promise<void>((r) => setTimeout(r, 200));

  if (laneEl) {
    laneEl.style.transition = 'filter 350ms ease';
    laneEl.style.filter = 'blur(1px)';
  }
  await new Promise<void>((r) => setTimeout(r, 350));

  // Dispatch LOCATION_REVEALED — engine sets locationRevealed = true.
  const loc = c.state.lanes[laneIndex as LaneIdx].location;
  if (loc) {
    c.dispatch({ type: 'LOCATION_REVEALED', lane: laneIndex as LaneIdx, locationId: loc.id });
    await dispatchLocationRevealEffects(c, laneIndex as LaneIdx, loc.id);
  }

  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const freshTile = c.boardEl.querySelector(
    `.location[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;
  if (freshTile) {
    freshTile.style.transition = 'none';
    freshTile.style.opacity = '0';
    freshTile.style.transform = 'rotateY(90deg) scale(0.85)';
    freshTile.getBoundingClientRect();
    freshTile.style.transition =
      'opacity 500ms ease, transform 500ms cubic-bezier(.2,0,.4,1)';
    freshTile.style.opacity = '1';
    freshTile.style.transform = 'rotateY(0deg) scale(1)';
  }
  await new Promise<void>((r) => setTimeout(r, 600));
  await new Promise<void>((r) => setTimeout(r, 500));
};

export const revealNextLocation = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const i = c.state.lanes.findIndex((lane) => !lane.locationRevealed);
  if (i < 0 || i >= 3) return Promise.resolve();
  return (revealLocation(i) as (ctx: typeof c) => Promise<void>)(c);
};

// ── Turn resolution ───────────────────────────────────────────────────────────

/**
 * Flip player's this-turn staged cards face-down in the UI.
 *
 * In the engine, staged cards already have `card.revealed = false`.
 * The UI was showing them face-up (Snap UX). Setting `ui.isFlipped = true`
 * tells BoardCard components to stop overriding — they now render face-down.
 */
export const flipPlayerCardsFaceDown = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const localStaged = c.state.stagingOrder.filter(
    (id) => c.state.cards[id]?.owner === c.localSeat,
  );
  if (localStaged.length === 0) return;
  c.setUi('isFlipped', true);
  await new Promise<void>((r) => setTimeout(r, 250));
};

// ── Step 8b/8c: Engine-event-driven turn resolution ──────────────────────────

/**
 * Run `resolveTurn` to get the authoritative event stream for this turn.
 * Events are stored on ctx for VFX actions to consume; the engine state
 * is NOT updated yet (VFX actions dispatch events incrementally as
 * animations play so the UI stays in sync with what the player sees).
 */
export const captureEngineEndTurn = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const raw = unwrap(c.state) as EngineMatchState;
  const result = resolveTurn(
    raw,
    c.manifest,
    c.engineRng.fork(`turn:${raw.turn}`),
  );
  c._engineEvents = result.events;
  c._engineFinalState = result.state;
  return Promise.resolve();
};

/**
 * Dispatch a single per-reveal event to the store, playing its matching
 * animation if any. Per-reveal events are the ones that fire DURING a
 * card's On Reveal cascade (OR windows, power deltas, moves, destroys,
 * etc.) — everything between one CARD_FLIPPED and the next, or up to
 * TURN_ENDED for the final revealed card.
 *
 * Non-local hand additions still use the current draw-to-hand script. All
 * other events go through the shared presentation adapter so reveal-time and
 * post-reveal bookkeeping use the same choreography.
 */
const dispatchPerRevealEvent = async (c: PlayScriptCtx, event: MatchEvent): Promise<void> => {
  await dispatchEventWithPresentation(c, event);
};

/**
 * Reveal all pending cards in the order the engine dictated (priority-
 * first), playing out each card's On Reveal cascade inline between its
 * flip animation and the next card's flip.
 *
 * Event-slicing contract: for each `CARD_FLIPPED`, the events strictly
 * between it and the NEXT `CARD_FLIPPED` (or `TURN_ENDED`, whichever
 * comes first) constitute that card's per-reveal slice. The slice is
 * dispatched through `dispatchPerRevealEvent` after the flip cinematic
 * and before the next flip, so move-on-reveal / damage-on-reveal / spawn-
 * on-reveal all animate in the correct narrative order.
 *
 * `TURN_ENDED` is the handoff boundary: `advanceTurnFromEngine` picks up
 * at that index to run bookkeeping (cleanup tags, energy ramp, TURN_STARTED,
 * draws). Caller stores the split index on ctx so the two actions stay
 * in sync.
 */
export const revealByPriorityFromEngine = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const events = c._engineEvents ?? [];

  // Build an index of CARD_FLIPPED positions and find the TURN_ENDED
  // boundary in one pass. `turnEndedIdx` defaults to events.length so a
  // stream with no TURN_ENDED (unlikely, but shape-safe) still terminates.
  const flippedIndices: Array<{ cardId: string; idx: number }> = [];
  let turnEndedIdx = events.length;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'CARD_FLIPPED') {
      flippedIndices.push({ cardId: e.cardId as string, idx: i });
    } else if (e.type === 'TURN_ENDED' && turnEndedIdx === events.length) {
      turnEndedIdx = i;
    }
  }
  c._revealsConsumedUpTo = turnEndedIdx;

  if (flippedIndices.length === 0) return;

  // Only animate cards still face-down in the UI — CARD_FLIPPED can appear
  // for cards the engine chose to flip but the UI already considers revealed.
  const activeFlipped = flippedIndices.filter(({ cardId }) => {
    const card = c.state.cards[cardId as CardId];
    return card && !card.revealed;
  });
  if (activeFlipped.length === 0) return;

  await revealPendingCinematic({
    pendingIds: activeFlipped.map(({ cardId }) => cardId),
    cardElMap: c.cardRefs,
    boardWrap: c.boardWrap,
    sfx: c.sfx,
    onRevealed: async (id) => {
      // Flip first: dispatch CARD_FLIPPED so `card.revealed` becomes true
      // reactively (this also triggers the face-up paint for the newly-
      // revealed card).
      c.dispatch({ type: 'CARD_FLIPPED', cardId: id as CardId });

      // Per-reveal slice = (this CARD_FLIPPED, next CARD_FLIPPED ∪ TURN_ENDED).
      const myIdx = flippedIndices.find((f) => f.cardId === id)?.idx;
      if (myIdx === undefined) return;
      const nextIdx = flippedIndices.find((f) => f.idx > myIdx)?.idx ?? turnEndedIdx;
      const slice = events.slice(myIdx + 1, nextIdx);
      for (const ev of slice) {
        if (ev.type === 'CARD_FLIPPED') continue; // belongs to another card
        await dispatchPerRevealEvent(c, ev);
      }
    },
  });
};

/**
 * Dispatch the remainder of the engine's turn-resolution event stream to
 * the UI store.
 *
 * Design note: this used to carry a WHITELIST of event types to dispatch,
 * which silently dropped every new `MatchEvent` variant the engine grew
 * (we lost `MAX_ENERGY_CHANGED` this way). The correct shape is an
 * EXCLUSION list: dispatch everything by default, skip only the events
 * that another script action has already played out with its own
 * animation.
 *
 * `CARD_FLIPPED` is dispatched per-card by `revealByPriorityFromEngine`
 * during the flip cinematic; re-dispatching it here would double-flip
 * and break priority ordering. Everything else (power deltas, moves,
 * destroys, draws, location reveals, energy ramps, turn boundaries,
 * match end) reaches the store.
 *
 * Also resets `ui.isFlipped` so next turn's staged cards show face-up.
 */
const SCRIPT_OWNED_EVENT_TYPES: ReadonlySet<MatchEvent['type']> = new Set<MatchEvent['type']>([
  'CARD_FLIPPED',        // played out per-card by revealByPriorityFromEngine
  'LOCATION_REVEALED',   // played out by revealNextLocation cinematic
]);

export const advanceTurnFromEngine = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const events = c._engineEvents ?? [];

  // Resume from where `revealByPriorityFromEngine` left off (TURN_ENDED
  // boundary). Events before that index are per-reveal and have already
  // been dispatched + animated inline with each card's flip cinematic;
  // re-dispatching them here would double-apply every mutation.
  const startIdx = c._revealsConsumedUpTo ?? 0;

  for (let i = startIdx; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'LOCATION_REVEALED') break;
    if (SCRIPT_OWNED_EVENT_TYPES.has(event.type)) continue;
    await dispatchEventWithPresentation(c, event);
  }

  // Reset the face-up override so next turn's staged cards show face-up.
  c.setUi('isFlipped', false);

  // Lock the official result the first time the engine ends the match.
  // Free play can continue afterward, but the recorded result never changes.
  if (c.state.phase === 'ENDED' && c.state.result && !c.ui.lockedResult) {
    c.setUi('lockedResult', c.state.result);
    c.setUi('showEndGamePrompt', true);
  }

  showToast(c.toastArea, `TURN ${c.state.turn}`, { duration: 2100 });
  await new Promise<void>((r) => setTimeout(r, 1200));
};

/**
 * Enemy plays cards until it runs out of energy, hand space, or lane space.
 *
 * Delegates all planning (card + lane selection) to `planEnemyTurnFromPool`
 * in the engine's pure AI module. This action is now just a thin adapter:
 *   1. Ask the engine for a turn plan (seeded, deterministic).
 *   2. For each play, dispatch the engine events + run the fly-in animation.
 *
 * Once P1 hands are pre-populated (Tier 1.2 finalized across the UI),
 * switch to `planEnemyTurnFromHand` so plays reference real hand cards
 * instead of minted-on-the-fly defs.
 */
export const autoPlayRemoteSeat = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;

  const plays = planEnemyTurnFromPool(
    c.state as EngineMatchState,
    c.remoteSeat,
    c.manifest,
    c.engineRng,
    { forkTag: `seat-plays:${c.remoteSeat}` },
  );

  for (const play of plays) {
    const def = c.manifest.cards[play.defId];
    if (!def) continue;
    const inst = newEngineCardInstance(def, c.remoteSeat);

    c.dispatch({
      type: 'CARD_ADDED_TO_HAND',
      owner: c.remoteSeat,
      cardId: inst.id,
      defId: def.defId,
      spawnSource: { kind: 'DECK_CREATION' },
    });
    c.dispatch({
      type: 'CARD_STAGED',
      intentId: `seat-${c.remoteSeat}-${inst.id}`,
      owner: c.remoteSeat,
      cardId: inst.id,
      lane: play.lane,
      cost: play.cost,
    });
    c.dispatch({
      type: 'ENERGY_CHANGED',
      owner: c.remoteSeat,
      delta: -play.cost,
      reason: 'CARD_PLAYED',
    });

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const slotEl = c.cardRefs.get(inst.id);
    if (!slotEl) continue;
    const slotRect = slotEl.getBoundingClientRect();
    const startRect = {
      left: slotRect.left,
      top: slotRect.top - slotRect.height * 1.8,
      width: slotRect.width,
      height: slotRect.height,
    };

    await flyFaceDownToSlot({
      cardId: inst.id,
      startRect,
      cardElMap: c.cardRefs,
      boardWrap: c.boardWrap,
      showPreview: false,
    });
  }
};

/**
 * Draw one card into the player's hand with animation.
 */
export const drawHandCard = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if ((c.state.hand[c.localSeat] as unknown[]).length >= c.manifest.constants.handCap) return;
  await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
};

/** Mark match as resolving. */
export const startResolving = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setPhase('RESOLVING');
  return Promise.resolve();
};

/** Mark match as awaiting intent. */
export const finishResolving = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setPhase('AWAITING_INTENT');
  return Promise.resolve();
};

export { wait } from './runner';
