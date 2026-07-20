import { createEffect, createMemo, createRenderEffect, createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayGameProvider, usePlayGame, type PlayGameContextValue } from './PlayGameContext';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { CardId, LaneId } from '@/services/playgame/engine/types/ids';
import { locationCardAtLane } from '@/services/playgame/engine/laneTopology';
import { MatchSession } from '@/services/playgame/runtime/matchSession';
import {
  paceCommittedOpening,
  type PlayScriptCtx,
} from '@/services/playgame/script/actions';
import { getHandForSeat } from '@/services/playgame/view';
import { selectInteractiveHand } from '@/components/screens/play/handInteractivity';
import { getCardCost, getCardRuntime } from '@/services/playgame/engine/projections';
import { createPlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';

const disposers: Array<() => void> = [];

afterEach(() => {
  vi.useRealTimers();
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function debugSession(seed = 'provider-1') {
  const candidate = buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  );
  return MatchSession.fromBootstrap(candidate);
}

function firstPlayableCard(pg: PlayGameContextValue): CardId {
  const state = pg.engineState();
  const card = state.hand[pg.localSeat].find(
    (candidate) => getCardCost(state, candidate, BOOTSTRAP_MANIFEST)
      <= state.energy[pg.localSeat],
  );
  if (!card) throw new Error('fixture has no playable local card');
  return card;
}

function stagedCardIds(pg: PlayGameContextValue): CardId[] {
  return pg.engineState().stagedPlays.map(staged => staged.cardId);
}

function presentOpeningImmediately(pg: PlayGameContextValue): void {
  for (const frame of pg.openingTimeline.transitions) {
    pg.actions.presentCommittedFrame(frame);
  }
}

function firstLocationRevealed(pg: PlayGameContextValue): boolean {
  return locationCardAtLane(pg.engineState(), 0)?.face === 'FACE_UP';
}

describe('PlayGameProvider runtime synchronization', () => {
  it('mounts the completed three-lane setup and presents the real opening deal', () => {
    let pg!: PlayGameContextValue;

    const Probe = () => {
      const context = usePlayGame();
      onMount(() => { pg = context; });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider session={debugSession('provider-opening-boundary')}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    expect(pg.engineState().activeLaneOrder).toEqual([0, 1, 2]);
    expect(pg.engineState().hand[pg.localSeat]).toHaveLength(0);
    expect(pg.openingTimeline.transitions[0]?.event.type).toBe('CARD_DRAWN');
    expect(pg.openingTimeline.transitions.some(
      ({ event }) => event.type === 'LANE_CREATED',
    )).toBe(false);

    presentOpeningImmediately(pg);
    expect(pg.engineState().hand[pg.localSeat]).toHaveLength(4);
    expect(pg.engineState().deck[pg.localSeat]).toHaveLength(8);
  });

  it('notifies Solid observers after accepted stage, unstage, and end-turn projections', async () => {
    let pg!: PlayGameContextValue;
    const observed: string[] = [];

    const Probe = () => {
      const context = usePlayGame();
      const [replayEnabled] = createSignal(false);
      const replayFrame = createMemo(() => replayEnabled() ? context.engineState() : null);
      const presentedState = createMemo(() => replayFrame() ?? context.engineState());
      onMount(() => { pg = context; });
      createEffect(() => {
        const state = presentedState();
        observed.push(JSON.stringify({
          turn: state.turn,
          phase: state.phase,
          energy: state.energy[context.localSeat],
          stagedCardIds: state.stagedPlays.map(staged => staged.cardId),
          hand: [...state.hand[context.localSeat]],
          lanes: state.activeLaneOrder.map(
            (laneId) => [...state.lanesById[laneId].cards[context.localSeat]],
          ),
        }));
      });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider session={debugSession()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));
    presentOpeningImmediately(pg);

    const stageAndExpectObservation = async (label: string) => {
      const cardId = firstPlayableCard(pg);
      const cost = getCardCost(pg.engineState(), cardId, BOOTSTRAP_MANIFEST);
      const energyBefore = pg.engineState().energy[pg.localSeat];
      const observationsBefore = observed.length;

      await expect(pg.actions.stageCardInLane(cardId, 0 as LaneId)).resolves.toBe(true);

      expect(stagedCardIds(pg), `${label}: store projection`).toContain(cardId);
      expect(pg.engineState().energy[pg.localSeat]).toBe(energyBefore - cost);
      expect(observed.length, `${label}: reactive notification`).toBeGreaterThan(observationsBefore);
      const lastObservation = JSON.parse(observed.at(-1)!);
      expect(lastObservation.stagedCardIds).toContain(cardId);
      expect(lastObservation.hand).not.toContain(cardId);
      expect(lastObservation.lanes.flat()).toContain(cardId);
      expect(lastObservation.energy).toBe(energyBefore - cost);
      return cardId;
    };

    const turnOneCard = await stageAndExpectObservation('turn 1 stage');
    const beforeUndoObservations = observed.length;
    await expect(pg.actions.undoPendingCard(turnOneCard)).resolves.toBe(true);
    expect(stagedCardIds(pg)).not.toContain(turnOneCard);
    expect(observed.length, 'unstage reactive notification').toBeGreaterThan(beforeUndoObservations);
    expect(JSON.parse(observed.at(-1)!).stagedCardIds).not.toContain(turnOneCard);

    await expect(pg.actions.stageCardInLane(turnOneCard, 0 as LaneId)).resolves.toBe(true);
    const beforeEndTurnObservations = observed.length;
    const timeline = await pg.actions.endTurn();
    expect(timeline).not.toBeNull();
    expect(pg.engineState().turn, 'display does not snap before presentation').toBe(1);
    expect(stagedCardIds(pg), 'staged projection survives the system commit')
      .toContain(turnOneCard);
    expect(pg.engineState().lanesById[0].cards[pg.localSeat]).toContain(turnOneCard);
    for (const frame of timeline?.transitions ?? []) pg.actions.presentCommittedFrame(frame);
    expect(pg.engineState().turn).toBe(2);
    expect(stagedCardIds(pg)).toHaveLength(0);
    expect(observed.length, 'end-turn reactive notification').toBeGreaterThan(beforeEndTurnObservations);
    expect(JSON.parse(observed.at(-1)!).turn).toBe(2);
    pg.actions.finishTurnPresentation();

    await stageAndExpectObservation('turn 2 stage');
  });

  it('keeps a private staged card visible when a committed fold is adopted', async () => {
    let pg!: PlayGameContextValue;

    const Probe = () => {
      onMount(() => { pg = usePlayGame(); });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider session={debugSession()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    presentOpeningImmediately(pg);
    const cardId = firstPlayableCard(pg);
    await expect(pg.actions.stageCardInLane(cardId, 0)).resolves.toBe(true);
    expect(pg.engineState().hand[pg.localSeat]).not.toContain(cardId);
    expect(pg.engineState().lanesById[0].cards[pg.localSeat]).toContain(cardId);

    const committedFinalFrame = pg.openingTimeline.transitions.at(-1);
    if (!committedFinalFrame) throw new Error('opening timeline has no final frame');
    pg.actions.presentCommittedFrame(committedFinalFrame);

    expect(stagedCardIds(pg)).toContain(cardId);
    expect(pg.engineState().hand[pg.localSeat]).not.toContain(cardId);
    expect(pg.engineState().lanesById[0].cards[pg.localSeat]).toContain(cardId);
  });

  it('locks every staged card face-down at resolution start, then presents reveals in frame order', async () => {
    let pg!: PlayGameContextValue;
    const facingObservations: Array<{ phase: string; locked: boolean }> = [];

    const Probe = () => {
      const context = usePlayGame();
      onMount(() => { pg = context; });
      createRenderEffect(() => {
        facingObservations.push({
          phase: context.engineState().phase,
          locked: context.ui.isFlipped,
        });
      });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider session={debugSession('lock-0')}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    presentOpeningImmediately(pg);
    const localCardId = firstPlayableCard(pg);
    await expect(pg.actions.stageCardInLane(localCardId, 0)).resolves.toBe(true);
    const timeline = await pg.actions.endTurn();
    if (!timeline) throw new Error('END_TURN did not commit a resolution timeline');

    const resolutionStartIndex = timeline.transitions.findIndex(
      (frame) => frame.event.type === 'TURN_RESOLUTION_STARTED',
    );
    expect(resolutionStartIndex).toBeGreaterThanOrEqual(0);
    const resolutionStart = timeline.transitions[resolutionStartIndex]!;

    const observationsBeforeLock = facingObservations.length;
    pg.actions.presentCommittedFrame(resolutionStart);
    const lockObservations = facingObservations.slice(observationsBeforeLock);

    const stagedIds = stagedCardIds(pg);
    expect(stagedIds).toContain(localCardId);
    expect(new Set(stagedIds.map((id) =>
      getCardRuntime(pg.engineState(), id, BOOTSTRAP_MANIFEST)?.owner)))
      .toEqual(new Set(['P0', 'P1']));
    expect(pg.ui.isFlipped, 'local owner-facing presentation lock').toBe(true);
    expect(lockObservations).toEqual([{ phase: 'RESOLVING', locked: true }]);
    expect(stagedIds.every((id) =>
      getCardRuntime(pg.engineState(), id, BOOTSTRAP_MANIFEST)?.revealed === false))
      .toBe(true);

    const revealFrames = timeline.transitions
      .slice(resolutionStartIndex + 1)
      .filter((frame) => frame.event.type === 'CARD_REVEALED');
    const expectedRevealOrder = revealFrames.map((frame) => {
      if (frame.event.type !== 'CARD_REVEALED') {
        throw new Error('reveal frame lost its CARD_REVEALED event');
      }
      return frame.event.cardId;
    });
    expect(expectedRevealOrder.length).toBeGreaterThan(0);

    const presentedRevealOrder: CardId[] = [];
    for (const frame of timeline.transitions.slice(resolutionStartIndex + 1)) {
      pg.actions.presentCommittedFrame(frame);
      if (frame.event.type !== 'CARD_REVEALED') continue;
      presentedRevealOrder.push(frame.event.cardId);
      expect(getCardRuntime(
        pg.engineState(),
        frame.event.cardId,
        BOOTSTRAP_MANIFEST,
      )?.revealed).toBe(true);
      for (const pendingId of expectedRevealOrder.slice(presentedRevealOrder.length)) {
        expect(getCardRuntime(
          pg.engineState(),
          pendingId,
          BOOTSTRAP_MANIFEST,
        )?.revealed).toBe(false);
      }
      expect(presentedRevealOrder).toEqual(
        expectedRevealOrder.slice(0, presentedRevealOrder.length),
      );
    }

    expect(presentedRevealOrder).toEqual(expectedRevealOrder);
    pg.actions.finishTurnPresentation();
    expect(pg.ui.isFlipped).toBe(false);
  });

  it('finishes the committed opening projection with no DOM anchors present', async () => {
    vi.useFakeTimers();
    let pg!: PlayGameContextValue;
    const presentedFrames: Array<{
      type: string;
      localHandSize: number;
      laneOneRevealed: boolean;
    }> = [];

    const Probe = () => {
      onMount(() => { pg = usePlayGame(); });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider session={debugSession()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    expect(pg.engineState().hand[pg.localSeat]).toHaveLength(0);
    expect(firstLocationRevealed(pg)).toBe(false);

    const boardWrap = document.createElement('div');
    const boardEl = document.createElement('div');
    const motionOverlay = document.createElement('div');
    const toastArea = document.createElement('div');
    boardWrap.append(boardEl, motionOverlay, toastArea);
    document.body.append(boardWrap);
    const cardRefs = new Map<string, HTMLElement>();
    const zoneRefs = new Map();
    const motionSurface = createPlayMotionSurface({
      frame: boardWrap,
      overlay: motionOverlay,
      cardRefs,
      zoneRefs,
    });

    const presentationCtx: PlayScriptCtx = {
      get state() {
        return pg.engineState();
      },
      ui: pg.ui,
      setUi: pg.setUi,
      manifest: pg.manifest,
      localSeat: pg.localSeat,
      remoteSeat: pg.remoteSeat,
      boardEl,
      boardWrap,
      motionSurface,
      toastArea,
      cardRefs,
      zoneRefs,
      presentPlayfieldEvent: async () => undefined,
      presentCommittedFrame: (frame) => {
        pg.actions.presentCommittedFrame(frame);
        presentedFrames.push({
          type: frame.event.type,
          localHandSize: pg.engineState().hand[pg.localSeat].length,
          laneOneRevealed: firstLocationRevealed(pg),
        });
      },
      finishTurnPresentation: () => undefined,
    };
    const runOpeningBeat = async (step: ReturnType<typeof paceCommittedOpening>) => {
      if (typeof step !== 'function') throw new Error('opening presentation must be a step');
      const presentation = Promise.resolve(step(presentationCtx));
      await vi.runAllTimersAsync();
      await presentation;
    };

    await runOpeningBeat(paceCommittedOpening(pg.openingTimeline));

    const localDealHandSizes = presentedFrames
      .filter((frame, index) => frame.type === 'CARD_DRAWN'
        && (index === 0 || frame.localHandSize !== presentedFrames[index - 1]?.localHandSize))
      .map((frame) => frame.localHandSize);
    expect(localDealHandSizes).toEqual([1, 2, 3, 4]);
    const locationFrameIndex = presentedFrames.findIndex((frame) => frame.type === 'LOCATION_REVEALED');
    const locationFrame = presentedFrames[locationFrameIndex];
    expect(locationFrame?.laneOneRevealed).toBe(true);
    expect(presentedFrames.slice(0, locationFrameIndex)
      .every((frame) => !frame.laneOneRevealed)).toBe(true);
    expect(pg.engineState().hand[pg.localSeat]).toHaveLength(4);
    expect(pg.engineState().deck[pg.localSeat]).toHaveLength(8);
    expect(firstLocationRevealed(pg)).toBe(true);

    expect(pg.ui.handReservations).toEqual([]);
    const hand = getHandForSeat(pg.engineState(), pg.localSeat, pg.manifest);
    const affordable = hand.filter((card) => card.cost <= pg.engineState().energy[pg.localSeat]);
    const interactive = selectInteractiveHand(
      hand,
      new Set(pg.ui.handReservations.map((card) => card.id)),
    );
    const interactiveIds = new Set(interactive.map((card) => card.id));

    expect(affordable.length).toBeGreaterThan(0);
    expect(affordable.every((card) => interactiveIds.has(card.id))).toBe(true);
  });
});
