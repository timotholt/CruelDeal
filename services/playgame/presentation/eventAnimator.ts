import type { MatchEvent } from '../engine/types/events';
import type { PlayScriptCtx } from '../script/actions';
import { playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { Timeline } from '@/services/vfx/timeline';
import { describeEventChoreography, type EventChoreography, type SfxCue, type VfxCue } from './choreography';

const playSfx = (ctx: PlayScriptCtx, cues: readonly SfxCue[], timing: SfxCue['timing']): void => {
  if (!ctx.sfx) return;
  for (const cue of cues) {
    if (cue.timing === timing) ctx.sfx(cue.name);
  }
};

const playVfxCue = (ctx: PlayScriptCtx, cue: VfxCue): void => {
  switch (cue.kind) {
    case 'power-flash': {
      const el = ctx.cardRefs.get(cue.cardId);
      if (!el) return;
      const tl = new Timeline();
      tl.add(el, 'vfx-flash', { color: cue.delta > 0 ? '#6dff9d' : '#ff5d8f' }, 260, 0);
      tl.play();
      return;
    }

    case 'destroy-burst': {
      const el = ctx.cardRefs.get(cue.cardId);
      if (!el) return;
      const tl = new Timeline();
      tl.compound(el, ['vfx-flash', 'vfx-shake'], { color: '#ff5d8f' }, 260);
      tl.play();
      return;
    }

    case 'glitch-flash': {
      const el = ctx.cardRefs.get(cue.cardId);
      if (!el) return;
      const tl = new Timeline();
      tl.compound(el, ['vfx-flash', 'vfx-shake'], { color: '#70e1f5' }, 240);
      tl.play();
      return;
    }

    case 'none':
      return;
  }
};

const playVfx = (ctx: PlayScriptCtx, choreography: EventChoreography): void => {
  for (const cue of choreography.vfx) playVfxCue(ctx, cue);
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

    case 'dispatch-only':
    case 'card-flip':
    case 'card-draw':
    case 'location-reveal':
      playSfx(ctx, choreography.sfx, 'on-dispatch');
      ctx.dispatch(event);
      playVfx(ctx, choreography);
      playSfx(ctx, choreography.sfx, 'after-dispatch');
      playSfx(ctx, choreography.sfx, 'on-complete');
      return;
  }
}

