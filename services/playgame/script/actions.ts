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
import { slideFromDeckToHand } from '@/services/vfx/animations/slide-from-deck';
import {
  captureHandRects,
  playLayoutSlide,
} from '@/services/vfx/animations/layout-flip';
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
  /**
   * Deck anchor element — the visual origin for draw slides. Optional;
   * when absent, slide animations fall back to a synthetic point outside
   * the board edge so nothing breaks.
   */
  deckEl?: HTMLElement;
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
 * Compute the deck-origin rect. Prefers the live `.deck-anchor` element
 * when one is mounted; falls back to a synthetic point just off the
 * right edge of the board so the slide still has a direction.
 */
const deckSourceRect = (c: PlayScriptCtx): DOMRect => {
  if (c.deckEl && c.deckEl.isConnected) return c.deckEl.getBoundingClientRect();
  const b = c.boardEl.getBoundingClientRect();
  // Roughly one hand-card's worth of width, off the right edge, roughly
  // aligned with the hand row.
  const w = 70;
  const h = 100;
  return new DOMRect(b.right + 20, b.bottom - h - 40, w, h);
};

/**
 * Stage 1 of the two-stage draw pipeline: pull `count` cards off the
 * draw queue (falling back to `randomCardDef()` if the queue is empty)
 * and push them into `state.incoming`. No animation — this is purely
 * the logical "card has left the deck" step. Other effects (play-from-
 * table, steal from opponent, conjure) can populate `state.incoming`
 * the same way and share the commit animation below.
 */
export const drawFromDeck = (count = 1): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  const picks: CardInstance[] = [];
  for (let i = 0; i < count; i++) {
    const def = c.drawQueue.shift() ?? randomCardDef();
    picks.push(newCardInstance(def));
  }
  c.setState(
    produce<MatchState>((s) => {
      s.incoming.push(...picks);
    }),
  );
  return Promise.resolve();
};

/**
 * Push an already-constructed `CardInstance` into `state.incoming`.
 * Used by non-deck sources (board steals, generated cards, etc.) so
 * they can share `commitIncomingToHand`'s animation.
 */
export const queueIncoming = (instance: CardInstance): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  c.setState(
    produce<MatchState>((s) => {
      s.incoming.push(instance);
    }),
  );
  return Promise.resolve();
};

/**
 * Stage 2 of the two-stage draw pipeline: drain `state.incoming` into
 * `state.hand`, one card at a time, sliding each one in from the deck
 * anchor while the rest of the hand smoothly reflows via the FLIP
 * technique. Caps the hand at 7 (extras are silently discarded — a
 * later slice can surface a "HAND FULL" toast).
 */
export const commitIncomingToHand = (
  opts: { stagger?: number; popDuration?: number } = {},
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const stagger = opts.stagger ?? 120;
  const popDuration = opts.popDuration ?? 320;

  // Snapshot the incoming queue once. If the queue is mutated during the
  // animation (unlikely but possible), those extras wait for the next
  // commit step.
  const batch = [...c.state.incoming];
  if (batch.length === 0) return;

  for (let i = 0; i < batch.length; i++) {
    const card = batch[i];

    // Hand cap: discard the overflow and the corresponding incoming entry.
    if (c.state.hand.length >= 7) {
      c.setState(
        produce<MatchState>((s) => {
          s.incoming = s.incoming.filter((x) => x.id !== card.id);
        }),
      );
      continue;
    }

    // Capture existing hand rects BEFORE the mutation so the FLIP slide
    // animates the reflow on top of the slide-in.
    const oldIds = c.state.hand.map((h) => h.id);
    const oldRects = captureHandRects(oldIds, c.cardRefs);

    // Move this card from incoming -> hand in one atomic setState so the
    // UI never briefly shows the card in neither list.
    c.setState(
      produce<MatchState>((s) => {
        s.incoming = s.incoming.filter((x) => x.id !== card.id);
        s.hand.push(card);
      }),
    );

    // Wait one frame for Solid to render the new hand DOM.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    // Play the hand-reflow slide for survivors and the deck slide for
    // the new card in parallel.
    playLayoutSlide(oldRects, c.cardRefs);
    const startRect = deckSourceRect(c);
    const slidePromise = slideFromDeckToHand({
      cardId: card.id,
      startRect,
      cardElMap: c.cardRefs,
      boardWrap: c.boardWrap,
      sfx: c.sfx,
    });

    // Pop the newly drawn card after the slide lands.
    await slidePromise;
    const el = c.cardRefs.get(card.id);
    if (el) {
      const tl = new Timeline();
      tl.add(el, 'vfx-pop', { 'scale-start': '0.8' }, popDuration, 0);
      tl.play();
      await new Promise<void>((r) => setTimeout(r, popDuration + 40));
    }

    // Short beat before the next card so a multi-draw reads as a sequence.
    if (i < batch.length - 1) {
      await new Promise<void>((r) => setTimeout(r, stagger));
    }
  }
};

/**
 * Deal one card to the player's hand — the classic single-card draw.
 * Now implemented on top of the two-stage pipeline so every draw path
 * (opening sequence, end-of-turn, future effects) uses the same slide.
 *
 * Signature preserved for backwards compatibility with the opening
 * sequence; the `card` arg, if provided, goes straight into `incoming`
 * without touching the draw queue.
 */
export const dealPlayerCard = (
  card?: CardDef,
  { popDuration = 320 }: { popDuration?: number } = {},
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if (card) {
    await (queueIncoming(newCardInstance(card)) as (x: typeof ctx) => Promise<void>)(ctx);
  } else {
    await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
  }
  await (
    commitIncomingToHand({ popDuration }) as (x: typeof ctx) => Promise<void>
  )(ctx);
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

  // Stage 3: brief hold sharp before blurring
  await new Promise<void>((r) => setTimeout(r, 200));

  // Stage 4: blur map in place — shortened so the player doesn't wait
  // on a long filter transition before the tile flips in.
  if (laneEl) {
    laneEl.style.transition = 'filter 350ms ease';
    laneEl.style.filter = 'blur(1px)';
  }
  await new Promise<void>((r) => setTimeout(r, 350));

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
  await new Promise<void>((r) => setTimeout(r, 500));
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
 * Draw one card into the player's hand with the deck-slide + FLIP
 * reflow animation. Two-stage under the hood: draw into `incoming`,
 * then commit. Skips the work entirely when the hand is already full.
 */
export const drawHandCard = (): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  if (c.state.hand.length >= 7) return;
  await (drawFromDeck(1) as (x: typeof ctx) => Promise<void>)(ctx);
  await (commitIncomingToHand() as (x: typeof ctx) => Promise<void>)(ctx);
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
