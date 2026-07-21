import { describe, expect, it } from 'vitest';
import { cardStatTone, type ResolvedCard } from './view';

const card = (stats: ResolvedCard['stats']): ResolvedCard => ({
  id: 'card' as ResolvedCard['id'],
  defId: 'test-card',
  name: 'Test Card',
  cost: 3,
  baseCost: 3,
  power: 4,
  basePower: 4,
  art: '#000',
  portraitPath: null,
  type: 'character',
  text: '',
  textDisabled: false,
  owner: 'P0',
  zone: 'HAND',
  revealed: true,
  storedPowerDelta: 0,
  stats,
});

describe('cardStatTone', () => {
  it('uses blue cost and yellow power without modifiers', () => {
    expect(cardStatTone(card(null), 'cost')).toBe('base');
    expect(cardStatTone(card(null), 'power')).toBe('base');
  });

  it('makes a beneficial modifier green', () => {
    const stats = {
      token: 'card' as ResolvedCard['id'],
      name: 'Test Card',
      basePower: 4,
      effectivePower: 5,
      powerHistory: [{ turn: 1, frame: 1, sourceLabel: 'Boost', delta: 1, total: 5 }],
      livePowerModifiers: [],
      baseCost: 3,
      effectiveCost: 2,
      costHistory: [{ turn: 1, frame: 1, sourceLabel: 'Discount', delta: -1, total: 2 }],
      liveCostModifiers: [],
    };

    expect(cardStatTone(card(stats), 'cost')).toBe('buffed');
    expect(cardStatTone(card(stats), 'power')).toBe('buffed');
  });

  it('makes a stat red when any harmful modifier exists, even if it is offset', () => {
    const stats = {
      token: 'card' as ResolvedCard['id'],
      name: 'Test Card',
      basePower: 4,
      effectivePower: 4,
      powerHistory: [
        { turn: 1, frame: 1, sourceLabel: 'Boost', delta: 1, total: 5 },
        { turn: 1, frame: 2, sourceLabel: 'Weaken', delta: -1, total: 4 },
      ],
      livePowerModifiers: [],
      baseCost: 3,
      effectiveCost: 3,
      costHistory: [
        { turn: 1, frame: 1, sourceLabel: 'Discount', delta: -1, total: 2 },
        { turn: 1, frame: 2, sourceLabel: 'Tax', delta: 1, total: 3 },
      ],
      liveCostModifiers: [],
    };

    expect(cardStatTone(card(stats), 'cost')).toBe('debuffed');
    expect(cardStatTone(card(stats), 'power')).toBe('debuffed');
  });
});
