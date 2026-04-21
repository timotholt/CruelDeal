/**
 * Timeline — converts semantic game events into a deterministic CSS animation
 * schedule. Multiple animations on the same element are composited into a
 * single `animation` shorthand with staggered delays.
 *
 * Ported from ccg/vfx-engine/project/vfx/timeline.js.
 */

export type VfxVars = Record<string, string | number>;

type AnimEvent = {
  kind: 'anim';
  el: HTMLElement;
  effect: string;
  vars: VfxVars;
  delay: number;
  duration: number;
};

type CallEvent = {
  kind: 'call';
  fn: () => void;
  delay: number;
};

type TimelineEvent = AnimEvent | CallEvent;

export class Timeline {
  events: TimelineEvent[] = [];
  cursor = 0; // current time in ms

  /**
   * Add a single CSS-animation event. Advances the cursor by `gap` ms.
   */
  add(el: HTMLElement | null | undefined, effect: string, vars: VfxVars = {}, duration = 400, gap = 100): void {
    if (!el) return;
    this.events.push({ kind: 'anim', el, effect, vars, delay: this.cursor, duration });
    this.cursor += gap;
  }

  /** Pause the cursor (pure wait between events). */
  wait(ms: number): void {
    this.cursor += ms;
  }

  /**
   * Stack multiple animation primitives on one element at the current cursor.
   * Advances cursor by `gap` ms (duration of each primitive = gap).
   */
  compound(el: HTMLElement | null | undefined, effects: string[], vars: VfxVars = {}, gap = 400): void {
    if (!el) return;
    for (const fx of effects) {
      this.events.push({ kind: 'anim', el, effect: fx, vars, delay: this.cursor, duration: gap });
    }
    this.cursor += gap;
  }

  /** Spawn lightweight CSS particles at the current cursor. */
  spawnParticles(parent: HTMLElement, count = 10, _varsTemplate: VfxVars = {}): void {
    const delay = this.cursor;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'vfx-particle';
      p.style.setProperty('--vfx-delay', `${delay + Math.random() * 200}ms`);
      p.style.setProperty('--vfx-dx', `${(Math.random() - 0.5) * 100}px`);
      p.style.setProperty('--vfx-dy', `${(Math.random() - 0.5) * 100}px`);
      p.style.setProperty('--vfx-duration', `${0.3 + Math.random() * 0.4}s`);
      parent.appendChild(p);
      setTimeout(() => p.remove(), 2000);
    }
  }

  /** Schedule a JS callback at the current cursor (plus optional offset). */
  call(fn: () => void, delay = 0): void {
    this.events.push({ kind: 'call', fn, delay: this.cursor + delay });
  }

  /**
   * Execute the schedule. Composites all events per-element into a single
   * `animation` shorthand so browsers can run them in parallel.
   */
  play(): void {
    const elementGroups = new Map<HTMLElement, AnimEvent[]>();
    for (const ev of this.events) {
      if (ev.kind === 'call') {
        setTimeout(ev.fn, ev.delay);
        continue;
      }
      const list = elementGroups.get(ev.el);
      if (list) list.push(ev);
      else elementGroups.set(ev.el, [ev]);
    }

    for (const [el, events] of elementGroups.entries()) {
      const animations: string[] = [];
      for (const ev of events) {
        for (const [key, val] of Object.entries(ev.vars)) {
          el.style.setProperty(`--vfx-${key}`, String(val));
        }
        // vfx-pop -> vfx-pop-anim
        const animName = ev.effect.includes('vfx-') ? `${ev.effect}-anim` : ev.effect;
        animations.push(`${animName} ${ev.duration}ms ${ev.delay}ms both`);
      }
      el.style.animation = animations.join(', ');

      // Clear the composite after the last segment finishes so fill-mode:both
      // doesn't leave the element in a final-keyframe state (e.g. opacity:0).
      const endTime = events.reduce((m, ev) => Math.max(m, ev.delay + ev.duration), 0);
      setTimeout(() => {
        if (!el.isConnected) return;
        el.style.removeProperty('animation');
        // Do NOT remove opacity — Solid manages it reactively via inline style.
        // Removing it would reset playable dimming to CSS default (1.0).
        el.style.removeProperty('transform');
        el.style.removeProperty('filter');
      }, endTime + 50);
    }
  }

  /** Reset all elements and forget scheduled events. */
  clear(): void {
    for (const ev of this.events) {
      if (ev.kind === 'anim') ev.el.style.removeProperty('animation');
    }
    this.events = [];
    this.cursor = 0;
  }
}
