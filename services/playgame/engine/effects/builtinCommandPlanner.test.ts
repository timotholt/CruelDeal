import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_MANIFEST } from '../manifest';
import { createRng } from '../rng';
import { emptyTestMatchState } from '../testkit/runtimeFixture';
import type { CardId } from '../types/ids';
import { registeredBuiltinNames } from './builtins';
import { planBuiltinCommands } from './builtinCommandPlanner';
import type { EffectCtx } from './evaluator';

const DEDICATED_SAME_QUEUE_BUILTINS = [
  'CORPORATE_CLIMBER',
  'LEON_RETURN',
  'MOVE_ENEMY_CARD_TO_OTHER_LANE',
  'MOVE_LOWEST_POWER_ENEMY_TO_OTHER_LANE',
  'MOVE_RANDOM_FRIENDLY_TO_OTHER_LANE',
  'MOVE_SELF_TO_RANDOM_OTHER_LANE',
  'RIFF_RAFF',
  'RIOT_SQUAD',
  'SECURITY_DETAIL',
] as const;

describe('canonical builtin command planning', () => {
  it('classifies every registered builtin as pure-planned or dedicated same-queue work', () => {
    const state = emptyTestMatchState();
    const context: EffectCtx = {
      state,
      manifest: BOOTSTRAP_MANIFEST,
      self: 'builtin-audit-source' as CardId,
      selfKind: 'card',
      selfLane: null,
      selfOwner: null,
      source: {
        sourceId: 'builtin-audit-source' as CardId,
        effectKind: 'ON_REVEAL',
        reason: 'BUILTIN_COMMAND_PLANNER_AUDIT',
      },
      rng: createRng('builtin-command-planner-audit'),
      depth: 0,
    };

    const dedicated = registeredBuiltinNames().filter(name =>
      planBuiltinCommands(
        state,
        name,
        {},
        context,
        BOOTSTRAP_MANIFEST,
      ) === null,
    );

    expect(dedicated).toEqual([...DEDICATED_SAME_QUEUE_BUILTINS].sort());
  });
});
