import { createMemo, Match, onCleanup, Switch } from 'solid-js';
import type { CardSurfaceModel } from '../contracts';
import { CardBackSurface } from '../system/CardBackSurface';
import { StaticBitmapLayer } from '../system/StaticBitmapLayer';
import { StatLayer } from '../system/StatLayer';
import { StatusLayer } from '../system/StatusLayer';
import { SystemBorderLayer } from '../system/SystemBorderLayer';
import { cardBitmapCache } from './cardBitmapCache';
import { registerCardSurfaceModel } from './cardSurfaceRegistry';

interface CardSurfaceProps {
  readonly model: CardSurfaceModel;
}

const CardContentFallback = (props: { model: CardSurfaceModel }) => {
  const content = () => props.model.face.kind === 'front' ? props.model.face.content : null;
  return (
    <div class={`card-content-fallback card-content-fallback--${content()?.layout ?? 'regular'}`}>
      <div class="card-content-fallback__accent" style={{ background: content()?.accent }} />
      <div class="card-content-fallback__name">{content()?.name}</div>
    </div>
  );
};

export const CardSurface = (props: CardSurfaceProps) => {
  const model = createMemo(() => props.model);
  const content = () => {
    const face = model().face;
    return face.kind === 'front' ? face.content : null;
  };
  return (
    <svg
      ref={(element) => {
        const unregister = registerCardSurfaceModel(element, model);
        onCleanup(unregister);
      }}
      class="card-renderer card-surface"
      viewBox="0 0 500 700"
      preserveAspectRatio="none"
      overflow="visible"
      data-surface-kind="card"
      data-surface-face={model().face.kind}
      data-card-render-key={content()?.cacheKey ?? `back:card:${model().chrome.backStyle}:${model().chrome.chromeRevision}`}
    >
      <foreignObject x="0" y="0" width="500" height="700" overflow="visible">
        <div class="card-renderer__canvas card-surface__canvas" data-card-type={content()?.layout ?? ''}>
          <Switch>
            <Match when={model().face.kind === 'back'}>
              <CardBackSurface />
            </Match>
            <Match when={content()} keyed>
              {(value) => (
                <StaticBitmapLayer
                  cacheKey={value.cacheKey}
                  load={() => cardBitmapCache.get(value)}
                  peek={() => cardBitmapCache.peek(value.cacheKey)}
                  class="card-content-bitmap"
                  fallback={<CardContentFallback model={model()} />}
                />
              )}
            </Match>
          </Switch>
          <SystemBorderLayer
            surface="card"
            tone={model().chrome.borderTone}
            layout={content()?.layout}
          />
          <StatLayer cost={model().cost} power={model().power} />
          <StatusLayer statuses={model().statuses} />
        </div>
      </foreignObject>
    </svg>
  );
};
