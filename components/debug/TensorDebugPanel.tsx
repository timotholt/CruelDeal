import { createEffect, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { TensorBoot } from '../../services/playgame/city-map/tensor/boot';
import type { MapShape } from '../../services/playgame/city-map/tensor/types';

export interface TensorDebugPanelProps {
  controls?: TensorBoot;
}

type TensorTab = 'generation' | 'debug';

const STORAGE_KEY = 'cruel-deal.tensor-debug-panel-position';
const debugPlaceholders = ['Map', 'Roads', 'Buildings', 'Labels', 'Tensor', 'Seeds'];

export const TensorDebugPanel = (props: TensorDebugPanelProps) => {
  const [collapsed, setCollapsed] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<TensorTab>('generation');
  const [zoom, setZoom] = createSignal(1);
  const [colourScheme, setColourScheme] = createSignal('Default');
  const [mapShape, setMapShape] = createSignal<MapShape>('peninsula');
  const [zoomBuildings, setZoomBuildings] = createSignal(false);
  const [buildingModels, setBuildingModels] = createSignal(false);
  const [showFrame, setShowFrame] = createSignal(false);
  const [orthographic, setOrthographic] = createSignal(false);
  const [drawCentre, setDrawCentre] = createSignal(true);
  const [highDPI, setHighDPI] = createSignal(false);
  const [cameraX, setCameraX] = createSignal(0);
  const [cameraY, setCameraY] = createSignal(0);
  const [position, setPosition] = createSignal<{ x: number; y: number } | null>(null);
  let panelRef: HTMLElement | undefined;

  createEffect(() => {
    const controls = props.controls;
    if (!controls) return;
    setZoom(controls.getZoom());
    setMapShape(controls.getMapShape());
    const schemes = controls.getColourSchemes();
    if (schemes.includes('Default')) setColourScheme('Default');
    else if (schemes[0]) setColourScheme(schemes[0]);

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { x?: number; y?: number };
      if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        setPosition({ x: Math.max(0, saved.x!), y: Math.max(0, saved.y!) });
      }
    } catch {
      // Drag placement is a convenience; ignore corrupt storage.
    }
  });

  const savePosition = (next: { x: number; y: number }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures.
    }
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    if (!panelRef) return;

    const rect = panelRef.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    let latest = { x: rect.left, y: rect.top };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latest = {
        x: Math.max(4, Math.min(window.innerWidth - rect.width - 4, moveEvent.clientX - offsetX)),
        y: Math.max(4, Math.min(window.innerHeight - 28, moveEvent.clientY - offsetY)),
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

  const updateZoom = (next: number) => {
    setZoom(next);
    props.controls?.setZoom(next);
  };

  const updateColourScheme = (next: string) => {
    setColourScheme(next);
    props.controls?.setColourScheme(next);
  };

  const updateMapShape = (next: MapShape) => {
    setMapShape(next);
    props.controls?.setMapShape(next);
  };

  const updateCamera = (x: number, y: number) => {
    setCameraX(x);
    setCameraY(y);
    props.controls?.setCamera(x, y);
  };

  const toggle = (current: boolean, setter: (value: boolean) => void, apply: (value: boolean) => void) => {
    const next = !current;
    setter(next);
    apply(next);
  };

  return (
    <Portal mount={document.body}>
      <aside
        ref={(el) => { panelRef = el; }}
        class="tensor-debug-panel"
        aria-label="Tensor debug controls"
        style={position() ? {
          left: `${position()!.x}px`,
          top: `${position()!.y}px`,
          right: 'auto',
          bottom: 'auto',
        } : undefined}
      >
        <div
          class="tensor-debug-panel__header"
          onPointerDown={handlePointerDown}
          style={{ cursor: 'move', 'touch-action': 'none' }}
        >
          <span>TENSOR DEBUG</span>
          <button type="button" onClick={() => setCollapsed(!collapsed())} aria-label="Collapse tensor debug controls">
            {collapsed() ? '>' : 'v'}
          </button>
        </div>

        <Show when={!collapsed()}>
          <div class="tensor-debug-panel__tabs" role="tablist" aria-label="Tensor debug tabs">
            <button
              type="button"
              classList={{ 'tensor-debug-panel__tab': true, 'tensor-debug-panel__tab--active': activeTab() === 'generation' }}
              onClick={() => setActiveTab('generation')}
            >
              Generation
            </button>
            <button
              type="button"
              classList={{ 'tensor-debug-panel__tab': true, 'tensor-debug-panel__tab--active': activeTab() === 'debug' }}
              onClick={() => setActiveTab('debug')}
            >
              Debug
            </button>
          </div>

          <div class="tensor-debug-panel__body">
            <Show when={activeTab() === 'generation'} fallback={
              <>
                <div class="tensor-debug-panel__toggle-grid">
                  <For each={debugPlaceholders}>
                    {(label) => (
                      <button type="button" class="tensor-debug-panel__toggle tensor-debug-panel__toggle--disabled" disabled>
                        {label}
                      </button>
                    )}
                  </For>
                </div>
                <p class="tensor-debug-panel__placeholder">CityMap debug toggles will be connected in the next slice.</p>
              </>
            }>
              <button class="tensor-debug-panel__button tensor-debug-panel__button--primary" type="button" onClick={() => props.controls?.generate()}>
                Generate
              </button>

              <label class="tensor-debug-panel__field">
                <span>Map Shape</span>
                <select value={mapShape()} onChange={(e) => updateMapShape(e.currentTarget.value as MapShape)}>
                  <For each={props.controls?.getMapShapes() ?? []}>
                    {(shape) => <option value={shape}>{shape}</option>}
                  </For>
                </select>
              </label>

              <label class="tensor-debug-panel__field">
                <span>Zoom <b>{zoom().toFixed(1)}</b></span>
                <input
                  type="range"
                  min="0.3"
                  max="5"
                  step="0.1"
                  value={zoom()}
                  onInput={(e) => updateZoom(e.currentTarget.valueAsNumber)}
                />
              </label>

              <label class="tensor-debug-panel__field">
                <span>Colour Scheme</span>
                <select value={colourScheme()} onChange={(e) => updateColourScheme(e.currentTarget.value)}>
                  <For each={props.controls?.getColourSchemes() ?? []}>
                    {(scheme) => <option value={scheme}>{scheme}</option>}
                  </For>
                </select>
              </label>

              <div class="tensor-debug-panel__toggle-grid">
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': zoomBuildings() }} onClick={() => toggle(zoomBuildings(), setZoomBuildings, (value) => props.controls?.setZoomBuildings(value))}>Zoom bldgs</button>
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': buildingModels() }} onClick={() => toggle(buildingModels(), setBuildingModels, (value) => props.controls?.setBuildingModels(value))}>3D bldgs</button>
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': showFrame() }} onClick={() => toggle(showFrame(), setShowFrame, (value) => props.controls?.setShowFrame(value))}>Show frame</button>
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': orthographic() }} onClick={() => toggle(orthographic(), setOrthographic, (value) => props.controls?.setOrthographic(value))}>Ortho</button>
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': drawCentre() }} onClick={() => toggle(drawCentre(), setDrawCentre, (value) => props.controls?.setDrawCentre(value))}>Centres</button>
                <button type="button" classList={{ 'tensor-debug-panel__toggle': true, 'tensor-debug-panel__toggle--on': highDPI() }} onClick={() => toggle(highDPI(), setHighDPI, (value) => props.controls?.setHighDPI(value))}>High DPI</button>
              </div>

              <label class="tensor-debug-panel__field">
                <span>Camera X <b>{cameraX()}</b></span>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="1"
                  value={cameraX()}
                  onInput={(e) => updateCamera(e.currentTarget.valueAsNumber, cameraY())}
                />
              </label>

              <label class="tensor-debug-panel__field">
                <span>Camera Y <b>{cameraY()}</b></span>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="1"
                  value={cameraY()}
                  onInput={(e) => updateCamera(cameraX(), e.currentTarget.valueAsNumber)}
                />
              </label>

              <button class="tensor-debug-panel__button" type="button" onClick={() => props.controls?.downloadPng()}>
                Download PNG
              </button>
            </Show>
          </div>
        </Show>
      </aside>
    </Portal>
  );
};
