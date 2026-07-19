import type { CardId } from '../types/ids';
import type { MatchState } from '../types/state';
import type { Manifest } from '../manifest/types';
import { getCardCost, getCardCostModifiers } from './cost';
import {
  getCardPower,
  getCardPowerModifiers,
} from './power';
import { getCardRuntime, type CardRuntime } from './cardRuntime';
import { getCardTemplate } from './cardTemplate';

export interface CurrentCard extends CardRuntime {
  readonly name: string;
  readonly cost: {
    readonly base: number;
    readonly current: number;
    readonly permanentDelta: number;
    readonly modifiers: ReturnType<typeof getCardCostModifiers>;
  };
  readonly power: {
    readonly base: number;
    readonly current: number;
    readonly modifiers: ReturnType<typeof getCardPowerModifiers>;
  } | null;
}

export function getCurrentCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): CurrentCard | null {
  const runtime = getCardRuntime(state, cardId, manifest);
  if (!runtime) return null;
  const template = getCardTemplate(manifest, runtime.defId);
  if (!template) return null;
  return {
    ...runtime,
    name: template.name,
    cost: {
      base: template.baseCost,
      current: getCardCost(state, cardId, manifest),
      permanentDelta: runtime.costDelta,
      modifiers: getCardCostModifiers(state, cardId, manifest),
    },
    power: template.basePower === null
      ? null
      : {
          base: template.basePower,
          current: getCardPower(state, cardId, manifest),
          modifiers: getCardPowerModifiers(state, cardId, manifest),
        },
  };
}
