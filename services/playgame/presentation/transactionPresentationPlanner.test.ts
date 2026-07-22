import { describe, expect, it } from 'vitest';

import { asFrame } from '../engine/types/timeline';
import {
  hashSeatVisibleState,
  type SeatEffectTraceEntry,
  type SeatPresentationBlock,
  type SeatVisibleMatchState,
} from '../runtime/projection';
import { TransactionPresentationPlanner } from './transactionPresentationPlanner';

const state = (turn: number): SeatVisibleMatchState => ({
  turn,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  energy: { P0: turn, P1: turn },
  maxEnergy: { P0: turn, P1: turn },
  nextTurnEnergyBonus: { P0: 0, P1: 0 },
  deckCounts: { P0: 8, P1: 8 },
  locationDeckCount: 0,
  hands: { P0: [], P1: [] },
  cards: [],
  lanes: [],
  stagedCards: [],
  discard: { P0: [], P1: [] },
  destroyed: { P0: [], P1: [] },
  banished: { P0: [], P1: [] },
  banishedCounts: { P0: 0, P1: 0 },
  result: null,
});

const hiddenCard = { kind: 'HIDDEN', category: 'CARD' } as const;

const trace = (): readonly SeatEffectTraceEntry[] => [{
  kind: 'EFFECT_INVOCATION_STARTED',
  invocationToken: 'invocation:parent',
  parentInvocationToken: null,
  source: { kind: 'SYSTEM', systemId: 'test' },
  ability: { kind: 'SYSTEM', ruleId: 'test', ruleIndex: 0 },
  invocationReason: 'SYSTEM',
  depth: 0,
  candidates: [hiddenCard],
}, {
  kind: 'EFFECT_TARGET_RESOLVED',
  invocationToken: 'invocation:parent',
  attemptToken: 'attempt:parent:0',
  attemptOrdinal: 0,
  operation: 'TEST',
  target: hiddenCard,
  result: 'AFFECTED',
  blockedBy: [],
  reason: null,
}, {
  kind: 'EFFECT_INVOCATION_COMPLETED',
  invocationToken: 'invocation:parent',
  attempted: 1,
  affected: 1,
  blocked: 0,
  invalidated: 0,
  unchanged: 0,
}];

const block = (
  effects: readonly (SeatEffectTraceEntry | null)[] = trace(),
): SeatPresentationBlock => {
  const preState = state(1);
  const postState = state(2);
  const frames = effects.map((effect, index) => ({
    index: index + 10,
    frame: asFrame(index + 21),
    scope: { turn: 2, phase: 'START' as const },
    event: null,
    effect,
    after: postState,
  }));
  return {
    version: 2,
    transactionId: 'planner:test',
    matchId: 'planner-match',
    viewerSeat: 'P0',
    basePublicRevision: 4,
    publicRevision: 5,
    firstFrame: frames[0]!.frame,
    lastFrame: frames.at(-1)!.frame,
    preState,
    frames,
    postState,
    postStateHash: hashSeatVisibleState(postState),
  };
};

describe('TransactionPresentationPlanner', () => {
  it('materializes wire fields verbatim and claims every projected Frame exactly once', () => {
    const input = block();
    const plan = new TransactionPresentationPlanner().plan(input);

    expect(plan.timeline.frames).toHaveLength(input.frames.length);
    expect(plan.beats).toHaveLength(input.frames.length);
    expect(plan.beats.flatMap(beat => beat.frames)).toEqual(plan.timeline.frames);
    expect(plan.beats.map(beat => beat.claim.projectedFrameIndexes[0]))
      .toEqual([10, 11, 12]);
    input.frames.forEach((wireFrame, index) => {
      expect(plan.timeline.frames[index]?.effect).toBe(wireFrame.effect);
    });
  });

  it('derives a checked immutable invocation index from the complete trace', () => {
    const plan = new TransactionPresentationPlanner().plan(block());
    const invocation = plan.effects.get('invocation:parent');

    expect(plan.effects.size).toBe(1);
    expect(plan.effects.roots).toEqual([invocation]);
    expect(invocation).toMatchObject({
      firstProjectedFrameIndex: 0,
      lastProjectedFrameIndex: 2,
      outcomes: [{ attemptOrdinal: 0, projectedFrameIndex: 1 }],
    });
    expect(Object.isFrozen(invocation)).toBe(true);
    expect(Object.isFrozen(invocation?.outcomes)).toBe(true);
  });

  it('rejects an incomplete effect transcript before returning any beat', () => {
    expect(() => new TransactionPresentationPlanner().plan(block(trace().slice(0, 2))))
      .toThrow('Incomplete effect invocation invocation:parent');
  });

  it('rejects a completion checksum that disagrees with committed outcomes', () => {
    const entries = [...trace()];
    entries[2] = {
      ...entries[2] as Extract<SeatEffectTraceEntry, {
        kind: 'EFFECT_INVOCATION_COMPLETED';
      }>,
      affected: 0,
      unchanged: 1,
    };
    expect(() => new TransactionPresentationPlanner().plan(block(entries)))
      .toThrow('completion checksum mismatch');
  });

  it('rejects unordered projected Frames and a broken post-state checksum', () => {
    const unordered = block();
    const frames = [...unordered.frames];
    frames[1] = { ...frames[1]!, frame: frames[0]!.frame };
    expect(() => new TransactionPresentationPlanner().plan({ ...unordered, frames }))
      .toThrow('unordered Frames');

    expect(() => new TransactionPresentationPlanner().plan({
      ...block(),
      postStateHash: 'wrong',
    })).toThrow('failed its checksum');
  });
});
