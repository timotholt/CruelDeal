import { describe, expect, it } from 'vitest';
import { createPlayMotionSurface } from './playMotionSurface';
import { createAutoAdvancingTestTimelineDriverFactory } from './storyboard/testing';

const timelineDriverFactory = createAutoAdvancingTestTimelineDriverFactory();

describe('PlayMotionSurface', () => {
  it('converts viewport geometry into the sole frame-relative coordinate system', () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    frame.getBoundingClientRect = () => new DOMRect(120, 40, 430, 764);

    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });

    expect(surface.toLocalRect(new DOMRect(145, 100, 70, 98))).toEqual(
      new DOMRect(25, 60, 70, 98),
    );
  });

  it('owns temporary-node mounting and idempotent cleanup', () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });
    const flyer = document.createElement('div');

    const cleanup = surface.mountTemporary(flyer);
    expect(flyer.parentElement).toBe(overlay);
    cleanup();
    cleanup();
    expect(flyer.isConnected).toBe(false);
  });

  it('resolves authored card and zone geometry from the mounted DOM contract', () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    const card = document.createElement('div');
    const hand = document.createElement('div');
    card.dataset.playMotionCard = 'card-1';
    hand.dataset.playMotionZone = 'P1:hand';
    card.getBoundingClientRect = () => new DOMRect(80, 200, 70, 100);
    hand.getBoundingClientRect = () => new DOMRect(210, 18, 21, 30);
    frame.append(card, hand, overlay);
    document.body.append(frame);

    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });

    expect(surface.cardElement('card-1')).toBe(card);
    expect(surface.cardIds()).toEqual(['card-1']);
    expect(surface.cardRect('card-1')).toEqual(new DOMRect(80, 200, 70, 100));
    expect(surface.zoneElement('P1:hand')).toBe(hand);
    expect(surface.zoneRect('P1:hand')).toEqual(new DOMRect(210, 18, 21, 30));

    card.remove();
    hand.remove();
    expect(surface.cardElement('card-1')).toBeNull();
    expect(surface.zoneElement('P1:hand')).toBeNull();
  });

  it('binds a canonical card destination when the renderer mounts it', async () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });
    const controller = new AbortController();

    const binding = surface.waitForCardElement('card-later', controller.signal);
    const card = document.createElement('div');
    card.dataset.playMotionCard = 'card-later';
    frame.append(card);

    await expect(binding).resolves.toBe(card);
  });

  it('binds an authored zone when the reactive renderer mounts it', async () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });
    const controller = new AbortController();

    const binding = surface.waitForZoneElement('P0:deck', controller.signal);
    const deck = document.createElement('div');
    deck.dataset.playMotionZone = 'P0:deck';
    frame.append(deck);

    await expect(binding).resolves.toBe(deck);
  });

  it('cancels a pending canonical card destination binding', async () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });
    const controller = new AbortController();

    const binding = surface.waitForCardElement('card-never-mounted', controller.signal);
    controller.abort();

    await expect(binding).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('cancels a pending authored-zone binding', async () => {
    const frame = document.createElement('div');
    const overlay = document.createElement('div');
    frame.append(overlay);
    document.body.append(frame);
    const surface = createPlayMotionSurface({
      frame,
      overlay,
      cardRefs: new Map(),
      timelineDriverFactory,
    });
    const controller = new AbortController();

    const binding = surface.waitForZoneElement('P0:deck', controller.signal);
    controller.abort();

    await expect(binding).rejects.toMatchObject({ name: 'AbortError' });
  });
});
