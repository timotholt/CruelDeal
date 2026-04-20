/**
 * Script Engine — named actions. Ported from
 * ccg/vfx-engine/project/game/script/actions.js and adapted so state
 * mutations go through Solid's store `setState` instead of direct
 * property writes.
 *
 * Each action returns a `Step` that resolves when its visible effect is
 * complete. Actions read what they need off `ctx`.
 */

import { produce, type SetStoreFunction } from 'solid-js/store';
import { Timeline } from '@/services/vfx/timeline';
import { flyFaceDownToSlot } from '@/services/vfx/animations/fly-face-down';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import type { Step } from './runner';
import type { CardDef, CardInstance, MatchState } from '../types';
import { newCardInstance, randomCardDef } from '../state';
import { showToast } from '../toast';

/** Ctx fields the actions expect. */
export interface PlayScriptCtx extends Record<string, unknown> {
  /** Live match state (read-only — mutate via setState). */
  state: MatchState;
  /** Solid store setter. */
  setState: SetStoreFunction<MatchState>;
  /** Board root element (`.board`). */
  boardEl: HTMLElement;
  /** Board-wrap element (`.board-wrap`) — the VFXEngine mount point. The
   *  reveal cinematic needs this to mount its full-board zoom overlay. */
  boardWrap: HTMLElement;
  /** Toast area element (`.toast-area`). */
  toastArea: HTMLElement;
  /** Map from card id -> its live DOM element (from VfxHost). */
  cardRefs: Map<string, HTMLElement>;
  /** Queue of card defs to deal from, pre-seeded by the flow. */
  drawQueue: CardDef[];
  /** Optional SFX hook (passed through to the reveal cinematic). */
  sfx?: (name: string) => void;
  /** True once the caller cancels (e.g. on screen unmount). */
  cancelled?: boolean;
}

// ---- Screen / UI visibility --------------------------------------------

/**
 * Toggle the `.board-hidden` helper class on `.playgame-root`. The CSS in
 * playgame.css hides the board UI (hud, game area, hand, action bar) with
 * an opacity transition when this class is on.
 */
export const setBoardVisible = (on: boolean): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const root = c.boardEl.closest('.playgame-root') as HTMLElement | null;
  if (root) root.classList.toggle('board-hidden', !on);
  return new Promise<void>((r) => setTimeout(r, 620));
};

// ---- Toasts -------------------------------------------------------------

export const toast = (text: string, opts: { duration?: number } = {}): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const duration = opts.duration ?? 1400;
  showToast(c.toastArea, text, { duration });
  return new Promise<void>((r) => setTimeout(r, duration + 100));
};

// ---- Location tiles -----------------------------------------------------

/** Immediately hide all 3 location tiles (opacity 0, no transition). */
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

/** Fade in one location tile over `ms` milliseconds. */
export const fadeInLocationTile = (laneIndex: number, ms = 400): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const el = c.boardEl.querySelector(`.location[data-lane="${laneIndex}"]`) as HTMLElement | null;
  if (!el) return Promise.resolve();
  el.style.opacity = '0';
  // Force reflow so the 0 is committed before transitioning.
  void el.offsetWidth;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '1';
  return new Promise<void>((r) => setTimeout(r, ms));
};

// ---- Cards --------------------------------------------------------------

/**
 * Deal one card from `ctx.drawQueue` (or the random pool if the queue is
 * empty) into the player's hand and pop it in with a vfx-pop animation.
 */
export const dealPlayerCard = (
  card?: CardDef,
  { popDuration = 400 }: { popDuration?: number } = {},
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const def = card ?? c.drawQueue.shift() ?? randomCardDef();
  const instance: CardInstance = newCardInstance(def);

  // Push into the Solid store; reactivity re-renders the hand with the
  // new card. We then await a microtask so Solid has time to render,
  // THEN we look up the card's DOM element via cardRefs (VfxHost).
  c.setState(
    produce<MatchState>((s) => {
      s.hand.push(instance);
    }),
  );

  // Yield to the event loop so Solid commits the new DOM node.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const el = c.cardRefs.get(instance.id);
  if (!el) return;

  const tl = new Timeline();
  tl.add(el, 'vfx-pop', { 'scale-start': '0' }, popDuration, 0);
  tl.play();
  await new Promise<void>((r) => setTimeout(r, popDuration + 40));
};

// ---- Location reveal ----------------------------------------------------

/**
 * Reveal one location with the 6-stage cinematic from the demo's
 * revealLane() (see ccg/vfx-engine/project/index.html ~L665):
 *   1. Hide the ??? tile
 *   2. Fade the lane-map image in (1300ms)
 *   3. Hold sharp (1000ms)
 *   4. Blur the map in place (600ms)
 *   5. Flip state.revealed = true (re-render shows real name)
 *   6. Flip the tile in with a 3D rotateY (500ms)
 *   7. Short tail wait (1500ms)
 */
export const revealLocation = (laneIndex: number): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const laneEl = c.boardEl.querySelector(
    `.lane-map[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;
  const tileEl = c.boardEl.querySelector(
    `.location[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;

  // Stage 1: hide the ??? tile
  if (tileEl) {
    tileEl.style.transition = 'none';
    tileEl.style.opacity = '0';
  }

  // Stage 2: fade map in
  if (laneEl) {
    laneEl.style.transition = 'opacity 1300ms ease';
    laneEl.style.opacity = '1';
  }
  await new Promise<void>((r) => setTimeout(r, 1300));

  // Stage 3: hold sharp
  await new Promise<void>((r) => setTimeout(r, 1000));

  // Stage 4: blur map in place
  if (laneEl) {
    laneEl.style.transition = 'filter 600ms ease';
    laneEl.style.filter = 'blur(1px)';
  }
  await new Promise<void>((r) => setTimeout(r, 600));

  // Stage 5: flip the revealed flag — Solid rerenders the tile with real name
  c.setState(
    produce<MatchState>((s) => {
      if (s.locations[laneIndex]) s.locations[laneIndex].revealed = true;
    }),
  );
  // Wait a frame so Solid commits the new DOM before we grab it.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  // Stage 6: 3D flip the revealed tile in
  const freshTile = c.boardEl.querySelector(
    `.location[data-lane="${laneIndex}"]`,
  ) as HTMLElement | null;
  if (freshTile) {
    freshTile.style.transition = 'none';
    freshTile.style.opacity = '0';
    freshTile.style.transform = 'rotateY(90deg) scale(0.85)';
    // Force layout flush so the starting state actually commits.
    freshTile.getBoundingClientRect();
    freshTile.style.transition =
      'opacity 500ms ease, transform 500ms cubic-bezier(.2,0,.4,1)';
    freshTile.style.opacity = '1';
    freshTile.style.transform = 'rotateY(0deg) scale(1)';
  }
  await new Promise<void>((r) => setTimeout(r, 600));

  // Stage 7: short tail so the next beat doesn't step on this one
  await new Promise<void>((r) => setTimeout(r, 1500));
};

/** Reveal the next unrevealed lane in order, if any. */
export const revealNextLocation = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const i = c.state.locations.findIndex((loc) => !loc.revealed);
  if (i < 0 || i >= 3) return Promise.resolve();
  return (revealLocation(i) as (ctx: typeof c) => Promise<void>)(c);
};

// ---- Turn resolution ---------------------------------------------------

/**
 * Reveal all of the player's currently-pending cards in sequence using
 * the ported reveal cinematic (zoom card face-up, hold, return).
 */
export const revealPendingCards = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const pendingIds = [...c.state.pending];
  if (pendingIds.length === 0) return;

  await revealPendingCinematic({
    pendingIds,
    cardElMap: c.cardRefs,
    boardWrap: c.boardWrap,
    sfx: c.sfx,
    onRevealed: (id) => {
      // Clear each id from state.pending as its flip completes so the
      // face-up card remains on the board (no longer rendered facedown).
      c.setState(
        produce<MatchState>((s) => {
          s.pending = s.pending.filter((pid) => pid !== id);
        }),
      );
    },
  });
};

/**
 * Enemy picks a random non-full lane and plays one card, flying face-down
 * from above the enemy row and then revealing with the same cinematic
 * as player cards.
 */
export const enemyPlayRandom = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;

  // Pick a lane with room; bail if all full.
  const candidates = [0, 1, 2].filter((i) => c.state.enemyLanes[i].length < 4);
  if (candidates.length === 0) return;
  const lane = candidates[Math.floor(Math.random() * candidates.length)];

  const def = randomCardDef();
  const card = newCardInstance(def);

  // Push into state as pending (face-down) then wait a frame for Solid to render.
  c.setState(
    produce<MatchState>((s) => {
      s.enemyLanes[lane].push(card);
      s.pending.push(card.id);
    }),
  );
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  // Synthetic source rect: above the target slot so the card appears to
  // fall in from off-board.
  const slotEl = c.cardRefs.get(card.id);
  if (!slotEl) return;
  const slotRect = slotEl.getBoundingClientRect();
  const startRect = {
    left: slotRect.left,
    top: slotRect.top - slotRect.height * 1.8,
    width: slotRect.width,
    height: slotRect.height,
  };

  await flyFaceDownToSlot({
    cardId: card.id,
    startRect,
    cardElMap: c.cardRefs,
    boardWrap: c.boardWrap,
    showPreview: false,
  });
  await new Promise<void>((r) => setTimeout(r, 150));

  // Reveal the enemy card with the same cinematic as player cards.
  await revealPendingCinematic({
    pendingIds: [card.id],
    cardElMap: c.cardRefs,
    boardWrap: c.boardWrap,
    sfx: c.sfx,
    onRevealed: () => {
      c.setState(
        produce<MatchState>((s) => {
          s.pending = s.pending.filter((pid) => pid !== card.id);
        }),
      );
    },
  });
};

/**
 * Advance state.turn by 1, refill energy (cap = min(turn, 6)), and show
 * a "TURN N" banner. Mirrors the demo's turn bookkeeping.
 */
export const advanceTurn = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setState(
    produce<MatchState>((s) => {
      s.turn += 1;
      s.energyMax = Math.min(s.turn, 6);
      s.energy = s.energyMax;
    }),
  );
  showToast(c.toastArea, `TURN ${c.state.turn}`, { duration: 2100 });
  await new Promise<void>((r) => setTimeout(r, 1200));
};

/**
 * Draw one card into the player's hand with a vfx-pop animation, unless
 * the hand is already full (>=7). Composed on top of dealPlayerCard().
 */
export const drawHandCard = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if (c.state.hand.length >= 7) return;
  await (dealPlayerCard() as (c: typeof ctx) => Promise<void>)(ctx);
};

/** Mark the match as no-longer-resolving so the END TURN button re-enables. */
export const finishResolving = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setState('resolving', false);
  return Promise.resolve();
};

export const startResolving = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setState('resolving', true);
  return Promise.resolve();
};

export { wait } from './runner';
