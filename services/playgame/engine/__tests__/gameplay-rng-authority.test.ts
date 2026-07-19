import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { createMatchGenesis } from '../cli/initState';
import { runMatch } from '../cli/runMatch';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import {
  advanceGameplayRng,
  createGameplayRngState,
  createRng,
} from '../rng';
import { appendGameplayRngAdvance } from '../rng/transaction';
import { emptyTestMatchState } from '../testkit/runtimeFixture';
import { defaultLocationDeckFactory } from '../../runtime/locationDeckFactory';

describe('state-owned gameplay RNG authority', () => {
  it('stores one compact JSON-safe checkpoint and resumes at the exact next draw', () => {
    const rng = createRng('rng-checkpoint');
    for (let index = 0; index < 17; index++) rng.int(0, 0xffffffff);
    const checkpoint = JSON.parse(JSON.stringify(rng.snapshot()));
    const resumed = createRng(checkpoint);

    expect(Object.keys(checkpoint).sort()).toEqual(['algorithm', 'draws', 'seed', 'words']);
    expect(checkpoint.words).toHaveLength(4);
    expect(JSON.stringify(checkpoint).length).toBeLessThan(140);
    expect(Array.from({ length: 12 }, () => resumed.int(0, 0xffffffff)))
      .toEqual(Array.from({ length: 12 }, () => rng.int(0, 0xffffffff)));
  });

  it('commits only a positive draw delta and derives the next state in the reducer', () => {
    const state = emptyTestMatchState({ rngSeed: 'rng-event' });
    const rng = createRng(state.rng);
    rng.int(0, 10);
    rng.int(0, 10);
    rng.int(0, 10);
    const events = appendGameplayRngAdvance(state, rng, []);

    expect(events).toEqual([{ type: 'GAMEPLAY_RNG_ADVANCED', draws: 3 }]);
    const advanced = apply(state, events[0], BOOTSTRAP_MANIFEST);
    expect(advanced.rng).toEqual(advanceGameplayRng(state.rng, 3));
    expect(() => apply(
      state,
      { type: 'GAMEPLAY_RNG_ADVANCED', draws: 0 },
      BOOTSTRAP_MANIFEST,
    )).toThrow(/positive safe integer/);
  });

  it('keeps terminal boundary events last while committing RNG atomically', () => {
    const state = emptyTestMatchState({ rngSeed: 'rng-terminal' });
    const rng = createRng(state.rng);
    rng.int(0, 1);
    const events = appendGameplayRngAdvance(
      state,
      rng,
      [{ type: 'MATCH_SETUP_COMPLETED' }],
    );

    expect(events.map(event => event.type))
      .toEqual(['GAMEPLAY_RNG_ADVANCED', 'MATCH_SETUP_COMPLETED']);
  });

  it('reaches the final cursor using exactly the committed draw deltas', () => {
    const seed = 'rng-full-match';
    const ruleset = BOOTSTRAP_MANIFEST.rulesets.standard!;
    const locationPool = defaultLocationDeckFactory.build({
      manifest: BOOTSTRAP_MANIFEST,
      ruleset,
      seed,
    }).entries;
    const genesis = createMatchGenesis(seed, BOOTSTRAP_MANIFEST);
    const first = runMatch({
      seed,
      manifest: BOOTSTRAP_MANIFEST,
      locationDeck: locationPool,
    });
    const second = runMatch({
      seed,
      manifest: BOOTSTRAP_MANIFEST,
      locationDeck: locationPool,
    });
    const committedDraws = first.events.reduce(
      (total, event) => total + (event.type === 'GAMEPLAY_RNG_ADVANCED' ? event.draws : 0),
      0,
    );

    expect(first.events).toEqual(second.events);
    expect(first.finalState).toEqual(second.finalState);
    expect(first.finalState.rng.draws).toBe(genesis.rng.draws + committedDraws);
    expect(first.finalState.rng)
      .toEqual(advanceGameplayRng(createGameplayRngState(seed), first.finalState.rng.draws));
  });
});
