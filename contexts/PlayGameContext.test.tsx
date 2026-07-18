import { createEffect, createMemo, createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlayGameProvider, usePlayGame, type PlayGameContextValue } from './PlayGameContext';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { CardId, LaneIdx } from '@/services/playgame/engine/types/ids';
import { validateMatchBootstrap } from '@/services/playgame/runtime/bootstrapValidation';
import { paceCommittedOpening, type PlayScriptCtx } from '@/services/playgame/script/actions';
import { getHandForSeat } from '@/services/playgame/view';
import { selectInteractiveHand } from '@/components/screens/play/handInteractivity';

const disposers: Array<() => void> = [];

afterEach(() => {
  vi.useRealTimers();
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function debugBootstrap() {
  const candidate = buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    'provider-0',
  );
  const validation = validateMatchBootstrap(candidate, BOOTSTRAP_MANIFEST);
  if (!validation.ok) throw new Error(JSON.stringify(validation.issues));
  return validation.value;
}

function firstPlayableCard(pg: PlayGameContextValue): CardId {
  const card = pg.engineState.hand[pg.localSeat].find(
    (candidate) => BOOTSTRAP_MANIFEST.cards[candidate.defId].cost
      <= pg.engineState.energy[pg.localSeat],
  );
  if (!card) throw new Error('fixture has no playable local card');
  return card.id;
}

function presentOpeningImmediately(pg: PlayGameContextValue): void {
  for (const frame of pg.openingTimeline.frames) {
    pg.actions.presentCommittedFrame(frame);
  }
}

describe('PlayGameProvider runtime synchronization', () => {
  it('notifies Solid observers after accepted stage, unstage, and end-turn projections', async () => {
    let pg!: PlayGameContextValue;
    const observed: string[] = [];

    const Probe = () => {
      const context = usePlayGame();
      const [replayEnabled] = createSignal(false);
      const replayFrame = createMemo(() => replayEnabled() ? context.engineState : null);
      const presentedState = createMemo(() => replayFrame() ?? context.engineState);
      onMount(() => { pg = context; });
      createEffect(() => {
        const state = presentedState();
        observed.push(JSON.stringify({
          turn: state.turn,
          phase: state.phase,
          energy: state.energy[context.localSeat],
          stagingOrder: [...state.stagingOrder],
          hand: state.hand[context.localSeat].map((card) => card.id),
          lanes: state.lanes.map((lane) => [...lane.cards[context.localSeat]]),
        }));
      });
      return null;
    };

    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayGameProvider bootstrap={debugBootstrap()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));
    presentOpeningImmediately(pg);

    const stageAndExpectObservation = async (label: string) => {
      const cardId = firstPlayableCard(pg);
      const cost = BOOTSTRAP_MANIFEST.cards[pg.engineState.cards[cardId].defId].cost;
      const energyBefore = pg.engineState.energy[pg.localSeat];
      const observationsBefore = observed.length;

      await expect(pg.actions.stageCardInLane(cardId, 0 as LaneIdx)).resolves.toBe(true);

      expect(pg.engineState.stagingOrder, `${label}: store projection`).toContain(cardId);
      expect(pg.engineState.energy[pg.localSeat]).toBe(energyBefore - cost);
      expect(observed.length, `${label}: reactive notification`).toBeGreaterThan(observationsBefore);
      const lastObservation = JSON.parse(observed.at(-1)!);
      expect(lastObservation.stagingOrder).toContain(cardId);
      expect(lastObservation.hand).not.toContain(cardId);
      expect(lastObservation.lanes.flat()).toContain(cardId);
      expect(lastObservation.energy).toBe(energyBefore - cost);
      return cardId;
    };

    const turnOneCard = await stageAndExpectObservation('turn 1 stage');
    const beforeUndoObservations = observed.length;
    await expect(pg.actions.undoPendingCard(turnOneCard)).resolves.toBe(true);
    expect(pg.engineState.stagingOrder).not.toContain(turnOneCard);
    expect(observed.length, 'unstage reactive notification').toBeGreaterThan(beforeUndoObservations);
    expect(JSON.parse(observed.at(-1)!).stagingOrder).not.toContain(turnOneCard);

    await expect(pg.actions.stageCardInLane(turnOneCard, 0 as LaneIdx)).resolves.toBe(true);
    const beforeEndTurnObservations = observed.length;
    const timeline = await pg.actions.endTurn();
    expect(timeline).not.toBeNull();
    expect(pg.engineState.turn, 'display does not snap before presentation').toBe(1);
    expect(pg.engineState.stagingOrder, 'staged projection survives the system commit')
      .toContain(turnOneCard);
    expect(pg.engineState.lanes[0].cards[pg.localSeat]).toContain(turnOneCard);
    for (const frame of timeline?.frames ?? []) pg.actions.presentCommittedFrame(frame);
    expect(pg.engineState.turn).toBe(2);
    expect(pg.engineState.stagingOrder).toHaveLength(0);
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
        <PlayGameProvider bootstrap={debugBootstrap()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    presentOpeningImmediately(pg);
    const cardId = firstPlayableCard(pg);
    await expect(pg.actions.stageCardInLane(cardId, 0)).resolves.toBe(true);
    expect(pg.engineState.hand[pg.localSeat].map((card) => card.id)).not.toContain(cardId);
    expect(pg.engineState.lanes[0].cards[pg.localSeat]).toContain(cardId);

    const committedFinalFrame = pg.openingTimeline.frames.at(-1);
    if (!committedFinalFrame) throw new Error('opening timeline has no final frame');
    pg.actions.presentCommittedFrame(committedFinalFrame);

    expect(pg.engineState.stagingOrder).toContain(cardId);
    expect(pg.engineState.hand[pg.localSeat].map((card) => card.id)).not.toContain(cardId);
    expect(pg.engineState.lanes[0].cards[pg.localSeat]).toContain(cardId);
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
        <PlayGameProvider bootstrap={debugBootstrap()}>
          <Probe />
        </PlayGameProvider>
      ),
      host,
    ));

    expect(pg.engineState.hand[pg.localSeat]).toHaveLength(0);
    expect(pg.engineState.lanes[0].locationRevealed).toBe(false);

    const boardWrap = document.createElement('div');
    const boardEl = document.createElement('div');
    const toastArea = document.createElement('div');
    boardWrap.append(boardEl, toastArea);
    document.body.append(boardWrap);

    const presentationCtx: PlayScriptCtx = {
      state: pg.engineState,
      ui: pg.ui,
      setUi: pg.setUi,
      manifest: pg.manifest,
      localSeat: pg.localSeat,
      remoteSeat: pg.remoteSeat,
      boardEl,
      boardWrap,
      toastArea,
      cardRefs: new Map(),
      zoneRefs: new Map(),
      openingTimeline: pg.openingTimeline,
      submitEndTurn: async () => null,
      presentCommittedFrame: (frame) => {
        pg.actions.presentCommittedFrame(frame);
        presentedFrames.push({
          type: frame.event.type,
          localHandSize: pg.engineState.hand[pg.localSeat].length,
          laneOneRevealed: pg.engineState.lanes[0].locationRevealed,
        });
      },
      finishTurnPresentation: () => undefined,
    };
    const openingStep = paceCommittedOpening();
    if (typeof openingStep !== 'function') throw new Error('opening presentation must be a step');
    const presentation = Promise.resolve(openingStep(presentationCtx));

    await vi.runAllTimersAsync();
    await presentation;

    const localDealHandSizes = presentedFrames
      .filter((frame, index) => frame.type === 'CARD_DRAWN'
        && (index === 0 || frame.localHandSize !== presentedFrames[index - 1]?.localHandSize))
      .map((frame) => frame.localHandSize);
    expect(localDealHandSizes).toEqual([1, 2, 3]);
    const locationFrameIndex = presentedFrames.findIndex((frame) => frame.type === 'LOCATION_REVEALED');
    const locationFrame = presentedFrames[locationFrameIndex];
    expect(locationFrame?.laneOneRevealed).toBe(true);
    expect(presentedFrames.slice(0, locationFrameIndex)
      .every((frame) => !frame.laneOneRevealed)).toBe(true);
    expect(pg.engineState.hand[pg.localSeat]).toHaveLength(3);
    expect(pg.engineState.deck[pg.localSeat]).toHaveLength(9);
    expect(pg.engineState.lanes[0].locationRevealed).toBe(true);

    expect(pg.ui.handReservations).toEqual([]);
    const hand = getHandForSeat(pg.engineState, pg.localSeat, pg.manifest);
    const affordable = hand.filter((card) => card.cost <= pg.engineState.energy[pg.localSeat]);
    const interactive = selectInteractiveHand(
      hand,
      new Set(pg.ui.handReservations.map((card) => card.id)),
    );
    const interactiveIds = new Set(interactive.map((card) => card.id));

    expect(affordable.length).toBeGreaterThan(0);
    expect(affordable.every((card) => interactiveIds.has(card.id))).toBe(true);
  });
});
