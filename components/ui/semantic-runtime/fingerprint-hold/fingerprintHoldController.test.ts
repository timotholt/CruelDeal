import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFingerprintHoldController } from './fingerprintHoldController';
import type { FingerprintHoldActionRuntimePlanV1 } from './fingerprintHoldRuntimePlan';
import type { UiActionEvent } from '../actions/UiActionEvent';

const plan: FingerprintHoldActionRuntimePlanV1 = {
  type: 'FingerprintHoldActionRuntimePlanV1',
  componentInstanceId: 'mission.data-extraction.accept',
  actionId: 'mission.accept-terms',
  actionType: 'fingerprint-hold/v1',
  holdDurationMs: 1400,
  acknowledgementMs: 520,
  disabled: false,
  accessibleLabel: 'Accept Terms',
};

afterEach(() => vi.useRealTimers());

describe('fingerprint hold controller', () => {
  it('emits one exact event only at uninterrupted completion', () => {
    vi.useFakeTimers();
    const events: UiActionEvent[] = [];
    const states: string[] = [];
    const controller = createFingerprintHoldController({
      plan,
      onAction: (event) => events.push(event),
      onStateChange: (state) => states.push(state),
    });

    expect(controller.begin()).toBe(true);
    expect(controller.begin()).toBe(false);
    vi.advanceTimersByTime(1399);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toEqual([{
      componentInstanceId: 'mission.data-extraction.accept',
      actionId: 'mission.accept-terms',
      actionType: 'fingerprint-hold/v1',
      phase: 'complete',
      payload: null,
    }]);
    expect(controller.state()).toBe('complete');
    expect(controller.cancel()).toBe(false);
    vi.advanceTimersByTime(520);
    expect(controller.state()).toBe('idle');
    expect(events).toHaveLength(1);
    expect(states).toEqual(['holding', 'complete', 'idle']);

    expect(controller.begin()).toBe(true);
    vi.advanceTimersByTime(1400);
    expect(events).toHaveLength(2);
  });

  it.each(['release', 'pointerleave', 'pointercancel', 'lostpointercapture', 'blur', 'Escape'])(
    'cancels %s without dispatch',
    () => {
      vi.useFakeTimers();
      const events: UiActionEvent[] = [];
      const controller = createFingerprintHoldController({ plan, onAction: (event) => events.push(event) });
      controller.begin();
      vi.advanceTimersByTime(600);
      expect(controller.cancel()).toBe(true);
      vi.runAllTimers();
      expect(controller.state()).toBe('idle');
      expect(events).toHaveLength(0);
    },
  );

  it('blocks disabled starts and cancels a hold when disabled', () => {
    vi.useFakeTimers();
    const events: UiActionEvent[] = [];
    const controller = createFingerprintHoldController({
      plan: { ...plan, disabled: true },
      onAction: (event) => events.push(event),
    });
    expect(controller.begin()).toBe(false);
    controller.setDisabled(false);
    expect(controller.begin()).toBe(true);
    controller.setDisabled(true);
    vi.runAllTimers();
    expect(controller.state()).toBe('idle');
    expect(events).toHaveLength(0);
  });

  it('disposal clears hold and acknowledgement timers', () => {
    vi.useFakeTimers();
    const events: UiActionEvent[] = [];
    const controller = createFingerprintHoldController({ plan, onAction: (event) => events.push(event) });
    controller.begin();
    controller.dispose();
    vi.runAllTimers();
    expect(events).toHaveLength(0);
    expect(controller.begin()).toBe(false);
  });
});
