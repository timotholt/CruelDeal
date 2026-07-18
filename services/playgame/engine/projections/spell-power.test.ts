import { describe, expect, it } from 'vitest';
import { buildRuntimeFixture, testCardDef, testManifest } from '../testkit';
import type { CardDef } from '../manifest/types';
import type { CardId } from '../types/ids';
import { ctxForCard } from './context';
import { getCardPower, getLanePower, getLanePowerBreakdown } from './power';
import { evalPredicate, select } from './select';

const operative = testCardDef('operative', { power: 3 });
const spell: CardDef = {
  ...testCardDef('staged-spell', { power: 99 }),
  cardType: 'spell',
};
const manifest = testManifest([operative, spell]);

const fixture = buildRuntimeFixture({
  seed: 'spell-power-rule',
  localSeat: 'P0',
  turn: 3,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  decks: { P0: [], P1: [] },
  hands: { P0: [], P1: [] },
  lanes: [
    {
      P0: [
        { id: 'operative-1', defId: 'operative', revealed: true },
        { id: 'spell-1', defId: 'staged-spell', revealed: true },
      ],
      P1: [],
    },
    { P0: [], P1: [] },
    { P0: [], P1: [] },
  ],
  locations: [null, null, null],
  stagingOrder: ['spell-1'],
});

describe('spell cards have no power', () => {
  it('skips a spell structurally in card and lane power projections', () => {
    expect(getCardPower(fixture.state, 'spell-1' as CardId, manifest)).toBe(0);
    expect(getLanePower(fixture.state, 0, 'P0', manifest)).toBe(3);

    const breakdown = getLanePowerBreakdown(fixture.state, 0, 'P0', manifest);
    expect(breakdown.cardSubtotal).toBe(3);
    expect(breakdown.cards.map(card => card.cardId)).toEqual(['operative-1']);
  });

  it('does not choose a staged spell as the weakest card or match a power threshold', () => {
    const context = ctxForCard(fixture.state, manifest, fixture.state.cards['operative-1' as CardId]);
    const laneCards = { kind: 'ALL_CARDS', ownerFilter: 'SELF_OWNER', zoneFilter: 'LANE' } as const;

    expect(select({ kind: 'MIN_POWER_OF', of: laneCards }, context)).toEqual(['operative-1']);
    expect(evalPredicate({
      kind: 'POWER_CMP',
      target: { kind: 'SELF' },
      op: '>=',
      value: { kind: 'LIT', n: 0 },
    }, ctxForCard(fixture.state, manifest, fixture.state.cards['spell-1' as CardId]))).toBe(false);
  });
});
