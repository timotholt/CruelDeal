import type { SetStoreFunction } from 'solid-js/store';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import type { Manifest } from '../engine/manifest/types';
import type { Seat } from '../engine/types/ids';
import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { EventTransition } from '../engine/transactionTimeline';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import type { ZoneAnchorKey } from '../presentation/cardTransfers';
import type { PlayMotionSurface } from '../presentation/playMotionSurface';
import { animateEvent } from '../presentation/eventAnimator';
import {
  planCommittedEventPacing,
  planCommittedResolutionWalk,
} from '../presentation/committedTimeline';
import { releaseAllHandSlots } from '../presentation/handReservations';
import { showToast } from '../toast';
import type { UiState } from '../view';
import type { Step } from './runner';

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
  finishTurnPresentation: () => void;
}

const waitFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const PRESENTATION_FRAME_TIMEOUT_MS = 5_000;
const LOCATION_REVEAL_DURATION_MS = 700;

type PresentationOutcome = 'completed' | 'failed' | 'timed-out';

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

export const setBoardVisible = (on: boolean): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const root = c.boardEl.closest('.playgame-root') as HTMLElement | null;
  root?.classList.toggle('board-hidden', !on);
  await waitFor(620);
};

export const toast = (text: string, opts: { duration?: number } = {}): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const duration = opts.duration ?? 1400;
  showToast(c.toastArea, text, { duration });
  await waitFor(duration + 100);
};

export const hideLocationTiles = (): Step => (ctx) => {
  const c = ctx as PlayScriptCtx;
  for (let lane = 0; lane < 3; lane++) {
    const element = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;
    if (!element) continue;
    element.style.transition = 'none';
    element.style.opacity = '0';
  }
};

export const fadeInLocationTile = (lane: number, ms = 400): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const element = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;
  if (!element) return;
  element.style.opacity = '0';
  void element.offsetWidth;
  element.style.transition = `opacity ${ms}ms ease`;
  element.style.opacity = '1';
  await waitFor(ms);
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

  const location = frame.after.locationCards[frame.event.locationId];
  const mapPath = location
    ? c.manifest.locations[location.defId]?.cosmetic.art.map.path
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
  if (frame.event.type === 'LOCATION_REVEALED') {
    await paceLocationReveal(c, frame, presentFrame);
    return;
  }
  if (frame.event.type === 'CARD_FLIPPED') {
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
        await waitFor(250);
        continue;
      }

      const frame = beat.frame;
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

const openingRevealIndex = (timeline: CommittedTransactionTimeline): number =>
  timeline.transaction.framedEvents.findIndex(({ event }) => event.type === 'LOCATION_REVEALED');

const openingDealEndIndex = (c: PlayScriptCtx, timeline: CommittedTransactionTimeline): number => {
  const revealIndex = openingRevealIndex(timeline);
  if (revealIndex >= 0) return revealIndex;
  return Math.min(timeline.transitions.length, c.manifest.constants.startingHandSize * 2);
};

export const paceCommittedOpeningDeal = (timeline: CommittedTransactionTimeline): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const end = openingDealEndIndex(c, timeline);
  await paceTimeline(
    c,
    timeline,
    Array.from({ length: end }, (_, index) => index),
  );
};

export const paceCommittedOpeningLocationReveal = (
  timeline: CommittedTransactionTimeline,
): Step => async (ctx) => {
  const revealIndex = openingRevealIndex(timeline);
  await paceTimeline(ctx as PlayScriptCtx, timeline, revealIndex < 0 ? [] : [revealIndex]);
};

export const paceCommittedOpeningTurnStart = (
  timeline: CommittedTransactionTimeline,
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const revealIndex = openingRevealIndex(timeline);
  const start = revealIndex < 0 ? openingDealEndIndex(c, timeline) : revealIndex + 1;
  await paceTimeline(
    c,
    timeline,
    Array.from({ length: timeline.transitions.length - start }, (_, index) => start + index),
  );
};

export const paceCommittedTurn = (timeline: CommittedTransactionTimeline): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  try {
    await paceTimeline(c, timeline);
    if (c.state.phase === 'ENDED' && c.state.result && !c.ui.lockedResult) {
      c.setUi('lockedResult', c.state.result);
      c.setUi('showEndGamePrompt', true);
    }
    if (c.state.phase !== 'ENDED') {
      showToast(c.toastArea, `TURN ${c.state.turn}`, { duration: 2100 });
      await waitFor(1200);
    }
  } finally {
    c.finishTurnPresentation();
  }
};

export { wait } from './runner';
