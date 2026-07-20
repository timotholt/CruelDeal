import {
  canonicalCardEndpoint,
  createCardSurrogate,
  placeSurrogate,
  setSurrogateFace,
  type CardMotionHost,
  type CardMotionSurrogate,
} from './createCardSurrogate';
import { CanonicalVisibilityRegistry } from './canonicalVisibility';
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

const isCanonicalEndpoint = (
  endpoint: CardMotionEndpoint,
): endpoint is CanonicalCardEndpoint => 'resolveElement' in endpoint;

const endpointRect = (endpoint: CardMotionEndpoint): DOMRect | null => (
  isCanonicalEndpoint(endpoint) ? endpoint.resolveRect() : endpoint.rect
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
  animateTo(endpoint: CardMotionEndpoint, style: CardMotionStyle): Promise<CardMotionResult | null>;
  handoffTo(endpoint: CanonicalCardEndpoint): Promise<CardMotionResult>;
  finishAtLogicalZone(): Promise<CardMotionResult>;
  cancel(reason: CardMotionCancelReason): Promise<CardMotionResult>;
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
  private readonly pendingWaits = new Set<() => void>();
  private currentFace: CardVisualFace;

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
  ) {
    this.currentFace = face;
    if (sourceElement) {
      this.leases.acquire(this.id, this.cardId, sourceElement);
      this.recordDiagnostic('lease-acquired', 'source');
    }
    this.setPhase('surrogate-active');
    this.recordDiagnostic('started');
  }

  get surrogate(): HTMLElement {
    return this.visual.root;
  }

  get phase(): CardMotionPhase {
    return this.currentPhase;
  }

  async animateTo(
    endpoint: CardMotionEndpoint,
    style: CardMotionStyle,
  ): Promise<CardMotionResult | null> {
    if (this.terminalResult) return this.terminalResult;
    const rect = endpointRect(endpoint);
    if (!rect) return this.recover('missing-destination');

    if (isCanonicalEndpoint(endpoint)) {
      const destination = endpoint.resolveElement();
      if (destination) {
        this.leases.acquire(this.id, this.cardId, destination);
        this.recordDiagnostic('lease-acquired', 'destination');
      }
    }

    const reducedMotion = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const durationMs = reducedMotion ? 1 : Math.max(1, style.durationMs);
    const targetFace = style.faceAtLanding ?? endpointFace(endpoint, this.currentFace);
    const scaleFrom = style.scaleFrom ?? 1;
    const scaleTo = style.scaleTo ?? 1;
    this.visual.root.style.opacity = String(style.opacityFrom ?? 1);
    this.visual.visual.style.transform = `rotateY(${this.currentFace === 'faceDown' ? 180 : 0}deg) scale(${scaleFrom})`;
    void this.visual.root.offsetWidth;

    this.visual.root.style.transition = [
      `left ${durationMs}ms ${style.easing}`,
      `top ${durationMs}ms ${style.easing}`,
      `width ${durationMs}ms ${style.easing}`,
      `height ${durationMs}ms ${style.easing}`,
      `opacity ${durationMs}ms ${style.easing}`,
    ].join(', ');
    this.visual.restingShell.style.transition = `transform ${durationMs}ms ${style.easing}`;
    this.visual.visual.style.transition = `transform ${durationMs}ms ${style.easing}`;
    placeSurrogate(this.host, this.visual, rect);
    this.visual.restingShell.style.transform = `rotate(${endpointRotation(endpoint)}deg)`;
    this.visual.root.style.opacity = String(style.opacityTo ?? 1);
    this.visual.visual.style.transform = `rotateY(${targetFace === 'faceDown' ? 180 : 0}deg) scale(${scaleTo})`;
    setSurrogateFace(this.visual, targetFace);
    this.currentFace = targetFace;

    await this.wait(durationMs + 30);
    if (this.terminalResult) return this.terminalResult;
    this.setPhase('landed');
    this.recordDiagnostic('landed');
    return null;
  }

  async handoffTo(endpoint: CanonicalCardEndpoint): Promise<CardMotionResult> {
    if (this.terminalResult) return this.terminalResult;
    this.setPhase('handing-off');
    const destination = endpoint.resolveElement();
    if (!destination) return this.recover('missing-destination');

    const destinationFace = endpoint.resolveFace();
    if (destinationFace !== this.currentFace) {
      this.recordDiagnostic(
        'face-mismatch',
        `surrogate=${this.currentFace}; canonical=${destinationFace}`,
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

  async finishAtLogicalZone(): Promise<CardMotionResult> {
    if (this.terminalResult) return this.terminalResult;
    this.leases.releaseSession(this.id);
    this.recordDiagnostic('lease-released');
    this.cleanupSurrogate();
    return this.complete({ status: 'completed' });
  }

  async cancel(reason: CardMotionCancelReason): Promise<CardMotionResult> {
    if (this.terminalResult) return this.terminalResult;
    return this.completeTerminal({ status: 'cancelled', reason });
  }

  dispose(): void {
    void this.cancel('manual');
  }

  private recover(reason: CardMotionRecoveryReason): CardMotionResult {
    this.recordDiagnostic('recovered', reason);
    return this.completeTerminal({ status: 'recovered', reason });
  }

  private completeTerminal(result: CardMotionResult): CardMotionResult {
    for (const settle of [...this.pendingWaits]) settle();
    this.pendingWaits.clear();
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
    this.visual.root.style.removeProperty('transition');
    this.visual.root.style.removeProperty('will-change');
    this.visual.restingShell.style.removeProperty('transition');
    this.visual.visual.style.removeProperty('transition');
    this.visual.unmount();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.pendingWaits.delete(finish);
        resolve();
      };
      this.pendingWaits.add(finish);
      const timeout = setTimeout(finish, ms);
    });
  }

  private setPhase(phase: CardMotionPhase): void {
    this.currentPhase = phase;
    this.visual.root.dataset.motionPhase = phase;
  }

  private recordDiagnostic(kind: CardMotionDiagnostic['kind'], detail?: string): void {
    this.record({
      sessionId: this.id,
      cardId: this.cardId,
      route: this.route,
      phase: this.currentPhase,
      kind,
      ...(detail ? { detail } : {}),
    });
  }
}

export const createCardMotionScope = (host: CardMotionHost): CardMotionScope => {
  const sessions = new Map<string, MotionSession>();
  const leases = new CanonicalVisibilityRegistry();
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
    endpoint: (cardId) => canonicalCardEndpoint(cardId, host.cardRefs),
    begin: (options) => {
      if (disposed) throw new Error('Cannot begin card motion in a disposed scope');
      const existing = sessions.get(options.cardId);
      if (existing) {
        void existing.cancel('replaced-by-new-session');
      }
      const sessionId = `card-motion-${nextSessionId++}`;
      const face = options.face
        ?? (options.basis.kind === 'clone' ? options.basis.snapshot.face : 'faceDown');
      const rotationDegrees = options.rotationDegrees
        ?? (options.basis.kind === 'clone' ? options.basis.snapshot.rotationDegrees : 0);
      const surrogate = createCardSurrogate(host, {
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
    },
  };
};
