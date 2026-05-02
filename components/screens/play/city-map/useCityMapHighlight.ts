/**
 * useCityMapHighlight — district highlight / outline module for the SVG city map.
 *
 * Modes are pluggable; add new ones here without touching CityMapBoard or CSS
 * outside cityMapStyles.css.
 *
 * How it works:
 *   - 'hover': SVG hit-area paths in CityMapSvg call onDistrictHover(id|null),
 *              which sets hoveredDistrictId. CityMapSvg renders the hover layer.
 *   - 'score-lead': reactive computation maps district IDs to 'winning' |
 *              'losing' | 'tied'; districtStatus exposes that for CSS / callers.
 *   - 'none': no highlighting.
 *
 * Adding a new mode:
 *   1. Add its name to CityMapHighlightMode.
 *   2. Add a createEffect block or derived signal below.
 *   3. Add matching CSS/SVG class logic in the consumer component.
 */

import { createEffect, createSignal, onCleanup } from 'solid-js';

export type CityMapHighlightMode = 'hover' | 'score-lead' | 'none';

export type DistrictHighlightStatus = 'winning' | 'losing' | 'tied';

export interface DistrictScore {
  districtId: string;
  local: number;
  remote: number;
}

interface UseCityMapHighlightOptions {
  mode: () => CityMapHighlightMode;
  /** Required when mode === 'score-lead'. */
  scores?: () => DistrictScore[];
}

export interface CityMapHighlightHandle {
  /** District currently under the pointer (hover mode). */
  hoveredDistrictId: () => string | null;
  /** Call from SVG hit areas: pass district id on enter, null on leave. */
  onDistrictHover: (id: string | null) => void;
  /**
   * Status for a specific district in score-lead mode.
   * Returns undefined when mode !== 'score-lead'.
   */
  districtStatus: (id: string) => DistrictHighlightStatus | undefined;
}

export function useCityMapHighlight(
  opts: UseCityMapHighlightOptions,
): CityMapHighlightHandle {
  const [hoveredDistrictId, setHoveredDistrictId] = createSignal<string | null>(null);
  const [statusMap, setStatusMap] = createSignal<Map<string, DistrictHighlightStatus>>(new Map());

  // Clear hovered district when mode changes away from hover
  createEffect(() => {
    if (opts.mode() !== 'hover') {
      setHoveredDistrictId(null);
    }
  });

  // Score-lead: recompute status map whenever scores or mode changes
  createEffect(() => {
    if (opts.mode() !== 'score-lead') {
      setStatusMap(new Map());
      return;
    }
    const scores = opts.scores?.() ?? [];
    const next = new Map<string, DistrictHighlightStatus>();
    for (const s of scores) {
      next.set(
        s.districtId,
        s.local > s.remote ? 'winning' : s.local < s.remote ? 'losing' : 'tied',
      );
    }
    setStatusMap(next);
    onCleanup(() => setStatusMap(new Map()));
  });

  const onDistrictHover = (id: string | null): void => {
    if (opts.mode() !== 'hover') return;
    setHoveredDistrictId(id);
  };

  const districtStatus = (id: string): DistrictHighlightStatus | undefined =>
    statusMap().get(id);

  return { hoveredDistrictId, onDistrictHover, districtStatus };
}
