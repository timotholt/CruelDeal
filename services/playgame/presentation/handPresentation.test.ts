import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareHandLayoutTransition } from './handPresentation';
import { createPlayMotionSurface } from './playMotionSurface';
import { AutoAdvancingFakeWaapiDriver } from './storyboard/testing';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

const fixture = () => {
  const frame = document.createElement('div');
  const overlay = document.createElement('div');
  const card = document.createElement('div');
  card.dataset.playMotionCard = 'a';
  let adopted = false;
  card.getBoundingClientRect = () => (
    adopted ? new DOMRect(80, 600, 70, 100) : new DOMRect(20, 600, 70, 100)
  );
  frame.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
  frame.append(card, overlay);
  document.body.append(frame);
  const driver = new AutoAdvancingFakeWaapiDriver();
  const cardRefs = new Map<string, HTMLElement>([['a', card]]);
  const motionSurface = createPlayMotionSurface({
    frame,
    overlay,
    cardRefs,
    timelineDriverFactory: () => driver,
  });
  return { cardRefs, driver, motionSurface, adopt: () => { adopted = true; } };
};

describe('hand presentation choreography', () => {
  it('captures before mutation and compiles the post-render FLIP onto one clock', async () => {
    vi.useFakeTimers();
    const { cardRefs, driver, motionSurface, adopt } = fixture();
    const transition = prepareHandLayoutTransition(['a'], cardRefs, motionSurface);
    adopt();

    const presentation = transition.playAfterRender();
    await vi.runAllTimersAsync();
    await presentation;

    const translate = driver.compiledTracks.find(track => track.property === 'translate');
    expect(translate?.keyframes.map(frame => frame.value)).toEqual(['-60px 0px', '0px 0px']);
    expect(driver.clocks).toHaveLength(1);
  });

  it('cannot accidentally replay one prepared transition twice', async () => {
    vi.useFakeTimers();
    const { cardRefs, driver, motionSurface, adopt } = fixture();
    const transition = prepareHandLayoutTransition(['a'], cardRefs, motionSurface);
    adopt();

    const first = transition.playAfterRender();
    const second = transition.playAfterRender();
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);

    expect(driver.clocks).toHaveLength(1);
  });
});
