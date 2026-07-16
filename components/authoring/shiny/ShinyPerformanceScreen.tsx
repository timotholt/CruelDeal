import { createSignal, Index, onCleanup, onMount, Show } from 'solid-js';
import '../../../src/styles/shiny-performance.css';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

interface GoldStop {
  offset: number;
  color: string;
}

interface GoldGradientPreset {
  id: string;
  name: string;
  stops: GoldStop[];
}

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

const GOLD_STOP_OFFSETS = [0, 8, 26, 30, 34, 60, 81, 85, 93, 100];

const createGoldStops = (colors: string[]): GoldStop[] => (
  colors.map((color, index) => ({ offset: GOLD_STOP_OFFSETS[index], color }))
);

const GOLD_GRADIENT_PRESETS: GoldGradientPreset[] = [
  { id: 'whisper', name: '01 Whisper', stops: createGoldStops(['#B9A772', '#C8B887', '#D8CAA1', '#C1AF7B', '#FFF9DD', '#E6D9B4', '#D4C493', '#BCAA75', '#F5E9C2', '#B9A772']) },
  { id: 'champagne', name: '02 Champagne', stops: createGoldStops(['#AA925C', '#BFA873', '#D4C08F', '#B39A62', '#FFF8D8', '#E4D2AA', '#CEB983', '#A98F56', '#F6E5B2', '#AA925C']) },
  { id: 'soft-aurum', name: '03 Soft Aurum', stops: createGoldStops(['#9C8048', '#B1965C', '#CBB37C', '#957741', '#FFF5CB', '#E0C99A', '#C4AB70', '#92743B', '#F6DFA1', '#9C8048']) },
  { id: 'satin', name: '04 Satin', stops: createGoldStops(['#8D6E34', '#A98848', '#C3A765', '#80602A', '#FFF0B4', '#D9BA7D', '#B99950', '#785821', '#F5D68A', '#8D6E34']) },
  { id: 'balanced', name: '05 Balanced', stops: createGoldStops(['#957B45', '#AA8F59', '#C3AC76', '#8F7440', '#FFFDDA', '#DDC79B', '#C3AC76', '#8F7440', '#FBECA9', '#957B45']) },
  { id: 'coin', name: '06 Coin', stops: createGoldStops(['#74531E', '#967331', '#BC984F', '#684716', '#FFE99A', '#D4AA58', '#AB8538', '#5E3E10', '#F3CE6E', '#74531E']) },
  { id: 'royal', name: '07 Royal', stops: createGoldStops(['#60400F', '#87601D', '#B98C37', '#533307', '#FFE47C', '#D3A244', '#A57421', '#482B04', '#F4C753', '#60400F']) },
  { id: 'antique', name: '08 Antique', stops: createGoldStops(['#51350D', '#75531B', '#9F792F', '#432904', '#EAC76E', '#BA8F42', '#8A6221', '#392203', '#DDB657', '#51350D']) },
  { id: 'foil', name: '09 Foil', stops: createGoldStops(['#3A2405', '#6E490D', '#AD7E25', '#2C1901', '#FFF0A1', '#D8A83D', '#8E5E12', '#211100', '#FFD564', '#3A2405']) },
  { id: 'black-gold', name: '10 Black Gold', stops: createGoldStops(['#211304', '#533007', '#946014', '#160B00', '#FFF7C5', '#D49B2C', '#754308', '#0E0700', '#FFD96B', '#211304']) },
];

const DEFAULT_GOLD_STOPS = GOLD_GRADIENT_PRESETS[4].stops;

const REFLECTION_PRESETS: ReflectionPreset[] = [
  { id: 'diffuse', name: '01 Diffuse', whiteColor: 'rgba(255,248,222,0.52)', whiteWidth: 32, blackWidth: 38, blackOffsetX: 30, blackOffsetY: 12, blackIdle: 0.04, blackActive: 0.12, tokenWhiteOpacity: 0.24, tokenBlackOpacity: 0.14 },
  { id: 'satin-sweep', name: '02 Satin Sweep', whiteColor: 'rgba(255,244,204,0.64)', whiteWidth: 25, blackWidth: 32, blackOffsetX: 34, blackOffsetY: 14, blackIdle: 0.06, blackActive: 0.18, tokenWhiteOpacity: 0.32, tokenBlackOpacity: 0.18 },
  { id: 'softbox', name: '03 Softbox', whiteColor: 'rgba(255,249,218,0.76)', whiteWidth: 20, blackWidth: 29, blackOffsetX: 36, blackOffsetY: 16, blackIdle: 0.08, blackActive: 0.24, tokenWhiteOpacity: 0.4, tokenBlackOpacity: 0.22 },
  { id: 'studio', name: '04 Studio', whiteColor: 'rgba(255,249,207,0.88)', whiteWidth: 14, blackWidth: 21, blackOffsetX: 38, blackOffsetY: 18, blackIdle: 0.16, blackActive: 0.38, tokenWhiteOpacity: 0.52, tokenBlackOpacity: 0.34 },
  { id: 'window', name: '05 Window', whiteColor: 'rgba(255,252,229,0.92)', whiteWidth: 11, blackWidth: 26, blackOffsetX: 44, blackOffsetY: 12, blackIdle: 0.1, blackActive: 0.3, tokenWhiteOpacity: 0.58, tokenBlackOpacity: 0.28 },
  { id: 'warm-lamp', name: '06 Warm Lamp', whiteColor: 'rgba(255,226,156,0.88)', whiteWidth: 17, blackWidth: 24, blackOffsetX: 40, blackOffsetY: 20, blackIdle: 0.1, blackActive: 0.3, tokenWhiteOpacity: 0.5, tokenBlackOpacity: 0.28 },
  { id: 'cool-panel', name: '07 Cool Panel', whiteColor: 'rgba(255,254,241,0.96)', whiteWidth: 16, blackWidth: 27, blackOffsetX: 46, blackOffsetY: 8, blackIdle: 0.08, blackActive: 0.28, tokenWhiteOpacity: 0.56, tokenBlackOpacity: 0.26 },
  { id: 'split-room', name: '08 Split Room', whiteColor: 'rgba(255,244,197,0.86)', whiteWidth: 18, blackWidth: 34, blackOffsetX: 54, blackOffsetY: 22, blackIdle: 0.14, blackActive: 0.4, tokenWhiteOpacity: 0.48, tokenBlackOpacity: 0.38 },
  { id: 'foil-flash', name: '09 Foil Flash', whiteColor: 'rgba(255,255,238,1)', whiteWidth: 7, blackWidth: 15, blackOffsetX: 34, blackOffsetY: 10, blackIdle: 0.12, blackActive: 0.44, tokenWhiteOpacity: 0.68, tokenBlackOpacity: 0.38 },
  { id: 'hard-specular', name: '10 Hard Specular', whiteColor: 'rgba(255,255,246,1)', whiteWidth: 8, blackWidth: 19, blackOffsetX: 50, blackOffsetY: 18, blackIdle: 0.2, blackActive: 0.52, tokenWhiteOpacity: 0.74, tokenBlackOpacity: 0.46 },
];

const PerformanceKanToken = () => (
  <svg class="perf-kan-token__svg" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <clipPath id="perf-kan-k-clip"><rect x="10" y="32.40" width="80" height="35.20" /></clipPath>
      <linearGradient id="perf-kan-film-dark" x1="-50" y1="-40" x2="150" y2="140" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#000" stop-opacity="0" />
        <stop offset="18%" stop-color="#000" stop-opacity="0.1" />
        <stop offset="29%" stop-color="#000" stop-opacity="1" />
        <stop offset="42%" stop-color="#000" stop-opacity="0.72" />
        <stop offset="56%" stop-color="#000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="perf-kan-film-light" x1="-50" y1="-40" x2="150" y2="140" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fff" stop-opacity="0" />
        <stop offset="46%" stop-color="#F4D993" stop-opacity="0" />
        <stop offset="60%" stop-color="#F4D993" stop-opacity="0.42" />
        <stop offset="70%" stop-color="#FFF8D5" stop-opacity="0.96" />
        <stop offset="76%" stop-color="#fff" stop-opacity="1" />
        <stop offset="84%" stop-color="#F4D993" stop-opacity="0.52" />
        <stop offset="94%" stop-color="#F4D993" stop-opacity="0" />
        <stop offset="100%" stop-color="#F4D993" stop-opacity="0" />
      </linearGradient>
      <g id="perf-kan-metal-geometry" fill="none" stroke-linejoin="miter">
        <polygon points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" stroke-width="3.50" />
        <polygon points="31.25, 17.53 68.75, 17.53 87.49, 50 68.75, 82.47 31.25, 82.47 12.51, 50" stroke-width="3.50" />
        <polygon points="35.01, 24.03 64.99, 24.03 79.99, 50 64.99, 75.97 35.01, 75.97 20.01, 50" stroke-width="3.50" />
        <path d="M 39.90,32.40 L 39.91,67.60" stroke-width="6.5" stroke-linecap="butt" />
        <g clip-path="url(#perf-kan-k-clip)">
          <path d="M 39.90,56.12 L 72.13,18.65" stroke-width="6.5" stroke-linecap="butt" />
          <path d="M 48.70,48.27 L 68.55,81.35" stroke-width="6.5" stroke-linecap="butt" />
        </g>
      </g>
      <mask id="perf-kan-metal-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <use href="#perf-kan-metal-geometry" stroke="#fff" />
      </mask>
    </defs>

    <polygon class="perf-kan-token__recess" points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" />
    <use href="#perf-kan-metal-geometry" class="perf-kan-token__substrate" />
    <g mask="url(#perf-kan-metal-mask)">
      <g class="perf-kan-token__reflection-film">
        <rect class="perf-kan-token__reflection-film-dark" x="-140" y="-140" width="380" height="380" />
        <rect class="perf-kan-token__reflection-film-light" x="-140" y="-140" width="380" height="380" />
      </g>
    </g>
  </svg>
);

export const ShinyPerformanceScreen = () => {
  let screenRef!: HTMLElement;
  let phoneRef!: HTMLElement;
  let pendingDirection: { x: number; y: number } | null = null;
  let animationFrame = 0;
  let lastFrameAt = 0;
  let reflectionIdleTimer = 0;
  let lastInputDirection = { x: 0, y: 0 };
  let gyroOrigin: { beta: number; gamma: number } | null = null;
  let updateCount = 0;
  let metricsTimer = 0;

  const [gain, setGain] = createSignal(2.25);
  const [frameRate, setFrameRate] = createSignal<30 | 60>(30);
  const [fullLoad, setFullLoad] = createSignal(false);
  const [tiltEnabled, setTiltEnabled] = createSignal(false);
  const [updatesPerSecond, setUpdatesPerSecond] = createSignal(0);
  const [movingReflections, setMovingReflections] = createSignal(true);
  const [showGradientEditor, setShowGradientEditor] = createSignal(true);
  const [goldStops, setGoldStops] = createSignal<GoldStop[]>(DEFAULT_GOLD_STOPS.map((stop) => ({ ...stop })));
  const [selectedGradientPreset, setSelectedGradientPreset] = createSignal('balanced');
  const [selectedReflectionPreset, setSelectedReflectionPreset] = createSignal('studio');

  const applyGoldStops = (nextStops: GoldStop[], presetId = 'custom') => {
    setGoldStops(nextStops);
    setSelectedGradientPreset(presetId);
    nextStops.forEach((stop, index) => {
      screenRef.style.setProperty(`--perf-gold-color-${index}`, stop.color);
      screenRef.style.setProperty(`--perf-gold-offset-${index}`, `${stop.offset}%`);
    });
  };

  const updateGoldStopColor = (index: number, color: string) => {
    const normalized = color.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) return;
    applyGoldStops(goldStops().map((stop, stopIndex) => stopIndex === index ? { ...stop, color: normalized } : stop));
  };

  const updateGoldStopOffset = (index: number, value: number) => {
    const stops = goldStops();
    const minimum = index === 0 ? 0 : stops[index - 1].offset;
    const maximum = index === stops.length - 1 ? 100 : stops[index + 1].offset;
    const offset = Math.round(clamp(value, minimum, maximum) * 10) / 10;
    applyGoldStops(stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, offset } : stop));
  };

  const resetGoldStops = () => applyGoldStops(DEFAULT_GOLD_STOPS.map((stop) => ({ ...stop })), 'balanced');

  const applyGradientPreset = (preset: GoldGradientPreset) => {
    applyGoldStops(preset.stops.map((stop) => ({ ...stop })), preset.id);
  };

  const applyReflectionPreset = (preset: ReflectionPreset) => {
    setSelectedReflectionPreset(preset.id);
    screenRef.style.setProperty('--perf-white-reflection', preset.whiteColor);
    screenRef.style.setProperty('--perf-white-radius-x', `${preset.whiteWidth}%`);
    screenRef.style.setProperty('--perf-black-radius-x', `${preset.blackWidth}%`);
    screenRef.style.setProperty('--perf-black-offset-x', `${preset.blackOffsetX}%`);
    screenRef.style.setProperty('--perf-black-offset-y', `${preset.blackOffsetY}%`);
    screenRef.style.setProperty('--perf-black-idle-core', String(preset.blackIdle));
    screenRef.style.setProperty('--perf-black-active-core', String(preset.blackActive));
    screenRef.style.setProperty('--perf-black-idle-edge', String(preset.blackIdle * 0.56));
    screenRef.style.setProperty('--perf-black-active-edge', String(preset.blackActive * 0.63));
    screenRef.style.setProperty('--perf-white-reflection-opacity', String(preset.tokenWhiteOpacity));
    screenRef.style.setProperty('--perf-black-reflection-opacity', String(preset.tokenBlackOpacity));
  };

  const reflectionPreview = (preset: ReflectionPreset) => (
    `radial-gradient(ellipse ${preset.whiteWidth}% 150% at 34% 50%, ${preset.whiteColor} 0%, transparent 100%), `
    + `radial-gradient(ellipse ${preset.blackWidth}% 170% at ${34 + preset.blackOffsetX}% 50%, rgba(0,0,0,${Math.min(0.9, preset.blackIdle + preset.blackActive)}) 0%, transparent 100%), `
    + 'var(--perf-gold-gradient)'
  );

  const gradientPreview = () => `linear-gradient(90deg, ${goldStops().map((stop) => `${stop.color} ${stop.offset}%`).join(', ')})`;

  const toggleMovingReflections = (enabled: boolean) => {
    setMovingReflections(enabled);
    if (!enabled) {
      pendingDirection = null;
      screenRef.style.setProperty('--perf-reflex-active', '0');
    }
  };

  const commitDirection = (x: number, y: number) => {
    screenRef.style.setProperty('--perf-reflex-x', x.toFixed(4));
    screenRef.style.setProperty('--perf-reflex-y', y.toFixed(4));
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

  const scheduleDirection = (x: number, y: number) => {
    const nextDirection = {
      x: clamp(x * gain(), -0.92, 0.92),
      y: clamp(y * gain(), -0.92, 0.92),
    };
    const movement = Math.hypot(
      nextDirection.x - lastInputDirection.x,
      nextDirection.y - lastInputDirection.y,
    );
    lastInputDirection = nextDirection;
    pendingDirection = nextDirection;

    if (movement > 0.006) {
      screenRef.style.setProperty('--perf-reflex-active', '1');
      window.clearTimeout(reflectionIdleTimer);
      reflectionIdleTimer = window.setTimeout(() => {
        screenRef.style.setProperty('--perf-reflex-active', '0');
      }, 140);
    }
    if (!animationFrame) animationFrame = requestAnimationFrame(flush);
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (tiltEnabled() || !movingReflections()) return;
    const bounds = phoneRef.getBoundingClientRect();
    const x = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    const y = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
    // Oversized CSS backgrounds travel visually opposite background-position.
    // Reverse pointer X so the visible white reflection follows horizontal mouse
    // movement. Pointer Y and device orientation retain their own conventions.
    scheduleDirection(-x, y);
  };

  const handlePointerLeave = () => {
    if (!tiltEnabled() && movingReflections()) scheduleDirection(0, 0);
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!tiltEnabled() || !movingReflections()) return;
    const beta = event.beta ?? 0;
    const gamma = event.gamma ?? 0;
    if (!gyroOrigin) gyroOrigin = { beta, gamma };
    scheduleDirection((gamma - gyroOrigin.gamma) / 28, (beta - gyroOrigin.beta) / 28);
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
    window.clearTimeout(reflectionIdleTimer);
    if (animationFrame) cancelAnimationFrame(animationFrame);
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

        <section class="shiny-performance-gradient-editor" data-open={showGradientEditor() ? 'true' : 'false'}>
          <div class="shiny-performance-gradient-editor__header">
            <div>
              <span class="shiny-performance-kicker">// MATERIAL SOURCE</span>
              <strong>10-stop gold</strong>
            </div>
            <div class="shiny-performance-gradient-editor__commands">
              <button onClick={() => setShowGradientEditor(!showGradientEditor())}>
                {showGradientEditor() ? 'Close stops' : 'Edit stops'}
              </button>
              <button onClick={resetGoldStops}>Reset</button>
            </div>
          </div>
          <div class="shiny-performance-gradient-strip" style={{ background: gradientPreview() }} />

          <Show when={showGradientEditor()}>
            <div class="shiny-performance-gradient-presets" aria-label="Gold gradient presets">
              <Index each={GOLD_GRADIENT_PRESETS}>
                {(preset) => (
                  <button
                    classList={{ active: selectedGradientPreset() === preset().id }}
                    onClick={() => applyGradientPreset(preset())}
                  >
                    <span style={{ background: `linear-gradient(90deg, ${preset().stops.map((stop) => `${stop.color} ${stop.offset}%`).join(', ')})` }} />
                    <strong>{preset().name}</strong>
                  </button>
                )}
              </Index>
            </div>
            <div class="shiny-performance-reflection-presets">
              <div class="shiny-performance-reflection-presets__title">
                <span class="shiny-performance-kicker">// MOVING LAYERS</span>
                <strong>Reflection profiles</strong>
              </div>
              <div class="shiny-performance-gradient-presets" aria-label="Moving reflection presets">
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
            </div>
            <div class="shiny-performance-stop-grid">
              <Index each={goldStops()}>
                {(stop, index) => (
                  <div class="shiny-performance-stop-control">
                    <div class="shiny-performance-stop-control__title">
                      <span>Stop {index + 1}</span>
                      <code>{stop().offset}%</code>
                    </div>
                    <input
                      class="shiny-performance-stop-control__swatch"
                      type="color"
                      value={stop().color}
                      aria-label={`Stop ${index + 1} color`}
                      onInput={(event) => updateGoldStopColor(index, event.currentTarget.value)}
                    />
                    <input
                      class="shiny-performance-stop-control__hex"
                      type="text"
                      value={stop().color}
                      aria-label={`Stop ${index + 1} hex color`}
                      onChange={(event) => updateGoldStopColor(index, event.currentTarget.value)}
                    />
                    <label>
                      <span>Offset</span>
                      <input
                        type="number"
                        min={index === 0 ? 0 : goldStops()[index - 1].offset}
                        max={index === goldStops().length - 1 ? 100 : goldStops()[index + 1].offset}
                        step="0.1"
                        value={stop().offset}
                        onChange={(event) => updateGoldStopOffset(index, Number(event.currentTarget.value))}
                      />
                    </label>
                  </div>
                )}
              </Index>
            </div>
          </Show>
        </section>

        <article ref={(element) => { phoneRef = element; }} class="shiny-performance-phone" aria-label="Mobile game UI reflex preview">
          <div class="shiny-performance-phone-status">
            <span>23:41</span>
            <span>CRUELNET // SECURE</span>
            <span>87%</span>
          </div>

          <div class="shiny-performance-appbar">
            <div class="perf-kan-token perf-metal--dynamic" aria-label="Kan token">
              <PerformanceKanToken />
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
      </section>
    </main>
  );
};

export default ShinyPerformanceScreen;
