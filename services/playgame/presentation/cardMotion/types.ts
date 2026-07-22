import type { CardSurfaceModel } from '@/components/game-surfaces/contracts';

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
  readonly model: CardSurfaceModel;
  readonly sourceKind: CardVisualSourceKind;
}

export interface CanonicalCardEndpoint {
  readonly kind: 'canonical';
  readonly cardId: string;
  resolveElement(): HTMLElement | null;
  resolveRect(): DOMRect | null;
  resolveRotationDegrees(): number;
  resolveFace(): CardVisualFace;
  resolveModel(): CardSurfaceModel | null;
}

export interface LogicalCardEndpoint {
  readonly kind: 'logical';
  /** Logical choreography may be authored against either the browser
      viewport or the fixed 9:16 play frame. The coordinate space is part of
      the endpoint contract so it can never be guessed from a DOMRect. */
  readonly coordinateSpace: 'viewport' | 'frame-local';
  resolveRect(): DOMRect | null;
  readonly rotationDegrees?: number;
  readonly face?: CardVisualFace;
  readonly model?: CardSurfaceModel;
}

export type CardMotionEndpoint = CanonicalCardEndpoint | LogicalCardEndpoint;

export type SurrogateBasis =
  | { kind: 'clone'; snapshot: CardVisualSnapshot }
  | { kind: 'destination-surface'; endpoint: CanonicalCardEndpoint }
  | { kind: 'synthetic-back' };

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
  readonly atMs: number;
  readonly kind:
    | 'started'
    | 'motion-started'
    | 'face-swapped'
    | 'lease-acquired'
    | 'lease-released'
    | 'landed'
    | 'face-mismatch'
    | 'recovered'
    | 'completed';
  readonly detail?: string;
  readonly rect?: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>;
  readonly durationMs?: number;
}
