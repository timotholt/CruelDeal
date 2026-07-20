import type { Owner } from '../../engine/types/ids';

export type CardVisualFace = 'faceUp' | 'faceDown';

export type CardVisualSourceKind =
  | 'visible-card'
  | 'hidden-hand-anchor'
  | 'deck-anchor'
  | 'zone-anchor'
  | 'generated';

export interface CardVisualSnapshot {
  readonly cardId: string;
  readonly rect: DOMRect;
  readonly rotationDegrees: number;
  readonly face: CardVisualFace;
  readonly clone: HTMLElement;
  readonly sourceKind: CardVisualSourceKind;
}

export interface CanonicalCardEndpoint {
  readonly cardId: string;
  resolveElement(): HTMLElement | null;
  resolveRect(): DOMRect | null;
  resolveRotationDegrees(): number;
  resolveFace(): CardVisualFace;
}

export interface LogicalCardEndpoint {
  readonly rect: DOMRect;
  readonly rotationDegrees?: number;
  readonly face?: CardVisualFace;
}

export type CardMotionEndpoint = CanonicalCardEndpoint | LogicalCardEndpoint;

export type SurrogateBasis =
  | { kind: 'clone'; snapshot: CardVisualSnapshot }
  | { kind: 'destination-clone'; endpoint: CanonicalCardEndpoint }
  | { kind: 'synthetic-back'; owner: Owner }
  | { kind: 'adopt-existing'; element: HTMLElement };

export type CardMotionPhase =
  | 'captured'
  | 'surrogate-active'
  | 'landed'
  | 'handing-off'
  | 'complete';

export type CardMotionCancelReason =
  | 'pointer-cancelled'
  | 'drop-rejected'
  | 'presentation-timeout'
  | 'presentation-invalidated'
  | 'screen-disposed'
  | 'destination-removed'
  | 'replaced-by-new-session'
  | 'manual';

export type CardMotionRecoveryReason =
  | 'missing-destination'
  | 'face-mismatch'
  | 'scope-disposed';

export type CardMotionResult =
  | { status: 'completed' }
  | { status: 'cancelled'; reason: CardMotionCancelReason }
  | { status: 'recovered'; reason: CardMotionRecoveryReason };

export interface CardMotionStyle {
  readonly durationMs: number;
  readonly easing: string;
  readonly opacityFrom?: number;
  readonly opacityTo?: number;
  readonly scaleFrom?: number;
  readonly scaleTo?: number;
  readonly faceAtLanding?: CardVisualFace;
}

export interface CardMotionDiagnostic {
  readonly sessionId: string;
  readonly cardId: string;
  readonly route: string;
  readonly phase: CardMotionPhase;
  readonly kind:
    | 'started'
    | 'lease-acquired'
    | 'lease-released'
    | 'landed'
    | 'face-mismatch'
    | 'recovered'
    | 'completed';
  readonly detail?: string;
}
