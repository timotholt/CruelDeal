import { describe, expect, it } from 'vitest';

import { rebaseKernelResolutionSteps } from './resolutionTrace';

describe('kernel resolution transcript rebasing', () => {
  it('rebases invocation and parent ordinals without changing target ordinals', () => {
    const steps = rebaseKernelResolutionSteps([
      {
        transitionIndex: null,
        effect: {
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationOrdinal: 0,
          parentInvocationOrdinal: null,
          source: { kind: 'SYSTEM', systemId: 'root' },
          ability: { kind: 'SYSTEM', ruleId: 'root', ruleIndex: 0 },
          invocationReason: 'SYSTEM',
          depth: 0,
          candidates: [],
        },
      },
      {
        transitionIndex: null,
        effect: {
          kind: 'EFFECT_INVOCATION_STARTED',
          invocationOrdinal: 1,
          parentInvocationOrdinal: 0,
          source: { kind: 'SYSTEM', systemId: 'child' },
          ability: { kind: 'SYSTEM', ruleId: 'child', ruleIndex: 0 },
          invocationReason: 'REACTION',
          depth: 1,
          candidates: [{ kind: 'PLAYER', owner: 'P0' }],
        },
      },
      {
        transitionIndex: 0,
        effect: {
          kind: 'EFFECT_TARGET_RESOLVED',
          invocationOrdinal: 1,
          attemptOrdinal: 0,
          candidateOrdinal: 0,
          operation: 'TEST',
          target: { kind: 'PLAYER', owner: 'P0' },
          result: 'AFFECTED',
          blockedBy: [],
          reason: null,
        },
      },
    ], 4);

    expect(steps[0]?.effect).toMatchObject({
      invocationOrdinal: 4,
      parentInvocationOrdinal: null,
    });
    expect(steps[1]?.effect).toMatchObject({
      invocationOrdinal: 5,
      parentInvocationOrdinal: 4,
    });
    expect(steps[2]?.effect).toMatchObject({
      invocationOrdinal: 5,
      attemptOrdinal: 0,
      candidateOrdinal: 0,
    });
  });
});
