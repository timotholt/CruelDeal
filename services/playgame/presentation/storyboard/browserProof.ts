import { NORMAL_ANIMATION_PROFILE } from './animationProfile';
import { compileStoryboard } from './compiler';
import { milliseconds, type BeatStoryboard, type PresentationExpansionBudget } from './contracts';
import { StoryboardRunner } from './runner';
import { NativeWaapiDriver } from './waapiDriver';

interface BrowserProofResult {
  readonly passed: boolean;
  readonly outcome: string;
  readonly commonStartOrigin: boolean;
  readonly startOrigins: readonly number[];
  readonly cueOrder: readonly string[];
  readonly midpoint: Readonly<Record<string, string>>;
  readonly final: Readonly<Record<string, string>>;
}

declare global {
  interface Window {
    __storyboardProof?: BrowserProofResult;
  }
}

const first = requiredElement('proof-first');
const second = requiredElement('proof-second');
const output = requiredElement('proof-output');
const targets = new Map<string, Element>([
  ['PLAYFIELD', first],
  ['TURN_BANNER', second],
]);
const driver = new NativeWaapiDriver(document, targetKey => {
  const target = targets.get(targetKey);
  if (!target) throw new Error(`Missing proof target ${targetKey}`);
  return target;
});
const cueOrder: string[] = [];
const runner = new StoryboardRunner(driver, {
  dispatch: cue => { cueOrder.push(cue.id); },
});
const timeline = compileStoryboard(proofStoryboard(), proofBudget());

void runProof();

async function runProof(): Promise<void> {
  document.body.dataset.status = 'running';
  const runPromise = runner.run(timeline, NORMAL_ANIMATION_PROFILE, {
    handoff: () => {
      first.style.opacity = '1';
      second.style.transform = 'translateX(120px)';
    },
  });
  await waitForMasterTime(130);
  const midpoint = {
    opacity: getComputedStyle(first).opacity,
    transform: getComputedStyle(second).transform,
  };
  const result = await runPromise;
  const origins = driver.lastStartOrigins;
  const commonStartOrigin = origins.length === 3
    && new Set(origins).size === 1
    && origins.every(Number.isFinite);
  const final = {
    opacity: getComputedStyle(first).opacity,
    transform: getComputedStyle(second).transform,
  };
  const passed = result.outcome === 'COMPLETED'
    && commonStartOrigin
    && cueOrder.join(',') === 'start,middle,end'
    && Number(midpoint.opacity) > 0
    && Number(midpoint.opacity) < 1
    && final.opacity === '1';
  const proof: BrowserProofResult = {
    passed,
    outcome: result.outcome,
    commonStartOrigin,
    startOrigins: origins,
    cueOrder,
    midpoint,
    final,
  };
  window.__storyboardProof = proof;
  document.body.dataset.status = passed ? 'passed' : 'failed';
  output.textContent = JSON.stringify(proof, null, 2);
}

function proofStoryboard(): BeatStoryboard {
  return {
    id: 'native-waapi-foundation-proof',
    source: { kind: 'FOUNDATION_PROOF', proofId: 'native-waapi' },
    steps: [{
      id: 'multi-track',
      durationMs: milliseconds(300),
      nextStepAfterMs: milliseconds(300),
      tracks: [
        {
          kind: 'ELEMENT',
          id: 'proof-opacity',
          target: { kind: 'PLAYFIELD' },
          channel: 'opacity',
          keyframes: [
            { atMs: milliseconds(0), styles: { opacity: 0 } },
            { atMs: milliseconds(300), styles: { opacity: 1 }, easing: 'linear' },
          ],
        },
        {
          kind: 'ELEMENT',
          id: 'proof-transform',
          target: { kind: 'TURN_BANNER' },
          channel: 'banner-pose',
          keyframes: [
            { atMs: milliseconds(0), styles: { transform: 'translateX(0px)' } },
            { atMs: milliseconds(300), styles: { transform: 'translateX(120px)' }, easing: 'linear' },
          ],
        },
      ],
      cues: [
        { id: 'start', kind: 'DIAGNOSTIC', atMs: milliseconds(0), label: 'start' },
        { id: 'middle', kind: 'DIAGNOSTIC', atMs: milliseconds(150), label: 'middle' },
        { id: 'end', kind: 'DIAGNOSTIC', atMs: milliseconds(300), label: 'end' },
      ],
    }],
  };
}

function proofBudget(): PresentationExpansionBudget {
  return {
    maximumPrimitiveSteps: 1,
    maximumVisualTracks: 2,
    maximumTimedCues: 3,
    maximumAuthoredRoutineDepth: 16,
    maximumCardActors: 0,
    maximumEffectActors: 0,
  };
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing #${id}`);
  return element;
}

async function waitForMasterTime(targetMs: number): Promise<void> {
  while (runner.currentTimeMs < targetMs) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}
