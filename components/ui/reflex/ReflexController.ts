import { createSignal } from 'solid-js';

/**
 * ReflexController — the single source of pointer/tilt input for the whole app.
 *
 * One `pointermove` + one `deviceorientation` listener, attached once and
 * rAF-throttled. Everything reflective (icons, text, buttons, rich-text) reads
 * from here. The abstraction is a normalized DIRECTION vector so mouse and
 * accelerometer reconcile to one model:
 *   - mouse → direction of the cursor relative to window center
 *   - gyro  → device tilt
 * Surfaces read the global direction via useReflex.createReflexShift so every
 * reflective element reacts to any mouse movement anywhere on screen (and to
 * device tilt), continuously — like a single moving light.
 */

export interface ReflexPointer {
  x: number;
  y: number;
  hasPosition: boolean; // false for gyro (direction only)
  source: 'mouse' | 'gyro' | 'none';
}

export interface ReflexDirection {
  gx: number; // -1..1, window-relative
  gy: number; // -1..1
}

const [pointer, setPointer] = createSignal<ReflexPointer>({ x: 0, y: 0, hasPosition: false, source: 'none' });
const [direction, setDirection] = createSignal<ReflexDirection>({ gx: 0, gy: 0 });
const [sheenEnabled, setSheenEnabled] = createSignal(true);
const [gyroActive, setGyroActive] = createSignal(false);

export { pointer, direction, sheenEnabled, setSheenEnabled, gyroActive };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

const writeRootVars = (gx: number, gy: number) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--reflex-gx', gx.toFixed(4));
  document.documentElement.style.setProperty('--reflex-gy', gy.toFixed(4));
};

// rAF-throttled commit of the latest raw event.
let pendingMouse: { x: number; y: number } | null = null;
let pendingTilt: { gx: number; gy: number } | null = null;
let frame = 0;
let lastGx = 0;
let lastGy = 0;

// Commit only when the direction actually changed — avoids waking 30+ icon
// memos and rewriting :root every frame on a duplicate value.
const commit = (gx: number, gy: number, src: ReflexPointer['source'], x: number, y: number) => {
  if (gx === lastGx && gy === lastGy) return;
  lastGx = gx;
  lastGy = gy;
  setPointer({ x, y, hasPosition: src === 'mouse', source: src });
  setDirection({ gx, gy });
  writeRootVars(gx, gy);
};

const flush = () => {
  frame = 0;
  if (!sheenEnabled()) {
    pendingMouse = null;
    pendingTilt = null;
    return;
  }
  if (pendingMouse) {
    const { x, y } = pendingMouse;
    pendingMouse = null;
    const gx = clamp1((x - window.innerWidth / 2) / (window.innerWidth / 2));
    const gy = clamp1((y - window.innerHeight / 2) / (window.innerHeight / 2));
    commit(gx, gy, 'mouse', x, y);
  } else if (pendingTilt) {
    const { gx, gy } = pendingTilt;
    pendingTilt = null;
    commit(gx, gy, 'gyro', 0, 0);
  }
};

const schedule = () => {
  if (frame) return;
  if (typeof requestAnimationFrame === 'undefined') {
    flush();
    return;
  }
  frame = requestAnimationFrame(flush);
};

const handlePointerMove = (e: PointerEvent | MouseEvent) => {
  if (!sheenEnabled()) return;
  pendingMouse = { x: e.clientX, y: e.clientY };
  schedule();
};

const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
  if (!sheenEnabled()) return;
  const gamma = e.gamma || 0; // left/right tilt
  const beta = e.beta || 0; // front/back tilt
  pendingTilt = { gx: clamp1(gamma / 30), gy: clamp1((beta - 45) / 30) };
  schedule();
};

let started = false;

/** Attach the single global listener set. Idempotent — safe to call from many places. */
export const initReflex = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  // Desktop / Android: orientation needs no permission. iOS is gated behind enableGyro().
  // @ts-ignore — requestPermission is not in the standard DOM typings
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    setGyroActive(true);
  }
};

/** iOS 13+ gyroscope permission flow. Returns true when tilt input is live. */
export const enableGyro = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      // @ts-ignore
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') {
        window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
        setGyroActive(true);
        return true;
      }
    } catch (e) {
      console.error('Reflex: orientation permission failed', e);
    }
    return false;
  }
  // No permission gate — just attach.
  window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
  setGyroActive(true);
  return true;
};
