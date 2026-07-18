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
        cause: { sourceId: 'rules', effectKind: 'SYSTEM' },
      },
    });

    expect(result.ok).toBe(false);
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
