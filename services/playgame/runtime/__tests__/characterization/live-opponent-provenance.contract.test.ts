import { describe, expect, test } from 'vitest';
import { createRng } from '../../../engine/rng';
import { planLiveRemoteSeat } from '../../../script/liveRemoteSeatPlanner';
import {
  buildRuntimeFixture,
  testCardDef,
  testManifest,
} from '../../../engine/testkit';

describe('current live opponent deck provenance', () => {
  test.fails('plays existing cards from the remote hand instead of minting manifest-pool cards', async () => {
    const deckDefs = Array.from({ length: 12 }, (_, index) =>
      testCardDef(`remote-deck-${index}`, { cost: index === 0 ? 1 : 7 }));
    const outside = testCardDef('outside-remote-deck', { cost: 1 });
    const manifest = testManifest([...deckDefs, outside]);
    const openingHandSpecs = deckDefs.slice(0, 3).map((def, index) => ({
      id: `remote-hand-${index}`,
      defId: def.defId,
    }));
    const remoteDeckSpecs = deckDefs.slice(3).map((def, index) => ({
      id: `remote-deck-${index + 3}`,
      defId: def.defId,
    }));
    const fixture = buildRuntimeFixture({
      seed: 'live-opponent-provenance',
      localSeat: 'P0',
      turn: 1,
      phase: 'RESOLVING',
      priority: 'P0',
      decks: { P0: [], P1: remoteDeckSpecs },
      hands: { P0: [], P1: openingHandSpecs },
      lanes: [
        { P0: [], P1: [] },
        { P0: [], P1: [] },
        { P0: [], P1: [] },
      ],
      locations: [null, null, null],
      energy: { P0: 1, P1: 1 },
      maxEnergy: { P0: 1, P1: 1 },
    });

    // Find a reproducible seed where the live production planning seam chooses
    // the one affordable definition outside the selected deck.
    const plannerSeed = Array.from({ length: 128 }, (_, index) => `pool-seed-${index}`)
      .find((seed) => planLiveRemoteSeat(
        fixture.state,
        'P1',
        manifest,
        createRng(seed),
      )[0]?.defId === outside.defId);
    expect(plannerSeed).toBeDefined();

    const selectedDeckDefIds = new Set(deckDefs.map((def) => def.defId));
    const livePlan = planLiveRemoteSeat(
      fixture.state,
      'P1',
      manifest,
      createRng(plannerSeed!),
    );

    expect(livePlan).not.toHaveLength(0);
    expect(livePlan.every((play) => selectedDeckDefIds.has(play.defId))).toBe(true);
  });
});
