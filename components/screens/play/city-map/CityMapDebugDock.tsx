import { createSignal, Show } from 'solid-js';

export interface CityMapDebugState {
  showMap: boolean;
  showBuildings: boolean;
  showRoads: boolean;
  showLabels: boolean;
  showSlots: boolean;
  showRouteDemo: boolean;
}

export interface CityMapDebugDockProps {
  state: CityMapDebugState;
  onToggle: (key: keyof CityMapDebugState) => void;
}

const rows: Array<{ key: keyof CityMapDebugState; label: string }> = [
  { key: 'showMap', label: 'City Map' },
  { key: 'showBuildings', label: 'Buildings' },
  { key: 'showRoads', label: 'Roads' },
  { key: 'showLabels', label: 'Labels' },
  { key: 'showSlots', label: 'Slots' },
  { key: 'showRouteDemo', label: 'Route Demo' },
];

export const CityMapDebugDock = (props: CityMapDebugDockProps) => {
  const [collapsed, setCollapsed] = createSignal(false);

  return (
    <aside class="city-map-debug-dock" aria-label="City map debug controls">
      <div class="city-map-debug-dock__header">
        <span>DEBUG</span>
        <button type="button" onClick={() => setCollapsed(!collapsed())} aria-label="Collapse debug controls">
          {collapsed() ? '>' : 'v'}
        </button>
      </div>
      <Show when={!collapsed()}>
        <div class="city-map-debug-dock__body">
          {rows.map((row) => (
            <label class="city-map-debug-dock__row">
              <span>{row.label}</span>
              <button
                type="button"
                classList={{
                  'city-map-debug-dock__toggle': true,
                  'city-map-debug-dock__toggle--on': props.state[row.key],
                }}
                onClick={() => props.onToggle(row.key)}
              >
                {props.state[row.key] ? 'ON' : 'OFF'}
              </button>
            </label>
          ))}
        </div>
      </Show>
    </aside>
  );
};
