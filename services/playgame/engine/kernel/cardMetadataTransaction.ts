import { cardTagsEqual } from '../cardTagIdentity';
import type { Manifest } from '../manifest/types';
import { getCardRuntime } from '../projections/cardRuntime';
import type { EffectRef, TextOverride } from '../types/ability';
import type { CardId } from '../types/ids';
import type { CardTag, MatchState } from '../types/state';
import {
  kernelStepFailure,
  kernelStepSuccess,
} from './kernel';
import {
  type CardMetadataCommand,
  type CardMetadataEvent,
} from './operations/cardMetadata';

export type CardMetadataSemantics =
  | {
      readonly eventType: 'CARD_TAG_ADDED' | 'CARD_TAG_REMOVED';
      readonly transitionKind: 'TAG_ADDED' | 'TAG_REMOVED';
      readonly entityId: CardId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly tag: CardTag | CardTag['kind'];
      readonly priorPresent: boolean;
      readonly resultPresent: boolean;
    }
  | {
      readonly eventType: 'CARD_COUNTER_CHANGED';
      readonly transitionKind: 'COUNTER_INCREASE' | 'COUNTER_DECREASE';
      readonly entityId: CardId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly name: string;
      readonly priorValue: number;
      readonly resultValue: number;
      readonly signedChange: number;
    }
  | {
      readonly eventType: 'CARD_TEXT_OVERRIDDEN';
      readonly transitionKind: 'TEXT_SET' | 'TEXT_CLEARED';
      readonly entityId: CardId;
      readonly cause: EffectRef;
      readonly reason: string;
      readonly prior: TextOverride | null;
      readonly result: TextOverride | null;
    };

export function captureCardMetadataSemantics(
  before: MatchState,
  event: CardMetadataEvent,
  after: MatchState,
  manifest: Manifest,
) {
  const prior = getCardRuntime(before, event.cardId, manifest);
  const result = getCardRuntime(after, event.cardId, manifest);
  if (!prior || !result) {
    return kernelStepFailure<CardMetadataSemantics>({
      code: 'MISSING_SEMANTICS',
      message: `Card metadata transition is missing card ${event.cardId}.`,
      sourceInstanceId: String(event.cardId),
    });
  }

  switch (event.type) {
    case 'CARD_TAG_ADDED': {
      const priorPresent = prior.tags.some(tag => cardTagsEqual(tag, event.tag));
      const resultPresent = result.tags.some(tag => cardTagsEqual(tag, event.tag));
      if (priorPresent || !resultPresent) {
        return kernelStepFailure<CardMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Card tag add did not produce the declared transition.',
          sourceInstanceId: String(event.cardId),
        });
      }
      return kernelStepSuccess<CardMetadataSemantics>({
        eventType: event.type,
        transitionKind: 'TAG_ADDED',
        entityId: event.cardId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        tag: structuredClone(event.tag),
        priorPresent,
        resultPresent,
      });
    }

    case 'CARD_TAG_REMOVED': {
      const priorPresent = prior.tags.some(tag => tag.kind === event.tag);
      const resultPresent = result.tags.some(tag => tag.kind === event.tag);
      if (!priorPresent || resultPresent) {
        return kernelStepFailure<CardMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Card tag removal did not produce the declared transition.',
          sourceInstanceId: String(event.cardId),
        });
      }
      return kernelStepSuccess<CardMetadataSemantics>({
        eventType: event.type,
        transitionKind: 'TAG_REMOVED',
        entityId: event.cardId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        tag: event.tag,
        priorPresent,
        resultPresent,
      });
    }

    case 'CARD_COUNTER_CHANGED': {
      const priorValue = prior.counters[event.name] ?? 0;
      const resultValue = result.counters[event.name] ?? 0;
      const signedChange = resultValue - priorValue;
      if (signedChange !== event.delta) {
        return kernelStepFailure<CardMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Card counter commit produced an invalid change.',
          sourceInstanceId: String(event.cardId),
        });
      }
      return kernelStepSuccess<CardMetadataSemantics>({
        eventType: event.type,
        transitionKind:
          signedChange > 0 ? 'COUNTER_INCREASE' : 'COUNTER_DECREASE',
        entityId: event.cardId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        name: event.name,
        priorValue,
        resultValue,
        signedChange,
      });
    }

    case 'CARD_TEXT_OVERRIDDEN': {
      if (JSON.stringify(result.text.override) !== JSON.stringify(event.override)) {
        return kernelStepFailure<CardMetadataSemantics>({
          code: 'MISSING_SEMANTICS',
          message: 'Card text commit did not preserve the override snapshot.',
          sourceInstanceId: String(event.cardId),
        });
      }
      return kernelStepSuccess<CardMetadataSemantics>({
        eventType: event.type,
        transitionKind: event.override === null ? 'TEXT_CLEARED' : 'TEXT_SET',
        entityId: event.cardId,
        cause: { ...event.cause },
        reason: event.cause.reason,
        prior: prior.text.override === null
          ? null
          : structuredClone(prior.text.override),
        result: result.text.override === null
          ? null
          : structuredClone(result.text.override),
      });
    }
  }
}

export type { CardMetadataCommand, CardMetadataEvent };
