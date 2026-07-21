
import { GameState, CardInstance } from '../types';
import { OnRevealEffect, EffectContext } from '../types';

// Import Effects from Card Files
import { GrenadierEffect } from '../cards/Grenadier';
import { ScoutEffect } from '../cards/Scout';
import { SaboteurEffect } from '../cards/Saboteur';
import { PortalMageEffect } from '../cards/PortalMage';
import { AnnihilatorEffect } from '../cards/Annihilator';
import { JumperEffect } from '../cards/Jumper';
import { VenomEffect, VenomEatEffect } from '../cards/Venom';
import { NovaEffect } from '../cards/Nova';
import { CarnageEffect, CarnageEatEffect } from '../cards/Carnage';
import { WolverineEffect } from '../cards/Wolverine';

// --- Registry ---

export const EFFECTS: Record<string, OnRevealEffect> = {
    'GrenadierEffect': GrenadierEffect,
    'ScoutEffect': ScoutEffect,
    'SaboteurEffect': SaboteurEffect,
    'AnnihilatorEffect': AnnihilatorEffect,
    'PortalMageEffect': PortalMageEffect,
    'JumperEffect': JumperEffect,
    'VenomEffect': VenomEffect,
    'VenomEatEffect': VenomEatEffect, // Sub-routine
    'NovaEffect': NovaEffect,
    'CarnageEffect': CarnageEffect,
    'CarnageEatEffect': CarnageEatEffect, // Sub-routine
    'WolverineEffect': WolverineEffect,
    // Add new cards here...
};

export const resolveEffect = (effectId: string, state: GameState, source: CardInstance, context: EffectContext): GameState => {
    const effectFn = EFFECTS[effectId];
    if (effectFn) {
        return effectFn(state, source, context);
    }
    return state;
};
