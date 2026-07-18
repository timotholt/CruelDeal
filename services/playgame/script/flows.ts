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
  fadeInLocationTile,
  flipPlayerCardsFaceDown,
  hideLocationTiles,
  paceCommittedOpening,
  paceCommittedTurn,
  setBoardVisible,
  toast,
} from './actions';
import type { MatchTransactionFrames } from '../runtime/contracts';

/**
 * Opening sequence for a new match.
 *
 *   1. black board
 *   2. CRUEL DEAL banner
 *   3. board UI fades in
 *   4. 3 ??? location tiles fade in left -> right
 *   5. walk the runtime's committed opening frames
 *   6. TURN 1 banner
 */
export const openingSequence = (timeline: MatchTransactionFrames): Step =>
  serial(
    setBoardVisible(false),
    hideLocationTiles(),
    wait(200),

    // CRUEL DEAL banner
    toast('CRUEL DEAL', { duration: 2500 }),
    wait(200),

    // Reveal the UI (location tiles stay hidden until the fade-in loop below)
    setBoardVisible(true),
    wait(400),

    // Location tiles: left -> right with a short gap
    serial(
      fadeInLocationTile(0, 400),
      wait(120),
      fadeInLocationTile(1, 400),
      wait(120),
      fadeInLocationTile(2, 400),
    ),
    wait(150),

    // Opening authority was committed by MatchRuntime as revision 1 before
    // this storyboard mounted. This step only paces those immutable frames.
    paceCommittedOpening(timeline),
    toast('TURN 1', { duration: 1800 }),
  );

/**
 * Turn-resolution sequence, triggered by END TURN.
 *
 * Follows the Marvel Snap reveal cadence:
 * Runtime has already accepted END_TURN and committed the complete timeline
 * before this presentation-only flow starts.
 *
 *   1. Flip the player's this-turn plays face-down — they were sitting
 *      face-up in lane since the player dropped them.
 *   2. Pace the committed enemy plays face-down (fly-in, no reveal yet).
 *   3. Priority-ordered reveal: whichever side has higher total power
 *      flips its cards face-up first, then the other side follows.
 *   4. Pace turn bookkeeping, draws, and location reveals in frame order.
 *   5. Unlock the UI presentation sidecar.
 */
export const resolveTurnFlow = (timeline: MatchTransactionFrames): Step =>
  serial(
    flipPlayerCardsFaceDown(),
    wait(200),
    wait(250),
    paceCommittedTurn(timeline),
  );
