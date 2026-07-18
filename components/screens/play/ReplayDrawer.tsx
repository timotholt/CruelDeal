import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import type { ReplayFrame } from '@/services/playgame/engine/replay';
import type { MatchRuntimeReplayExport } from '@/services/playgame/runtime/contracts';
import {
  annotateReplayEventJson,
  createReplayActorResolver,
  createReplayNameResolver,
  describeReplayFrame,
} from '@/services/playgame/debug/replayPresentation';

interface ReplayDrawerProps {
  open: boolean;
  replayEnabled: boolean;
  frameIndex: number;
  frameCount: number;
  seed: string;
  frames: readonly ReplayFrame[];
  manifest: Manifest;
  replay: MatchRuntimeReplayExport;
  selectedFrame: ReplayFrame | null;
  onToggleOpen: () => void;
  onToggleReplay: () => void;
  onFrameChange: (index: number) => void;
  onCopyReplayJson: () => Promise<void>;
}

export const ReplayDrawer = (props: ReplayDrawerProps) => {
  let drawerEl: HTMLDivElement | undefined;
  let stopDrag: (() => void) | null = null;
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  const names = createMemo(() => createReplayNameResolver(props.frames, props.manifest));
  const actors = createMemo(() => createReplayActorResolver(props.replay));
  const selectedDescription = createMemo(() => describeReplayFrame(props.selectedFrame, names(), actors()));

  const beginDrag = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const drawer = drawerEl;
    if (!drawer) return;

    const rect = drawer.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const maxX = () => Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = () => Math.max(8, window.innerHeight - rect.height - 8);

    setPosition({
      x: Math.min(Math.max(8, rect.left), maxX()),
      y: Math.min(Math.max(8, rect.top), maxY()),
    });

    const move = (moveEvent: PointerEvent): void => {
      setPosition({
        x: Math.min(Math.max(8, moveEvent.clientX - offsetX), maxX()),
        y: Math.min(Math.max(8, moveEvent.clientY - offsetY), maxY()),
      });
    };

    const stop = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      stopDrag = null;
    };

    event.preventDefault();
    stopDrag?.();
    stopDrag = stop;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };

  onCleanup(() => stopDrag?.());

  return (
    <Portal mount={document.body}>
      <div
        ref={(element) => { drawerEl = element; }}
        class={'replay-drawer' + (props.open ? ' open' : '')}
        style={position()
          ? {
              left: `${position()!.x}px`,
              top: `${position()!.y}px`,
              right: 'auto',
            }
          : undefined}
      >
        <Show when={props.open}>
          <div class="replay-panel">
            <div class="replay-panel__header">
              <div class="replay-panel__drag-handle" onPointerDown={beginDrag} title="Drag replay window">
                <span />
                <span />
                <span />
              </div>
              <div>
                <div class="replay-panel__eyebrow">Dev Replay</div>
                <div class="replay-panel__title">
                  {props.replayEnabled
                    ? `Frame ${props.frameIndex}/${Math.max(props.frameCount - 1, 0)} · ${selectedDescription().actor}`
                    : `Live State · ${selectedDescription().actor}`}
                </div>
              </div>
              <button class="replay-chip" type="button" onClick={() => props.onToggleReplay()}>
                {props.replayEnabled ? 'Exit Replay' : 'Enter Replay'}
              </button>
            </div>

            <div class="replay-panel__meta">
              <span>Seed: {props.seed}</span>
              <span>Frames: {props.frameCount}</span>
            </div>

            <Show when={props.replayEnabled}>
              <div class="replay-panel__controls">
                <div class="replay-panel__buttons">
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(0)}
                    disabled={props.frameIndex <= 0}
                  >
                    First
                  </button>
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(Math.max(0, props.frameIndex - 10))}
                    disabled={props.frameIndex <= 0}
                  >
                    -10
                  </button>
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(Math.max(0, props.frameIndex - 1))}
                    disabled={props.frameIndex <= 0}
                  >
                    Prev
                  </button>
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(Math.min(props.frameCount - 1, props.frameIndex + 1))}
                    disabled={props.frameIndex >= props.frameCount - 1}
                  >
                    Next
                  </button>
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(Math.min(props.frameCount - 1, props.frameIndex + 10))}
                    disabled={props.frameIndex >= props.frameCount - 1}
                  >
                    +10
                  </button>
                  <button
                    class="replay-chip"
                    type="button"
                    onClick={() => props.onFrameChange(Math.max(props.frameCount - 1, 0))}
                    disabled={props.frameIndex >= props.frameCount - 1}
                  >
                    Last
                  </button>
                </div>

                <input
                  class="replay-slider"
                  type="range"
                  min="0"
                  max={String(Math.max(props.frameCount - 1, 0))}
                  value={String(props.frameIndex)}
                  onInput={(e) => props.onFrameChange(e.currentTarget.valueAsNumber)}
                />
              </div>
            </Show>

            <div class="replay-panel__summary">
              <div class="replay-panel__section-title">Selected Frame</div>
              <div class="replay-panel__event">{selectedDescription().summary}</div>
            </div>

            <Show when={props.selectedFrame}>
              {(frame) => (
                <div class="replay-panel__stats">
                  <div>Turn {frame().state.turn}</div>
                  <div>Phase {frame().state.phase}</div>
                  <div>Priority {frame().state.priority}</div>
                  <div>Energy {frame().state.energy.P0}/{frame().state.energy.P1}</div>
                </div>
              )}
            </Show>

            <Show when={props.selectedFrame?.event}>
              <Show when={selectedDescription().cause}>
                {(cause) => <div class="replay-panel__cause">{cause()}</div>}
              </Show>
              <pre class="replay-panel__json">{annotateReplayEventJson(props.selectedFrame, names())}</pre>
            </Show>

            <div class="replay-panel__footer">
              <button class="replay-chip" type="button" onClick={() => void props.onCopyReplayJson()}>
                Copy Replay JSON
              </button>
            </div>

            <Show when={props.replayEnabled && props.frameCount > 0}>
              <div class="replay-panel__ticks">
                <For each={[0, Math.floor((props.frameCount - 1) / 2), props.frameCount - 1]}>
                  {(tick) => <button class="replay-tick" type="button" onClick={() => props.onFrameChange(tick)}>{tick}</button>}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Portal>
  );
};
