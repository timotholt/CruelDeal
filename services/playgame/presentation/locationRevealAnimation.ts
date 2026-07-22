import type { LaneId } from '../engine/types/ids';
import type { SeatTransactionFrame } from '../runtime/projection';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventLane } from './projectedEvent';
import { readLocationSurfaceModel } from '@/components/game-surfaces/location/locationSurfaceRegistry';
import {
  mountLocationSurface,
  type MountedLocationSurface,
} from '@/components/game-surfaces/location/locationSurfaceRuntime';

export const LOCATION_REVEAL_DURATION_MS = 700;

export interface LocationRevealBrowserPort {
  locationMap(lane: LaneId): HTMLElement | null;
  locationTile(lane: LaneId): HTMLElement | null;
}

export interface LocationRevealPreparation {
  readonly lane: LaneId;
  readonly mapElement: HTMLElement;
  readonly canonicalSurface: HTMLElement;
  readonly surrogateTile: HTMLElement;
  readonly mountedSurface: MountedLocationSurface;
  readonly unmountSurrogate: () => void;
}

const waitFor = (ms: number, signal: AbortSignal): Promise<boolean> => {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      resolve(completed);
    };
    const onAbort = (): void => finish(false);
    const timeout = setTimeout(() => finish(true), ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

export const cleanupLocationReveal = (preparation: LocationRevealPreparation): void => {
  preparation.mountedSurface?.dispose();
  preparation.unmountSurrogate?.();
  for (const tile of [preparation.canonicalSurface, preparation.surrogateTile]) {
    tile?.style.removeProperty('visibility');
    tile?.style.removeProperty('opacity');
    tile?.style.removeProperty('transition');
    tile?.style.removeProperty('transform');
    tile?.style.removeProperty('transform-origin');
    tile?.style.removeProperty('will-change');
  }
  preparation.mapElement?.style.removeProperty('opacity');
  preparation.mapElement?.style.removeProperty('transition');
};

export const prepareLocationRevealAnimation = (
  host: PlayPresentationHost,
  browser: LocationRevealBrowserPort,
  frame: SeatTransactionFrame,
): LocationRevealPreparation | null => {
  if (frame.event?.type !== 'LOCATION_REVEALED') return null;
  const lane = eventLane(frame.event);
  if (lane === null) throw new Error('LOCATION_REVEALED is missing its lane');
  const mapElement = browser.locationMap(lane);
  const hiddenTile = browser.locationTile(lane);
  if (!mapElement?.isConnected) {
    throw new Error(`LOCATION_REVEALED cannot capture map for lane ${lane}`);
  }
  if (!hiddenTile?.isConnected) {
    throw new Error(`LOCATION_REVEALED cannot capture location tile for lane ${lane}`);
  }
  const canonicalSurface = hiddenTile?.querySelector<HTMLElement>(
    '[data-surface-kind="location"]',
  ) ?? null;
  if (!canonicalSurface) {
    throw new Error(`LOCATION_REVEALED cannot capture rendered location surface for lane ${lane}`);
  }
  const hiddenModel = readLocationSurfaceModel(canonicalSurface);
  if (!hiddenModel) {
    throw new Error(`LOCATION_REVEALED cannot read location surface model for lane ${lane}`);
  }

  mapElement.style.transition = 'none';
  mapElement.style.opacity = '0';
  void mapElement.offsetWidth;
  const viewportRect = hiddenTile.getBoundingClientRect();
  const localRect = host.motionSurface.toLocalRect(viewportRect);
  const surrogateTile = document.createElement('div');
  surrogateTile.className = 'location location-motion-surrogate';
  surrogateTile.setAttribute('aria-hidden', 'true');
  surrogateTile.style.position = 'absolute';
  surrogateTile.style.left = `${localRect.left}px`;
  surrogateTile.style.top = `${localRect.top}px`;
  surrogateTile.style.width = `${localRect.width}px`;
  surrogateTile.style.height = `${localRect.height}px`;
  surrogateTile.style.margin = '0';
  surrogateTile.style.opacity = '1';
  surrogateTile.style.pointerEvents = 'none';
  surrogateTile.style.transformOrigin = '50% 50%';
  surrogateTile.style.willChange = 'transform';
  surrogateTile.style.transform = 'rotateY(0deg)';
  const mountedSurface = mountLocationSurface(surrogateTile, hiddenModel);
  const unmountSurrogate = host.motionSurface.mountTemporary(surrogateTile);
  canonicalSurface.style.visibility = 'hidden';

  return {
    lane,
    mapElement,
    canonicalSurface,
    surrogateTile,
    mountedSurface,
    unmountSurrogate,
  };
};

export const animateLocationReveal = async (
  browser: LocationRevealBrowserPort,
  preparation: LocationRevealPreparation,
  signal: AbortSignal,
): Promise<void> => {
  const halfDuration = LOCATION_REVEAL_DURATION_MS / 2;
  const surrogateTile = preparation.surrogateTile;
  preparation.mapElement.style.transition =
    `opacity ${LOCATION_REVEAL_DURATION_MS}ms ease`;
  preparation.mapElement.style.opacity = '1';
  surrogateTile.style.transition =
    `transform ${halfDuration}ms cubic-bezier(.4,0,.7,1)`;
  surrogateTile.style.transform = 'rotateY(90deg)';
  if (!await waitFor(halfDuration, signal)) return;

  const revealedTile = browser.locationTile(preparation.lane);
  const revealedSurface = revealedTile?.querySelector<HTMLElement>(
    '[data-surface-kind="location"]',
  ) ?? null;
  if (!revealedSurface?.isConnected) {
    throw new Error(`LOCATION_REVEALED cannot find adopted location surface for lane ${preparation.lane}`);
  }
  const revealedModel = readLocationSurfaceModel(revealedSurface);
  if (!revealedModel || revealedModel.face.kind !== 'front') {
    throw new Error(`LOCATION_REVEALED cannot read adopted front model for lane ${preparation.lane}`);
  }
  preparation.mountedSurface.update(revealedModel);
  surrogateTile.style.transition = 'none';
  surrogateTile.style.transform = 'rotateY(-90deg)';
  void surrogateTile.offsetWidth;
  surrogateTile.style.transition = `transform ${halfDuration}ms cubic-bezier(.3,0,.2,1)`;
  surrogateTile.style.transform = 'rotateY(0deg)';
  if (!await waitFor(halfDuration, signal)) return;
  revealedSurface?.style.removeProperty('visibility');
  preparation.mountedSurface.dispose();
  preparation.unmountSurrogate();
};
