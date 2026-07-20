import {
  createEffect,
  createRenderEffect,
  onMount,
} from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayProviders } from './PlayProviders';
import {
  useMatchSession,
  type MatchSessionContextValue,
} from './MatchSessionContext';
import {
  usePlayUi,
  type PlayUiContextValue,
} from './PlayUiContext';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import { MatchSession } from '@/services/playgame/runtime/matchSession';
import type {
  SeatCardToken,
  SeatTransactionFrame,
} from '@/services/playgame/runtime/projection';
import {
  paceCommittedOpening,
  type PlayScriptCtx,
} from '@/services/playgame/script/actions';
import { createPlayMotionSurface } from '@/services/playgame/presentation/playMotionSurface';

const disposers: Array<() => void> = [];

afterEach(() => {
  vi.useRealTimers();
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function debugSession(seed = 'split-provider-1') {
  return MatchSession.fromBootstrap(buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  ));
}

function remoteHumanSession(seed: string) {
  const bootstrap = buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  );
  return MatchSession.fromBootstrap({
    ...bootstrap,
    participants: {
      ...bootstrap.participants,
      P1: {
        ...bootstrap.participants.P1,
        controller: 'REMOTE_PLAYER',
      },
    },
  });
}

interface Harness {
  match: MatchSessionContextValue;
  ui: PlayUiContextValue;
}

function mountSession(session: MatchSession): Harness {
  let harness!: Harness;
  const Probe = () => {
    const match = useMatchSession();
    const ui = usePlayUi();
    onMount(() => { harness = { match, ui }; });
    return null;
  };
  const host = document.createElement('div');
  document.body.append(host);
  disposers.push(render(
    () => (
      <PlayProviders session={session}>
        <Probe />
      </PlayProviders>
    ),
    host,
  ));
  return harness;
}

function mountHarness(seed = 'split-provider-1'): Harness {
  return mountSession(debugSession(seed));
}

function firstPlayableCard(harness: Harness): SeatCardToken {
  const state = harness.ui.presentedState();
  const token = state.hands[harness.match.localSeat].find(candidate => {
    const card = state.cards.find(entry => entry.token === candidate);
    return card?.cost !== undefined
      && card.cost <= state.energy[harness.match.localSeat];
  });
  if (!token) throw new Error('fixture has no playable local card');
  return token;
}

function presentOpeningImmediately(harness: Harness): void {
  for (const frame of harness.match.openingTimeline.frames) {
    harness.ui.actions.presentCommittedFrame(frame);
  }
}

function laneCards(harness: Harness, lane: number): readonly string[] {
  return harness.ui.presentedState().lanes
    .find(candidate => candidate.id === lane)
    ?.cards[harness.match.localSeat] ?? [];
}

function firstLocationRevealed(harness: Harness): boolean {
  return harness.ui.presentedState().lanes[0]?.location?.face === 'FACE_UP';
}

describe('split play providers', () => {
  it('settles a pending turn wait when its provider is disposed', async () => {
    const harness = mountSession(remoteHumanSession('provider-dispose-wait'));
    presentOpeningImmediately(harness);
    const pendingTurn = harness.match.actions.endTurn();

    disposers.pop()?.();

    await expect(pendingTurn).resolves.toBeNull();
  });

  it('owns overlays per mount and resets them on remount', () => {
    const first = mountHarness('provider-overlay-lifetime');
    first.ui.actions.setOpenMenuSeat('P0');
    first.ui.actions.setOpenPile({ owner: 'P0', zone: 'DESTROYED' });
    first.ui.actions.setReplayOpen(true);
    first.ui.actions.setReplayCursor(12);
    first.ui.actions.setReplayFollowingLive(false);
    first.ui.actions.setReplayClientActivity({
      kind: 'WAITING_FOR_PLAYER',
      seat: 'P1',
    });
    first.ui.actions.setTurnFlowRunning(true);

    disposers.pop()?.();
    document.body.replaceChildren();

    const remounted = mountHarness('provider-overlay-lifetime');
    expect(remounted.ui.openMenuSeat()).toBeNull();
    expect(remounted.ui.openPile()).toBeNull();
    expect(remounted.ui.replayOpen()).toBe(false);
    expect(remounted.ui.replayCursor()).toBe(0);
    expect(remounted.ui.replayFollowingLive()).toBe(true);
    expect(remounted.ui.replayClientActivity()).toBeNull();
    expect(remounted.ui.turnFlowRunning()).toBe(false);
    expect(remounted.ui.inspectorTarget()).toBeNull();
  });

  it('mounts projected setup and presents the committed opening', () => {
    const harness = mountHarness('provider-opening-boundary');
    const setup = harness.ui.presentedState();
    expect(setup.lanes.map(lane => lane.id)).toEqual([0, 1, 2]);
    expect(setup.hands[harness.match.localSeat]).toHaveLength(0);
    expect(harness.match.openingTimeline.frames[0]?.event?.type)
      .toBe('CARD_DRAWN');
    expect(harness.match.openingTimeline.frames.some(
      frame => frame.event?.type === 'LANE_CREATED',
    )).toBe(false);

    presentOpeningImmediately(harness);
    expect(harness.ui.presentedState().hands[harness.match.localSeat])
      .toHaveLength(4);
    expect(harness.ui.presentedState().deckCounts[harness.match.localSeat])
      .toBe(8);
  });

  it('reacts to stage, unstage, and frame-exact turn presentation', async () => {
    const observed: string[] = [];
    let harness!: Harness;
    const Probe = () => {
      const match = useMatchSession();
      const ui = usePlayUi();
      onMount(() => { harness = { match, ui }; });
      createEffect(() => {
        const state = ui.presentedState();
        observed.push(JSON.stringify({
          turn: state.turn,
          energy: state.energy[match.localSeat],
          staged: state.stagedCards,
          hand: state.hands[match.localSeat],
        }));
      });
      return null;
    };
    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayProviders session={debugSession('provider-reactivity')}>
          <Probe />
        </PlayProviders>
      ),
      host,
    ));
    presentOpeningImmediately(harness);

    const token = firstPlayableCard(harness);
    const energyBefore =
      harness.ui.presentedState().energy[harness.match.localSeat];
    const cost = harness.ui.presentedState().cards
      .find(card => card.token === token)?.cost ?? 0;
    const beforeStage = observed.length;
    await expect(harness.match.actions.stageCardInLane(token, 0))
      .resolves.toBe(true);
    expect(harness.ui.presentedState().stagedCards).toContain(token);
    expect(harness.ui.presentedState().energy[harness.match.localSeat])
      .toBe(energyBefore - cost);
    expect(observed.length).toBeGreaterThan(beforeStage);

    await expect(harness.match.actions.undoPendingCard(token))
      .resolves.toBe(true);
    expect(harness.ui.presentedState().stagedCards).not.toContain(token);
    await harness.match.actions.stageCardInLane(token, 0);

    harness.ui.actions.beginTurnPresentation();
    const timeline = await harness.match.actions.endTurn();
    expect(timeline).not.toBeNull();
    expect(harness.ui.presentedState().turn).toBe(1);
    expect(harness.ui.presentedState().stagedCards).toContain(token);
    for (const frame of timeline?.frames ?? []) {
      harness.ui.actions.presentCommittedFrame(frame);
    }
    expect(harness.ui.presentedState().turn).toBe(2);
    expect(harness.ui.presentedState().stagedCards).toHaveLength(0);
    harness.ui.actions.finishTurnPresentation();
  });

  it('keeps a private staged card when an older committed frame is adopted', async () => {
    const harness = mountHarness('provider-private-plan');
    presentOpeningImmediately(harness);
    const token = firstPlayableCard(harness);
    await harness.match.actions.stageCardInLane(token, 0);
    expect(laneCards(harness, 0)).toContain(token);
    const finalOpeningFrame = harness.match.openingTimeline.frames.at(-1);
    if (!finalOpeningFrame) throw new Error('opening has no final frame');
    harness.ui.actions.presentCommittedFrame(finalOpeningFrame);
    expect(harness.ui.presentedState().stagedCards).toContain(token);
    expect(laneCards(harness, 0)).toContain(token);
  });

  it('locks staged cards atomically and reveals them in projected order', async () => {
    let harness!: Harness;
    const observations: Array<{ phase: string; locked: boolean }> = [];
    const Probe = () => {
      const match = useMatchSession();
      const ui = usePlayUi();
      onMount(() => { harness = { match, ui }; });
      createRenderEffect(() => {
        observations.push({
          phase: ui.presentedState().phase,
          locked: ui.ui.isFlipped,
        });
      });
      return null;
    };
    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => (
        <PlayProviders session={debugSession('provider-lock')}>
          <Probe />
        </PlayProviders>
      ),
      host,
    ));
    presentOpeningImmediately(harness);
    const token = firstPlayableCard(harness);
    await harness.match.actions.stageCardInLane(token, 0);
    harness.ui.actions.beginTurnPresentation();
    const timeline = await harness.match.actions.endTurn();
    if (!timeline) throw new Error('END_TURN did not resolve');
    const startIndex = timeline.frames.findIndex(
      frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
    );
    const beforeLock = observations.length;
    harness.ui.actions.presentCommittedFrame(timeline.frames[startIndex]!);
    expect(observations.slice(beforeLock))
      .toEqual([{ phase: 'RESOLVING', locked: true }]);

    const revealFrames = timeline.frames
      .slice(startIndex + 1)
      .filter(frame => frame.event?.type === 'CARD_REVEALED');
    const revealTokens = revealFrames.map(frame =>
      frame.event?.data.card as string);
    const presented: string[] = [];
    for (const frame of timeline.frames.slice(startIndex + 1)) {
      harness.ui.actions.presentCommittedFrame(frame);
      if (frame.event?.type !== 'CARD_REVEALED') continue;
      const revealed = frame.event.data.card as string;
      presented.push(revealed);
      expect(harness.ui.presentedState().cards
        .find(card => card.token === revealed)?.revealed).toBe(true);
    }
    expect(presented).toEqual(revealTokens);
    harness.ui.actions.finishTurnPresentation();
    expect(harness.ui.ui.isFlipped).toBe(false);
  });

  it('finishes opening without card or zone DOM anchors', async () => {
    vi.useFakeTimers();
    const harness = mountHarness('provider-anchorless-opening');
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
    const presented: Array<{
      type: string;
      handSize: number;
      locationRevealed: boolean;
    }> = [];
    const context: PlayScriptCtx = {
      get state() {
        return harness.ui.presentedState();
      },
      ui: harness.ui.ui,
      setUi: harness.ui.setUi,
      manifest: harness.match.manifest,
      localSeat: harness.match.localSeat,
      remoteSeat: harness.match.remoteSeat,
      boardEl,
      motionSurface,
      toastArea,
      cardRefs,
      zoneRefs,
      cardStatReadModel: harness.match.actions.cardStatReadModel,
      presentPlayfieldEvent: async () => undefined,
      presentCommittedFrame: (frame: SeatTransactionFrame) => {
        harness.ui.actions.presentCommittedFrame(frame);
        presented.push({
          type: frame.event?.type ?? 'REDACTED',
          handSize: harness.ui.presentedState()
            .hands[harness.match.localSeat].length,
          locationRevealed: firstLocationRevealed(harness),
        });
      },
      finishTurnPresentation: () => undefined,
    };
    const step = paceCommittedOpening(harness.match.openingTimeline);
    if (typeof step !== 'function') throw new Error('opening must be a step');
    const presentation = Promise.resolve(step(context));
    await vi.runAllTimersAsync();
    await presentation;

    expect(harness.ui.presentedState().hands[harness.match.localSeat])
      .toHaveLength(4);
    expect(harness.ui.presentedState().deckCounts[harness.match.localSeat])
      .toBe(8);
    expect(firstLocationRevealed(harness)).toBe(true);
    expect(presented.some(frame => frame.type === 'LOCATION_REVEALED'))
      .toBe(true);
    expect(harness.ui.ui.handReservations).toEqual([]);
  });
});
