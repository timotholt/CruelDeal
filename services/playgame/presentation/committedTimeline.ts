import type { Seat } from '../engine/types/ids';
import type {
  SeatAnimationEvent,
  SeatTransactionFrame,
  SeatTransactionTimeline,
} from '../runtime/projection';
import { eventCardToken, eventOwner } from './projectedEvent';

export interface CommittedEventPacingPlan {
  readonly orderedEventIndexes: readonly number[];
  readonly beforeTurnEndIndexes: readonly number[];
}

export type ResolutionWalkBeat =
  | { readonly kind: 'local-lock' }
  | {
      readonly kind:
        | 'local-stage-adoption'
        | 'remote-fly-in'
        | 'priority-reveal'
        | 'non-priority-reveal'
        | 'committed-frame';
      readonly frame: SeatTransactionFrame;
    };

export function planCommittedEventPacing(
  events: readonly (SeatAnimationEvent | null)[],
): CommittedEventPacingPlan {
  const orderedEventIndexes = events.map((_, index) => index);
  const turnEndIndex = events.findIndex(event => event?.type === 'TURN_ENDED');
  return {
    orderedEventIndexes,
    beforeTurnEndIndexes: orderedEventIndexes.slice(
      0,
      turnEndIndex < 0 ? orderedEventIndexes.length : turnEndIndex,
    ),
  };
}

function cardOwner(
  frame: SeatTransactionFrame,
): Seat | null {
  const token = frame.event ? eventCardToken(frame.event) : null;
  if (!token) return null;
  return frame.before.cards.find(card => card.token === token)?.owner
    ?? frame.after.cards.find(card => card.token === token)?.owner
    ?? null;
}

export function planCommittedResolutionWalk(
  timeline: SeatTransactionTimeline,
  localSeat: Seat,
  eventIndexes: readonly number[] = planCommittedEventPacing(
    timeline.frames.map(frame => frame.event),
  ).orderedEventIndexes,
): readonly ResolutionWalkBeat[] {
  const frames = eventIndexes
    .map(index => timeline.frames[index])
    .filter((frame): frame is SeatTransactionFrame => frame !== undefined);
  if (!frames.some(
    frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
  )) {
    return frames.map(frame => ({ kind: 'committed-frame' as const, frame }));
  }

  const beats: ResolutionWalkBeat[] = [{ kind: 'local-lock' }];
  let nonPriorityRevealStarted = false;
  for (const frame of frames) {
    if (frame.event?.type === 'CARD_STAGED') {
      beats.push({
        kind: eventOwner(frame.event) === localSeat
          ? 'local-stage-adoption'
          : 'remote-fly-in',
        frame,
      });
      continue;
    }
    if (frame.event?.type === 'CARD_REVEALED') {
      const isPriority = cardOwner(frame) === frame.before.priority;
      if (
        isPriority
        && nonPriorityRevealStarted
        && (import.meta as { env?: { DEV?: boolean } }).env?.DEV
      ) {
        throw new Error(
          'Committed reveal order returned to the priority player',
        );
      }
      if (!isPriority) nonPriorityRevealStarted = true;
      beats.push({
        kind: isPriority ? 'priority-reveal' : 'non-priority-reveal',
        frame,
      });
      continue;
    }
    beats.push({ kind: 'committed-frame', frame });
  }
  return beats;
}
