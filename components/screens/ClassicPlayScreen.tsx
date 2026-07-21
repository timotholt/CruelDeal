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
import type { MatchBootstrap } from '@/services/playgame/runtime/contracts';
import { MatchSession, MatchSessionSetupError } from '@/services/playgame/runtime/matchSession';
import type { PlayInteractionSettings } from './play/playInteractionSettings';

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
      <Show when={session() === null}>
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

      <Show when={session() ?? false} keyed>
        {(matchSession) => (
          <VfxHost class="board-wrap" id="boardWrap">
            <PlayProviders session={matchSession}>
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
