import { createSignal } from 'solid-js';
import type { ReflexDirection, ReflexPointer } from './types';

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

let pendingMouse: { x: number; y: number } | null = null;
let pendingTilt: { gx: number; gy: number } | null = null;
let frame = 0;
let lastGx = 0;
let lastGy = 0;

const commit = (gx: number, gy: number, src: ReflexPointer['source'], x: number, y: number) => {
  if (gx === lastGx && gy === lastGy) return;
  lastGx = gx;
  lastGy = gy;
  setPointer({ x, y, hasPosition: src === 'mouse', source: src });
  setDirection({ gx, gy });
  writeRootVars(gx, gy);
};

export type ReflexFpsCap = 15 | 30 | 60;

let reflexFpsCap: ReflexFpsCap = 30;
let lastCommitTs = Number.NEGATIVE_INFINITY;

export const getReflexFpsCap = () => reflexFpsCap;

export const setReflexFpsCap = (fps: ReflexFpsCap) => {
  reflexFpsCap = fps;
};

const flush = (ts?: number) => {
  frame = 0;
  if (!sheenEnabled()) {
    pendingMouse = null;
    pendingTilt = null;
    return;
  }
  const now = ts ?? (typeof performance !== 'undefined' ? performance.now() : 0);
  const minFrameMs = 1000 / reflexFpsCap - 1;
  if (now - lastCommitTs < minFrameMs && (pendingMouse || pendingTilt)) {
    schedule();
    return;
  }
  lastCommitTs = now;
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
  const gamma = e.gamma || 0;
  const beta = e.beta || 0;
  pendingTilt = { gx: clamp1(gamma / 30), gy: clamp1((beta - 45) / 30) };
  schedule();
};

let started = false;
let orientationListening = false;

type DeviceOrientationEventConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const orientationEventConstructor = (): DeviceOrientationEventConstructor | undefined => (
  typeof DeviceOrientationEvent === 'undefined'
    ? undefined
    : DeviceOrientationEvent as DeviceOrientationEventConstructor
);

const listenForOrientation = () => {
  if (orientationListening) return;
  window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
  orientationListening = true;
  setGyroActive(true);
};

export const initReflex = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  const orientation = orientationEventConstructor();
  if (orientation && typeof orientation.requestPermission !== 'function') listenForOrientation();
};

export const enableGyro = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  const orientation = orientationEventConstructor();
  if (!orientation) return false;
  if (typeof orientation.requestPermission === 'function') {
    try {
      const state = await orientation.requestPermission();
      if (state === 'granted') {
        listenForOrientation();
        return true;
      }
    } catch (e) {
      console.error('Reflex: orientation permission failed', e);
    }
    return false;
  }
  listenForOrientation();
  return true;
};
