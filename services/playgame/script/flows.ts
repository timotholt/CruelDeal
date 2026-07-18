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
  commitTurnResolution,
  fadeInLocationTile,
  flipPlayerCardsFaceDown,
  hideLocationTiles,
  paceCommittedOpening,
  paceCommittedTurn,
  setBoardVisible,
  toast,
} from './actions';

/**
 * Opening sequence for a new match.
 *
 *   1. black board
 *   2. CRUEL DEAL banner
 *   3. board UI fades in
 *   4. 3 ??? location tiles fade in left -> right
 *   5. deal 1 card to player x3 (with pauses)
 *   6. TURN 1 banner
 *   7. deal 1 more card to player
 *   8. reveal the first location
 *
 * Expects `ctx.drawQueue` to be pre-seeded with at least 4 cards.
 */
export const openingSequence = (): Step =>
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
    paceCommittedOpening(),
    toast('TURN 1', { duration: 1800 }),
  );

/**
 * Turn-resolution sequence, triggered by END TURN.
 *
 * Follows the Marvel Snap reveal cadence:
 *   1. Lock the UI (`startResolving`).
 *   2. Flip the player's this-turn plays face-down — they were sitting
 *      face-up in lane since the player dropped them.
 *   3. Enemy commits its plays face-down (fly-in, no reveal yet).
 *   4. Priority-ordered reveal: whichever side has higher total power
 *      flips its cards face-up first, then the other side follows.
 *   5. Turn bookkeeping (counter + energy + TURN N banner).
 *   6. Apply event-driven turn bookkeeping, including CARD_DRAWN.
 *   7. Reveal next location on turns 2 / 3.
 *   8. Unlock the UI.
 */
export const resolveTurnFlow = (): Step =>
  serial(
    flipPlayerCardsFaceDown(),
    wait(200),
    // END_TURN locks the local private plan. Runtime-owned AI intents lock the
    // remote seat, then one SYSTEM transaction commits the canonical merge.
    commitTurnResolution(),
    wait(250),
    paceCommittedTurn(),
  );
