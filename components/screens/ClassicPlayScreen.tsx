/**
 * ClassicPlayScreen — the engine-backed three-lane card battler.
 *
 * This is the canonical `/play` game surface. The city-map experiment has moved
 * to `/citymap` while it evolves into an authoring tool.
 */

import { createSignal, Show } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayProviders } from '@/contexts/PlayProviders';
import { PlayBoard } from './play/PlayBoard';
import { DebugDeckPicker } from '@/services/playgame/debug/DebugDeckPicker';
import type { MatchBootstrap } from '@/services/playgame/runtime/contracts';
import { MatchSession, MatchSessionSetupError } from '@/services/playgame/runtime/matchSession';

interface ClassicPlayScreenProps {
  onExit?: () => void;
}

export const ClassicPlayScreen = (props: ClassicPlayScreenProps) => {
  const [session, setSession] = createSignal<MatchSession | null>(null);
  const [setupError, setSetupError] = createSignal<string | null>(null);

  const handleDeckConfirmed = (candidate: MatchBootstrap) => {
    try {
      setSession(MatchSession.fromBootstrap(candidate));
      setSetupError(null);
    } catch (error) {
      setSetupError(error instanceof MatchSessionSetupError
        ? error.issues.map((issue) => issue.message).join('\n')
        : error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      class="playgame-root playfield-hidden"
      style={{ width: '100%', height: '100%', background: '#000' }}
    >
      <Show when={session() === null}>
        <DebugDeckPicker onConfirm={handleDeckConfirmed} />
      </Show>

      <Show when={setupError()}>
        {(message) => <pre class="fixed bottom-4 left-4 right-4 z-[10000] whitespace-pre-wrap bg-red-950 p-4 text-red-100">{message()}</pre>}
      </Show>

      <Show when={session() ?? false} keyed>
        {(matchSession) => (
          <VfxHost class="board-wrap" id="boardWrap">
            <PlayProviders session={matchSession}>
              <PlayBoard onExit={props.onExit} />
            </PlayProviders>
          </VfxHost>
        )}
      </Show>
    </div>
  );
};
