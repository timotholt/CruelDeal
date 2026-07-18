/**
 * CityMapScreen — city-map experiment shell for the /citymap route.
 *
 * This is parked as an authoring/tooling experiment. The actual game now lives
 * on the three-lane board at `/play`.
 */

import { For, createMemo } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayGameProvider, usePlayGame } from '@/contexts/PlayGameContext';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import { validateMatchBootstrap } from '@/services/playgame/runtime/bootstrapValidation';
import { getHandForSeat } from '@/services/playgame/view';
import { BoardSizer } from './play/BoardSizer';
import { EnergyBadge } from './play/EnergyBadge';
import { HandCard } from './play/HandCard';
import { HiddenHandIndicator } from './play/HiddenHandIndicator';
import { TurnOrb } from './play/TurnOrb';
import { CityMapBoard } from './play/city-map/CityMapBoard';

interface CityMapScreenProps {
  onExit?: () => void;
}

function makeMatchSeed() {
  return `match-${Date.now().toString(36)}`;
}

const CityGameBoard = (props: CityMapScreenProps) => {
  const pg = usePlayGame();
  const { engineState, manifest, localSeat, remoteSeat, seatMeta } = pg;
  const localHand = createMemo(() => getHandForSeat(engineState, localSeat, manifest));
  const remoteHandSize = createMemo(() => engineState.hand[remoteSeat].length);
  const localDeckSize = createMemo(() => engineState.deck[localSeat].length);
  const remoteDeckSize = createMemo(() => engineState.deck[remoteSeat].length);

  return (
    <div class="board city-game-board ready" id="board">
      <div class="hud-top city-game-board__hud">
        <div class="hud-top__side hud-top__side--left">
          <div class="city-player-chip city-player-chip--local">
            <span class="city-player-chip__avatar">{seatMeta[localSeat].name.slice(0, 1)}</span>
            <span class="city-player-chip__meta">
              <span class="city-player-chip__name">{seatMeta[localSeat].name}</span>
              <span class="city-player-chip__sub">Deck {localDeckSize()}</span>
            </span>
          </div>
        </div>

        <div class="hud-top__center">
          <TurnOrb turn={engineState.turn} />
        </div>

        <div class="hud-top__side hud-top__side--right">
          <div class="opponent-cluster">
            <HiddenHandIndicator count={remoteHandSize()} />
            <div class="opponent-stat" title={`Deck ${remoteDeckSize()}`}>
              <span class="opponent-stat__label">Deck</span>
              <span class="opponent-stat__value">{remoteDeckSize()}</span>
            </div>
            <EnergyBadge value={engineState.energy[remoteSeat]} title={`Opponent energy ${engineState.energy[remoteSeat]}`} />
            <div class="city-player-chip city-player-chip--remote">
              <span class="city-player-chip__meta city-player-chip__meta--right">
                <span class="city-player-chip__name">{seatMeta[remoteSeat].name}</span>
                <span class="city-player-chip__sub">Rival</span>
              </span>
              <span class="city-player-chip__avatar city-player-chip__avatar--remote">{seatMeta[remoteSeat].name.slice(0, 1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="board-game-area city-map-game-area">
        <CityMapBoard seed={engineState.seed} interactive showVenueTooltips />
      </div>

      <div class="city-hand-row">
        <div class="city-deck-stack" aria-label={`Deck ${localDeckSize()}`}>
          <div class="city-deck-card city-deck-card--3" />
          <div class="city-deck-card city-deck-card--2" />
          <div class="city-deck-card city-deck-card--1" />
          <div class="city-deck-count">{localDeckSize()}</div>
        </div>
        <div class="hand city-hand" id="hand" style={{ '--hand-scale': '0.72' }}>
          <For each={localHand()}>
            {(card) => (
              <HandCard
                card={card}
                playable={card.cost <= engineState.energy[localSeat]}
                interactive={false}
              />
            )}
          </For>
        </div>
      </div>

      <div class="action-bar city-action-bar">
        <button class="retreat-btn" type="button" onClick={() => props.onExit?.()}>
          RETREAT
        </button>
        <button class="energy-button" type="button" title={`Your energy ${engineState.energy[localSeat]}`}>
          <EnergyBadge value={engineState.energy[localSeat]} />
        </button>
        <button class="end-turn" type="button">
          END TURN
        </button>
      </div>
    </div>
  );
};

export const CityMapScreen = (props: CityMapScreenProps) => {
  const candidate = buildDebugMatchBootstrap(DEBUG_DECKS[0], DEBUG_DECKS[1], makeMatchSeed());
  const validation = validateMatchBootstrap(candidate, BOOTSTRAP_MANIFEST);
  if (!validation.ok) throw new Error(JSON.stringify(validation.issues));

  return (
    <div class="playgame-root city-play-root" style={{ width: '100%', height: '100%', background: '#000' }}>
      <VfxHost class="board-wrap" id="boardWrap">
        <PlayGameProvider bootstrap={validation.value}>
          <BoardSizer />
          <CityGameBoard onExit={props.onExit} />
        </PlayGameProvider>
      </VfxHost>
    </div>
  );
};
