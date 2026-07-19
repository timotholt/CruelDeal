import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_MANIFEST } from '../manifest/bootstrap';
import type { CardAbilities } from '../manifest/types';
import type { EffectExpr, OngoingExpr } from '../types/ability';
import type { CardId } from '../types/ids';
import { type CardInstance, type MatchState } from '../types/state';
import { CARD_ABILITY_SLOTS, hasAnyCardAbility } from './abilityPresence';
import { getCardPower } from './power';
import { findCards } from './query';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  withTestLocation,
} from '../testkit/runtimeFixture';

const effect: EffectExpr = {
  kind: 'CALL_BUILTIN',
  fn: 'TEST_ONLY',
  args: {},
};

const ongoing: OngoingExpr = {
  kind: 'POWER_ADD',
  target: { kind: 'SELF' },
  delta: { kind: 'LIT', n: 1 },
  stack: 'ADDITIVE',
};

function card(id: CardId, defId: string, powerDelta = 0): CardInstance {
  return {
    id,
    defId,
    version: BOOTSTRAP_MANIFEST.cards[defId].version,
    owner: 'P0',
    lane: 0,
    zone: 'LANE',
    revealed: true,
    powerDelta,
    costDelta: 0,
    powerLog: [],
    costLog: [],
    tags: [],
    textOverride: null,
    counters: {},
    spawnSource: { kind: 'DECK_CREATION' },
  };
}

function civilCourtState(): MatchState {
  const riot = card('riot' as CardId, 'riot-squad', 2);
  const junk = card('junk' as CardId, 'junk-card');

  const base = emptyTestMatchState({
    turn: 2,
    maxEnergy: { P0: 2, P1: 2 },
    seed: 'civil-court-no-ability-regression',
    energy: { P0: 2, P1: 2 },
    cards: { [riot.id]: riot, [junk.id]: junk },
    lanesById: testLaneRegistry([
      testLaneState(0, { P0: [riot.id, junk.id], P1: [] }),
      testLaneState(1),
      testLaneState(2),
    ]),
  });
  return withTestLocation(base, 0, 'civil-court', true);
}

describe('canonical ability presence', () => {
  it('counts every authored trigger slot as an ability', () => {
    for (const slot of CARD_ABILITY_SLOTS) {
      const abilities = {
        [slot]: [slot === 'ongoing' ? ongoing : effect],
      } as CardAbilities;
      expect(hasAnyCardAbility(abilities), slot).toBe(true);
    }
  });
});

describe('Civil Court no-ability targeting', () => {
  it('does not buff Riot Squad but still buffs a truly ability-less card', () => {
    const state = civilCourtState();

    // Riot Squad: base 1 + its already-earned permanent +2; no Civil Court +3.
    expect(getCardPower(state, 'riot' as CardId, BOOTSTRAP_MANIFEST)).toBe(3);
    // Junk has no ability and receives Civil Court's +3.
    expect(getCardPower(state, 'junk' as CardId, BOOTSTRAP_MANIFEST)).toBe(3);
  });

  it('keeps live-state CardFilter queries aligned with effect selectors', () => {
    const state = civilCourtState();
    const abilityless = findCards(state, BOOTSTRAP_MANIFEST, { hasAnyAbility: false });

    expect(abilityless.map((candidate) => candidate.id)).toEqual(['junk']);
  });
});
