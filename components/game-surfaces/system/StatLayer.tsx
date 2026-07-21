import { Show } from 'solid-js';
import type { StatVisual } from '../contracts';

interface StatLayerProps {
  readonly cost: StatVisual | null;
  readonly power: StatVisual | null;
}

export const StatLayer = (props: StatLayerProps) => (
  <div class="card-surface__stats" data-surface-layer="stats">
    <Show when={props.cost} keyed>
      {(cost) => <div class={`cost ${cost.tone}`} data-surface-hit="cost">{cost.value}</div>}
    </Show>
    <Show when={props.power} keyed>
      {(power) => <div class={`power ${power.tone}`} data-surface-hit="power">{power.value}</div>}
    </Show>
  </div>
);
