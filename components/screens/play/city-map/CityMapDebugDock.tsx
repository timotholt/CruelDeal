import { createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

export interface CityMapDebugState {
  showMap: boolean;
  useThreeRenderer: boolean;
  showBuildings: boolean;
  showRoads: boolean;
  showLabels: boolean;
  showLandmarks: boolean;
  showSlots: boolean;
  showRouteDemo: boolean;
  showComposition: boolean;
  showTerrainDebug: boolean;
  showDistrictDebug: boolean;
  showArterialsDebug: boolean;
  showIslandDebug: boolean;
  showMassDebug: boolean;
  showSeedDebug: boolean;
  simplifyDuringCameraMove: boolean;
}

export interface CityMapDebugDockProps {
  state: CityMapDebugState;
  onToggle: (key: keyof CityMapDebugState) => void;
}

const rows: Array<{ key: keyof CityMapDebugState; label: string }> = [
  { key: 'showMap', label: 'City Map' },
  { key: 'useThreeRenderer', label: 'Three' },
  { key: 'showBuildings', label: 'Buildings' },
  { key: 'showRoads', label: 'Roads' },
  { key: 'showLabels', label: 'Labels' },
  { key: 'showLandmarks', label: 'Landmarks' },
  { key: 'showSlots', label: 'Slots' },
  { key: 'showRouteDemo', label: 'Route Demo' },
  { key: 'showComposition', label: 'Composition' },
  { key: 'showTerrainDebug', label: 'Terrain' },
  { key: 'showDistrictDebug', label: 'Districts' },
  { key: 'showArterialsDebug', label: 'Arterials' },
  { key: 'showIslandDebug', label: 'Islands' },
  { key: 'showMassDebug', label: 'Mass' },
  { key: 'showSeedDebug', label: 'Seed Info' },
  { key: 'simplifyDuringCameraMove', label: 'Pan Perf' },
];

export const CityMapDebugDock = (props: CityMapDebugDockProps) => {
  const [collapsed, setCollapsed] = createSignal(false);
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  let dockRef: HTMLElement | undefined;

  const handlePointerDown = (e: PointerEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    
    // Don't drag if clicking the collapse button
    if ((e.target as HTMLElement).closest('button')) return;

    if (!dockRef) return;

    const rect = dockRef.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setPosition({
        x: moveEvent.clientX - offsetX,
        y: moveEvent.clientY - offsetY,
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <Portal mount={document.body}>
      <aside 
        ref={(el) => {
          dockRef = el;
        }}
        class="city-map-debug-dock" 
        aria-label="City map debug controls"
        style={{
          position: 'fixed',
          ...(position() ? {
            left: `${position()!.x}px`,
            top: `${position()!.y}px`,
            right: 'auto',
            bottom: 'auto'
          } : {
            top: '10px',
            right: '10px'
          })
        }}
      >
        <div 
          class="city-map-debug-dock__header" 
          onPointerDown={handlePointerDown}
          style={{ cursor: 'move', 'touch-action': 'none' }}
        >
          <span>DEBUG</span>
          <button type="button" onClick={() => setCollapsed(!collapsed())} aria-label="Collapse debug controls">
            {collapsed() ? '>' : 'v'}
          </button>
        </div>
        <Show when={!collapsed()}>
          <div class="city-map-debug-dock__body">
            <For each={rows}>
              {(row) => (
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
              )}
            </For>
          </div>
        </Show>
      </aside>
    </Portal>
  );
};
