import { For } from 'solid-js';
import type { CardStatusVisual, LocationStatusVisual } from '../contracts';

interface StatusLayerProps {
  readonly statuses: readonly (CardStatusVisual | LocationStatusVisual)[];
}

export const StatusLayer = (props: StatusLayerProps) => (
  <div class="surface-statuses" data-surface-layer="statuses">
    <For each={props.statuses}>
      {(status) => (
        <div
          class={`surface-status surface-status--${status.kind}`}
          data-surface-hit="status"
          data-status-key={status.key}
          aria-label={status.kind === 'status-icon' && 'label' in status
            ? status.label ?? undefined
            : undefined}
        >
          {status.kind === 'timer' ? status.value : null}
        </div>
      )}
    </For>
  </div>
);
