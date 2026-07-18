import type { MatchState as EngineMatchState } from '../engine/types/state';
import type { EventTransition } from '../engine/transactionTimeline';
import type { PlayScriptCtx } from '../script/actions';
import { resolveCard, type ResolvedCard } from '../view';
import { slideFromDeckToHand } from '@/services/vfx/animations/slide-from-deck';
import { captureCardRects, playCardLayoutSlide } from '@/services/vfx/animations/layout-flip';
import {
  cardRestingRotationDegrees,
  composeCardFlightTransform,
} from '@/services/vfx/animations/card-resting-transform';
import { Timeline } from '@/services/vfx/timeline';
import { describeEventChoreography, type EventChoreography, type SfxCue, type VfxCue } from './choreography';
import { HAND_SLOT_RESERVE_MS } from './handPresentation';
import { withHandReservations } from './handReservations';
import { cardVfxRegistry } from '@/services/vfx/card-effects/registry';
import type { CardId } from '../engine/types/ids';
import {
  assertTransferCoverage,
  deriveCardTransfers,
  isVisibleZone,
  zoneAnchorKey,
  type CardTransfer,
  type CardZoneRef,
} from './cardTransfers';

const nextFrame = (timeoutMs = 100): Promise<void> => new Promise((resolve) => {
  let settled = false;
  let frameId: number | undefined;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    if (frameId !== undefined) cancelAnimationFrame(frameId);
    resolve();
  };
  const timeoutId = setTimeout(finish, timeoutMs);
  try {
    frameId = requestAnimationFrame(finish);
  } catch {
    finish();
  }
});
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const deckSourceRect = (ctx: PlayScriptCtx): DOMRect => {
  if (ctx.deckEl && ctx.deckEl.isConnected) return ctx.deckEl.getBoundingClientRect();
  const b = ctx.boardEl.getBoundingClientRect();
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

const cloneCurrentCardElements = (ctx: PlayScriptCtx): Map<string, HTMLElement> => {
  const clones = new Map<string, HTMLElement>();
  for (const [id, el] of ctx.cardRefs) {
    if (el.isConnected) clones.set(id, el.cloneNode(true) as HTMLElement);
  }
  return clones;
};

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
  const el = key ? ctx.zoneRefs?.get(key) : null;
  if (el && el.isConnected) return el.getBoundingClientRect();
  if (zone.kind === 'DECK' && zone.owner === ctx.localSeat && ctx.deckEl?.isConnected) {
    return ctx.deckEl.getBoundingClientRect();
  }
  return fallbackRectForZone(ctx.boardEl.getBoundingClientRect(), zone, ctx.remoteSeat);
};

const rectForTransferEndpoint = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  zone: CardZoneRef,
  capturedCardRects: Map<string, DOMRect>,
  endpoint: 'from' | 'to',
): { rect: DOMRect; el: HTMLElement | null; visibleCard: boolean } => {
  const captured = capturedCardRects.get(transfer.cardId as string);
  if (endpoint === 'from' && captured && isVisibleZone(zone)) {
    return { rect: captured, el: null, visibleCard: true };
  }
  const el = isVisibleZone(zone) ? ctx.cardRefs.get(transfer.cardId as string) ?? null : null;
  if (el && el.isConnected) return { rect: el.getBoundingClientRect(), el, visibleCard: true };
  if (captured && isVisibleZone(zone)) return { rect: captured, el: null, visibleCard: true };
  return { rect: rectForZone(ctx, zone), el: null, visibleCard: false };
};

const cloneForTransfer = (
  transfer: CardTransfer,
  sourceEl: HTMLElement | null,
  destinationEl: HTMLElement | null,
): HTMLElement => {
  const basis = sourceEl ?? destinationEl;
  const flyer = basis
    ? (basis.cloneNode(true) as HTMLElement)
    : document.createElement('div');
  if (!basis) flyer.className = 'card transfer-flyer-card facedown';
  flyer.classList.add('transfer-flyer');
  flyer.removeAttribute('ref');
  flyer.removeAttribute('draggable');
  flyer.style.pointerEvents = 'none';
  flyer.style.position = 'absolute';
  flyer.style.margin = '0';
  flyer.style.zIndex = String(transfer.style.zIndex);
  flyer.style.willChange = 'left, top, width, height, transform, opacity';
  if (transfer.face === 'faceDown') flyer.classList.add('facedown');
  return flyer;
};

type PreparedTransfer = {
  transfer: CardTransfer;
  flyer: HTMLElement;
  sourceRect: DOMRect;
  sourceEl: HTMLElement | null;
  sourceVisibility: string | null;
  sourceRotationDegrees: number;
};

const placeFlyerAtRect = (ctx: PlayScriptCtx, flyer: HTMLElement, rect: DOMRect): void => {
  const boardRect = ctx.boardWrap.getBoundingClientRect();
  flyer.style.left = rect.left - boardRect.left + 'px';
  flyer.style.top = rect.top - boardRect.top + 'px';
  flyer.style.width = rect.width + 'px';
  flyer.style.height = rect.height + 'px';
};

const shouldPrepareSourceBeforeDispatch = (transfer: CardTransfer): boolean => (
  isVisibleZone(transfer.from)
  && transfer.style.route !== 'layout-only'
  && !(transfer.from.kind === 'DECK' && transfer.to.kind === 'HAND')
);

const prepareTransferBeforeDispatch = (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
  capturedCardClones: Map<string, HTMLElement>,
): PreparedTransfer | null => {
  if (!shouldPrepareSourceBeforeDispatch(transfer)) return null;
  const source = rectForTransferEndpoint(ctx, transfer, transfer.from, capturedCardRects, 'from');
  const sourceEl = ctx.cardRefs.get(transfer.cardId as string) ?? source.el;
  const flyer = cloneForTransfer(transfer, capturedCardClones.get(transfer.cardId as string) ?? sourceEl ?? null, null);
  const sourceRotationDegrees = cardRestingRotationDegrees(sourceEl);
  flyer.style.opacity = transfer.style.opacity === 'fadeIn' ? '0' : '1';
  flyer.style.transform = composeCardFlightTransform(
    flyer,
    sourceRotationDegrees,
    null,
    String(transfer.style.scale.from),
  );
  placeFlyerAtRect(ctx, flyer, source.rect);
  ctx.boardWrap.appendChild(flyer);

  const sourceVisibility = sourceEl?.style.visibility ?? null;
  if (sourceEl) sourceEl.style.visibility = 'hidden';

  return { transfer, flyer, sourceRect: source.rect, sourceEl, sourceVisibility, sourceRotationDegrees };
};

const restorePreparedSource = (prepared: PreparedTransfer | null): void => {
  if (!prepared?.sourceEl?.isConnected) return;
  prepared.sourceEl.style.visibility = prepared.sourceVisibility ?? '';
};

const isLocalHandEntryOverride = (ctx: PlayScriptCtx, transfer: CardTransfer): boolean => (
  transfer.to.kind === 'HAND'
  && transfer.to.owner === ctx.localSeat
  && (transfer.from.kind === 'DECK' || transfer.from.kind === 'GENERATED')
);

const animateOneTransfer = async (
  ctx: PlayScriptCtx,
  transfer: CardTransfer,
  capturedCardRects: Map<string, DOMRect>,
  capturedCardClones: Map<string, HTMLElement>,
  useTransferSfx: boolean,
  prepared: PreparedTransfer | null = null,
): Promise<void> => {
  if (isLocalHandEntryOverride(ctx, transfer)) {
    const startRect = transfer.from.kind === 'DECK' ? rectForZone(ctx, transfer.from) : deckSourceRect(ctx);
    await slideFromDeckToHand({
      cardId: transfer.cardId as string,
      startRect,
      cardElMap: ctx.cardRefs,
      boardWrap: ctx.boardWrap,
      sfx: useTransferSfx ? ctx.sfx : undefined,
    });
    return;
  }

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

  const destinationVisibility = destination.el?.style.visibility;
  if (destination.el) destination.el.style.visibility = 'hidden';

  const boardRect = ctx.boardWrap.getBoundingClientRect();
  const flyer = prepared?.flyer ?? cloneForTransfer(transfer, capturedCardClones.get(transfer.cardId as string) ?? source.el, destination.el);
  const sourceRotationDegrees = prepared?.sourceRotationDegrees
    ?? cardRestingRotationDegrees(source.el);
  const destinationRotationDegrees = cardRestingRotationDegrees(destination.el);
  if (!prepared) {
    placeFlyerAtRect(ctx, flyer, source.rect);
    flyer.style.opacity = transfer.style.opacity === 'fadeIn' ? '0' : '1';
    flyer.style.transform = composeCardFlightTransform(
      flyer,
      sourceRotationDegrees,
      null,
      String(transfer.style.scale.from),
    );
    ctx.boardWrap.appendChild(flyer);
  }

  if (useTransferSfx && transfer.style.sfx) ctx.sfx?.(transfer.style.sfx);

  await nextFrame();
  flyer.style.transition = [
    `left ${transfer.style.durationMs}ms ${transfer.style.easing}`,
    `top ${transfer.style.durationMs}ms ${transfer.style.easing}`,
    `width ${transfer.style.durationMs}ms ${transfer.style.easing}`,
    `height ${transfer.style.durationMs}ms ${transfer.style.easing}`,
    `transform ${transfer.style.durationMs}ms ${transfer.style.easing}`,
    `opacity ${transfer.style.durationMs}ms ${transfer.style.easing}`,
  ].join(', ');
  flyer.style.left = destination.rect.left - boardRect.left + 'px';
  flyer.style.top = destination.rect.top - boardRect.top + 'px';
  flyer.style.width = destination.rect.width + 'px';
  flyer.style.height = destination.rect.height + 'px';
  flyer.style.transform = composeCardFlightTransform(
    flyer,
    destinationRotationDegrees,
    null,
    String(transfer.style.scale.to),
  );
  flyer.style.opacity = transfer.style.opacity === 'fadeOut' ? '0' : '1';

  await wait(transfer.style.durationMs + 30);
  flyer.remove();
  if (destination.el) destination.el.style.visibility = destinationVisibility ?? '';
  restorePreparedSource(prepared);

  if (destination.el && isVisibleZone(transfer.to)) {
    const tl = new Timeline();
    tl.add(destination.el, 'vfx-pop', { 'scale-start': '0.88' }, 180, 0);
    tl.play();
    await wait(200);
  }
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
  const oldClones = cloneCurrentCardElements(ctx);
  const preparedTransfers = new Map<CardTransfer, PreparedTransfer>();
  for (const transfer of transfers) {
    const prepared = prepareTransferBeforeDispatch(ctx, transfer, oldRects, oldClones);
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
      await animateOneTransfer(ctx, transfer, oldRects, oldClones, choreography.sfx.length === 0, preparedTransfers.get(transfer) ?? null);
    }
  });

  playSfx(ctx, choreography.sfx, 'on-complete');
}
