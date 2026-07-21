/**
 * ClassicPlayScreen — the engine-backed three-lane card battler.
 *
 * This is the canonical `/play` game surface. The city-map experiment has moved
 * to `/citymap` while it evolves into an authoring tool.
 */

import { createSignal, lazy, Show, untrack, type Component } from 'solid-js';
import { VfxHost } from '../game/VfxHost';
import { PlayProviders } from '@/contexts/PlayProviders';
import { PlayBoard } from './play/PlayBoard';
import type { MatchClient } from '@/services/playgame/client/matchClient';
import type { MatchBootstrap } from '@/services/playgame/runtime/contracts';
import { LocalMatchSessionAdapter } from '@/services/playgame/runtime/localMatchSessionAdapter';
import { MatchSession, MatchSessionSetupError } from '@/services/playgame/runtime/matchSession';
import type { PlayInteractionSettings } from './play/playInteractionSettings';
import { useUser } from '@/contexts/UserContext';

interface ClassicPlayScreenProps {
  onExit?: () => void;
  bootstrap?: MatchBootstrap;
  allowDebugSetup?: boolean;
  interactionSettings?: PlayInteractionSettings;
}

interface DebugDeckPickerProps {
  onConfirm: (bootstrap: MatchBootstrap) => void;
  initialSeed?: string;
}

const DevelopmentDeckPicker: Component<DebugDeckPickerProps> = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('@/services/playgame/debug/DebugDeckPicker');
      return { default: module.DebugDeckPicker };
    })
  : () => null;

export const ClassicPlayScreen = (props: ClassicPlayScreenProps) => {
  const { user } = useUser();
  const [client, setClient] = createSignal<MatchClient | null>(null);
  const [setupError, setSetupError] = createSignal<string | null>(null);

  const handleDeckConfirmed = (candidate: MatchBootstrap) => {
    try {
      setClient(new LocalMatchSessionAdapter(
        MatchSession.fromBootstrap(candidate),
        { developerAccess: user.isDeveloper },
      ));
      setSetupError(null);
    } catch (error) {
      setSetupError(error instanceof MatchSessionSetupError
        ? error.issues.map((issue) => issue.message).join('\n')
        : error instanceof Error ? error.message : String(error));
    }
  };

  const initialBootstrap = untrack(() => props.bootstrap);
  if (initialBootstrap) handleDeckConfirmed(initialBootstrap);

  const debugSetupEnabled = () =>
    import.meta.env.DEV && props.allowDebugSetup === true;

  const initialDebugSeed = () => {
    if (!debugSetupEnabled()) return undefined;
    return new URLSearchParams(window.location.search).get('seed') ?? undefined;
  };

  return (
    <div class="playgame-root playfield-hidden">
      <Show when={client() === null}>
        <Show
          when={debugSetupEnabled()}
          fallback={(
            <div class="grid h-full place-items-center p-8 text-center text-white/65">
              <div>
                <h1 class="text-lg font-black uppercase tracking-widest text-white">Match setup required</h1>
                <p class="mt-2 text-sm">Production play requires a validated match bootstrap.</p>
              </div>
            </div>
          )}
        >
          <DevelopmentDeckPicker
            onConfirm={handleDeckConfirmed}
            initialSeed={initialDebugSeed()}
          />
        </Show>
      </Show>

      <Show when={setupError()}>
        {(message) => <pre class="fixed bottom-4 left-4 right-4 z-[10000] whitespace-pre-wrap bg-red-950 p-4 text-red-100">{message()}</pre>}
      </Show>

      <Show when={client() ?? false} keyed>
        {(matchClient) => (
          <VfxHost class="board-wrap" id="boardWrap">
            <PlayProviders client={matchClient}>
              <PlayBoard
                onExit={props.onExit}
                interactionSettings={props.interactionSettings}
              />
            </PlayProviders>
          </VfxHost>
        )}
      </Show>
    </div>
  );
};
