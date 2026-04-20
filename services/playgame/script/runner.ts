/**
 * Script Engine — core runner. Ported verbatim from
 * ccg/vfx-engine/project/game/script/runner.js.
 *
 * A "step" is `(ctx) => Promise<void>` or an array of steps (treated as
 * serial). Steps resolve when their visible effect has finished. Everything
 * composes out of that contract.
 *
 * Combinators:
 *   serial(...steps)   — run one after another
 *   parallel(...steps) — run all at once, resolve when the slowest finishes
 *   wait(ms)           — pure delay step
 *   label(name, step)  — tags a step so ctx.onStep can log/trace it
 */

export interface ScriptCtx {
  cancelled?: boolean;
  onStep?: (name: string) => void;
  // Flow-specific fields are attached per-caller; typed as `any` here on
  // purpose so actions can pluck out what they need without a heavy
  // shared type surface.
  [key: string]: unknown;
}

export type Step = ((ctx: ScriptCtx) => Promise<void> | void) | Step[];

export const wait = (ms: number): Step => () => new Promise<void>((r) => setTimeout(r, ms));

export const serial = (...steps: Step[]): Step => async (ctx: ScriptCtx) => {
  for (const s of steps) {
    if (ctx && ctx.cancelled) return;
    await run(s, ctx);
  }
};

export const parallel = (...steps: Step[]): Step => (ctx: ScriptCtx) =>
  Promise.all(steps.map((s) => run(s, ctx))) as unknown as Promise<void>;

export const label = (name: string, step: Step): Step => async (ctx: ScriptCtx) => {
  ctx.onStep?.(name);
  await run(step, ctx);
};

export async function run(step: Step | null | undefined, ctx: ScriptCtx = {}): Promise<void> {
  if (step == null) return;
  if (Array.isArray(step)) {
    // An array of steps is interpreted as a serial sequence.
    const fn = serial(...step) as (c: ScriptCtx) => Promise<void> | void;
    await fn(ctx);
    return;
  }
  if (typeof step === 'function') {
    await step(ctx);
    return;
  }
  throw new Error('script.run: step must be a function or array of steps');
}

export interface Script {
  ctx: ScriptCtx;
  run: (step: Step) => Promise<void>;
  cancel: () => void;
}

export function createScript(ctx: ScriptCtx = {}): Script {
  return {
    ctx,
    run: (step) => run(step, ctx),
    cancel() {
      ctx.cancelled = true;
    },
  };
}
