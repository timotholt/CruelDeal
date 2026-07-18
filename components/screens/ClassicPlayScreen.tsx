/**
 * ClassicPlayScreen — the engine-backed three-lane card battler.
 *
 * This is the canonical `/play` game surface. The city-map experiment has moved
 * to `/citymap` while it evolves into an authoring tool.
 */

import { createSignal, Show } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayGameProvider } from '@/contexts/PlayGameContext';
import { BoardSizer } from './play/BoardSizer';
import { PlayBoard } from './play/PlayBoard';
import { DebugDeckPicker } from '@/services/playgame/debug/DebugDeckPicker';
import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import { validateMatchBootstrap } from '@/services/playgame/runtime/bootstrapValidation';
import type { MatchBootstrap, ValidatedMatchBootstrap } from '@/services/playgame/runtime/contracts';

interface ClassicPlayScreenProps {
  onExit?: () => void;
}

export const ClassicPlayScreen = (props: ClassicPlayScreenProps) => {
  const [bootstrap, setBootstrap] = createSignal<ValidatedMatchBootstrap | null>(null);
  const [setupError, setSetupError] = createSignal<string | null>(null);

  const handleDeckConfirmed = (candidate: MatchBootstrap) => {
    const validation = validateMatchBootstrap(candidate, BOOTSTRAP_MANIFEST);
    if (!validation.ok) {
      setSetupError(validation.issues.map((issue) => issue.message).join('\n'));
      return;
    }
    setSetupError(null);
    setBootstrap(validation.value);
  };

  return (
    <div
      class="playgame-root board-hidden"
      style={{ width: '100%', height: '100%', background: '#000' }}
    >
      <Show when={bootstrap() === null}>
        <DebugDeckPicker onConfirm={handleDeckConfirmed} />
      </Show>

      <Show when={setupError()}>
        {(message) => <pre class="fixed bottom-4 left-4 right-4 z-[10000] whitespace-pre-wrap bg-red-950 p-4 text-red-100">{message()}</pre>}
      </Show>

      <Show when={bootstrap() ?? false} keyed>
        {(validatedBootstrap) => (
          <VfxHost class="board-wrap" id="boardWrap">
            <PlayGameProvider bootstrap={validatedBootstrap}>
              <BoardSizer />
              <PlayBoard onExit={props.onExit} />
            </PlayGameProvider>
          </VfxHost>
        )}
      </Show>
    </div>
  );
};
