import type { CardFxDefinition, CardPersistentFxKind } from './types';

import { fireCardFx } from './effects/fire';
import { iceCardFx } from './effects/ice';
import { acidCardFx } from './effects/acid';
import { electricCardFx } from './effects/electric';
import { poisonCardFx } from './effects/poison';
import { barrierCardFx } from './effects/barrier';
import { glitchCardFx } from './effects/glitch';
import { voidCardFx } from './effects/void';
import { overclockCardFx } from './effects/overclock';
import { stealthCardFx } from './effects/stealth';
import { holyCardFx } from './effects/holy';
import { bleedCardFx } from './effects/bleed';

export const cardFxDefinitions: Record<CardPersistentFxKind, CardFxDefinition> = {
  fire: fireCardFx,
  ice: iceCardFx,
  acid: acidCardFx,
  electric: electricCardFx,
  poison: poisonCardFx,
  barrier: barrierCardFx,
  glitch: glitchCardFx,
  void: voidCardFx,
  overclock: overclockCardFx,
  stealth: stealthCardFx,
  holy: holyCardFx,
  bleed: bleedCardFx,
};

export function getCardFxDefinition(kind: string): CardFxDefinition | undefined {
  return cardFxDefinitions[kind as CardPersistentFxKind];
}

export type {
  CardFxDefinition,
  CardPersistentFxKind,
  CardPersistentFxSource,
  CardTransientVfx,
  CardPersistentVfxGroup,
  CardVfxRenderModel,
  CardVfxChannel,
  CardVfxPhase,
  VfxClearReason,
  CreateTransientVfxRequest,
  CardVfxRegistry,
} from './types';
