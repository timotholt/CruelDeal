import type { CardSurfaceModel } from '../contracts';

const mountedModels = new WeakMap<Element, () => CardSurfaceModel>();

export const registerCardSurfaceModel = (
  element: Element,
  readModel: () => CardSurfaceModel,
): (() => void) => {
  mountedModels.set(element, readModel);
  return () => mountedModels.delete(element);
};

export const readCardSurfaceModel = (host: Element): CardSurfaceModel | null => {
  const surface = host.matches('[data-surface-kind="card"]')
    ? host
    : host.querySelector('[data-surface-kind="card"]');
  return surface ? mountedModels.get(surface)?.() ?? null : null;
};
