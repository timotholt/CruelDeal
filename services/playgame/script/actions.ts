import type { SetStoreFunction } from 'solid-js/store';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import type { Manifest } from '../engine/manifest/types';
import type { Seat } from '../engine/types/ids';
import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { EventTransition } from '../engine/transactionTimeline';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import type { ZoneAnchorKey } from '../presentation/cardTransfers';
import { getLocationState } from '../engine/projections/locationRuntime';
import { getLocationTemplate } from '../engine/projections/locationTemplate';
import type { PlayMotionSurface } from '../presentation/playMotionSurface';
import { animateEvent } from '../presentation/eventAnimator';
import {
  planCommittedEventPacing,
  planCommittedResolutionWalk,
} from '../presentation/committedTimeline';
import { releaseAllHandSlots } from '../presentation/handReservations';
import type {
  PlayfieldEventPresenter,
  PlayfieldPresentationEvent,
} from '../presentation/playfieldEvents';
import { showToast } from '../toast';
import type { UiState } from '../view';
import type { Step } from './runner';
import {
  elapsed,
  monotonicNow,
  type FramePresentationTiming,
} from '../runtime/performanceTelemetry';

export interface PlayScriptCtx extends Record<string, unknown> {
  state: EngineMatchState;
  ui: UiState;
  setUi: SetStoreFunction<UiState>;
  manifest: Manifest;
  localSeat: Seat;
  remoteSeat: Seat;
  boardEl: HTMLElement;
  motionSurface: PlayMotionSurface;
  toastArea: HTMLElement;
  cardRefs: Map<string, HTMLElement>;
  zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
  deckEl?: HTMLElement;
  sfx?: (name: string) => void;
  cancelled?: boolean;
  onCancel?: () => void;
  presentCommittedFrame: (frame: EventTransition) => void;
  recordFramePresentationTiming?: (timing: FramePresentationTiming) => void;
  finishTurnPresentation: () => void;
  presentPlayfieldEvent: PlayfieldEventPresenter;
}

const waitFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const PRESENTATION_FRAME_TIMEOUT_MS = 5_000;
const LOCATION_REVEAL_DURATION_MS = 700;
const TURN_RESOLUTION_LOCK_HOLD_MS = 100;
const TURN_BANNER_DURATION_MS = 2_100;
const TURN_BANNER_HOLD_MS = 1_200;
const OPENING_TURN_BANNER_DURATION_MS = 1_800;
const OPENING_TURN_BANNER_HOLD_MS = OPENING_TURN_BANNER_DURATION_MS + 100;

type PresentationOutcome = 'completed' | 'failed' | 'timed-out';
type BeforeFrameHook = (frame: EventTransition) => Promise<void> | void;

const settlePresentationWithin = (
  presentation: Promise<void>,
  timeoutMs: number,
): Promise<PresentationOutcome> => new Promise((resolve) => {
  let settled = false;
  const finish = (outcome: PresentationOutcome): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    resolve(outcome);
  };
  const timeoutId = setTimeout(() => finish('timed-out'), timeoutMs);
  void presentation.then(
    () => finish('completed'),
    () => finish('failed'),
  );
});

export const presentPlayfieldEvent = (
  event: PlayfieldPresentationEvent,
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  await c.presentPlayfieldEvent(event);
};

export const toast = (text: string, opts: { duration?: number } = {}): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const duration = opts.duration ?? 1400;
  showToast(c.toastArea, text, { duration });
  await waitFor(duration + 100);
};

const paceLocationReveal = async (
  c: PlayScriptCtx,
  frame: EventTransition,
  presentFrame: () => void,
): Promise<void> => {
  if (frame.event.type !== 'LOCATION_REVEALED') return;
  const lane = frame.event.lane;
  const halfDuration = LOCATION_REVEAL_DURATION_MS / 2;
  const laneElement = c.boardEl.querySelector(`.lane-map[data-lane="${lane}"]`) as HTMLElement | null;
  const tileElement = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;

  const location = getLocationState(frame.after, frame.event.locationId);
  const mapPath = location
    ? getLocationTemplate(c.manifest, location.defId)?.mapArtPath
    : undefined;

  // The map begins its complete fade while the still-visible hidden tile
  // turns edge-on. Preinstall the committed artwork so the fade starts at
  // frame zero rather than popping in when canonical state is adopted.
  if (laneElement) {
    if (mapPath) laneElement.style.backgroundImage = `url(${JSON.stringify(mapPath)})`;
    laneElement.style.transition = 'none';
    laneElement.style.opacity = '0';
    void laneElement.offsetWidth;
    laneElement.style.transition = `opacity ${LOCATION_REVEAL_DURATION_MS}ms ease`;
    laneElement.style.opacity = '1';
  }

  // Keep the tile continuously mounted and opaque. The canonical face changes
  // only while the card is edge-on, then the revealed face completes the
  // second half of the same flip.
  if (tileElement) {
    tileElement.style.transition = 'none';
    tileElement.style.opacity = '1';
    tileElement.style.transformOrigin = '50% 50%';
    tileElement.style.willChange = 'transform';
    tileElement.style.transform = 'rotateY(0deg)';
    void tileElement.offsetWidth;
    tileElement.style.transition = `transform ${halfDuration}ms cubic-bezier(.4,0,.7,1)`;
    tileElement.style.transform = 'rotateY(90deg)';
  }

  await waitFor(halfDuration);
  presentFrame();

  const freshTile = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;
  if (freshTile) {
    freshTile.style.transition = 'none';
    freshTile.style.opacity = '1';
    freshTile.style.transform = 'rotateY(-90deg)';
    void freshTile.offsetWidth;
    freshTile.style.transition = `transform ${halfDuration}ms cubic-bezier(.3,0,.2,1)`;
    freshTile.style.transform = 'rotateY(0deg)';
  }

  await waitFor(halfDuration);

  if (freshTile) {
    freshTile.style.removeProperty('transition');
    freshTile.style.removeProperty('transform');
    freshTile.style.removeProperty('transform-origin');
    freshTile.style.removeProperty('will-change');
    freshTile.style.removeProperty('opacity');
  }
  const canonicalLaneElement = c.boardEl.querySelector(
    `.lane-map[data-lane="${lane}"]`,
  ) as HTMLElement | null;
  if (canonicalLaneElement) {
    canonicalLaneElement.style.removeProperty('opacity');
    canonicalLaneElement.style.removeProperty('transition');
  }
};

const paceFrame = async (
  c: PlayScriptCtx,
  frame: EventTransition,
  presentFrame: () => void,
): Promise<void> => {
  if (frame.event.type === 'TURN_RESOLUTION_STARTED') {
    // The synthetic local-lock beat has already painted. This canonical frame
    // now adopts authority without introducing a second facing transition.
    presentFrame();
    return;
  }
  if (frame.event.type === 'TURN_STARTED') {
    // Bind the banner to the canonical turn boundary. Holding this frame keeps
    // later bookkeeping and the location reveal behind the same cue order used
    // by the opening storyboard.
    presentFrame();
    showToast(c.toastArea, `TURN ${frame.event.turn}`, {
      duration: TURN_BANNER_DURATION_MS,
    });
    await waitFor(TURN_BANNER_HOLD_MS);
    return;
  }
  if (frame.event.type === 'MATCH_ENDED') {
    presentFrame();
    c.setUi('lockedResult', frame.event.result);
    c.setUi('showEndGamePrompt', true);
    return;
  }
  if (frame.event.type === 'LOCATION_REVEALED') {
    await paceLocationReveal(c, frame, presentFrame);
    return;
  }
  if (frame.event.type === 'CARD_REVEALED') {
    await revealPendingCinematic({
      pendingIds: [frame.event.cardId],
      cardElMap: c.cardRefs,
      motionSurface: c.motionSurface,
      sfx: c.sfx,
      adoptCanonicalFace: presentFrame,
    });
  }
  await animateEvent(c, frame, presentFrame);
};

const paceTimeline = async (
  c: PlayScriptCtx,
  timeline: CommittedTransactionTimeline,
  eventIndexes = planCommittedEventPacing(
    timeline.transaction.framedEvents.map(({ event }) => event),
  ).orderedEventIndexes,
  beforeFrame?: BeforeFrameHook,
): Promise<void> => {
  try {
    const beats = planCommittedResolutionWalk(timeline, c.localSeat, eventIndexes);
    for (const beat of beats) {
      if (c.cancelled) return;
      if (beat.kind === 'local-lock') {
        // Lock the already-visible local plan before the remote fake-hand
        // flight. TURN_RESOLUTION_STARTED later reasserts this same value in
        // the provider's atomic committed projection adoption.
        c.setUi('isFlipped', true);
        await waitFor(TURN_RESOLUTION_LOCK_HOLD_MS);
        continue;
      }

      const frame = beat.frame;
      await beforeFrame?.(frame);
      const startedAtMs = monotonicNow();
      let acceptingAnimationDispatch = true;
      let framePresented = false;
      const presentFrame = (): void => {
        if (!acceptingAnimationDispatch || framePresented) return;
        framePresented = true;
        c.presentCommittedFrame(frame);
      };
      const outcome = beat.kind === 'local-stage-adoption'
        ? (presentFrame(), 'completed' as const)
        : await settlePresentationWithin(
          paceFrame(c, frame, presentFrame),
          PRESENTATION_FRAME_TIMEOUT_MS,
        );

      // State progression is the invariant; animation completion is optional.
      // Commit a missing frame on success, error, or timeout, then prevent a
      // late continuation from replaying this older projection out of order.
      presentFrame();
      acceptingAnimationDispatch = false;
      const endedAtMs = monotonicNow();
      c.recordFramePresentationTiming?.({
        transactionId: frame.transactionId,
        frame: frame.frame,
        eventType: frame.event.type,
        beatKind: beat.kind,
        outcome,
        startedAtMs,
        endedAtMs,
        durationMs: elapsed(startedAtMs, endedAtMs),
      });
      if (outcome !== 'completed') {
        c.motionSurface?.cardMotion.cancelAll(
          outcome === 'timed-out' ? 'presentation-timeout' : 'presentation-invalidated',
        );
        releaseAllHandSlots(c);
      }
    }
  } finally {
    // A completed, failed, or cancelled presentation cannot permanently
    // remove committed hand cards from the interactive hand projection.
    releaseAllHandSlots(c);
  }
};

export const paceCommittedOpening = (timeline: CommittedTransactionTimeline): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  let turnBannerPresented = false;
  await paceTimeline(
    c,
    timeline,
    undefined,
    async (frame) => {
      if (turnBannerPresented || frame.event.type !== 'LOCATION_REVEALED') return;
      turnBannerPresented = true;
      showToast(c.toastArea, 'TURN 1', {
        duration: OPENING_TURN_BANNER_DURATION_MS,
      });
      await waitFor(OPENING_TURN_BANNER_HOLD_MS);
    },
  );
};

export const paceCommittedTurn = (timeline: CommittedTransactionTimeline): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  try {
    await paceTimeline(c, timeline);
  } finally {
    c.finishTurnPresentation();
  }
};

export { wait } from './runner';
