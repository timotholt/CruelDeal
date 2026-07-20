/**
 * CityMapScreen — city-map experiment shell for the /citymap route.
 *
 * This is parked as an authoring/tooling experiment. The actual game now lives
 * on the three-lane board at `/play`.
 */

import { For, createMemo } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayProviders } from '@/contexts/PlayProviders';
import { useMatchSession } from '@/contexts/MatchSessionContext';
import { usePlayUi } from '@/contexts/PlayUiContext';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import { MatchSession } from '@/services/playgame/runtime/matchSession';
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
  const match = useMatchSession();
  const playUi = usePlayUi();
  const { manifest, localSeat, remoteSeat, bootstrap } = match;
  const state = playUi.presentedState;
  const localHand = createMemo(() => getHandForSeat(
    state(),
    localSeat,
    manifest,
    match.actions.cardStatReadModel,
  ));
  const remoteHandSize = createMemo(() => state().hands[remoteSeat].length);
  const localDeckSize = createMemo(() => state().deckCounts[localSeat]);
  const remoteDeckSize = createMemo(() => state().deckCounts[remoteSeat]);
  const localName = () => bootstrap.participants[localSeat].displayName;
  const remoteName = () => bootstrap.participants[remoteSeat].displayName;

  return (
    <div class="board city-game-board ready" id="board">
      <div class="hud-top city-game-board__hud">
        <div class="hud-top__side hud-top__side--left">
          <div class="city-player-chip city-player-chip--local">
            <span class="city-player-chip__avatar">{localName().slice(0, 1)}</span>
            <span class="city-player-chip__meta">
              <span class="city-player-chip__name">{localName()}</span>
              <span class="city-player-chip__sub">Deck {localDeckSize()}</span>
            </span>
          </div>
        </div>

        <div class="hud-top__center">
          <TurnOrb turn={state().turn} />
        </div>

        <div class="hud-top__side hud-top__side--right">
          <div class="opponent-cluster">
            <HiddenHandIndicator count={remoteHandSize()} />
            <div class="opponent-stat" title={`Deck ${remoteDeckSize()}`}>
              <span class="opponent-stat__label">Deck</span>
              <span class="opponent-stat__value">{remoteDeckSize()}</span>
            </div>
            <EnergyBadge value={state().energy[remoteSeat]} title={`Opponent energy ${state().energy[remoteSeat]}`} />
            <div class="city-player-chip city-player-chip--remote">
              <span class="city-player-chip__meta city-player-chip__meta--right">
                <span class="city-player-chip__name">{remoteName()}</span>
                <span class="city-player-chip__sub">Rival</span>
              </span>
              <span class="city-player-chip__avatar city-player-chip__avatar--remote">{remoteName().slice(0, 1)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="board-game-area city-map-game-area">
        <CityMapBoard seed={bootstrap.matchId} interactive showVenueTooltips />
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
                playable={card.cost <= state().energy[localSeat]}
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
        <button class="energy-button" type="button" title={`Your energy ${state().energy[localSeat]}`}>
          <EnergyBadge value={state().energy[localSeat]} />
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
  const session = MatchSession.fromBootstrap(candidate);

  return (
    <div class="playgame-root city-play-root" style={{ width: '100%', height: '100%', background: '#000' }}>
      <VfxHost class="board-wrap" id="boardWrap">
        <PlayProviders session={session}>
          <BoardSizer />
          <CityGameBoard onExit={props.onExit} />
        </PlayProviders>
      </VfxHost>
    </div>
  );
};
