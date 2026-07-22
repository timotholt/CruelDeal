import { describe, expect, it } from 'vitest';

import conformance from '../../../protocol/fixtures/authority-v2-conformance.json';
import playerWireConformance from '../../../protocol/fixtures/player-wire-v2-conformance.json';
import {
  AUTHORITY_PROTOCOL_VERSION,
  PLAYER_WIRE_PROTOCOL_VERSION,
  ProtocolValidationError,
  assertAuthorityPayload,
  validateCanonicalFrameWire,
  validateAuthorityRecordMessage,
  validatePlayerWireMessage,
} from './validator';

describe('Cruel Deal authority protocol v2 TypeScript validator', () => {
  it('agrees with every shared cross-language conformance fixture', () => {
    expect(conformance.protocolVersion).toBe(AUTHORITY_PROTOCOL_VERSION);
    for (const fixture of conformance.cases) {
      const result = validateAuthorityRecordMessage(fixture.value);
      expect(result.ok, fixture.name).toBe(fixture.valid);
    }
  });

  it('returns stable path-oriented structural issues', () => {
    const result = validateCanonicalFrameWire({
      frame: 0,
      scope: { turn: 0, phase: 'START' },
      event: {
        type: 'TURN_STARTED',
        turn: 1,
        priority: 'P0',
        priorityReason: 'RETAINED',
      },
      effect: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['/frame', '/scope/turn']),
    );
  });

  it('rejects the removed locationless destruction event shape', () => {
    const result = validateCanonicalFrameWire({
      frame: 1,
      scope: { turn: 1, phase: 'ACTION' },
      event: {
        type: 'LOCATION_DESTROYED',
        lane: 0,
        locationId: 'location-0',
        cause: { sourceId: 'rules', effectKind: 'SYSTEM', reason: 'TEST' },
      },
      effect: null,
    });

    expect(result.ok).toBe(false);
  });

  it('accepts a reveal scheduling event at the runtime boundary', () => {
    const result = validateCanonicalFrameWire({
      frame: 1,
      scope: { turn: 1, phase: 'ACTION' },
      event: {
        type: 'CARD_REVEAL_SCHEDULED',
        cardId: 'card-0',
        timing: { kind: 'END_OF_GAME' },
        cause: { sourceId: 'cryobank-0', effectKind: 'LOCATION', reason: 'TEST' },
      },
      effect: null,
    });

    expect(result.ok).toBe(true);
  });

  it('accepts stable pending-effect identity events and rejects payload-equality removal', () => {
    const cause = {
      sourceId: 'card-0',
      effectKind: 'ON_REVEAL',
      reason: 'TEST_PENDING',
    };
    expect(validateCanonicalFrameWire({
      frame: 1,
      scope: { turn: 1, phase: 'ACTION' },
      event: {
        type: 'PENDING_EFFECT_SCHEDULED',
        effect: {
          id: 'pending:1',
          kind: 'SCHEDULED',
          when: 'START_OF_NEXT_TURN',
          sourceId: 'card-0',
          sourceOwner: 'P0',
          sourceLane: 0,
          fireTurn: 2,
          effect: { kind: 'SEQUENCE', items: [] },
          scheduledBy: cause,
        },
        cause,
      },
      effect: null,
    }).ok).toBe(true);
    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 2, phase: 'START' },
      event: {
        type: 'PENDING_EFFECT_CONSUMED',
        pendingEffectId: 'pending:1',
        cause: { sourceId: 'rules', effectKind: 'SYSTEM', reason: 'PENDING_FIRED' },
      },
      effect: null,
    }).ok).toBe(true);

    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 2, phase: 'START' },
      event: {
        type: 'PENDING_EFFECT_REMOVED',
        effect: {
          id: 'pending:1',
          kind: 'SCHEDULED',
        },
      },
      effect: null,
    }).ok).toBe(false);
  });

  it('accepts canonical effect evidence and enforces event/outcome pairing', () => {
    const start = {
      kind: 'EFFECT_INVOCATION_STARTED',
      invocationId: 'match:tx:1:invoke:0',
      parentInvocationId: null,
      source: { kind: 'CARD', cardId: 'card-0' },
      ability: { kind: 'ON_REVEAL', ruleId: 'destroy-low-cost', ruleIndex: 0 },
      invocationReason: 'NATURAL',
      depth: 0,
      candidates: [{ kind: 'CARD', cardId: 'target-0' }],
    };
    expect(validateCanonicalFrameWire({
      frame: 1,
      scope: { turn: 1, phase: 'RESOLUTION' },
      event: null,
      effect: start,
    }).ok).toBe(true);

    const affected = {
      kind: 'EFFECT_TARGET_RESOLVED',
      invocationId: 'match:tx:1:invoke:0',
      attemptId: 'match:tx:1:invoke:0:attempt:0',
      attemptOrdinal: 0,
      operation: 'DESTROY_CARD',
      target: { kind: 'CARD', cardId: 'target-0' },
      result: 'AFFECTED',
      blockedBy: [],
      reason: null,
    };
    const destroyed = {
      type: 'CARD_DESTROYED',
      cardId: 'target-0',
      cause: {
        sourceId: 'card-0',
        effectKind: 'ON_REVEAL',
        reason: 'TEST',
      },
    };
    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 1, phase: 'RESOLUTION' },
      event: destroyed,
      effect: affected,
    }).ok).toBe(true);
    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 1, phase: 'RESOLUTION' },
      event: null,
      effect: affected,
    }).ok).toBe(false);
    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 1, phase: 'RESOLUTION' },
      event: destroyed,
      effect: { ...affected, result: 'BLOCKED', reason: 'CANNOT_BE_DESTROYED' },
    }).ok).toBe(false);
    expect(validateCanonicalFrameWire({
      frame: 2,
      scope: { turn: 1, phase: 'RESOLUTION' },
      event: null,
      effect: null,
    }).ok).toBe(false);
  });

  it('throws a typed boundary error from the assertion API', () => {
    expect(() => assertAuthorityPayload('INTENT_ENVELOPE', {
      matchId: 'match',
      seat: 'P0',
      intentId: 'intent',
      expectedPublicRevision: 0,
      expectedPlanRevision: 0,
      intent: { type: 'END_TURN', owner: 'P0' },
    })).toThrow(ProtocolValidationError);
  });
});

describe('Cruel Deal player wire protocol v2 TypeScript validator', () => {
  it('agrees with every shared cross-language conformance fixture', () => {
    expect(playerWireConformance.protocolVersion).toBe(PLAYER_WIRE_PROTOCOL_VERSION);
    for (const fixture of playerWireConformance.cases) {
      const result = validatePlayerWireMessage(fixture.value);
      expect(result.ok, fixture.name).toBe(fixture.valid);
    }
  });
});
