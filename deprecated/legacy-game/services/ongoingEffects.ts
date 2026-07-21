
import { OngoingEffectFunction } from '../types';
import { CommanderEffect } from '../cards/Commander';
import { OmniBotEffect } from '../cards/OmniBot';
import { DeathCostEffect } from '../cards/Death';

export const ONGOING_EFFECTS: Record<string, OngoingEffectFunction> = {
    'CommanderEffect': CommanderEffect,
    'OmniBotEffect': OmniBotEffect,
    'DeathCostEffect': DeathCostEffect,
};
