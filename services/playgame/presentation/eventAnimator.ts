import type { MatchEvent } from '../engine/types/events';
import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { PlayScriptCtx } from '../script/actions';
import { resolveCard, type ResolvedCard } from '../view';
import { slideFromDeckToHand } from '@/services/vfx/animations/slide-from-deck';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { Timeline } from '@/services/vfx/timeline';
import { unwrap } from 'solid-js/store';
import { describeEventChoreography, type EventChoreography, type SfxCue, type VfxCue } from './choreography';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardId } from '../engine/types/ids';

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const deckSourceRect = (ctx: PlayScriptCtx): DOMRect => {
  if (ctx.deckEl && ctx.deckEl.isConnected) return ctx.deckEl.getBoundingClientRect();
  const b = ctx.boardEl.getBoundingClientRect();
  const w = 70;
  const h = 100;
  return new DOMRect(b.right + 20, b.bottom - h - 40, w, h);
};

const setIncoming = (ctx: PlayScriptCtx, card: ResolvedCard): void => {
  ctx.setUi('incoming', (prev: ResolvedCard[]) => (
    prev.some((item) => item.id === card.id) ? prev : [...prev, card]
  ));
};

const clearIncoming = (ctx: PlayScriptCtx, cardId: string): void => {
  ctx.setUi('incoming', (prev: ResolvedCard[]) => prev.filter((item) => item.id !== cardId));
};

const playSfx = (ctx: PlayScriptCtx, cues: readonly SfxCue[], timing: SfxCue['timing']): void => {
  if (!ctx.sfx) return;
  for (const cue of cues) {
    if (cue.timing === timing) ctx.sfx(cue.name);
  }
};

const playVfxCue = (ctx: PlayScriptCtx, cue: VfxCue): void => {
  switch (cue.kind) {
    case 'power-flash': {
      const cardId = cue.cardId as CardId;
      const isBuff = cue.delta > 0;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_POWER_CHANGED',
        channel: 'power-pulse',
        effectKind: 'power-flash',
        className: isBuff ? 'card-vfx-power-flash card-vfx-power-flash--buff' : 'card-vfx-power-flash card-vfx-power-flash--debuff',
        vars: { '--card-fx-color': isBuff ? '#6dff9d' : '#ff5d8f' },
        durationMs: 260,
        exitDurationMs: 0,
        priority: 10,
        dedupeKey: `power-flash:${cue.cardId}`,
      });
      return;
    }

    case 'destroy-burst': {
      const cardId = cue.cardId as CardId;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'impact-shake',
        effectKind: 'destroy-shake',
        className: 'card-vfx-destroy-shake',
        vars: {},
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'surface-fx',
        effectKind: 'destroy-flash',
        className: 'card-vfx-destroy-flash',
        vars: { '--card-fx-color': '#ff5d8f' },
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-flash:${cue.cardId}`,
      });
      return;
    }

    case 'glitch-flash': {
      const cardId = cue.cardId as CardId;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'impact-shake',
        effectKind: 'glitch-shake',
        className: 'card-vfx-glitch-shake',
        vars: {},
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'surface-fx',
        effectKind: 'glitch-flash',
        className: 'card-vfx-glitch-flash',
        vars: { '--card-fx-color': '#70e1f5' },
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-flash:${cue.cardId}`,
      });
      return;
    }

    case 'none':
      return;
  }
};

const playVfx = (ctx: PlayScriptCtx, choreography: EventChoreography): void => {
  for (const cue of choreography.vfx) playVfxCue(ctx, cue);
};

const animateCardEnterHand = async (
  ctx: PlayScriptCtx,
  event: MatchEvent,
  choreography: EventChoreography,
): Promise<void> => {
  const structural = choreography.structural;
  if (structural.kind !== 'card-enter-hand') return;

  if (structural.owner !== ctx.localSeat) {
    playSfx(ctx, choreography.sfx, 'on-dispatch');
    ctx.dispatch(event);
    playVfx(ctx, choreography);
    playSfx(ctx, choreography.sfx, 'after-dispatch');
    playSfx(ctx, choreography.sfx, 'on-complete');
    return;
  }

  const oldIds = ctx.state.hand[ctx.localSeat].map((card) => card.id as string);
  const oldRects = captureHandRects(oldIds, ctx.cardRefs);

  playSfx(ctx, choreography.sfx, 'on-dispatch');
  ctx.dispatch(event);

  const raw = unwrap(ctx.state) as EngineMatchState;
  const resolved = resolveCard(structural.cardId, raw, ctx.manifest);
  if (!resolved) {
    playVfx(ctx, choreography);
    playSfx(ctx, choreography.sfx, 'after-dispatch');
    playSfx(ctx, choreography.sfx, 'on-complete');
    return;
  }

  setIncoming(ctx, resolved);
  playVfx(ctx, choreography);
  playSfx(ctx, choreography.sfx, 'after-dispatch');

  await nextFrame();
  clearIncoming(ctx, resolved.id);
  await nextFrame();

  playLayoutSlide(oldRects, ctx.cardRefs);
  await slideFromDeckToHand({
    cardId: resolved.id,
    startRect: deckSourceRect(ctx),
    cardElMap: ctx.cardRefs,
    boardWrap: ctx.boardWrap,
    sfx: ctx.sfx,
  });

  const el = ctx.cardRefs.get(resolved.id);
  if (el) {
    const tl = new Timeline();
    tl.add(el, 'vfx-pop', { 'scale-start': '0.8' }, structural.popDurationMs, 0);
    tl.play();
    await new Promise<void>((resolve) => setTimeout(resolve, structural.popDurationMs + 40));
  }

  playSfx(ctx, choreography.sfx, 'on-complete');
};

export async function animateEvent(ctx: PlayScriptCtx, event: MatchEvent): Promise<void> {
  const choreography = describeEventChoreography(event);
  playSfx(ctx, choreography.sfx, 'on-start');

  switch (choreography.structural.kind) {
    case 'card-move': {
      const id = choreography.structural.cardId as string;
      const el = ctx.cardRefs.get(id);
      const oldRect = el && el.isConnected ? el.getBoundingClientRect() : null;

      playSfx(ctx, choreography.sfx, 'on-dispatch');
      ctx.dispatch(event);
      playVfx(ctx, choreography);
      playSfx(ctx, choreography.sfx, 'after-dispatch');

      if (oldRect) {
        const rects = new Map<string, DOMRect>([[id, oldRect]]);
        playLayoutSlide(rects, ctx.cardRefs, { duration: choreography.structural.durationMs });
        await new Promise<void>((r) => setTimeout(r, choreography.structural.durationMs));
      }
      playSfx(ctx, choreography.sfx, 'on-complete');
      return;
    }

    case 'card-enter-hand':
      await animateCardEnterHand(ctx, event, choreography);
      return;

    case 'dispatch-only':
    case 'card-flip':
    case 'location-reveal':
      playSfx(ctx, choreography.sfx, 'on-dispatch');
      ctx.dispatch(event);
      playVfx(ctx, choreography);
      playSfx(ctx, choreography.sfx, 'after-dispatch');
      playSfx(ctx, choreography.sfx, 'on-complete');
      return;
  }
}
