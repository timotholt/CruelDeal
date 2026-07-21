import {
  createEffect,
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
import type { MatchClient } from '@/services/playgame/client/matchClient';
import type { ParticipantController } from '@/services/playgame/runtime/contracts';
import type { MatchAuthorityTestDriver } from '@/services/playgame/testing/authorityTestDriver';
import { MATCH_AUTHORITY_TEST_DRIVERS } from '@/services/playgame/testing/authorityRegistry';
import type {
  SeatCardToken,
  SeatTransactionTimeline,
} from '@/services/playgame/runtime/projection';
import type { MatchPresentationSink } from '@/services/playgame/presentation/presentationDirector';

const disposers: Array<() => void> = [];

afterEach(() => {
  vi.useRealTimers();
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function debugBootstrap(
  seed = 'split-provider-1',
  opponentController: ParticipantController = 'LOCAL_AI',
) {
  const bootstrap = buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  );
  return {
    ...bootstrap,
    participants: {
      ...bootstrap.participants,
      P1: {
        ...bootstrap.participants.P1,
        controller: opponentController,
      },
    },
  };
}

interface Harness {
  match: MatchSessionContextValue;
  ui: PlayUiContextValue;
}

function mountSession(client: MatchClient): Harness {
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
      <PlayProviders client={client}>
        <Probe />
      </PlayProviders>
    ),
    host,
  ));
  return harness;
}

async function mountHarness(
  driver: MatchAuthorityTestDriver,
  seed = 'split-provider-1',
): Promise<Harness> {
  return mountSession(await driver.createClient(
    debugBootstrap(seed),
    { developerAccess: true },
  ));
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

async function presentOpeningImmediately(
  harness: Harness,
  sink: MatchPresentationSink = {},
): Promise<void> {
  let resolveCompleted!: () => void;
  const completed = new Promise<void>((resolve) => {
    resolveCompleted = resolve;
  });
  harness.ui.actions.bindPresentationSink({
    beforeTransaction: sink.beforeTransaction,
    beforeFrame: sink.beforeFrame,
    afterFrame: sink.afterFrame,
    afterTransaction: async () => {
      await sink.afterTransaction?.();
      resolveCompleted();
    },
  });
  harness.ui.actions.presentOpening(harness.match.openingTimeline);
  await completed;
  await vi.waitFor(() => {
    expect(harness.ui.isResolving()).toBe(false);
  });
}

function laneCards(harness: Harness, lane: number): readonly string[] {
  return harness.ui.presentedState().lanes
    .find(candidate => candidate.id === lane)
    ?.cards[harness.match.localSeat] ?? [];
}

function firstLocationRevealed(harness: Harness): boolean {
  return harness.ui.presentedState().lanes[0]?.location?.face === 'FACE_UP';
}

for (const authorityDriver of MATCH_AUTHORITY_TEST_DRIVERS) {
describe(`${authorityDriver.id} split play providers`, () => {
  it('accepts a private turn lock without waiting for presentation', async () => {
    const harness = mountSession(await authorityDriver.createClient(
      debugBootstrap(
        'provider-private-lock',
        'REMOTE_PLAYER',
      ),
      { developerAccess: true },
    ));
    await presentOpeningImmediately(harness);
    const replayFrameCount = harness.match.debug!.replay().steps.length;
    const submitted = harness.match.actions.endTurn();
    expect(harness.match.intentActivity()).toEqual({
      kind: 'PROCESSING_INTENT',
      intent: 'END_TURN',
    });
    expect(harness.match.debug!.replay().steps).toHaveLength(replayFrameCount);

    await expect(submitted).resolves.toBe(true);
    expect(harness.match.intentActivity()).toEqual({
      kind: 'WAITING_FOR_PLAYER',
      intent: 'END_TURN',
      seat: harness.match.remoteSeat,
    });
    expect(harness.match.debug!.replay().steps).toHaveLength(replayFrameCount);
  });

  it('publishes committed transactions after the authoritative snapshot', async () => {
    const harness = await mountHarness(authorityDriver, 'provider-transaction-publication');
    const observed: Array<{
      timeline: SeatTransactionTimeline;
      snapshotRevision: number;
      snapshotState: SeatTransactionTimeline['finalState'];
    }> = [];
    const unsubscribeThrowing = harness.match.subscribeCommittedTransactions(
      () => { throw new Error('consumer failure'); },
    );
    const unsubscribeObserver = harness.match.subscribeCommittedTransactions(
      timeline => observed.push({
        timeline,
        snapshotRevision: harness.match.snapshot().revision,
        snapshotState: harness.match.snapshot().state,
      }),
    );

    await expect(harness.match.actions.endTurn()).resolves.toBe(true);

    expect(observed).toHaveLength(1);
    expect(observed[0]?.snapshotRevision).toBe(observed[0]?.timeline.revision);
    expect(observed[0]?.snapshotState).toBe(observed[0]?.timeline.finalState);

    unsubscribeObserver();
    await expect(harness.match.actions.endTurn()).resolves.toBe(true);
    expect(observed).toHaveLength(1);
    unsubscribeThrowing();
  });

  it('stops publishing to context subscribers after disposal', async () => {
    const client = await authorityDriver.createClient(
      debugBootstrap('provider-publication-disposal'),
      { developerAccess: true },
    );
    const harness = mountSession(client);
    const subscriber = vi.fn();
    harness.match.subscribeCommittedTransactions(subscriber);

    disposers.pop()?.();
    await client.endTurn();

    expect(subscriber).not.toHaveBeenCalled();
  });

  it('owns overlays per mount and resets them on remount', async () => {
    const first = await mountHarness(authorityDriver, 'provider-overlay-lifetime');
    first.ui.actions.setOpenMenuSeat('P0');
    first.ui.actions.setOpenPile({ owner: 'P0', zone: 'DESTROYED' });
    first.ui.actions.setReplayOpen(true);
    first.ui.actions.setReplayCursor(12);
    first.ui.actions.setReplayFollowingLive(false);
    first.ui.actions.setReplayClientActivity({
      kind: 'WAITING_FOR_PLAYER',
      seat: 'P1',
    });

    disposers.pop()?.();
    document.body.replaceChildren();

    const remounted = await mountHarness(authorityDriver, 'provider-overlay-lifetime');
    expect(remounted.ui.openMenuSeat()).toBeNull();
    expect(remounted.ui.openPile()).toBeNull();
    expect(remounted.ui.replayOpen()).toBe(false);
    expect(remounted.ui.replayCursor()).toBe(0);
    expect(remounted.ui.replayFollowingLive()).toBe(true);
    expect(remounted.ui.replayClientActivity()).toBeNull();
    expect(remounted.ui.turnFlowRunning()).toBe(false);
    expect(remounted.ui.inspectorTarget()).toBeNull();
  });

  it('mounts projected setup and presents the committed opening', async () => {
    const harness = await mountHarness(authorityDriver, 'provider-opening-boundary');
    const setup = harness.ui.presentedState();
    expect(setup.lanes.map(lane => lane.id)).toEqual([0, 1, 2]);
    expect(setup.hands[harness.match.localSeat]).toHaveLength(0);
    expect(harness.match.openingTimeline.frames[0]?.event?.type)
      .toBe('CARD_DRAWN');
    expect(harness.match.openingTimeline.frames.some(
      frame => frame.event?.type === 'LANE_CREATED',
    )).toBe(false);

    await presentOpeningImmediately(harness);
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
    const client = await authorityDriver.createClient(
      debugBootstrap('provider-reactivity'),
      { developerAccess: true },
    );
    disposers.push(render(
      () => (
        <PlayProviders client={client}>
          <Probe />
        </PlayProviders>
      ),
      host,
    ));
    await presentOpeningImmediately(harness);

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

    await expect(harness.match.actions.endTurn()).resolves.toBe(true);
    await vi.waitFor(() => {
      expect(harness.ui.presentedState().turn).toBe(2);
    });
    expect(harness.ui.presentedState().stagedCards).toHaveLength(0);
  });

  it('keeps a private staged card when the authoritative snapshot refreshes', async () => {
    const harness = await mountHarness(authorityDriver, 'provider-private-plan');
    await presentOpeningImmediately(harness);
    const token = firstPlayableCard(harness);
    await harness.match.actions.stageCardInLane(token, 0);
    expect(laneCards(harness, 0)).toContain(token);
    harness.match.actions.refreshSnapshot();
    expect(harness.ui.presentedState().stagedCards).toContain(token);
    expect(laneCards(harness, 0)).toContain(token);
  });

  it('locks staged cards atomically and reveals them in projected order', async () => {
    const harness = await mountHarness(authorityDriver, 'provider-lock');
    const observations: Array<{
      type: string;
      token: string | null;
      owner: string | null;
      phase: string;
      locked: boolean;
      revealed: boolean | null;
    }> = [];
    await presentOpeningImmediately(harness, {
      afterFrame: frame => {
        const token = frame.event?.type === 'CARD_REVEALED'
          ? frame.event.data.card as string
          : null;
        observations.push({
          type: frame.event?.type ?? 'REDACTED',
          token,
          owner: typeof frame.event?.data.owner === 'string'
            ? frame.event.data.owner
            : null,
          phase: harness.ui.presentedState().phase,
          locked: harness.ui.ui.isFlipped,
          revealed: token === null
            ? null
            : harness.ui.presentedState().cards
              .find(card => card.token === token)?.revealed ?? false,
        });
      },
    });
    observations.length = 0;
    const token = firstPlayableCard(harness);
    await harness.match.actions.stageCardInLane(token, 0);
    const timelines: SeatTransactionTimeline[] = [];
    const unsubscribe = harness.match.subscribeCommittedTransactions(
      timeline => timelines.push(timeline),
    );
    await expect(harness.match.actions.endTurn()).resolves.toBe(true);
    unsubscribe();
    const timeline = timelines.at(-1);
    if (!timeline) throw new Error('END_TURN did not publish');
    await vi.waitFor(() => {
      expect(harness.ui.presentedState().turn).toBe(2);
      expect(harness.ui.isResolving()).toBe(false);
    });

    expect(observations.find(
      observation => observation.type === 'TURN_RESOLUTION_STARTED',
    )).toMatchObject({ phase: 'RESOLVING', locked: true });

    const remoteStageIndex = observations.findIndex(observation => (
      observation.type === 'CARD_STAGED'
      && observation.owner === harness.match.remoteSeat
    ));
    const resolutionStartIndex = observations.findIndex(
      observation => observation.type === 'TURN_RESOLUTION_STARTED',
    );
    expect(remoteStageIndex).toBeGreaterThanOrEqual(0);
    expect(remoteStageIndex).toBeLessThan(resolutionStartIndex);
    expect(observations[remoteStageIndex]?.locked).toBe(true);

    const revealFrames = timeline.frames
      .filter(frame => frame.event?.type === 'CARD_REVEALED');
    const revealTokens = revealFrames.map(frame =>
      frame.event?.data.card as string);
    const presentedRevealTokens = observations
      .filter(observation => observation.type === 'CARD_REVEALED')
      .map(observation => observation.token);
    expect(presentedRevealTokens).toEqual(revealTokens);
    expect(observations
      .filter(observation => observation.type === 'CARD_REVEALED')
      .every(observation => observation.revealed === true)).toBe(true);
    expect(harness.ui.ui.isFlipped).toBe(false);
  });

  it('finishes opening without card or zone DOM anchors', async () => {
    const harness = await mountHarness(authorityDriver, 'provider-anchorless-opening');
    const presented: Array<{
      type: string;
      handSize: number;
      locationRevealed: boolean;
    }> = [];
    await presentOpeningImmediately(harness, {
      afterFrame: frame => {
        presented.push({
          type: frame.event?.type ?? 'REDACTED',
          handSize: harness.ui.presentedState()
            .hands[harness.match.localSeat].length,
          locationRevealed: firstLocationRevealed(harness),
        });
      },
    });

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
}
