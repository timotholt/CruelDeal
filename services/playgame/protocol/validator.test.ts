import { describe, expect, it } from 'vitest';

import conformance from '../../../protocol/fixtures/protocol-v1-conformance.json';
import {
  CRUEL_DEAL_PROTOCOL_VERSION,
  ProtocolValidationError,
  assertProtocolPayload,
  validateFramedEventWire,
  validateProtocolMessage,
} from './validator';

describe('Cruel Deal protocol v1 TypeScript validator', () => {
  it('agrees with every shared cross-language conformance fixture', () => {
    expect(conformance.protocolVersion).toBe(CRUEL_DEAL_PROTOCOL_VERSION);
    for (const fixture of conformance.cases) {
      const result = validateProtocolMessage(fixture.value);
      expect(result.ok, fixture.name).toBe(fixture.valid);
    }
  });

  it('returns stable path-oriented structural issues', () => {
    const result = validateFramedEventWire({
      frame: 0,
      scope: { turn: 0, phase: 'START' },
      event: {
        type: 'TURN_STARTED',
        turn: 1,
        priority: 'P0',
        priorityReason: 'RETAINED',
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining(['/frame', '/scope/turn']),
    );
  });

  it('rejects the removed locationless destruction event shape', () => {
    const result = validateFramedEventWire({
      frame: 1,
      scope: { turn: 1, phase: 'ACTION' },
      event: {
        type: 'LOCATION_DESTROYED',
        lane: 0,
        locationId: 'location-0',
        cause: { sourceId: 'rules', effectKind: 'SYSTEM', reason: 'TEST' },
      },
    });

    expect(result.ok).toBe(false);
  });

  it('accepts a reveal scheduling event at the runtime boundary', () => {
    const result = validateFramedEventWire({
      frame: 1,
      scope: { turn: 1, phase: 'ACTION' },
      event: {
        type: 'CARD_REVEAL_SCHEDULED',
        cardId: 'card-0',
        timing: { kind: 'END_OF_GAME' },
        cause: { sourceId: 'cryobank-0', effectKind: 'LOCATION', reason: 'TEST' },
      },
    });

    expect(result.ok).toBe(true);
  });

  it('accepts stable pending-effect identity events and rejects payload-equality removal', () => {
    const cause = {
      sourceId: 'card-0',
      effectKind: 'ON_REVEAL',
      reason: 'TEST_PENDING',
    };
    expect(validateFramedEventWire({
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
    }).ok).toBe(true);
    expect(validateFramedEventWire({
      frame: 2,
      scope: { turn: 2, phase: 'START' },
      event: {
        type: 'PENDING_EFFECT_CONSUMED',
        pendingEffectId: 'pending:1',
        cause: { sourceId: 'rules', effectKind: 'SYSTEM', reason: 'PENDING_FIRED' },
      },
    }).ok).toBe(true);

    expect(validateFramedEventWire({
      frame: 2,
      scope: { turn: 2, phase: 'START' },
      event: {
        type: 'PENDING_EFFECT_REMOVED',
        effect: {
          id: 'pending:1',
          kind: 'SCHEDULED',
        },
      },
    }).ok).toBe(false);
  });

  it('throws a typed boundary error from the assertion API', () => {
    expect(() => assertProtocolPayload('INTENT_ENVELOPE', {
      matchId: 'match',
      seat: 'P0',
      intentId: 'intent',
      expectedRevision: 0,
      intent: { type: 'END_TURN', owner: 'P0' },
    })).toThrow(ProtocolValidationError);
  });
});
