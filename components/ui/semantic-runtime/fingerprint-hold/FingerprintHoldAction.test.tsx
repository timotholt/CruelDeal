import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiActionEvent } from '../actions/UiActionEvent';
import { CompiledFingerprintHoldAction } from './CompiledFingerprintHoldAction';
import type { FingerprintHoldActionRuntimePlanV1 } from './fingerprintHoldRuntimePlan';

const basePlan: FingerprintHoldActionRuntimePlanV1 = {
  type: 'FingerprintHoldActionRuntimePlanV1',
  componentInstanceId: 'mission.data-extraction.accept',
  actionId: 'mission.accept-terms',
  actionType: 'fingerprint-hold/v1',
  holdDurationMs: 1400,
  acknowledgementMs: 520,
  disabled: false,
  accessibleLabel: 'Accept Terms',
};

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = (options: { disabled?: boolean; reducedMotion?: boolean } = {}) => {
  const events: UiActionEvent[] = [];
  const [disabled, setDisabled] = createSignal(options.disabled ?? false);
  if (options.reducedMotion !== undefined) {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: options.reducedMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  dispose = render(() => (
    <CompiledFingerprintHoldAction
      plan={{ ...basePlan, disabled: disabled() }}
      label="Accept Terms"
      onAction={(event) => events.push(event)}
    />
  ), container);
  const button = container.querySelector('button')!;
  Object.defineProperties(button, {
    setPointerCapture: { value: vi.fn(), configurable: true },
    releasePointerCapture: { value: vi.fn(), configurable: true },
    hasPointerCapture: { value: vi.fn(() => true), configurable: true },
  });
  return { button, events, setDisabled };
};

const pointerEvent = (type: string, pointerId = 1, clientX = 0, clientY = 0) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    isPrimary: { value: true },
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
};

describe('FingerprintHoldAction runtime component', () => {
  it('renders one semantic button with stateful accessible status', () => {
    const { button } = mount();
    expect(button.type).toBe('button');
    expect(button.textContent).toContain('Accept Terms');
    expect(button.getAttribute('aria-label')).toBe('Accept Terms. Hold to activate.');
    expect(button.dataset.holdState).toBe('idle');
  });

  it('owns pointer capture and dispatches exactly once after the duration', () => {
    vi.useFakeTimers();
    const { button, events } = mount();
    button.dispatchEvent(pointerEvent('pointerdown', 7));
    expect(button.dataset.holdState).toBe('holding');
    expect(button.setPointerCapture).toHaveBeenCalledWith(7);
    vi.advanceTimersByTime(1400);
    expect(button.dataset.holdState).toBe('complete');
    expect(events).toHaveLength(1);
    button.dispatchEvent(pointerEvent('pointerup', 7));
    button.click();
    vi.runAllTimers();
    expect(events).toHaveLength(1);
  });

  it.each(['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture'])(
    'cancels on %s',
    (eventName) => {
      vi.useFakeTimers();
      const { button, events } = mount();
      button.dispatchEvent(pointerEvent('pointerdown'));
      button.dispatchEvent(pointerEvent(eventName));
      vi.runAllTimers();
      expect(button.dataset.holdState).toBe('idle');
      expect(events).toHaveLength(0);
    },
  );

  it('cancels a captured pointer that moves outside the button bounds', () => {
    vi.useFakeTimers();
    const { button, events } = mount();
    button.dispatchEvent(pointerEvent('pointerdown'));
    button.dispatchEvent(pointerEvent('pointermove', 1, 10, 10));
    vi.runAllTimers();
    expect(button.dataset.holdState).toBe('idle');
    expect(events).toHaveLength(0);
  });

  it.each(['Enter', ' '])('supports the %j keyboard hold and suppresses repeat/click bypass', (key) => {
    vi.useFakeTimers();
    const { button, events } = mount();
    button.click();
    expect(events).toHaveLength(0);
    button.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: false, bubbles: true, cancelable: true }));
    button.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(1400);
    expect(events).toHaveLength(1);
    button.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }));
    button.click();
    vi.runAllTimers();
    expect(events).toHaveLength(1);
  });

  it('cancels on Escape and blur', () => {
    vi.useFakeTimers();
    const { button, events } = mount();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    vi.runAllTimers();
    expect(events).toHaveLength(0);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    button.dispatchEvent(new FocusEvent('blur'));
    vi.runAllTimers();
    expect(events).toHaveLength(0);
  });

  it('blocks and reactively cancels disabled actions', () => {
    vi.useFakeTimers();
    const { button, events, setDisabled } = mount();
    button.dispatchEvent(pointerEvent('pointerdown'));
    setDisabled(true);
    expect(button.disabled).toBe(true);
    vi.runAllTimers();
    expect(events).toHaveLength(0);
  });

  it('unmount cancels pending work', () => {
    vi.useFakeTimers();
    const { button, events } = mount();
    button.dispatchEvent(pointerEvent('pointerdown'));
    dispose?.();
    dispose = undefined;
    vi.runAllTimers();
    expect(events).toHaveLength(0);
  });

  it('reduced motion suppresses scan motion without changing hold timing', () => {
    vi.useFakeTimers();
    const { button, events } = mount({ reducedMotion: true });
    expect(button.dataset.reducedMotion).toBe('true');
    button.dispatchEvent(pointerEvent('pointerdown'));
    vi.advanceTimersByTime(1399);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(events).toHaveLength(1);
  });
});
