import { EnergyBadge } from './EnergyBadge';
import { MiniDeckIndicator } from './MiniDeckIndicator';
import { TurnOrb } from './TurnOrb';
import type { MatchIntentActivity } from '@/contexts/MatchSessionContext';

interface MatchActionBarProps {
  readonly interactive: boolean;
  readonly resolving: boolean;
  readonly intentActivity: MatchIntentActivity;
  readonly resultLocked: boolean;
  readonly outcomeLabel: 'WIN' | 'LOSE' | 'DRAW' | null;
  readonly turn: number;
  readonly deckSize: number;
  readonly energy: number;
  readonly deckAnchorRef: (element: HTMLElement) => void;
  readonly onExit: () => void;
  readonly onUndo: () => void;
  readonly onEndTurn: () => void;
}

export const MatchActionBar = (props: MatchActionBarProps) => {
  const endTurnLabel = () => {
    if (props.intentActivity?.kind === 'PROCESSING_INTENT') return 'PROCESSING';
    if (props.intentActivity?.kind === 'WAITING_FOR_PLAYER') return 'WAITING';
    if (props.resolving) return 'RESOLVING';
    return 'END TURN';
  };

  return (
    <div class="action-bar">
      <button
        class={`retreat-btn${props.resultLocked ? ' result-locked' : ''}`}
        disabled={!props.resultLocked && (!props.interactive || props.resolving)}
        onClick={() => {
          if (!props.resultLocked && !props.interactive) return;
          props.onExit();
        }}
      >
        {props.outcomeLabel
          ? `CLOSE (${props.outcomeLabel})`
          : 'RETREAT'}
      </button>
      <TurnOrb turn={props.turn} />
      <MiniDeckIndicator
        count={props.deckSize}
        label="Your deck"
        anchorRef={props.deckAnchorRef}
      />
      <button
        class="energy-button"
        title="Tap to undo last played card"
        disabled={!props.interactive}
        onClick={() => props.onUndo()}
      >
        <EnergyBadge value={props.energy} title={`Your energy ${props.energy}`} />
      </button>
      <button
        class="end-turn"
        disabled={!props.interactive}
        onClick={() => props.onEndTurn()}
      >
        {endTurnLabel()}
      </button>
    </div>
  );
};
