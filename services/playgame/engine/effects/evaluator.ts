/**
 * Effect evaluator + OR cascade. See spec §6.
 *
 * Contract:
 *   evalEffect(state, effect, ctx, manifest) → { events, state }
 *   revealPlayedCard(state, cardId, manifest, rng) → { events, state }
 *   triggerOnReveal(state, cardId, manifest, rng) → { events, state }
 *
 * Both return BOTH the emitted events AND the post-event state. Effects
 * mutate-by-emission: they produce a MatchEvent list AND apply each one
 * as they go (so SPAWN_AND_REVEAL can recurse into the fresh card).
 *
 * Determinism: every effect-time randomness point forks `ctx.rng` with a
 * unique tag derived from (source, effect idx, iteration count). Same
 * seed + same call path → identical events on every JS runtime.
 */

import type { EffectExpr, EffectRef, PoolRef, Selector } from '../types/ability';
import type { MatchState, SpawnSource } from '../types/state';
import type { CardId, LaneIdx, Owner } from '../types/ids';
import type { MatchEvent } from '../types/events';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import { apply } from '../apply';
import { select, selectLanes } from '../projections/select';
import { evalNum } from '../projections/numexpr';
import { evalPredicate } from '../projections/select';
import { type EvalCtx } from '../projections/context';
import { collectAllOngoings, ongoingsTargeting, sourceCtx } from '../projections/ongoing';
import { getOnRevealMultiplier, isOnRevealDisabled, isRevealDelayed } from '../projections/reveal';
import { findLanes } from '../projections/query';
import { isPowerBearingCard } from '../projections/power-bearing';
import { pickDefIdFromPool, resolveOwnerRef } from './pools';
import { invokeBuiltin } from './builtins';

export const MAX_REVEAL_RECURSION = 16;

/** Names of per-card triggered ability slots that fire outside the reveal
 *  cascade. Each slot is a `readonly EffectExpr[]` on `CardAbilities`. */
type TriggerSlot = 'onMove' | 'onDestroyed' | 'onDiscarded' | 'onAnyCardPlayedHere';
type LocationTriggerSlot = 'atTurnStart' | 'atTurnEnd' | 'onCardPlayedHere' | 'onCardEnteredHere' | 'onCardDestroyedHere';

/**
 * Fire a named trigger slot for one card, with a frozen self-context
 * (useful when the underlying card has been moved/destroyed/discarded
 * and we still need to resolve SELF-relative selectors against its
 * state at event time). Returns the concatenated events + final state.
 *
 * Depth is inherited + 1 from `parentDepth` so triggered cascades
 * respect the same recursion cap as the OR evaluator.
 */
function fireCardTrigger(
  state: MatchState,
  cardId: CardId,
  selfLane: LaneIdx | null,
  selfOwner: Owner | null,
  slot: TriggerSlot,
  parentRng: Rng,
  parentDepth: number,
  manifest: Manifest,
): EvalResult {
  const card = state.cards[cardId];
  if (!card) return { events: [], state };
  const def = manifest.cards[card.defId];
  const effs = def?.abilities[slot];
  if (!effs || effs.length === 0) return { events: [], state };
  if (parentDepth >= MAX_REVEAL_RECURSION) {
    const diag: MatchEvent = { type: 'RECURSION_LIMIT_HIT', cardId, depth: parentDepth };
    return { events: [diag], state: apply(state, diag, manifest) };
  }
  const events: MatchEvent[] = [];
  let s = state;
  for (let j = 0; j < effs.length; j++) {
    const subCtx: EffectCtx = {
      state: s,
      manifest,
      self: cardId,
      selfKind: 'card',
      selfLane,
      selfOwner,
      rng: parentRng.fork(`${slot}:${cardId}:${j}`),
      source: { sourceId: cardId, effectKind: 'ON_REVEAL', exprIdx: j },
      depth: parentDepth + 1,
    };
    const res = evalEffect(s, effs[j], subCtx, manifest);
    events.push(...res.events);
    s = res.state;
  }
  return { events, state: s };
}

export function fireLocationTrigger(
  state: MatchState,
  lane: LaneIdx,
  slot: LocationTriggerSlot,
  parentRng: Rng,
  manifest: Manifest,
  eventCard: CardId | null = null,
  eventOwner: Owner | null = eventCard ? state.cards[eventCard]?.owner ?? null : null,
  parentDepth: number = 0,
): EvalResult {
  const loc = state.lanes[lane].location;
  if (!loc || !state.lanes[lane].locationRevealed) return { events: [], state };
  const locDef = manifest.locations[loc.defId];
  const effs = locDef?.abilities[slot];
  if (!effs || effs.length === 0) return { events: [], state };

  const events: MatchEvent[] = [];
  let s = state;
  for (let j = 0; j < effs.length; j++) {
    const subCtx: EffectCtx = {
      state: s,
      manifest,
      self: loc.id,
      selfKind: 'location',
      selfLane: lane,
      selfOwner: null,
      eventCard,
      eventLane: lane,
      eventOwner,
      rng: parentRng.fork(`${slot}:${loc.id}:${j}`),
      source: { sourceId: loc.id, effectKind: 'LOCATION', exprIdx: j },
      depth: parentDepth,
    };
    const res = evalEffect(s, effs[j], subCtx, manifest);
    events.push(...res.events);
    s = res.state;
  }
  return { events, state: s };
}

/** Extra fields carried during effect evaluation, on top of EvalCtx. */
export interface EffectCtx extends EvalCtx {
  /** Forked Rng owned by THIS effect invocation. Always defined during
   *  effect evaluation (unlike raw EvalCtx where it's optional). */
  readonly rng: Rng;
  /** Where this effect originated (for CARD_* event `cause` fields). */
  readonly source: EffectRef;
  /** OR recursion depth. Incremented on nested reveal calls. */
  readonly depth: number;
}

export interface EvalResult {
  readonly events: readonly MatchEvent[];
  readonly state: MatchState;
}

// ============================================================================
// Reveal cascade
// ============================================================================

type CardRevealOptions = {
  readonly ignoreDelay: boolean;
  readonly firePlayedTriggers: boolean;
};

function banishResolvedSpell(state: MatchState, cardId: CardId, manifest: Manifest): EvalResult {
  const card = state.cards[cardId];
  const def = card ? manifest.cards[card.defId] : undefined;
  if (!card || !def || def.cardType !== 'spell' || card.zone !== 'LANE') {
    return { events: [], state };
  }
  const banish: MatchEvent = {
    type: 'CARD_BANISHED',
    cardId,
    cause: { sourceId: cardId, effectKind: 'SYSTEM', systemReason: 'SPELL_RESOLVED' },
  };
  return { events: [banish], state: apply(state, banish, manifest) };
}

/**
 * Reveal a newly-played/spawned card. This is the full "card was played here"
 * path: flip, fire On Reveal, then notify card/location played-here triggers.
 */
export function revealPlayedCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  return resolveCardReveal(state, cardId, manifest, rng, depth, {
    ignoreDelay: false,
    firePlayedTriggers: true,
  });
}

/**
 * End-game reveal for delayed cards. It ignores DELAY_REVEAL but still counts
 * as the card's real played reveal, so played-here triggers fire afterward.
 */
export function forceRevealPlayedCard(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  return resolveCardReveal(state, cardId, manifest, rng, depth, {
    ignoreDelay: true,
    firePlayedTriggers: true,
  });
}

/**
 * Re-fire a card's On Reveal text without making "card played here" listeners
 * see a second play. This is the Odin/Backdoor-style path.
 */
export function triggerOnReveal(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  return resolveCardReveal(state, cardId, manifest, rng, depth, {
    ignoreDelay: false,
    firePlayedTriggers: false,
  });
}

/**
 * Core reveal implementation: fire a card's On Reveal abilities
 * OR-multiplier-many times, threading events+state through the recursion.
 * Emits OR_WINDOW bracket events and a CARD_FLIPPED if the card wasn't
 * already revealed.
 *
 * Upstream callers (Step 7's resolveTurn) iterate over pending cards in
 * priority order and invoke revealPlayedCard per card. The depth cap protects
 * against pathological spawn loops (Sera → Sera → ...).
 */
function resolveCardReveal(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number,
  options: CardRevealOptions,
): EvalResult {
  const card = state.cards[cardId];
  if (!card) return { events: [], state };

  if (!options.ignoreDelay && !card.revealed && isRevealDelayed(state, cardId, manifest)) {
    return { events: [], state };
  }

  // Cosmo-style suppression: silently drop the OR, no window, no flip.
  // Spec §6.1: the card still flips face-up in real Snap, but its
  // abilities don't fire. We emit CARD_FLIPPED for the face-up flip and
  // skip the rest.
  const suppressed = isOnRevealDisabled(state, cardId, manifest);

  const events: MatchEvent[] = [];
  let s = state;

  // Flip face-up if needed (even when suppressed).
  if (!card.revealed) {
    const flip: MatchEvent = { type: 'CARD_FLIPPED', cardId };
    events.push(flip);
    s = apply(s, flip, manifest);
  }

  if (suppressed) {
    const spellCleanup = banishResolvedSpell(s, cardId, manifest);
    events.push(...spellCleanup.events);
    s = spellCleanup.state;
    return { events, state: s };
  }

  const def = manifest.cards[card.defId];
  const onReveal = def?.abilities.onReveal ?? [];
  if (onReveal.length === 0) {
    // No OR abilities, but `onAnyCardPlayedHere` on OTHER same-lane cards
    // must still fire — "played" = revealed, independent of the revealing
    // card's own abilities.
    if (options.firePlayedTriggers) {
      const post = fireOnAnyCardPlayedHere(s, cardId, rng, depth, manifest);
      events.push(...post.events);
      s = post.state;
    }
    const spellCleanup = banishResolvedSpell(s, cardId, manifest);
    events.push(...spellCleanup.events);
    s = spellCleanup.state;
    return { events, state: s };
  }

  // Depth cap — emit a diagnostic and return without firing any effects.
  if (depth >= MAX_REVEAL_RECURSION) {
    const diag: MatchEvent = { type: 'RECURSION_LIMIT_HIT', cardId, depth };
    events.push(diag);
    s = apply(s, diag, manifest);
    return { events, state: s };
  }

  const orMult = getOnRevealMultiplier(s, cardId, manifest);

  const open: MatchEvent = { type: 'OR_WINDOW_OPEN', cardId, multiplier: orMult };
  events.push(open);
  s = apply(s, open, manifest);

  // OR multiplier semantics (spec §5.3): the WHOLE ability list repeats
  // orMult times. Sera-style chains are modeled with SPAWN_AND_REVEAL
  // inside an ability, not by mutating the outer loop.
  for (let rep = 0; rep < orMult; rep++) {
    for (let idx = 0; idx < onReveal.length; idx++) {
      const effect = onReveal[idx];
      const subRng = rng.fork(`or:${cardId}:rep${rep}:eff${idx}`);
      const ctx: EffectCtx = {
        state: s,  // snapshot; evalEffect doesn't actually read this field
                   // because it receives state as its first arg.
        manifest,
        self: cardId,
        selfKind: 'card',
        selfLane: s.cards[cardId]?.lane ?? null,
        selfOwner: s.cards[cardId]?.owner ?? null,
        rng: subRng,
        source: { sourceId: cardId, effectKind: 'ON_REVEAL', exprIdx: idx },
        depth,
      };
      const res = evalEffect(s, effect, ctx, manifest);
      events.push(...res.events);
      s = res.state;
    }
  }

  const close: MatchEvent = { type: 'OR_WINDOW_CLOSE', cardId };
  events.push(close);
  s = apply(s, close, manifest);

  if (options.firePlayedTriggers) {
    const post = fireOnAnyCardPlayedHere(s, cardId, rng, depth, manifest);
    events.push(...post.events);
    s = post.state;
  }

  const spellCleanup = banishResolvedSpell(s, cardId, manifest);
  events.push(...spellCleanup.events);
  s = spellCleanup.state;

  return { events, state: s };
}

/**
 * Fire `onAnyCardPlayedHere` for every OTHER revealed card in the same
 * lane as `cardId`. "Played" in Snap means revealed, so this is the
 * correct firing point — invoked whenever a card is newly revealed,
 * whether or not that card has its own On Reveal abilities.
 */
function fireOnAnyCardPlayedHere(
  state: MatchState,
  cardId: CardId,
  parentRng: Rng,
  parentDepth: number,
  manifest: Manifest,
): EvalResult {
  const flipped = state.cards[cardId];
  const lane = flipped?.lane;
  if (!flipped || lane === null || lane === undefined) {
    return { events: [], state };
  }
  const events: MatchEvent[] = [];
  let s = state;
  const laneState = s.lanes[lane];
  for (const owner of ['P0', 'P1'] as const) {
    for (const id of laneState.cards[owner]) {
      if (id === cardId) continue;
      const other = s.cards[id];
      if (!other || !other.revealed) continue;
      const trig = fireCardTrigger(
        s, id, lane, owner,
        'onAnyCardPlayedHere',
        parentRng.fork(`onPlay:${cardId}:${id}`),
        parentDepth,
        manifest,
      );
      events.push(...trig.events);
      s = trig.state;
    }
  }
  const locTrig = fireLocationTrigger(
    s,
    lane,
    'onCardPlayedHere',
    parentRng.fork(`locOnPlay:${cardId}:${lane}`),
    manifest,
    cardId,
    flipped.owner,
    parentDepth,
  );
  events.push(...locTrig.events);
  s = locTrig.state;
  return { events, state: s };
}

// ============================================================================
// evalEffect — one case per EffectExpr variant
// ============================================================================

export function evalEffect(
  state: MatchState,
  effect: EffectExpr,
  ctx: EffectCtx,
  manifest: Manifest,
): EvalResult {
  // Refresh selfLane/selfOwner off the live state each call — they can
  // change mid-cascade (e.g. after a MOVE emits CARD_MOVED on SELF).
  //
  // EXCEPTION: if the card is in a terminal zone (DESTROYED/DISCARD/
  // BANISHED), `liveSelf.lane` is null but the FROZEN `ctx.selfLane`
  // (captured by the trigger before the lifecycle event) still reflects
  // the card's board position at the moment the effect was scheduled.
  // Preserving it is what makes deathrattles / on-discard-in-lane work.
  const self = ctx.self as CardId | null;
  const liveSelf = self ? state.cards[self] : null;
  const onBoard = liveSelf && liveSelf.lane !== null;
  const liveCtx: EffectCtx = liveSelf
    ? {
        ...ctx,
        state,
        selfLane: onBoard ? liveSelf.lane : ctx.selfLane,
        selfOwner: liveSelf.owner,
      }
    : { ...ctx, state };

  switch (effect.kind) {
    // ---- Power math ------------------------------------------------------

    case 'ADD_POWER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const perTargetCtx: EffectCtx = {
          ...liveCtx,
          state: s,
          self: id,
          selfKind: 'card',
          selfLane: s.cards[id]?.lane ?? null,
          selfOwner: s.cards[id]?.owner ?? null,
        };
        const delta = evalNum(effect.delta, perTargetCtx);
        if (delta === 0) continue;
        if (delta > 0 && isPowerIncreaseBlocked(s, id, manifest)) continue;
        const e: MatchEvent = {
          type: 'CARD_POWER_CHANGED',
          cardId: id,
          delta,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'SET_POWER': {
      // "Set your power to N": compute delta = N - (base + powerDelta).
      // Ongoing buffs are not subtracted — they layer on top of the new base.
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const card = s.cards[id];
        const def = card ? manifest.cards[card.defId] : undefined;
        if (!card || !def) continue;
        const value = evalNum(effect.value, { ...liveCtx, state: s, self: id });
        const currentBase = def.basePower + card.powerDelta;
        const delta = value - currentBase;
        if (delta === 0) continue;
        if (delta > 0 && isPowerIncreaseBlocked(s, id, manifest)) continue;
        const e: MatchEvent = {
          type: 'CARD_POWER_CHANGED',
          cardId: id,
          delta,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'ADJUST_COST': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const perTargetCtx: EffectCtx = {
          ...liveCtx,
          state: s,
          self: id,
          selfKind: 'card',
          selfLane: s.cards[id]?.lane ?? null,
          selfOwner: s.cards[id]?.owner ?? null,
        };
        const delta = evalNum(effect.delta, perTargetCtx);
        if (delta === 0) continue;
        const e: MatchEvent = {
          type: 'CARD_COST_CHANGED',
          cardId: id,
          delta,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    // ---- Lifecycle -------------------------------------------------------

    case 'DESTROY': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const preCard = s.cards[id];
        const preLane = preCard?.lane ?? null;
        const preOwner = preCard?.owner ?? null;
        if (preCard?.tags.some(t => t.kind === 'DESTROY_IMMUNE')) continue;
        if (isFriendlyDestroyBlocked(s, id, ctx, manifest)) continue;
        const e: MatchEvent = { type: 'CARD_DESTROYED', cardId: id, cause: ctx.source };
        events.push(e);
        s = apply(s, e, manifest);
        // Fire onDestroyed for this card, anchored to its pre-destroy lane
        // so SELF-relative selectors still resolve meaningfully.
        const trig = fireCardTrigger(s, id, preLane, preOwner, 'onDestroyed', ctx.rng, ctx.depth, manifest);
        events.push(...trig.events);
        s = trig.state;
        if (preLane !== null) {
          const locTrig = fireLocationTrigger(
            s,
            preLane,
            'onCardDestroyedHere',
            ctx.rng.fork(`locDestroyed:${id}`),
            manifest,
            id,
            preOwner,
          );
          events.push(...locTrig.events);
          s = locTrig.state;
        }
      }
      return { events, state: s };
    }

    case 'BANISH': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const e: MatchEvent = { type: 'CARD_BANISHED', cardId: id, cause: ctx.source };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'DISCARD': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const preCard = s.cards[id];
        const preOwner = preCard?.owner ?? null;
        const e: MatchEvent = {
          type: 'CARD_DISCARDED',
          cardId: id,
          reason: 'FORCED_EFFECT',
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
        // Discard happens from hand, so selfLane is null.
        const trig = fireCardTrigger(s, id, null, preOwner, 'onDiscarded', ctx.rng, ctx.depth, manifest);
        events.push(...trig.events);
        s = trig.state;
      }
      return { events, state: s };
    }

    case 'MOVE': {
      const targets = select(effect.target, liveCtx);
      const destLanes = selectLanes(effect.to, liveCtx);
      if (destLanes.length === 0) return { events: [], state };
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card || card.lane === null) continue;
        if (isMoveBlocked(s, id, manifest)) continue;
        // Per-target destination: forked off ctx.rng so two simultaneous
        // MOVEs don't collide deterministic-stream-wise.
        const subRng = ctx.rng.fork(`move:${id}`);
        // Valid destination = candidate lane, not current lane, has capacity for owner.
        const filtered = findLanes(s, manifest, {
          idx: destLanes,
          hasCapacity: card.owner,
          not: { idx: card.lane },
        });
        if (filtered.length === 0) continue;
        const toLane = filtered.length === 1 ? filtered[0] : subRng.pick(filtered);
        const e: MatchEvent = {
          type: 'CARD_MOVED',
          cardId: id,
          fromLane: card.lane,
          toLane,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
        const locTrig = fireLocationTrigger(
          s,
          toLane,
          'onCardEnteredHere',
          ctx.rng.fork(`locEnteredMove:${id}`),
          manifest,
          id,
          card.owner,
        );
        events.push(...locTrig.events);
        s = locTrig.state;
        // Fire onMove; the card is now in `toLane` so selfLane resolves to it.
        const trig = fireCardTrigger(s, id, toLane, card.owner, 'onMove', ctx.rng, ctx.depth, manifest);
        events.push(...trig.events);
        s = trig.state;
      }
      return { events, state: s };
    }

    // ---- Deck / hand plumbing --------------------------------------------

    case 'DRAW': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const count = Math.max(0, Math.floor(evalNum(effect.count, liveCtx)));
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < count; i++) {
        const deck = s.deck[owner];
        if (deck.length === 0) break;
        const top = deck[0]; // top-of-deck is index 0; DECK_SHUFFLED
                              // established that convention.
        if (s.hand[owner].length >= manifest.constants.handCap) break;
        const e: MatchEvent = {
          type: 'CARD_DRAWN',
          owner,
          cardId: top.id,
          toHand: true,
        };
        events.push(e);
        s = apply(s, e, manifest);
        const debuff = applyHandEntryDebuffs(s, top.id, owner, ctx.rng.fork(`debuff:${top.id}`), manifest);
        events.push(...debuff.events);
        s = debuff.state;
      }
      return { events, state: s };
    }

    case 'CREATE_CARD_IN_ZONE': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const defId = pickDefIdFromPool(effect.pool, state, manifest, ctx.selfOwner, ctx.rng.fork('pool'), ctx.eventOwner ?? null);
      if (!defId) return { events: [], state };
      const newId = mintCardId(ctx.rng.fork('id'));
      const spawnSource: SpawnSource = spawnSourceForSource(ctx.source, owner === ctx.selfOwner);

      switch (effect.destination.kind) {
        case 'HAND': {
          if (state.hand[owner].length >= manifest.constants.handCap) return { events: [], state };
          const e: MatchEvent = {
            type: 'CARD_ADDED_TO_HAND',
            owner,
            cardId: newId,
            defId,
            spawnSource,
          };
          let s = apply(state, e, manifest);
          const debuff = applyHandEntryDebuffs(s, newId, owner, ctx.rng.fork('debuff'), manifest);
          s = debuff.state;
          return { events: [e, ...debuff.events], state: s };
        }

        case 'DECK': {
          const e: MatchEvent = {
            type: 'CARD_ADDED_TO_DECK',
            owner,
            cardId: newId,
            defId,
            spawnSource,
            position: effect.destination.position,
          };
          return { events: [e], state: apply(state, e, manifest) };
        }

        case 'LANE': {
          const lanes = selectLanes(effect.destination.lane, liveCtx);
          if (lanes.length === 0) return { events: [], state };
          const lane = lanes.length === 1 ? lanes[0] : ctx.rng.fork('lane').pick(lanes);
          if (state.lanes[lane].cards[owner].length >= manifest.constants.laneCapacity) return { events: [], state };
          const e: MatchEvent = {
            type: 'CARD_ADDED_TO_LANE',
            owner,
            cardId: newId,
            lane,
            defId,
            spawnSource,
          };
          const s = apply(state, e, manifest);
          const locTrig = fireLocationTrigger(
            s,
            lane,
            'onCardEnteredHere',
            ctx.rng.fork(`locEnteredCreate:${newId}`),
            manifest,
            newId,
            owner,
          );
          return { events: [e, ...locTrig.events], state: locTrig.state };
        }

        default:
          return { events: [], state };
      }
    }

    case 'MOVE_CARD_TO_ZONE': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card) continue;

        if (effect.destination.kind === 'LANE') {
          const lanes = selectLanes(effect.destination.lane, { ...liveCtx, state: s });
          if (lanes.length === 0) continue;
          const lane = lanes.length === 1 ? lanes[0] : ctx.rng.fork(`moveZone:${id}`).pick(lanes);
          if (s.lanes[lane].cards[card.owner].length >= manifest.constants.laneCapacity) continue;
          const e: MatchEvent = {
            type: 'CARD_MOVED_TO_ZONE',
            cardId: id,
            destination: { kind: 'LANE', lane, revealed: effect.destination.revealed },
            cause: ctx.source,
          };
          events.push(e);
          s = apply(s, e, manifest);
          const locTrig = fireLocationTrigger(
            s,
            lane,
            'onCardEnteredHere',
            ctx.rng.fork(`locEnteredMoveZone:${id}`),
            manifest,
            id,
            card.owner,
          );
          events.push(...locTrig.events);
          s = locTrig.state;
          continue;
        }

        if (effect.destination.kind === 'HAND' && s.hand[card.owner].length >= manifest.constants.handCap) continue;
        const e: MatchEvent = {
          type: 'CARD_MOVED_TO_ZONE',
          cardId: id,
          destination: effect.destination,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
        if (effect.destination.kind === 'HAND') {
          const debuff = applyHandEntryDebuffs(s, id, card.owner, ctx.rng.fork(`debuffMoveZone:${id}`), manifest);
          events.push(...debuff.events);
          s = debuff.state;
        }
      }
      return { events, state: s };
    }

    case 'SPAWN_AND_REVEAL': {
      // CREATE_CARD_IN_ZONE(LANE) + immediate recursive reveal. Classic Jubilee
      // /Bar-Sinister-spawned-card flow.
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const lanes = selectLanes(effect.to, liveCtx);
      if (lanes.length === 0) return { events: [], state };
      const lane = lanes.length === 1 ? lanes[0] : ctx.rng.fork('lane').pick(lanes);
      if (state.lanes[lane].cards[owner].length >= manifest.constants.laneCapacity) {
        return { events: [], state };
      }
      const defId = pickDefIdFromPool(effect.pool, state, manifest, ctx.selfOwner, ctx.rng.fork('pool'), ctx.eventOwner ?? null);
      if (!defId) return { events: [], state };
      const newId = mintCardId(ctx.rng.fork('id'));
      const spawnSource: SpawnSource = spawnSourceForSource(ctx.source, owner === ctx.selfOwner);
      const spawnEvt: MatchEvent = {
        type: 'CARD_ADDED_TO_LANE',
        owner,
        cardId: newId,
        lane,
        defId,
        spawnSource,
      };
      let s = apply(state, spawnEvt, manifest);
      const events: MatchEvent[] = [spawnEvt];
      const locTrig = fireLocationTrigger(
        s,
        lane,
        'onCardEnteredHere',
        ctx.rng.fork(`locEnteredSpawn:${newId}`),
        manifest,
        newId,
        owner,
      );
      events.push(...locTrig.events);
      s = locTrig.state;
      const nested = revealPlayedCard(s, newId, manifest, ctx.rng.fork(`reveal:${newId}`), ctx.depth + 1);
      events.push(...nested.events);
      s = nested.state;
      return { events, state: s };
    }

    case 'RETURN_TO_LANE': {
      const targets = select(effect.target, liveCtx);
      const lanes = selectLanes(effect.to, liveCtx);
      if (lanes.length === 0) return { events: [], state };
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card) continue;
        const candidates = findLanes(s, manifest, {
          idx: lanes,
          hasCapacity: card.owner,
        });
        if (candidates.length === 0) continue;
        const lane = candidates.length === 1 ? candidates[0] : ctx.rng.fork(`return:${id}`).pick(candidates);
        const e: MatchEvent = {
          type: 'CARD_RETURNED_TO_LANE',
          cardId: id,
          lane,
          revealed: effect.revealed ?? true,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
        const locTrig = fireLocationTrigger(
          s,
          lane,
          'onCardEnteredHere',
          ctx.rng.fork(`locEnteredReturn:${id}`),
          manifest,
          id,
          card.owner,
        );
        events.push(...locTrig.events);
        s = locTrig.state;
      }
      return { events, state: s };
    }

    case 'TRANSFORM_CARD': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card) continue;
        const defId = pickDefIdFromPool(effect.pool, s, manifest, card.owner, ctx.rng.fork(`transform:${id}`), ctx.eventOwner ?? null);
        if (!defId || defId === card.defId) continue;
        const e: MatchEvent = {
          type: 'CARD_TRANSFORMED',
          cardId: id,
          oldDefId: card.defId,
          newDefId: defId,
          cause: ctx.source,
          resetStats: effect.resetStats,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'TRIGGER_ON_REVEAL': {
      // Fires OR of some OTHER already-in-play card (Odin, Vision).
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const subRng = ctx.rng.fork(`trigger:${id}`);
        const nested = triggerOnReveal(s, id, manifest, subRng, ctx.depth + 1);
        events.push(...nested.events);
        s = nested.state;
      }
      return { events, state: s };
    }

    // ---- Tags / counters / location mutations ----------------------------

    case 'ADD_CARD_TAG': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      const runtimeTag = resolveCardTagSpec(effect.tag, ctx.source);
      if (!runtimeTag) return { events, state };
      for (const id of targets) {
        const e: MatchEvent = { type: 'CARD_TAG_ADDED', cardId: id, tag: runtimeTag };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'REMOVE_CARD_TAG': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const e: MatchEvent = {
          type: 'CARD_TAG_REMOVED',
          cardId: id,
          tag: effect.tag as never, // narrowed by tag registry at authoring time
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'ADD_LOCATION_TAG': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const lane of lanes) {
        const e: MatchEvent = { type: 'LOCATION_TAG_ADDED', lane, tag: effect.tag };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'REPLACE_LOCATION': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const lane of lanes) {
        const prev = s.lanes[lane].location;
        if (!prev) continue;
        const newId = `loc-${lane}-${ctx.rng.fork(`replace:${lane}`).int(0, 2 ** 30).toString(36)}` as import('../types/ids').LocationId;
        const e: MatchEvent = {
          type: 'LOCATION_REPLACED',
          lane,
          oldId: prev.id,
          newId,
          newDefId: effect.newDefId,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'MODIFY_COUNTER': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const delta = evalNum(effect.delta, { ...liveCtx, state: s, self: id });
        if (delta === 0) continue;
        const e: MatchEvent = {
          type: 'CARD_COUNTER_CHANGED',
          cardId: id,
          name: effect.name,
          delta,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'MODIFY_LOCATION_COUNTER': {
      const lanes = selectLanes(effect.lane, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      const owner = effect.owner ? resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null) : undefined;
      if (effect.owner && !owner) return { events, state };
      for (const lane of lanes) {
        const delta = Math.trunc(evalNum(effect.delta, { ...liveCtx, state: s }));
        if (delta === 0) continue;
        const e: MatchEvent = {
          type: 'LOCATION_COUNTER_CHANGED',
          lane,
          name: effect.name,
          ...(owner ? { owner } : {}),
          delta,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'COPY_TEXT_OF': {
      const into = select(effect.into, liveCtx);
      const source = select(effect.source, liveCtx);
      if (source.length === 0) return { events: [], state };
      const srcCard = state.cards[source[0]];
      if (!srcCard) return { events: [], state };
      const copyKind = effect.copyKind ?? 'FULL';
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of into) {
        const override = copyKind === 'ON_REVEAL'
          ? { kind: 'COPY_ON_REVEAL_OF_CARD' as const, cardId: source[0] }
          : { kind: 'COPY_OF_CARD' as const, cardId: source[0] };
        const e: MatchEvent = {
          type: 'CARD_TEXT_OVERRIDDEN',
          cardId: id,
          override,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'RESET_POWER': {
      // Restore powerDelta to 0 by emitting a negating CARD_POWER_CHANGED.
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        if (!isPowerBearingCard(s, id, manifest)) continue;
        const card = s.cards[id];
        if (!card || card.powerDelta === 0) continue;
        const e: MatchEvent = {
          type: 'CARD_POWER_CHANGED',
          cardId: id,
          delta: -card.powerDelta,
          cause: ctx.source,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'REMOVE_TEXT': {
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card) continue;
        const textKind = effect.textKind;
        const override = textKind === 'ONGOING' ? { kind: 'BLANK_ONGOING' as const }
                       : textKind === 'ALL'     ? { kind: 'BLANK_ALL' as const }
                       : null; // 'ON_REVEAL' — no TextOverride kind for that yet; skip
        if (!override) continue;
        const e: MatchEvent = {
          type: 'CARD_TEXT_OVERRIDDEN',
          cardId: id,
          override,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'REMOVE_COPIED_TEXT': {
      // Clear any COPY_OF_CARD / COPY_ON_REVEAL_OF_CARD text override.
      const targets = select(effect.target, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (const id of targets) {
        const card = s.cards[id];
        if (!card) continue;
        const ov = card.textOverride;
        if (!ov || (ov.kind !== 'COPY_OF_CARD' && ov.kind !== 'COPY_ON_REVEAL_OF_CARD')) continue;
        const e: MatchEvent = {
          type: 'CARD_TEXT_OVERRIDDEN',
          cardId: id,
          override: null,
        };
        events.push(e);
        s = apply(s, e, manifest);
      }
      return { events, state: s };
    }

    case 'ADD_PENDING': {
      const runtime = resolvePendingEffectSpec(effect.effect, ctx, state);
      if (!runtime) return { events: [], state };
      const e: MatchEvent = { type: 'PENDING_EFFECT_ADDED', effect: runtime };
      return { events: [e], state: apply(state, e, manifest) };
    }

    // ---- Control flow ----------------------------------------------------

    case 'SEQUENCE': {
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < effect.items.length; i++) {
        const sub = effect.items[i];
        const subCtx: EffectCtx = { ...ctx, rng: ctx.rng.fork(`seq${i}`) };
        const res = evalEffect(s, sub, subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
      return { events, state: s };
    }

    case 'CONDITIONAL': {
      const branch = evalPredicate(effect.if, liveCtx) ? effect.then : (effect.else ?? []);
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < branch.length; i++) {
        const sub = branch[i];
        const subCtx: EffectCtx = { ...ctx, rng: ctx.rng.fork(`cond${i}`) };
        const res = evalEffect(s, sub, subCtx, manifest);
        events.push(...res.events);
        s = res.state;
      }
      return { events, state: s };
    }

    case 'FOREACH': {
      const iter = select(effect.over, liveCtx);
      const events: MatchEvent[] = [];
      let s = state;
      for (let i = 0; i < iter.length; i++) {
        const it = iter[i];
        for (let j = 0; j < effect.do.length; j++) {
          const sub = effect.do[j];
          const iterCard = s.cards[it];
          const subCtx: EffectCtx = {
            ...ctx,
            state: s,
            self: it,
            selfKind: 'card',
            selfLane: iterCard?.lane ?? null,
            selfOwner: iterCard?.owner ?? null,
            it,
            rng: ctx.rng.fork(`fe:${it}:${j}`),
          };
          const res = evalEffect(s, sub, subCtx, manifest);
          events.push(...res.events);
          s = res.state;
        }
      }
      return { events, state: s };
    }

    // ---- Energy ----------------------------------------------------------

    case 'ADJUST_ENERGY': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'ENERGY_CHANGED', owner, delta, reason: 'EFFECT', cause: ctx.source };
      return { events: [e], state: apply(state, e, manifest) };
    }

    case 'ADJUST_MAX_ENERGY': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'MAX_ENERGY_CHANGED', owner, delta, reason: 'EFFECT' };
      return { events: [e], state: apply(state, e, manifest) };
    }

    case 'ADJUST_NEXT_TURN_ENERGY_BONUS': {
      const owner = resolveOwnerRef(effect.owner, ctx.selfOwner, ctx.eventOwner ?? null);
      if (!owner) return { events: [], state };
      const delta = Math.trunc(evalNum(effect.delta, liveCtx));
      if (delta === 0) return { events: [], state };
      const e: MatchEvent = { type: 'NEXT_TURN_ENERGY_BONUS_CHANGED', owner, delta };
      return { events: [e], state: apply(state, e, manifest) };
    }

    // ---- Escape hatch ----------------------------------------------------

    case 'CALL_BUILTIN':
      return invokeBuiltin(state, effect.fn, effect.args ?? {}, ctx, manifest);
  }
}

/** Apply DEBUFF_ENEMY_ON_HAND_ENTRY ongoings to a card that just entered hand.
 *  Call after every CARD_DRAWN / CARD_ADDED_TO_HAND event is applied. */
export function applyHandEntryDebuffs(
  state: MatchState,
  cardId: CardId,
  newOwner: Owner,
  rng: Rng,
  manifest: Manifest,
): { events: MatchEvent[]; state: MatchState } {
  if (!isPowerBearingCard(state, cardId, manifest)) return { events: [], state };
  const oppOwner: Owner = newOwner === 'P0' ? 'P1' : 'P0';
  const events: MatchEvent[] = [];
  let s = state;
  for (const card of Object.values(s.cards)) {
    if (!card || card.owner !== oppOwner || card.zone !== 'LANE' || !card.revealed) continue;
    const def = manifest.cards[card.defId];
    if (!def) continue;
    for (const expr of def.abilities.ongoing ?? []) {
      const b = expr as any;
      if (b.kind !== 'CALL_BUILTIN' || b.fn !== 'DEBUFF_ENEMY_ON_HAND_ENTRY') continue;
      const delta: number = b.args?.delta ?? -1;
      if (delta === 0) continue;
      const e: MatchEvent = {
        type: 'CARD_POWER_CHANGED',
        cardId,
        delta,
        cause: { sourceId: card.id, effectKind: 'ONGOING' },
      };
      events.push(e);
      s = apply(s, e, manifest);
    }
  }
  return { events, state: s };
}

// ============================================================================
// Helpers
// ============================================================================

function isMoveBlocked(state: MatchState, cardId: CardId, manifest: Manifest): boolean {
  return ongoingsTargeting(state, manifest, cardId)
    .some(entry => entry.expr.kind === 'BLOCK_MOVE');
}

function isPowerIncreaseBlocked(state: MatchState, cardId: CardId, manifest: Manifest): boolean {
  return ongoingsTargeting(state, manifest, cardId)
    .some(entry => entry.expr.kind === 'BLOCK_POWER_INCREASE');
}

function effectSourceOwner(state: MatchState, source: EffectRef): Owner | null {
  const sourceCard = state.cards[source.sourceId as CardId];
  return sourceCard?.owner ?? null;
}

function isFriendlyDestroyBlocked(
  state: MatchState,
  victimId: CardId,
  ctx: EffectCtx,
  manifest: Manifest,
): boolean {
  const victim = state.cards[victimId];
  if (!victim || victim.lane === null) return false;

  const destroySourceOwner = effectSourceOwner(state, ctx.source);
  if (destroySourceOwner === null) return false;

  for (const entry of collectAllOngoings(state, manifest)) {
    if (entry.expr.kind !== 'BLOCK_FRIENDLY_DESTROY') continue;
    if (entry.sourceOwner === null) continue;
    if (entry.sourceOwner !== victim.owner) continue;
    if (entry.sourceOwner !== destroySourceOwner) continue;

    const ongoingCtx = sourceCtx(entry, state, manifest);
    if (!ongoingCtx) continue;
    if (selectLanes(entry.expr.laneOf, ongoingCtx).includes(victim.lane)) {
      return true;
    }
  }

  return false;
}

/**
 * Compose a SpawnSource for cards minted by an effect.
 * - Location-sourced effects → LOCATION_CREATED
 * - Card-sourced effects on your side → CARD_CREATED
 * - Card-sourced effects placing on opp's side → ENEMY_CREATED
 */
function spawnSourceForSource(source: EffectRef, toOurSide: boolean): SpawnSource {
  if (source.effectKind === 'LOCATION') {
    return { kind: 'LOCATION_CREATED', sourceLocationId: source.sourceId as import('../types/ids').LocationId };
  }
  const sourceCardId = source.sourceId as CardId;
  return toOurSide
    ? { kind: 'CARD_CREATED', sourceCardId }
    : { kind: 'ENEMY_CREATED', sourceCardId };
}

/**
 * Resolve an authoring-time CardTagSpec into a runtime CardTag by
 * dereferencing any `sourceRef` fields against the active source.
 * Returns null when the spec requires a source the ctx can't supply
 * (e.g. location-sourced ONGOING_DISABLED with sourceRef='SELF').
 */
function resolveCardTagSpec(
  spec: import('../types/ability').CardTagSpec,
  source: EffectRef,
): import('../types/state').CardTag | null {
  switch (spec.kind) {
    case 'MOVED_THIS_TURN':
    case 'DESTROYED_THIS_TURN':
    case 'SHURI_DOUBLED':
      return { kind: spec.kind };
    case 'ONGOING_DISABLED':
      return { kind: 'ONGOING_DISABLED', sourceId: source.sourceId as CardId };
    case 'FROM_SPAWN':
      return { kind: 'FROM_SPAWN', sourceId: source.sourceId as CardId };
    case 'DESTROY_IMMUNE':
      return { kind: 'DESTROY_IMMUNE' };
  }
}

/**
 * Resolve an authoring-time PendingEffectSpec into a runtime PendingEffect
 * by filling in owner/lane/sourceId from the source card's context.
 */
function resolvePendingEffectSpec(
  spec: import('../types/ability').PendingEffectSpec,
  ctx: EffectCtx,
  state: MatchState,
): import('../types/state').PendingEffect | null {
  const sourceId = ctx.source.sourceId as CardId;
  const sourceCard = state.cards[sourceId];
  const owner = ctx.selfOwner ?? sourceCard?.owner ?? null;
  const lane = ctx.selfLane ?? sourceCard?.lane ?? null;
  switch (spec.kind) {
    case 'SHURI_DOUBLE_NEXT':
    case 'COULSON_TRIGGER_NEXT':
      if (owner === null || lane === null) return null;
      return { kind: spec.kind, owner, lane, sourceId };
    case 'EGO_OVERRIDE':
      // Authoring-time spec has no turn; default to current + 1 (next turn).
      return { kind: 'EGO_OVERRIDE', turn: state.turn + 1 };
    case 'RICKETY_BRIDGE_DESTROY':
      if (lane === null) return null;
      return { kind: 'RICKETY_BRIDGE_DESTROY', lane, atEndOfTurn: state.turn };
    case 'SCHEDULED':
      // Freeze sourceOwner/sourceLane at authoring time so the scheduled
      // effect resolves SELF-relative selectors correctly even if the
      // source card moves or is destroyed before it fires.
      return {
        kind: 'SCHEDULED',
        when: spec.when,
        sourceId,
        sourceOwner: owner,
        sourceLane: lane,
        fireTurn: state.turn + 1,
        effect: spec.effect,
      };
  }
}

/** Generate a deterministic fresh card id from an rng fork. */
function mintCardId(rng: Rng): CardId {
  const a = rng.int(0, 2 ** 31 - 1).toString(36);
  const b = rng.int(0, 2 ** 31 - 1).toString(36);
  return `c-${a}${b}` as CardId;
}

/**
 * Unused helper exported for parity with spec vocabulary — future callers
 * (Step 7) may want to test lane resolution independently.
 * eslint: keep named export to satisfy downstream imports.
 */
export function resolveLaneDestination(
  sel: Selector,
  ctx: EvalCtx,
  rng: Rng,
): LaneIdx | null {
  const lanes = selectLanes(sel, { ...ctx, rng });
  if (lanes.length === 0) return null;
  return lanes.length === 1 ? lanes[0] : rng.pick(lanes);
}

// Parameter export for debugging callers.
export type { PoolRef, Owner };
