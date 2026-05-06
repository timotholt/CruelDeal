import { createSignal, For, onMount, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

export interface CityMapDebugState {
  showMap: boolean;
  useThreeRenderer: boolean;
  roadGenerationMode: 'legacy' | 'pm2001' | 'tensor';
  useRoadFaceBlocks: boolean;
  usePM2001Roads: boolean;
  showRoadCorridors: boolean;
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
  onSetRoadGenerationMode?: (mode: 'legacy' | 'pm2001' | 'tensor') => void;
}

const STORAGE_KEY = 'cruel-deal.city-map.debug-dock-position';
const unavailableKeys = new Set<keyof CityMapDebugState>([
  'roadGenerationMode',
  'showDistrictDebug',
  'showArterialsDebug',
  'showIslandDebug',
  'showMassDebug',
  'showSeedDebug',
]);

const rows: Array<{ key: keyof CityMapDebugState; label: string }> = [
  { key: 'showMap', label: 'City Map' },
  { key: 'useThreeRenderer', label: 'Three' },
  { key: 'useRoadFaceBlocks', label: 'Road-Face Blocks' },
  { key: 'usePM2001Roads', label: 'PM2001 Roads' },
  { key: 'showRoadCorridors', label: 'Road Corridors' },
  { key: 'showBuildings', label: 'Buildings' },
  { key: 'showRoads', label: 'Roads' },
  { key: 'showLabels', label: 'Labels' },
  { key: 'showLandmarks', label: 'Landmarks' },
  { key: 'showSlots', label: 'Slots' },
  { key: 'showRouteDemo', label: 'Route Demo' },
  { key: 'showComposition', label: 'Planning' },
  { key: 'showTerrainDebug', label: 'Wireframe' },
  { key: 'showDistrictDebug', label: 'Districts' },
  { key: 'showArterialsDebug', label: 'Arterials' },
  { key: 'showIslandDebug', label: 'Islands' },
  { key: 'showMassDebug', label: 'Mass' },
  { key: 'showSeedDebug', label: 'Seed Info' },
  { key: 'simplifyDuringCameraMove', label: 'SVG Pan Perf' },
];

export const CityMapDebugDock = (props: CityMapDebugDockProps) => {
  const [collapsed, setCollapsed] = createSignal(false);
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  let dockRef: HTMLElement | undefined;

  onMount(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { x?: number; y?: number };
      if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        setPosition({ x: Math.max(0, saved.x!), y: Math.max(0, saved.y!) });
      }
    } catch {
      // Ignore corrupt localStorage.
    }
  });

  const savePosition = (next: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures; drag should still work.
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    
    // Don't drag if clicking the collapse button
    if ((e.target as HTMLElement).closest('button')) return;

    if (!dockRef) return;

    const rect = dockRef.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    let latest = { x: rect.left, y: rect.top };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      latest = {
        x: Math.max(0, Math.min(window.innerWidth - rect.width, moveEvent.clientX - offsetX)),
        y: Math.max(0, Math.min(window.innerHeight - 28, moveEvent.clientY - offsetY)),
      };
      setPosition(latest);
    };

    const handlePointerUp = () => {
      savePosition(latest);
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
            <label class="city-map-debug-dock__row">
              <span>Road Gen</span>
              <button
                type="button"
                class="city-map-debug-dock__toggle city-map-debug-dock__toggle--on"
                onClick={() => props.onSetRoadGenerationMode?.(
                  props.state.roadGenerationMode === 'legacy' ? 'pm2001'
                    : props.state.roadGenerationMode === 'pm2001' ? 'tensor'
                    : 'legacy'
                )}
              >
                {props.state.roadGenerationMode.toUpperCase()}
              </button>
            </label>
            <For each={rows}>
              {(row) => {
                const unavailable = () => unavailableKeys.has(row.key);
                return (
              <label class="city-map-debug-dock__row">
                <span>{row.label}</span>
                <button
                  type="button"
                  disabled={unavailable()}
                  classList={{
                    'city-map-debug-dock__toggle': true,
                    'city-map-debug-dock__toggle--on': !!props.state[row.key],
                    'city-map-debug-dock__toggle--na': unavailable(),
                  }}
                  onClick={() => {
                    if (!unavailable()) props.onToggle(row.key);
                  }}
                >
                  {unavailable() ? 'N/A' : props.state[row.key] ? 'ON' : 'OFF'}
                </button>
              </label>
                );
              }}
            </For>
          </div>
        </Show>
      </aside>
    </Portal>
  );
};
