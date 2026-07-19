import { describe, expect, it } from 'vitest';

import { createPlayfieldEventPresenter } from './playfieldEvents';

describe('playfield presentation events', () => {
  it('owns the visibility class and resolves show when the opacity fade ends', async () => {
    const root = document.createElement('div');
    const playfield = document.createElement('main');
    playfield.className = 'board-game-area';
    root.append(playfield);
    const present = createPlayfieldEventPresenter(root);

    await present({ type: 'HIDE_PLAYFIELD' });
    expect(root.classList.contains('playfield-hidden')).toBe(true);

    const shown = present({ type: 'SHOW_PLAYFIELD' });
    expect(root.classList.contains('playfield-hidden')).toBe(false);

    const transitionEnd = new Event('transitionend');
    Object.defineProperty(transitionEnd, 'propertyName', { value: 'opacity' });
    playfield.dispatchEvent(transitionEnd);
    await shown;
  });
});
