import { describe, expect, it } from 'vitest';
import {
  validateCardModule,
  type CardModule,
} from './card-set-loader';

const cardModule = (card: Record<string, unknown>): CardModule => ({
  folder: String(card.defId),
  card: card as unknown as CardModule['card'],
});

const baseCard = {
  defId: 'schema-proof',
  version: 1,
  name: 'Schema Proof',
  cost: 1,
  abilities: {},
  cosmetic: {
    displayName: 'Schema Proof',
    flavorText: '',
    rulesText: '',
    art: { portrait: { path: '' } },
  },
};

describe('card-set loader schema', () => {
  it('accepts power only on character and device cards', () => {
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'character',
      basePower: 2,
    }))).toEqual([]);
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'device',
      basePower: 0,
    }))).toEqual([]);
  });

  it('accepts a spell only when basePower is absent', () => {
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'spell',
    }))).toEqual([]);
  });

  it('rejects legacy spell power placeholders', () => {
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'spell',
      basePower: 0,
    })).map((issue) => issue.message)).toContain(
      'spell cards must not define basePower',
    );
  });

  it('requires non-negative integer power on character and device cards', () => {
    for (const basePower of [undefined, -1, 1.5]) {
      expect(validateCardModule(cardModule({
        ...baseCard,
        cardType: 'character',
        ...(basePower === undefined ? {} : { basePower }),
      })).map((issue) => issue.message)).toContain(
        'character and device basePower must be an integer >= 0',
      );
    }
  });
});
