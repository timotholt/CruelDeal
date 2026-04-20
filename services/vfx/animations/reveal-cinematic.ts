/**
 * Marvel-Snap-style cinematic reveal for a single pending card.
 *
 * Phases (~1.1s total):
 *   Phase 1 (350ms): face-down slot card is hidden; a face-up clone expands
 *                    from a thin sliver at the slot position out to the
 *                    center of the board at ~2.2x scale (reads as a flip + zoom).
 *   Phase 2 (350ms): hold at center so the player can read the card.
 *   Phase 3 (320ms): clone shrinks back to the slot position.
 *   Finalize:        strip `.facedown` / `.pending` from the real slot card,
 *                    un-hide it, discard the clone.
 *
 * Gotchas (kept for port fidelity):
 *  - Start and target transforms use the SAME `translate(...) scale(X, Y)`
 *    function list, otherwise CSS falls back to matrix interpolation and
 *    the grow reads as a pop to the target.
 *  - After appending the wrapper we force a reflow (`void wrapper.offsetWidth`)
 *    before setting the transition + target transform; `requestAnimationFrame`
 *    alone is not sufficient because it fires before paint.
 *  - The clone is wrapped in a `.lane-slots` element so `.lane-slots .card ...`
 *    CSS rules (size, fonts, tilt) apply exactly as they do in the slot.
 *
 * Ported from ccg/vfx-engine/project/ui/animations/reveal-cinematic.js.
 */

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RevealCinematicOpts {
  cardId: string;
  cardElMap: Map<string, HTMLElement>;
  boardWrap: HTMLElement;
  sfx?: (name: string) => void;
}

export async function revealCardCinematic(opts: RevealCinematicOpts): Promise<void> {
  const { cardId, cardElMap, boardWrap, sfx } = opts;
  const el = cardElMap.get(cardId);
  if (!el) return;

  const boardRect = boardWrap.getBoundingClientRect();
  const slotRect = el.getBoundingClientRect();

  // Board-relative start and center positions.
  const startLeft = slotRect.left - boardRect.left;
  const startTop = slotRect.top - boardRect.top;
  const slotCenterX = startLeft + slotRect.width / 2;
  const slotCenterY = startTop + slotRect.height / 2;
  const boardCenterX = boardRect.width / 2;
  const boardCenterY = boardRect.height / 2;
  const dx = boardCenterX - slotCenterX;
  const dy = boardCenterY - slotCenterY;

  // Build the flyer: face-up clone wrapped in .lane-slots so lane-scoped
  // CSS (size, fonts) applies exactly as it does in the slot.
  const wrapper = document.createElement('div');
  wrapper.className = 'lane-slots reveal-flyer';
  wrapper.style.cssText = [
    'position: absolute',
    `left: ${startLeft}px`,
    `top: ${startTop}px`,
    `width: ${slotRect.width}px`,
    `height: ${slotRect.height}px`,
    'transform-origin: center center',
    'pointer-events: none',
    'z-index: 200',
    // Thin vertical sliver. Same function list as Phase 1 target.
    'transform: translate(0px, 0px) scale(0.02, 1)',
  ].join(';');

  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.remove('facedown', 'pending');
  clone.style.visibility = '';
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.querySelectorAll<HTMLElement>('.name, .type, .cost, .power, .bar').forEach((n) => {
    n.style.visibility = '';
  });
  wrapper.appendChild(clone);
  boardWrap.appendChild(wrapper);

  // Hide the real slot card for the duration of the reveal.
  el.style.visibility = 'hidden';

  sfx?.('reveal');

  // Force a reflow so the wrapper's INITIAL transform commits before we
  // apply the transition + target transform. `rAF` alone fires BEFORE paint
  // and is not sufficient.
  void wrapper.offsetWidth;

  // Phase 1 — grow + move to center.
  wrapper.style.transition = 'transform 350ms cubic-bezier(.2,.8,.3,1)';
  wrapper.style.transform = `translate(${dx}px, ${dy}px) scale(2.2, 2.2)`;
  await wait(380);

  // Phase 2 — hold so the player can read the card.
  await wait(350);

  // Phase 3 — shrink back to slot. Same function list.
  wrapper.style.transition = 'transform 320ms cubic-bezier(.4,0,.2,1)';
  wrapper.style.transform = 'translate(0px, 0px) scale(1, 1)';
  await wait(340);

  // Finalize — reveal the real slot card (now face-up), discard the clone.
  el.classList.remove('facedown', 'pending');
  el.querySelectorAll<HTMLElement>('.name, .type, .cost, .power, .bar').forEach((n) => {
    n.style.visibility = '';
  });
  el.style.visibility = '';
  wrapper.remove();
}

export interface RevealPendingCinematicOpts {
  pendingIds: string[];
  cardElMap: Map<string, HTMLElement>;
  boardWrap: HTMLElement;
  sfx?: (name: string) => void;
  /** Invoked after each card finishes so callers can clear state. */
  onRevealed?: (id: string) => void;
}

export async function revealPendingCinematic(opts: RevealPendingCinematicOpts): Promise<void> {
  const { pendingIds, cardElMap, boardWrap, sfx, onRevealed } = opts;
  if (!pendingIds.length) return;
  for (const id of pendingIds) {
    await revealCardCinematic({ cardId: id, cardElMap, boardWrap, sfx });
    onRevealed?.(id);
  }
}
