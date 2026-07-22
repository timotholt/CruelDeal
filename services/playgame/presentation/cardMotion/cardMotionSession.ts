import {
  canonicalCardEndpoint,
  setSurrogateModel,
  type CardMotionHost,
  type CardMotionSurrogate,
} from './createCardSurrogate';
import { createCardMotionActorPool } from './cardMotionActorPool';
import { CanonicalVisibilityRegistry } from './canonicalVisibility';
import { prepareCardSurfaceModel } from '@/components/game-surfaces/card/cardSurfaceRuntime';
import type {
  CanonicalCardEndpoint,
  CardMotionCancelReason,
  CardMotionDiagnostic,
  CardMotionEndpoint,
  CardMotionPhase,
  CardMotionRecoveryReason,
  CardMotionResult,
  CardMotionStyle,
  CardVisualFace,
  SurrogateBasis,
} from './types';
import {
  milliseconds,
  visualTargetKey,
  type StoryboardStep,
} from '../storyboard/contracts';

const isCanonicalEndpoint = (
  endpoint: CardMotionEndpoint,
): endpoint is CanonicalCardEndpoint => endpoint.kind === 'canonical';

const endpointRect = (endpoint: CardMotionEndpoint): DOMRect | null => (
  endpoint.resolveRect()
);

const endpointRotation = (endpoint: CardMotionEndpoint): number => (
  isCanonicalEndpoint(endpoint)
    ? endpoint.resolveRotationDegrees()
    : endpoint.rotationDegrees ?? 0
);

const endpointFace = (
  endpoint: CardMotionEndpoint,
  fallback: CardVisualFace,
): CardVisualFace => (
  isCanonicalEndpoint(endpoint) ? endpoint.resolveFace() : endpoint.face ?? fallback
);

const endpointModel = (endpoint: CardMotionEndpoint) => (
  isCanonicalEndpoint(endpoint) ? endpoint.resolveModel() : endpoint.model ?? null
);

export interface BeginCardMotionOptions {
  readonly cardId: string;
  readonly route: string;
  readonly basis: SurrogateBasis;
  readonly startRect: DOMRect;
  readonly rotationDegrees?: number;
  readonly face?: CardVisualFace;
  readonly sourceElement?: HTMLElement | null;
  readonly zIndex?: number;
  readonly className?: string;
}

export interface CardMotionSession {
  readonly id: string;
  readonly cardId: string;
  readonly surrogate: HTMLElement;
  readonly phase: CardMotionPhase;
  prepareStep(
    stepId: string,
    endpoint: CardMotionEndpoint,
    style: CardMotionStyle,
  ): Promise<StoryboardStep>;
  timelineTargets(): ReadonlyMap<string, Element>;
  handoffTo(endpoint: CanonicalCardEndpoint): CardMotionResult;
  finishAtLogicalZone(): CardMotionResult;
  cancel(reason: CardMotionCancelReason): CardMotionResult;
  dispose(): void;
}

export interface CardMotionScope {
  readonly activeSessionCount: number;
  readonly activeLeaseCount: number;
  readonly diagnostics: readonly CardMotionDiagnostic[];
  begin(options: BeginCardMotionOptions): CardMotionSession;
  endpoint(cardId: string): CanonicalCardEndpoint;
  cancelAll(reason: CardMotionCancelReason): void;
  dispose(): void;
}

class MotionSession implements CardMotionSession {
  private currentPhase: CardMotionPhase = 'captured';
  private terminalResult: CardMotionResult | null = null;
  private plannedFace: CardVisualFace;
  private plannedRect: DOMRect;
  private plannedRotationDegrees: number;
  private plannedOpacity = 1;
  private plannedScale = 1;

  constructor(
    readonly id: string,
    readonly cardId: string,
    private readonly route: string,
    private readonly host: CardMotionHost,
    private readonly visual: CardMotionSurrogate,
    private readonly leases: CanonicalVisibilityRegistry,
    private readonly finishRegistration: (session: MotionSession) => void,
    private readonly record: (diagnostic: CardMotionDiagnostic) => void,
    sourceElement: HTMLElement | null,
    face: CardVisualFace,
    startRect: DOMRect,
  ) {
    this.plannedFace = face;
    this.plannedRect = this.host.toLocalRect(startRect);
    this.plannedRotationDegrees = Number.parseFloat(
      this.visual.restingShell.style.transform.match(/-?[\d.]+/)?.[0] ?? '0',
    );
    if (sourceElement) {
      this.leases.acquire(this.id, this.cardId, sourceElement);
      this.recordDiagnostic('lease-acquired', 'source');
    }
    this.setPhase('surrogate-active');
    this.recordDiagnostic('started', undefined, startRect);
  }

  get surrogate(): HTMLElement {
    return this.visual.root;
  }

  get phase(): CardMotionPhase {
    return this.currentPhase;
  }

  async prepareStep(
    stepId: string,
    endpoint: CardMotionEndpoint,
    style: CardMotionStyle,
  ): Promise<StoryboardStep> {
    if (this.terminalResult) throw new Error(`Card motion ${this.id} is already complete`);
    if (isCanonicalEndpoint(endpoint)) {
      const destination = endpoint.resolveElement();
      if (!destination?.isConnected) {
        throw new Error(`Card motion ${this.id} canonical destination is unavailable`);
      }
      this.leases.acquire(this.id, this.cardId, destination);
      this.recordDiagnostic('lease-acquired', 'destination');
    }

    const durationMs = Math.max(1, Math.round(style.durationMs));
    const targetFace = style.faceAtLanding ?? endpointFace(endpoint, this.plannedFace);
    const scaleFrom = style.scaleFrom ?? this.plannedScale;
    const scaleTo = style.scaleTo ?? 1;
    const opacityFrom = style.opacityFrom ?? this.plannedOpacity;
    const opacityTo = style.opacityTo ?? 1;
    const landingModel = endpointModel(endpoint);
    const modelToPrepare = landingModel?.face.kind === 'front'
      ? landingModel
      : this.visual.frontModel;
    if (modelToPrepare?.face.kind === 'front') {
      await prepareCardSurfaceModel(modelToPrepare);
      if (this.terminalResult) throw new Error(`Card motion ${this.id} was cancelled`);
      setSurrogateModel(this.visual, modelToPrepare);
    }
    // Resolve geometry after asynchronous surface preparation. State adoption
    // can precede the browser's first usable layout; an endpoint captured
    // before that boundary may contain a transient zero rectangle.
    const rect = endpointRect(endpoint);
    if (!rect) throw new Error(`Card motion ${this.id} is missing its destination`);
    const targetRect = !isCanonicalEndpoint(endpoint) && endpoint.coordinateSpace === 'frame-local'
      ? new DOMRect(rect.left, rect.top, rect.width, rect.height)
      : this.host.toLocalRect(rect);
    const targetRotation = endpointRotation(endpoint);
    const startFaceAngle = this.plannedFace === 'faceDown' ? 0 : 180;
    const targetFaceAngle = targetFace === 'faceDown' ? 0 : 180;
    const duration = milliseconds(durationMs);
    const startRect = this.plannedRect;
    this.recordDiagnostic('motion-started', undefined, rect, durationMs);

    const step: StoryboardStep = {
      id: stepId,
      durationMs: duration,
      nextStepAfterMs: duration,
      tracks: [
        {
          kind: 'ELEMENT',
          id: `${stepId}:root`,
          target: { kind: 'CARD_ACTOR_ROOT', card: this.cardId },
          channel: 'layout',
          keyframes: [
            {
              atMs: milliseconds(0),
              styles: {
                left: `${startRect.left}px`,
                top: `${startRect.top}px`,
                width: `${startRect.width}px`,
                height: `${startRect.height}px`,
                opacity: opacityFrom,
              },
            },
            {
              atMs: duration,
              styles: {
                left: `${targetRect.left}px`,
                top: `${targetRect.top}px`,
                width: `${targetRect.width}px`,
                height: `${targetRect.height}px`,
                opacity: opacityTo,
              },
              easing: style.easing,
            },
          ],
        },
        {
          kind: 'ELEMENT',
          id: `${stepId}:resting`,
          target: { kind: 'CARD_ACTOR_RESTING_SHELL', card: this.cardId },
          channel: 'resting-pose',
          keyframes: [
            {
              atMs: milliseconds(0),
              styles: { transform: `rotate(${this.plannedRotationDegrees}deg)` },
            },
            {
              atMs: duration,
              styles: { transform: `rotate(${targetRotation}deg)` },
              easing: style.easing,
            },
          ],
        },
        {
          kind: 'ELEMENT',
          id: `${stepId}:face`,
          target: { kind: 'CARD_ACTOR_FACE_SHELL', card: this.cardId },
          channel: 'face-turn',
          keyframes: [
            {
              atMs: milliseconds(0),
              styles: { transform: `rotateY(${startFaceAngle}deg) scale(${scaleFrom})` },
            },
            {
              atMs: duration,
              styles: { transform: `rotateY(${targetFaceAngle}deg) scale(${scaleTo})` },
              easing: style.easing,
            },
          ],
        },
      ],
      cues: [],
    };
    this.plannedRect = targetRect;
    this.plannedRotationDegrees = targetRotation;
    this.plannedFace = targetFace;
    this.plannedOpacity = opacityTo;
    this.plannedScale = scaleTo;
    return step;
  }

  timelineTargets(): ReadonlyMap<string, Element> {
    return new Map([
      [visualTargetKey({ kind: 'CARD_ACTOR_ROOT', card: this.cardId }), this.visual.root],
      [
        visualTargetKey({ kind: 'CARD_ACTOR_RESTING_SHELL', card: this.cardId }),
        this.visual.restingShell,
      ],
      [
        visualTargetKey({ kind: 'CARD_ACTOR_FACE_SHELL', card: this.cardId }),
        this.visual.visual,
      ],
    ]);
  }

  handoffTo(endpoint: CanonicalCardEndpoint): CardMotionResult {
    if (this.terminalResult) return this.terminalResult;
    this.setPhase('handing-off');
    const destination = endpoint.resolveElement();
    if (!destination) return this.recover('missing-destination');

    const destinationFace = endpoint.resolveFace();
    if (destinationFace !== this.plannedFace) {
      this.recordDiagnostic(
        'face-mismatch',
        `surrogate=${this.plannedFace}; canonical=${destinationFace}`,
      );
      return this.recover('face-mismatch');
    }

    // Paint-safe ownership handoff: restoring the canonical representation
    // and removing the surrogate are synchronous in the same task.
    this.leases.releaseSession(this.id);
    this.recordDiagnostic('lease-released');
    this.cleanupSurrogate();
    return this.complete({ status: 'completed' });
  }

  finishAtLogicalZone(): CardMotionResult {
    if (this.terminalResult) return this.terminalResult;
    this.leases.releaseSession(this.id);
    this.recordDiagnostic('lease-released');
    this.cleanupSurrogate();
    return this.complete({ status: 'completed' });
  }

  cancel(reason: CardMotionCancelReason): CardMotionResult {
    if (this.terminalResult) return this.terminalResult;
    return this.completeTerminal({ status: 'cancelled', reason });
  }

  dispose(): void {
    this.cancel('manual');
  }

  private recover(reason: CardMotionRecoveryReason): CardMotionResult {
    this.recordDiagnostic('recovered', reason);
    return this.completeTerminal({ status: 'recovered', reason });
  }

  private completeTerminal(result: CardMotionResult): CardMotionResult {
    this.leases.releaseSession(this.id);
    this.recordDiagnostic('lease-released');
    this.cleanupSurrogate();
    return this.complete(result);
  }

  private complete(result: CardMotionResult): CardMotionResult {
    if (this.terminalResult) return this.terminalResult;
    this.terminalResult = result;
    this.setPhase('complete');
    this.finishRegistration(this);
    this.recordDiagnostic('completed', result.status);
    return result;
  }

  private cleanupSurrogate(): void {
    this.visual.root.style.removeProperty('will-change');
    this.visual.release();
  }

  private setPhase(phase: CardMotionPhase): void {
    this.currentPhase = phase;
    this.visual.root.dataset.motionPhase = phase;
  }

  private recordDiagnostic(
    kind: CardMotionDiagnostic['kind'],
    detail?: string,
    rect?: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
    durationMs?: number,
  ): void {
    this.record({
      sessionId: this.id,
      cardId: this.cardId,
      route: this.route,
      phase: this.currentPhase,
      atMs: performance.now(),
      kind,
      ...(detail ? { detail } : {}),
      ...(rect ? {
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      } : {}),
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  }
}

export const createCardMotionScope = (host: CardMotionHost): CardMotionScope => {
  const sessions = new Map<string, MotionSession>();
  const leases = new CanonicalVisibilityRegistry();
  const actors = createCardMotionActorPool(host);
  const diagnosticEntries: CardMotionDiagnostic[] = [];
  let nextSessionId = 1;
  let disposed = false;

  const record = (diagnostic: CardMotionDiagnostic): void => {
    diagnosticEntries.push(diagnostic);
    if (diagnosticEntries.length > 100) diagnosticEntries.shift();
  };

  const finishRegistration = (session: MotionSession): void => {
    if (sessions.get(session.cardId) === session) sessions.delete(session.cardId);
  };

  return {
    get activeSessionCount() {
      return sessions.size;
    },
    get activeLeaseCount() {
      return leases.activeLeaseCount;
    },
    get diagnostics() {
      return diagnosticEntries;
    },
    endpoint: (cardId) => canonicalCardEndpoint(cardId, host.cardElement),
    begin: (options) => {
      if (disposed) throw new Error('Cannot begin card motion in a disposed scope');
      const existing = sessions.get(options.cardId);
      if (existing) {
        existing.cancel('replaced-by-new-session');
      }
      const sessionId = `card-motion-${nextSessionId++}`;
      const face = options.face
        ?? (options.basis.kind === 'clone' ? options.basis.snapshot.face : 'faceDown');
      const rotationDegrees = options.rotationDegrees
        ?? (options.basis.kind === 'clone' ? options.basis.snapshot.rotationDegrees : 0);
      const surrogate = actors.acquire({
        sessionId,
        cardId: options.cardId,
        route: options.route,
        basis: options.basis,
        startRect: options.startRect,
        rotationDegrees,
        face,
        zIndex: options.zIndex,
        className: options.className,
      });
      const session = new MotionSession(
        sessionId,
        options.cardId,
        options.route,
        host,
        surrogate,
        leases,
        finishRegistration,
        record,
        options.sourceElement ?? null,
        face,
        options.startRect,
      );
      sessions.set(options.cardId, session);
      return session;
    },
    cancelAll: (reason) => {
      for (const session of [...sessions.values()]) void session.cancel(reason);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const session of [...sessions.values()]) void session.cancel('screen-disposed');
      leases.releaseAll();
      actors.dispose();
    },
  };
};
