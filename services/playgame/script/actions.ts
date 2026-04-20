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
  /** Toast area element (`.toast-area`). */
  toastArea: HTMLElement;
  /** Map from card id -> its live DOM element (from VfxHost). */
  cardRefs: Map<string, HTMLElement>;
  /** Queue of card defs to deal from, pre-seeded by the flow. */
  drawQueue: CardDef[];
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

/** Reveal one location (flip its `revealed` flag). */
export const revealLocation = (laneIndex: number): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setState(
    produce<MatchState>((s) => {
      if (s.locations[laneIndex]) s.locations[laneIndex].revealed = true;
    }),
  );
  // Allow a short beat for the change to paint. Real flip animation
  // comes in a later slice.
  return new Promise<void>((r) => setTimeout(r, 300));
};

/** Reveal the next unrevealed lane in order, if any. */
export const revealNextLocation = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const i = c.state.locations.findIndex((loc) => !loc.revealed);
  if (i < 0 || i >= 3) return Promise.resolve();
  return (revealLocation(i) as (ctx: typeof c) => Promise<void>)(c);
};

export { wait } from './runner';
