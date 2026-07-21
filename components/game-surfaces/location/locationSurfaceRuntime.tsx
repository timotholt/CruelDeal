import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import type {
  LocationHitResult,
  LocationSurfaceModel,
  LocationVfxCue,
  SurfaceEffectLease,
  SurfaceInstance,
  SurfacePoint,
} from '../contracts';
import { LocationSurface } from './LocationSurface';
import { mountBoundedSurfaceEffect } from '../system/boundedSurfaceEffect';

export const hitTestLocationSurface = (
  model: LocationSurfaceModel,
  point: SurfacePoint,
): LocationHitResult | null => {
  if (point.x < 0 || point.y < 0 || point.x > 700 || point.y > 525) return null;
  const status = model.statuses.at(0);
  if (status && point.x >= 560 && point.y <= 120) {
    return { part: 'status', statusKey: status.key };
  }
  return { part: 'content' };
};

export interface MountedLocationSurface extends SurfaceInstance<
  LocationSurfaceModel,
  LocationVfxCue,
  LocationHitResult
> {}

export const mountLocationSurface = (
  host: HTMLElement,
  initialModel: LocationSurfaceModel,
): MountedLocationSurface => {
  const [model, setModel] = createSignal(initialModel);
  const disposeRender = render(() => <LocationSurface model={model()} />, host);
  const effectLeases = new Set<SurfaceEffectLease>();
  let disposed = false;
  let currentModel = initialModel;
  return {
    update: next => {
      currentModel = next;
      setModel(() => next);
    },
    hitTest: point => hitTestLocationSurface(currentModel, point),
    playVfx: (cue): SurfaceEffectLease => {
      let lease!: SurfaceEffectLease;
      lease = mountBoundedSurfaceEffect(host, cue, () => effectLeases.delete(lease));
      effectLeases.add(lease);
      return lease;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const effect of effectLeases) effect.cancel();
      effectLeases.clear();
      disposeRender();
    },
  };
};
