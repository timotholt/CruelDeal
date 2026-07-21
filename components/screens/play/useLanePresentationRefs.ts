import { onCleanup } from 'solid-js';

import type { LaneId } from '@/services/playgame/engine/types/ids';

export interface LanePresentationRefs {
  readonly mapElement: (lane: LaneId) => HTMLElement | null;
  readonly tileElement: (lane: LaneId) => HTMLElement | null;
  readonly bindMap: (lane: LaneId) => (element: HTMLElement) => void;
  readonly bindTile: (lane: LaneId) => (element: HTMLElement) => void;
}

export const useLanePresentationRefs = (): LanePresentationRefs => {
  const maps = new Map<LaneId, HTMLElement>();
  const tiles = new Map<LaneId, HTMLElement>();

  const bind = (
    registry: Map<LaneId, HTMLElement>,
    lane: LaneId,
  ) => (element: HTMLElement): void => {
    registry.set(lane, element);
    onCleanup(() => {
      if (registry.get(lane) === element) registry.delete(lane);
    });
  };

  return {
    mapElement: lane => maps.get(lane) ?? null,
    tileElement: lane => tiles.get(lane) ?? null,
    bindMap: lane => bind(maps, lane),
    bindTile: lane => bind(tiles, lane),
  };
};
