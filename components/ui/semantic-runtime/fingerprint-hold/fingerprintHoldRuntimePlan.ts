export interface FingerprintHoldActionRuntimePlanV1 {
  readonly type: 'FingerprintHoldActionRuntimePlanV1';
  readonly componentInstanceId: string;
  readonly actionId: string;
  readonly actionType: 'fingerprint-hold/v1';
  readonly holdDurationMs: number;
  readonly acknowledgementMs: 520;
  readonly disabled: boolean;
  readonly accessibleLabel: string;
}
