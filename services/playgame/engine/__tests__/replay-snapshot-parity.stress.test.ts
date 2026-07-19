import { describe, expect, it } from 'vitest';
import { apply } from '../apply';
import { createMatchGenesis } from '../cli/initState';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import { getCardsInZone } from '../projections/cardRuntime';
import { replayMatch } from '../replay';
import type { MatchEvent } from '../types/events';
import type { MatchState } from '../types/state';

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
    const snapshots: MatchState[] = [genesis];
    let state = genesis;

    for (let index = 0; index < FRAME_COUNT; index++) {
      const event: MatchEvent = {
        type: 'CARD_COUNTER_CHANGED',
        cardId,
        name: `replay-parity-${index % 8}`,
        delta: index % 3 === 0 ? -1 : 1,
        cause: {
          sourceId: cardId,
          effectKind: 'SYSTEM',
          reason: `REPLAY_PARITY_FRAME_${index + 1}`,
        },
      };
      state = apply(state, event, BOOTSTRAP_MANIFEST);
      snapshots.push(state);
    }

    const replayed = replayMatch({
      seed: genesis.seed,
      manifest: BOOTSTRAP_MANIFEST,
      initialState: genesis,
      framedEvents: state.log.map(({ frame, scope, event }) => ({
        frame,
        scope,
        event: event as MatchEvent,
      })),
    });

    expect(replayed.steps).toHaveLength(FRAME_COUNT + 1);
    for (let index = 0; index <= FRAME_COUNT; index++) {
      expect(
        replayed.steps[index].state,
        `replayed snapshot at frame ${index}`,
      ).toEqual(snapshots[index]);
    }
    expect(replayed.finalState).toEqual(state);
  });
});
