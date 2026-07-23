import type { LaneId } from '../engine/types/ids';
import type { SeatTransactionFrame } from '../runtime/projection';
import { getLocation } from '../view';
import { locationSurfaceModel } from './appearance/locationAppearance';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventLane } from './projectedEvent';
import { NORMAL_ANIMATION_PROFILE } from './storyboard/animationProfile';
import { compileStoryboard } from './storyboard/compiler';
import {
  milliseconds,
  type BeatStoryboard,
  type PresentationExpansionBudget,
  type PresentationOutcome,
} from './storyboard/contracts';
import { StoryboardRunner } from './storyboard/runner';
import type { TimelineDriverFactory } from './storyboard/waapiDriver';
import type { AdoptPresentationBeat } from './presentationDirector';
import { readLocationSurfaceModel } from '@/components/game-surfaces/location/locationSurfaceRegistry';
import {
  mountLocationSurface,
  type MountedLocationSurface,
} from '@/components/game-surfaces/location/locationSurfaceRuntime';

export const LOCATION_REVEAL_DURATION_MS = 700;

const LOCATION_REVEAL_BUDGET: PresentationExpansionBudget = Object.freeze({
  maximumPrimitiveSteps: 1,
  maximumVisualTracks: 2,
  maximumTimedCues: 1,
  maximumAuthoredRoutineDepth: 16,
  maximumCardActors: 0,
  maximumEffectActors: 0,
});

export interface LocationRevealBrowserPort {
  readonly createTimelineDriver: TimelineDriverFactory;
  locationMap(lane: LaneId): HTMLElement | null;
  locationTile(lane: LaneId): HTMLElement | null;
}

export interface LocationRevealPreparation {
  readonly lane: LaneId;
  readonly declaredDurationMs: number;
  present(
    signal: AbortSignal,
    adopt: AdoptPresentationBeat,
  ): Promise<PresentationOutcome>;
  cancel(): void;
}

export function createLocationRevealStoryboard(
  frame: SeatTransactionFrame,
  lane: LaneId,
): BeatStoryboard {
  return {
    id: `${frame.transactionId}:frame:${frame.index}:location-reveal`,
    source: {
      kind: 'BEAT',
      transactionId: frame.transactionId,
      firstFrame: frame.frame,
      lastFrame: frame.frame,
    },
    steps: [{
      id: 'location-map-and-flip',
      durationMs: milliseconds(LOCATION_REVEAL_DURATION_MS),
      nextStepAfterMs: milliseconds(LOCATION_REVEAL_DURATION_MS),
      tracks: [
        {
          kind: 'ELEMENT',
          id: 'location-map-fade',
          target: { kind: 'LOCATION_MAP', lane },
          channel: 'map-opacity',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            {
              atMs: milliseconds(LOCATION_REVEAL_DURATION_MS),
              styles: { opacity: 1 },
              easing: 'ease',
            },
          ],
        },
        {
          kind: 'ELEMENT',
          id: 'location-two-sided-flip',
          target: { kind: 'LOCATION_ACTOR', lane },
          channel: 'face-turn',
          keyframes: [
            { atMs: milliseconds(0), styles: { transform: 'rotateY(0deg)' } },
            {
              atMs: milliseconds(350),
              styles: { transform: 'rotateY(90deg)' },
              easing: 'cubic-bezier(.4,0,.7,1)',
            },
            {
              atMs: milliseconds(LOCATION_REVEAL_DURATION_MS),
              styles: { transform: 'rotateY(180deg)' },
              easing: 'cubic-bezier(.3,0,.2,1)',
            },
          ],
        },
      ],
      cues: [{
        kind: 'AUDIO',
        id: 'location-reveal-audio',
        atMs: milliseconds(0),
        sound: 'reveal',
        volume: 1,
      }],
    }],
  };
}

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
  const canonicalSurface = locationSurface(hiddenTile);
  if (!canonicalSurface) {
    throw new Error(`LOCATION_REVEALED cannot capture rendered location surface for lane ${lane}`);
  }
  const hiddenModel = readLocationSurfaceModel(canonicalSurface);
  if (!hiddenModel || hiddenModel.face.kind !== 'back') {
    throw new Error(`LOCATION_REVEALED cannot read hidden location model for lane ${lane}`);
  }
  const revealedLocation = getLocation(frame.after, lane, host.content);
  const revealedModel = locationSurfaceModel(revealedLocation);
  if (revealedModel.face.kind !== 'front') {
    throw new Error(`LOCATION_REVEALED has no revealed location model for lane ${lane}`);
  }

  const actor = createTwoSidedActor(
    canonicalSurface.ownerDocument,
    host,
    hiddenTile,
    hiddenModel,
    revealedModel,
  );
  const unmountActor = host.motionSurface.mountTemporary(actor.element);
  const mapActor = createMapActor(
    canonicalSurface.ownerDocument,
    mapElement,
    revealedLocation.mapArt,
  );
  const timeline = compileStoryboard(
    createLocationRevealStoryboard(frame, lane),
    LOCATION_REVEAL_BUDGET,
  );
  let state: 'PREPARED' | 'PRESENTING' | 'SETTLED' = 'PREPARED';
  let runner: StoryboardRunner | null = null;

  const restoreCanonical = (): void => {
    canonicalSurface.style.removeProperty('visibility');
    mapActor.remove();
    actor.dispose();
    unmountActor();
  };
  const settle = (cancelRunner: boolean): void => {
    if (state === 'SETTLED') return;
    state = 'SETTLED';
    if (cancelRunner) runner?.cancel();
    restoreCanonical();
  };

  return {
    lane,
    declaredDurationMs: LOCATION_REVEAL_DURATION_MS,
    present: async (signal, adopt) => {
      if (state === 'SETTLED' || signal.aborted) {
        settle(true);
        return 'CANCELLED';
      }
      if (state !== 'PREPARED') {
        throw new Error(`Location reveal ${timeline.storyboardId} presented twice`);
      }
      state = 'PRESENTING';
      const targets = new Map<string, Element>([
        [`LOCATION_MAP:${lane}`, mapActor],
        [`LOCATION_ACTOR:${lane}`, actor.element],
      ]);
      runner = new StoryboardRunner(
        browser.createTimelineDriver(targets),
        {
          dispatch: cue => {
            if (cue.kind === 'AUDIO') host.playSfx(cue.sound);
          },
        },
      );

      // The committed state is intentionally not adopted yet. This prepared
      // owner renders the entire transition against frame.before, then hands
      // the pixels to frame.after at the storyboard handoff.
      canonicalSurface.style.visibility = 'hidden';
      const onAbort = (): void => settle(true);
      signal.addEventListener('abort', onAbort, { once: true });
      let adoption: Promise<void> | null = null;
      try {
        const result = await runner.run(timeline, NORMAL_ANIMATION_PROFILE, {
          handoff: () => {
            // Preserve the compiled final pose when StoryboardRunner cancels
            // its fill effects, synchronously adopt canonical truth underneath,
            // then keep the surrogate mounted through the reactive commit.
            mapActor.style.opacity = '1';
            actor.element.style.transform = 'rotateY(180deg)';
            adoption = adopt();
          },
        });
        if (result.outcome === 'COMPLETED') {
          if (!adoption) {
            throw new Error(`LOCATION_REVEALED ${timeline.storyboardId} missed its handoff`);
          }
          await adoption;
        }
        return result.outcome;
      } finally {
        signal.removeEventListener('abort', onAbort);
        settle(true);
      }
    },
    cancel: () => settle(true),
  };
};

function createMapActor(
  document: Document,
  canonicalMap: HTMLElement,
  mapArt: string | null,
): HTMLElement {
  const element = document.createElement('div');
  element.className = 'lane-map location-map-motion-surrogate';
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    backgroundImage: mapArt ? `url("${mapArt}")` : 'none',
    opacity: '0',
    pointerEvents: 'none',
    willChange: 'opacity',
  });
  canonicalMap.insertAdjacentElement('afterend', element);
  return element;
}

interface TwoSidedLocationActor {
  readonly element: HTMLElement;
  dispose(): void;
}

function createTwoSidedActor(
  document: Document,
  host: PlayPresentationHost,
  tile: HTMLElement,
  hiddenModel: Parameters<typeof mountLocationSurface>[1],
  revealedModel: Parameters<typeof mountLocationSurface>[1],
): TwoSidedLocationActor {
  const viewportRect = tile.getBoundingClientRect();
  const localRect = host.motionSurface.toLocalRect(viewportRect);
  const element = document.createElement('div');
  element.className = 'location location-motion-surrogate';
  element.setAttribute('aria-hidden', 'true');
  Object.assign(element.style, {
    position: 'absolute',
    left: `${localRect.left}px`,
    top: `${localRect.top}px`,
    width: `${localRect.width}px`,
    height: `${localRect.height}px`,
    margin: '0',
    opacity: '1',
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    transformStyle: 'preserve-3d',
    willChange: 'transform',
    transform: 'rotateY(0deg)',
  });

  const back = createFace(document, 'back', 'rotateY(0deg)');
  const front = createFace(document, 'front', 'rotateY(180deg)');
  element.append(back, front);
  const mounts: MountedLocationSurface[] = [
    mountLocationSurface(back, hiddenModel),
    mountLocationSurface(front, revealedModel),
  ];
  let disposed = false;
  return {
    element,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const mount of mounts) mount.dispose();
    },
  };
}

function createFace(
  document: Document,
  face: 'front' | 'back',
  transform: string,
): HTMLElement {
  const element = document.createElement('div');
  element.className = `location-motion-face location-motion-face--${face}`;
  Object.assign(element.style, {
    position: 'absolute',
    inset: '0',
    backfaceVisibility: 'hidden',
    transform,
  });
  return element;
}

function locationSurface(tile: HTMLElement | null): HTMLElement | null {
  return tile?.querySelector<HTMLElement>('[data-surface-kind="location"]') ?? null;
}
