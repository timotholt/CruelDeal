import { describe, expect, it } from 'vitest';

import { validateCanonicalFrameWire } from './validator';

const cause = {
  sourceId: 'card:protocol-stage',
  effectKind: 'SYSTEM',
  reason: 'CARD_STAGE',
} as const;

const framed = (event: unknown) => ({
  frame: 1,
  scope: { turn: 1, phase: 'ACTION' },
  event,
  effect: null,
});

describe('C5A-5 staged-play protocol contract', () => {
  it('accepts complete staged-play and reveal-timing events', () => {
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 0,
      cause,
    })).ok).toBe(true);
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'TURN', turn: 1 },
      cause,
    })).ok).toBe(true);
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME' },
      cause,
    })).ok).toBe(true);
  });

  it.each([
    ['intentId', {
      type: 'CARD_STAGED',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
      cause,
    }],
    ['cardId', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
      cause,
    }],
    ['lane', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      owner: 'P0',
      energyPaid: 1,
      cause,
    }],
    ['owner', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      energyPaid: 1,
      cause,
    }],
    ['energyPaid', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      cause,
    }],
    ['cause', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
    }],
    ['non-empty intentId', {
      type: 'CARD_STAGED',
      intentId: '',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
      cause,
    }],
    ['non-empty cardId', {
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: '',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
      cause,
    }],
  ])('rejects CARD_STAGED without required %s', (_field, event) => {
    expect(validateCanonicalFrameWire(framed(event)).ok).toBe(false);
  });

  it.each([
    ['negative payment', -1],
    ['fractional payment', 1.5],
    ['unsafe payment', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects CARD_STAGED with %s', (_label, energyPaid) => {
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid,
      cause,
    })).ok).toBe(false);
  });

  it.each([
    ['missing timing', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      cause,
    }],
    ['missing cause', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME' },
    }],
    ['empty source', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME' },
      cause: { ...cause, sourceId: '' },
    }],
    ['empty reason', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME' },
      cause: { ...cause, reason: '' },
    }],
    ['invalid timing', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'TURN', turn: 0 },
      cause,
    }],
    ['fractional timing', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'TURN', turn: 1.5 },
      cause,
    }],
    ['unsafe timing', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'TURN', turn: Number.MAX_SAFE_INTEGER + 1 },
      cause,
    }],
    ['unknown timing', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'SOMEDAY' },
      cause,
    }],
    ['legacy timing alias', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { type: 'TURN', turn: 2 },
      cause,
    }],
    ['timing extras', {
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME', turn: 6 },
      cause,
    }],
  ])('rejects reveal schedule with %s', (_label, event) => {
    expect(validateCanonicalFrameWire(framed(event)).ok).toBe(false);
  });

  it('rejects aliases and unknown fields on both strict governed events', () => {
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_STAGED',
      intentId: 'intent:stage',
      cardId: 'card:protocol-stage',
      lane: 0,
      owner: 'P0',
      energyPaid: 1,
      cause,
      cost: 1,
      callerSuppliedTiming: { kind: 'END_OF_GAME' },
    })).ok).toBe(false);
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_REVEAL_SCHEDULED',
      cardId: 'card:protocol-stage',
      timing: { kind: 'END_OF_GAME' },
      cause,
      callerSuppliedPayment: 9,
    })).ok).toBe(false);
  });

  it('rejects the removed CARD_UNSTAGED event', () => {
    expect(validateCanonicalFrameWire(framed({
      type: 'CARD_UNSTAGED',
      intentId: 'intent:undo',
      cardId: 'card:protocol-stage',
    })).ok).toBe(false);
  });
});
