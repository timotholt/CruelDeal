import { afterEach, describe, expect, it } from 'vitest';
import { compileStoryboard } from '../storyboard/compiler';
import { prepareCardLayoutContribution } from './cardLayoutStoryboard';

afterEach(() => document.body.replaceChildren());

describe('compiled card layout contribution', () => {
  it('authors pure FLIP geometry without mutating or transitioning the DOM', () => {
    const card = document.createElement('div');
    document.body.append(card);
    card.getBoundingClientRect = () => new DOMRect(70, 90, 60, 80);
    const contribution = prepareCardLayoutContribution(
      'layout-proof',
      new Map([['card-a', new DOMRect(10, 20, 60, 80)]]),
      () => card,
    );
    expect(contribution).not.toBeNull();
    expect(card.style.translate).toBe('');
    expect(card.style.transition).toBe('');

    const timeline = compileStoryboard({
      id: 'layout-proof',
      source: { kind: 'FOUNDATION_PROOF', proofId: 'layout-proof' },
      steps: [contribution!.step],
    }, {
      maximumPrimitiveSteps: 1,
      maximumVisualTracks: 1,
      maximumTimedCues: 0,
      maximumAuthoredRoutineDepth: 16,
      maximumCardActors: 0,
      maximumEffectActors: 0,
    });
    const track = timeline.tracks.find(candidate => candidate.property === 'translate');
    expect(track?.keyframes.map(frame => frame.value)).toEqual(['-60px -70px', '0px 0px']);
    expect(track?.keyframes.map(frame => frame.offset)).toEqual([0, 1]);
    expect(track?.keyframes.map(frame => frame.easing)).toEqual([
      'cubic-bezier(.4,0,.2,1)',
      undefined,
    ]);
  });

  it('emits no timeline when every survivor is already at its final geometry', () => {
    const card = document.createElement('div');
    document.body.append(card);
    card.getBoundingClientRect = () => new DOMRect(10, 20, 60, 80);
    expect(prepareCardLayoutContribution(
      'layout-proof',
      new Map([['card-a', new DOMRect(10, 20, 60, 80)]]),
      () => card,
    )).toBeNull();
  });
});
