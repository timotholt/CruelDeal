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

  it('centralizes structural cloning and canonical visibility ownership', () => {
    const animator = source('../eventAnimator.ts');
    const drag = source('../../../../components/screens/play/useDragDrop.ts');
    const reveal = source('../../../../services/vfx/animations/reveal-cinematic.ts');
    for (const livePath of [animator, drag, reveal]) {
      expect(livePath).not.toContain('cloneNode(');
      expect(livePath).not.toContain('.style.visibility');
      expect(livePath).not.toContain('mountTemporary(');
    }
    expect(source('./createCardSurrogate.ts')).toContain('cloneNode(');
    expect(source('./canonicalVisibility.ts')).toContain("element.style.visibility = 'hidden'");
  });

  it('uses the pointer session surrogate through accepted landing', () => {
    const drag = source('../../../../components/screens/play/useDragDrop.ts');
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
    const reveal = source('../../../../services/vfx/animations/reveal-cinematic.ts');
    expect(reveal).toContain('adoptCanonicalFace?.()');
    expect(reveal).toContain('session.handoffTo(endpoint)');
    expect(reveal).not.toContain("classList.remove('facedown'");
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
  });

  it('marks every structural surrogate with session diagnostics', () => {
    const factory = source('./createCardSurrogate.ts');
    expect(factory).toContain('root.dataset.cardMotionSession');
    expect(factory).toContain('root.dataset.motionPhase');
    expect(factory).toContain('host.mountTemporary(root)');
  });
});
