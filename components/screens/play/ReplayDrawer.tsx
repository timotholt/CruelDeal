import { createMemo, createSignal, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { Manifest } from '@/services/playgame/engine/manifest/types';
import type { ReplayStep } from '@/services/playgame/engine/replay';
import type { MatchRuntimeReplayExport } from '@/services/playgame/runtime/contracts';
import type { MatchPerformanceProfile } from '@/services/playgame/runtime/performanceTelemetry';
import {
  annotateReplayEventJson,
  createReplayActorResolver,
  createReplayNameResolver,
  describeReplayStep,
} from '@/services/playgame/debug/replayPresentation';

interface ReplayDrawerProps {
  open: boolean;
  followingLive: boolean;
  cursor: number;
  stepCount: number;
  steps: readonly ReplayStep[];
  manifest: Manifest;
  replay: MatchRuntimeReplayExport;
  performanceProfile: MatchPerformanceProfile;
  selectedStep: ReplayStep | null;
  clientStatus: string;
  onCursorChange: (cursor: number) => void;
  onCopyFrameJson: () => Promise<void>;
  onCopyGameJson: () => Promise<void>;
}

export const ReplayDrawer = (props: ReplayDrawerProps) => {
  let drawerEl: HTMLDivElement | undefined;
  let stopDrag: (() => void) | null = null;
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  const names = createMemo(() => createReplayNameResolver(props.steps, props.manifest));
  const actors = createMemo(() => createReplayActorResolver(props.replay));
  const selectedDescription = createMemo(() => describeReplayStep(props.selectedStep, names(), actors()));
  const eventJson = createMemo(() => annotateReplayEventJson(props.selectedStep, names()));
  const selectedTiming = createMemo(() => {
    const step = props.selectedStep;
    if (!step?.transactionId) return null;
    const matchesFrame = <T extends { transactionId: string; frame: number }>(entry: T): boolean => (
      entry.transactionId === step.transactionId && entry.frame === step.frame
    );
    return {
      apply: props.performanceProfile.frameApplies.find(matchesFrame) ?? null,
      projection: props.performanceProfile.frameProjections.find(matchesFrame) ?? null,
      presentation: props.performanceProfile.framePresentations.find(matchesFrame) ?? null,
      transaction: props.performanceProfile.transactions.find(
        entry => entry.transactionId === step.transactionId,
      ) ?? null,
    };
  });
  const formatDuration = (durationMs: number | undefined): string => (
    durationMs === undefined
      ? '—'
      : durationMs < 1
        ? `${durationMs.toFixed(3)} ms`
        : `${durationMs.toFixed(1)} ms`
  );
  const copyTimingJson = async (): Promise<void> => {
    await navigator.clipboard.writeText(JSON.stringify(props.performanceProfile, null, 2));
  };

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
            <div class="replay-panel__scroll">
              <div class="replay-panel__header">
                <div class="replay-panel__drag-handle" onPointerDown={beginDrag} title="Drag replay window">
                  <span />
                  <span />
                  <span />
                </div>
                <div class="replay-panel__heading">
                  <div class="replay-panel__eyebrow">Dev Replay</div>
                  <div class="replay-panel__title">
                    Frame {props.cursor}/{Math.max(props.stepCount - 1, 0)}
                  </div>
                  <div class="replay-panel__actor">{selectedDescription().actor}</div>
                </div>
              </div>

              <div class="replay-panel__controls">
                <div class="replay-panel__buttons" role="group" aria-label="Replay transport">
                  <button
                    class="replay-transport"
                    type="button"
                    title="Go to beginning"
                    aria-label="Go to beginning"
                    onClick={() => props.onCursorChange(0)}
                    disabled={props.cursor <= 0}
                  >
                    {'|<'}
                  </button>
                  <button
                    class="replay-transport"
                    type="button"
                    title="Step back 10 replay steps"
                    aria-label="Step back 10 replay steps"
                    onClick={() => props.onCursorChange(Math.max(0, props.cursor - 10))}
                    disabled={props.cursor <= 0}
                  >
                    {'<<'}
                  </button>
                  <button
                    class="replay-transport"
                    type="button"
                    title="Step back 1 frame"
                    aria-label="Step back 1 frame"
                    onClick={() => props.onCursorChange(Math.max(0, props.cursor - 1))}
                    disabled={props.cursor <= 0}
                  >
                    {'<'}
                  </button>
                  <button
                    class="replay-transport"
                    type="button"
                    title="Go forward 1 frame"
                    aria-label="Go forward 1 frame"
                    onClick={() => props.onCursorChange(Math.min(props.stepCount - 1, props.cursor + 1))}
                    disabled={props.cursor >= props.stepCount - 1}
                  >
                    {'>'}
                  </button>
                  <button
                    class="replay-transport"
                    type="button"
                    title="Go forward 10 replay steps"
                    aria-label="Go forward 10 replay steps"
                    onClick={() => props.onCursorChange(Math.min(props.stepCount - 1, props.cursor + 10))}
                    disabled={props.cursor >= props.stepCount - 1}
                  >
                    {'>>'}
                  </button>
                  <button
                    class="replay-transport"
                    type="button"
                    title="Go to end and follow live"
                    aria-label="Go to end and follow live"
                    onClick={() => props.onCursorChange(Math.max(props.stepCount - 1, 0))}
                    disabled={props.followingLive}
                  >
                    {'>|'}
                  </button>
                </div>

                <input
                  class="replay-slider"
                  type="range"
                  min="0"
                  max={String(Math.max(props.stepCount - 1, 0))}
                  value={String(props.cursor)}
                  aria-label="Replay frame"
                  onInput={(e) => props.onCursorChange(e.currentTarget.valueAsNumber)}
                />
              </div>

              <div class="replay-panel__summary">
                <div class="replay-panel__event">{selectedDescription().summary}</div>
              </div>

              <Show when={props.selectedStep}>
                {(step) => (
                  <div class="replay-panel__stats">
                    <div>Turn {step().state.turn}</div>
                    <div>Priority: {actors().playerLabel(step().state.priority)}</div>
                    <div>Player 1 Energy = {step().state.energy.P0}, Player 2 Energy = {step().state.energy.P1}</div>
                  </div>
                )}
              </Show>

              <Show when={props.selectedStep?.event}>
                <pre class="replay-panel__json">{eventJson()}</pre>
              </Show>

              <Show when={props.selectedStep?.event}>
                <div class="replay-panel__timings">
                  <div class="replay-panel__section-title">Live frame timing</div>
                  <div class="replay-panel__timing-grid">
                    <span>Engine apply</span>
                    <strong>{formatDuration(selectedTiming()?.apply?.durationMs)}</strong>
                    <span>UI projection</span>
                    <strong>{formatDuration(selectedTiming()?.projection?.durationMs)}</strong>
                    <span>Presentation</span>
                    <strong>{formatDuration(selectedTiming()?.presentation?.durationMs)}</strong>
                    <span>Resolver batch</span>
                    <strong>{formatDuration(selectedTiming()?.transaction?.resolveMs)}</strong>
                    <span>Transaction commit</span>
                    <strong>{formatDuration(selectedTiming()?.transaction?.durationMs)}</strong>
                  </div>
                  <Show when={selectedTiming()?.presentation}>
                    {(timing) => (
                      <div class="replay-panel__timing-note">
                        {timing().beatKind} · {timing().outcome}
                      </div>
                    )}
                  </Show>
                  <div class="replay-panel__timing-note">
                    Diagnostic sidecar only; canonical replay data remains clock-free.
                  </div>
                </div>
              </Show>

              <div class="replay-panel__footer">
                <button class="replay-chip" type="button" onClick={() => void props.onCopyFrameJson()}>
                  Copy Frame JSON
                </button>
                <button class="replay-chip" type="button" onClick={() => void props.onCopyGameJson()}>
                  Copy Game JSON
                </button>
                <button class="replay-chip" type="button" onClick={() => void copyTimingJson()}>
                  Copy Timing JSON
                </button>
              </div>
            </div>

            <div class="replay-panel__client-status" role="status" aria-live="polite">
              <span>Client State</span>
              <strong>{props.clientStatus}</strong>
            </div>
          </div>
        </Show>
      </div>
    </Portal>
  );
};
