/**
 * JSON Card Loader — loads and validates CardDef JSON files.
 *
 * Cards are imported manually from ./cards/*.json and validated at load time.
 * This ensures type safety and catches data errors early.
 */

import type { CardDef } from './types';
import sentinelJson from './cards/sentinel.json';
import skyMarshalJson from './cards/sky-marshal.json';
import sunBeaconJson from './cards/sun-beacon.json';
import hexWitchJson from './cards/hex-witch.json';
import pyroMonkJson from './cards/pyro-monk.json';
import bladeRunnerJson from './cards/blade-runner.json';
import iceLanceJson from './cards/ice-lance.json';
import duneSapperJson from './cards/dune-sapper.json';
import thornChoirJson from './cards/thorn-choir.json';
import voidHoundJson from './cards/void-hound.json';

const CARD_JSONS = [
  sentinelJson,
  skyMarshalJson,
  sunBeaconJson,
  hexWitchJson,
  pyroMonkJson,
  bladeRunnerJson,
  iceLanceJson,
  duneSapperJson,
  thornChoirJson,
  voidHoundJson,
];

export function loadCardsFromJson(): Record<string, CardDef> {
  const cards: Record<string, CardDef> = {};

  for (const data of CARD_JSONS) {
    const card = validateCardDef(data);
    cards[card.defId] = card;
  }

  return cards;
}

function validateCardDef(data: unknown): CardDef {
  if (!data || typeof data !== 'object') {
    throw new Error(`Card: Expected object, got ${typeof data}`);
  }

  const obj = data as Record<string, unknown>;

  const defId = validateString(obj.defId, 'defId');
  const version = validateNumber(obj.version, 'version');
  const name = validateString(obj.name, 'name');
  const basePower = validateNumber(obj.basePower, 'basePower');
  const cost = validateNumber(obj.cost, 'cost');
  const tribes = validateStringArray(obj.tribes, 'tribes');
  const abilities = obj.abilities as Record<string, unknown>;
  const cosmetic = obj.cosmetic as Record<string, unknown>;

  return {
    defId,
    version,
    name,
    basePower,
    cost,
    tribes,
    abilities: abilities as any,
    cosmetic: cosmetic as any,
  };
}

function validateString(val: unknown, path: string): string {
  if (typeof val !== 'string') {
    throw new Error(`${path}: Expected string, got ${typeof val}`);
  }
  return val;
}

function validateNumber(val: unknown, path: string): number {
  if (typeof val !== 'number') {
    throw new Error(`${path}: Expected number, got ${typeof val}`);
  }
  return val;
}

function validateStringArray(val: unknown, path: string): readonly string[] {
  if (!Array.isArray(val)) {
    throw new Error(`${path}: Expected array, got ${typeof val}`);
  }
  for (let i = 0; i < val.length; i++) {
    if (typeof val[i] !== 'string') {
      throw new Error(`${path}[${i}]: Expected string, got ${typeof val[i]}`);
    }
  }
  return val as readonly string[];
}
