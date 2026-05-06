import { For, Show } from 'solid-js';
import type { CityMap, Point } from '@/services/playgame/city-map';
import type { CityMapDebugState } from './CityMapDebugDock';

export interface TensorDebugOverlayProps {
  city: CityMap;
  width: number;
  height: number;
  debugState: CityMapDebugState;
}

export const TensorDebugOverlay = (props: TensorDebugOverlayProps) => {
  const tensorData = () => (props.city.composition as any)?.tensor;
  const hasData = () => !!tensorData();

  return (
    <Show when={hasData()}>
      <g class="city-map-tensor-debug">
        <Show when={props.debugState.showTensorField}>
          <TensorFieldViz data={tensorData()} width={props.width} height={props.height} />
        </Show>
        <Show when={props.debugState.showTensorSeeds}>
          <TensorSeedsViz data={tensorData()} />
        </Show>
        <Show when={props.debugState.showRejectedTensorRoads}>
          <TensorRejectedViz data={tensorData()} />
        </Show>
      </g>
    </Show>
  );
};

const TensorFieldViz = (props: { data: any; width: number; height: number }) => {
  const fieldConfigs: any[] = props.data?.fieldConfigs || [];

  return (
    <g class="city-map-tensor-debug__field">
      <For each={fieldConfigs}>
        {(cfg: any) => (
          <text
            x={10}
            y={20 + fieldConfigs.indexOf(cfg) * 14}
            class="city-map-tensor-debug__label"
            fill="#5fffe3"
            font-size="10"
            font-family="monospace"
          >
            {cfg.id}: {cfg.kind} (str={cfg.strength})
          </text>
        )}
      </For>
    </g>
  );
};

const TensorSeedsViz = (props: { data: any }) => {
  const majorSeeds: Array<{ x: number; y: number }> = props.data?.majorSeeds || [];
  const minorSeeds: Array<{ x: number; y: number }> = props.data?.minorSeeds || [];

  return (
    <g class="city-map-tensor-debug__seeds">
      <For each={majorSeeds}>
        {(seed) => (
          <circle cx={seed.x} cy={seed.y} r={3} fill="#ff6b6b" opacity="0.7" />
        )}
      </For>
      <For each={minorSeeds}>
        {(seed) => (
          <circle cx={seed.x} cy={seed.y} r={2} fill="#ffd93d" opacity="0.6" />
        )}
      </For>
    </g>
  );
};

const TensorRejectedViz = (props: { data: any }) => {
  const rejected: any[] = props.data?.rejectedRoads || [];

  return (
    <g class="city-map-tensor-debug__rejected">
      <For each={rejected}>
        {(road) => {
          if (!road.points || road.points.length < 2) return null;
          const pts: Point[] = road.points.map((p: any) => ({ x: p.x, y: p.y }));
          return (
            <polyline
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#ff4444"
              stroke-width="1"
              opacity="0.5"
              stroke-dasharray="4 4"
            />
          );
        }}
      </For>
    </g>
  );
};
