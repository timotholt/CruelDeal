import type { SetStoreFunction } from 'solid-js/store';
import { revealPendingCinematic } from '@/services/vfx/animations/reveal-cinematic';
import type { Manifest } from '../engine/manifest/types';
import type { Seat } from '../engine/types/ids';
import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { MatchEventFrame, MatchTransactionFrames } from '../runtime/contracts';
import type { ZoneAnchorKey } from '../presentation/cardTransfers';
import { animateEvent } from '../presentation/eventAnimator';
import { planCommittedEventPacing } from '../presentation/committedTimeline';
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
  boardWrap: HTMLElement;
  toastArea: HTMLElement;
  cardRefs: Map<string, HTMLElement>;
  zoneRefs: Map<ZoneAnchorKey, HTMLElement>;
  deckEl?: HTMLElement;
  sfx?: (name: string) => void;
  cancelled?: boolean;
  onCancel?: () => void;
  presentCommittedFrame: (frame: MatchEventFrame) => void;
  finishTurnPresentation: () => void;
}

const waitFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const PRESENTATION_FRAME_TIMEOUT_MS = 5_000;

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
  frame: MatchEventFrame,
  presentFrame: () => void,
): Promise<void> => {
  if (frame.event.type !== 'LOCATION_REVEALED') return;
  const lane = frame.event.lane;
  const laneElement = c.boardEl.querySelector(`.lane-map[data-lane="${lane}"]`) as HTMLElement | null;
  const tileElement = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;
  if (tileElement) {
    tileElement.style.transition = 'none';
    tileElement.style.opacity = '0';
  }
  if (laneElement) {
    laneElement.style.transition = 'opacity 600ms ease';
    laneElement.style.opacity = '1';
  }
  await waitFor(650);
  presentFrame();
  const freshTile = c.boardEl.querySelector(`.location[data-lane="${lane}"]`) as HTMLElement | null;
  if (freshTile) {
    freshTile.style.transition = 'none';
    freshTile.style.opacity = '0';
    freshTile.style.transform = 'rotateY(90deg) scale(0.85)';
    freshTile.getBoundingClientRect();
    freshTile.style.transition = 'opacity 500ms ease, transform 500ms cubic-bezier(.2,0,.4,1)';
    freshTile.style.opacity = '1';
    freshTile.style.transform = 'rotateY(0deg) scale(1)';
  }
  await waitFor(600);
};

const paceFrame = async (
  c: PlayScriptCtx,
  frame: MatchEventFrame,
  presentFrame: () => void,
): Promise<void> => {
  if (frame.event.type === 'TURN_RESOLUTION_STARTED') {
    // Present and hold one shared lock beat so every staged card can paint
    // face-down before the first per-card reveal cinematic starts.
    presentFrame();
    await waitFor(250);
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
      boardWrap: c.boardWrap,
      sfx: c.sfx,
    });
  }
  await animateEvent(c, frame, presentFrame);
};

const paceTimeline = async (
  c: PlayScriptCtx,
  timeline: MatchTransactionFrames,
  eventIndexes = planCommittedEventPacing(timeline.transaction.events).orderedEventIndexes,
): Promise<void> => {
  try {
    for (const index of eventIndexes) {
      const frame = timeline.frames[index];
      if (!frame) continue;
      if (c.cancelled) return;
      let acceptingAnimationDispatch = true;
      let framePresented = false;
      const presentFrame = (): void => {
        if (!acceptingAnimationDispatch || framePresented) return;
        framePresented = true;
        c.presentCommittedFrame(frame);
      };
      const outcome = await settlePresentationWithin(
        paceFrame(c, frame, presentFrame),
        PRESENTATION_FRAME_TIMEOUT_MS,
      );

      // State progression is the invariant; animation completion is optional.
      // Commit a missing frame on success, error, or timeout, then prevent a
      // late continuation from replaying this older projection out of order.
      presentFrame();
      acceptingAnimationDispatch = false;
      if (outcome !== 'completed') releaseAllHandSlots(c);
    }
  } finally {
    // A completed, failed, or cancelled presentation cannot permanently
    // remove committed hand cards from the interactive hand projection.
    releaseAllHandSlots(c);
  }
};

const openingRevealIndex = (timeline: MatchTransactionFrames): number =>
  timeline.transaction.events.findIndex((event) => event.type === 'LOCATION_REVEALED');

const openingDealEndIndex = (c: PlayScriptCtx, timeline: MatchTransactionFrames): number => {
  const revealIndex = openingRevealIndex(timeline);
  if (revealIndex >= 0) return revealIndex;
  return Math.min(timeline.frames.length, c.manifest.constants.startingHandSize * 2);
};

export const paceCommittedOpeningDeal = (timeline: MatchTransactionFrames): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const end = openingDealEndIndex(c, timeline);
  await paceTimeline(
    c,
    timeline,
    Array.from({ length: end }, (_, index) => index),
  );
};

export const paceCommittedOpeningLocationReveal = (
  timeline: MatchTransactionFrames,
): Step => async (ctx) => {
  const revealIndex = openingRevealIndex(timeline);
  await paceTimeline(ctx as PlayScriptCtx, timeline, revealIndex < 0 ? [] : [revealIndex]);
};

export const paceCommittedOpeningTurnStart = (
  timeline: MatchTransactionFrames,
): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  const revealIndex = openingRevealIndex(timeline);
  const start = revealIndex < 0 ? openingDealEndIndex(c, timeline) : revealIndex + 1;
  await paceTimeline(
    c,
    timeline,
    Array.from({ length: timeline.frames.length - start }, (_, index) => start + index),
  );
};

export const paceCommittedTurn = (timeline: MatchTransactionFrames): Step => async (ctx) => {
  const c = ctx as PlayScriptCtx;
  try {
    await paceTimeline(c, timeline);
    c.setUi('isFlipped', false);
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
