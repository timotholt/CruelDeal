import { describe, expect, it, vi } from 'vitest';

import { apply } from '../engine/apply';
import { createInitialMatchState } from '../engine/cli/initState';
import { orderedTestLocationDeck } from '../engine/testkit/runtimeFixture';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import { projectMatchContentCatalog } from '../client/contentCatalog';
import type { MatchEvent } from '../engine/types/events';
import type { CanonicalFrameTransition } from '../engine/transactionTimeline';
import type { CardId, LaneId } from '../engine/types/ids';
import {
  projectAnimationEventForSeat,
  projectMatchStateForSeat,
  type SeatTransactionFrame,
} from '../runtime/projection';
import { animatePreparedEvent, fallbackRectForZone, prepareEventAnimation } from './eventAnimator';
import { createPlayPresentationHost, type PlayPresentationHost } from './playPresentationHost';
import { createPlayMotionSurface } from './playMotionSurface';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import { attachTestCardSurface } from '@/components/game-surfaces/testing/cardSurfaceFixture';

const drawCause = {
  sourceId: 'system:event-animator-test' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST_DRAW',
} as const;

const projectFrame = (frame: CanonicalFrameTransition): SeatTransactionFrame => ({
  index: frame.index,
  transactionId: frame.transactionId,
  frame: frame.frame,
  scope: frame.scope,
  event: projectAnimationEventForSeat(frame, 'P0'),
  before: projectMatchStateForSeat(frame.before, 'P0', BOOTSTRAP_MANIFEST),
  after: projectMatchStateForSeat(frame.after, 'P0', BOOTSTRAP_MANIFEST),
});

const presentationHost = (
  motionSurface: ReturnType<typeof createPlayMotionSurface>,
): PlayPresentationHost =>
  createPlayPresentationHost({
    content: projectMatchContentCatalog(BOOTSTRAP_MANIFEST),
    localSeat: 'P0',
    remoteSeat: 'P1',
    motionSurface,
    cardStatReadModel: () => null,
    cardVfxRegistry: createCardVfxRegistry(),
    handSlots: {
      reserve: vi.fn(),
      release: vi.fn(),
    },
  });

const projectedMoveFrame = (): SeatTransactionFrame => {
  let before = createInitialMatchState(
    'moved-transfer-cancellation',
    BOOTSTRAP_MANIFEST,
    {},
    orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
  );
  const cardId = before.deck.P0[0];
  before = apply(
    before,
    {
      type: 'CARD_DRAWN',
      owner: 'P0',
      cardId,
      cause: drawCause,
    },
    BOOTSTRAP_MANIFEST,
  );
  before = apply(
    before,
    {
      type: 'CARD_STAGED',
      intentId: 'stage-cancellable-move',
      owner: 'P0',
      cardId,
      lane: 0 as LaneId,
      energyPaid: 1,
      cause: drawCause,
    },
    BOOTSTRAP_MANIFEST,
  );
  const event = {
    type: 'CARD_MOVED' as const,
    cardId,
    fromLane: 0 as LaneId,
    toLane: 2 as LaneId,
    cause: drawCause,
  } satisfies MatchEvent;
  const after = apply(before, event, BOOTSTRAP_MANIFEST);
  return projectFrame({
    transactionId: 'moved-transfer-cancellation:tx',
    index: 0,
    canonicalFrame: {
      frame: after.timeline.frame,
      scope: after.timeline.scope!,
      event,
    },
    frame: after.timeline.frame,
    scope: after.timeline.scope!,
    event,
    before,
    after,
  });
};

describe('event animator transfer origins', () => {
  it('falls remote hand transfers back to the opponent hand region at board top-center', () => {
    const board = { left: 100, top: 40, width: 400, height: 700 };

    const rect = fallbackRectForZone(board, { kind: 'HAND', owner: 'P1' }, 'P1');

    expect(rect.left + rect.width / 2).toBe(board.left + board.width / 2);
    expect(rect.top).toBe(board.top + 16);
    expect(rect.top).toBeLessThan(board.top + board.height / 2);
  });

  it('keeps unrelated missing endpoints on the neutral board-center fallback', () => {
    const board = { left: 100, top: 40, width: 400, height: 700 };

    const rect = fallbackRectForZone(board, { kind: 'OFFBOARD' }, 'P1');

    expect(rect.left + rect.width / 2).toBe(board.left + board.width / 2);
    expect(rect.top + rect.height / 2).toBe(board.top + board.height / 2);
  });

  it('routes CARD_MOVED adoption through a captured card transfer animation', async () => {
    vi.useFakeTimers();
    try {
      let before = createInitialMatchState(
        'moved-transfer',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P0[0];
      before = apply(
        before,
        {
          type: 'CARD_DRAWN',
          owner: 'P0',
          cardId,
          cause: drawCause,
        },
        BOOTSTRAP_MANIFEST,
      );
      before = apply(
        before,
        {
          type: 'CARD_STAGED',
          intentId: 'stage',
          owner: 'P0',
          cardId,
          lane: 0 as LaneId,
          energyPaid: 1,
          cause: {
            sourceId: 'system:moved-transfer-test' as CardId,
            effectKind: 'SYSTEM',
            reason: 'TEST_STAGE',
          },
        },
        BOOTSTRAP_MANIFEST,
      );
      const event = {
        type: 'CARD_MOVED' as const,
        cardId,
        fromLane: 0 as LaneId,
        toLane: 2 as LaneId,
        cause: {
          sourceId: 'skyrail-instance' as import('../engine/types/ids').LocationCardInstanceId,
          effectKind: 'LOCATION',
          reason: 'TEST',
        },
      } as const satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const canonicalFrame = {
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
      };
      const frame: CanonicalFrameTransition = {
        transactionId: 'moved-transfer:tx',
        index: 0,
        canonicalFrame,
        frame: canonicalFrame.frame,
        scope: canonicalFrame.scope,
        event,
        before,
        after,
      };
      const projectedFrame = projectFrame(frame);
      const token = projectedFrame.event?.data.card as string;

      const boardWrap = document.createElement('div');
      const boardEl = document.createElement('div');
      const overlay = document.createElement('div');
      const toastArea = document.createElement('div');
      const cardEl = document.createElement('div');
      cardEl.className = 'card lane-card';
      cardEl.dataset.cardId = token;
      cardEl.dataset.cardRestingRotation = '1.7deg';
      cardEl.style.setProperty('--card-tilt', '1.7deg');
      attachTestCardSurface(cardEl);
      let adopted = false;
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      boardEl.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      cardEl.getBoundingClientRect = () =>
        adopted ? new DOMRect(430, 300, 70, 100) : new DOMRect(90, 300, 70, 100);
      boardWrap.append(boardEl, toastArea, cardEl, overlay);
      document.body.append(boardWrap);

      const calls: string[] = [];
      const cardRefs = new Map([[token, cardEl]]);
      const motionSurface = createPlayMotionSurface({
        frame: boardWrap,
        overlay,
        cardRefs,
        zoneRefs: new Map(),
      });
      const host = presentationHost(motionSurface);
      const prepared = prepareEventAnimation(host, projectedFrame);
      adopted = true;
      calls.push('adopt');
      const animation = animatePreparedEvent(prepared, new AbortController().signal, {
        onTransferAnimation: transfer => {
          calls.push(`transfer:${transfer.reason}:${transfer.from.kind}->${transfer.to.kind}`);
        },
      });
      const transferSession = document.querySelector('.transfer-flyer') as HTMLElement;
      expect(cardEl.style.translate).toBe('');
      expect(transferSession.dataset.cardMotionSession).toBeTruthy();
      expect(transferSession.style.transform).toBe('');
      expect(
        (transferSession.querySelector('.card-motion-resting-shell') as HTMLElement).style
          .transform,
      ).toBe('rotate(1.7deg)');
      await vi.advanceTimersByTimeAsync(20);
      expect(document.querySelectorAll('.transfer-flyer')).toHaveLength(1);
      await vi.runAllTimersAsync();
      await animation;

      expect(calls).toEqual(['adopt', 'transfer:CARD_MOVED:LANE->LANE']);
      expect(cardEl.style.visibility).toBe('');
      expect(document.querySelector('.transfer-flyer')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not replay a local private stage when end turn commits it', () => {
    let before = createInitialMatchState(
      'private-stage-deduplication',
      BOOTSTRAP_MANIFEST,
      {},
      orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
    );
    const cardId = before.deck.P0[0];
    before = apply(
      before,
      {
        type: 'CARD_DRAWN',
        owner: 'P0',
        cardId,
        cause: drawCause,
      },
      BOOTSTRAP_MANIFEST,
    );
    const event = {
      type: 'CARD_STAGED' as const,
      intentId: 'private-stage-deduplication',
      owner: 'P0' as const,
      cardId,
      lane: 0 as LaneId,
      energyPaid: 1,
      cause: drawCause,
    } satisfies MatchEvent;
    const after = apply(before, event, BOOTSTRAP_MANIFEST);
    const projectedFrame = projectFrame({
      transactionId: 'private-stage-deduplication:tx',
      index: 0,
      canonicalFrame: {
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
      },
      frame: after.timeline.frame,
      scope: after.timeline.scope!,
      event,
      before,
      after,
    });
    const token = projectedFrame.event?.data.card as string;
    const board = document.createElement('div');
    const overlay = document.createElement('div');
    const lane = document.createElement('div');
    const stagedCard = document.createElement('div');
    lane.dataset.dropZone = 'lane';
    lane.dataset.laneId = '0';
    stagedCard.className = 'card lane-card facedown';
    stagedCard.dataset.cardId = token;
    stagedCard.dataset.dragSource = 'lane';
    stagedCard.getBoundingClientRect = () => new DOMRect(160, 300, 70, 100);
    board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
    lane.append(stagedCard);
    board.append(lane, overlay);
    document.body.append(board);
    const motionSurface = createPlayMotionSurface({
      frame: board,
      overlay,
      cardRefs: new Map([[token, stagedCard]]),
      zoneRefs: new Map(),
    });

    const prepared = prepareEventAnimation(presentationHost(motionSurface), projectedFrame);

    expect(prepared.transfers).toEqual([]);
    expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
  });

  it('keeps a revealed local card face-up throughout a Leon-style lane-to-hand return', async () => {
    vi.useFakeTimers();
    try {
      let before = createInitialMatchState(
        'leon-return-facing',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P0[0];
      before = apply(
        before,
        {
          type: 'CARD_DRAWN',
          owner: 'P0',
          cardId,
          cause: drawCause,
        },
        BOOTSTRAP_MANIFEST,
      );
      before = apply(
        before,
        {
          type: 'CARD_STAGED',
          intentId: 'stage-leon',
          owner: 'P0',
          cardId,
          lane: 0 as LaneId,
          energyPaid: 1,
          cause: {
            sourceId: 'system:leon-return-test' as CardId,
            effectKind: 'SYSTEM',
            reason: 'TEST_STAGE',
          },
        },
        BOOTSTRAP_MANIFEST,
      );
      before = apply(
        before,
        {
          type: 'CARD_REVEALED',
          cardId,
          cause: {
            sourceId: cardId,
            effectKind: 'SYSTEM',
            reason: 'TEST_REVEAL',
          },
        },
        BOOTSTRAP_MANIFEST,
      );
      const event = {
        type: 'CARD_ZONE_CHANGED',
        cardId,
        destination: { kind: 'HAND' },
        cause: {
          sourceId: cardId,
          effectKind: 'ON_REVEAL',
          reason: 'LEON_RETURN_TEST',
        },
      } as const satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const canonicalFrame = {
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
      };
      const frame: CanonicalFrameTransition = {
        transactionId: 'leon-return-facing:tx',
        index: 0,
        canonicalFrame,
        frame: canonicalFrame.frame,
        scope: canonicalFrame.scope,
        event,
        before,
        after,
      };
      const projectedFrame = projectFrame(frame);
      const token = projectedFrame.event?.data.card as string;

      const boardWrap = document.createElement('div');
      const boardEl = document.createElement('div');
      const overlay = document.createElement('div');
      const toastArea = document.createElement('div');
      const source = document.createElement('div');
      source.className = 'card lane-card facedown';
      source.dataset.cardId = token;
      attachTestCardSurface(source);
      source.getBoundingClientRect = () => new DOMRect(80, 280, 70, 100);
      const handWrapper = document.createElement('div');
      handWrapper.className = 'hand-card-motion';
      handWrapper.dataset.cardId = token;
      const destination = document.createElement('div');
      destination.className = 'card';
      destination.dataset.cardId = token;
      attachTestCardSurface(destination);
      destination.getBoundingClientRect = () => new DOMRect(180, 620, 70, 100);
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      boardEl.append(source);
      boardWrap.append(boardEl, toastArea, overlay);
      document.body.append(boardWrap);

      const cardRefs = new Map<string, HTMLElement>([[token, source]]);
      const motionSurface = createPlayMotionSurface({
        frame: boardWrap,
        overlay,
        cardRefs,
        zoneRefs: new Map(),
      });
      const host = presentationHost(motionSurface);
      const prepared = prepareEventAnimation(host, projectedFrame);
      source.remove();
      handWrapper.append(destination);
      boardEl.append(handWrapper);
      cardRefs.set(token, handWrapper);
      const animation = animatePreparedEvent(prepared, new AbortController().signal);

      const surrogate = overlay.querySelector('.transfer-flyer') as HTMLElement;
      const surrogateVisual = surrogate.querySelector('.card-motion-visual') as HTMLElement;
      expect(surrogateVisual.dataset.cardMotionFace).toBe('faceUp');
      expect(surrogateVisual.classList.contains('facedown')).toBe(false);

      await vi.runAllTimersAsync();
      await animation;

      expect(destination.style.visibility).toBe('');
      expect(overlay.querySelector('.transfer-flyer')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hands a protected remote play to its facedown destination without a landing flash', async () => {
    vi.useFakeTimers();
    try {
      let before = createInitialMatchState(
        'remote-stage-handoff',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P1[0];
      before = apply(
        before,
        {
          type: 'CARD_DRAWN',
          owner: 'P1',
          cardId,
          cause: drawCause,
        },
        BOOTSTRAP_MANIFEST,
      );
      const event = {
        type: 'CARD_STAGED' as const,
        intentId: 'remote-stage',
        owner: 'P1' as const,
        cardId,
        lane: 1 as LaneId,
        energyPaid: 1,
        cause: {
          sourceId: 'system:remote-stage-test' as CardId,
          effectKind: 'SYSTEM' as const,
          reason: 'TEST_STAGE',
        },
      };
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const canonicalFrame = {
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
      };
      const frame: CanonicalFrameTransition = {
        transactionId: 'remote-stage-handoff:tx',
        index: 0,
        canonicalFrame,
        frame: canonicalFrame.frame,
        scope: canonicalFrame.scope,
        event,
        before,
        after,
      };
      const projectedFrame = projectFrame(frame);
      const token = projectedFrame.event?.data.card as string;

      const boardWrap = document.createElement('div');
      const boardEl = document.createElement('div');
      const overlay = document.createElement('div');
      const toastArea = document.createElement('div');
      const remoteHand = document.createElement('div');
      const destination = document.createElement('div');
      destination.className = 'card lane-card enemy facedown pending';
      destination.dataset.cardId = token;
      destination.textContent = 'PROTECTED CARD IDENTITY';
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      remoteHand.getBoundingClientRect = () => new DOMRect(180, 20, 70, 100);
      destination.getBoundingClientRect = () => new DOMRect(180, 220, 70, 100);
      boardWrap.append(boardEl, toastArea, remoteHand, overlay);
      document.body.append(boardWrap);

      const cardRefs = new Map<string, HTMLElement>();
      const zoneRefs = new Map([['P1:hand' as const, remoteHand]]);
      const motionSurface = createPlayMotionSurface({
        frame: boardWrap,
        overlay,
        cardRefs,
        zoneRefs,
      });
      const host = presentationHost(motionSurface);
      const prepared = prepareEventAnimation(host, projectedFrame);
      boardEl.append(destination);
      cardRefs.set(token, destination);
      const animation = animatePreparedEvent(prepared, new AbortController().signal);
      const surrogate = overlay.querySelector('[data-card-motion-session]') as HTMLElement;
      expect(surrogate).not.toBeNull();
      expect(surrogate.querySelector('.system-card-back')).not.toBeNull();
      expect(surrogate.textContent).not.toContain('PROTECTED CARD IDENTITY');
      expect(destination.style.visibility).toBe('hidden');
      expect(destination.classList.contains('vfx-pop')).toBe(false);

      await vi.advanceTimersByTimeAsync(300);
      expect(surrogate.isConnected).toBe(true);
      expect(destination.style.visibility).toBe('hidden');

      await vi.runAllTimersAsync();
      await animation;
      expect(destination.style.visibility).toBe('');
      expect(destination.classList.contains('vfx-pop')).toBe(false);
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a prepared source lease and surrogate when presentation is aborted', async () => {
    vi.useFakeTimers();
    try {
      const frame = projectedMoveFrame();
      const token = frame.event?.data.card as string;
      const board = document.createElement('div');
      const overlay = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'card lane-card';
      card.dataset.cardId = token;
      attachTestCardSurface(card);
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      card.getBoundingClientRect = () => new DOMRect(60, 220, 70, 100);
      board.append(card, overlay);
      document.body.append(board);

      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs: new Map([[token, card]]),
        zoneRefs: new Map(),
      });
      const prepared = prepareEventAnimation(presentationHost(motionSurface), frame);
      expect(motionSurface.cardMotion.activeSessionCount).toBe(1);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(1);
      expect(overlay.querySelector('[data-card-motion-session]')).not.toBeNull();

      const controller = new AbortController();
      const animation = animatePreparedEvent(prepared, controller.signal);
      controller.abort('test-fast-forward');
      await animation;

      expect(prepared.disposed).toBe(true);
      expect(card.style.visibility).toBe('');
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('recovers safely when card and zone anchors are all missing', async () => {
    vi.useFakeTimers();
    try {
      const before = createInitialMatchState(
        'missing-animation-anchors',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P0[0];
      const event = {
        type: 'CARD_DRAWN' as const,
        owner: 'P0' as const,
        cardId,
        cause: drawCause,
      } satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const frame = projectFrame({
        transactionId: 'missing-animation-anchors:tx',
        index: 0,
        canonicalFrame: {
          frame: after.timeline.frame,
          scope: after.timeline.scope!,
          event,
        },
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
        before,
        after,
      });
      const board = document.createElement('div');
      const overlay = document.createElement('div');
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      board.append(overlay);
      document.body.append(board);
      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs: new Map(),
        zoneRefs: new Map(),
      });
      const prepared = prepareEventAnimation(presentationHost(motionSurface), frame);

      const animation = animatePreparedEvent(prepared, new AbortController().signal);
      await vi.runAllTimersAsync();
      await expect(animation).resolves.toBeUndefined();

      expect(prepared.disposed).toBe(false);
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
