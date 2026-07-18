import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setupLaneMaps } from './useLaneMaps';

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

function boardFixture(): HTMLDivElement {
  const board = document.createElement('div');
  board.innerHTML = `
    <div class="enemy-row">
      <div data-lane="0"></div>
      <div data-lane="3"></div>
    </div>
    <div class="player-row">
      <div data-lane="0"></div>
      <div data-lane="3"></div>
    </div>
  `;
  document.body.append(board);
  return board;
}

describe('lane map overlays', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('preserves the lane node while reveal visibility changes', () => {
    const board = boardFixture();
    const maps = setupLaneMaps(board, [{
      laneId: 0,
      path: '/hidden.png',
      revealed: false,
    }]);
    const original = maps.elements[0];
    expect(original.dataset.revealed).toBe('false');

    maps.update([{
      laneId: 0,
      path: '/revealed.png',
      revealed: true,
    }]);

    expect(maps.elements[0]).toBe(original);
    expect(original.dataset.revealed).toBe('true');
    expect(original.style.backgroundImage).toContain('/revealed.png');
    maps.dispose();
  });

  it('reconciles created and destroyed lanes by stable lane ID', () => {
    const board = boardFixture();
    const maps = setupLaneMaps(board, [{
      laneId: 0,
      path: '/zero.png',
      revealed: true,
    }]);
    const removed = maps.elements[0];

    maps.update([{
      laneId: 3,
      path: '/three.png',
      revealed: false,
    }]);

    expect(removed.isConnected).toBe(false);
    expect(maps.elements.map(element => element.dataset.lane)).toEqual(['3']);
    expect(board.querySelectorAll('.lane-map')).toHaveLength(1);
    maps.dispose();
  });
});
