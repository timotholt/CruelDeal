import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { EventTransition } from '../engine/transactionTimeline';
import type { PlayScriptCtx } from '../script/actions';
import { resolveCard, type ResolvedCard } from '../view';
import { captureCardRects, playCardLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { Timeline } from '@/services/vfx/timeline';
import { describeEventChoreography, type EventChoreography, type SfxCue, type VfxCue } from './choreography';
import { HAND_SLOT_RESERVE_MS } from './handPresentation';
import { releaseHandSlots, withHandReservations } from './handReservations';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardId } from '../engine/types/ids';
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

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const deckSourceRect = (ctx: PlayScriptCtx): DOMRect => {
  if (ctx.deckEl && ctx.deckEl.isConnected) return ctx.deckEl.getBoundingClientRect();
  const b = ctx.motionSurface.frameRect();
  const w = 70;
  const h = 100;
  return new DOMRect(b.right + 20, b.bottom - h - 40, w, h);
};

export const fallbackRectForZone = (
  b: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  zone: CardZoneRef,
  remoteSeat: PlayScriptCtx['remoteSeat'],
): DOMRect => {
  const w = 70;
  const h = 100;
  if (zone.kind === 'HAND' && zone.owner === remoteSeat) {
    return new DOMRect(b.left + b.width / 2 - w / 2, b.top + 16, w, h);
  }
  return new DOMRect(b.left + b.width / 2 - w / 2, b.top + b.height / 2 - h / 2, w, h);
};

const cardIdsWithRefs = (ctx: PlayScriptCtx): string[] => [...ctx.cardRefs.keys()];

const playSfx = (ctx: PlayScriptCtx, cues: readonly SfxCue[], timing: SfxCue['timing']): void => {
  if (!ctx.sfx) return;
  for (const cue of cues) {
    if (cue.timing === timing) ctx.sfx(cue.name);
  }
};

const playVfxCue = (ctx: PlayScriptCtx, cue: VfxCue): void => {
  switch (cue.kind) {
    case 'power-flash': {
      const cardId = cue.cardId as CardId;
      const isBuff = cue.delta > 0;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_POWER_CHANGED',
        channel: 'power-pulse',
        effectKind: 'power-flash',
        className: isBuff ? 'card-vfx-power-flash card-vfx-power-flash--buff' : 'card-vfx-power-flash card-vfx-power-flash--debuff',
        vars: { '--card-fx-color': isBuff ? '#6dff9d' : '#ff5d8f' },
        durationMs: 260,
        exitDurationMs: 0,
        priority: 10,
        dedupeKey: `power-flash:${cue.cardId}`,
      });
      return;
    }

    case 'destroy-burst': {
      const cardId = cue.cardId as CardId;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'impact-shake',
        effectKind: 'destroy-shake',
        className: 'card-vfx-destroy-shake',
        vars: {},
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_DESTROYED',
        channel: 'surface-fx',
        effectKind: 'destroy-flash',
        className: 'card-vfx-destroy-flash',
        vars: { '--card-fx-color': '#ff5d8f' },
        durationMs: 260,
        priority: 20,
        dedupeKey: `destroy-flash:${cue.cardId}`,
      });
      return;
    }

    case 'glitch-flash': {
      const cardId = cue.cardId as CardId;
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'impact-shake',
        effectKind: 'glitch-shake',
        className: 'card-vfx-glitch-shake',
        vars: {},
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-shake:${cue.cardId}`,
      });
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_TRANSFORMED',
        channel: 'surface-fx',
        effectKind: 'glitch-flash',
        className: 'card-vfx-glitch-flash',
        vars: { '--card-fx-color': '#70e1f5' },
        durationMs: 240,
        priority: 15,
        dedupeKey: `glitch-flash:${cue.cardId}`,
      });
      return;
    }

    case 'move-trail': {
      const cardId = cue.cardId as CardId;
      const causeClass = cue.effectKind.toLowerCase().replaceAll('_', '-');
      cardVfxRegistry.createTransient({
        cardId,
        eventType: 'CARD_MOVED',
        channel: 'world-motion',
        effectKind: `move-trail:${cue.effectKind}:${cue.sourceId}`,
        className: `card-vfx-move-trail card-vfx-move-trail--${causeClass}`,
        vars: {
          '--card-fx-color': cue.effectKind === 'LOCATION' ? '#58c7ff' : '#b86cff',
        },
        durationMs: 420,
        exitDurationMs: 0,
        priority: 12,
        dedupeKey: `move-trail:${cue.cardId}:${cue.effectKind}:${cue.sourceId}`,
      });
      return;
    }

    case 'none':
      return;
  }
};

const playVfx = (ctx: PlayScriptCtx, choreography: EventChoreography): void => {
  for (const cue of choreography.vfx) playVfxCue(ctx, cue);
};

const rectForZone = (ctx: PlayScriptCtx, zone: CardZoneRef): DOMRect => {
  const key = zoneAnchorKey(zone);
  const registeredRect = key ? ctx.motionSurface.zoneRect(key) : null;
  if (registeredRect) return registeredRect;
  if (zone.kind === 'DECK' && zone.owner === ctx.localSeat && ctx.deckEl?.isConnected) {
    return ctx.deckEl.getBoundingClientRect();
  }
  return fallbackRectForZone(ctx.motionSurface.frameRect(), zone, ctx.remoteSeat);
};

const rectForTransferEndpoint = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  zone: CardZoneRef,
  capturedCardRects: Map<string, DOMRect>,
  endpoint: 'from' | 'to',
): { rect: DOMRect; el: HTMLElement | null; visibleCard: boolean } => {
  const isCanonicalCardZone = zone.kind === 'LANE'
    || (zone.kind === 'HAND' && zone.owner === ctx.localSeat);
  const captured = capturedCardRects.get(transfer.cardId as string);
  if (endpoint === 'from' && captured && isCanonicalCardZone) {
    return { rect: captured, el: null, visibleCard: true };
  }
  const el = isCanonicalCardZone ? ctx.cardRefs.get(transfer.cardId as string) ?? null : null;
  const registeredRect = isCanonicalCardZone
    ? ctx.motionSurface.cardRect(transfer.cardId as string)
    : null;
  if (el && registeredRect) return { rect: registeredRect, el, visibleCard: true };
  if (captured && isCanonicalCardZone) return { rect: captured, el: null, visibleCard: true };
  return { rect: rectForZone(ctx, zone), el: null, visibleCard: false };
};

type PreparedTransfer = {
  transfer: CardTransfer;
  session: CardMotionSession;
};

const shouldPrepareSourceBeforeDispatch = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
): boolean => (
  (transfer.from.kind === 'LANE'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === ctx.localSeat))
  && transfer.style.route !== 'layout-only'
  && !(transfer.from.kind === 'DECK' && transfer.to.kind === 'HAND')
);

const prepareTransferBeforeDispatch = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
): PreparedTransfer | null => {
  if (!shouldPrepareSourceBeforeDispatch(ctx, transfer)) return null;
  const source = rectForTransferEndpoint(ctx, transfer, transfer.from, capturedCardRects, 'from');
  const sourceEl = canonicalVisualElement(
    ctx.cardRefs.get(transfer.cardId as string) ?? source.el,
  );
  if (!sourceEl?.isConnected) return null;
  const snapshot = captureCardVisual(transfer.cardId, sourceEl);
  const initialFace = transfer.face === 'ownerVisible'
    ? resolveCardTransferFace(transfer.face, transfer.owner, ctx.localSeat) ?? snapshot.face
    : snapshot.face;
  const session = ctx.motionSurface.cardMotion.begin({
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

const isLocalHandEntry = (ctx: PlayScriptCtx, transfer: CardTransfer): boolean => (
  transfer.to.kind === 'HAND'
  && transfer.to.owner === ctx.localSeat
);

const basisForLogicalSource = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
): SurrogateBasis => {
  const endpoint = ctx.motionSurface.cardMotion.endpoint(transfer.cardId);
  const protectedSource = resolveCardTransferFace(
    transfer.face,
    transfer.owner,
    ctx.localSeat,
  ) === 'faceDown'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === ctx.remoteSeat)
    || (transfer.from.kind === 'DECK' && transfer.from.owner === ctx.remoteSeat)
    || (transfer.to.kind === 'HAND' && transfer.to.owner === ctx.remoteSeat);
  return protectedSource
    ? { kind: 'synthetic-back', owner: transfer.owner }
    : { kind: 'destination-clone', endpoint };
};

const animateOneTransfer = async (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
  useTransferSfx: boolean,
  prepared: PreparedTransfer | null = null,
): Promise<void> => {
  const source = rectForTransferEndpoint(ctx, transfer, transfer.from, capturedCardRects, 'from');
  const destination = rectForTransferEndpoint(ctx, transfer, transfer.to, capturedCardRects, 'to');

  if (transfer.style.route === 'anchor-to-anchor') {
    const key = zoneAnchorKey(transfer.to);
    const anchor = key ? ctx.zoneRefs?.get(key) : null;
    if (anchor) {
      const tl = new Timeline();
      tl.add(anchor, 'vfx-pop', { 'scale-start': '0.92' }, 220, 0);
      tl.play();
      await wait(240);
    }
    return;
  }

  // A reserved hand slot has already completed its sibling layout shift.
  // Release it before acquiring the session's destination lease so the lease
  // records the canonical visible value it must restore at handoff.
  if (isLocalHandEntry(ctx, transfer)) {
    releaseHandSlots(ctx, [transfer.cardId as string]);
  }

  const endpoint = transfer.to.kind === 'LANE'
    || (transfer.to.kind === 'HAND' && transfer.to.owner === ctx.localSeat)
    ? ctx.motionSurface.cardMotion.endpoint(transfer.cardId)
    : null;
  const sourceRect = transfer.from.kind === 'GENERATED'
    ? deckSourceRect(ctx)
    : source.rect;
  const transferFace = resolveCardTransferFace(
    transfer.face,
    transfer.owner,
    ctx.localSeat,
  );
  const sourceIsProtected = transferFace === 'faceDown'
    || transfer.from.kind === 'DECK'
    || (transfer.from.kind === 'HAND' && transfer.from.owner === ctx.remoteSeat)
    || (transfer.to.kind === 'HAND' && transfer.to.owner === ctx.remoteSeat);
  const session = prepared?.session ?? ctx.motionSurface.cardMotion.begin({
    cardId: transfer.cardId,
    route: `${transfer.from.kind}->${transfer.to.kind}`,
    basis: basisForLogicalSource(ctx, transfer),
    startRect: sourceRect,
    face: sourceIsProtected ? 'faceDown' : endpoint?.resolveFace() ?? 'faceUp',
    zIndex: transfer.style.zIndex,
    className: 'transfer-flyer',
  });
  if (useTransferSfx && transfer.style.sfx) ctx.sfx?.(transfer.style.sfx);

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
  if (motionResult) return;
  if (endpoint) await session.handoffTo(endpoint);
  else await session.finishAtLogicalZone();
};

const reserveVisibleHandDestinations = (
  ctx: PlayScriptCtx,
  transfers: readonly CardTransfer[],
  afterState: EngineMatchState,
): ResolvedCard[] => {
  const reserved: ResolvedCard[] = [];
  for (const transfer of transfers) {
    if (transfer.to.kind !== 'HAND' || transfer.to.owner !== ctx.localSeat) continue;
    const resolved = resolveCard(transfer.cardId, afterState, ctx.manifest);
    if (!resolved) continue;
    reserved.push(resolved);
  }
  return reserved;
};

export async function animateEvent(
  ctx: PlayScriptCtx,
  frame: EventTransition,
  dispatchPresentedFrame: () => void = () => undefined,
  hooks: {
    readonly onTransferAnimation?: (transfer: CardTransfer) => void;
  } = {},
): Promise<void> {
  const { event, before, after } = frame;
  const choreography = describeEventChoreography(event);
  playSfx(ctx, choreography.sfx, 'on-start');

  const transfers = deriveCardTransfers(before, event, after);
  if (import.meta.env.DEV) assertTransferCoverage(before, event, after, transfers);

  if (transfers.length === 0) {
    playSfx(ctx, choreography.sfx, 'on-dispatch');
    dispatchPresentedFrame();
    playVfx(ctx, choreography);
    playSfx(ctx, choreography.sfx, 'after-dispatch');
    playSfx(ctx, choreography.sfx, 'on-complete');
    return;
  }

  const oldRects = captureCardRects(cardIdsWithRefs(ctx), ctx.cardRefs);
  const preparedTransfers = new Map<CardTransfer, PreparedTransfer>();
  for (const transfer of transfers) {
    const prepared = prepareTransferBeforeDispatch(ctx, transfer, oldRects);
    if (prepared) preparedTransfers.set(transfer, prepared);
  }

  playSfx(ctx, choreography.sfx, 'on-dispatch');
  dispatchPresentedFrame();
  const reservedHandCards = reserveVisibleHandDestinations(ctx, transfers, after);

  await withHandReservations(ctx, reservedHandCards, async () => {
    playVfx(ctx, choreography);
    playSfx(ctx, choreography.sfx, 'after-dispatch');
    playCardLayoutSlide(oldRects, ctx.cardRefs);
    if (reservedHandCards.length > 0) await wait(HAND_SLOT_RESERVE_MS);

    for (const transfer of transfers) {
      hooks.onTransferAnimation?.(transfer);
      await animateOneTransfer(ctx, transfer, oldRects, choreography.sfx.length === 0, preparedTransfers.get(transfer) ?? null);
    }
  });

  playSfx(ctx, choreography.sfx, 'on-complete');
}
