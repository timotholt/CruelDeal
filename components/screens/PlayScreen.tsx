/**
 * PlayScreen — Step 8c: consumes the engine's `MatchState` directly.
 *
 * All gameplay reads route through `services/playgame/view.ts` selectors
 * (ResolvedCard / ResolvedLocation). Mutations go through the context's
 * `actions.*` (which dispatch engine events) or the script engine's
 * ctx (which calls `dispatch` + VFX). No legacy MatchState.
 */

import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { VfxHost, useVfx } from '../game/VfxHost';
import { PlayGameProvider, usePlayGame } from '@/contexts/PlayGameContext';
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
import { Portal } from '../ui/Portal';
import { ZoomInspector } from './ZoomInspector';
import { PlayerHud } from '../game/PlayerHud';

interface PlayScreenProps {
  onExit?: () => void;
}

export const PlayScreen = (props: PlayScreenProps) => {
  return (
    <div class="playgame-root board-hidden" style={{ width: '100%', height: '100%', background: '#000' }}>
      <VfxHost class="board-wrap" id="boardWrap">
        <PlayGameProvider>
          <BoardSizer />
          <PlayBoard onExit={props.onExit} />
        </PlayGameProvider>
      </VfxHost>
    </div>
  );
};

/**
 * Shared drag state: a module-level mutable object that both <HandCard>
 * (setter on dragstart) and <PlayBoard>'s delegated drop handler (reader
 * on dragover/drop) write to.
 */
const dragState: { id: string | null } = { id: null };

/**
 * Lane-map art shipped with the /play screen. Files live in public/art/maps/.
 */
const LANE_MAPS = [
  '/art/maps/Cathedrawl.png',
  '/art/maps/Jungle.png',
  '/art/maps/Laboratory.png',
];

/**
 * Inspector target. `card` mode shows a blown-up card face-up; `location`
 * mode shows a lane location.
 */
type InspectTarget =
  | { kind: 'card'; card: ResolvedCard; zone: 'hand' | 'board'; side: 'player' | 'enemy'; laneIdx?: number; element: HTMLElement }
  | { kind: 'location'; location: ResolvedLocation; laneIdx: number; playerPower: number; enemyPower: number; element: HTMLElement };

const [inspectTarget, setInspectTarget] = createSignal<InspectTarget | null>(null);
const openInspect = (t: InspectTarget) => setInspectTarget(t);
const closeInspect = () => setInspectTarget(null);

/** Fisher–Yates shuffle. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Sets --board-w / --board-h on :root.
const BoardSizer = () => {
  const apply = () => {
    const w = Math.min((window.innerHeight * 9) / 16, window.innerWidth, 420);
    const h = (w * 16) / 9;
    document.documentElement.style.setProperty('--board-w', w + 'px');
    document.documentElement.style.setProperty('--board-h', h + 'px');
  };
  const applyToastY = () => {
    const board = document.querySelector('.board') as HTMLElement | null;
    const locs = board?.querySelector('.locations') as HTMLElement | null;
    if (!board || !locs) return;
    const boardRect = board.getBoundingClientRect();
    const locsRect = locs.getBoundingClientRect();
    const locsCenterY = locsRect.top + locsRect.height / 2 - boardRect.top;
    const pct = (locsCenterY / boardRect.height) * 100;
    board.style.setProperty('--message-center-y', pct.toFixed(1) + '%');
  };
  onMount(() => {
    apply();
    window.addEventListener('resize', apply);
    requestAnimationFrame(applyToastY);
    window.addEventListener('resize', applyToastY);
    onCleanup(() => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('resize', applyToastY);
    });
  });
  return null;
};

// PlayBoard — mirrors <div class="board"> from demo index.html.
const PlayBoard = (props: { onExit?: () => void }) => {
  const pg = usePlayGame();
  const { engineState, setEngineState, dispatch, manifest, ui, setUi, engineRng, isResolving, actions } = pg;
  const { cardRefs, boardRef } = useVfx();

  // Derived UI projections.
  const playerHand = createMemo<ResolvedCard[]>(() => getPlayerHand(engineState, manifest));
  const playerLane = (i: LaneIdx): ResolvedCard[] => getPlayerLaneCards(engineState, i, manifest);
  const enemyLane = (i: LaneIdx): ResolvedCard[] => getEnemyLaneCards(engineState, i, manifest);
  const laneLoc = (i: LaneIdx): ResolvedLocation => getLocation(engineState, i, manifest);
  const playerPower = (i: LaneIdx): number => getLanePower(engineState, i, 'PLAYER', manifest);
  const enemyPower = (i: LaneIdx): number => getLanePower(engineState, i, 'OPP', manifest);
  const playerHasPriority = createMemo(() => engineState.priority === 'PLAYER');
  const handScale = createMemo(() => {
    const n = playerHand().length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
  });

  const handleUndoPending = () => {
    // Find last player-staged card in stagingOrder.
    const lastStaged = [...engineState.stagingOrder]
      .reverse()
      .find((id) => engineState.cards[id]?.owner === 'PLAYER');
    if (!lastStaged) return;
    // Capture lane card rect + all current hand card rects before mutation.
    const allIds = [lastStaged as string, ...playerHand().map((c) => c.id)];
    const oldRects = captureHandRects(allIds, cardRefs);
    actions.undoPending();
    requestAnimationFrame(() => {
      playLayoutSlide(oldRects, cardRefs);
    });
  };

  // Script instance for running opening + resolve-turn flows.
  let script: Script | undefined;

  let boardEl: HTMLDivElement | undefined;
  let toastAreaEl: HTMLDivElement | undefined;
  let deckEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!boardEl || !toastAreaEl) return;
    boardEl.classList.add('ready');

    // ── Lane maps ──────────────────────────────────────────────────────
    const mapPaths = shuffle([...LANE_MAPS]).slice(0, 3);
    const mapEls: HTMLDivElement[] = mapPaths.map((path, i) => {
      const el = document.createElement('div');
      el.className = 'lane-map';
      el.dataset.lane = String(i);
      el.style.cssText = `position:absolute; pointer-events:none; background-image:url("${path}")`;
      boardEl!.prepend(el);
      return el;
    });
    const layoutLaneMaps = () => {
      const boardRect = boardEl!.getBoundingClientRect();
      for (let i = 0; i < 3; i++) {
        const top = boardEl!.querySelector(`.enemy-row [data-lane="${i}"]`) as HTMLElement | null;
        const bot = boardEl!.querySelector(`.player-row [data-lane="${i}"]`) as HTMLElement | null;
        const map = mapEls[i];
        if (!top || !bot || !map) continue;
        const topRect = top.getBoundingClientRect();
        const botRect = bot.getBoundingClientRect();
        map.style.left = `${topRect.left - boardRect.left}px`;
        map.style.top = `${topRect.top - boardRect.top}px`;
        map.style.width = `${topRect.width}px`;
        map.style.height = `${botRect.bottom - topRect.top}px`;
      }
    };
    requestAnimationFrame(layoutLaneMaps);
    const ro = new ResizeObserver(layoutLaneMaps);
    ro.observe(boardEl);
    onCleanup(() => {
      ro.disconnect();
      mapEls.forEach((el) => el.remove());
    });

    // ── Drag-and-drop ─────────────────────────────────────────────────
    const getPlayerLaneSlots = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null;
      while (el && el !== boardEl) {
        if (el.classList?.contains('lane-slots') && el.dataset.side === 'player') return el;
        el = el.parentElement;
      }
      return null;
    };
    const clearDropState = () => {
      boardEl!.querySelectorAll('.lane-slots.drop-target').forEach((s) => s.classList.remove('drop-target'));
      boardEl!.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
    };
    const onDragOver = (e: DragEvent) => {
      if (!dragState.id) return;
      if (isResolving()) return;
      const slotEl = getPlayerLaneSlots(e.target);
      if (!slotEl) return;
      const lane = Number(slotEl.dataset.lane) as LaneIdx;
      if (engineState.lanes[lane].cards['PLAYER'].length >= 4) return;
      e.preventDefault();
      clearDropState();
      slotEl.classList.add('drop-target');
      const nextSlot = [...slotEl.querySelectorAll('.slot')].find(
        (s) => !s.querySelector('.card'),
      ) as HTMLElement | undefined;
      nextSlot?.classList.add('next-drop');
    };
    const onDragLeave = (e: DragEvent) => {
      const slotEl = getPlayerLaneSlots(e.target);
      const related = (e as DragEvent).relatedTarget as Node | null;
      if (slotEl && !slotEl.contains(related)) {
        slotEl.classList.remove('drop-target');
        slotEl.querySelectorAll('.slot.next-drop').forEach((s) => s.classList.remove('next-drop'));
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const slotEl = getPlayerLaneSlots(e.target);
      clearDropState();
      boardEl!.classList.remove('dragging-card');
      if (isResolving()) return;
      if (!slotEl || !dragState.id) return;
      const lane = Number(slotEl.dataset.lane);
      const handIds = playerHand().map((c) => c.id);
      const oldRects = captureHandRects(handIds, cardRefs);
      actions.stageCardInLane(dragState.id, lane);
      requestAnimationFrame(() => {
        playLayoutSlide(oldRects, cardRefs);
      });
    };
    const onDragStart = () => boardEl!.classList.add('dragging-card');
    const onDragEnd = () => { boardEl!.classList.remove('dragging-card'); clearDropState(); };
    boardEl.addEventListener('dragstart', onDragStart);
    boardEl.addEventListener('dragend', onDragEnd);
    boardEl.addEventListener('dragover', onDragOver);
    boardEl.addEventListener('dragleave', onDragLeave);
    boardEl.addEventListener('drop', onDrop);
    onCleanup(() => {
      boardEl!.removeEventListener('dragstart', onDragStart);
      boardEl!.removeEventListener('dragend', onDragEnd);
      boardEl!.removeEventListener('dragover', onDragOver);
      boardEl!.removeEventListener('dragleave', onDragLeave);
      boardEl!.removeEventListener('drop', onDrop);
    });

    // ── Opening sequence ──────────────────────────────────────────────
    // Seed the draw queue from the manifest (shuffle, take 8).
    const drawQueue: ManifestCardDef[] = shuffle(Object.values(manifest.cards)).slice(0, 8);
    const boardWrapEl = boardRef();
    if (!boardWrapEl) return;

    // setPhase helper via setEngineState for RESOLVING ↔ AWAITING_INTENT.
    const setPhase = (phase: EngineMatchState['phase']) => {
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
        <PlayerHud
          name="PLAYER"
          side="left"
          hasPriority={playerHasPriority()}
        />
        <div class="hud-turn">
          TURN <b>{engineState.turn}</b>
          <span class="hud-energy">
            {' \u00b7 '}
            <b>{engineState.energy['PLAYER']}</b>/<b>{engineState.maxEnergy}</b> {'\u26a1'}
          </span>
        </div>
        <PlayerHud
          name="OPPONENT"
          side="right"
          hasPriority={!playerHasPriority()}
        />
      </div>

      {/* GAME AREA: enemy lanes - locations - player lanes */}
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

      {/* HAND */}
      <div class="hand" id="hand" style={{ '--hand-scale': handScale().toFixed(3) }}>
        <For each={playerHand()}>
          {(card) => <HandCard card={card} playable={card.cost <= engineState.energy['PLAYER']} />}
        </For>
      </div>

      {/* ACTION BAR */}
      <div class="action-bar">
        <button class="retreat-btn" onClick={() => props.onExit?.()}>
          RETREAT
        </button>
        <button
          class="energy-crystal"
          title="Tap to use energy / hold to undo"
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

      {/* Deck anchor */}
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
      <InspectOverlay />
    </Portal>
    </>
  );
};

// ─── InspectOverlay ─────────────────────────────────────────────────────
const InspectOverlay = () => {
  return (
    <Show when={inspectTarget()} keyed>
      {(t) => <ZoomInspector target={t} onClose={closeInspect} />}
    </Show>
  );
};

// ─── LaneSlots ──────────────────────────────────────────────────────────
const LaneSlots = (props: {
  side: 'player' | 'enemy';
  laneIdx: number;
  cards: ResolvedCard[];
}) => {
  const slotCardForGrid = (gridIdx: number): ResolvedCard | undefined => {
    const mapping = props.side === 'enemy' ? [2, 3, 0, 1] : [0, 1, 2, 3];
    const s = mapping.indexOf(gridIdx);
    return props.cards[s];
  };

  return (
    <div
      class={'lane-slots ' + (props.side === 'enemy' ? 'top' : 'bot')}
      data-lane={props.laneIdx}
      data-side={props.side}
    >
      <For each={[0, 1, 2, 3]}>
        {(gridIdx) => (
          <div class="slot" data-slot={gridIdx}>
            <Show when={slotCardForGrid(gridIdx)} keyed>
              {(c) => (
                <BoardCard
                  card={c}
                  enemy={props.side === 'enemy'}
                  side={props.side}
                  laneIdx={props.laneIdx}
                />
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};

// ─── LocationTile ───────────────────────────────────────────────────────
const LocationTile = (props: {
  location: ResolvedLocation;
  laneIdx: number;
  playerPower: number;
  enemyPower: number;
}) => {
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    openInspect({
      kind: 'location',
      location: props.location,
      laneIdx: props.laneIdx,
      playerPower: props.playerPower,
      enemyPower: props.enemyPower,
      element: e.currentTarget as HTMLElement,
    });
  };
  return (
    <div
      class={'location' + (props.location.revealed ? '' : ' location--hidden')}
      data-lane={props.laneIdx}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div class="lane-score enemy-score">{props.enemyPower}</div>
      <div class="loc-name">{props.location.revealed ? props.location.name : '???'}</div>
      <div class="loc-desc">{props.location.revealed ? props.location.desc : ''}</div>
      <div class="lane-score player-score">{props.playerPower}</div>
    </div>
  );
};

// ─── BoardCard ───────────────────────────────────────────────────────────
const BoardCard = (props: {
  card: ResolvedCard;
  enemy?: boolean;
  side: 'player' | 'enemy';
  laneIdx: number;
}) => {
  const { ui } = usePlayGame();
  const { bindCardRef } = useVfx();

  // Face-down logic: unrevealed enemy cards are always face-down; unrevealed
  // player cards are face-down only during resolution (ui.isFlipped = true).
  const isFaceDown = () => {
    if (props.card.revealed) return false;
    if (props.card.owner === 'OPP') return true;
    return ui.isFlipped;
  };
  const isPending = isFaceDown; // kept for .pending styling parity
  const powerClass = () => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };
  const tilt = () => {
    let h = 0;
    for (let i = 0; i < props.card.id.length; i++)
      h = ((h << 5) - h + props.card.id.charCodeAt(i)) | 0;
    const direction = h % 2 === 0 ? 1 : -1;
    const magnitude = 0.1 + (Math.abs(h) % 10) / 10;
    return (direction * magnitude).toFixed(1) + 'deg';
  };

  const onClick = (e: MouseEvent) => {
    if (isFaceDown()) return;
    e.stopPropagation();
    openInspect({
      kind: 'card',
      card: props.card,
      zone: 'board',
      side: props.side,
      laneIdx: props.laneIdx,
      element: e.currentTarget as HTMLElement,
    });
  };

  return (
    <div
      ref={bindCardRef(props.card.id)}
      class={
        'card' +
        (props.enemy ? ' enemy' : '') +
        (isFaceDown() ? ' facedown' : '') +
        (isPending() ? ' pending' : '')
      }
      data-card-id={props.card.id}
      style={{ '--card-tilt': tilt(), cursor: isFaceDown() ? 'default' : 'pointer' }}
      onClick={onClick}
    >
      <div class="cost">{props.card.cost}</div>
      <div class={'power ' + powerClass()}>{props.card.power}</div>
      <div class="bar" style={{ background: props.card.art }} />
      <div class="name">{props.card.name}</div>
      <div class="type">{props.card.type}</div>
    </div>
  );
};

// ─── HandCard ───────────────────────────────────────────────────────────
const HandCard = (props: { card: ResolvedCard; playable: boolean }) => {
  const { bindCardRef } = useVfx();

  const powerClass = () => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };

  const onDragStart = (e: DragEvent) => {
    dragState.id = props.card.id;
    (e.currentTarget as HTMLElement).classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', props.card.id);
    }
  };
  const onDragEnd = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('dragging');
    dragState.id = null;
  };
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    openInspect({
      kind: 'card',
      card: props.card,
      zone: 'hand',
      side: 'player',
      element: e.currentTarget as HTMLElement,
    });
  };

  return (
    <div
      ref={bindCardRef(props.card.id)}
      class="card"
      data-card-id={props.card.id}
      style={{ opacity: props.playable ? 1 : 0.5, cursor: 'pointer', transition: 'opacity 0.5s ease' }}
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div class="cost">{props.card.cost}</div>
      <div class={'power ' + powerClass()}>{props.card.power}</div>
      <div class="bar" style={{ background: props.card.art }} />
      <div class="name">{props.card.name}</div>
      <div class="type">{props.card.type}</div>
    </div>
  );
};

