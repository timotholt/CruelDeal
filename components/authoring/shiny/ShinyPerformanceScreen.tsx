import { createEffect, createSignal, Index, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import '../../../src/styles/shiny-performance.css';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

interface ReflectionPreset {
  id: string;
  name: string;
  whiteColor: string;
  whiteWidth: number;
  blackWidth: number;
  blackOffsetX: number;
  blackOffsetY: number;
  blackIdle: number;
  blackActive: number;
  tokenWhiteOpacity: number;
  tokenBlackOpacity: number;
}

const REFLECTION_PRESETS: ReflectionPreset[] = [
  { id: 'diffuse', name: '01 Diffuse', whiteColor: 'rgba(255,248,222,0.52)', whiteWidth: 32, blackWidth: 38, blackOffsetX: 30, blackOffsetY: 12, blackIdle: 0.04, blackActive: 0.12, tokenWhiteOpacity: 0.24, tokenBlackOpacity: 0.14 },
  { id: 'satin-sweep', name: '02 Satin Sweep', whiteColor: 'rgba(255,244,204,0.64)', whiteWidth: 25, blackWidth: 32, blackOffsetX: 34, blackOffsetY: 14, blackIdle: 0.06, blackActive: 0.18, tokenWhiteOpacity: 0.32, tokenBlackOpacity: 0.18 },
  { id: 'softbox', name: '03 Softbox', whiteColor: 'rgba(255,249,218,0.76)', whiteWidth: 20, blackWidth: 29, blackOffsetX: 36, blackOffsetY: 16, blackIdle: 0.08, blackActive: 0.24, tokenWhiteOpacity: 0.4, tokenBlackOpacity: 0.22 },
  { id: 'studio', name: '04 Window Balanced', whiteColor: 'rgba(255,252,229,0.92)', whiteWidth: 11, blackWidth: 26, blackOffsetX: 44, blackOffsetY: 12, blackIdle: 0.1, blackActive: 0.3, tokenWhiteOpacity: 0.52, tokenBlackOpacity: 0.2 },
  { id: 'window', name: '05 Window', whiteColor: 'rgba(255,252,229,0.92)', whiteWidth: 11, blackWidth: 26, blackOffsetX: 44, blackOffsetY: 12, blackIdle: 0.1, blackActive: 0.3, tokenWhiteOpacity: 0.58, tokenBlackOpacity: 0.28 },
  { id: 'warm-lamp', name: '06 Warm Lamp', whiteColor: 'rgba(255,226,156,0.88)', whiteWidth: 17, blackWidth: 24, blackOffsetX: 40, blackOffsetY: 20, blackIdle: 0.1, blackActive: 0.3, tokenWhiteOpacity: 0.5, tokenBlackOpacity: 0.28 },
  { id: 'cool-panel', name: '07 Cool Panel', whiteColor: 'rgba(255,254,241,0.96)', whiteWidth: 16, blackWidth: 27, blackOffsetX: 46, blackOffsetY: 8, blackIdle: 0.08, blackActive: 0.28, tokenWhiteOpacity: 0.56, tokenBlackOpacity: 0.26 },
  { id: 'split-room', name: '08 Split Room', whiteColor: 'rgba(255,244,197,0.86)', whiteWidth: 18, blackWidth: 34, blackOffsetX: 54, blackOffsetY: 22, blackIdle: 0.14, blackActive: 0.4, tokenWhiteOpacity: 0.48, tokenBlackOpacity: 0.38 },
  { id: 'foil-flash', name: '09 Foil Flash', whiteColor: 'rgba(255,255,238,1)', whiteWidth: 7, blackWidth: 15, blackOffsetX: 34, blackOffsetY: 10, blackIdle: 0.12, blackActive: 0.44, tokenWhiteOpacity: 0.68, tokenBlackOpacity: 0.38 },
  { id: 'hard-specular', name: '10 Hard Specular', whiteColor: 'rgba(255,255,246,1)', whiteWidth: 8, blackWidth: 19, blackOffsetX: 50, blackOffsetY: 18, blackIdle: 0.2, blackActive: 0.52, tokenWhiteOpacity: 0.74, tokenBlackOpacity: 0.46 },
];

type ReflectionPatternId = 'twin-panes' | 'crosslight' | 'diagonal-pair' | 'window-grid' | 'frames'
  | 'chevron' | 'pillars' | 'horizon' | 'diamonds' | 'corner-fold';

const REFLECTION_PATTERNS: { id: ReflectionPatternId; name: string }[] = [
  { id: 'frames', name: '01 Frames' },
  { id: 'crosslight', name: '02 Crosslight' },
  { id: 'diagonal-pair', name: '03 Diagonal Pair' },
  { id: 'window-grid', name: '04 Window Grid' },
  { id: 'twin-panes', name: '05 Twin Panes' },
  { id: 'chevron', name: '06 Chevron' },
  { id: 'pillars', name: '07 Pillars' },
  { id: 'horizon', name: '08 Horizon' },
  { id: 'diamonds', name: '09 Diamonds' },
  { id: 'corner-fold', name: '10 Corner Fold' },
];

const METAL_PRESETS = [
  { id: 'gold-14k', name: '14K Gold', color: '#c9a45a' },
  { id: 'gold-18k', name: '18K Gold', color: '#d6a338' },
  { id: 'gold-24k', name: '24K Gold', color: '#e0b21d' },
  { id: 'bronze', name: 'Bronze', color: '#a66f35' },
  { id: 'silver', name: 'Silver', color: '#bcc2c5' },
] as const;

const REFLECTION_MAP_WIDTH = 367.5;
const REFLECTION_MAP_HEIGHT = 330;
const REFLECTION_MAP_X = -106.25;
const REFLECTION_MAP_Y = -95;
const REFLECTION_RASTER_SCALE = 2;

interface PerformanceKanTokenProps {
  idPrefix: string;
  filmOnly?: boolean;
  pattern: ReflectionPatternId;
  reflectionMap?: string;
  softness: number;
  zoom: number;
  sourceRef?: (element: SVGSVGElement) => void;
}

const PerformanceKanToken = (props: PerformanceKanTokenProps) => {
  const id = (part: string) => `${props.idPrefix}-${part}`;
  const url = (part: string) => `url(#${id(part)})`;

  const reflectionFilm = () => (
    <g class="perf-kan-token__reflection-film">
      <g filter={props.softness > 0 ? url('film-soften') : undefined}>
        <g transform={`translate(65 65) scale(${props.zoom}) translate(-65 -65)`}>
        <Switch>
        <Match when={props.pattern === 'twin-panes'}>
          <g class="perf-kan-token__reflection-film-dark">
            <rect x="-34" y="-28" width="108" height="98" opacity="0.52" filter={url('box-soft')} />
            <rect x="-12" y="-6" width="64" height="54" opacity="0.62" />
            <rect x="76" y="68" width="112" height="96" opacity="0.42" filter={url('box-soft')} />
            <rect x="101" y="92" width="62" height="48" opacity="0.54" />
          </g>
          <g class="perf-kan-token__reflection-film-light">
            <rect x="43" y="-12" width="86" height="74" opacity="0.62" filter={url('box-tight')} />
            <rect x="64" y="8" width="44" height="34" opacity="0.64" />
            <rect x="-25" y="92" width="66" height="76" opacity="0.46" filter={url('box-tight')} />
          </g>
        </Match>

        <Match when={props.pattern === 'crosslight'}>
          <g class="perf-kan-token__reflection-film-dark">
            <rect x="-80" y="44" width="290" height="40" opacity="0.5" filter={url('box-soft')} />
            <rect x="52" y="-90" width="42" height="310" opacity="0.46" filter={url('box-soft')} />
            <rect x="-80" y="55" width="290" height="17" opacity="0.48" />
          </g>
          <g class="perf-kan-token__reflection-film-light">
            <rect x="-80" y="88" width="290" height="18" opacity="0.58" filter={url('box-tight')} />
            <rect x="104" y="-90" width="18" height="310" opacity="0.66" filter={url('box-tight')} />
          </g>
        </Match>

        <Match when={props.pattern === 'diagonal-pair'}>
          <g class="perf-kan-token__reflection-film-dark" transform="rotate(32 65 65)">
            <rect x="-95" y="19" width="320" height="48" opacity="0.52" filter={url('box-soft')} />
            <rect x="-95" y="31" width="320" height="21" opacity="0.56" />
          </g>
          <g class="perf-kan-token__reflection-film-light" transform="rotate(-32 65 65)">
            <rect x="-95" y="78" width="320" height="30" opacity="0.62" filter={url('box-tight')} />
            <rect x="-95" y="86" width="320" height="11" opacity="0.72" />
          </g>
        </Match>

        <Match when={props.pattern === 'window-grid'}>
          <g class="perf-kan-token__reflection-film-dark">
            <rect x="-58" y="-50" width="92" height="84" opacity="0.5" filter={url('box-tight')} />
            <rect x="92" y="-50" width="92" height="84" opacity="0.5" filter={url('box-tight')} />
            <rect x="-58" y="96" width="92" height="84" opacity="0.5" filter={url('box-tight')} />
            <rect x="92" y="96" width="92" height="84" opacity="0.5" filter={url('box-tight')} />
          </g>
          <g class="perf-kan-token__reflection-film-light">
            <rect x="43" y="-50" width="38" height="230" opacity="0.62" filter={url('box-tight')} />
            <rect x="-58" y="45" width="242" height="38" opacity="0.56" filter={url('box-tight')} />
          </g>
        </Match>

        <Match when={props.pattern === 'frames'}>
          <g class="perf-kan-token__reflection-film-dark" fill="none" stroke="currentColor">
            <rect x="-46" y="-40" width="226" height="210" rx="2" stroke-width="34" opacity="0.5" filter={url('box-soft')} />
            <rect x="-8" y="-4" width="150" height="138" rx="2" stroke-width="18" opacity="0.58" />
          </g>
          <g class="perf-kan-token__reflection-film-light" fill="none" stroke="currentColor">
            <rect x="12" y="14" width="110" height="101" rx="2" stroke-width="12" opacity="0.68" filter={url('box-tight')} />
            <rect x="42" y="42" width="50" height="46" rx="1" stroke-width="7" opacity="0.7" />
          </g>
        </Match>

        <Match when={props.pattern === 'chevron'}>
          <g class="perf-kan-token__reflection-film-dark" fill="none" stroke="currentColor" stroke-linejoin="miter">
            <path d="M -78,-54 L 67,64 L -78,182" stroke-width="42" opacity="0.5" filter={url('box-soft')} />
            <path d="M -70,-45 L 65,64 L -70,173" stroke-width="19" opacity="0.58" />
          </g>
          <g class="perf-kan-token__reflection-film-light" fill="none" stroke="currentColor" stroke-linejoin="miter">
            <path d="M 208,-54 L 63,64 L 208,182" stroke-width="27" opacity="0.62" filter={url('box-tight')} />
            <path d="M 198,-44 L 65,64 L 198,172" stroke-width="10" opacity="0.72" />
          </g>
        </Match>

        <Match when={props.pattern === 'pillars'}>
          <g class="perf-kan-token__reflection-film-dark">
            <rect x="-66" y="-90" width="34" height="320" opacity="0.46" filter={url('box-tight')} />
            <rect x="10" y="-90" width="48" height="320" opacity="0.54" filter={url('box-soft')} />
            <rect x="147" y="-90" width="34" height="320" opacity="0.46" filter={url('box-tight')} />
          </g>
          <g class="perf-kan-token__reflection-film-light">
            <rect x="-22" y="-90" width="18" height="320" opacity="0.62" />
            <rect x="79" y="-90" width="26" height="320" opacity="0.7" filter={url('box-tight')} />
            <rect x="120" y="-90" width="12" height="320" opacity="0.58" />
          </g>
        </Match>

        <Match when={props.pattern === 'horizon'}>
          <g class="perf-kan-token__reflection-film-dark">
            <rect x="-100" y="-48" width="340" height="36" opacity="0.42" filter={url('box-soft')} />
            <rect x="-100" y="42" width="340" height="50" opacity="0.56" filter={url('box-soft')} />
            <rect x="-100" y="154" width="340" height="32" opacity="0.44" filter={url('box-tight')} />
          </g>
          <g class="perf-kan-token__reflection-film-light">
            <rect x="-100" y="5" width="340" height="16" opacity="0.66" filter={url('box-tight')} />
            <rect x="-100" y="110" width="340" height="24" opacity="0.7" filter={url('box-tight')} />
          </g>
        </Match>

        <Match when={props.pattern === 'diamonds'}>
          <g class="perf-kan-token__reflection-film-dark">
            <polygon points="-40,63 34,-12 108,63 34,138" opacity="0.52" filter={url('box-soft')} />
            <polygon points="80,63 154,-12 228,63 154,138" opacity="0.46" filter={url('box-soft')} />
            <polygon points="4,63 34,32 64,63 34,94" opacity="0.58" />
          </g>
          <g class="perf-kan-token__reflection-film-light" fill="none" stroke="currentColor">
            <polygon points="20,63 94,-12 168,63 94,138" stroke-width="20" opacity="0.66" filter={url('box-tight')} />
            <polygon points="58,63 94,26 130,63 94,100" stroke-width="8" opacity="0.72" />
          </g>
        </Match>

        <Match when={props.pattern === 'corner-fold'}>
          <g class="perf-kan-token__reflection-film-dark" fill="none" stroke="currentColor">
            <path d="M -56,78 L -56,-36 L 62,-36" stroke-width="46" opacity="0.5" filter={url('box-soft')} />
            <path d="M 184,48 L 184,166 L 66,166" stroke-width="46" opacity="0.5" filter={url('box-soft')} />
            <path d="M -45,70 L -45,-24 L 53,-24" stroke-width="18" opacity="0.56" />
          </g>
          <g class="perf-kan-token__reflection-film-light" fill="none" stroke="currentColor">
            <path d="M 72,-24 L 174,-24 L 174,74" stroke-width="24" opacity="0.64" filter={url('box-tight')} />
            <path d="M 56,154 L -44,154 L -44,54" stroke-width="24" opacity="0.64" filter={url('box-tight')} />
          </g>
        </Match>
        </Switch>
        </g>
      </g>
    </g>
  );

  return (
  <svg
    ref={(element) => props.sourceRef?.(element)}
    class="perf-kan-token__svg"
    viewBox={props.filmOnly ? '-45 -40 245 220' : '0 0 100 100'}
    aria-hidden="true"
  >
    <defs>
      <clipPath id={id('k-clip')}><rect x="10" y="32.40" width="80" height="35.20" /></clipPath>
      <filter id={id('box-soft')} filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id={id('box-tight')} filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id={id('film-soften')} filterUnits="userSpaceOnUse" x="-160" y="-160" width="420" height="420">
        <feGaussianBlur stdDeviation={props.softness} />
      </filter>
      <g id={id('metal-geometry')} fill="none" stroke-linejoin="miter">
        <polygon points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" stroke-width="3.50" />
        <polygon points="31.25, 17.53 68.75, 17.53 87.49, 50 68.75, 82.47 31.25, 82.47 12.51, 50" stroke-width="3.50" />
        <polygon points="35.01, 24.03 64.99, 24.03 79.99, 50 64.99, 75.97 35.01, 75.97 20.01, 50" stroke-width="3.50" />
        <path d="M 39.90,32.40 L 39.91,67.60" stroke-width="6.5" stroke-linecap="butt" />
        <g clip-path={url('k-clip')}>
          <path d="M 39.90,56.12 L 72.13,18.65" stroke-width="6.5" stroke-linecap="butt" />
          <path d="M 48.70,48.27 L 68.55,81.35" stroke-width="6.5" stroke-linecap="butt" />
        </g>
      </g>
      <mask id={id('metal-mask')} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <use href={`#${id('metal-geometry')}`} stroke="#fff" />
      </mask>
    </defs>

    <Show
      when={props.filmOnly}
      fallback={(
        <>
          <polygon class="perf-kan-token__recess" points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" />
          <use href={`#${id('metal-geometry')}`} class="perf-kan-token__substrate" />
          <g mask={url('metal-mask')}>
            <Show when={props.reflectionMap} fallback={reflectionFilm()}>
              {(map) => (
                <g class="perf-kan-token__reflection-film">
                  <image
                    href={map()}
                    x={REFLECTION_MAP_X}
                    y={REFLECTION_MAP_Y}
                    width={REFLECTION_MAP_WIDTH}
                    height={REFLECTION_MAP_HEIGHT}
                    preserveAspectRatio="none"
                  />
                </g>
              )}
            </Show>
          </g>
        </>
      )}
    >
      <rect class="perf-kan-debug-film__base" x="-45" y="-40" width="245" height="220" />
      {reflectionFilm()}
    </Show>
  </svg>
  );
};

export const ShinyPerformanceScreen = () => {
  let screenRef!: HTMLElement;
  let reflectionSourceRef!: SVGSVGElement;
  let pendingDirection: { x: number; y: number } | null = null;
  let pendingInputCoordinates = { x: 0, y: 0 };
  let animationFrame = 0;
  let reflectionRasterFrame = 0;
  let reflectionRasterVersion = 0;
  let reflectionMapObjectUrl = '';
  let lastFrameAt = 0;
  let gyroOrigin: { beta: number; gamma: number } | null = null;
  let updateCount = 0;
  let metricsTimer = 0;

  const [gain, setGain] = createSignal(2.25);
  const [frameRate, setFrameRate] = createSignal<30 | 60>(30);
  const [fullLoad, setFullLoad] = createSignal(false);
  const [tiltEnabled, setTiltEnabled] = createSignal(false);
  const [updatesPerSecond, setUpdatesPerSecond] = createSignal(0);
  const [movingReflections, setMovingReflections] = createSignal(true);
  const [selectedReflectionPreset, setSelectedReflectionPreset] = createSignal('foil-flash');
  const [selectedReflectionPattern, setSelectedReflectionPattern] = createSignal<ReflectionPatternId>('frames');
  const [reflectionSoftness, setReflectionSoftness] = createSignal(9);
  const [reflectionZoom, setReflectionZoom] = createSignal(1);
  const [selectedMetal, setSelectedMetal] = createSignal('gold-18k');
  const [reflectionMap, setReflectionMap] = createSignal('');
  const [inputCoordinates, setInputCoordinates] = createSignal({ x: 0, y: 0 });
  const [reflectionDirection, setReflectionDirection] = createSignal({ x: 0, y: 0 });

  const applyReflectionPreset = (preset: ReflectionPreset) => {
    setSelectedReflectionPreset(preset.id);
    screenRef.style.setProperty('--perf-white-reflection', preset.whiteColor);
    screenRef.style.setProperty('--perf-white-reflection-opacity', String(preset.tokenWhiteOpacity));
    screenRef.style.setProperty('--perf-black-reflection-opacity', String(preset.tokenBlackOpacity));
  };

  const applyMetalPreset = (preset: typeof METAL_PRESETS[number]) => {
    setSelectedMetal(preset.id);
    screenRef.style.setProperty('--perf-metal-base', preset.color);
  };

  const reflectionPreview = (preset: ReflectionPreset) => (
    `radial-gradient(ellipse ${preset.whiteWidth}% 150% at 34% 50%, ${preset.whiteColor} 0%, transparent 100%), `
    + `radial-gradient(ellipse ${preset.blackWidth}% 170% at ${34 + preset.blackOffsetX}% 50%, rgba(0,0,0,${Math.min(0.9, preset.blackIdle + preset.blackActive)}) 0%, transparent 100%), `
    + 'var(--perf-metal-base)'
  );

  const toggleMovingReflections = (enabled: boolean) => {
    setMovingReflections(enabled);
    if (!enabled) pendingDirection = null;
  };

  const commitDirection = (x: number, y: number) => {
    screenRef.style.setProperty('--perf-reflex-x', x.toFixed(4));
    screenRef.style.setProperty('--perf-reflex-y', y.toFixed(4));
    setInputCoordinates(pendingInputCoordinates);
    setReflectionDirection({ x, y });
    updateCount += 1;
  };

  const flush = (timestamp: number) => {
    animationFrame = 0;
    if (!pendingDirection) return;

    const frameInterval = 1000 / frameRate();
    if (timestamp - lastFrameAt < frameInterval - 1) {
      animationFrame = requestAnimationFrame(flush);
      return;
    }

    lastFrameAt = timestamp;
    const next = pendingDirection;
    pendingDirection = null;
    commitDirection(next.x, next.y);
  };

  const mapReflectionAxis = (value: number) => {
    const normalized = clamp(value, -1, 1);
    const exponent = 1 / gain();
    return Math.sign(normalized) * Math.pow(Math.abs(normalized), exponent) * 0.92;
  };

  const scheduleDirection = (x: number, y: number, input = { x, y }) => {
    const nextDirection = {
      x: mapReflectionAxis(x),
      y: mapReflectionAxis(y),
    };
    pendingInputCoordinates = input;
    pendingDirection = nextDirection;
    if (!animationFrame) animationFrame = requestAnimationFrame(flush);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (tiltEnabled() || !movingReflections()) return;
    const x = event.clientX / window.innerWidth * 2 - 1;
    const y = event.clientY / window.innerHeight * 2 - 1;
    // Reverse pointer X so the visible reflection follows horizontal mouse movement.
    scheduleDirection(-x, y, { x, y });
  };

  const handlePointerLeave = () => {
    if (!tiltEnabled() && movingReflections()) {
      scheduleDirection(0, 0);
    }
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!tiltEnabled() || !movingReflections()) return;
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    if (!gyroOrigin) gyroOrigin = { beta, gamma };
    const x = (gamma - gyroOrigin.gamma) / 28;
    const y = (beta - gyroOrigin.beta) / 28;
    scheduleDirection(x, y);
  };

  const enableTilt = async () => {
    if (typeof DeviceOrientationEvent === 'undefined') return;
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (orientationEvent.requestPermission) {
      const permission = await orientationEvent.requestPermission();
      if (permission !== 'granted') return;
    }

    gyroOrigin = null;
    setTiltEnabled(true);
  };

  const usePointer = () => {
    setTiltEnabled(false);
    gyroOrigin = null;
    scheduleDirection(0, 0);
  };

  const reflectionShift = () => ({
    x: -14 - reflectionDirection().x * 78,
    y: -10 - reflectionDirection().y * 96,
  });

  const rasterizeReflectionMap = async (version: number) => {
    if (!reflectionSourceRef) return;

    const source = reflectionSourceRef;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(REFLECTION_MAP_WIDTH * REFLECTION_RASTER_SCALE));
    clone.setAttribute('height', String(REFLECTION_MAP_HEIGHT * REFLECTION_RASTER_SCALE));
    clone.querySelector('.perf-kan-debug-film__base')?.remove();

    const sourceFilm = source.querySelector('.perf-kan-token__reflection-film') as SVGGElement | null;
    const cloneFilm = clone.querySelector('.perf-kan-token__reflection-film') as SVGGElement | null;
    if (cloneFilm) {
      cloneFilm.style.transform = 'none';
      cloneFilm.setAttribute('transform', 'translate(0 0)');
    }

    const sourceLayers = source.querySelectorAll<SVGGElement>(
      '.perf-kan-token__reflection-film-dark, .perf-kan-token__reflection-film-light',
    );
    const cloneLayers = clone.querySelectorAll<SVGGElement>(
      '.perf-kan-token__reflection-film-dark, .perf-kan-token__reflection-film-light',
    );
    sourceLayers.forEach((layer, index) => {
      const target = cloneLayers[index];
      if (!target) return;
      const style = getComputedStyle(layer);
      target.style.color = style.color;
      target.style.fill = style.fill;
      target.style.opacity = style.opacity;
    });

    if (sourceFilm && cloneFilm) {
      cloneFilm.style.opacity = getComputedStyle(sourceFilm).opacity;
    }

    const svg = new XMLSerializer().serializeToString(clone);
    const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to rasterize reflection map'));
        image.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = REFLECTION_MAP_WIDTH * REFLECTION_RASTER_SCALE;
      canvas.height = REFLECTION_MAP_HEIGHT * REFLECTION_RASTER_SCALE;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to encode reflection map')), 'image/png');
      });
      if (version !== reflectionRasterVersion) return;

      const nextObjectUrl = URL.createObjectURL(png);
      const previousObjectUrl = reflectionMapObjectUrl;
      reflectionMapObjectUrl = nextObjectUrl;
      setReflectionMap(nextObjectUrl);
      if (previousObjectUrl) requestAnimationFrame(() => URL.revokeObjectURL(previousObjectUrl));
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  createEffect(() => {
    selectedReflectionPattern();
    reflectionSoftness();
    reflectionZoom();
    selectedReflectionPreset();
    const version = ++reflectionRasterVersion;
    cancelAnimationFrame(reflectionRasterFrame);
    reflectionRasterFrame = requestAnimationFrame(() => void rasterizeReflectionMap(version));
  });

  createEffect(() => {
    const map = reflectionMap();
    if (map && screenRef) screenRef.style.setProperty('--perf-reflection-map', `url(${map})`);
  });

  onMount(() => {
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    metricsTimer = window.setInterval(() => {
      setUpdatesPerSecond(updateCount);
      updateCount = 0;
    }, 1000);
  });

  onCleanup(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerleave', handlePointerLeave);
    window.removeEventListener('deviceorientation', handleOrientation);
    window.clearInterval(metricsTimer);
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (reflectionRasterFrame) cancelAnimationFrame(reflectionRasterFrame);
    if (reflectionMapObjectUrl) URL.revokeObjectURL(reflectionMapObjectUrl);
  });

  return (
    <main
      ref={(element) => { screenRef = element; }}
      class="shiny-performance-screen"
      data-full-load={fullLoad() ? 'true' : 'false'}
      data-motion={movingReflections() ? 'on' : 'off'}
    >
      <header class="shiny-performance-toolbar">
        <div class="shiny-performance-title">
          <span class="shiny-performance-kicker">// MOBILE MATERIAL PROOF</span>
          <h1>Gold Reflex <span>02</span></h1>
        </div>

        <div class="shiny-performance-controls" aria-label="Reflex controls">
          <label class="shiny-performance-range">
            <span>Gain</span>
            <input
              type="range"
              min="0.75"
              max="4"
              step="0.05"
              value={gain()}
              onInput={(event) => setGain(Number(event.currentTarget.value))}
            />
            <output>{gain().toFixed(2)}x</output>
          </label>

          <div class="shiny-performance-segmented" aria-label="Frame rate">
            <button classList={{ active: frameRate() === 30 }} onClick={() => setFrameRate(30)}>30</button>
            <button classList={{ active: frameRate() === 60 }} onClick={() => setFrameRate(60)}>60</button>
          </div>

          <label class="shiny-performance-toggle">
            <input type="checkbox" checked={fullLoad()} onChange={(event) => setFullLoad(event.currentTarget.checked)} />
            <span>Full load</span>
          </label>

          <label class="shiny-performance-toggle">
            <input
              type="checkbox"
              checked={movingReflections()}
              onChange={(event) => toggleMovingReflections(event.currentTarget.checked)}
            />
            <span>Moving reflections</span>
          </label>

          <button class="shiny-performance-command" onClick={() => tiltEnabled() ? usePointer() : void enableTilt()}>
            {tiltEnabled() ? 'Pointer' : 'Enable tilt'}
          </button>
        </div>
      </header>

      <section class="shiny-performance-workspace">
        <div class="shiny-performance-readout" aria-live="polite">
          <span><strong>{updatesPerSecond()}</strong> updates/s</span>
          <span><strong>{fullLoad() ? '100%' : '~15%'}</strong> gold load</span>
          <span><strong>{tiltEnabled() ? 'tilt' : 'pointer'}</strong> input</span>
        </div>

        <section class="shiny-performance-reflection-editor">
          <div class="shiny-performance-reflection-editor__header">
            <div>
              <span class="shiny-performance-kicker">// REFLECTION SOURCE</span>
              <strong>Intensity profiles</strong>
            </div>
          </div>
          <div class="shiny-performance-reflection-profile-grid" aria-label="Moving reflection presets">
            <Index each={REFLECTION_PRESETS}>
              {(preset) => (
                <button
                  classList={{ active: selectedReflectionPreset() === preset().id }}
                  onClick={() => applyReflectionPreset(preset())}
                >
                  <span style={{ background: reflectionPreview(preset()) }} />
                  <strong>{preset().name}</strong>
                </button>
              )}
            </Index>
          </div>
          <div class="shiny-performance-metal-picker" aria-label="Metal color">
            <Index each={METAL_PRESETS}>
              {(metal) => (
                <button
                  classList={{ active: selectedMetal() === metal().id }}
                  onClick={() => applyMetalPreset(metal())}
                >
                  <span style={{ background: metal().color }} />
                  <strong>{metal().name}</strong>
                </button>
              )}
            </Index>
          </div>
        </section>

        <article class="shiny-performance-phone" aria-label="Mobile game UI reflex preview">
          <div class="shiny-performance-phone-status">
            <span>23:41</span>
            <span>CRUELNET // SECURE</span>
            <span>87%</span>
          </div>

          <div class="shiny-performance-appbar">
            <div class="perf-kan-token perf-metal--dynamic" aria-label="Kan token">
              <PerformanceKanToken
                idPrefix="perf-kan-small"
                pattern={selectedReflectionPattern()}
                reflectionMap={reflectionMap()}
                softness={reflectionSoftness()}
                zoom={reflectionZoom()}
              />
            </div>
            <div class="shiny-performance-appbar-copy">
              <span>District 09</span>
              <strong>Night Market</strong>
            </div>
            <div class="shiny-performance-balance">
              <span class="perf-metal perf-metal--dynamic">2,450</span>
              <small>AU</small>
            </div>
          </div>

          <section class="shiny-performance-mission">
            <div class="shiny-performance-eyebrow"><span>//</span> LIVE CONTRACT</div>
            <h2>Ghost Signal<br /><span class="perf-metal perf-metal--dynamic">Extraction</span></h2>
            <p>Intercept the relay convoy before it clears the floodwall checkpoint.</p>

            <div class="shiny-performance-progress">
              <div class="shiny-performance-progress__head">
                <span>Signal trace</span>
                <strong class="perf-metal perf-metal--static">68%</strong>
              </div>
              <div class="shiny-performance-progress__track">
                <div class="shiny-performance-progress__fill perf-metal--dynamic" />
              </div>
            </div>
          </section>

          <section class="shiny-performance-objectives">
            <div class="shiny-performance-section-title"><span>//</span> OPERATIONS</div>
            <div class="shiny-performance-objective shiny-performance-objective--active">
              <div class="shiny-performance-objective__index perf-metal perf-metal--static">01</div>
              <div><strong> breach the relay</strong><span>Warehouse perimeter</span></div>
              <b>ACTIVE</b>
            </div>
            <div class="shiny-performance-objective">
              <div class="shiny-performance-objective__index perf-metal perf-metal--static">02</div>
              <div><strong>Extract the cipher</strong><span>Encrypted cargo node</span></div>
              <b>LOCKED</b>
            </div>
            <div class="shiny-performance-objective">
              <div class="shiny-performance-objective__index perf-metal perf-metal--static">03</div>
              <div><strong>Burn the route</strong><span>Leave no telemetry</span></div>
              <b>LOCKED</b>
            </div>
          </section>

          <button class="shiny-performance-cta">
            <span class="shiny-performance-cta__mark perf-metal--dynamic">K</span>
            <span>Initiate extraction</span>
            <span aria-hidden="true">›</span>
          </button>

          <nav class="shiny-performance-nav" aria-label="Game navigation">
            <button><span>⌂</span><small>Home</small></button>
            <button class="active"><span class="perf-metal perf-metal--static">◆</span><small>Ops</small></button>
            <button><span>▦</span><small>Deck</small></button>
            <button><span>◎</span><small>Profile</small></button>
          </nav>
        </article>

        <section class="shiny-performance-token-debug" aria-label="Token reflection diagnostics">
          <div class="shiny-performance-pattern-toolbar">
            <div>
              <span class="shiny-performance-kicker">// REFLECTION SOURCE</span>
              <strong>Pattern geometry</strong>
            </div>
            <div class="shiny-performance-pattern-toolbar__controls">
              <label>
                <span>Zoom</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={reflectionZoom()}
                  onInput={(event) => setReflectionZoom(Number(event.currentTarget.value))}
                />
                <output>{Math.round(reflectionZoom() * 100)}%</output>
              </label>
              <label>
                <span>Softness</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={reflectionSoftness()}
                  onInput={(event) => setReflectionSoftness(Number(event.currentTarget.value))}
                />
                <output>{reflectionSoftness().toFixed(1)}</output>
              </label>
            </div>
          </div>

          <nav class="shiny-performance-pattern-picker" aria-label="Reflection pattern">
            <Index each={REFLECTION_PATTERNS}>
              {(pattern) => (
                <button
                  classList={{ active: selectedReflectionPattern() === pattern().id }}
                  onClick={() => setSelectedReflectionPattern(pattern().id)}
                >
                  {pattern().name}
                </button>
              )}
            </Index>
          </nav>

          <figure class="shiny-performance-token-debug__figure">
            <figcaption>
              <div>
                <span class="shiny-performance-kicker">// UNMASKED</span>
                <strong>Reflection film</strong>
              </div>
              <dl class="shiny-performance-token-debug__readout" aria-live="polite">
                <div><dt>mouse x</dt><dd>{inputCoordinates().x.toFixed(3)}</dd></div>
                <div><dt>mouse y</dt><dd>{inputCoordinates().y.toFixed(3)}</dd></div>
                <div><dt>shift x</dt><dd>{reflectionShift().x.toFixed(1)}px</dd></div>
                <div><dt>shift y</dt><dd>{reflectionShift().y.toFixed(1)}px</dd></div>
              </dl>
            </figcaption>
            <div class="shiny-performance-token-debug__atlas">
              <PerformanceKanToken
                idPrefix="perf-kan-atlas"
                pattern={selectedReflectionPattern()}
                softness={reflectionSoftness()}
                zoom={reflectionZoom()}
                sourceRef={(element) => { reflectionSourceRef = element; }}
                filmOnly
              />
            </div>
          </figure>

          <figure class="shiny-performance-token-debug__figure shiny-performance-token-debug__figure--token">
            <figcaption>
              <div>
                <span class="shiny-performance-kicker">// 3X MASK</span>
                <strong>Kan token</strong>
              </div>
            </figcaption>
            <div class="perf-kan-token perf-kan-token--large perf-metal--dynamic" aria-label="Kan token at three times scale">
              <PerformanceKanToken
                idPrefix="perf-kan-large"
                pattern={selectedReflectionPattern()}
                reflectionMap={reflectionMap()}
                softness={reflectionSoftness()}
                zoom={reflectionZoom()}
              />
            </div>
          </figure>
        </section>
      </section>
    </main>
  );
};

export default ShinyPerformanceScreen;
