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
import { Timeline } from '@/services/vfx/timeline';
import { flyFaceDownToSlot } from '@/services/vfx/animations/fly-face-down';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import { slideFromDeckToHand } from '@/services/vfx/animations/slide-from-deck';
import {
  captureHandRects,
  playLayoutSlide,
} from '@/services/vfx/animations/layout-flip';
import type { Step } from './runner';
import type { MatchState as EngineMatchState, MatchPhase } from '../engine/types/state';
import type { MatchEvent } from '../engine/types/events';
import type { CardId, LaneIdx } from '../engine/types/ids';
import type { Manifest } from '../engine/manifest/types';
import type { Rng } from '../engine/rng';
import { resolveTurn } from '../engine/resolve';
import {
  type ResolvedCard,
  type UiState,
  resolveCard,
  randomManifestCardDef,
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
  /** UI sidecar state (incoming buffer, undo history, flip flag). */
  ui: UiState;
  /** Setter for UI sidecar. */
  setUi: SetStoreFunction<UiState>;
  /** Game manifest for card/location def lookups and engine calls. */
  manifest: Manifest;
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
}

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

const deckSourceRect = (c: PlayScriptCtx): DOMRect => {
  if (c.deckEl && c.deckEl.isConnected) return c.deckEl.getBoundingClientRect();
  const b = c.boardEl.getBoundingClientRect();
  const w = 70;
  const h = 100;
  return new DOMRect(b.right + 20, b.bottom - h - 40, w, h);
};

/**
 * Stage 1 of the two-stage draw pipeline: pull cards from the draw queue
 * (or randomManifestCardDef() fallback), emit CARD_ADDED_TO_HAND events,
 * and push ResolvedCards into `ui.incoming`.
 */
export const drawFromDeck = (count = 1): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  if ((c.state.hand['PLAYER'] as unknown[]).length >= 7) return Promise.resolve();

  for (let i = 0; i < count; i++) {
    const def = (c.drawQueue.shift() as import('../engine/manifest/types').CardDef | undefined)
      ?? randomManifestCardDef(c.manifest);
    if (!def) continue;

    const inst = newEngineCardInstance(def, 'PLAYER');
    const event: MatchEvent = {
      type: 'CARD_ADDED_TO_HAND',
      owner: 'PLAYER',
      cardId: inst.id,
      defId: def.defId,
      spawnSource: { kind: 'DECK_CREATION' },
    };
    c.dispatch(event);

    // Resolve card from the now-updated engine state.
    const raw = unwrap(c.state) as EngineMatchState;
    const resolved = resolveCard(inst.id, raw, c.manifest);
    if (resolved) c.setUi('incoming', (prev: ResolvedCard[]) => [...prev, resolved]);
  }
  return Promise.resolve();
};

/**
 * Push an already-resolved card directly into `ui.incoming`.
 * Used by non-deck sources (conjure, steal) so they share the commit animation.
 */
export const queueIncoming = (resolved: ResolvedCard): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setUi('incoming', (prev: ResolvedCard[]) => [...prev, resolved]);
  return Promise.resolve();
};

/**
 * Stage 2 of the two-stage draw pipeline: drain `ui.incoming` into the
 * player hand one card at a time, animating each with a deck-slide + FLIP.
 */
export const commitIncomingToHand = (
  opts: { stagger?: number; popDuration?: number } = {},
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const stagger = opts.stagger ?? 120;
  const popDuration = opts.popDuration ?? 320;

  const batch = [...c.ui.incoming];
  if (batch.length === 0) return;

  for (let i = 0; i < batch.length; i++) {
    const card = batch[i];

    // Cap check against current engine hand.
    if ((c.state.hand['PLAYER'] as unknown[]).length > 7) {
      c.setUi('incoming', (prev: ResolvedCard[]) => prev.filter((x) => x.id !== card.id));
      continue;
    }

    // Note: the card is already in engine hand (added in drawFromDeck).
    // Just capture rects for the FLIP animation, remove from incoming.
    const handCards = c.state.hand['PLAYER'];
    const oldIds = handCards.map((h) => h.id as string).filter((id) => id !== card.id);
    const oldRects = captureHandRects(oldIds, c.cardRefs);

    c.setUi('incoming', (prev: ResolvedCard[]) => prev.filter((x) => x.id !== card.id));

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    playLayoutSlide(oldRects, c.cardRefs);
    const startRect = deckSourceRect(c);
    const slidePromise = slideFromDeckToHand({
      cardId: card.id,
      startRect,
      cardElMap: c.cardRefs,
      boardWrap: c.boardWrap,
      sfx: c.sfx,
    });

    await slidePromise;
    const el = c.cardRefs.get(card.id);
    if (el) {
      const tl = new Timeline();
      tl.add(el, 'vfx-pop', { 'scale-start': '0.8' }, popDuration, 0);
      tl.play();
      await new Promise<void>((r) => setTimeout(r, popDuration + 40));
    }

    if (i < batch.length - 1) {
      await new Promise<void>((r) => setTimeout(r, stagger));
    }
  }
};

/**
 * Deal one card to the player's hand — single-card draw (backward-compat
 * shortcut for the opening sequence).
 */
export const dealPlayerCard = (
  def?: import('../engine/manifest/types').CardDef,
  { popDuration = 320 }: { popDuration?: number } = {},
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if (def) {
    // Pre-specified card: add directly to engine hand + incoming.
    const inst = newEngineCardInstance(def, 'PLAYER');
    const event: MatchEvent = {
      type: 'CARD_ADDED_TO_HAND',
      owner: 'PLAYER',
      cardId: inst.id,
      defId: def.defId,
      spawnSource: { kind: 'DECK_CREATION' },
    };
    c.dispatch(event);
    const resolved = resolveCard(inst.id, unwrap(c.state) as EngineMatchState, c.manifest);
    if (resolved) c.setUi('incoming', (prev: ResolvedCard[]) => [...prev, resolved]);
  } else {
    await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
  }
  await (commitIncomingToHand({ popDuration }) as (x: typeof ctx) => Promise<void>)(ctx);
};

// ── Location reveal ───────────────────────────────────────────────────────────

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
  const playerStaged = c.state.stagingOrder.filter(
    (id) => c.state.cards[id]?.owner === 'PLAYER',
  );
  if (playerStaged.length === 0) return;
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
 * Reveal all pending cards in the order the engine dictated (priority-first).
 * Dispatches CARD_FLIPPED for each card as its reveal animation completes.
 */
export const revealByPriorityFromEngine = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const events = c._engineEvents ?? [];

  // CARD_FLIPPED events are already in priority order from resolveTurn.
  const flippedIds = events
    .filter((e): e is Extract<MatchEvent, { type: 'CARD_FLIPPED' }> => e.type === 'CARD_FLIPPED')
    .map((e) => e.cardId as string);

  if (flippedIds.length === 0) return;

  // Only reveal cards that are actually face-down (not yet revealed in engine).
  const toReveal = flippedIds.filter((id) => {
    const card = c.state.cards[id as CardId];
    return card && !card.revealed;
  });

  if (toReveal.length === 0) return;

  await revealPendingCinematic({
    pendingIds: toReveal,
    cardElMap: c.cardRefs,
    boardWrap: c.boardWrap,
    sfx: c.sfx,
    onRevealed: (id) => {
      // Dispatch the engine event so card.revealed becomes true reactively.
      c.dispatch({ type: 'CARD_FLIPPED', cardId: id as CardId });
    },
  });
};

/**
 * Advance the turn from the engine's TURN_STARTED event.
 * Dispatches TURN_ENDED, ENERGY_CHANGED, and TURN_STARTED to update
 * turn counter, energy, and priority in the engine state.
 * Resets `ui.isFlipped` so next turn's staged cards show face-up.
 */
export const advanceTurnFromEngine = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const events = c._engineEvents ?? [];

  // Dispatch turn-bookkeeping events in the order the engine produced them.
  const bookkeepingTypes = new Set([
    'TURN_ENDED',
    'ENERGY_CHANGED',
    'TURN_STARTED',
  ]);
  for (const event of events) {
    if (bookkeepingTypes.has(event.type)) {
      c.dispatch(event);
    }
  }

  // Reset the face-up override so next turn's staged cards show face-up.
  c.setUi('isFlipped', false);

  showToast(c.toastArea, `TURN ${c.state.turn}`, { duration: 2100 });
  await new Promise<void>((r) => setTimeout(r, 1200));
};

/**
 * Enemy picks a random non-full lane and plays one card.
 * The card is added to the engine state (CARD_ADDED_TO_HAND + CARD_STAGED)
 * so it appears in `stagingOrder` and gets a CARD_FLIPPED event from
 * captureEngineEndTurn's resolveTurn call.
 */
export const enemyPlayRandom = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;

  // Pick a lane with room.
  const candidates = [0, 1, 2].filter(
    (i) => ((c.state.lanes[i as LaneIdx].cards['OPP'] as unknown[]).length ?? 0) < 4,
  );
  if (candidates.length === 0) return;
  const lane = candidates[Math.floor(Math.random() * candidates.length)] as LaneIdx;
  // @migrate:step-1.3: lane choice still random; engine AI (Tier 1.3) replaces this.

  const def = randomManifestCardDef(c.manifest);
  if (!def) return;
  const inst = newEngineCardInstance(def, 'OPP');

  // Add to engine hand (OPP), then stage.
  c.dispatch({
    type: 'CARD_ADDED_TO_HAND',
    owner: 'OPP',
    cardId: inst.id,
    defId: def.defId,
    spawnSource: { kind: 'DECK_CREATION' },
  });
  c.dispatch({
    type: 'CARD_STAGED',
    intentId: `enemy-${inst.id}`,
    owner: 'OPP',
    cardId: inst.id,
    lane,
    cost: def.cost,
  });

  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  // Fly-in animation: enemy card falls from above the slot.
  const slotEl = c.cardRefs.get(inst.id);
  if (!slotEl) return;
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
};

/**
 * Draw one card into the player's hand with animation.
 */
export const drawHandCard = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if ((c.state.hand['PLAYER'] as unknown[]).length >= 7) return;
  await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
  await (commitIncomingToHand() as (x: typeof ctx) => Promise<void>)(ctx);
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
