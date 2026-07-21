import { captureCardRects, playCardLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { Timeline } from '@/services/vfx/timeline';
import type { CardMotionCancelReason } from './cardMotion';
import {
  canonicalVisualElement,
  captureCardVisual,
  type CardMotionSession,
  type SurrogateBasis,
} from './cardMotion';
import {
  assertTransferCoverage,
  deriveCardTransfers,
  resolveCardTransferFace,
  zoneAnchorKey,
  type CardTransfer,
  type CardZoneRef,
} from './cardTransfers';
import {
  describeEventChoreography,
  type EventChoreography,
  type SfxCue,
} from './choreography';
import { HAND_SLOT_RESERVE_MS } from './handPresentation';
import type { PlayPresentationHost } from './playPresentationHost';
import type {
  SeatTransactionFrame,
  SeatVisibleMatchState,
} from '../runtime/projection';
import { resolveCard, type ResolvedCard } from '../view';

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

export const fallbackRectForZone = (
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  zone: CardZoneRef,
  remoteSeat: PlayPresentationHost['remoteSeat'],
): DOMRect => {
  const width = 70;
  const height = 100;
  if (zone.kind === 'HAND' && zone.owner === remoteSeat) {
    return new DOMRect(
      bounds.left + bounds.width / 2 - width / 2,
      bounds.top + 16,
      width,
      height,
    );
  }
  return new DOMRect(
    bounds.left + bounds.width / 2 - width / 2,
    bounds.top + bounds.height / 2 - height / 2,
    width,
    height,
  );
};

const playSfx = (
  host: PlayPresentationHost,
  cues: readonly SfxCue[],
  timing: SfxCue['timing'],
): void => {
  for (const cue of cues) {
    if (cue.timing === timing) host.playSfx?.(cue.name);
  }
};

const playVfx = (
  host: PlayPresentationHost,
  choreography: EventChoreography,
): void => {
  for (const cue of choreography.vfx) host.playVfx?.(cue);
};

const rectForZone = (
  host: PlayPresentationHost,
  zone: CardZoneRef,
): DOMRect => {
  const key = zoneAnchorKey(zone);
  const registeredRect = key ? host.motionSurface.zoneRect(key) : null;
  return registeredRect
    ?? fallbackRectForZone(
      host.motionSurface.frameRect(),
      zone,
      host.remoteSeat,
    );
};

const generatedSourceRect = (host: PlayPresentationHost): DOMRect => {
  const generated = host.motionSurface.zoneRect('generated');
  if (generated) return generated;
  const deck = host.motionSurface.zoneRect(`${host.localSeat}:deck`);
  if (deck) return deck;
  const bounds = host.motionSurface.frameRect();
  const width = 70;
  const height = 100;
  return new DOMRect(
    bounds.right + 20,
    bounds.bottom - height - 40,
    width,
    height,
  );
};

const rectForTransferEndpoint = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
  zone: CardZoneRef,
  capturedCardRects: Map<string, DOMRect>,
  endpoint: 'from' | 'to',
): { rect: DOMRect; el: HTMLElement | null; visibleCard: boolean } => {
  const isCanonicalCardZone = zone.kind === 'LANE'
    || (zone.kind === 'HAND' && zone.owner === host.localSeat);
  const cardId = transfer.cardId as string;
  const captured = capturedCardRects.get(cardId);
  if (endpoint === 'from' && captured && isCanonicalCardZone) {
    return { rect: captured, el: null, visibleCard: true };
  }
  const el = isCanonicalCardZone ? host.cardElement(cardId) : null;
  const registeredRect = isCanonicalCardZone
    ? host.motionSurface.cardRect(cardId)
    : null;
  if (el && registeredRect) return { rect: registeredRect, el, visibleCard: true };
  if (captured && isCanonicalCardZone) {
    return { rect: captured, el: null, visibleCard: true };
  }
  return { rect: rectForZone(host, zone), el: null, visibleCard: false };
};

type PreparedTransfer = {
  readonly transfer: CardTransfer;
  readonly session: CardMotionSession;
};

type PreparedState = {
  readonly host: PlayPresentationHost;
  readonly frame: SeatTransactionFrame;
  readonly choreography: EventChoreography | null;
  readonly transfers: readonly CardTransfer[];
  readonly oldRects: Map<string, DOMRect>;
  readonly preparedTransfers: Map<CardTransfer, PreparedTransfer>;
  readonly sessions: Set<CardMotionSession>;
  readonly cleanups: Set<() => void>;
  readonly controller: AbortController;
  status: 'prepared' | 'running' | 'complete' | 'disposed';
};

export interface PreparedEventAnimation {
  readonly frame: SeatTransactionFrame;
  readonly transfers: readonly CardTransfer[];
  readonly disposed: boolean;
  dispose(reason?: CardMotionCancelReason): void;
}

const preparedStates = new WeakMap<PreparedEventAnimation, PreparedState>();

const disposePreparedState = (
  state: PreparedState,
  reason: CardMotionCancelReason,
): void => {
  if (state.status === 'disposed') return;
  state.status = 'disposed';
  state.controller.abort(reason);
  for (const cleanup of [...state.cleanups]) cleanup();
  state.cleanups.clear();
  for (const session of [...state.sessions]) void session.cancel(reason);
  state.sessions.clear();
};

const createPreparedAnimation = (state: PreparedState): PreparedEventAnimation => {
  const prepared: PreparedEventAnimation = {
    frame: state.frame,
    transfers: state.transfers,
    get disposed() {
      return state.status === 'disposed';
    },
    dispose: (reason = 'presentation-invalidated') => {
      disposePreparedState(state, reason);
    },
  };
  preparedStates.set(prepared, state);
  return prepared;
};

const shouldPrepareSourceBeforeAdoption = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
): boolean => (
  (transfer.from.kind === 'LANE'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === host.localSeat))
  && transfer.style.route !== 'layout-only'
);

const prepareTransferBeforeAdoption = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
): PreparedTransfer | null => {
  if (!shouldPrepareSourceBeforeAdoption(host, transfer)) return null;
  const source = rectForTransferEndpoint(
    host,
    transfer,
    transfer.from,
    capturedCardRects,
    'from',
  );
  const sourceEl = canonicalVisualElement(
    host.cardElement(transfer.cardId as string) ?? source.el,
  );
  if (!sourceEl?.isConnected) return null;
  const snapshot = captureCardVisual(transfer.cardId, sourceEl);
  const initialFace = transfer.face === 'ownerVisible'
    ? resolveCardTransferFace(transfer.face, transfer.owner, host.localSeat)
      ?? snapshot.face
    : snapshot.face;
  const session = host.motionSurface.cardMotion.begin({
    cardId: transfer.cardId,
    route: `${transfer.from.kind}->${transfer.to.kind}`,
    basis: { kind: 'clone', snapshot },
    startRect: snapshot.rect,
    rotationDegrees: snapshot.rotationDegrees,
    face: initialFace,
    sourceElement: sourceEl,
    zIndex: transfer.style.zIndex,
    className: 'transfer-flyer',
  });
  return { transfer, session };
};

/**
 * Captures geometry and leases visible source cards before committed state is
 * adopted. No cursor capability is accepted, so preparation cannot advance
 * or mutate authoritative state.
 */
export function prepareEventAnimation(
  host: PlayPresentationHost,
  frame: SeatTransactionFrame,
): PreparedEventAnimation {
  const choreography = frame.event
    ? describeEventChoreography(frame.event)
    : null;
  const transfers = frame.event
    ? deriveCardTransfers(frame.before, frame.event, frame.after)
    : [];
  if (frame.event && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    assertTransferCoverage(frame.before, frame.event, frame.after, transfers);
  }

  const oldRects = captureCardRects(host.cardIds(), host.motionSurface.cardRefs);
  const state: PreparedState = {
    host,
    frame,
    choreography,
    transfers,
    oldRects,
    preparedTransfers: new Map(),
    sessions: new Set(),
    cleanups: new Set(),
    controller: new AbortController(),
    status: 'prepared',
  };

  try {
    if (choreography) playSfx(host, choreography.sfx, 'on-start');
    for (const transfer of transfers) {
      const prepared = prepareTransferBeforeAdoption(host, transfer, oldRects);
      if (!prepared) continue;
      state.preparedTransfers.set(transfer, prepared);
      state.sessions.add(prepared.session);
    }
    return createPreparedAnimation(state);
  } catch (error) {
    disposePreparedState(state, 'presentation-invalidated');
    throw error;
  }
}

const isLocalHandEntry = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
): boolean => (
  transfer.to.kind === 'HAND'
  && transfer.to.owner === host.localSeat
);

const basisForLogicalSource = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
): SurrogateBasis => {
  const endpoint = host.motionSurface.cardMotion.endpoint(transfer.cardId);
  const protectedSource = resolveCardTransferFace(
    transfer.face,
    transfer.owner,
    host.localSeat,
  ) === 'faceDown'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === host.remoteSeat)
    || (transfer.from.kind === 'DECK' && transfer.from.owner === host.remoteSeat)
    || (transfer.to.kind === 'HAND' && transfer.to.owner === host.remoteSeat);
  return protectedSource
    ? { kind: 'synthetic-back', owner: transfer.owner }
    : { kind: 'destination-clone', endpoint };
};

const playAnchorPop = async (
  state: PreparedState,
  anchor: HTMLElement,
  signal: AbortSignal,
): Promise<void> => {
  const timeline = new Timeline();
  timeline.add(anchor, 'vfx-pop', { 'scale-start': '0.92' }, 220, 0);
  const cleanup = (): void => timeline.clear();
  state.cleanups.add(cleanup);
  timeline.play();
  await waitFor(240, signal);
  cleanup();
  state.cleanups.delete(cleanup);
};

const animateOneTransfer = async (
  state: PreparedState,
  transfer: CardTransfer,
  signal: AbortSignal,
  useTransferSfx: boolean,
): Promise<void> => {
  const { host, oldRects } = state;
  if (signal.aborted) return;
  const source = rectForTransferEndpoint(
    host,
    transfer,
    transfer.from,
    oldRects,
    'from',
  );
  const destination = rectForTransferEndpoint(
    host,
    transfer,
    transfer.to,
    oldRects,
    'to',
  );

  if (transfer.style.route === 'anchor-to-anchor') {
    const key = zoneAnchorKey(transfer.to);
    const anchor = key ? host.zoneElement(key) : null;
    if (anchor?.isConnected) await playAnchorPop(state, anchor, signal);
    return;
  }

  if (isLocalHandEntry(host, transfer)) {
    host.handSlots.release([transfer.cardId as string]);
  }

  const endpoint = transfer.to.kind === 'LANE'
    || (transfer.to.kind === 'HAND' && transfer.to.owner === host.localSeat)
    ? host.motionSurface.cardMotion.endpoint(transfer.cardId)
    : null;
  const sourceRect = transfer.from.kind === 'GENERATED'
    ? generatedSourceRect(host)
    : source.rect;
  const transferFace = resolveCardTransferFace(
    transfer.face,
    transfer.owner,
    host.localSeat,
  );
  const sourceIsProtected = transferFace === 'faceDown'
    || transfer.from.kind === 'DECK'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === host.remoteSeat)
    || (transfer.to.kind === 'HAND' && transfer.to.owner === host.remoteSeat);
  const session = state.preparedTransfers.get(transfer)?.session
    ?? host.motionSurface.cardMotion.begin({
      cardId: transfer.cardId,
      route: `${transfer.from.kind}->${transfer.to.kind}`,
      basis: basisForLogicalSource(host, transfer),
      startRect: sourceRect,
      face: sourceIsProtected ? 'faceDown' : endpoint?.resolveFace() ?? 'faceUp',
      zIndex: transfer.style.zIndex,
      className: 'transfer-flyer',
    });
  state.sessions.add(session);
  if (signal.aborted) {
    await session.cancel('presentation-invalidated');
    return;
  }
  if (useTransferSfx && transfer.style.sfx) host.playSfx?.(transfer.style.sfx);

  const target = endpoint ?? {
    rect: destination.rect,
    rotationDegrees: 0,
    ...(transferFace === null ? {} : { face: transferFace }),
  };
  const motionResult = await session.animateTo(target, {
    durationMs: transfer.style.durationMs,
    easing: transfer.style.easing,
    opacityFrom: transfer.style.opacity === 'fadeIn' ? 0 : 1,
    opacityTo: transfer.style.opacity === 'fadeOut' ? 0 : 1,
    scaleFrom: transfer.style.scale.from,
    scaleTo: transfer.style.scale.to,
    ...(transferFace === null ? {} : { faceAtLanding: transferFace }),
  });
  if (signal.aborted || motionResult) return;
  if (endpoint) await session.handoffTo(endpoint);
  else await session.finishAtLogicalZone();
};

const reserveVisibleHandDestinations = (
  host: PlayPresentationHost,
  transfers: readonly CardTransfer[],
  afterState: SeatVisibleMatchState,
): ResolvedCard[] => {
  const reserved: ResolvedCard[] = [];
  for (const transfer of transfers) {
    if (transfer.to.kind !== 'HAND' || transfer.to.owner !== host.localSeat) continue;
    const resolved = resolveCard(
      transfer.cardId,
      afterState,
      host.manifest,
      host.cardStatReadModel,
    );
    if (resolved) reserved.push(resolved);
  }
  return reserved;
};

export interface EventAnimationHooks {
  readonly onTransferAnimation?: (transfer: CardTransfer) => void;
}

/**
 * Runs only after PresentationDirector has adopted `prepared.frame.after`.
 * Aborting releases every source lease, hand reservation, surrogate, and
 * locally-owned effect cleanup created for this frame.
 */
export async function animatePreparedEvent(
  prepared: PreparedEventAnimation,
  signal: AbortSignal,
  hooks: EventAnimationHooks = {},
): Promise<void> {
  const state = preparedStates.get(prepared);
  if (!state) throw new Error('Unknown prepared event animation');
  if (state.status !== 'prepared') {
    throw new Error(`Prepared event animation is already ${state.status}`);
  }
  if (signal.aborted) {
    disposePreparedState(state, 'presentation-invalidated');
    return;
  }

  state.status = 'running';
  const onAbort = (): void => {
    disposePreparedState(state, 'presentation-invalidated');
  };
  signal.addEventListener('abort', onAbort, { once: true });
  const executionSignal = state.controller.signal;
  const { choreography, host, transfers } = state;
  const reservedHandCards = reserveVisibleHandDestinations(
    host,
    transfers,
    state.frame.after,
  );
  let completed = false;

  try {
    if (!choreography) {
      completed = true;
      return;
    }
    playSfx(host, choreography.sfx, 'on-dispatch');
    host.handSlots.reserve(reservedHandCards);
    playVfx(host, choreography);
    playSfx(host, choreography.sfx, 'after-dispatch');
    playCardLayoutSlide(state.oldRects, host.motionSurface.cardRefs);
    if (reservedHandCards.length > 0) {
      const completed = await waitFor(HAND_SLOT_RESERVE_MS, executionSignal);
      if (!completed) return;
    }

    for (const transfer of transfers) {
      if (executionSignal.aborted) return;
      hooks.onTransferAnimation?.(transfer);
      await animateOneTransfer(
        state,
        transfer,
        executionSignal,
        choreography.sfx.length === 0,
      );
    }
    if (!executionSignal.aborted) {
      playSfx(host, choreography.sfx, 'on-complete');
      completed = true;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    host.handSlots.release(reservedHandCards.map(card => card.id));
    if (executionSignal.aborted || !completed) {
      disposePreparedState(state, 'presentation-invalidated');
    } else {
      state.status = 'complete';
      state.cleanups.clear();
      state.sessions.clear();
    }
  }
}
