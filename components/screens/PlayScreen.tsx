/**
 * PlayScreen — 1:1 Solid port of the vfx-engine demo's DOM, so the CSS
 * in src/styles/playgame.css applies unchanged.
 *
 * Visual structure matches ccg/vfx-engine/project/index.html (the original
 * demo). Card and location rendering mirrors `ui/card.js` / `ui/location.js`.
 */

import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { VfxHost, useVfx } from '../game/VfxHost';
import { PlayGameProvider, usePlayGame } from '@/contexts/PlayGameContext';
import type { CardInstance, LocationInstance } from '@/services/playgame/types';
import { CARD_POOL } from '@/services/playgame/cards';
import { createScript, type Script } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence, resolveTurnFlow } from '@/services/playgame/script/flows';
import { Portal } from '../ui/Portal';
import { ZoomInspector } from './ZoomInspector';

interface PlayScreenProps {
  onExit?: () => void;
}

export const PlayScreen = (props: PlayScreenProps) => {
  return (
    <div class="playgame-root" style={{ width: '100%', height: '100%', background: '#000' }}>
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
 * on dragover/drop) write to. A plain object is fine — the values are
 * only read inside native drag events, never in Solid's reactive graph.
 */
const dragState: { id: string | null } = { id: null };

/**
 * Lane-map art shipped with the /play screen. Files live in public/art/maps/
 * so Vite serves them at the root. Order is shuffled per match so each
 * session picks a different 3 of 3 (for now all 3 are used).
 */
const LANE_MAPS = [
  '/art/maps/Cathedrawl.png',
  '/art/maps/Jungle.png',
  '/art/maps/Laboratory.png',
];

/**
 * Inspector target. `card` mode shows a blown-up card face-up; `location`
 * mode shows a lane location (revealed or hidden). Null = closed.
 *
 * Defined at module scope so any sub-component (HandCard, BoardCard,
 * LocationTile) can open the inspector without needing to thread props
 * or a separate context through the tree. This mirrors the demo's
 * singleton `Inspector` (ccg/vfx-engine/project/ui/inspector.js).
 */
type InspectTarget =
  | { kind: 'card'; card: CardInstance; zone: 'hand' | 'board'; side: 'player' | 'enemy'; laneIdx?: number; element: HTMLElement }
  | { kind: 'location'; location: LocationInstance; laneIdx: number; playerPower: number; enemyPower: number; element: HTMLElement };

const [inspectTarget, setInspectTarget] = createSignal<InspectTarget | null>(null);
const openInspect = (t: InspectTarget) => {
  setInspectTarget(t);
};
const closeInspect = () => {
  setInspectTarget(null);
};

/** Fisher–Yates shuffle (matches the helper in the demo's board.js). */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Sets --board-w / --board-h on :root (mirrors applyBoardSize() from demo).
const BoardSizer = () => {
  const apply = () => {
    const w = Math.min((window.innerHeight * 9) / 16, window.innerWidth, 420);
    const h = (w * 16) / 9;
    document.documentElement.style.setProperty('--board-w', w + 'px');
    document.documentElement.style.setProperty('--board-h', h + 'px');
  };
  onMount(() => {
    apply();
    window.addEventListener('resize', apply);
    onCleanup(() => window.removeEventListener('resize', apply));
  });
  return null;
};

// PlayBoard — mirrors <div class="board"> from demo index.html.
const PlayBoard = (props: { onExit?: () => void }) => {
  const { state, setState, actions, isResolving } = usePlayGame();
  const { cardRefs, boardRef } = useVfx();
  // Script instance — captured in onMount so END TURN can replay flows
  // against the same ctx used by the opening sequence.
  let script: Script | undefined;

  // Power totals per lane (demo does this in renderLocations()).
  const playerPower = (laneIdx: number) =>
    state.lanes[laneIdx].reduce((sum, c) => sum + c.power, 0);
  const enemyPower = (laneIdx: number) =>
    state.enemyLanes[laneIdx].reduce((sum, c) => sum + c.power, 0);

  // `.board` ships with `visibility: hidden` to avoid a flash of unsized
  // layout; the demo's JS adds `.ready` once content is rendered. We do
  // the same in Solid via onMount.
  let boardEl: HTMLDivElement | undefined;
  let toastAreaEl: HTMLDivElement | undefined;
  // Deck anchor — visual origin for the draw-slide animation. Positioned
  // absolutely at the right edge of the board via CSS (see playgame.css).
  let deckEl: HTMLDivElement | undefined;

  onMount(() => {
    if (!boardEl || !toastAreaEl) return;
    boardEl.classList.add('ready');

    // ── Lane maps ──────────────────────────────────────────────────────
    // Mirrors createLaneMaps() + layoutLaneMaps() from the demo's
    // board.js. Three <div class="lane-map"> overlays are absolutely
    // positioned over each lane column and fade from 0→1 when the
    // matching location is revealed (handled by the reveal cinematic).
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
    // Initial layout (once the DOM has painted) + relayout on resize.
    requestAnimationFrame(layoutLaneMaps);
    const ro = new ResizeObserver(layoutLaneMaps);
    ro.observe(boardEl);
    onCleanup(() => {
      ro.disconnect();
      mapEls.forEach((el) => el.remove());
    });

    // ── Drag-and-drop ─────────────────────────────────────────────────
    // Delegated dragover/drop on the board, mirroring the demo's setup
    // in index.html. Hand cards are flagged draggable; dragstart stores
    // the card id on a closure var; dropping on a player lane stages it.
    const getPlayerLaneSlots = (target: EventTarget | null): HTMLElement | null => {
      let el = target as HTMLElement | null;
      while (el && el !== boardEl) {
        if (el.classList?.contains('lane-slots') && el.dataset.side === 'player') return el;
        el = el.parentElement;
      }
      return null;
    };
    const onDragOver = (e: DragEvent) => {
      if (!dragState.id) return;
      // Lock out drops while the end-turn flow is running — otherwise a
      // mid-reveal drop would push a new id into state.pending AFTER the
      // reveal snapshot was taken, stranding the card face-down.
      if (state.resolving) return;
      const slotEl = getPlayerLaneSlots(e.target);
      if (!slotEl) return;
      const lane = Number(slotEl.dataset.lane);
      if (state.lanes[lane].length >= 4) return;
      e.preventDefault();
      boardEl!.querySelectorAll('.lane-slots.drop-target').forEach((s) => s.classList.remove('drop-target'));
      slotEl.classList.add('drop-target');
    };
    const onDragLeave = (e: DragEvent) => {
      const slotEl = getPlayerLaneSlots(e.target);
      const related = (e as DragEvent).relatedTarget as Node | null;
      if (slotEl && !slotEl.contains(related)) slotEl.classList.remove('drop-target');
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const slotEl = getPlayerLaneSlots(e.target);
      boardEl!.querySelectorAll('.lane-slots.drop-target').forEach((s) => s.classList.remove('drop-target'));
      if (state.resolving) return;
      if (!slotEl || !dragState.id) return;
      const lane = Number(slotEl.dataset.lane);
      actions.stageCardInLane(dragState.id, lane);
    };
    boardEl.addEventListener('dragover', onDragOver);
    boardEl.addEventListener('dragleave', onDragLeave);
    boardEl.addEventListener('drop', onDrop);
    onCleanup(() => {
      boardEl!.removeEventListener('dragover', onDragOver);
      boardEl!.removeEventListener('dragleave', onDragLeave);
      boardEl!.removeEventListener('drop', onDrop);
    });

    // ── Opening sequence ──────────────────────────────────────────────
    // Seed a randomised draw queue and kick off the opening cinematic.
    // The script engine mutates state through our Solid setState so
    // cards fly into the hand reactively.
    const drawQueue = shuffle([...CARD_POOL]).slice(0, 8);
    const boardWrapEl = boardRef();
    if (!boardWrapEl) return;
    const ctx: PlayScriptCtx = {
      state,
      setState,
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

  const handScale = createMemo(() => {
    const n = state.hand.length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
  });

  return (
    <>
    <div class="board" id="board" ref={boardEl}>
      {/* TOP HUD */}
      <div class="hud-top">
        <div class="hud-player hud-player--self">
          <div class="hud-avatar" />
          <span class="hud-name">PLAYER</span>
        </div>
        <div class="hud-turn">
          TURN <b>{state.turn}</b>
          <span class="hud-energy">
            {' \u00b7 '}
            <b>{state.energy}</b>/<b>{state.energyMax}</b> {'\u26a1'}
          </span>
        </div>
        <div class="hud-player hud-player--opponent">
          <span class="hud-name">OPPONENT</span>
          <div class="hud-avatar" />
        </div>
      </div>

      {/* GAME AREA: enemy lanes - locations - player lanes */}
      <div class="board-game-area">
        <div class="row enemy-row">
          <For each={[0, 1, 2]}>
            {(i) => <LaneSlots side="enemy" laneIdx={i} cards={state.enemyLanes[i]} />}
          </For>
        </div>

        <div class="row locations">
          <For each={state.locations}>
            {(loc, i) => (
              <LocationTile
                location={loc}
                laneIdx={i()}
                playerPower={playerPower(i())}
                enemyPower={enemyPower(i())}
              />
            )}
          </For>
        </div>

        <div class="row player-row">
          <For each={[0, 1, 2]}>
            {(i) => <LaneSlots side="player" laneIdx={i} cards={state.lanes[i]} />}
          </For>
        </div>
      </div>

      {/* HAND */}
      <div class="hand" id="hand" style={{ '--hand-scale': handScale().toFixed(3) }}>
        <For each={state.hand}>
          {(card) => <HandCard card={card} playable={card.cost <= state.energy} />}
        </For>
      </div>

      {/* ACTION BAR: RETREAT - energy/undo - END TURN */}
      <div class="action-bar">
        <button
          class="retreat-btn"
          onClick={() => props.onExit?.()}
        >
          RETREAT
        </button>
        <button
          class="energy-crystal"
          title="Tap to use energy / hold to undo"
          onClick={() => actions.undoPending()}
        >
          <div class="crystal">{state.energy}</div>
        </button>
        <button
          class="end-turn"
          disabled={isResolving()}
          onClick={() => {
            // Run the full resolve-turn flow: reveal pending → enemy play
            // → advance turn → draw → maybe reveal next location.
            // `isResolving()` is derived from state.resolving, so the
            // disabled attribute and this guard share a source of truth.
            if (isResolving() || !script) return;
            void script.run(resolveTurnFlow());
          }}
        >
          END TURN
        </button>
      </div>

      {/* Deck anchor — a pure positioning marker for the draw-slide
          animation. Sits just outside the right edge of the board (off-
          screen relative to the visible board area) so slides clearly
          originate from "the deck" without rendering anything visible
          behind the hand. A later slice can swap this for a real deck
          stack sprite. */}
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

    {/* Inspector overlay — portaled to body to avoid layout breakage */}
    <Portal>
      <InspectOverlay />
    </Portal>
    </>
  );
};

// ─── InspectOverlay ─────────────────────────────────────────────────────
// Zoom inspector — clones card and transforms to center with text below.
const InspectOverlay = () => {
  return (
    <Show when={inspectTarget()} keyed>
      {(t) => <ZoomInspector target={t} onClose={closeInspect} />}
    </Show>
  );
};

// ─── LaneSlots ──────────────────────────────────────────────────────────
// Demo uses a 4-slot 2x2 grid per lane. Opponent mapping reverses the rows
// so the closest row is nearest the center (see board.js comment).
const LaneSlots = (props: {
  side: 'player' | 'enemy';
  laneIdx: number;
  cards: CardInstance[];
}) => {
  // Build 4 slots, mapping cards[s] -> grid index.
  // Player: s==0 -> grid 0 (top-left), s==1 -> 1, s==2 -> 2, s==3 -> 3.
  // Enemy:  s==0 -> grid 2 (bottom-left), s==1 -> 3, s==2 -> 0, s==3 -> 1.
  const slotCardForGrid = (gridIdx: number): CardInstance | undefined => {
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
          // Each slot re-renders reactively: `when` is a getter that reads
          // props.cards[s] which is a store proxy. Using keyed so the child
          // receives the card directly (not an accessor).
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
// Mirrors ui/location.js. Revealed tiles show name + desc; unrevealed show
// "???" with lane-power scores on both sides.
const LocationTile = (props: {
  location: LocationInstance;
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
// A card sitting in a lane slot. Face-down while in state.pending; face-up
// otherwise. Mirrors ui/card.js's DOM.
const BoardCard = (props: {
  card: CardInstance;
  enemy?: boolean;
  side: 'player' | 'enemy';
  laneIdx: number;
}) => {
  const { state } = usePlayGame();
  const { bindCardRef } = useVfx();

  const isPending = () => state.pending.includes(props.card.id);
  const isFaceDown = () => isPending();
  const powerClass = () => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };
  // Deterministic tilt per id (same hash as demo's cardTilt()).
  const tilt = () => {
    let h = 0;
    for (let i = 0; i < props.card.id.length; i++)
      h = ((h << 5) - h + props.card.id.charCodeAt(i)) | 0;
    const direction = h % 2 === 0 ? 1 : -1;
    const magnitude = 0.1 + (Math.abs(h) % 10) / 10;
    return (direction * magnitude).toFixed(1) + 'deg';
  };

  const onClick = (e: MouseEvent) => {
    // Face-down (pending) cards stay a mystery — the demo blocks the
    // inspector for these too.
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
// A card in the player's hand. Same DOM as BoardCard minus the tilt/placement,
// plus an opacity dim when unplayable (cost > current energy).
const HandCard = (props: { card: CardInstance; playable: boolean }) => {
  const { bindCardRef } = useVfx();

  const powerClass = () => {
    const c = props.card;
    if (c.power > c.basePower) return 'buffed';
    if (c.power < c.basePower) return 'debuffed';
    return '';
  };

  const onDragStart = (e: DragEvent) => {
    // Mirrors the demo's onDragStart: flag the card id on the shared
    // module-level dragState, add `.dragging` for CSS, and tell the
    // native DnD system what's allowed.
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
    // Clicks after a drag are suppressed by the browser automatically
    // when the drag actually moves. This fires only on genuine taps.
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
      style={{ opacity: props.playable ? 1 : 0.5, cursor: 'pointer' }}
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
