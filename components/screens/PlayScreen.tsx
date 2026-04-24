/**
 * PlayScreen — top-level shell for the /play route.
 *
 * The actual gameplay surface lives in `./play/PlayBoard`. This file only
 * stands up the VFX host + game-state provider so the real UI modules
 * stay isolated from engine/provider changes.
 *
 * DEBUG: DebugDeckPicker is shown on first load. Remove when real deck
 * selection / matchmaking replaces it.
 */

import { createSignal, Show } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayGameProvider } from '@/contexts/PlayGameContext';
import { BoardSizer } from './play/BoardSizer';
import { PlayBoard } from './play/PlayBoard';
import { DebugDeckPicker } from '@/services/playgame/debug/DebugDeckPicker';
import { buildDebugMatchState } from '@/services/playgame/debug/buildDebugState';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { MatchState } from '@/services/playgame/engine/types/state';

interface PlayScreenProps {
  onExit?: () => void;
}

export const PlayScreen = (props: PlayScreenProps) => {
  const [initialState, setInitialState] = createSignal<MatchState | null>(null);

  const handleDeckConfirmed = (playerCards: readonly string[], oppCards: readonly string[]) => {
    const seed = `debug-${Date.now().toString(36)}`;
    setInitialState(buildDebugMatchState(playerCards, oppCards, BOOTSTRAP_MANIFEST, seed));
  };

  return (
    <div
      class="playgame-root board-hidden"
      style={{ width: '100%', height: '100%', background: '#000' }}
    >
      {/* DEBUG: picker mounts as a Portal over document.body; unmounts on confirm */}
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
