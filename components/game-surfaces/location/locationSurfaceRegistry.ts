import type { LocationSurfaceModel } from '../contracts';

const mountedModels = new WeakMap<Element, () => LocationSurfaceModel>();

export const registerLocationSurfaceModel = (
  element: Element,
  readModel: () => LocationSurfaceModel,
): (() => void) => {
  mountedModels.set(element, readModel);
  return () => mountedModels.delete(element);
};

export const readLocationSurfaceModel = (host: Element): LocationSurfaceModel | null => {
  const surface = host.matches('[data-surface-kind="location"]')
    ? host
    : host.querySelector('[data-surface-kind="location"]');
  return surface ? mountedModels.get(surface)?.() ?? null : null;
};
