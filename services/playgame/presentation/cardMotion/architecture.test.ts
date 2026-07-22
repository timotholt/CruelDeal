import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

describe('Phase 1.22 governed card-motion architecture fences', () => {
  it('keeps semantic transfer normalization upstream of the shared execution layer', () => {
    const animator = source('../eventAnimator.ts');
    expect(animator).toContain('deriveCardTransfers(frame.before, frame.event, frame.after)');
    expect(animator).toContain('motionSurface.cardMotion.begin');
  });

  it('mounts governed surface instances and centralizes canonical visibility ownership', () => {
    const animator = source('../eventAnimator.ts');
    const drag = source('../../../../components/screens/play/useCardInteraction.ts');
    const reveal = source('../cardRevealAnimation.ts');
    for (const livePath of [animator, drag, reveal]) {
      expect(livePath).not.toContain('cloneNode(');
      expect(livePath).not.toContain('.style.visibility');
      expect(livePath).not.toContain('mountTemporary(');
    }
    const surrogate = source('./createCardSurrogate.ts');
    const actorPool = source('./cardMotionActorPool.ts');
    expect(surrogate).not.toContain('cloneNode(');
    expect(actorPool).toContain('mountCardSurface(visual, identityFreeCardBackModel())');
    expect(actorPool).toContain('actors.find(candidate => !candidate.active)');
    expect(actorPool).not.toContain('cloneNode(');
    expect(surrogate).toContain('readCardSurfaceModel');
    expect(source('./canonicalVisibility.ts')).toContain("element.style.visibility = 'hidden'");
  });

  it('uses the pointer session surrogate through accepted landing', () => {
    const drag = source('../../../../components/screens/play/useCardInteraction.ts');
    expect(drag).toContain('motionSession.surrogate');
    expect(drag).toContain('session.animateTo(endpoint');
    expect(drag).toContain('session.handoffTo(endpoint)');
    expect(drag).not.toContain('cleanupGhost');
  });

  it('does not apply a second canonical pop after structural transfer', () => {
    const animator = source('../eventAnimator.ts');
    expect(animator).not.toContain("tl.add(destination.el, 'vfx-pop'");
    expect(animator).not.toContain("'scale-start': '0.88'");
  });

  it('keeps reveal facing renderer-owned at handoff', () => {
    const reveal = source('../cardRevealAnimation.ts');
    expect(reveal).toContain("face: 'faceDown'");
    expect(reveal).toContain('model: revealedModel');
    expect(reveal).toContain('session.handoffTo(endpoint)');
    expect(reveal).not.toContain("classList.remove('facedown'");
  });

  it('keeps the presentation sink as an awaited dispatcher, not an animation implementation', () => {
    const sink = source('../playPresentationSink.ts');
    expect(sink).toContain('await animateCardReveal(');
    expect(sink).toContain('prepareLocationRevealAnimation(host, browser, frame)');
    expect(sink).toContain('await resources.location.present(signal)');
    expect(sink).toContain('await resources.turnBanner.present(signal)');
    expect(sink).not.toContain('cardMotion.begin(');
    expect(sink).not.toContain("style.transform = 'rotateY(");
  });

  it('has no local-stage iterator special case and cancels invalidated sessions', () => {
    const animator = source('../eventAnimator.ts');
    const director = source('../presentationDirector.ts');
    expect(animator).not.toContain('local-stage-adoption');
    expect(animator).toContain("disposePreparedState(state, 'presentation-invalidated')");
    expect(director).toContain("run.controller.abort('presentation-failed')");
    expect(director).toContain('PresentationTimeoutError');
  });

  it('removes obsolete standalone flyer APIs from the live tree', () => {
    const vfxIndex = source('../../../../services/vfx/index.ts');
    expect(vfxIndex).not.toContain('flyFaceDownToSlot');
    expect(existsSync(new URL('../../../../services/vfx/animations/fly-face-down.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../../../services/vfx/animations/slide-from-deck.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../../../services/vfx/animations/reveal-cinematic.ts', import.meta.url))).toBe(false);
  });

  it('marks every structural surrogate with session diagnostics', () => {
    const actorPool = source('./cardMotionActorPool.ts');
    expect(actorPool).toContain('actor.root.dataset.cardMotionSession');
    expect(actorPool).toContain('actor.root.dataset.motionPhase');
    expect(actorPool).toContain('host.mountTemporary(root)');
  });

  it('acquires authored hidden-zone sources before committed state adoption', () => {
    const animator = source('../eventAnimator.ts');
    expect(animator).toContain("transfer.from.kind !== 'GENERATED'");
    expect(animator).toContain("basis: { kind: 'synthetic-back' }");
    expect(animator).toContain('startRect: source.rect');
  });
});
