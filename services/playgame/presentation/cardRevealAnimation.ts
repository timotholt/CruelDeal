import type { SeatCardToken, SeatTransactionFrame } from '../runtime/projection';
import { resolveCard } from '../view';
import { cardSurfaceModel } from './appearance';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventString } from './projectedEvent';
import { REVEAL_CINEMATIC_TIMING } from './timing';
import { prepareCardSurfaceModel } from '@/components/game-surfaces/card/cardSurfaceRuntime';
import {
  captureCardVisual,
  runCardMotionStoryboard,
  type CardMotionCancelReason,
  type CardMotionSession,
} from './cardMotion';
import type { LogicalCardEndpoint } from './cardMotion/types';
import { milliseconds } from './storyboard/contracts';

export interface PreparedCardReveal {
  readonly frame: SeatTransactionFrame;
  readonly cardId: SeatCardToken;
  readonly width: number;
  readonly height: number;
  readonly rotationDegrees: number;
  readonly session: CardMotionSession;
  readonly declaredDurationMs: number;
  present(signal: AbortSignal): Promise<import('./storyboard/contracts').PresentationOutcome>;
  cancel(reason?: CardMotionCancelReason): void;
}

/**
 * Prepares every face-up card raster authorized by one committed transaction.
 * Asset readiness belongs before any reveal clock starts, so cache misses can
 * never change the visible cadence between the first and later cards.
 */
export const preloadCardRevealSurfaces = async (
  host: PlayPresentationHost,
  frames: readonly SeatTransactionFrame[],
  signal: AbortSignal,
): Promise<void> => {
  const models = new Map<string, ReturnType<typeof cardSurfaceModel>>();
  for (const frame of frames) {
    if (frame.event?.type !== 'CARD_REVEALED') continue;
    const cardId = eventString(frame.event, 'card') as SeatCardToken | null;
    if (!cardId) throw new Error('CARD_REVEALED is missing its seat-visible card token');
    const card = resolveCard(cardId, frame.after, host.content, host.cardStatReadModel);
    if (!card?.defId) {
      throw new Error(`CARD_REVEALED has no authorized front model for ${cardId}`);
    }
    const model = cardSurfaceModel(card, {
      face: 'front',
      borderTone: card.owner === host.localSeat ? 'friendly' : 'enemy',
    });
    if (model.face.kind !== 'front') {
      throw new Error(`CARD_REVEALED resolved a hidden surface for ${cardId}`);
    }
    models.set(model.face.content.cacheKey, model);
  }
  await Promise.all([...models.values()].map(model => prepareCardSurfaceModel(model)));
  if (signal.aborted) throw new DOMException('Card reveal preparation aborted', 'AbortError');
};

export const prepareCardRevealAnimation = (
  host: PlayPresentationHost,
  frame: SeatTransactionFrame,
): PreparedCardReveal | null => {
  if (frame.event?.type !== 'CARD_REVEALED') return null;
  const cardId = eventString(frame.event, 'card') as SeatCardToken | null;
  if (!cardId) throw new Error('CARD_REVEALED is missing its seat-visible card token');
  const element = host.cardElement(cardId);
  if (!element?.isConnected) {
    throw new Error(`CARD_REVEALED cannot capture mounted card surface ${cardId}`);
  }
  const snapshot = captureCardVisual(cardId, element);
  const session = host.motionSurface.cardMotion.begin({
    cardId,
    route: 'reveal',
    basis: { kind: 'clone', snapshot },
    startRect: snapshot.rect,
    rotationDegrees: snapshot.rotationDegrees,
    face: 'faceDown',
    sourceElement: element,
    zIndex: 200,
    className: 'reveal-flyer',
  });
  let state: 'PREPARED' | 'PRESENTING' | 'SETTLED' = 'PREPARED';
  const preparation = {
    frame,
    cardId,
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    rotationDegrees: snapshot.rotationDegrees,
    session,
    declaredDurationMs: REVEAL_CINEMATIC_TIMING.enterMs
      + REVEAL_CINEMATIC_TIMING.holdMs
      + REVEAL_CINEMATIC_TIMING.returnMs,
    present: async (signal: AbortSignal) => {
      if (state === 'SETTLED' || signal.aborted) {
        session.cancel('presentation-invalidated');
        return 'CANCELLED' as const;
      }
      if (state !== 'PREPARED') throw new Error(`Card reveal ${cardId} presented twice`);
      state = 'PRESENTING';
      const outcome = await presentPreparedCardReveal(host, preparation, signal);
      state = 'SETTLED';
      return outcome;
    },
    cancel: (reason: CardMotionCancelReason = 'presentation-invalidated') => {
      if (state === 'SETTLED') return;
      state = 'SETTLED';
      session.cancel(reason);
    },
  };
  return preparation;
};

const presentPreparedCardReveal = async (
  host: PlayPresentationHost,
  preparation: PreparedCardReveal,
  signal: AbortSignal,
): Promise<import('./storyboard/contracts').PresentationOutcome> => {
  if (signal.aborted) return 'CANCELLED';
  const { session } = preparation;
  const endpoint = host.motionSurface.cardMotion.endpoint(preparation.cardId);
  const revealedModel = endpoint.resolveModel();
  if (!revealedModel || revealedModel.face.kind !== 'front') {
    throw new Error(`Revealed card surface is unavailable for ${preparation.cardId}`);
  }
  const centerEndpoint: LogicalCardEndpoint = {
    kind: 'logical',
    coordinateSpace: 'frame-local',
    resolveRect: () => {
      const frame = host.motionSurface.frameRect();
      if (frame.width <= 0 || frame.height <= 0) return null;
      return new DOMRect(
        frame.width / 2 - preparation.width / 2,
        frame.height / 2 - preparation.height / 2,
        preparation.width,
        preparation.height,
      );
    },
    rotationDegrees: preparation.rotationDegrees,
    face: 'faceUp',
    model: revealedModel,
  };
  const enter = await session.prepareStep(
    `${preparation.cardId}:reveal-enter`,
    centerEndpoint,
    {
      durationMs: REVEAL_CINEMATIC_TIMING.enterMs,
      easing: 'cubic-bezier(.42,0,.58,1)',
      faceEasing: 'cubic-bezier(.42,0,.58,1)',
      // The surrogate is already captured over the mounted lane card at its
      // real resting size. Starting this track near zero made the card snap
      // out of existence before the first painted animation frame, hiding
      // the first half of the flip and making the return look like a second
      // transfer. Reveal grows continuously from the captured lane surface.
      scaleFrom: 1,
      scaleTo: 2.2,
      faceAtLanding: 'faceUp',
    },
  );
  const enterWithAudio = {
    ...enter,
    cues: [{
      kind: 'AUDIO' as const,
      id: `${enter.id}:audio`,
      atMs: milliseconds(0),
      sound: 'reveal',
      volume: 1,
    }],
  };
  const hold = {
    id: `${preparation.cardId}:reveal-apex-hold`,
    durationMs: milliseconds(REVEAL_CINEMATIC_TIMING.holdMs),
    nextStepAfterMs: milliseconds(REVEAL_CINEMATIC_TIMING.holdMs),
    tracks: [],
    cues: [],
  } as const;
  const returnToLane = await session.prepareStep(
    `${preparation.cardId}:reveal-return`,
    endpoint,
    {
      durationMs: REVEAL_CINEMATIC_TIMING.returnMs,
      easing: 'cubic-bezier(.4,0,.2,1)',
      scaleFrom: 2.2,
      scaleTo: 1,
      faceAtLanding: 'faceUp',
    },
  );
  const outcome = await runCardMotionStoryboard({
    id: `${preparation.cardId}:reveal-storyboard`,
    source: {
      kind: 'BEAT',
      transactionId: preparation.frame.transactionId,
      firstFrame: preparation.frame.frame,
      lastFrame: preparation.frame.frame,
    },
    targets: session.timelineTargets(),
    steps: [enterWithAudio, hold, returnToLane],
    createTimelineDriver: host.motionSurface.timelineDriverFactory,
    dispatchCue: cue => {
      if (cue.kind === 'AUDIO') host.playSfx(cue.sound);
    },
    maximumCardActors: 1,
    handoff: () => { session.handoffTo(endpoint); },
    signal,
  });
  if (outcome !== 'COMPLETED') session.cancel('presentation-invalidated');
  return outcome;
};
