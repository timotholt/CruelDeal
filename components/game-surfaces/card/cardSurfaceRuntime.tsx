import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import type {
  CardHitResult,
  CardSurfaceModel,
  CardVfxCue,
  SurfaceEffectLease,
  SurfaceInstance,
  SurfacePoint,
} from '../contracts';
import { CardSurface } from './CardSurface';
import { mountBoundedSurfaceEffect } from '../system/boundedSurfaceEffect';

export const hitTestCardSurface = (
  model: CardSurfaceModel,
  point: SurfacePoint,
): CardHitResult | null => {
  if (point.x < -60 || point.y < -60 || point.x > 560 || point.y > 700) return null;
  if (model.face.kind !== 'front') return { part: 'content' };
  if (model.cost && point.x <= 130 && point.y <= 135) return { part: 'cost' };
  if (model.power && point.x >= 350 && point.y <= 135) return { part: 'power' };
  const disabled = model.statuses.find(status => status.kind === 'disabled');
  if (disabled && point.y >= 520 && point.y <= 610) {
    return { part: 'status', statusKey: disabled.key };
  }
  return { part: 'content' };
};

export interface MountedCardSurface extends SurfaceInstance<
  CardSurfaceModel,
  CardVfxCue,
  CardHitResult
> {
  readonly element: HTMLElement;
}

export const mountCardSurface = (
  host: HTMLElement,
  initialModel: CardSurfaceModel,
): MountedCardSurface => {
  const [model, setModel] = createSignal(initialModel);
  const disposeRender = render(() => <CardSurface model={model()} />, host);
  const effectLeases = new Set<SurfaceEffectLease>();
  let disposed = false;
  let currentModel = initialModel;
  const playVfx = (cue: CardVfxCue): SurfaceEffectLease => {
    let lease!: SurfaceEffectLease;
    lease = mountBoundedSurfaceEffect(host, cue, () => effectLeases.delete(lease));
    effectLeases.add(lease);
    return lease;
  };
  return {
    element: host,
    update: next => {
      currentModel = next;
      setModel(() => next);
    },
    playVfx,
    hitTest: point => hitTestCardSurface(currentModel, point),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const effect of effectLeases) effect.cancel();
      effectLeases.clear();
      disposeRender();
    },
  };
};

export const identityFreeCardBackModel = (): CardSurfaceModel => Object.freeze({
  kind: 'card' as const,
  face: Object.freeze({ kind: 'back' as const, backStyle: 'default' as const }),
  chrome: Object.freeze({
    borderStyle: 'standard' as const,
    borderTone: 'neutral' as const,
    backStyle: 'default' as const,
    chromeRevision: 'card-chrome-v1',
  }),
  cost: null,
  power: null,
  statuses: Object.freeze([]),
});
