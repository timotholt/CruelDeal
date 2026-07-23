import type { EffectRef } from '../types/ability';
import type {
  AbilityRef,
  CanonicalEntityRef,
  EffectInvocationReason,
} from '../types/effectTrace';
import type { CardId, LocationCardInstanceId } from '../types/ids';
import type { GameCommand } from './types';
import type {
  CanonicalEffectContext,
  CanonicalRulesEffect,
  CanonicalRulesWork,
} from './rulesTransaction';
import type { KernelWorkExpansion } from './kernel';
import type { KernelEffectInvocationDescriptor } from './resolutionTrace';

function sourceRef(context: CanonicalEffectContext): CanonicalEntityRef {
  if (context.selfKind === 'card' && context.self !== null) {
    return { kind: 'CARD', cardId: context.self as CardId };
  }
  if (context.selfKind === 'location' && context.self !== null) {
    return {
      kind: 'LOCATION',
      locationId: context.self as LocationCardInstanceId,
    };
  }
  return { kind: 'SYSTEM', systemId: String(context.source.sourceId) };
}

function abilityKind(
  source: EffectRef,
): AbilityRef['kind'] {
  switch (source.effectKind) {
    case 'ON_REVEAL':
      return 'ON_REVEAL';
    case 'ONGOING':
      return 'ONGOING';
    case 'LOCATION':
      return 'LOCATION';
    case 'SYSTEM':
      return 'SYSTEM';
  }
}

function invocationReason(source: EffectRef): EffectInvocationReason {
  if (source.reason === 'RETRIGGER') return 'RETRIGGER';
  if (source.reason === 'NATURAL_REVEAL') return 'NATURAL';
  if (source.reason.startsWith('pending:')) return 'SCHEDULED';
  if (source.effectKind === 'SYSTEM') return 'SYSTEM';
  return 'REACTION';
}

function commandTarget(command: GameCommand): CanonicalEntityRef | null {
  switch (command.type) {
    case 'STAGE_PLAY':
    case 'PLAY_CARD':
    case 'SET_CARD_REVEAL_TIMING':
    case 'REVEAL_CARD':
    case 'MOVE_CARD':
    case 'DESTROY_CARD':
    case 'BANISH_CARD':
    case 'RETURN_CARD':
    case 'CHANGE_CARD_ZONE':
    case 'INVOKE_ON_REVEAL':
    case 'INVOKE_CARD_TRIGGER':
    case 'DISCARD_CARD':
    case 'CHANGE_STORED_POWER':
    case 'CHANGE_COST':
    case 'CHANGE_CARD_TAG':
    case 'CHANGE_CARD_COUNTER':
    case 'OVERRIDE_CARD_TEXT':
    case 'TRANSFORM_CARD':
      return { kind: 'CARD', cardId: command.cardId };

    case 'CREATE_CARD':
      return { kind: 'CARD', cardId: command.cardId };

    case 'DRAW_CARD':
    case 'CHANGE_ENERGY':
      return { kind: 'PLAYER', owner: command.owner };

    case 'DEPLOY_FROM_DECK':
      return { kind: 'ZONE', owner: command.owner, zone: 'DECK' };

    case 'INVOKE_LOCATION_TRIGGER':
    case 'CREATE_LOCATION_CARD':
    case 'DRAW_LOCATION_CARD':
    case 'PLAY_LOCATION_CARD':
    case 'SCHEDULE_LOCATION_REVEAL':
    case 'REVEAL_LOCATION':
    case 'TURN_LOCATION_FACE_DOWN':
    case 'SHOW_LOCATION_TO_SEATS':
    case 'MOVE_LOCATION':
    case 'REMOVE_LOCATION':
    case 'RETURN_LOCATION_TO_DECK':
      return { kind: 'LOCATION', locationId: command.locationId };

    case 'CHANGE_LOCATION_TAG':
    case 'CHANGE_LOCATION_COUNTER':
      return { kind: 'LOCATION', locationId: command.locationId };

    case 'SWAP_LOCATIONS':
      return { kind: 'LANE', laneId: command.leftLane };

    case 'REPLACE_LOCATION':
      return { kind: 'LOCATION', locationId: command.oldId };

    case 'CREATE_LANE':
      return null;

    case 'DESTROY_LANE':
      return { kind: 'LANE', laneId: command.lane };

    case 'DESTROY_OTHER_LANES':
      return { kind: 'LANE', laneId: command.survivor };

    case 'SCHEDULE_PENDING_EFFECT':
    case 'CONSUME_PENDING_EFFECT':
    case 'INITIALIZE_LOCATION_DECK':
    case 'COMPLETE_SETUP':
    case 'BEGIN_RESOLUTION':
    case 'END_TURN':
    case 'START_TURN':
    case 'END_MATCH':
      return null;
  }
}

function candidateRefs(
  expansion: KernelWorkExpansion<CanonicalRulesWork>,
): readonly CanonicalEntityRef[] {
  const seen = new Set<string>();
  const refs: CanonicalEntityRef[] = [];
  for (const item of expansion.work) {
    if (item.kind !== 'COMMAND') continue;
    const ref = commandTarget(item.command);
    if (!ref) continue;
    const key = JSON.stringify(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

/**
 * Compile engine-owned authored-effect context into invocation metadata.
 * Card/location content never constructs this descriptor.
 */
function isInternalRulesEffect(effect: CanonicalRulesEffect): boolean {
  return effect.kind === 'RESOLVE_STAGED_REVEAL_TIMING'
    || effect.kind === 'COMPLETE_PLAY'
    || effect.kind === 'SPELL_CLEANUP'
    || effect.kind === 'AWARD_POWER_FOR_DESTROYED_CARDS'
    || effect.kind === 'CHANGE_STORED_POWER_IF_CARD_ZONE';
}

/**
 * Compile every rules-effect execution into one invocation boundary.
 *
 * Control-flow children and engine continuations are genuine nested
 * invocations. Without their own boundary, their target attempts would be
 * incorrectly appended to the parent's immutable candidate snapshot.
 */
export function describeRulesEffectInvocation(
  work: {
    readonly effect: CanonicalRulesEffect;
    readonly context: CanonicalEffectContext;
  },
  expansion: KernelWorkExpansion<CanonicalRulesWork>,
): KernelEffectInvocationDescriptor {
  const internal = isInternalRulesEffect(work.effect);
  const source = 'source' in work.context
    ? work.context.source as EffectRef | undefined
    : undefined;
  if (!internal && source === undefined) {
    throw new Error('Authored rules effect is missing its source context.');
  }
  const ruleIndex = source?.exprIdx ?? 0;
  return {
    kind: 'EFFECT_INVOCATION',
    source: source === undefined
      ? { kind: 'SYSTEM', systemId: `internal:${work.effect.kind}` }
      : sourceRef(work.context),
    ability: internal
      ? {
          kind: 'SYSTEM',
          ruleId: `SYSTEM:${work.effect.kind}`,
          ruleIndex: 0,
        }
      : {
          kind: abilityKind(source!),
          ruleId: `${source!.effectKind}:${ruleIndex}`,
          ruleIndex,
        },
    invocationReason: internal ? 'REACTION' : invocationReason(source!),
    candidates: candidateRefs(expansion),
  };
}
