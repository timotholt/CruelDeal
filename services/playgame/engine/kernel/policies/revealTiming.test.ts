import { describe, expect, it } from 'vitest';
import type { CardDef, LocationCardDef, Manifest } from '../../manifest/types';
import {
  emptyTestMatchState,
  testLaneRegistry,
  testLaneState,
  withTestLocation,
} from '../../testkit/runtimeFixture';
import type { CardId } from '../../types/ids';
import {
  EMPTY_CARD_LIFECYCLE,
  type InternalCardRecord,
} from '../../types/state';
import { getRevealTimingPolicy } from './revealTiming';

const timingOngoing = (
  timing: Extract<
    NonNullable<CardDef['abilities']['ongoing']>[number],
    { kind: 'REVEAL_TIMING_OVERRIDE' }
  >['timing'],
) => ({
  kind: 'REVEAL_TIMING_OVERRIDE' as const,
  target: {
    kind: 'SAME_LANE' as const,
    of: { kind: 'SELF' as const },
    ownerFilter: 'ANY_OWNER' as const,
  },
  timing,
  stack: 'MAX' as const,
});

function card(
  id: string,
  defId: string,
  revealed: boolean,
): InternalCardRecord {
  return {
    id: id as CardId,
    defId,
    version: 1,
    owner: 'P0',
    zone: 'LANE',
    lane: 0,
    revealed,
    revealTiming: revealed ? null : { kind: 'TURN', turn: 2 },
    lifecycle: { ...EMPTY_CARD_LIFECYCLE },
    powerLedger: [],
    costDelta: 0,
    costLog: [],
    tags: [],
    textOverride: null,
    textLog: [],
    counters: {},
    spawnSource: { kind: 'SYSTEM' },
  };
}

function cardDef(
  defId: string,
  timing?: Parameters<typeof timingOngoing>[0],
): CardDef {
  return {
    defId,
    version: 1,
    name: defId,
    acquisitionPool: 'tbd',
    traits: [],
    cardType: 'character',
    basePower: 1,
    cost: 1,
    abilities: timing ? { ongoing: [timingOngoing(timing)] } : {},
    cosmetic: {
      displayName: defId,
      flavorText: '',
      rulesText: '',
      art: { portrait: { path: '' } },
    },
  };
}

function locationDef(
  defId: string,
  timing: Parameters<typeof timingOngoing>[0],
): LocationCardDef {
  return {
    defId,
    version: 1,
    name: defId,
    rarity: 1,
    abilities: { ongoing: [timingOngoing(timing)] },
    cosmetic: {
      displayName: defId,
      description: '',
      art: { map: { path: '' } },
    },
  };
}

function fixture(
  cardPolicies: readonly Parameters<typeof timingOngoing>[0][],
  locationTiming: Parameters<typeof timingOngoing>[0],
) {
  const target = card('target', 'target', false);
  const sources = cardPolicies.map((timing, index) =>
    card(`source-${index}`, `source-${index}`, true));
  const defs = [
    cardDef('target'),
    ...cardPolicies.map((timing, index) => cardDef(`source-${index}`, timing)),
  ];
  const location = locationDef('timing-location', locationTiming);
  const manifest: Manifest = {
    version: 1,
    protocolVersion: 1,
    constants: {
      energyCurve: [1, 2, 3, 4, 5, 6],
      turnLimit: 6,
      handCap: 7,
      laneCapacity: 4,
      deckSize: 12,
      startingHandSize: 3,
      turnStartDraw: 1,
    },
    rulesets: {
      standard: {
        rulesetId: 'standard',
        deckConstruction: { defaultCopyLimit: 1 },
        laneRules: { initialLaneCount: 3, maximumActiveLaneCount: 3 },
        locationDeck: { minimumReserveCount: 0, copyLimit: 1 },
      },
    },
    cards: Object.fromEntries(defs.map((def) => [def.defId, def])),
    locations: { [location.defId]: location },
    disabled: { cards: [], locations: [] },
  };
  const all = [target, ...sources];
  const base = emptyTestMatchState({
    turn: 2,
    phase: 'AWAITING_INTENT',
    priority: 'P0',
    cards: Object.fromEntries(all.map((entry) => [entry.id, entry])),
    lanesById: testLaneRegistry([
      testLaneState(0, { P0: all.map((entry) => entry.id), P1: [] }),
      testLaneState(1),
      testLaneState(2),
    ]),
  });
  return {
    target,
    manifest,
    state: withTestLocation(
      base,
      0,
      location.defId,
      true,
      'timing-location-0' as never,
    ),
  };
}

describe('reveal timing pre-commit policy', () => {
  it('chooses the latest numeric turn independent of source count', () => {
    const { state, target, manifest } = fixture(
      [
        { kind: 'TURN', turn: { kind: 'LIT', n: 3 } },
        { kind: 'TURN', turn: { kind: 'LIT', n: 5 } },
      ],
      { kind: 'TURN', turn: { kind: 'LIT', n: 4 } },
    );

    expect(getRevealTimingPolicy(state, target.id, manifest)?.timing)
      .toEqual({ kind: 'TURN', turn: 5 });
  });

  it('treats END_OF_GAME as later than every turn', () => {
    const { state, target, manifest } = fixture(
      [{ kind: 'END_OF_GAME' }],
      { kind: 'TURN', turn: { kind: 'LIT', n: 99 } },
    );

    expect(getRevealTimingPolicy(state, target.id, manifest)?.timing)
      .toEqual({ kind: 'END_OF_GAME' });
  });
});
