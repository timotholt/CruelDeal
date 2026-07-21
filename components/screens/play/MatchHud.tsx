import type { Seat } from '@/services/playgame/engine/types/ids';
import type { VisiblePileZone } from '@/services/playgame/view';
import { EnergyBadge } from './EnergyBadge';
import { HiddenHandIndicator } from './HiddenHandIndicator';
import { MiniDeckIndicator } from './MiniDeckIndicator';
import { PlayerPortraitMenu } from './PlayerPortraitMenu';

interface ZoneCounts {
  readonly discard: number;
  readonly destroyed: number;
  readonly banished: number;
}

interface MatchHudProps {
  readonly localSeat: Seat;
  readonly remoteSeat: Seat;
  readonly seatNames: Readonly<Record<Seat, string>>;
  readonly localHasPriority: boolean;
  readonly openMenuSeat: Seat | null;
  readonly localCounts: ZoneCounts;
  readonly remoteCounts: ZoneCounts;
  readonly remoteDeckSize: number;
  readonly remoteHandSize: number;
  readonly remoteEnergy: number;
  readonly remoteDeckAnchorRef: (element: HTMLElement) => void;
  readonly remoteHandAnchorRef: (element: HTMLElement) => void;
  readonly onTogglePlayerMenu: (seat: Seat) => void;
  readonly onOpenPile: (owner: Seat, zone: VisiblePileZone) => void;
}

export const MatchHud = (props: MatchHudProps) => (
  <header class="hud-top opponent-header match-hud">
    <div class="match-hud__identity match-hud__identity--local">
      <PlayerPortraitMenu
        owner={props.localSeat}
        name={props.seatNames[props.localSeat]}
        side="left"
        hasPriority={props.localHasPriority}
        open={props.openMenuSeat === props.localSeat}
        counts={props.localCounts}
        onToggle={() => props.onTogglePlayerMenu(props.localSeat)}
        onOpenPile={(zone) => props.onOpenPile(props.localSeat, zone)}
      />
    </div>

    <div class="match-hud__opponent-resources" aria-label="Opponent resources">
      <div class="match-hud__resource match-hud__resource--deck">
        <MiniDeckIndicator
          count={props.remoteDeckSize}
          anchorRef={props.remoteDeckAnchorRef}
        />
      </div>
      <div class="match-hud__resource match-hud__resource--hand">
        <HiddenHandIndicator
          count={props.remoteHandSize}
          anchorRef={props.remoteHandAnchorRef}
        />
      </div>
      <div class="match-hud__resource match-hud__resource--energy">
        <EnergyBadge
          value={props.remoteEnergy}
          title={`Opponent energy ${props.remoteEnergy}`}
        />
      </div>
    </div>

    <div class="match-hud__identity match-hud__identity--remote">
      <PlayerPortraitMenu
        owner={props.remoteSeat}
        name={props.seatNames[props.remoteSeat]}
        side="right"
        hasPriority={!props.localHasPriority}
        open={props.openMenuSeat === props.remoteSeat}
        counts={props.remoteCounts}
        onToggle={() => props.onTogglePlayerMenu(props.remoteSeat)}
        onOpenPile={(zone) => props.onOpenPile(props.remoteSeat, zone)}
      />
    </div>
  </header>
);
