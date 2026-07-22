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
import { animatePreparedEvent, prepareEventAnimation } from './eventAnimator';
import { createPlayPresentationHost, type PlayPresentationHost } from './playPresentationHost';
import { createPlayMotionSurface } from './playMotionSurface';
import { createCardVfxRegistry } from '@/services/vfx/card-effects/registry';
import { attachTestCardSurface } from '@/components/game-surfaces/testing/cardSurfaceFixture';

const drawCause = {
  sourceId: 'system:event-animator-test' as CardId,
  effectKind: 'SYSTEM',
  reason: 'TEST_DRAW',
} as const;

const registerZone = (element: HTMLElement, key: string): void => {
  element.dataset.playMotionZone = key;
};

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
    playSfx: vi.fn(),
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
      cardEl.dataset.playMotionCard = token;
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
    stagedCard.dataset.playMotionCard = token;
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
      source.dataset.playMotionCard = token;
      attachTestCardSurface(source);
      source.getBoundingClientRect = () => new DOMRect(80, 280, 70, 100);
      const handWrapper = document.createElement('div');
      handWrapper.className = 'hand-card-motion';
      handWrapper.dataset.cardId = token;
      handWrapper.dataset.playMotionCard = token;
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
      destination.dataset.playMotionCard = token;
      destination.textContent = 'PROTECTED CARD IDENTITY';
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      remoteHand.getBoundingClientRect = () => new DOMRect(180, 20, 70, 100);
      destination.getBoundingClientRect = () => new DOMRect(180, 220, 70, 100);
      boardWrap.append(boardEl, toastArea, remoteHand, overlay);
      document.body.append(boardWrap);
      registerZone(remoteHand, 'P1:hand');

      const cardRefs = new Map<string, HTMLElement>();
      const motionSurface = createPlayMotionSurface({
        frame: boardWrap,
        overlay,
        cardRefs,
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
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'HAND->LANE' && entry.kind === 'started')?.rect).toEqual({
        left: 180,
        top: 20,
        width: 70,
        height: 100,
      });
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'HAND->LANE' && entry.kind === 'motion-started')).toMatchObject({
        durationMs: 300,
        rect: { left: 180, top: 220, width: 70, height: 100 },
      });

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

  it('animates an opponent deck draw into the hidden hand as a facedown flyer', async () => {
    vi.useFakeTimers();
    try {
      const before = createInitialMatchState(
        'remote-draw-flight',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P1[0];
      const event = {
        type: 'CARD_DRAWN' as const,
        owner: 'P1' as const,
        cardId,
        cause: drawCause,
      } satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const canonicalFrame = {
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
      };
      const frame: CanonicalFrameTransition = {
        transactionId: 'remote-draw-flight:tx',
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

      const board = document.createElement('div');
      const overlay = document.createElement('div');
      const remoteDeck = document.createElement('div');
      const remoteHand = document.createElement('div');
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      remoteDeck.getBoundingClientRect = () => new DOMRect(170, 18, 28, 42);
      remoteHand.getBoundingClientRect = () => new DOMRect(210, 18, 70, 100);
      board.append(remoteDeck, remoteHand, overlay);
      document.body.append(board);
      registerZone(remoteDeck, 'P1:deck');
      registerZone(remoteHand, 'P1:hand');

      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs: new Map(),
      });
      const prepared = prepareEventAnimation(presentationHost(motionSurface), projectedFrame);
      const preparedActor = overlay.querySelector<HTMLElement>('.transfer-flyer');
      expect(preparedActor).not.toBeNull();
      expect(preparedActor?.style.left).toBe('170px');
      expect(preparedActor?.style.top).toBe('18px');
      const animation = animatePreparedEvent(prepared, new AbortController().signal);
      const surrogate = overlay.querySelector('.transfer-flyer') as HTMLElement;
      const visual = surrogate?.querySelector('.card-motion-visual') as HTMLElement | null;

      expect(surrogate).not.toBeNull();
      expect(surrogate).toBe(preparedActor);
      expect(surrogate.dataset.cardId).toBe(token);
      expect(surrogate.dataset.motionRoute).toBe('DECK->HAND');
      expect(visual?.dataset.cardMotionFace).toBe('faceDown');
      expect(visual?.querySelector('.system-card-back')).not.toBeNull();
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'DECK->HAND' && entry.kind === 'started')?.rect).toEqual({
        left: 170,
        top: 18,
        width: 28,
        height: 42,
      });
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'DECK->HAND' && entry.kind === 'motion-started')).toMatchObject({
        durationMs: 360,
        rect: { left: 210, top: 18, width: 70, height: 100 },
      });

      await vi.advanceTimersByTimeAsync(200);
      expect(overlay.querySelector('.transfer-flyer')).not.toBeNull();

      await vi.runAllTimersAsync();
      await animation;

      expect(overlay.querySelector('.transfer-flyer')).toBeNull();
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
      card.dataset.playMotionCard = token;
      attachTestCardSurface(card);
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      card.getBoundingClientRect = () => new DOMRect(60, 220, 70, 100);
      board.append(card, overlay);
      document.body.append(board);

      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs: new Map([[token, card]]),
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

  it('fails before adoption when required card-transfer anchors are missing', () => {
    vi.useFakeTimers();
    try {
      const before = createInitialMatchState(
        'missing-animation-anchors',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P1[0];
      const event = {
        type: 'CARD_DRAWN' as const,
        owner: 'P1' as const,
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
      });
      expect(() => prepareEventAnimation(presentationHost(motionSurface), frame))
        .toThrow('Required card transfer anchor P1:deck');

      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
      expect(motionSurface.cardMotion.activeLeaseCount).toBe(0);
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('animates a generated card from the authored creation anchor into its lane surface', async () => {
    vi.useFakeTimers();
    try {
      const before = createInitialMatchState(
        'generated-card-flight',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = 'generated-card-flight:drone' as CardId;
      const event = {
        type: 'CARD_CREATED' as const,
        owner: 'P0' as const,
        cardId,
        defId: 'drone',
        spawnSource: { kind: 'SYSTEM' as const },
        destination: { kind: 'LANE' as const, lane: 1 as LaneId, revealed: true },
        cause: drawCause,
      } satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const projected = projectFrame({
        transactionId: 'generated-card-flight:tx',
        index: 0,
        canonicalFrame: { frame: after.timeline.frame, scope: after.timeline.scope!, event },
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
        before,
        after,
      });
      const token = projected.event?.data.card as string;
      const board = document.createElement('div');
      const overlay = document.createElement('div');
      const generated = document.createElement('div');
      const destination = document.createElement('div');
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      generated.getBoundingClientRect = () => new DOMRect(195, 350, 40, 56);
      destination.getBoundingClientRect = () => new DOMRect(180, 180, 70, 100);
      destination.dataset.cardId = token;
      destination.dataset.playMotionCard = token;
      attachTestCardSurface(destination);
      board.append(generated, overlay);
      document.body.append(board);
      registerZone(generated, 'generated');
      const cardRefs = new Map<string, HTMLElement>();
      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs,
      });
      const prepared = prepareEventAnimation(presentationHost(motionSurface), projected);
      board.prepend(destination);
      cardRefs.set(token, destination);

      const animation = animatePreparedEvent(prepared, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(0);
      const actor = overlay.querySelector<HTMLElement>('[data-card-motion-session]');
      expect(actor).not.toBeNull();
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'GENERATED->LANE' && entry.kind === 'started')?.rect).toEqual({
        left: 195,
        top: 350,
        width: 40,
        height: 56,
      });
      expect(destination.style.visibility).toBe('hidden');
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'GENERATED->LANE' && entry.kind === 'motion-started')).toMatchObject({
        durationMs: 300,
        rect: { left: 180, top: 180, width: 70, height: 100 },
      });

      await vi.runAllTimersAsync();
      await animation;
      expect(destination.style.visibility).toBe('');
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('animates a destroyed lane card completely into the authored destroyed-zone anchor', async () => {
    vi.useFakeTimers();
    try {
      let before = createInitialMatchState(
        'destroyed-card-flight',
        BOOTSTRAP_MANIFEST,
        {},
        orderedTestLocationDeck(BOOTSTRAP_MANIFEST),
      );
      const cardId = before.deck.P0[0];
      before = apply(before, { type: 'CARD_DRAWN', owner: 'P0', cardId, cause: drawCause }, BOOTSTRAP_MANIFEST);
      before = apply(before, {
        type: 'CARD_STAGED',
        intentId: 'destroyed-card-flight:stage',
        owner: 'P0',
        cardId,
        lane: 0 as LaneId,
        energyPaid: 1,
        cause: drawCause,
      }, BOOTSTRAP_MANIFEST);
      before = apply(before, { type: 'CARD_REVEALED', cardId, cause: drawCause }, BOOTSTRAP_MANIFEST);
      const event = { type: 'CARD_DESTROYED' as const, cardId, cause: drawCause } satisfies MatchEvent;
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const projected = projectFrame({
        transactionId: 'destroyed-card-flight:tx',
        index: 0,
        canonicalFrame: { frame: after.timeline.frame, scope: after.timeline.scope!, event },
        frame: after.timeline.frame,
        scope: after.timeline.scope!,
        event,
        before,
        after,
      });
      const token = projected.event?.data.card as string;
      const board = document.createElement('div');
      const overlay = document.createElement('div');
      const source = document.createElement('div');
      const destroyed = document.createElement('div');
      board.getBoundingClientRect = () => new DOMRect(0, 0, 430, 764);
      source.getBoundingClientRect = () => new DOMRect(60, 220, 70, 100);
      destroyed.getBoundingClientRect = () => new DOMRect(390, 700, 28, 42);
      source.dataset.cardId = token;
      source.dataset.playMotionCard = token;
      attachTestCardSurface(source);
      board.append(source, destroyed, overlay);
      document.body.append(board);
      registerZone(destroyed, 'P0:destroyed');
      const cardRefs = new Map<string, HTMLElement>([[token, source]]);
      const motionSurface = createPlayMotionSurface({
        frame: board,
        overlay,
        cardRefs,
      });
      const prepared = prepareEventAnimation(presentationHost(motionSurface), projected);
      source.remove();
      cardRefs.delete(token);

      const animation = animatePreparedEvent(prepared, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(0);
      expect(motionSurface.cardMotion.diagnostics.find(entry =>
        entry.route === 'LANE->DESTROYED' && entry.kind === 'motion-started')).toMatchObject({
        durationMs: 280,
        rect: { left: 390, top: 700, width: 28, height: 42 },
      });
      await vi.advanceTimersByTimeAsync(200);
      expect(overlay.querySelector('[data-card-motion-session]')).not.toBeNull();
      await vi.runAllTimersAsync();
      await animation;
      expect(overlay.querySelector('[data-card-motion-session]')).toBeNull();
      expect(motionSurface.cardMotion.activeSessionCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
