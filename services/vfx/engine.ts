/**
 * VFXEngine — overlay canvas + particle pool + time loop + effect registry +
 * camera shake + sfx hook.
 *
 * Ported from ccg/vfx-engine/project/vfx/engine.js.
 *
 * Dependencies are injected via the constructor (sfx callback, theme overrides)
 * so the engine is framework-agnostic: it works in vanilla JS, Solid, React, etc.
 */

import { defaultTheme, qualityScale, VfxTheme } from './theme';

/** Sound callback shape: `engine.play()` forwards effect names to it. */
export type SfxHook = (name: string, ctx?: { source?: ResolvedPoint | null; variant?: string }) => void;

export interface ResolvedPoint {
  x: number;
  y: number;
  w?: number;
  h?: number;
  el?: Element;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax?: number;
  ay?: number;
  drag?: number;
  life: number;
  ttl: number;
  size?: number;
  grow?: number;
  color?: string;
  alpha?: (u: number) => number;
  update?: (dt: number, p: Particle) => void;
  draw?: (ctx: CanvasRenderingContext2D, p: Particle, u: number) => void;
  [k: string]: unknown;
}

export interface VfxContext {
  engine: VFXEngine;
  source: ResolvedPoint | null;
  targets: ResolvedPoint[];
  theme: VfxTheme;
  scale: number;
  variant?: string;
  opts: VfxPlayOpts;
  emit: (p: Particle) => void;
  shake: (kind?: string) => void;
  sfx: (name: string) => void;
  addEffect: (e: LongLivedEffect) => void;
}

export interface LongLivedEffect {
  tick: (dt: number, ctx: CanvasRenderingContext2D, now: number) => boolean;
  persistent?: boolean;
  [k: string]: unknown;
}

export interface RegisteredEffect {
  id: string;
  play: (ctx: VfxContext) => void;
}

export interface VfxPlayOpts {
  persistent?: boolean;
  duration?: number;
  [k: string]: unknown;
}

export interface VfxPlayArgs {
  source?: Element | { x: number; y: number } | null;
  targets?: Array<Element | { x: number; y: number } | null> | Element | { x: number; y: number } | null;
  variant?: string;
  opts?: VfxPlayOpts;
}

export interface VFXEngineOpts {
  sfx?: SfxHook;
  theme?: Partial<VfxTheme>;
}

interface ShakeState {
  amp: number;
  dur: number;
  start: number;
}

export class VFXEngine {
  root: HTMLElement;
  theme: VfxTheme;
  scale: number;
  sfx: SfxHook;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: Particle[] = [];
  effects: LongLivedEffect[] = [];
  registry = new Map<string, RegisteredEffect>();
  running = false;
  W = 0;
  H = 0;

  private _last = performance.now();
  private _shake: ShakeState | null = null;
  private _ro: ResizeObserver;
  private readonly _resize: () => void;
  private readonly _tick: (t: number) => void;

  constructor(rootEl: HTMLElement, opts: VFXEngineOpts = {}) {
    this.root = rootEl;
    this.theme = { ...defaultTheme, ...(opts.theme ?? {}) } as VfxTheme;
    this.scale = qualityScale(this.theme);
    this.sfx = opts.sfx ?? (() => {});

    const canvas = document.createElement('canvas');
    canvas.className = 'vfx-canvas';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '100',
    } as Partial<CSSStyleDeclaration>);
    rootEl.appendChild(canvas);
    this.canvas = canvas;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) throw new Error('VFXEngine: failed to acquire 2D context');
    this.ctx = ctx2d;

    this._resize = () => this._doResize();
    this._tick = (t: number) => this._doTick(t);
    this._doResize();

    window.addEventListener('resize', this._resize);
    const ro = new ResizeObserver(this._resize);
    ro.observe(rootEl);
    this._ro = ro;

    this._start();
  }

  /** Teardown — remove canvas, listeners, and stop the animation loop. */
  destroy(): void {
    this.running = false;
    window.removeEventListener('resize', this._resize);
    this._ro.disconnect();
    this.canvas.remove();
    this.particles.length = 0;
    this.effects.length = 0;
  }

  private _doResize(): void {
    const r = this.root.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.W = r.width;
    this.H = r.height;
  }

  register(effect: RegisteredEffect): void {
    this.registry.set(effect.id, effect);
  }

  /** Resolve an element or {x,y} into a centered point in canvas space. */
  resolvePoint(ref: Element | { x: number; y: number } | null | undefined): ResolvedPoint | null {
    if (!ref) return null;
    if (typeof ref === 'object' && 'x' in ref && 'y' in ref) return { x: ref.x, y: ref.y };
    const el = ref instanceof Element ? ref : null;
    if (!el) return null;
    const rr = this.root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - rr.left + r.width / 2,
      y: r.top - rr.top + r.height / 2,
      w: r.width,
      h: r.height,
      el,
    };
  }

  play(effectId: string, args: VfxPlayArgs = {}): void {
    const { source, targets = [], variant, opts = {} } = args;
    const eff = this.registry.get(effectId);
    if (!eff) {
      console.warn('VFX not registered:', effectId);
      return;
    }
    const src = this.resolvePoint(source ?? null);
    const targetList = Array.isArray(targets) ? targets : [targets];
    const tgts = targetList.map((t) => this.resolvePoint(t)).filter((p): p is ResolvedPoint => !!p);
    const ctx: VfxContext = {
      engine: this,
      source: src,
      targets: tgts,
      theme: this.theme,
      scale: this.scale,
      variant,
      opts,
      emit: (p: Particle) => this.particles.push(this._normalizeParticle(p)),
      shake: (kind = 'shakeSmall') => this.shake(kind),
      sfx: (name: string) => this.sfx(name, { source: src, variant }),
      addEffect: (e: LongLivedEffect) => this.effects.push(this._normalizeEffect(e, opts)),
    };
    eff.play(ctx);
  }

  private _normalizeParticle(p: Particle): Particle {
    const ttl = Number.isFinite(p.ttl) ? p.ttl : 1;
    return {
      ...p,
      life: Number.isFinite(p.life) ? p.life : 0,
      ttl: Math.min(Math.max(ttl, 0.05), 4),
    };
  }

  private _normalizeEffect(e: LongLivedEffect, opts: VfxPlayOpts = {}): LongLivedEffect {
    const startedAt = performance.now();
    const maxDuration = opts.persistent ? Infinity : (opts.duration ?? 3);
    return {
      ...e,
      tick: (dt, ctx, now) => {
        if (Number.isFinite(maxDuration) && now - startedAt > maxDuration * 1000) return false;
        return e.tick(dt, ctx, now);
      },
    };
  }

  shake(kind: string): void {
    const cfg = this.theme.camera[kind] ?? this.theme.camera.shakeSmall;
    this._shake = { ...cfg, start: performance.now() };
  }

  clearTransient(): void {
    this.particles.length = 0;
    this.effects = this.effects.filter((e) => e.persistent);
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  private _start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this._tick);
  }

  private _doTick(t: number): void {
    if (!this.running) return;
    const dt = Math.min(48, t - this._last) / 1000;
    this._last = t;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Camera shake translates the root element
    if (this._shake) {
      const el = (t - this._shake.start) / this._shake.dur;
      if (el >= 1) {
        this.root.style.transform = '';
        this._shake = null;
      } else {
        const damp = 1 - el;
        const x = (Math.random() - 0.5) * 2 * this._shake.amp * damp;
        const y = (Math.random() - 0.5) * 2 * this._shake.amp * damp;
        this.root.style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    // Tick long-lived effects (e.g. auras)
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      try {
        const alive = e.tick(dt, ctx, t);
        if (!alive) this.effects.splice(i, 1);
      } catch (err) {
        console.error('Effect tick error:', err);
        this.effects.splice(i, 1);
      }
    }

    // Tick particles
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const step = Number.isNaN(dt) ? 0.016 : dt;
      p.life += step;

      if (Number.isNaN(p.life) || p.life >= (p.ttl || 1)) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.update) {
        try { p.update(step, p); } catch { this.particles.splice(i, 1); continue; }
      } else {
        p.vx += (p.ax || 0) * step;
        p.vy += (p.ay || 0) * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        if (p.drag) {
          p.vx *= 1 - p.drag * step;
          p.vy *= 1 - p.drag * step;
        }
      }

      const u = Math.max(0, Math.min(1, p.life / (p.ttl || 1)));
      const alpha = p.alpha ? p.alpha(u) : 1 - u;
      ctx.globalAlpha = Number.isNaN(alpha) ? 0 : Math.max(0, alpha);

      if (p.draw) {
        try { p.draw(ctx, p, u); } catch { this.particles.splice(i, 1); continue; }
      } else {
        const r = (p.size || 4) * (p.grow ? 1 + u * p.grow : 1);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, p.color || '#fff');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    requestAnimationFrame(this._tick);
  }

  /** Flash a DOM element with a colored halo. */
  flashElement(el: Element | null | undefined, color = '#fff', dur = 400): void {
    if (!el) return;
    const halo = document.createElement('div');
    halo.className = 'vfx-halo';
    const r = el.getBoundingClientRect();
    const rr = this.root.getBoundingClientRect();
    Object.assign(halo.style, {
      position: 'absolute',
      left: r.left - rr.left - 6 + 'px',
      top: r.top - rr.top - 6 + 'px',
      width: r.width + 12 + 'px',
      height: r.height + 12 + 'px',
      borderRadius: '14px',
      boxShadow: `0 0 0 2px ${color}, 0 0 40px 8px ${color}`,
      pointerEvents: 'none',
      zIndex: '99',
      animation: `vfxHalo ${dur}ms ease-out forwards`,
    } as Partial<CSSStyleDeclaration>);
    this.root.appendChild(halo);
    setTimeout(() => halo.remove(), dur + 50);
  }
}

// Helpers
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
export function pick<T>(arr: readonly T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}
