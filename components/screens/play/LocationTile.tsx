/**
 * LocationTile — one of the three strips in the locations row.
 *
 * Renders face-down ("???") until the reveal cinematic flips it. Clicking
 * any state opens the zoom inspector.
 */

import type { ResolvedLocation } from '@/services/playgame/view';
import { openInspect } from './inspector';

interface LocationTileProps {
  location: ResolvedLocation;
  laneIdx: number;
  playerPower: number;
  enemyPower: number;
}

export const LocationTile = (props: LocationTileProps) => {
  const onClick = (e: MouseEvent): void => {
    e.stopPropagation();
    openInspect({
      kind: 'location',
      location: props.location,
      laneIdx: props.laneIdx,
      playerPower: props.playerPower,
      enemyPower: props.enemyPower,
      element: e.currentTarget as HTMLElement,
    });
  };
  return (
    <div
      class={'location' + (props.location.revealed ? '' : ' location--hidden')}
      data-lane={props.laneIdx}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div class="lane-score enemy-score">{props.enemyPower}</div>
      <div class="loc-name">{props.location.revealed ? props.location.name : '???'}</div>
      <div class="loc-desc">{props.location.revealed ? props.location.desc : ''}</div>
      <div class="lane-score player-score">{props.playerPower}</div>
    </div>
  );
};
