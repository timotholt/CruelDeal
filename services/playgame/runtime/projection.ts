import type { Manifest } from '../engine/manifest/types';
import { cyrb128 } from '../engine/rng';
import {
  getCardCost,
  getCardPower,
  getLanePower,
} from '../engine/projections';
import { getAllCardStates } from '../engine/projections/cardRuntime';
import {
  getLocationState,
  redactLocationsForSeat,
} from '../engine/projections/locationRuntime';
import type { CanonicalFrameTransition } from '../engine/transactionTimeline';
import type {
  AbilityRef,
  CanonicalEntityRef,
  EffectOutcomeReason,
  EffectTargetResult,
} from '../engine/types/effectTrace';
import type { MatchEvent } from '../engine/types/events';
import type {
  CardZone,
  LocationCardFace,
  MatchPhase,
  MatchResult,
  MatchState,
} from '../engine/types/state';
import type {
  CardId,
  LaneId,
  LocationCardInstanceId,
  Owner,
  Seat,
} from '../engine/types/ids';
import type { Frame, TemporalScope } from '../engine/types/timeline';
import type {
  CommittedTransactionTimeline,
  MatchBootstrap,
  MatchMode,
  PlanRevision,
  PublicRevision,
  SeatInteractionStatus,
  ParticipantController,
} from './contracts';

export type SeatCardToken = string;
export type SeatLocationToken = string;

export interface SeatParticipant {
  readonly participantId: string;
  readonly controller: ParticipantController;
  readonly displayName: string;
  readonly avatarId?: string;
}

export interface SeatDeckMetadata {
  readonly kind: 'PLAYER' | 'LOCATION';
  readonly deckId: string;
  readonly revision: number;
  readonly name: string;
  readonly cardCount: number;
}

export interface SeatBootstrap {
  readonly version: 1;
  readonly matchId: string;
  readonly mode: MatchMode;
  readonly rulesetId: string;
  readonly manifestVersion: number;
  readonly viewerSeat: Seat;
  readonly participants: Readonly<Record<Seat, SeatParticipant>>;
  readonly decks: Readonly<Record<Seat | 'LOCATIONS', SeatDeckMetadata>>;
}

export function projectBootstrapForSeat(
  bootstrap: MatchBootstrap,
): SeatBootstrap {
  const participant = (seat: Seat): SeatParticipant => ({
    participantId: bootstrap.participants[seat].participantId,
    controller: bootstrap.participants[seat].controller,
    displayName: bootstrap.participants[seat].displayName,
    ...(bootstrap.participants[seat].avatarId === undefined
      ? {}
      : { avatarId: bootstrap.participants[seat].avatarId }),
  });
  const deck = (
    slot: Seat | 'LOCATIONS',
  ): SeatDeckMetadata => ({
    kind: bootstrap.decks[slot].kind,
    deckId: bootstrap.decks[slot].deckId,
    revision: bootstrap.decks[slot].revision,
    name: bootstrap.decks[slot].name,
    cardCount: bootstrap.decks[slot].entries.length,
  });
  return {
    version: 1,
    matchId: bootstrap.matchId,
    mode: bootstrap.mode,
    rulesetId: bootstrap.rulesetId,
    manifestVersion: bootstrap.manifestVersion,
    viewerSeat: bootstrap.viewerSeat,
    participants: {
      P0: participant('P0'),
      P1: participant('P1'),
    },
    decks: {
      P0: deck('P0'),
      P1: deck('P1'),
      LOCATIONS: deck('LOCATIONS'),
    },
  };
}

export interface SeatVisibleCard {
  readonly token: SeatCardToken;
  readonly owner: Owner;
  readonly zone: Exclude<CardZone, 'DECK'>;
  readonly lane: LaneId | null;
  readonly revealed: boolean;
  /** Absent while this card's identity is hidden from the viewer. */
  readonly defId?: string;
  readonly variantId?: string;
  /** Effective values are absent with hidden identity. */
  readonly cost?: number;
  readonly power?: number;
  readonly tags?: readonly string[];
  readonly counters?: Readonly<Record<string, number>>;
}

export interface SeatVisibleLocation {
  readonly token: SeatLocationToken;
  readonly face: LocationCardFace;
  readonly revealAtTurn: number | null;
  /** Absent while this location's identity is hidden from the viewer. */
  readonly defId?: string;
}

export interface SeatVisibleLane {
  readonly id: LaneId;
  readonly status: MatchState['lanesById'][LaneId]['status'];
  readonly location: SeatVisibleLocation | null;
  readonly cards: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly power: Readonly<Record<Owner, number>>;
}

/**
 * Small JSON-safe state sent across a player boundary.
 *
 * This is deliberately not MatchState. It excludes gameplay RNG state,
 * hidden deck identities/order, pending-effect internals, mutation ledgers,
 * tracked-variable caches, and authoritative replay history.
 */
export interface SeatVisibleMatchState {
  readonly turn: number;
  readonly phase: MatchPhase;
  readonly priority: Owner;
  readonly energy: Readonly<Record<Owner, number>>;
  readonly maxEnergy: Readonly<Record<Owner, number>>;
  readonly nextTurnEnergyBonus: Readonly<Record<Owner, number>>;
  readonly deckCounts: Readonly<Record<Owner, number>>;
  readonly locationDeckCount: number;
  readonly hands: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly cards: readonly SeatVisibleCard[];
  readonly lanes: readonly SeatVisibleLane[];
  readonly stagedCards: readonly SeatCardToken[];
  readonly discard: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly destroyed: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly banished: Readonly<Record<Owner, readonly SeatCardToken[]>>;
  readonly banishedCounts: Readonly<Record<Owner, number>>;
  readonly result: MatchResult | null;
}

export interface SeatMatchSnapshot {
  readonly version: 2;
  readonly matchId: string;
  readonly publicRevision: PublicRevision;
  readonly planRevision: PlanRevision;
  readonly frame: Frame;
  readonly viewerSeat: Seat;
  readonly interactionStatus: SeatInteractionStatus;
  readonly state: SeatVisibleMatchState;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * Closed seat-safe animation payload union generated from the exhaustive
 * projector below. Adding or changing a projected payload changes this union
 * at its sole construction boundary; generic JSON event bags are not allowed.
 */
export type SeatAnimationEvent = Exclude<
  ReturnType<typeof projectAnimationEventForSeat>,
  null
>;

export type SeatEntityRef =
  | { readonly kind: 'CARD'; readonly token: SeatCardToken }
  | { readonly kind: 'LOCATION'; readonly token: SeatLocationToken }
  | { readonly kind: 'LANE'; readonly laneId: LaneId }
  | { readonly kind: 'PLAYER'; readonly owner: Owner }
  | { readonly kind: 'ZONE'; readonly owner: Owner | null; readonly zone: string }
  | { readonly kind: 'SYSTEM'; readonly systemId: string }
  | {
      readonly kind: 'HIDDEN';
      readonly category: 'CARD' | 'LOCATION' | 'RULE';
    };

export type SeatAbilityRef =
  | {
      readonly kind: AbilityRef['kind'];
      readonly ruleId: string;
      readonly ruleIndex: number;
    }
  | { readonly kind: 'HIDDEN' };

export type SeatEffectTraceEntry =
  | {
      readonly kind: 'EFFECT_INVOCATION_STARTED';
      readonly invocationToken: string;
      readonly parentInvocationToken: string | null;
      readonly source: SeatEntityRef;
      readonly ability: SeatAbilityRef;
      readonly invocationReason:
        | 'NATURAL'
        | 'RETRIGGER'
        | 'REACTION'
        | 'SCHEDULED'
        | 'SYSTEM';
      readonly depth: number;
      readonly candidates: readonly SeatEntityRef[];
    }
  | {
      readonly kind: 'EFFECT_TARGET_RESOLVED';
      readonly invocationToken: string;
      readonly attemptToken: string;
      readonly attemptOrdinal: number;
      readonly operation: string;
      readonly target: SeatEntityRef;
      readonly result: EffectTargetResult;
      readonly blockedBy: readonly SeatEntityRef[];
      readonly reason: EffectOutcomeReason | null;
    }
  | {
      readonly kind: 'EFFECT_INVOCATION_COMPLETED';
      readonly invocationToken: string;
      readonly attempted: number;
      readonly affected: number;
      readonly blocked: number;
      readonly invalidated: number;
      readonly unchanged: number;
    };

export interface SeatPresentationFrame {
  readonly index: number;
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: SeatAnimationEvent | null;
  readonly effect: SeatEffectTraceEntry | null;
  readonly after: SeatVisibleMatchState;
}

export interface SeatPresentationBlock {
  readonly version: 2;
  readonly transactionId: string;
  readonly matchId: string;
  readonly viewerSeat: Seat;
  readonly basePublicRevision: number;
  readonly publicRevision: number;
  readonly firstFrame: Frame;
  readonly lastFrame: Frame;
  readonly preState: SeatVisibleMatchState;
  readonly frames: readonly SeatPresentationFrame[];
  readonly postState: SeatVisibleMatchState;
  readonly postStateHash: string;
}

/**
 * Short-lived player-facing presentation frame. It carries the canonical
 * gameplay coordinate but no canonical state, event, or engine identity.
 */
export interface SeatTransactionFrame {
  readonly index: number;
  readonly transactionId: string;
  readonly frame: Frame;
  readonly scope: TemporalScope;
  readonly event: SeatAnimationEvent | null;
  readonly before: SeatVisibleMatchState;
  readonly after: SeatVisibleMatchState;
}

/**
 * Local presentation wrapper over one committed transaction. Replay storage
 * continues to retain canonical framed events, never these materialized views.
 */
export interface SeatTransactionTimeline {
  readonly transactionId: string;
  readonly matchId: string;
  readonly baseRevision: PublicRevision;
  readonly revision: PublicRevision;
  readonly viewerSeat: Seat;
  readonly frames: readonly SeatTransactionFrame[];
  readonly finalState: SeatVisibleMatchState;
}

function opaqueToken(
  state: MatchState,
  viewerSeat: Seat,
  kind: 'card' | 'location',
  id: string,
): string {
  const [high, low] = cyrb128(
    `seat-token-v1|${state.rng.seed}|${viewerSeat}|${kind}|${id}`,
  );
  return `${kind === 'card' ? 'c' : 'l'}_${high.toString(16).padStart(8, '0')}`
    + low.toString(16).padStart(8, '0');
}

function cardToken(
  state: MatchState,
  viewerSeat: Seat,
  cardId: string,
): SeatCardToken {
  return opaqueToken(state, viewerSeat, 'card', cardId);
}

/**
 * Trusted authority-side lookup for converting an opaque player reference
 * back into a canonical card identity. Never expose this function or its
 * result through a player-facing context or protocol payload.
 */
export function resolveSeatCardTokenForAuthority(
  state: MatchState,
  viewerSeat: Seat,
  token: SeatCardToken,
): CardId | null {
  return getAllCardStates(state)
    .find(card => cardToken(state, viewerSeat, card.id) === token)
    ?.id ?? null;
}

function locationToken(
  state: MatchState,
  viewerSeat: Seat,
  locationId: string,
): SeatLocationToken {
  return opaqueToken(state, viewerSeat, 'location', locationId);
}

function cardIdentityVisible(
  state: MatchState,
  cardId: string,
  viewerSeat: Seat,
): boolean {
  const card = getAllCardStates(state)
    .find(candidate => candidate.id === cardId as CardId);
  return card !== undefined && (card.owner === viewerSeat || card.revealed);
}

function locationIdentityVisible(
  state: MatchState,
  locationId: string,
  viewerSeat: Seat,
): boolean {
  const location = getLocationState(
    state,
    locationId as LocationCardInstanceId,
  );
  return location !== null && (
    location.face === 'FACE_UP'
    || location.identityKnownTo.includes(viewerSeat)
  );
}

function effectToken(
  state: MatchState,
  viewerSeat: Seat,
  kind: 'invocation' | 'attempt',
  canonicalId: string,
): string {
  const [high, low] = cyrb128(
    `seat-effect-token-v2|${state.rng.seed}|${viewerSeat}|${kind}|${canonicalId}`,
  );
  return `${kind === 'invocation' ? 'i' : 'a'}_`
    + high.toString(16).padStart(8, '0')
    + low.toString(16).padStart(8, '0');
}

function cardPositionObservable(
  transition: CanonicalFrameTransition,
  cardId: CardId,
): boolean {
  const card = getAllCardStates(transition.after)
    .find(candidate => candidate.id === cardId)
    ?? getAllCardStates(transition.before)
      .find(candidate => candidate.id === cardId);
  return card !== undefined && card.zone !== 'DECK';
}

function locationPositionObservable(
  transition: CanonicalFrameTransition,
  locationId: LocationCardInstanceId,
): boolean {
  const location = getLocationState(transition.after, locationId)
    ?? getLocationState(transition.before, locationId);
  return location !== null && location.zone !== 'DECK';
}

function projectEntityRefForSeat(
  ref: CanonicalEntityRef,
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
): SeatEntityRef {
  switch (ref.kind) {
    case 'CARD':
      return cardPositionObservable(transition, ref.cardId)
        ? {
            kind: 'CARD',
            token: cardToken(transition.after, viewerSeat, ref.cardId),
          }
        : { kind: 'HIDDEN', category: 'CARD' };
    case 'LOCATION':
      return locationPositionObservable(transition, ref.locationId)
        ? {
            kind: 'LOCATION',
            token: locationToken(transition.after, viewerSeat, ref.locationId),
          }
        : { kind: 'HIDDEN', category: 'LOCATION' };
    case 'LANE':
      return { kind: 'LANE', laneId: ref.laneId };
    case 'PLAYER':
      return { kind: 'PLAYER', owner: ref.owner };
    case 'ZONE':
      return { kind: 'ZONE', owner: ref.owner, zone: ref.zone };
    case 'SYSTEM':
      return { kind: 'SYSTEM', systemId: ref.systemId };
  }
}

function entityIdentityVisible(
  ref: CanonicalEntityRef,
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
): boolean {
  switch (ref.kind) {
    case 'CARD':
      return cardIdentityVisible(transition.before, ref.cardId, viewerSeat)
        || cardIdentityVisible(transition.after, ref.cardId, viewerSeat);
    case 'LOCATION':
      return locationIdentityVisible(transition.before, ref.locationId, viewerSeat)
        || locationIdentityVisible(transition.after, ref.locationId, viewerSeat);
    case 'LANE':
    case 'PLAYER':
    case 'ZONE':
    case 'SYSTEM':
      return true;
  }
}

function projectAbilityForSeat(
  ability: AbilityRef,
  source: CanonicalEntityRef,
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
): SeatAbilityRef {
  if (!entityIdentityVisible(source, transition, viewerSeat)) {
    return { kind: 'HIDDEN' };
  }
  return {
    kind: ability.kind,
    ruleId: ability.ruleId,
    ruleIndex: ability.ruleIndex,
  };
}

export function projectEffectTraceForSeat(
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
): SeatEffectTraceEntry | null {
  const effect = transition.effect;
  if (effect === null) return null;
  const invocation = (canonicalId: string): string => effectToken(
    transition.after,
    viewerSeat,
    'invocation',
    canonicalId,
  );
  switch (effect.kind) {
    case 'EFFECT_INVOCATION_STARTED':
      return {
        kind: 'EFFECT_INVOCATION_STARTED',
        invocationToken: invocation(effect.invocationId),
        parentInvocationToken: effect.parentInvocationId === null
          ? null
          : invocation(effect.parentInvocationId),
        source: projectEntityRefForSeat(
          effect.source,
          transition,
          viewerSeat,
        ),
        ability: projectAbilityForSeat(
          effect.ability,
          effect.source,
          transition,
          viewerSeat,
        ),
        invocationReason: effect.invocationReason,
        depth: effect.depth,
        candidates: effect.candidates.map(candidate =>
          projectEntityRefForSeat(candidate, transition, viewerSeat)
        ),
      };
    case 'EFFECT_TARGET_RESOLVED':
      return {
        kind: 'EFFECT_TARGET_RESOLVED',
        invocationToken: invocation(effect.invocationId),
        attemptToken: effectToken(
          transition.after,
          viewerSeat,
          'attempt',
          effect.attemptId,
        ),
        attemptOrdinal: effect.attemptOrdinal,
        operation: effect.operation,
        target: projectEntityRefForSeat(
          effect.target,
          transition,
          viewerSeat,
        ),
        result: effect.result,
        blockedBy: effect.blockedBy.map(blocker =>
          projectEntityRefForSeat(blocker, transition, viewerSeat)
        ),
        reason: effect.reason,
      };
    case 'EFFECT_INVOCATION_COMPLETED':
      return {
        kind: 'EFFECT_INVOCATION_COMPLETED',
        invocationToken: invocation(effect.invocationId),
        attempted: effect.attempted,
        affected: effect.affected,
        blocked: effect.blocked,
        invalidated: effect.invalidated,
        unchanged: effect.unchanged,
      };
  }
}

function zoneTokens(
  state: MatchState,
  viewerSeat: Seat,
  owner: Owner,
  zone: 'DISCARD' | 'DESTROYED' | 'BANISHED',
): readonly SeatCardToken[] {
  return getAllCardStates(state)
    .filter(card => card.owner === owner && card.zone === zone)
    .map(card => cardToken(state, viewerSeat, card.id));
}

export function projectMatchStateForSeat(
  state: MatchState,
  viewerSeat: Seat,
  manifest: Manifest,
): SeatVisibleMatchState {
  const cards = getAllCardStates(state)
    .filter(card => card.zone !== 'DECK')
    .map((card): SeatVisibleCard => {
      const visible = card.owner === viewerSeat || card.revealed;
      const base: SeatVisibleCard = {
        token: cardToken(state, viewerSeat, card.id),
        owner: card.owner,
        zone: card.zone as SeatVisibleCard['zone'],
        lane: card.lane,
        revealed: card.revealed,
      };
      if (!visible) return base;
      return {
        ...base,
        defId: card.defId,
        ...(card.variantId === undefined ? {} : { variantId: card.variantId }),
        cost: getCardCost(state, card.id, manifest),
        power: getCardPower(state, card.id, manifest),
        ...(card.tags.length === 0 ? {} : {
          tags: card.tags.map(tag => tag.kind),
        }),
        ...(Object.keys(card.counters).length === 0 ? {} : {
          counters: Object.fromEntries(
            Object.entries(card.counters).map(([name, value]) => [name, value]),
          ),
        }),
      };
    });

  const lanes = state.activeLaneOrder.map((laneId): SeatVisibleLane => {
    const lane = state.lanesById[laneId];
    const locationId = lane.locationSlot.locationCardId;
    const location = locationId === null ? null : getLocationState(state, locationId);
    const identityVisible = location !== null && (
      location.face === 'FACE_UP'
      || location.identityKnownTo.includes(viewerSeat)
    );
    return {
      id: lane.id,
      status: lane.status,
      location: location === null ? null : {
        token: locationToken(state, viewerSeat, location.id),
        face: location.face,
        revealAtTurn: lane.locationSlot.revealAtTurn,
        ...(identityVisible ? { defId: location.defId } : {}),
      },
      cards: {
        P0: lane.cards.P0.map(id => cardToken(state, viewerSeat, id)),
        P1: lane.cards.P1.map(id => cardToken(state, viewerSeat, id)),
      },
      power: {
        P0: getLanePower(state, lane.id, 'P0', manifest),
        P1: getLanePower(state, lane.id, 'P1', manifest),
      },
    };
  });

  const banishedCounts = (owner: Owner): number => getAllCardStates(state)
    .filter(card => card.owner === owner && card.zone === 'BANISHED')
    .length;

  return {
    turn: state.turn,
    phase: state.phase,
    priority: state.priority,
    energy: { P0: state.energy.P0, P1: state.energy.P1 },
    maxEnergy: { P0: state.maxEnergy.P0, P1: state.maxEnergy.P1 },
    nextTurnEnergyBonus: {
      P0: state.nextTurnEnergyBonus.P0,
      P1: state.nextTurnEnergyBonus.P1,
    },
    deckCounts: { P0: state.deck.P0.length, P1: state.deck.P1.length },
    locationDeckCount: state.locationDeck.drawPile.length,
    hands: {
      P0: state.hand.P0.map(id => cardToken(state, viewerSeat, id)),
      P1: state.hand.P1.map(id => cardToken(state, viewerSeat, id)),
    },
    cards,
    lanes,
    stagedCards: state.stagedPlays.map(
      staged => cardToken(state, viewerSeat, staged.cardId),
    ),
    discard: {
      P0: zoneTokens(state, viewerSeat, 'P0', 'DISCARD'),
      P1: zoneTokens(state, viewerSeat, 'P1', 'DISCARD'),
    },
    destroyed: {
      P0: zoneTokens(state, viewerSeat, 'P0', 'DESTROYED'),
      P1: zoneTokens(state, viewerSeat, 'P1', 'DESTROYED'),
    },
    banished: {
      P0: zoneTokens(state, viewerSeat, 'P0', 'BANISHED'),
      P1: zoneTokens(state, viewerSeat, 'P1', 'BANISHED'),
    },
    banishedCounts: {
      P0: banishedCounts('P0'),
      P1: banishedCounts('P1'),
    },
    result: state.result === null ? null : {
      winner: state.result.winner,
      lanesWon: {
        P0: state.result.lanesWon.P0,
        P1: state.result.lanesWon.P1,
      },
      totalPower: {
        P0: state.result.totalPower.P0,
        P1: state.result.totalPower.P1,
      },
    },
  };
}

/**
 * Reapply the viewer's current private staging plan to an older projected
 * committed frame. This is projection composition only: it operates on
 * opaque seat tokens and never retains canonical state or transitions.
 */
export function overlaySeatPrivatePlan(
  committed: SeatVisibleMatchState,
  working: SeatVisibleMatchState,
  viewerSeat: Seat,
): SeatVisibleMatchState {
  const ownedStaged = working.stagedCards.filter(token =>
    working.cards.some(card =>
      card.token === token && card.owner === viewerSeat
    )
  );
  if (ownedStaged.length === 0) return committed;

  const staged = new Set(ownedStaged);
  const workingStagedCards = working.cards.filter(card =>
    staged.has(card.token)
  );
  const committedViewerStaged = new Set(
    committed.stagedCards.filter(token =>
      committed.cards.some(card =>
        card.token === token && card.owner === viewerSeat
      )
    ),
  );
  return {
    ...committed,
    energy: {
      ...committed.energy,
      [viewerSeat]: working.energy[viewerSeat],
    },
    hands: {
      ...committed.hands,
      [viewerSeat]: committed.hands[viewerSeat].filter(
        token => !staged.has(token),
      ),
    },
    cards: [
      ...committed.cards.filter(card => !staged.has(card.token)),
      ...workingStagedCards,
    ],
    lanes: committed.lanes.map(lane => {
      const stagedHere = workingStagedCards
        .filter(card => card.lane === lane.id)
        .map(card => card.token);
      return {
        ...lane,
        cards: {
          ...lane.cards,
          [viewerSeat]: [
            ...lane.cards[viewerSeat].filter(token => !staged.has(token)),
            ...stagedHere,
          ],
        },
        power: {
          ...lane.power,
          [viewerSeat]: working.lanes.find(
            candidate => candidate.id === lane.id,
          )?.power[viewerSeat] ?? lane.power[viewerSeat],
        },
      };
    }),
    stagedCards: [
      ...committed.stagedCards.filter(
        token => !committedViewerStaged.has(token),
      ),
      ...ownedStaged,
    ],
  };
}

export function projectSnapshotForSeat(
  matchId: string,
  publicRevision: PublicRevision,
  planRevision: PlanRevision,
  state: MatchState,
  viewerSeat: Seat,
  manifest: Manifest,
  interactionStatus: SeatInteractionStatus,
): SeatMatchSnapshot {
  return {
    version: 2,
    matchId,
    publicRevision,
    planRevision,
    frame: state.timeline.frame,
    viewerSeat,
    interactionStatus,
    state: projectMatchStateForSeat(state, viewerSeat, manifest),
  };
}

function cardEventVisible(
  transition: CanonicalFrameTransition,
  cardId: string,
  viewerSeat: Seat,
): boolean {
  return cardIdentityVisible(transition.before, cardId, viewerSeat)
    || cardIdentityVisible(transition.after, cardId, viewerSeat);
}

export function projectAnimationEventForSeat(
  transition: CanonicalFrameTransition,
  viewerSeat: Seat,
) {
  const event = transition.event;
  if (event === null) return null;
  const card = (id: string): SeatCardToken => cardToken(
    transition.after,
    viewerSeat,
    id,
  );
  const location = (id: string): SeatLocationToken => locationToken(
    transition.after,
    viewerSeat,
    id,
  );
  switch (event.type) {
    case 'GAMEPLAY_RNG_ADVANCED':
    case 'PENDING_EFFECT_SCHEDULED':
    case 'PENDING_EFFECT_CONSUMED':
    case 'OR_WINDOW_OPEN':
    case 'OR_WINDOW_CLOSE':
    case 'RECURSION_LIMIT_HIT':
    case 'INTENT_REJECTED':
      return null;

    case 'MATCH_SETUP_COMPLETED':
      return { type: event.type, data: {} };
    case 'TURN_RESOLUTION_STARTED':
    case 'TURN_ENDED':
      return { type: event.type, data: { turn: event.turn } };
    case 'TURN_STARTED':
      return {
        type: event.type,
        data: {
          turn: event.turn,
          priority: event.priority,
          priorityReason: event.priorityReason,
        },
      };
    case 'MATCH_ENDED':
      return { type: event.type, data: { result: event.result } };

    case 'ENERGY_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta, reason: event.reason },
      };
    case 'MAX_ENERGY_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta, reason: event.reason },
      };
    case 'NEXT_TURN_ENERGY_BONUS_CHANGED':
      return {
        type: event.type,
        data: { owner: event.owner, delta: event.delta },
      };

    case 'CARD_STAGED':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          lane: event.lane,
          owner: event.owner,
        },
      };
    case 'CARD_DRAWN':
      return {
        type: event.type,
        data: { owner: event.owner, card: card(event.cardId) },
      };
    case 'DECK_SHUFFLED':
      return { type: event.type, data: { owner: event.owner } };
    case 'CARD_CREATED': {
      const visible = event.owner === viewerSeat
        || cardEventVisible(transition, event.cardId, viewerSeat);
      return {
        type: event.type,
        data: {
          owner: event.owner,
          ...(event.destination.kind !== 'DECK' || event.owner === viewerSeat
            ? { card: card(event.cardId) }
            : {}),
          destination: event.destination,
          ...(visible ? { defId: event.defId } : {}),
        },
      };
    }

    case 'CARD_REVEALED': {
      const cardState = getAllCardStates(transition.after)
        .find(candidate => candidate.id === event.cardId);
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          ...(cardState ? { defId: cardState.defId } : {}),
        },
      };
    }
    case 'CARD_PLAY_COMPLETED':
      return {
        type: event.type,
        data: {
          owner: event.owner,
          lane: event.lane,
          card: card(event.cardId),
        },
      };
    case 'CARD_REVEAL_SCHEDULED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), timing: event.timing } }
        : null;
    case 'CARD_POWER_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), mutation: event.mutation } }
        : null;
    case 'CARD_COST_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), delta: event.delta } }
        : null;
    case 'CARD_DESTROYED':
    case 'CARD_BANISHED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId) } }
        : null;
    case 'CARD_DISCARDED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), reason: event.reason },
          }
        : null;
    case 'CARD_MOVED':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          fromLane: event.fromLane,
          toLane: event.toLane,
        },
      };
    case 'CARD_RETURNED_TO_LANE':
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          lane: event.lane,
          revealed: event.revealed,
        },
      };
    case 'CARD_TRANSFORMED': {
      const visible = cardEventVisible(transition, event.cardId, viewerSeat);
      return {
        type: event.type,
        data: {
          card: card(event.cardId),
          ...(visible
            ? {
                defId: event.newDefId,
                metadataPolicy: event.metadataPolicy,
              }
            : {}),
        },
      };
    }
    case 'CARD_TAG_ADDED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), tag: event.tag.kind } }
        : null;
    case 'CARD_TAG_REMOVED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId), tag: event.tag } }
        : null;
    case 'CARD_TEXT_OVERRIDDEN':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? { type: event.type, data: { card: card(event.cardId) } }
        : null;
    case 'CARD_COUNTER_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), name: event.name, delta: event.delta },
          }
        : null;
    case 'CARD_ZONE_CHANGED':
      return cardEventVisible(transition, event.cardId, viewerSeat)
        ? {
            type: event.type,
            data: { card: card(event.cardId), destination: event.destination },
          }
        : null;

    case 'LOCATION_DECK_INITIALIZED':
      return {
        type: event.type,
        data: { count: event.locations.length },
      };
    case 'LOCATION_CARD_CREATED':
    case 'LOCATION_CARD_DRAWN':
      return null;
    case 'LOCATION_CARD_PLAYED': {
      const visible = locationIdentityVisible(
        transition.after,
        event.locationId,
        viewerSeat,
      );
      const locationState = getLocationState(transition.after, event.locationId);
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          lane: event.lane,
          ...(visible && locationState ? { defId: locationState.defId } : {}),
        },
      };
    }
    case 'LOCATION_SLOT_REVEAL_SCHEDULED':
      return {
        type: event.type,
        data: { lane: event.lane, revealAtTurn: event.revealAtTurn },
      };
    case 'LOCATION_REVEALED': {
      const locationState = getLocationState(transition.after, event.locationId);
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          ...(locationState ? { defId: locationState.defId } : {}),
        },
      };
    }
    case 'LOCATION_TURNED_FACE_DOWN':
      return {
        type: event.type,
        data: { lane: event.lane, location: location(event.locationId) },
      };
    case 'LOCATION_SHOWN_TO_SEATS':
      if (!event.seats.includes(viewerSeat)) return null;
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          defId: getLocationState(transition.after, event.locationId)?.defId ?? '',
        },
      };
    case 'LOCATION_REPLACED': {
      const visible = locationIdentityVisible(
        transition.after,
        event.newId,
        viewerSeat,
      );
      return {
        type: event.type,
        data: {
          lane: event.lane,
          oldLocation: location(event.oldId),
          newLocation: location(event.newId),
          ...(visible ? { defId: event.newDefId } : {}),
          oldDestination: event.oldDestination,
          revealPolicy: event.revealPolicy,
          ...(event.revealAtTurn === undefined ? {} : {
            revealAtTurn: event.revealAtTurn,
          }),
        },
      };
    }
    case 'LOCATIONS_SWAPPED':
      return {
        type: event.type,
        data: {
          left: {
            location: location(event.left.locationId),
            fromLane: event.left.fromLane,
            toLane: event.left.toLane,
          },
          right: {
            location: location(event.right.locationId),
            fromLane: event.right.fromLane,
            toLane: event.right.toLane,
          },
        },
      };
    case 'LOCATION_MOVED':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          fromLane: event.fromLane,
          toLane: event.toLane,
        },
      };
    case 'LOCATION_REMOVED_FROM_LANE':
      return {
        type: event.type,
        data: {
          lane: event.lane,
          location: location(event.locationId),
          destination: event.destination,
        },
      };
    case 'LOCATION_RETURNED_TO_DECK':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          from: event.from,
          placement: event.placement,
        },
      };
    case 'LOCATION_TAG_ADDED':
      return {
        type: event.type,
        data: { location: location(event.locationId), tag: event.tag.kind },
      };
    case 'LOCATION_TAG_REMOVED':
      return {
        type: event.type,
        data: { location: location(event.locationId), tag: event.tag },
      };
    case 'LOCATION_COUNTER_CHANGED':
      return {
        type: event.type,
        data: {
          location: location(event.locationId),
          name: event.name,
          owner: event.owner,
          delta: event.delta,
        },
      };

    case 'LANE_DESTRUCTION_STARTED':
    case 'LANE_DESTROYED':
      return {
        type: event.type,
        data: { lane: event.lane, position: event.priorPosition },
      };
    case 'LANE_CREATION_STARTED':
    case 'LANE_CREATED':
      return {
        type: event.type,
        data: { lane: event.lane, position: event.position },
      };
  }
}

function stableSeatJson(value: unknown): string {
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, visit(child)]),
      );
    }
    return input;
  };
  return JSON.stringify(visit(value));
}

export function hashSeatVisibleState(state: SeatVisibleMatchState): string {
  const json = stableSeatJson(state);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function seatStatesEqual(
  left: SeatVisibleMatchState,
  right: SeatVisibleMatchState,
): boolean {
  return stableSeatJson(left) === stableSeatJson(right);
}

/**
 * Build one complete player delivery block from one canonical transaction.
 * Every player DTO is constructed field-by-field; canonical frames, events,
 * effect entries, entity references, and state objects are never forwarded.
 */
export function projectPresentationBlockForSeat(
  timeline: CommittedTransactionTimeline,
  viewerSeat: Seat,
  manifest: Manifest,
  projectAuthorityState: (state: MatchState) => MatchState = state => state,
): SeatPresentationBlock {
  const first = timeline.transitions[0];
  const last = timeline.transitions.at(-1);
  if (!first || !last) {
    throw new Error(
      'projectPresentationBlockForSeat: a committed transaction cannot be empty',
    );
  }
  if (
    timeline.transitions.length !== timeline.transaction.frames.length
    || timeline.transitions.some(transition => (
      transition.transactionId !== timeline.transaction.transactionId
    ))
  ) {
    throw new Error(
      `projectPresentationBlockForSeat: transitions do not match `
      + timeline.transaction.transactionId,
    );
  }

  const preState = projectMatchStateForSeat(
    projectAuthorityState(first.before),
    viewerSeat,
    manifest,
  );
  const frames: SeatPresentationFrame[] = [];
  for (const transition of timeline.transitions) {
    const event = projectAnimationEventForSeat(transition, viewerSeat);
    const effect = projectEffectTraceForSeat(transition, viewerSeat);
    const before = projectMatchStateForSeat(
      projectAuthorityState(transition.before),
      viewerSeat,
      manifest,
    );
    const after = projectMatchStateForSeat(
      projectAuthorityState(transition.after),
      viewerSeat,
      manifest,
    );
    if (event === null && effect === null && seatStatesEqual(before, after)) {
      continue;
    }
    frames.push({
      index: transition.index,
      frame: transition.frame,
      scope: {
        turn: transition.scope.turn,
        phase: transition.scope.phase,
      },
      event,
      effect,
      after,
    });
  }
  const postState = projectMatchStateForSeat(
    projectAuthorityState(last.after),
    viewerSeat,
    manifest,
  );
  const lastVisibleState = frames.at(-1)?.after ?? preState;
  if (!seatStatesEqual(lastVisibleState, postState)) {
    throw new Error(
      'projectPresentationBlockForSeat: visible frames do not reach postState',
    );
  }
  return {
    version: 2,
    transactionId: timeline.transaction.transactionId,
    matchId: timeline.transaction.matchId,
    viewerSeat,
    basePublicRevision: timeline.transaction.baseRevision,
    publicRevision: timeline.transaction.revision,
    firstFrame: first.frame,
    lastFrame: last.frame,
    preState,
    frames,
    postState,
    postStateHash: hashSeatVisibleState(postState),
  };
}

/**
 * Materialize the short-lived local presentation view of a committed
 * transaction. `projectAuthorityState` may overlay the viewer's private plan
 * while the runtime is synchronously publishing the transaction.
 */
export function projectTransactionTimelineForSeat(
  timeline: CommittedTransactionTimeline,
  viewerSeat: Seat,
  manifest: Manifest,
  projectAuthorityState: (state: MatchState) => MatchState = state => state,
): SeatTransactionTimeline {
  const frames = timeline.transitions.map(
    (transition): SeatTransactionFrame => ({
      index: transition.index,
      transactionId: transition.transactionId,
      frame: transition.frame,
      scope: {
        turn: transition.scope.turn,
        phase: transition.scope.phase,
      },
      event: projectAnimationEventForSeat(transition, viewerSeat),
      before: projectMatchStateForSeat(
        projectAuthorityState(transition.before),
        viewerSeat,
        manifest,
      ),
      after: projectMatchStateForSeat(
        projectAuthorityState(transition.after),
        viewerSeat,
        manifest,
      ),
    }),
  );
  const finalState = frames.at(-1)?.after;
  if (!finalState) {
    throw new Error(
      'projectTransactionTimelineForSeat: a committed transaction cannot be empty',
    );
  }
  return {
    transactionId: timeline.transaction.transactionId,
    matchId: timeline.transaction.matchId,
    baseRevision: timeline.transaction.baseRevision,
    revision: timeline.transaction.revision,
    viewerSeat,
    frames,
    finalState,
  };
}

/**
 * Client-side presentation adapter for the current animation director.
 *
 * The wire contract delivers complete SeatPresentationBlocks. The animation
 * system still consumes before/after frame timelines, so this function
 * reconstructs that short-lived shape from the already-redacted block without
 * asking the authority for canonical state.
 */
export function seatPresentationBlockToTransactionTimeline(
  block: SeatPresentationBlock,
): SeatTransactionTimeline {
  let before = block.preState;
  const frames = block.frames.map((projected): SeatTransactionFrame => {
    const frame = {
      index: projected.index,
      transactionId: block.transactionId,
      frame: projected.frame,
      scope: projected.scope,
      event: projected.event,
      before,
      after: projected.after,
    };
    before = projected.after;
    return frame;
  });
  const lastVisibleState = frames.at(-1)?.after ?? block.preState;
  if (!seatStatesEqual(lastVisibleState, block.postState)) {
    throw new Error(
      'seatPresentationBlockToTransactionTimeline: visible frames do not reach postState',
    );
  }
  if (hashSeatVisibleState(block.postState) !== block.postStateHash) {
    throw new Error(
      'seatPresentationBlockToTransactionTimeline: post-state checksum mismatch',
    );
  }
  return {
    transactionId: block.transactionId,
    matchId: block.matchId,
    baseRevision: block.basePublicRevision,
    revision: block.publicRevision,
    viewerSeat: block.viewerSeat,
    frames,
    finalState: block.postState,
  };
}

/**
 * Client-side authoritative correction after animating a projected batch.
 * Filtered frame numbers may contain gaps because authority-only events are
 * intentionally absent.
 */
export function applySeatPresentationBlock(
  snapshot: SeatMatchSnapshot,
  block: SeatPresentationBlock,
): SeatMatchSnapshot {
  if (
    block.matchId !== snapshot.matchId
    || block.viewerSeat !== snapshot.viewerSeat
  ) {
    throw new Error('applySeatPresentationBlock: match or seat mismatch');
  }
  if (
    block.basePublicRevision !== snapshot.publicRevision
    || block.publicRevision !== block.basePublicRevision + 1
  ) {
    throw new Error(
      `applySeatPresentationBlock: stale or invalid public revision `
      + `${block.basePublicRevision}->${block.publicRevision} after ${snapshot.publicRevision}`,
    );
  }
  if (block.firstFrame <= snapshot.frame || block.lastFrame < block.firstFrame) {
    throw new Error('applySeatPresentationBlock: invalid frame range');
  }
  let previousFrame = snapshot.frame;
  for (const projected of block.frames) {
    if (
      projected.frame <= previousFrame
      || projected.frame < block.firstFrame
      || projected.frame > block.lastFrame
    ) {
      throw new Error(
        `applySeatPresentationBlock: invalid projected frame ${projected.frame}`,
      );
    }
    previousFrame = projected.frame;
  }
  if (!seatStatesEqual(snapshot.state, block.preState)) {
    throw new Error('applySeatPresentationBlock: pre-state mismatch');
  }
  if (hashSeatVisibleState(block.postState) !== block.postStateHash) {
    throw new Error('applySeatPresentationBlock: post-state checksum mismatch');
  }
  const lastVisibleState = block.frames.at(-1)?.after ?? block.preState;
  if (!seatStatesEqual(lastVisibleState, block.postState)) {
    throw new Error('applySeatPresentationBlock: visible frames do not reach post-state');
  }
  return {
    version: 2,
    matchId: snapshot.matchId,
    publicRevision: block.publicRevision,
    planRevision: snapshot.planRevision,
    frame: block.lastFrame,
    viewerSeat: snapshot.viewerSeat,
    interactionStatus: block.postState.result === null ? 'PLANNING' : 'TERMINAL',
    state: block.postState,
  };
}

/**
 * Server-controller-only mechanical view. This is not serializable wire data.
 * It preserves the engine shape required by AI planning while redacting
 * hidden location identity and future location order.
 */
export function projectMechanicalStateForController(
  state: MatchState,
  controllerSeat: Seat,
): MatchState {
  return redactLocationsForSeat(state, controllerSeat);
}
