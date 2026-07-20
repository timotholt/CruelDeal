import type { EffectExpr, EffectRef } from '../types/ability';
import type { CardId } from '../types/ids';
import type { Manifest } from '../manifest/types';
import type { Rng } from '../rng';
import type { MatchState } from '../types/state';
import {
  executeCanonicalRulesWork,
  executeRulesCommands,
  type EffectCtx,
  type EvalResult,
} from '../effects/rulesInterpreter';
import type {
  CanonicalEffectContext,
  CanonicalRulesWork,
} from '../kernel/rulesTransaction';
import { getCardRuntime } from '../projections/cardRuntime';

function canonicalContext(ctx: EffectCtx): CanonicalEffectContext {
  return {
    self: ctx.self,
    selfKind: ctx.selfKind,
    selfLane: ctx.selfLane,
    selfOwner: ctx.selfOwner,
    eventCard: ctx.eventCard ?? null,
    eventLane: ctx.eventLane ?? null,
    eventOwner: ctx.eventOwner ?? null,
    ...(ctx.it === undefined ? {} : { it: ctx.it }),
    source: { ...ctx.source },
    depth: ctx.depth,
    scopePath: [],
  } as CanonicalEffectContext;
}

/**
 * Test-only authored-effect entrypoint. It seeds the canonical work queue
 * directly so unit tests can isolate an expression without restoring the
 * deleted production evaluator path.
 */
export function executeEffectForTest(
  state: MatchState,
  effect: EffectExpr,
  ctx: EffectCtx,
  manifest: Manifest,
): EvalResult {
  const work: CanonicalRulesWork = {
    kind: 'EFFECT',
    effect,
    context: canonicalContext(ctx),
    depth: ctx.depth,
  };
  return executeCanonicalRulesWork(
    state,
    [work],
    { rng: ctx.rng, depth: ctx.depth },
    manifest,
  );
}

/**
 * Test-only real reveal path. Product turn flow constructs this command at
 * its scheduling boundary instead of calling a manual trigger helper.
 */
export function executeCardRevealForTest(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
  rng: Rng,
  depth: number = 0,
): EvalResult {
  const card = getCardRuntime(state, cardId, manifest);
  if (!card || card.lane === null) {
    return {
      events: [],
      state,
      transitions: [],
      usage: {
        workItemsConsumed: 0,
        eventsProduced: 0,
        reactionsScheduled: 0,
        createdEntities: 0,
        maximumEffectDepth: 0,
      },
    };
  }
  const cause: EffectRef = {
    sourceId: cardId,
    effectKind: 'SYSTEM',
    reason: card.lifecycle.framePlayed === undefined
      ? 'SCHEDULED_REVEAL'
      : 'COMMITTED_HAND_PLAY',
  };
  return executeRulesCommands(
    state,
    [
      card.lifecycle.framePlayed === undefined
        ? {
            type: 'REVEAL_CARD',
            cardId,
            depth,
            cleanupSpell: true,
            cause,
          }
        : {
            type: 'PLAY_CARD',
            cardId,
            lane: card.lane,
            depth,
            cause,
          },
    ],
    { rng, depth },
    manifest,
  );
}
