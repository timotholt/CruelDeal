/**
 * useLaneHighlight — lane highlight / outline module.
 *
 * Modes are pluggable; add new ones here without touching PlayBoard or CSS
 * outside this file's companion section in playgame.css.
 *
 * How it works:
 *   - Sets data-hovered-lane="<i>"  on the board for hover mode.
 *   - Sets data-lane-hl-<i>="winning|losing|tied" for score-lead mode.
 *   - CSS in playgame.css targets #board[data-…] [data-lane="<i>"].
 *
 * Adding a new mode:
 *   1. Add its name to LaneHighlightMode.
 *   2. Add a createEffect block below that sets/clears board attributes.
 *   3. Add matching CSS selectors.
 */

import { createEffect, onCleanup } from 'solid-js';

export type LaneHighlightMode =
  | 'hover'       // outline + bg tint on pointer-over
  | 'score-lead'  // green = local winning, red = local losing, dim = tied
  | 'none';

export interface LaneScore {
  local: number;
  remote: number;
}

interface UseLaneHighlightOptions {
  boardEl: () => HTMLElement | undefined;
  mode: () => LaneHighlightMode;
  /** Required when mode === 'score-lead'. */
  scores?: () => [LaneScore, LaneScore, LaneScore];
}

// ─── Attribute names ────────────────────────────────────────────────────────

const HOVERED_ATTR = 'data-hovered-lane';
const laneHlAttr = (i: number) => `data-lane-hl-${i}` as const;
const SCORE_ATTRS = [laneHlAttr(0), laneHlAttr(1), laneHlAttr(2)] as const;

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLaneHighlight(opts: UseLaneHighlightOptions): void {
  // ── Hover mode ──────────────────────────────────────────────────────────
  createEffect(() => {
    const el = opts.boardEl();
    if (!el || opts.mode() !== 'hover') return;

    const onOver = (e: MouseEvent): void => {
      const target = e.target as Element | null;
      const laneEl = target?.closest('.lane-slots') as HTMLElement | null;
      if (!laneEl || target?.closest('.card')) {
        el.removeAttribute(HOVERED_ATTR);
        return;
      }
      const lane = laneEl?.getAttribute('data-lane') ?? null;
      if (lane !== null) {
        el.setAttribute(HOVERED_ATTR, lane);
      } else {
        el.removeAttribute(HOVERED_ATTR);
      }
    };

    const onLeave = (): void => {
      el.removeAttribute(HOVERED_ATTR);
    };

    el.addEventListener('mouseover', onOver);
    el.addEventListener('mouseleave', onLeave);

    onCleanup(() => {
      el.removeEventListener('mouseover', onOver);
      el.removeEventListener('mouseleave', onLeave);
      el.removeAttribute(HOVERED_ATTR);
    });
  });

  // ── Score-lead mode ─────────────────────────────────────────────────────
  createEffect(() => {
    const el = opts.boardEl();
    if (!el || opts.mode() !== 'score-lead') {
      if (el) SCORE_ATTRS.forEach((a) => el.removeAttribute(a));
      return;
    }

    const scores = opts.scores?.() ?? [
      { local: 0, remote: 0 },
      { local: 0, remote: 0 },
      { local: 0, remote: 0 },
    ];

    scores.forEach((s, i) => {
      const status =
        s.local > s.remote ? 'winning'
        : s.local < s.remote ? 'losing'
        : 'tied';
      el.setAttribute(laneHlAttr(i), status);
    });

    onCleanup(() => {
      SCORE_ATTRS.forEach((a) => el.removeAttribute(a));
    });
  });
}
