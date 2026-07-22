import { captureCardRects, playCardLayoutSlide } from '@/services/vfx/animations/layout-flip';
import type {
  CanonicalCardEndpoint,
  CardMotionCancelReason,
} from './cardMotion';
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
  if (!key) throw new Error(`Card transfer zone ${zone.kind} has no authored anchor`);
  const registeredRect = host.motionSurface.zoneRect(key);
  if (!registeredRect) throw new Error(`Required card transfer anchor ${key} is unavailable`);
  return registeredRect;
};

const generatedSourceRect = (host: PlayPresentationHost): DOMRect => {
  const generated = host.motionSurface.zoneRect('generated');
  if (generated) return generated;
  throw new Error('Required generated-card transfer anchor is unavailable');
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

const wasPrivatelyPresentedStage = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
): boolean => {
  if (
    transfer.reason !== 'CARD_STAGED'
    || transfer.owner !== host.localSeat
    || transfer.to.kind !== 'LANE'
  ) return false;

  const rendered = host.cardElement(transfer.cardId as string);
  const renderedLane = rendered?.closest<HTMLElement>('[data-drop-zone="lane"]');
  return renderedLane?.dataset.laneId === String(transfer.to.lane);
};

const excludeStructurallyAnimatedCards = (
  oldRects: Map<string, DOMRect>,
  transfers: readonly CardTransfer[],
): Map<string, DOMRect> => {
  const layoutRects = new Map(oldRects);
  for (const transfer of transfers) {
    if (transfer.style.route !== 'layout-only') {
      layoutRects.delete(transfer.cardId as string);
    }
  }
  return layoutRects;
};

const currentCardElements = (
  host: PlayPresentationHost,
): Map<string, HTMLElement> => {
  const elements = new Map<string, HTMLElement>();
  for (const cardId of host.cardIds()) {
    const element = host.cardElement(cardId);
    if (element) elements.set(cardId, element);
  }
  return elements;
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
  transfer: CardTransfer,
): boolean => (
  transfer.style.route !== 'layout-only'
  && transfer.from.kind !== 'GENERATED'
  && transfer.from.kind !== 'OFFBOARD'
);

const prepareTransferBeforeAdoption = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
): PreparedTransfer | null => {
  if (!shouldPrepareSourceBeforeAdoption(transfer)) return null;
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
  if (!sourceEl?.isConnected) {
    // Hidden and pile zones are authored anchors rather than canonical card
    // surfaces. Acquire a real mounted actor at that anchor before adoption,
    // just as local hand motion captures its mounted source before adoption.
    // Its authorized identity is supplied by the adopted destination model.
    const session = host.motionSurface.cardMotion.begin({
      cardId: transfer.cardId,
      route: `${transfer.from.kind}->${transfer.to.kind}`,
      basis: { kind: 'synthetic-back' },
      startRect: source.rect,
      face: 'faceDown',
      zIndex: transfer.style.zIndex,
      className: 'transfer-flyer',
    });
    return { transfer, session };
  }
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
  const derivedTransfers = frame.event
    ? deriveCardTransfers(frame.before, frame.event, frame.after)
    : [];
  if (frame.event && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
    assertTransferCoverage(frame.before, frame.event, frame.after, derivedTransfers);
  }
  // A local private plan is already painted before its authoritative stage
  // frames arrive. Depending on when projection is materialized, that frame
  // can describe either LANE->same LANE or HAND->LANE; the live destination
  // is the final arbiter for suppressing the already-presented transfer.
  const transfers = derivedTransfers.filter(
    transfer => !wasPrivatelyPresentedStage(host, transfer),
  );

  const oldRects = excludeStructurallyAnimatedCards(
    captureCardRects(host.cardIds(), currentCardElements(host)),
    transfers,
  );
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

const canonicalDestination = (
  host: PlayPresentationHost,
  transfer: CardTransfer,
): CanonicalCardEndpoint | null => (
  transfer.to.kind === 'LANE'
  || (transfer.to.kind === 'HAND' && transfer.to.owner === host.localSeat)
    ? host.motionSurface.cardMotion.endpoint(transfer.cardId)
    : null
);

const assertCanonicalDestination = (
  transfer: CardTransfer,
  endpoint: CanonicalCardEndpoint,
): void => {
  const element = endpoint.resolveElement();
  const rect = endpoint.resolveRect();
  if (!element?.isConnected || !rect) {
    throw new Error(
      `Required canonical card destination ${String(transfer.cardId)} in ${transfer.to.kind} is unavailable`,
    );
  }
};

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
    ? { kind: 'synthetic-back' }
    : { kind: 'destination-surface', endpoint };
};

const animateOneTransfer = async (
  state: PreparedState,
  transfer: CardTransfer,
  signal: AbortSignal,
  useTransferSfx: boolean,
): Promise<void> => {
  const { host, oldRects } = state;
  if (signal.aborted) return;
  const preparedSession = state.preparedTransfers.get(transfer)?.session ?? null;
  // A source captured before adoption is the authoritative visual source for
  // this transfer. Re-resolving it after adoption is both redundant and
  // incorrect for removals: the canonical source is supposed to be gone by
  // the time a destroy/discard/banish animation runs.
  const source = preparedSession
    ? null
    : rectForTransferEndpoint(
        host,
        transfer,
        transfer.from,
        oldRects,
        'from',
      );
  if (isLocalHandEntry(host, transfer)) {
    host.handSlots.release([transfer.cardId as string]);
  }

  const endpoint = canonicalDestination(host, transfer);
  if (endpoint) assertCanonicalDestination(transfer, endpoint);
  const logicalDestination = endpoint
    ? null
    : rectForTransferEndpoint(
        host,
        transfer,
        transfer.to,
        oldRects,
        'to',
      );
  const sourceRect = transfer.from.kind === 'GENERATED'
    ? generatedSourceRect(host)
    : source?.rect;
  const transferFace = resolveCardTransferFace(
    transfer.face,
    transfer.owner,
    host.localSeat,
  );
  const sourceIsProtected = transferFace === 'faceDown'
    || transfer.from.kind === 'DECK'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === host.remoteSeat)
    || (transfer.to.kind === 'HAND' && transfer.to.owner === host.remoteSeat);
  const session = preparedSession
    ?? host.motionSurface.cardMotion.begin({
      cardId: transfer.cardId,
      route: `${transfer.from.kind}->${transfer.to.kind}`,
      basis: basisForLogicalSource(host, transfer),
      startRect: sourceRect ?? (() => {
        throw new Error(`Transfer ${transfer.reason} has no captured or authored source rect`);
      })(),
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
    rect: logicalDestination!.rect,
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
      host.content,
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
    // Reflow may run alongside the structural transfer for this frame, but it
    // is still owned by this frame. The director must not advance until both
    // the transfer and every surviving-card slide have cleaned up.
    const layoutSlide = playCardLayoutSlide(
      state.oldRects,
      currentCardElements(host),
    );
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
    await layoutSlide;
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
