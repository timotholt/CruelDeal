/**
 * LegacyPlayScreen — the old engine-backed /play board kept for reference.
 *
 * The city map migration makes PlayScreen city-first. This shell preserves the
 * previous debug deck picker and lane board at /play/legacy while the new game
 * surface comes online.
 */

import { createSignal, Show } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayGameProvider } from '@/contexts/PlayGameContext';
import { BoardSizer } from './play/BoardSizer';
import { PlayBoard } from './play/PlayBoard';
import { DebugDeckPicker } from '@/services/playgame/debug/DebugDeckPicker';
import { buildDebugMatchState } from '@/services/playgame/debug/buildDebugState';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { Deck } from '@/services/playgame/engine/manifest/types';
import type { MatchState } from '@/services/playgame/engine/types/state';

interface LegacyPlayScreenProps {
  onExit?: () => void;
}

export const LegacyPlayScreen = (props: LegacyPlayScreenProps) => {
  const [initialState, setInitialState] = createSignal<MatchState | null>(null);

  const handleDeckConfirmed = (playerCards: Deck, oppCards: Deck) => {
    const seed = `debug-${Date.now().toString(36)}`;
    setInitialState(buildDebugMatchState(playerCards, oppCards, BOOTSTRAP_MANIFEST, seed));
  };

  return (
    <div
      class="playgame-root board-hidden"
      style={{ width: '100%', height: '100%', background: '#000' }}
    >
      <Show when={initialState() === null}>
        <DebugDeckPicker onConfirm={handleDeckConfirmed} />
      </Show>

      <Show when={initialState() ?? false} keyed>
        {(state) => (
          <VfxHost class="board-wrap" id="boardWrap">
            <PlayGameProvider initialState={state}>
              <BoardSizer />
              <PlayBoard onExit={props.onExit} />
            </PlayGameProvider>
          </VfxHost>
        )}
      </Show>
    </div>
  );
};
