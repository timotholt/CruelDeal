import { describe, expect, it, vi } from 'vitest';

import { apply } from '../engine/apply';
import { createInitialMatchState } from '../engine/cli/initState';
import { BOOTSTRAP_MANIFEST } from '../engine/manifest/bootstrap';
import type { EventTransition } from '../engine/transactionTimeline';
import type { PlayScriptCtx } from '../script/actions';
import type { LaneIdx } from '../engine/types/ids';
import { animateEvent, fallbackRectForZone } from './eventAnimator';

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
      let before = createInitialMatchState('moved-transfer', BOOTSTRAP_MANIFEST);
      const cardId = before.deck.P0[0].id;
      before = apply(before, {
        type: 'CARD_DRAWN',
        owner: 'P0',
        cardId,
        toHand: true,
      }, BOOTSTRAP_MANIFEST);
      before = apply(before, {
        type: 'CARD_STAGED',
        intentId: 'stage',
        owner: 'P0',
        cardId,
        lane: 0 as LaneIdx,
        cost: 1,
      }, BOOTSTRAP_MANIFEST);
      const event = {
        type: 'CARD_MOVED' as const,
        cardId,
        fromLane: 0 as LaneIdx,
        toLane: 2 as LaneIdx,
        cause: { sourceId: 'skyrail-instance' as never, effectKind: 'LOCATION' as const },
      };
      const after = apply(before, event, BOOTSTRAP_MANIFEST);
      const framedEvent = {
        frame: after.log[after.log.length - 1].frame,
        scope: after.log[after.log.length - 1].scope,
        event,
      };
      const frame: EventTransition = {
        transactionId: 'moved-transfer:tx',
        index: 0,
        framedEvent,
        frame: framedEvent.frame,
        scope: framedEvent.scope,
        event,
        before,
        after,
      };

      const boardWrap = document.createElement('div');
      const boardEl = document.createElement('div');
      const toastArea = document.createElement('div');
      const cardEl = document.createElement('div');
      cardEl.className = 'card lane-card';
      cardEl.dataset.cardId = cardId;
      cardEl.dataset.cardRestingRotation = '1.7deg';
      cardEl.style.setProperty('--card-tilt', '1.7deg');
      let adopted = false;
      boardWrap.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      boardEl.getBoundingClientRect = () => new DOMRect(0, 0, 600, 800);
      cardEl.getBoundingClientRect = () => adopted
        ? new DOMRect(430, 300, 70, 100)
        : new DOMRect(90, 300, 70, 100);
      boardWrap.append(boardEl, toastArea, cardEl);
      document.body.append(boardWrap);

      const calls: string[] = [];
      const ctx = {
        state: before,
        ui: {
          handReservations: [],
          history: [],
          isFlipped: true,
          lockedResult: null,
          showEndGamePrompt: false,
        },
        setUi: vi.fn(),
        manifest: BOOTSTRAP_MANIFEST,
        localSeat: 'P0',
        remoteSeat: 'P1',
        boardEl,
        boardWrap,
        toastArea,
        cardRefs: new Map([[cardId as string, cardEl]]),
        zoneRefs: new Map(),
        presentCommittedFrame: vi.fn(),
        finishTurnPresentation: vi.fn(),
      } as unknown as PlayScriptCtx;

      const animation = animateEvent(ctx, frame, () => {
        adopted = true;
        calls.push('adopt');
      }, {
        onTransferAnimation: (transfer) => {
          calls.push(`transfer:${transfer.reason}:${transfer.from.kind}->${transfer.to.kind}`);
        },
      });
      expect((document.querySelector('.transfer-flyer') as HTMLElement).style.transform)
        .toBe('rotate(1.7deg) scale(1)');
      await vi.advanceTimersByTimeAsync(20);
      expect((document.querySelector('.transfer-flyer') as HTMLElement).style.transform)
        .toBe('rotate(1.7deg) scale(1)');
      await vi.runAllTimersAsync();
      await animation;

      expect(calls).toEqual([
        'adopt',
        'transfer:CARD_MOVED:LANE->LANE',
      ]);
      expect(cardEl.style.visibility).toBe('');
      expect(document.querySelector('.transfer-flyer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
