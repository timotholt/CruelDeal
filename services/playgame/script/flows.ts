/**
 * Declarative flows. Ported from
 * ccg/vfx-engine/project/game/script/flows.js.
 *
 * Each flow is a function returning a `Step` you can pass to `script.run()`.
 * Flows read top-to-bottom like a storyboard; timings live here, in one
 * place per beat.
 */

import { serial, wait, type Step } from './runner';
import {
  paceCommittedOpeningDeal,
  paceCommittedOpeningLocationReveal,
  paceCommittedOpeningTurnStart,
  paceCommittedTurn,
  presentPlayfieldEvent,
  toast,
} from './actions';
import type { CommittedTransactionTimeline } from '../runtime/contracts';

const TURN_RESOLUTION_ENTRY_DELAY_MS = 80;

/**
 * Opening sequence for a new match.
 *
 *   1. completed three-lane playfield remains concealed
 *   2. CRUEL DEAL banner
 *   3. all 3 lanes fade in together
 *   4. pace the committed three-card deal
 *   5. TURN 1 banner
 *   6. pace the committed location reveal
 *   7. pace the committed turn-start draw
 */
export const openingSequence = (timeline: CommittedTransactionTimeline): Step =>
  serial(
    presentPlayfieldEvent({ type: 'HIDE_PLAYFIELD' }),
    wait(200),

    // CRUEL DEAL banner
    toast('CRUEL DEAL', { duration: 2500 }),
    wait(200),

    // Setup is already fully mounted. Reveal all three lanes as one surface.
    presentPlayfieldEvent({ type: 'SHOW_PLAYFIELD' }),
    wait(150),

    // Opening authority was committed by MatchRuntime as revision 1 before
    // this storyboard mounted. These steps only split the immutable frames
    // into the designer's presentation beats.
    paceCommittedOpeningDeal(timeline),
    toast('TURN 1', { duration: 1800 }),
    paceCommittedOpeningLocationReveal(timeline),
    paceCommittedOpeningTurnStart(timeline),
  );

/**
 * Turn-resolution sequence, triggered by END TURN.
 *
 * Follows the Marvel Snap reveal cadence:
 * Runtime has already accepted END_TURN and committed the complete timeline
 * before this presentation-only flow starts.
 *
 *   1. Pace the committed staged-card frames. Enemy plays remain face-down;
 *      the owner still sees their own plays as they did during planning.
 *   2. At TURN_RESOLUTION_STARTED, lock every staged card on both seats
 *      face-down together and hold that shared beat.
 *   3. Priority-ordered reveal: whichever side has higher total power
 *      flips its cards face-up first, then the other side follows.
 *   4. Pace turn bookkeeping, draws, and location reveals in frame order.
 *   5. Unlock the UI presentation sidecar.
 */
export const resolveTurnFlow = (timeline: CommittedTransactionTimeline): Step =>
  serial(
    wait(TURN_RESOLUTION_ENTRY_DELAY_MS),
    paceCommittedTurn(timeline),
  );
