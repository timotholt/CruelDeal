import { registeredBuiltinNames } from '../effects/builtins';
import type {
  CardAbilities,
  LocationAbilities,
  Manifest,
} from './types';

const CARD_ABILITY_SLOTS = new Set<keyof CardAbilities>([
  'onReveal',
  'ongoing',
  'activate',
  'onEndOfTurn',
  'onTurnStart',
  'onMove',
  'onDestroyed',
  'onDiscarded',
  'onAnyCardPlayedHere',
]);

const LOCATION_ABILITY_SLOTS = new Set<keyof LocationAbilities>([
  'onReveal',
  'ongoing',
  'atTurnStart',
  'atTurnEnd',
  'onCardPlayedHere',
  'onCardEnteredHere',
  'onCardDestroyedHere',
  'onCardBanishedHere',
]);

const EFFECT_KINDS = new Set([
  'ADD_POWER',
  'SET_POWER',
  'ADJUST_COST',
  'RESET_POWER',
  'DESTROY',
  'DESTROY_OTHER_LANES',
  'BANISH',
  'MOVE',
  'DRAW',
  'DISCARD',
  'CREATE_CARD_IN_ZONE',
  'MOVE_CARD_TO_ZONE',
  'RETURN_TO_LANE',
  'TRANSFORM_CARD',
  'SCHEDULE_REVEAL',
  'COPY_TEXT_OF',
  'REMOVE_TEXT',
  'REMOVE_COPIED_TEXT',
  'ADD_PENDING',
  'ADD_CARD_TAG',
  'REMOVE_CARD_TAG',
  'ADD_LOCATION_TAG',
  'REPLACE_LOCATION',
  'MODIFY_COUNTER',
  'MODIFY_LOCATION_COUNTER',
  'ADJUST_ENERGY',
  'ADJUST_MAX_ENERGY',
  'ADJUST_NEXT_TURN_ENERGY_BONUS',
  'CALL_BUILTIN',
  'TRIGGER_ON_REVEAL',
  'SPAWN_AND_REVEAL',
  'SEQUENCE',
  'CONDITIONAL',
  'FOREACH',
]);

const ONGOING_KINDS = new Set([
  'POWER_ADD',
  'COST_ADD',
  'LANE_POWER_ADD',
  'LANE_POWER_MULTIPLIER',
  'EXTEND_GAME_TURNS',
  'ON_REVEAL_MULTIPLIER',
  'BOOST_ONGOINGS',
  'DISABLE_ON_REVEAL',
  'DISABLE_ONGOING',
  'BLOCK_PLAY',
  'BLOCK_MOVE',
  'BLOCK_POWER_INCREASE',
  'BLOCK_DESTROY',
  'BLOCK_FRIENDLY_DESTROY',
  'COPY_ONGOING_OF',
  'CALL_BUILTIN',
]);

export type ImplementationIssueCode =
  | 'DISABLED'
  | 'UNKNOWN_ABILITY_SLOT'
  | 'UNKNOWN_EFFECT_KIND'
  | 'UNKNOWN_ONGOING_KIND'
  | 'UNKNOWN_BUILTIN'
  | 'CONFLICTING_CREATED_COST_MUTATION';

export interface ImplementationIssue {
  readonly entity: 'card' | 'location';
  readonly defId: string;
  readonly code: ImplementationIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface ImplementationAuditReport {
  readonly implementedCardIds: readonly string[];
  readonly implementedLocationIds: readonly string[];
  readonly vanillaCardIds: readonly string[];
  readonly issueCardIds: readonly string[];
  readonly issueLocationIds: readonly string[];
  readonly issues: readonly ImplementationIssue[];
}

type Entity = ImplementationIssue['entity'];
type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

function inspectEffect(
  value: unknown,
  entity: Entity,
  defId: string,
  path: string,
  builtinNames: ReadonlySet<string>,
  issues: ImplementationIssue[],
): void {
  const effect = record(value);
  const kind = effect?.kind;
  if (!effect || typeof kind !== 'string' || !EFFECT_KINDS.has(kind)) {
    issues.push({
      entity,
      defId,
      code: 'UNKNOWN_EFFECT_KIND',
      path,
      message: `no effect evaluator is registered for ${String(kind)}`,
    });
    return;
  }

  if (kind === 'CALL_BUILTIN') {
    const fn = effect.fn;
    if (typeof fn !== 'string' || !builtinNames.has(fn)) {
      issues.push({
        entity,
        defId,
        code: 'UNKNOWN_BUILTIN',
        path: `${path}.fn`,
        message: `no CALL_BUILTIN handler is registered for ${String(fn)}`,
      });
    }
  }
  if (kind === 'CREATE_CARD_IN_ZONE' && effect.setCost && effect.adjustCost) {
    issues.push({
      entity,
      defId,
      code: 'CONFLICTING_CREATED_COST_MUTATION',
      path,
      message: 'CREATE_CARD_IN_ZONE cannot setCost and adjustCost together',
    });
  }

  const nested = kind === 'SEQUENCE'
    ? effect.items
    : kind === 'CONDITIONAL'
      ? [
          ...(Array.isArray(effect.then) ? effect.then : []),
          ...(Array.isArray(effect.else) ? effect.else : []),
        ]
      : kind === 'FOREACH'
        ? effect.do
        : kind === 'ADD_PENDING'
          && record(effect.effect)?.kind === 'SCHEDULED'
          ? record(effect.effect)?.effect
          : [];
  const nestedEffects = Array.isArray(nested) ? nested : [nested];
  nestedEffects.forEach((child, index) =>
    inspectEffect(
      child,
      entity,
      defId,
      `${path}.${kind.toLowerCase()}[${index}]`,
      builtinNames,
      issues,
    ));
}

function inspectAbilities(
  entity: Entity,
  defId: string,
  abilities: UnknownRecord,
  allowedSlots: ReadonlySet<string>,
  builtinNames: ReadonlySet<string>,
  issues: ImplementationIssue[],
): boolean {
  let hasAbility = false;
  for (const [slot, expressions] of Object.entries(abilities)) {
    if (!allowedSlots.has(slot)) {
      issues.push({
        entity,
        defId,
        code: 'UNKNOWN_ABILITY_SLOT',
        path: `abilities.${slot}`,
        message: `unknown ${entity} ability slot ${slot}`,
      });
      continue;
    }
    if (!Array.isArray(expressions) || expressions.length === 0) continue;
    hasAbility = true;
    expressions.forEach((expression, index) => {
      const kind = record(expression)?.kind;
      if (slot === 'ongoing') {
        if (typeof kind !== 'string' || !ONGOING_KINDS.has(kind)) {
          issues.push({
            entity,
            defId,
            code: 'UNKNOWN_ONGOING_KIND',
            path: `abilities.${slot}[${index}]`,
            message: `no Ongoing projection is registered for ${String(kind)}`,
          });
          return;
        }
        if (kind === 'CALL_BUILTIN') {
          const fn = record(expression)?.fn;
          if (typeof fn !== 'string' || !builtinNames.has(fn)) {
            issues.push({
              entity,
              defId,
              code: 'UNKNOWN_BUILTIN',
              path: `abilities.${slot}[${index}].fn`,
              message: `no Ongoing CALL_BUILTIN handler is registered for ${String(fn)}`,
            });
          }
        }
        return;
      }
      inspectEffect(
        expression,
        entity,
        defId,
        `abilities.${slot}[${index}]`,
        builtinNames,
        issues,
      );
    });
  }
  return hasAbility;
}

export function auditManifestImplementations(
  manifest: Manifest,
): ImplementationAuditReport {
  const builtinNames = new Set(registeredBuiltinNames());
  const issues: ImplementationIssue[] = [];
  const vanillaCardIds: string[] = [];

  for (const card of Object.values(manifest.cards)) {
    const hasAbility = inspectAbilities(
      'card',
      card.defId,
      card.abilities as UnknownRecord,
      CARD_ABILITY_SLOTS,
      builtinNames,
      issues,
    );
    if (!hasAbility) vanillaCardIds.push(card.defId);
    if (manifest.disabled.cards.includes(card.defId)) {
      issues.push({
        entity: 'card',
        defId: card.defId,
        code: 'DISABLED',
        path: 'disabled.cards',
        message: 'card is disabled in this manifest',
      });
    }
  }

  for (const location of Object.values(manifest.locations)) {
    inspectAbilities(
      'location',
      location.defId,
      location.abilities as UnknownRecord,
      LOCATION_ABILITY_SLOTS,
      builtinNames,
      issues,
    );
    if (manifest.disabled.locations.includes(location.defId)) {
      issues.push({
        entity: 'location',
        defId: location.defId,
        code: 'DISABLED',
        path: 'disabled.locations',
        message: 'location is disabled in this manifest',
      });
    }
  }

  const issueCardIds = [...new Set(
    issues.filter(issue => issue.entity === 'card').map(issue => issue.defId),
  )].sort();
  const issueLocationIds = [...new Set(
    issues.filter(issue => issue.entity === 'location').map(issue => issue.defId),
  )].sort();
  return {
    implementedCardIds: Object.keys(manifest.cards)
      .filter(defId => !issueCardIds.includes(defId))
      .sort(),
    implementedLocationIds: Object.keys(manifest.locations)
      .filter(defId => !issueLocationIds.includes(defId))
      .sort(),
    vanillaCardIds: vanillaCardIds.sort(),
    issueCardIds,
    issueLocationIds,
    issues,
  };
}
