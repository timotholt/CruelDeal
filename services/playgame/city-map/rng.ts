import { createRng as createEngineRng, type Rng } from '../engine/rng';

export type CityMapRng = Rng;

export function createCityMapRng(seed: number | string): CityMapRng {
  return createEngineRng(String(seed));
}
