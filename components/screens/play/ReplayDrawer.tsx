import { For, Show } from 'solid-js';
import type { ReplayFrame } from '@/services/playgame/engine/replay';

interface ReplayDrawerProps {
  open: boolean;
  replayEnabled: boolean;
  frameIndex: number;
  frameCount: number;
  seed: string;
  selectedFrame: ReplayFrame | null;
  onToggleOpen: () => void;
  onToggleReplay: () => void;
  onFrameChange: (index: number) => void;
  onCopyReplayJson: () => Promise<void>;
}

const describeEvent = (frame: ReplayFrame | null): string => {
  if (!frame || !frame.event) return 'Initial seeded state';
  const { event } = frame;
  const details = Object.entries(event)
    .filter(([key]) => key !== 'type')
    .slice(0, 3)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return details.length > 0 ? `${event.type} · ${details.join(' · ')}` : event.type;
};

export const ReplayDrawer = (props: ReplayDrawerProps) => {
  return (
    <div class={'replay-drawer' + (props.open ? ' open' : '')}>
      <button class="replay-toggle" type="button" onClick={props.onToggleOpen}>
        {props.open ? 'Hide Replay' : 'Replay'}
      </button>

      <Show when={props.open}>
        <div class="replay-panel">
          <div class="replay-panel__header">
            <div>
              <div class="replay-panel__eyebrow">Dev Replay</div>
              <div class="replay-panel__title">
                {props.replayEnabled ? `Frame ${props.frameIndex}/${Math.max(props.frameCount - 1, 0)}` : 'Live State'}
              </div>
            </div>
            <button class="replay-chip" type="button" onClick={props.onToggleReplay}>
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
            <div class="replay-panel__event">{describeEvent(props.selectedFrame)}</div>
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
            <pre class="replay-panel__json">{JSON.stringify(props.selectedFrame?.event, null, 2)}</pre>
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
  );
};
