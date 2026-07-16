import { createSignal, onCleanup, onMount } from 'solid-js';
import '../../../src/styles/shiny-performance.css';

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));

const PerformanceKanToken = () => (
  <svg class="perf-kan-token__svg" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="perf-kan-gold" x1="2.0" y1="5.8" x2="102.0" y2="105.8" gradientUnits="userSpaceOnUse" spreadMethod="reflect">
        <stop offset="0%" stop-color="#7C6535" />
        <stop offset="8%" stop-color="#997E47" />
        <stop offset="26%" stop-color="#B8A269" />
        <stop offset="30%" stop-color="#7C6535" />
        <stop offset="34%" stop-color="#FFFDDA" />
        <stop offset="60%" stop-color="#D5BB8A" />
        <stop offset="81%" stop-color="#B8A269" />
        <stop offset="85%" stop-color="#7C6535" />
        <stop offset="93%" stop-color="#FBECA9" />
        <stop offset="100%" stop-color="#7C6535" />
      </linearGradient>
      <clipPath id="perf-kan-k-clip"><rect x="10" y="32.40" width="80" height="35.20" /></clipPath>
    </defs>

    <polygon points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" stroke="#201A0A" stroke-width="4.40" fill="#201A0A" fill-opacity="0.12" stroke-linejoin="miter" transform="translate(0.60, 0.60)" />
    <polygon points="31.25, 17.53 68.75, 17.53 87.49, 50 68.75, 82.47 31.25, 82.47 12.51, 50" stroke="#201A0A" stroke-width="4.40" fill="none" stroke-linejoin="miter" transform="translate(0.60, 0.60)" />
    <polygon points="35.01, 24.03 64.99, 24.03 79.99, 50 64.99, 75.97 35.01, 75.97 20.01, 50" stroke="#201A0A" stroke-width="4.40" fill="none" stroke-linejoin="miter" transform="translate(0.60, 0.60)" />

    <polygon points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" stroke="#FFFDDA" stroke-width="3.80" fill="none" stroke-linejoin="miter" transform="translate(-0.6, -0.6)" opacity="0.60" />
    <polygon points="31.25, 17.53 68.75, 17.53 87.49, 50 68.75, 82.47 31.25, 82.47 12.51, 50" stroke="#FFFDDA" stroke-width="3.80" fill="none" stroke-linejoin="miter" transform="translate(-0.6, -0.6)" opacity="0.60" />
    <polygon points="35.01, 24.03 64.99, 24.03 79.99, 50 64.99, 75.97 35.01, 75.97 20.01, 50" stroke="#FFFDDA" stroke-width="3.80" fill="none" stroke-linejoin="miter" transform="translate(-0.6, -0.6)" opacity="0.60" />

    <polygon points="27.50, 11.03 72.50, 11.03 95.00, 50 72.50, 88.97 27.50, 88.97 5.00, 50" stroke="url(#perf-kan-gold)" stroke-width="3.50" fill="url(#perf-kan-gold)" fill-opacity="0.12" stroke-linejoin="miter" />
    <polygon points="31.25, 17.53 68.75, 17.53 87.49, 50 68.75, 82.47 31.25, 82.47 12.51, 50" stroke="url(#perf-kan-gold)" stroke-width="3.50" fill="none" stroke-linejoin="miter" />
    <polygon points="35.01, 24.03 64.99, 24.03 79.99, 50 64.99, 75.97 35.01, 75.97 20.01, 50" stroke="url(#perf-kan-gold)" stroke-width="3.50" fill="none" stroke-linejoin="miter" />

    <path d="M 39.90,32.40 L 39.91,67.60" fill="none" stroke="#201A0A" stroke-width="7.40" stroke-linecap="butt" transform="translate(0.60, 0.60)" />
    <g clip-path="url(#perf-kan-k-clip)">
      <path d="M 39.90,56.12 L 72.13,18.65" fill="none" stroke="#201A0A" stroke-width="7.40" stroke-linecap="butt" stroke-linejoin="miter" transform="translate(0.60, 0.60)" />
      <path d="M 48.70,48.27 L 68.55,81.35" fill="none" stroke="#201A0A" stroke-width="7.40" stroke-linecap="butt" stroke-linejoin="miter" transform="translate(0.60, 0.60)" />
    </g>

    <path d="M 39.90,32.40 L 39.91,67.60" fill="none" stroke="#FFFDDA" stroke-width="6.80" stroke-linecap="butt" transform="translate(-0.6, -0.6)" opacity="0.60" />
    <g clip-path="url(#perf-kan-k-clip)">
      <path d="M 39.90,56.12 L 72.13,18.65" fill="none" stroke="#FFFDDA" stroke-width="6.80" stroke-linecap="butt" stroke-linejoin="miter" transform="translate(-0.6, -0.6)" opacity="0.60" />
      <path d="M 48.70,48.27 L 68.55,81.35" fill="none" stroke="#FFFDDA" stroke-width="6.80" stroke-linecap="butt" stroke-linejoin="miter" transform="translate(-0.6, -0.6)" opacity="0.60" />
    </g>

    <path d="M 39.90,32.40 L 39.91,67.60" fill="none" stroke="url(#perf-kan-gold)" stroke-width="6.5" stroke-linecap="butt" />
    <g clip-path="url(#perf-kan-k-clip)">
      <path d="M 39.90,56.12 L 72.13,18.65" fill="none" stroke="url(#perf-kan-gold)" stroke-width="6.5" stroke-linecap="butt" stroke-linejoin="miter" />
      <path d="M 48.70,48.27 L 68.55,81.35" fill="none" stroke="url(#perf-kan-gold)" stroke-width="6.5" stroke-linecap="butt" stroke-linejoin="miter" />
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
    if (tiltEnabled()) return;
    const bounds = phoneRef.getBoundingClientRect();
    const x = (event.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
    const y = (event.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
    // Oversized CSS backgrounds travel visually opposite background-position.
    // Reverse pointer X so the visible white reflection follows horizontal mouse
    // movement. Pointer Y and device orientation retain their own conventions.
    scheduleDirection(-x, y);
  };

  const handlePointerLeave = () => {
    if (!tiltEnabled()) scheduleDirection(0, 0);
  };

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!tiltEnabled()) return;
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
