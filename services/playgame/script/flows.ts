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
  dealPlayerCard,
  fadeInLocationTile,
  hideLocationTiles,
  revealNextLocation,
  setBoardVisible,
  toast,
} from './actions';

/**
 * Opening sequence for a new match.
 *
 *   1. black board
 *   2. GALACTIC SNAP banner
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

    // GALACTIC SNAP banner
    toast('GALACTIC SNAP', { duration: 2500 }),
    wait(200),

    // Reveal the UI (location tiles stay hidden until the fade-in loop below)
    setBoardVisible(true),
    wait(400),

    // Location tiles: left -> right with a short gap
    serial(
      fadeInLocationTile(0, 400),
      wait(180),
      fadeInLocationTile(1, 400),
      wait(180),
      fadeInLocationTile(2, 400),
    ),
    wait(400),

    // Deal 3 cards, one at a time, with a pause between each
    serial(
      dealPlayerCard(),
      wait(350),
      dealPlayerCard(),
      wait(350),
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
