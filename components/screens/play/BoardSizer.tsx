/**
 * BoardSizer — sets CSS custom properties on :root to size the board.
 *
 *   --board-w / --board-h : main board footprint (driven by viewport).
 *   --message-center-y    : vertical anchor for toasts, aligned with the
 *                           centre of the locations strip.
 *
 * Pure presentation — no game state reads.
 */

import { onCleanup, onMount } from 'solid-js';

export const BoardSizer = () => {
  const applySize = (): void => {
    const w = Math.min((window.innerHeight * 9) / 16, window.innerWidth, 420);
    const h = (w * 16) / 9;
    document.documentElement.style.setProperty('--board-w', w + 'px');
    document.documentElement.style.setProperty('--board-h', h + 'px');
  };
  const applyToastY = (): void => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const locs = board?.querySelector('.locations') as HTMLElement | null;
    if (!board || !locs) return;
    const boardRect = board.getBoundingClientRect();
    const locsRect = locs.getBoundingClientRect();
    const locsCenterY = locsRect.top + locsRect.height / 2 - boardRect.top;
    const pct = (locsCenterY / boardRect.height) * 100;
    board.style.setProperty('--message-center-y', pct.toFixed(1) + '%');
  };

  onMount(() => {
    applySize();
    window.addEventListener('resize', applySize);
    // Locations render after mount; wait a frame for layout.
    requestAnimationFrame(applyToastY);
    window.addEventListener('resize', applyToastY);
    onCleanup(() => {
      window.removeEventListener('resize', applySize);
      window.removeEventListener('resize', applyToastY);
    });
  });

  return null;
};
