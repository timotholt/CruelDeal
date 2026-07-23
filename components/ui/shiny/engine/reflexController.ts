import { createSignal } from 'solid-js';
import type { ReflexDirection, ReflexPointer } from './types';

const [pointer, setPointer] = createSignal<ReflexPointer>({ x: 0, y: 0, hasPosition: false, source: 'none' });
const [direction, setDirection] = createSignal<ReflexDirection>({ gx: 0, gy: 0 });
const [sheenEnabled, setSheenEnabled] = createSignal(true);
const [gyroActive, setGyroActive] = createSignal(false);

export { pointer, direction, sheenEnabled, setSheenEnabled, gyroActive };

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

// Keep the high-frequency direction variables off :root. Writing inherited
// custom properties on <html> invalidates computed style for the entire app on
// every pointer frame, including the fixed viewport and every universal-rule
// match. This selector identifies only surfaces whose paint recipes actually
// consume the reflex variables.
const REFLEX_SURFACE_SELECTOR = [
  '.sheen-linear',
  '.sheen-radial',
  '.sheen-box',
  '.sheen-baked',
  '.main-material-rich-token--gold',
  '.main-material-rich-token--silver',
  '.main-material-rich-token--bronze',
  '.main-material-rich-token--kan',
  '.main-material-rich-token--credit',
  '.main-material-rich-token--mark',
  '.main-material-rich-token--engraved',
  '.metal-gold:not(.sheen-text)',
  '.metal-silver:not(.sheen-text)',
  '.metal-bronze:not(.sheen-text)',
  '.gold18k',
  '.metal-surface-gold',
  '.metal-surface-silver',
  '.metal-surface-bronze',
].join(',');

const reflexSurfaces = new Set<HTMLElement>();
let reflexSurfaceObserver: MutationObserver | null = null;

const addSurfaceTree = (node: Node) => {
  if (!(node instanceof HTMLElement)) return;
  if (node.matches(REFLEX_SURFACE_SELECTOR)) reflexSurfaces.add(node);
  node.querySelectorAll<HTMLElement>(REFLEX_SURFACE_SELECTOR).forEach(surface => reflexSurfaces.add(surface));
};

const removeSurfaceTree = (node: Node) => {
  if (!(node instanceof HTMLElement)) return;
  reflexSurfaces.delete(node);
  node.querySelectorAll<HTMLElement>(REFLEX_SURFACE_SELECTOR).forEach(surface => reflexSurfaces.delete(surface));
};

const startSurfaceRegistry = () => {
  if (typeof document === 'undefined' || reflexSurfaceObserver) return;
  document.querySelectorAll<HTMLElement>(REFLEX_SURFACE_SELECTOR).forEach(surface => reflexSurfaces.add(surface));
  reflexSurfaceObserver = new MutationObserver((records) => {
    records.forEach((record) => {
      if (record.type === 'attributes') {
        const element = record.target;
        if (!(element instanceof HTMLElement)) return;
        if (element.matches(REFLEX_SURFACE_SELECTOR)) reflexSurfaces.add(element);
        else reflexSurfaces.delete(element);
        return;
      }
      record.removedNodes.forEach(removeSurfaceTree);
      record.addedNodes.forEach(addSurfaceTree);
    });
  });
  reflexSurfaceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  });
};

const writeSurfaceVars = (gx: number, gy: number) => {
  const x = gx.toFixed(4);
  const y = gy.toFixed(4);
  reflexSurfaces.forEach((surface) => {
    surface.style.setProperty('--reflex-gx', x);
    surface.style.setProperty('--reflex-gy', y);
    surface.style.setProperty('--reflex-x', x);
    surface.style.setProperty('--reflex-y', y);
  });
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
  writeSurfaceVars(gx, gy);
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
  // A pre-scope controller may have left these high-frequency variables inline
  // on <html> during a development hot update. They must never remain an
  // inherited invalidation source.
  document.documentElement.style.removeProperty('--reflex-gx');
  document.documentElement.style.removeProperty('--reflex-gy');
  document.documentElement.style.removeProperty('--reflex-x');
  document.documentElement.style.removeProperty('--reflex-y');
  startSurfaceRegistry();
  started = true;
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  const orientation = orientationEventConstructor();
  if (orientation && typeof orientation.requestPermission !== 'function') listenForOrientation();
};

export const disposeReflex = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', handlePointerMove);
    if (orientationListening) {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    }
    if (frame && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame);
  }
  reflexSurfaceObserver?.disconnect();
  reflexSurfaceObserver = null;
  reflexSurfaces.forEach((surface) => {
    surface.style.removeProperty('--reflex-gx');
    surface.style.removeProperty('--reflex-gy');
    surface.style.removeProperty('--reflex-x');
    surface.style.removeProperty('--reflex-y');
  });
  reflexSurfaces.clear();
  pendingMouse = null;
  pendingTilt = null;
  frame = 0;
  lastGx = Number.NaN;
  lastGy = Number.NaN;
  lastCommitTs = Number.NEGATIVE_INFINITY;
  started = false;
  orientationListening = false;
  setGyroActive(false);
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

if (import.meta.hot) {
  import.meta.hot.dispose(disposeReflex);
}
