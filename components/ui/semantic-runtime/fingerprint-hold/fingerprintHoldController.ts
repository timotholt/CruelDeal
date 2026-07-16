import {
  createFingerprintHoldCompleteEventV1,
  type UiActionEventHandler,
} from '../actions/UiActionEvent';
import type { FingerprintHoldActionRuntimePlanV1 } from './fingerprintHoldRuntimePlan';

export type FingerprintHoldState = 'idle' | 'holding' | 'complete';

export interface FingerprintHoldScheduler {
  setTimeout: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

const browserScheduler: FingerprintHoldScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

export interface FingerprintHoldController {
  state: () => FingerprintHoldState;
  begin: () => boolean;
  cancel: () => boolean;
  reset: () => void;
  setDisabled: (disabled: boolean) => void;
  dispose: () => void;
}

export const createFingerprintHoldController = (options: {
  plan: FingerprintHoldActionRuntimePlanV1;
  onStateChange?: (state: FingerprintHoldState) => void;
  onAction: UiActionEventHandler;
  scheduler?: FingerprintHoldScheduler;
}): FingerprintHoldController => {
  const scheduler = options.scheduler ?? browserScheduler;
  let currentState: FingerprintHoldState = 'idle';
  let disabled = options.plan.disabled;
  let disposed = false;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let acknowledgementTimer: ReturnType<typeof setTimeout> | undefined;

  const transition = (next: FingerprintHoldState) => {
    if (currentState === next) return;
    currentState = next;
    options.onStateChange?.(next);
  };
  const clearHold = () => {
    if (holdTimer !== undefined) scheduler.clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const clearAcknowledgement = () => {
    if (acknowledgementTimer !== undefined) scheduler.clearTimeout(acknowledgementTimer);
    acknowledgementTimer = undefined;
  };
  const reset = () => {
    clearHold();
    clearAcknowledgement();
    transition('idle');
  };
  const complete = () => {
    if (disposed || disabled || currentState !== 'holding') return;
    holdTimer = undefined;
    transition('complete');
    options.onAction(createFingerprintHoldCompleteEventV1(
      options.plan.componentInstanceId,
      options.plan.actionId,
    ));
    acknowledgementTimer = scheduler.setTimeout(() => {
      acknowledgementTimer = undefined;
      if (!disposed) transition('idle');
    }, options.plan.acknowledgementMs);
  };

  return {
    state: () => currentState,
    begin: () => {
      if (disposed || disabled || currentState !== 'idle') return false;
      clearAcknowledgement();
      transition('holding');
      holdTimer = scheduler.setTimeout(complete, options.plan.holdDurationMs);
      return true;
    },
    cancel: () => {
      if (disposed || currentState !== 'holding') return false;
      clearHold();
      transition('idle');
      return true;
    },
    reset,
    setDisabled: (nextDisabled) => {
      disabled = nextDisabled;
      if (disabled) reset();
    },
    dispose: () => {
      disposed = true;
      clearHold();
      clearAcknowledgement();
      currentState = 'idle';
    },
  };
};
