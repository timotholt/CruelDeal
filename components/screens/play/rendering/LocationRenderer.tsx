import { createMemo } from 'solid-js';

import type { ResolvedLocation } from '@/services/playgame/view';
import { GameTextV3 } from '@/components/ui/GameTextV3';
import { resolveLocationRenderPlan } from './renderCache';

interface LocationRendererProps {
  readonly location: ResolvedLocation;
  readonly bottomPower: number;
  readonly topPower: number;
}

/** One fixed 700x525 location visual, scaled unchanged by every host. */
export const LocationRenderer = (props: LocationRendererProps) => {
  const model = createMemo(() => resolveLocationRenderPlan(props.location));

  return (
    <svg
      class="location-renderer"
      viewBox="0 0 700 525"
      preserveAspectRatio="none"
      overflow="visible"
      data-location-render-key={model().key}
    >
      <foreignObject x="0" y="0" width="700" height="525" overflow="visible">
        <div
          class={'location-renderer__canvas' + (model().revealed ? '' : ' location-renderer__canvas--hidden')}
          style={{ '--location-art': model().mapArt ? `url("${model().mapArt}")` : model().art }}
        >
          <div class="lane-score enemy-score">{props.topPower}</div>
          <div class="location-renderer__text">
            <GameTextV3
              text={model().name}
              class="loc-name"
              baseFontSize="70px"
              fitMode="paragraph"
              maxLines={2}
              minScale={0.5}
              maxScale={1.2}
              verticalAlign="bottom"
              textStyle={{
                fontFamily: '"Unica One", sans-serif',
                fontWeight: 400,
                fontStyle: 'normal',
                letterSpacing: '0.1em',
                lineHeight: 1,
                textTransform: 'uppercase',
              }}
            />
            <GameTextV3
              text={model().description}
              class="loc-desc"
              baseFontSize="42px"
              fitMode="paragraph"
              maxLines={4}
              minScale={0.5}
              maxScale={1.35}
              verticalAlign="top"
              textStyle={{
                fontFamily: '"IBM Plex Sans Condensed", sans-serif',
                fontWeight: 600,
                fontStyle: 'normal',
                letterSpacing: '0',
                lineHeight: 1.3,
                textTransform: 'none',
              }}
            />
          </div>
          <div class="lane-score player-score">{props.bottomPower}</div>
        </div>
      </foreignObject>
    </svg>
  );
};
