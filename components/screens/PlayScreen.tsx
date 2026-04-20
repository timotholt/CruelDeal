/**
 * PlayScreen — 1:1 Solid port of the vfx-engine demo's DOM, so the CSS
 * in src/styles/playgame.css applies unchanged.
 *
 * Visual structure matches ccg/vfx-engine/project/index.html (the original
 * demo). Card and location rendering mirrors `ui/card.js` / `ui/location.js`.
 */

import { For, Show, createMemo, onCleanup, onMount } from 'solid-js';
import { VfxHost, useVfx } from '../game/VfxHost';
import { PlayGameProvider, usePlayGame } from '@/contexts/PlayGameContext';
import type { CardInstance, LocationInstance } from '@/services/playgame/types';
import { CARD_POOL } from '@/services/playgame/cards';
import { createScript } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence } from '@/services/playgame/script/flows';

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
  const { cardRefs } = useVfx();

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

  onMount(() => {
    if (!boardEl || !toastAreaEl) return;
    boardEl.classList.add('ready');

    // Seed a randomised draw queue and kick off the opening cinematic.
    // The script engine mutates state through our Solid setState so
    // cards fly into the hand reactively.
    const drawQueue = shuffle([...CARD_POOL]).slice(0, 8);
    const ctx: PlayScriptCtx = {
      state,
      setState,
      boardEl,
      toastArea: toastAreaEl,
      cardRefs,
      drawQueue,
    };
    const script = createScript(ctx);
    void script.run(openingSequence());

    // Cancel the flow if the screen unmounts mid-animation.
    onCleanup(() => script.cancel());
  });

  const handScale = createMemo(() => {
    const n = state.hand.length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
  });

  return (
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
          onClick={() => actions.endTurn()}
        >
          END TURN
        </button>
      </div>

      <div class="toast-area" id="toastArea" ref={toastAreaEl} />
    </div>
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
  const { actions, state } = usePlayGame();

  // Build 4 slots, mapping cards[s] -> grid index.
  // Player: s==0 -> grid 0 (top-left), s==1 -> 1, s==2 -> 2, s==3 -> 3.
  // Enemy:  s==0 -> grid 2 (bottom-left), s==1 -> 3, s==2 -> 0, s==3 -> 1.
  const slotCardForGrid = (gridIdx: number): CardInstance | undefined => {
    const mapping = props.side === 'enemy' ? [2, 3, 0, 1] : [0, 1, 2, 3];
    const s = mapping.indexOf(gridIdx);
    return props.cards[s];
  };

  const canDrop = () =>
    props.side === 'player' &&
    state.hand.length > 0 &&
    props.cards.length < 4 &&
    !state.resolving;

  return (
    <div
      class={'lane-slots ' + (props.side === 'enemy' ? 'top' : 'bot')}
      data-lane={props.laneIdx}
      data-side={props.side}
      onClick={() => {
        // Demo: clicking a lane plays the first hand card into it.
        // Temporary interaction until drag-and-drop is wired in a later slice.
        if (!canDrop()) return;
        const first = state.hand[0];
        if (first) actions.stageCardInLane(first.id, props.laneIdx);
      }}
    >
      <For each={[0, 1, 2, 3]}>
        {(gridIdx) => (
          // Each slot re-renders reactively: `when` is a getter that reads
          // props.cards[s] which is a store proxy. Using keyed so the child
          // receives the card directly (not an accessor).
          <div class="slot" data-slot={gridIdx}>
            <Show when={slotCardForGrid(gridIdx)} keyed>
              {(c) => <BoardCard card={c} enemy={props.side === 'enemy'} />}
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
  return (
    <div
      class={'location' + (props.location.revealed ? '' : ' location--hidden')}
      data-lane={props.laneIdx}
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
const BoardCard = (props: { card: CardInstance; enemy?: boolean }) => {
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
      style={{ '--card-tilt': tilt() }}
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

  return (
    <div
      ref={bindCardRef(props.card.id)}
      class="card"
      data-card-id={props.card.id}
      style={{ opacity: props.playable ? 1 : 0.5 }}
      draggable={true}
    >
      <div class="cost">{props.card.cost}</div>
      <div class={'power ' + powerClass()}>{props.card.power}</div>
      <div class="bar" style={{ background: props.card.art }} />
      <div class="name">{props.card.name}</div>
      <div class="type">{props.card.type}</div>
    </div>
  );
};
