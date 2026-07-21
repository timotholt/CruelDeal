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
  acquisitionPool: 'tbd',
  traits: [],
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
  it('accepts power on character cards', () => {
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'character',
      basePower: 2,
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

  it('requires non-negative integer power on character cards', () => {
    for (const basePower of [undefined, -1, 1.5]) {
      expect(validateCardModule(cardModule({
        ...baseCard,
        cardType: 'character',
        ...(basePower === undefined ? {} : { basePower }),
      })).map((issue) => issue.message)).toContain(
        'character basePower must be an integer >= 0',
      );
    }
  });

  it('rejects the removed device taxonomy', () => {
    expect(validateCardModule(cardModule({
      ...baseCard,
      cardType: 'device',
      basePower: 0,
    })).map((issue) => issue.message)).toContain(
      'cardType must be character or spell',
    );
  });

  it('requires a canonical acquisition pool', () => {
    for (const acquisitionPool of [undefined, 'unknown', 'p6']) {
      expect(validateCardModule(cardModule({
        ...baseCard,
        acquisitionPool,
        cardType: 'character',
        basePower: 1,
      })).map((issue) => issue.message)).toContain(
        'acquisitionPool must be tbd, s1-s3, or p1-p5',
      );
    }
  });

  it('requires unique kebab-case gameplay traits', () => {
    for (const traits of [undefined, ['Batman Gadget'], ['gadget', 'gadget']]) {
      expect(validateCardModule(cardModule({
        ...baseCard,
        traits,
        cardType: 'character',
        basePower: 1,
      }))).not.toEqual([]);
    }
  });
});
