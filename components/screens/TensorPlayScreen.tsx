/**
 * TensorPlayScreen — tensor map generator inside the 9:16 phone board chrome.
 *
 * Same layout shell as PlayScreen (HUD, game area, hand row, action bar)
 * but the game area hosts the tensor canvas instead of CityMapBoard.
 *
 * Route: /dev/tensor-play
 */

import { onMount, onCleanup } from 'solid-js';
import { boot } from '@/services/playgame/city-map/tensor/boot';
import Util from '@/services/playgame/city-map/tensor/util';
import '../screens/play/city-map/cityMapStyles.css';
import '@/src/styles/playgame.css';

interface TensorPlayScreenProps {
  onExit?: () => void;
}

export const TensorPlayScreen = (props: TensorPlayScreenProps) => {
  // eslint-disable-next-line no-unassigned-vars
  let areaRef: HTMLDivElement | undefined;
  // eslint-disable-next-line no-unassigned-vars
  let canvasRef: HTMLCanvasElement | undefined;
  let generateRef: (() => void) | undefined;

  onMount(() => {
    if (!areaRef || !canvasRef) return;
    const result = boot(areaRef, canvasRef, { seed: 'tensor-dev' });
    generateRef = result.generate;
    onCleanup(result.cleanup);
  });

  return (
    <div class="playgame-root city-play-root" style={{ width: '100%', height: '100%', background: '#000' }}>
      <div class="board-wrap">
        <div class="board city-game-board ready" id="board">
          {/* HUD */}
          <div class="hud-top city-game-board__hud">
            <div class="hud-top__side hud-top__side--left">
              <div class="city-player-chip city-player-chip--local">
                <span class="city-player-chip__avatar">T</span>
                <span class="city-player-chip__meta">
                  <span class="city-player-chip__name">TENSOR MAP</span>
                  <span class="city-player-chip__sub">Generator</span>
                </span>
              </div>
            </div>

            <div class="hud-top__center" />

            <div class="hud-top__side hud-top__side--right">
              <button
                class="retreat-btn"
                type="button"
                onClick={() => props.onExit?.()}
                style={{ "font-size": "9px", padding: "5px 10px", "min-width": "60px" }}
              >
                EXIT
              </button>
            </div>
          </div>

          {/* Map area — tensor canvas */}
          <div
            ref={areaRef}
            class="board-game-area city-map-game-area"
            style={{
              position: 'relative',
              overflow: 'hidden',
              "justify-content": 'stretch',
            }}
          >
            <canvas
              id={Util.CANVAS_ID}
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                display: 'block',
                "touch-action": 'none',
              }}
            />
          </div>

          {/* Action bar */}
          <div class="action-bar city-action-bar">
            <div />
            <button
              class="end-turn"
              type="button"
              onClick={() => generateRef?.()}
            >
              GENERATE
            </button>
            <div />
          </div>
        </div>
      </div>
    </div>
  );
};
