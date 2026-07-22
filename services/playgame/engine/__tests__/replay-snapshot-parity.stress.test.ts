import { describe, expect, it } from 'vitest';
import { createMatchGenesis } from '../cli/initState';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { getCardsInZone } from '../projections/cardRuntime';
import { replayMatch } from '../replay';
import { frameAndFoldEvents } from '../transactionTimeline';
import type { MatchEvent } from '../types/events';

const FRAME_COUNT = 1_000;

describe('replay snapshot parity stress', () => {
  it('reconstructs all 1,000 committed game states exactly from frame history', {
    timeout: 120_000,
  }, () => {
    const genesis = createMatchGenesis(
      'replay-1000-snapshot-parity',
      BOOTSTRAP_MANIFEST,
    );
    const cardId = getCardsInZone(
      genesis,
      BOOTSTRAP_MANIFEST,
      'DECK',
      'P0',
    )[0].id;
    const events: MatchEvent[] = [];
    for (let index = 0; index < FRAME_COUNT; index++) {
      events.push({
        type: 'CARD_COUNTER_CHANGED',
        cardId,
        name: `replay-parity-${index % 8}`,
        delta: index % 3 === 0 ? -1 : 1,
        cause: {
          sourceId: cardId,
          effectKind: 'SYSTEM',
          reason: `REPLAY_PARITY_FRAME_${index + 1}`,
        },
      });
    }
    const live = frameAndFoldEvents({
      transactionId: 'replay-1000-snapshot-parity',
      initialState: genesis,
      events,
      manifest: BOOTSTRAP_MANIFEST,
    });
    const snapshots = [genesis, ...live.transitions.map(transition => transition.after)];

    const replayed = replayMatch({
      seed: genesis.rng.seed,
      manifest: BOOTSTRAP_MANIFEST,
      initialState: genesis,
      frames: live.frames,
    });

    expect(replayed.steps).toHaveLength(FRAME_COUNT + 1);
    for (let index = 0; index <= FRAME_COUNT; index++) {
      expect(
        replayed.steps[index].state,
        `replayed snapshot at frame ${index}`,
      ).toEqual(snapshots[index]);
    }
    expect(replayed.finalState).toEqual(live.finalState);
  });

  it('advances 1,000 diagnostic frames without accumulating history in MatchState', {
    timeout: 120_000,
  }, () => {
    const genesis = createMatchGenesis(
      'history-free-diagnostic-stress',
      BOOTSTRAP_MANIFEST,
    );
    const diagnostics: MatchEvent[] = Array.from({ length: FRAME_COUNT }, (_, index) => ({
      type: 'INTENT_REJECTED',
      intentId: `diagnostic-${index}`,
      reason: 'stress proof',
    }));
    const folded = frameAndFoldEvents({
      transactionId: 'history-free-diagnostic-stress',
      initialState: genesis,
      events: diagnostics,
      manifest: BOOTSTRAP_MANIFEST,
    });

    expect(folded.finalState).not.toHaveProperty('log');
    expect({
      ...folded.finalState,
      timeline: genesis.timeline,
    }).toEqual(genesis);
    expect(JSON.stringify(folded.finalState).length - JSON.stringify(genesis).length)
      .toBeLessThan(64);
  });
});
