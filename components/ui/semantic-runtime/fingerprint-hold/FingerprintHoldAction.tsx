import { createEffect, createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  MaterialButton,
  type ButtonSize,
  type SurfaceOptions,
} from '../../material-lab';
import type { UiActionEventHandler } from '../actions/UiActionEvent';
import {
  createFingerprintHoldController,
  type FingerprintHoldState,
} from './fingerprintHoldController';
import type { FingerprintHoldActionRuntimePlanV1 } from './fingerprintHoldRuntimePlan';

const stateDescription = (
  plan: FingerprintHoldActionRuntimePlanV1,
  state: FingerprintHoldState,
) => {
  if (plan.disabled) return `${plan.accessibleLabel}. Disabled.`;
  if (state === 'holding') return `${plan.accessibleLabel}. Holding.`;
  if (state === 'complete') return `${plan.accessibleLabel}. Complete.`;
  return `${plan.accessibleLabel}. Hold to activate.`;
};

export const FingerprintHoldAction = (props: {
  plan: FingerprintHoldActionRuntimePlanV1;
  surfaceProps?: SurfaceOptions;
  size?: ButtonSize;
  fullWidth?: boolean;
  class?: string;
  label: JSX.Element;
  onAction: UiActionEventHandler;
  compiledHost?: boolean;
  classForState?: (state: FingerprintHoldState) => string;
}) => {
  const [state, setState] = createSignal<FingerprintHoldState>('idle');
  const [reducedMotion, setReducedMotion] = createSignal(false);
  const createController = () => createFingerprintHoldController({
    plan: props.plan,
    onStateChange: setState,
    onAction: (event) => props.onAction(event),
  });
  let controller = createController();
  let planIdentity = '';

  createEffect(() => {
    const nextIdentity = [
      props.plan.componentInstanceId,
      props.plan.actionId,
      props.plan.holdDurationMs,
      props.plan.acknowledgementMs,
    ].join(':');
    if (planIdentity && planIdentity !== nextIdentity) {
      controller.dispose();
      setState('idle');
      controller = createController();
    }
    planIdentity = nextIdentity;
    controller.setDisabled(props.plan.disabled);
  });
  onMount(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    onCleanup(() => media.removeEventListener?.('change', update));
  });
  onCleanup(() => controller.dispose());

  const releasePointer = (event: PointerEvent & { currentTarget: HTMLButtonElement }) => {
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Capture may already have been released by pointercancel/lostpointercapture.
    }
  };
  const cancelPointer = (event: PointerEvent & { currentTarget: HTMLButtonElement }) => {
    controller.cancel();
    releasePointer(event);
  };
  const onPointerDown: JSX.EventHandler<HTMLButtonElement, PointerEvent> = (event) => {
    if (event.button !== 0 || !event.isPrimary || props.plan.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    if (!controller.begin()) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove: JSX.EventHandler<HTMLButtonElement, PointerEvent> = (event) => {
    if (controller.state() !== 'holding') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left
      || event.clientX > bounds.right
      || event.clientY < bounds.top
      || event.clientY > bounds.bottom
    ) {
      cancelPointer(event);
    }
  };
  const onKeyDown: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (event) => {
    if (event.key === 'Escape') {
      if (controller.cancel()) event.preventDefault();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) controller.begin();
  };
  const onKeyUp: JSX.EventHandler<HTMLButtonElement, KeyboardEvent> = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    controller.cancel();
  };

  return (
    <Dynamic
      component={props.compiledHost ? 'button' : MaterialButton}
      {...(props.compiledHost ? {} : props.surfaceProps)}
      type="button"
      {...(props.compiledHost ? {} : { size: props.size, fullWidth: props.fullWidth })}
      class={`${props.class || ''} ${props.classForState?.(state()) || ''} fingerprint-hold-action main-material-fingerprint-hold-node--ready ${state() === 'holding' ? 'main-material-fingerprint-hold-node--holding' : ''} ${state() === 'complete' ? 'main-material-fingerprint-hold-node--complete' : ''} ${reducedMotion() ? 'main-material-fingerprint-hold-node--reduced-motion' : ''}`}
      disabled={props.plan.disabled}
      aria-label={stateDescription(props.plan, state())}
      aria-live="polite"
      aria-pressed={state() === 'holding'}
      aria-busy={state() === 'holding'}
      data-hold-state={state()}
      data-reduced-motion={reducedMotion() ? 'true' : 'false'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPointer}
      onPointerLeave={cancelPointer}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={() => controller.cancel()}
      onBlur={() => controller.cancel()}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      label={props.compiledHost ? undefined : props.label}
    >
      {props.compiledHost ? props.label : undefined}
    </Dynamic>
  );
};
