import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import { useLaneHighlight } from './useLaneHighlight';

afterEach(() => document.body.replaceChildren());

describe('lane hover ownership', () => {
  it('only highlights the local lower play area', () => {
    const board = document.createElement('div');
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    top.className = 'lane-slots top';
    top.dataset.lane = '0';
    top.dataset.side = 'top';
    bottom.className = 'lane-slots bot';
    bottom.dataset.lane = '0';
    bottom.dataset.side = 'bottom';
    board.append(top, bottom);
    document.body.append(board);

    let dispose = () => undefined;
    createRoot((rootDispose) => {
      dispose = rootDispose;
      useLaneHighlight({ boardEl: () => board, mode: () => 'hover' });
    });

    top.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(board.hasAttribute('data-hovered-lane')).toBe(false);

    bottom.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(board.getAttribute('data-hovered-lane')).toBe('0');

    top.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(board.hasAttribute('data-hovered-lane')).toBe(false);
    dispose();
  });
});
