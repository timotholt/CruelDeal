import {
  identityFreeCardBackModel,
  mountCardSurface,
} from '@/components/game-surfaces/card/cardSurfaceRuntime';
import {
  cardModelForBasis,
  placeSurrogate,
  setSurrogateFace,
  setSurrogateModel,
  type CardMotionHost,
  type CardMotionSurrogate,
} from './createCardSurrogate';
import type { CardVisualFace, SurrogateBasis } from './types';

export const CARD_MOTION_ACTOR_CAPACITY = 16;

export interface AcquireCardMotionActorOptions {
  readonly sessionId: string;
  readonly cardId: string;
  readonly route: string;
  readonly basis: SurrogateBasis;
  readonly startRect: DOMRect;
  readonly rotationDegrees: number;
  readonly face: CardVisualFace;
  readonly zIndex?: number;
  readonly className?: string;
}

export interface CardMotionActorPool {
  readonly capacity: number;
  readonly activeCount: number;
  acquire(options: AcquireCardMotionActorOptions): CardMotionSurrogate;
  dispose(): void;
}

interface PooledActor extends CardMotionSurrogate {
  readonly index: number;
  active: boolean;
  disposeActor(): void;
}

const clearMotionStyles = (actor: PooledActor): void => {
  const { root, restingShell, visual } = actor;
  for (const property of [
    'left',
    'top',
    'width',
    'height',
    'opacity',
    'transition',
    'will-change',
    'z-index',
  ]) root.style.removeProperty(property);
  restingShell.style.removeProperty('transition');
  restingShell.style.removeProperty('transform');
  visual.style.removeProperty('transition');
  visual.style.removeProperty('transform');
};

const createActor = (host: CardMotionHost, index: number): PooledActor => {
  const root = document.createElement('div');
  root.className = 'card-motion-surrogate card-motion-actor';
  root.dataset.cardMotionActor = String(index);
  root.dataset.cardMotionActorState = 'parked';
  root.style.position = 'absolute';
  root.style.margin = '0';
  root.style.pointerEvents = 'none';
  root.hidden = true;

  const restingShell = document.createElement('div');
  restingShell.className = 'card-motion-resting-shell';
  const visual = document.createElement('div');
  visual.className = 'card card-motion-visual';
  restingShell.appendChild(visual);
  root.appendChild(restingShell);

  const surface = mountCardSurface(visual, identityFreeCardBackModel());
  const unmount = host.mountTemporary(root);
  let disposed = false;
  const actor: PooledActor = {
    index,
    root,
    restingShell,
    visual,
    surface,
    frontModel: null,
    active: false,
    release: () => {
      if (!actor.active || disposed) return;
      actor.active = false;
      actor.frontModel = null;
      actor.root.hidden = true;
      actor.root.className = 'card-motion-surrogate card-motion-actor';
      actor.root.dataset.cardMotionActorState = 'parked';
      delete actor.root.dataset.cardMotionSession;
      delete actor.root.dataset.cardId;
      delete actor.root.dataset.motionRoute;
      delete actor.root.dataset.motionPhase;
      clearMotionStyles(actor);
      setSurrogateModel(actor, identityFreeCardBackModel());
    },
    disposeActor: () => {
      if (disposed) return;
      actor.release();
      disposed = true;
      surface.dispose();
      unmount();
    },
  };
  return actor;
};

export const createCardMotionActorPool = (
  host: CardMotionHost,
  capacity = CARD_MOTION_ACTOR_CAPACITY,
): CardMotionActorPool => {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`Card motion actor capacity must be a positive integer; received ${capacity}`);
  }
  const actors = Array.from({ length: capacity }, (_, index) => createActor(host, index));
  let disposed = false;

  return {
    capacity,
    get activeCount() {
      return actors.filter(actor => actor.active).length;
    },
    acquire: (options) => {
      if (disposed) throw new Error('Cannot acquire a card motion actor from a disposed pool');
      const actor = actors.find(candidate => !candidate.active);
      if (!actor) {
        throw new Error(
          `Card motion actor pool exhausted (${capacity} active actors); choreography must be bounded`,
        );
      }

      actor.active = true;
      actor.root.hidden = false;
      actor.root.className = `card-motion-surrogate card-motion-actor ${options.className ?? ''}`.trim();
      actor.root.dataset.cardMotionActorState = 'active';
      actor.root.dataset.cardMotionSession = options.sessionId;
      actor.root.dataset.cardId = options.cardId;
      actor.root.dataset.motionRoute = options.route;
      actor.root.dataset.motionPhase = 'captured';
      actor.root.style.zIndex = String(options.zIndex ?? 180);
      actor.root.style.willChange = 'left, top, width, height, opacity';
      actor.restingShell.style.transform = `rotate(${options.rotationDegrees}deg)`;

      const initialModel = cardModelForBasis(options.basis);
      const endpointModel = options.basis.kind === 'destination-surface'
        ? options.basis.endpoint.resolveModel()
        : null;
      actor.frontModel = initialModel.face.kind === 'front'
        ? initialModel
        : endpointModel?.face.kind === 'front'
          ? endpointModel
          : null;
      setSurrogateModel(actor, initialModel);
      setSurrogateFace(actor, options.face);
      placeSurrogate(host, actor, options.startRect);
      return actor;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const actor of actors) actor.disposeActor();
    },
  };
};
