import type { MatchEvent } from '../engine/types/events';
import type { Seat } from '../engine/types/ids';
import type { EventTransition } from '../engine/transactionTimeline';
import type { CommittedTransactionTimeline } from '../runtime/contracts';
import { getCardPlacement } from '../engine/projections/cardRuntime';

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
      readonly frame: EventTransition;
    };

/**
 * Presentation-only indexing over an already committed transaction. It never
 * selects events for application: every index remains in canonical order.
 */
export function planCommittedEventPacing(
  events: readonly MatchEvent[],
): CommittedEventPacingPlan {
  const orderedEventIndexes = events.map((_, index) => index);
  const turnEndIndex = events.findIndex((event) => event.type === 'TURN_ENDED');
  return {
    orderedEventIndexes,
    beforeTurnEndIndexes: orderedEventIndexes.slice(
      0,
      turnEndIndex < 0 ? orderedEventIndexes.length : turnEndIndex,
    ),
  };
}

/**
 * Builds the designer-facing END TURN walk over canonical frames.
 *
 * Authority remains in committed order. The only synthetic beat is the
 * presentation lock, which must paint before either seat's canonical staging
 * frames are adopted. Local staging is already visible from the private plan,
 * so those frames are adopted without replaying a hand-to-lane flight. Remote
 * staging is the one face-down fly-in beat. Reveal ownership is read from the
 * committed frame, which means delayed cards (no CARD_FLIPPED frame this turn)
 * are never accidentally added to the reveal walk.
 */
export function planCommittedResolutionWalk(
  timeline: CommittedTransactionTimeline,
  localSeat: Seat,
  eventIndexes: readonly number[] = planCommittedEventPacing(
    timeline.transaction.framedEvents.map(({ event }) => event),
  ).orderedEventIndexes,
): readonly ResolutionWalkBeat[] {
  const frames = eventIndexes
    .map((index) => timeline.transitions[index])
    .filter((frame): frame is EventTransition => frame !== undefined);
  if (!frames.some((frame) => frame.event.type === 'TURN_RESOLUTION_STARTED')) {
    return frames.map((frame) => ({ kind: 'committed-frame' as const, frame }));
  }

  const beats: ResolutionWalkBeat[] = [{ kind: 'local-lock' }];
  let nonPriorityRevealStarted = false;

  for (const frame of frames) {
    if (frame.event.type === 'CARD_STAGED') {
      beats.push({
        kind: frame.event.owner === localSeat ? 'local-stage-adoption' : 'remote-fly-in',
        frame,
      });
      continue;
    }

    if (frame.event.type === 'CARD_FLIPPED') {
      const owner = getCardPlacement(frame.before, frame.event.cardId)?.owner
        ?? getCardPlacement(frame.after, frame.event.cardId)?.owner;
      const isPriority = owner === frame.before.priority;
      if (isPriority && nonPriorityRevealStarted && import.meta.env.DEV) {
        throw new Error('Committed reveal order returned to the priority player');
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
