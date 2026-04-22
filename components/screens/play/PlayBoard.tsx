/**
 * PlayBoard — the interactive /play surface.
 *
 * Orchestrates (not implements):
 *   - hand / lanes / locations / HUD layout
 *   - lane-map overlays  (useLaneMaps)
 *   - drag-and-drop      (useDragDrop)
 *   - opening sequence + turn-resolve flow (script/runner)
 *
 * Mutations go through `actions.*` (engine events) or the script engine
 * context. Rendering goes through `services/playgame/view.ts` selectors.
 * UI primitives (HandCard, BoardCard, etc.) live in sibling files so they
 * can change without touching engine-coupled code.
 */

import { For, Show, createMemo, onCleanup, onMount } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import { PlayerHud } from '../../game/PlayerHud';
import { Portal } from '../../ui/Portal';
import { usePlayGame } from '@/contexts/PlayGameContext';
import {
  type ResolvedCard,
  type ResolvedLocation,
  getPlayerHand,
  getPlayerLaneCards,
  getEnemyLaneCards,
  getLocation,
  getLanePower,
} from '@/services/playgame/view';
import type { MatchState as EngineMatchState } from '@/services/playgame/engine/types/state';
import type { LaneIdx } from '@/services/playgame/engine/types/ids';
import type { CardDef as ManifestCardDef } from '@/services/playgame/engine/manifest/types';
import { createScript, type Script } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence, resolveTurnFlow } from '@/services/playgame/script/flows';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { ZoomInspector } from '../ZoomInspector';
import { HandCard } from './HandCard';
import { LaneSlots } from './LaneSlots';
import { LocationTile } from './LocationTile';
import { setupDragDrop } from './useDragDrop';
import { setupLaneMaps, shuffle } from './useLaneMaps';
import { inspectTarget, closeInspect } from './inspector';

interface PlayBoardProps {
  onExit?: () => void;
}

export const PlayBoard = (props: PlayBoardProps) => {
  const pg = usePlayGame();
  const { engineState, setEngineState, dispatch, manifest, ui, setUi, engineRng, isResolving, actions } = pg;
  const { cardRefs, boardRef } = useVfx();

  // ── Derived projections ─────────────────────────────────────────────────
  const hand = createMemo<ResolvedCard[]>(() => getPlayerHand(engineState, manifest));
  /**
   * Visible hand = engine hand MINUS cards still in the incoming buffer.
   * The draw-slide animation needs the new card to appear in the DOM only
   * after `commitIncomingToHand` pops it from `ui.incoming`, otherwise the
   * card lands in its final hand slot before the slide animation runs.
   */
  const visibleHand = createMemo<ResolvedCard[]>(() => {
    const incoming = new Set(ui.incoming.map((c) => c.id));
    return hand().filter((c) => !incoming.has(c.id));
  });

  const playerLane = (i: LaneIdx): ResolvedCard[] => getPlayerLaneCards(engineState, i, manifest);
  const enemyLane = (i: LaneIdx): ResolvedCard[] => getEnemyLaneCards(engineState, i, manifest);
  const laneLoc = (i: LaneIdx): ResolvedLocation => getLocation(engineState, i, manifest);
  const playerPower = (i: LaneIdx): number => getLanePower(engineState, i, 'PLAYER', manifest);
  const enemyPower = (i: LaneIdx): number => getLanePower(engineState, i, 'OPP', manifest);
  const playerHasPriority = createMemo(() => engineState.priority === 'PLAYER');
  const handScale = createMemo(() => {
    const n = visibleHand().length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
  });

  // ── Undo (one-card) ──────────────────────────────────────────────────────
  const handleUndoPending = (): void => {
    if (isResolving()) return;
    const lastStaged = [...engineState.stagingOrder]
      .reverse()
      .find((id) => engineState.cards[id]?.owner === 'PLAYER');
    if (!lastStaged) return;
    // Capture the lane-card rect plus all current hand rects; after undo,
    // Solid re-renders and the lane card reappears in hand — FLIP-slide
    // both the restored card and the shuffled hand into place.
    const allIds = [lastStaged as string, ...visibleHand().map((c) => c.id)];
    const oldRects = captureHandRects(allIds, cardRefs);
    actions.undoPending();
    requestAnimationFrame(() => playLayoutSlide(oldRects, cardRefs));
  };

  // ── Script instance for opening + resolveTurn ────────────────────────────
  let script: Script | undefined;

  let boardEl: HTMLDivElement | undefined;
  let toastAreaEl: HTMLDivElement | undefined;
  let deckEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!boardEl || !toastAreaEl) return;
    boardEl.classList.add('ready');

    // Lane overlay art comes from the locations the engine already assigned
    // in createInitialEngineState. NO RNG here — each lane's map must match
    // the lane's location def, otherwise the revealed tile shows one name
    // and the background shows a different biome.
    const lanePaths: [string | null, string | null, string | null] = [
      laneLoc(0).mapArt,
      laneLoc(1).mapArt,
      laneLoc(2).mapArt,
    ];
    const maps = setupLaneMaps(boardEl, lanePaths);
    onCleanup(maps.dispose);

    const unbindDnd = setupDragDrop({
      boardEl,
      engineState,
      isResolving,
      playerHand: visibleHand,
      cardRefs,
      stageCardInLane: actions.stageCardInLane,
      undoPendingCard: actions.undoPendingCard,
    });
    onCleanup(unbindDnd);

    // Opening sequence — seed the draw queue from the manifest and hand the
    // script runner a ctx bound to the engine store + UI sidecar.
    const drawQueue: ManifestCardDef[] = shuffle(Object.values(manifest.cards)).slice(0, 8);
    const boardWrapEl = boardRef();
    if (!boardWrapEl) return;

    const setPhase = (phase: EngineMatchState['phase']): void => {
      setEngineState('phase', phase);
    };

    const ctx: PlayScriptCtx = {
      state: engineState,
      setState: setEngineState as unknown as PlayScriptCtx['setState'],
      dispatch,
      setPhase,
      ui,
      setUi,
      manifest,
      engineRng,
      boardEl,
      boardWrap: boardWrapEl,
      toastArea: toastAreaEl,
      cardRefs,
      drawQueue,
      deckEl,
    };
    script = createScript(ctx);
    void script.run(openingSequence());
    onCleanup(() => script?.cancel());
  });

  return (
    <>
      <div class="board" id="board" ref={boardEl}>
        {/* TOP HUD */}
        <div class="hud-top">
          <PlayerHud name="PLAYER" side="left" hasPriority={playerHasPriority()} />
          <div class="hud-turn">
            TURN <b>{engineState.turn}</b>
            <span class="hud-energy">
              {' \u00b7 '}
              <b>{engineState.energy['PLAYER']}</b>/<b>{engineState.maxEnergy['PLAYER']}</b> {'\u26a1'}
            </span>
          </div>
          <PlayerHud name="OPPONENT" side="right" hasPriority={!playerHasPriority()} />
        </div>

        <div class="board-game-area">
          <div class="row enemy-row">
            <For each={[0, 1, 2] as const}>
              {(i) => <LaneSlots side="enemy" laneIdx={i} cards={enemyLane(i)} />}
            </For>
          </div>

          <div class="row locations">
            <For each={[0, 1, 2] as const}>
              {(i) => (
                <LocationTile
                  location={laneLoc(i)}
                  laneIdx={i}
                  playerPower={playerPower(i)}
                  enemyPower={enemyPower(i)}
                />
              )}
            </For>
          </div>

          <div class="row player-row">
            <For each={[0, 1, 2] as const}>
              {(i) => <LaneSlots side="player" laneIdx={i} cards={playerLane(i)} />}
            </For>
          </div>
        </div>

        <div class="hand" id="hand" style={{ '--hand-scale': handScale().toFixed(3) }}>
          <For each={visibleHand()}>
            {(card) => <HandCard card={card} playable={card.cost <= engineState.energy['PLAYER']} />}
          </For>
        </div>

        <div class="action-bar">
          <button 
            class="retreat-btn" 
            disabled={isResolving()}
            onClick={() => {
              if (isResolving()) return;
              props.onExit?.();
            }}
          >
            RETREAT
          </button>
          <button
            class="energy-crystal"
            title="Tap to undo last played card"
            disabled={isResolving()}
            onClick={handleUndoPending}
          >
            <div class="crystal">{engineState.energy['PLAYER']}</div>
          </button>
          <button
            class="end-turn"
            disabled={isResolving()}
            onClick={() => {
              if (isResolving() || !script) return;
              void script.run(resolveTurnFlow());
            }}
          >
            END TURN
          </button>
        </div>

        <div
          ref={deckEl}
          class="deck-anchor"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-80px',
            bottom: '120px',
            width: '48px',
            height: '68px',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />

        <div class="toast-area" id="toastArea" ref={toastAreaEl} />
      </div>

      <Portal>
        <Show when={inspectTarget()} keyed>
          {(t) => <ZoomInspector target={t} onClose={closeInspect} />}
        </Show>
      </Portal>
    </>
  );
};
