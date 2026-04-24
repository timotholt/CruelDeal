/**
 * Event choreography tests.
 *
 * Run:
 *   npx tsx services/playgame/presentation/choreography.test.ts
 */

import { describeEventChoreography } from './choreography';
import type { MatchEvent } from '../engine/types/events';
import type { EffectRef } from '../engine/types/ability';
import type { CardId, LaneIdx } from '../engine/types/ids';

// ---- Tiny assertion shim ---------------------------------------------------

let failures = 0;
const pass = (label: string) => { console.log(`PASS: ${label}`); };
const fail = (label: string, detail?: unknown) => {
  failures++;
  console.error(`FAIL: ${label}${detail !== undefined ? '\n  ' + JSON.stringify(detail, null, 2) : ''}`);
};
const eq = <T>(actual: T, expected: T, label: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(label);
  else fail(label, { actual, expected });
};

const source: EffectRef = {
  sourceId: 'sys' as CardId,
  effectKind: 'SYSTEM',
};

const event = <T extends MatchEvent>(e: T): T => e;

// ---- Tests -----------------------------------------------------------------

{
  const choreography = describeEventChoreography(event({
    type: 'CARD_MOVED',
    cardId: 'c1' as CardId,
    fromLane: 0 as LaneIdx,
    toLane: 2 as LaneIdx,
    cause: source,
  }));

  eq(choreography, {
    structural: { kind: 'card-move', cardId: 'c1', durationMs: 360 },
    vfx: [],
    sfx: [{ name: 'move', timing: 'on-dispatch' }],
  }, 'CARD_MOVED is a structural card move');
}

{
  const choreography = describeEventChoreography(event({
    type: 'CARD_POWER_CHANGED',
    cardId: 'c1' as CardId,
    delta: 2,
    cause: source,
  }));

  eq(choreography, {
    structural: { kind: 'dispatch-only' },
    vfx: [{ kind: 'power-flash', cardId: 'c1', delta: 2 }],
    sfx: [{ name: 'buff', timing: 'after-dispatch' }],
  }, 'positive CARD_POWER_CHANGED is additive VFX/SFX');
}

{
  const choreography = describeEventChoreography(event({
    type: 'CARD_POWER_CHANGED',
    cardId: 'c1' as CardId,
    delta: -1,
    cause: source,
  }));

  eq(choreography, {
    structural: { kind: 'dispatch-only' },
    vfx: [{ kind: 'power-flash', cardId: 'c1', delta: -1 }],
    sfx: [{ name: 'debuff', timing: 'after-dispatch' }],
  }, 'negative CARD_POWER_CHANGED is additive VFX/SFX');
}

{
  const choreography = describeEventChoreography(event({
    type: 'CARD_DESTROYED',
    cardId: 'c1' as CardId,
    cause: source,
  }));

  eq(choreography, {
    structural: { kind: 'dispatch-only' },
    vfx: [{ kind: 'destroy-burst', cardId: 'c1' }],
    sfx: [{ name: 'destroy', timing: 'after-dispatch' }],
  }, 'CARD_DESTROYED is additive VFX/SFX');
}

{
  const choreography = describeEventChoreography(event({
    type: 'CARD_TRANSFORMED',
    cardId: 'c1' as CardId,
    oldDefId: 'old-card',
    newDefId: 'new-card',
    cause: source,
  }));

  eq(choreography, {
    structural: { kind: 'dispatch-only' },
    vfx: [{ kind: 'glitch-flash', cardId: 'c1' }],
    sfx: [{ name: 'on_reveal', timing: 'after-dispatch' }],
  }, 'CARD_TRANSFORMED is additive VFX/SFX');
}

{
  const choreography = describeEventChoreography(event({ type: 'TURN_ENDED', turn: 3 }));

  eq(choreography, {
    structural: { kind: 'dispatch-only' },
    vfx: [],
    sfx: [],
  }, 'unmapped events dispatch without presentation cues');
}

if (failures > 0) {
  process.exitCode = 1;
}
