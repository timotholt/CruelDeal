import type { SurfaceEffectLease } from '../contracts';

const EFFECT_TIMEOUT_MS = 1_500;

interface SurfaceEffectCue {
  readonly kind: string;
  readonly channel: string;
}

export const mountBoundedSurfaceEffect = (
  host: HTMLElement,
  cue: SurfaceEffectCue,
  onTerminal: () => void = () => undefined,
): SurfaceEffectLease => {
  const effect = document.createElement('div');
  effect.className = `surface-vfx surface-vfx--${cue.channel} surface-vfx--${cue.kind}`;
  effect.dataset.surfaceVfx = cue.kind;
  host.appendChild(effect);

  let active = true;
  const timeout = window.setTimeout(() => finish(), EFFECT_TIMEOUT_MS);
  const finish = (): void => {
    if (!active) return;
    active = false;
    window.clearTimeout(timeout);
    effect.remove();
    onTerminal();
  };
  effect.addEventListener('animationend', finish, { once: true });
  return { cancel: finish };
};
