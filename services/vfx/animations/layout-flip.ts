/**
 * Layout-slide helper — the "FLIP" animation technique.
 *
 * When a keyed list changes (draw / play a card, hand reflows), surviving
 * items can snap to their new positions. This helper makes the reflow
 * smooth:
 *
 *   1. CAPTURE  — before the mutation, record each survivor's bounding rect.
 *   2. MUTATE   — caller does the state change (Solid re-renders automatically).
 *   3. SLIDE    — after the next paint, for each survivor:
 *                   - compute delta (oldRect - newRect)
 *                   - apply `translate: -delta` instantly (appears in old spot)
 *                   - transition `translate` back to 0 (slides into new spot)
 *
 * Uses the CSS `translate` property (NOT `transform: translate()`), so it
 * composes cleanly with existing `transform: scale()` / tilt rules.
 *
 * Ported from ccg/vfx-engine/project/ui/layout-flip.js.
 *
 * Solid usage pattern:
 *   const rects = captureHandRects(currentIds, cardRefs);
 *   setState(/* mutation * /);
 *   // After next microtask (so Solid has rendered):
 *   queueMicrotask(() => playLayoutSlide(rects, cardRefs));
 */

/** Capture the current bounding rect for each id that still has a live ref. */
export function captureHandRects(
  ids: readonly string[],
  cardElMap: Map<string, HTMLElement>,
): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const id of ids) {
    const el = cardElMap.get(id);
    if (el && el.isConnected) rects.set(id, el.getBoundingClientRect());
  }
  return rects;
}

export interface LayoutSlideOpts {
  duration?: number;
  easing?: string;
}

/**
 * For each captured rect whose id still has a live element, animate the
 * element from its old position to its new one.
 */
export function playLayoutSlide(
  oldRects: Map<string, DOMRect>,
  cardElMap: Map<string, HTMLElement>,
  opts: LayoutSlideOpts = {},
): void {
  const duration = opts.duration ?? 280;
  const easing = opts.easing ?? 'cubic-bezier(.4,0,.2,1)';

  for (const [id, oldRect] of oldRects) {
    const newEl = cardElMap.get(id);
    if (!newEl || !newEl.isConnected) continue;
    const newRect = newEl.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

    // Instantly apply inverse offset (puts element in old position),
    // then transition it away to slide to new position.
    newEl.style.transition = 'none';
    newEl.style.translate = `${dx}px ${dy}px`;
    void newEl.offsetWidth; // force commit
    newEl.style.transition = `translate ${duration}ms ${easing}`;
    newEl.style.translate = '0px 0px';

    const cleanup = () => {
      if (newEl.style.transition && newEl.style.transition.includes('translate')) {
        newEl.style.transition = '';
      }
      newEl.style.translate = '';
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'translate') {
        newEl.removeEventListener('transitionend', onEnd);
        cleanup();
      }
    };
    newEl.addEventListener('transitionend', onEnd);
    setTimeout(() => {
      newEl.removeEventListener('transitionend', onEnd);
      cleanup();
    }, duration + 100);
  }
}
