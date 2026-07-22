import type { SeatTransactionTimeline } from '../../runtime/projection';
import type {
  PresentationBeat,
  TransactionPresentationPlan,
} from '../transactionPresentationPlanner';

export function beatForFrame(
  timeline: SeatTransactionTimeline,
  position: number,
): PresentationBeat {
  const frame = timeline.frames[position];
  if (!frame) throw new Error(`Missing fixture frame ${position}`);
  return {
    id: `${timeline.transactionId}:beat:${position}`,
    frames: [frame],
    before: frame.before,
    after: frame.after,
    claim: {
      kind: 'EXACT_CONTIGUOUS_RANGE',
      firstPosition: position,
      lastPosition: position,
      projectedFrameIndexes: [frame.index],
    },
    author: {
      kind: 'EXHAUSTIVE_SINGLE_FRAME',
      eventDisposition: frame.event === null ? 'NONE' : 'EVENT_AUTHOR_REQUIRED',
      effectDisposition: frame.effect === null ? 'NONE' : 'EFFECT_TRACE_AUTHOR_REQUIRED',
    },
  };
}

export function planForTimeline(
  timeline: SeatTransactionTimeline,
): TransactionPresentationPlan {
  return {
    timeline,
    effects: {
      roots: [],
      size: 0,
      get: () => undefined,
      values: () => [],
    },
    beats: timeline.frames.map((_frame, position) => beatForFrame(timeline, position)),
  };
}
