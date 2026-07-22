import type { SeatCardToken, SeatTransactionFrame } from '../runtime/projection';
import type { PlayPresentationHost } from './playPresentationHost';
import { eventString } from './projectedEvent';
import { REVEAL_CINEMATIC_TIMING } from './timing';
import {
  captureCardVisual,
  type CardMotionCancelReason,
  type CardMotionSession,
} from './cardMotion';

export interface CardRevealPreparation {
  readonly cardId: SeatCardToken;
  readonly width: number;
  readonly height: number;
  readonly rotationDegrees: number;
  readonly session: CardMotionSession;
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

export const prepareCardRevealAnimation = (
  host: PlayPresentationHost,
  frame: SeatTransactionFrame,
): CardRevealPreparation | null => {
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
  return {
    cardId,
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    rotationDegrees: snapshot.rotationDegrees,
    session,
  };
};

export const animateCardReveal = async (
  host: PlayPresentationHost,
  preparation: CardRevealPreparation,
  signal: AbortSignal,
): Promise<void> => {
  if (signal.aborted) return;
  const { session } = preparation;
  const endpoint = host.motionSurface.cardMotion.endpoint(preparation.cardId);
  const revealedModel = endpoint.resolveModel();
  if (!revealedModel || revealedModel.face.kind !== 'front') {
    throw new Error(`Revealed card surface is unavailable for ${preparation.cardId}`);
  }
  const boardRect = host.motionSurface.frameRect();
  const centerRect = new DOMRect(
    boardRect.left + boardRect.width / 2 - preparation.width / 2,
    boardRect.top + boardRect.height / 2 - preparation.height / 2,
    preparation.width,
    preparation.height,
  );
  host.playSfx('reveal');
  const centerResult = await session.animateTo({
    rect: centerRect,
    rotationDegrees: preparation.rotationDegrees,
    face: 'faceUp',
    model: revealedModel,
  }, {
    durationMs: REVEAL_CINEMATIC_TIMING.enterMs,
    easing: 'cubic-bezier(.2,.8,.3,1)',
    scaleFrom: 0.02,
    scaleTo: 2.2,
    faceAtLanding: 'faceUp',
  });
  if (centerResult || signal.aborted) return;
  if (!await waitFor(REVEAL_CINEMATIC_TIMING.holdMs, signal)) return;
  const returnResult = await session.animateTo(endpoint, {
    durationMs: REVEAL_CINEMATIC_TIMING.returnMs,
    easing: 'cubic-bezier(.4,0,.2,1)',
    scaleFrom: 2.2,
    scaleTo: 1,
    faceAtLanding: 'faceUp',
  });
  if (returnResult || signal.aborted) return;
  await session.handoffTo(endpoint);
};

export const cancelCardRevealAnimation = (
  preparation: CardRevealPreparation,
  reason: CardMotionCancelReason,
): void => {
  void preparation.session.cancel(reason);
};
