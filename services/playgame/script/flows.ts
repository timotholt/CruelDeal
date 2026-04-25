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
  autoPlayRemoteSeat,
  advanceTurnFromEngine,
  captureEngineEndTurn,
  dealPlayerCard,
  fadeInLocationTile,
  finishResolving,
  flipPlayerCardsFaceDown,
  hideLocationTiles,
  revealByPriorityFromEngine,
  revealNextLocation,
  setBoardVisible,
  startResolving,
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

    // Deal 3 cards, one at a time, with a pause between each
    serial(
      dealPlayerCard(),
      wait(200),
      dealPlayerCard(),
      wait(200),
      dealPlayerCard(),
    ),
    wait(500),

    // TURN 1
    toast('TURN 1', { duration: 1800 }),
    wait(300),

    // Draw the turn-1 card
    dealPlayerCard(),
    wait(300),

    // Reveal the first location
    revealNextLocation(),
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
    startResolving(),
    flipPlayerCardsFaceDown(),
    wait(200),
    // Remote seat commits plays face-down. autoPlayRemoteSeat also stages them
    // card through the bridge so the engine sees it in staging order.
    autoPlayRemoteSeat(),
    // Run the engine's turn resolution — returns the authoritative event
    // stream (CARD_FLIPPED in priority order, TURN_STARTED with new priority).
    // Must be called AFTER all cards are staged through the bridge.
    captureEngineEndTurn(),
    wait(250),
    // Reveal cards in the order the engine dictated (priority-first).
    revealByPriorityFromEngine(),
    wait(200),
    // Advance turn/energy/priority from the engine's TURN_STARTED event.
    advanceTurnFromEngine(),
    wait(200),
    revealNextLocation(),
    finishResolving(),
  );
