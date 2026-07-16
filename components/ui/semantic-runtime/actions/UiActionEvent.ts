export interface UiActionEvent {
  readonly componentInstanceId: string;
  readonly actionId: string;
  readonly actionType: 'fingerprint-hold/v1';
  readonly phase: 'complete';
  readonly payload: null;
}

export type UiActionEventHandler = (event: UiActionEvent) => void;

export const createFingerprintHoldCompleteEventV1 = (
  componentInstanceId: string,
  actionId: string,
): UiActionEvent => ({
  componentInstanceId,
  actionId,
  actionType: 'fingerprint-hold/v1',
  phase: 'complete',
  payload: null,
});
