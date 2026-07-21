import { Match, onCleanup, Switch } from 'solid-js';
import type { LocationSurfaceModel } from '../contracts';
import { LocationBackSurface } from '../system/LocationBackSurface';
import { StaticBitmapLayer } from '../system/StaticBitmapLayer';
import { StatusLayer } from '../system/StatusLayer';
import { SystemBorderLayer } from '../system/SystemBorderLayer';
import { locationBitmapCache } from './locationBitmapCache';
import { registerLocationSurfaceModel } from './locationSurfaceRegistry';

interface LocationSurfaceProps {
  readonly model: LocationSurfaceModel;
}

const LocationFallback = (props: { model: LocationSurfaceModel }) => {
  const content = () => props.model.face.kind === 'front' ? props.model.face.content : null;
  return (
    <div
      class="location-content-fallback"
      style={{
        background: content()?.artwork
          ? `linear-gradient(rgba(5,8,12,.55),rgba(5,8,12,.7)), url("${content()?.artwork?.src}") center/cover`
          : content()?.accent,
      }}
    >
      <div class="location-content-fallback__name">{content()?.name}</div>
      <div class="location-content-fallback__rules">{content()?.rulesText}</div>
    </div>
  );
};

export const LocationSurface = (props: LocationSurfaceProps) => {
  const content = () => props.model.face.kind === 'front' ? props.model.face.content : null;
  return (
    <svg
      ref={(element) => {
        const unregister = registerLocationSurfaceModel(element, () => props.model);
        onCleanup(unregister);
      }}
      class="location-renderer location-surface"
      viewBox="0 0 700 525"
      preserveAspectRatio="none"
      overflow="visible"
      data-surface-kind="location"
      data-surface-face={props.model.face.kind}
      data-location-render-key={content()?.cacheKey ?? `back:location:${props.model.chrome.chromeRevision}`}
    >
      <foreignObject x="0" y="0" width="700" height="525" overflow="visible">
        <div class="location-renderer__canvas location-surface__canvas">
          <Switch>
            <Match when={props.model.face.kind === 'back'}>
              <LocationBackSurface />
            </Match>
            <Match when={content()} keyed>
              {(value) => (
                <StaticBitmapLayer
                  cacheKey={value.cacheKey}
                  load={() => locationBitmapCache.get(value)}
                  class="location-content-bitmap"
                  fallback={<LocationFallback model={props.model} />}
                />
              )}
            </Match>
          </Switch>
          <SystemBorderLayer surface="location" />
          <StatusLayer statuses={props.model.statuses} />
        </div>
      </foreignObject>
    </svg>
  );
};
