import type {
  FeedCardNode,
  FeedCardTypeRecipe,
  FeedStory,
} from '../mainMaterialFeedModel';
import {
  validateMissionBriefingSourceV1,
  type MissionBriefingSourceV1,
  type MissionBriefingValidationIssue,
} from '../../../ui/semantic-authoring/mission-briefing/missionBriefingSource';

export type MissionBriefingLegacyImportResult =
  | { ok: true; source: MissionBriefingSourceV1 }
  | { ok: false; issues: MissionBriefingValidationIssue[] };

const fail = (path: string, message: string): MissionBriefingLegacyImportResult => ({
  ok: false,
  issues: [{ path, message }],
});

const stripLegacyMarkup = (value: string): string => value
  .replace(/\[[^\]]+\]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const parseInteger = (value: string): number => Number.parseInt(value.replaceAll(',', ''), 10);

const collectFingerprintNodes = (nodes: readonly FeedCardNode[]): FeedCardNode[] => nodes.flatMap((node) => [
  ...(node.presentation === 'fingerprint-hold' ? [node] : []),
  ...collectFingerprintNodes(node.children || []),
]);

/**
 * One-way compatibility boundary for the protected card_type_04 snapshot.
 * The semantic model must never depend on, or serialize back to, this graph.
 */
export const importCardType04MissionBriefingV1 = (
  story: FeedStory,
  cardType: FeedCardTypeRecipe,
): MissionBriefingLegacyImportResult => {
  if (story.cardTypeId !== 'card_type_04' || cardType.id !== 'card_type_04') {
    return fail('', 'The legacy Mission Briefing importer only accepts card_type_04.');
  }

  const briefing = story.contractBriefing;
  if (!briefing) return fail('story.contractBriefing', 'Mission briefing content is required.');

  const availabilityMatch = briefing.match(/\[h1\]([\s\S]*?)\[\/h1\]/i);
  const titleMatch = briefing.match(/\[h2\]([\s\S]*?)\[\/h2\]/i);
  const ruleIndex = briefing.search(/\[rule\]/i);
  if (!availabilityMatch || !titleMatch || ruleIndex < 0) {
    return fail(
      'story.contractBriefing',
      'Expected the protected [h1] availability, [h2] title, and [RULE] body structure.',
    );
  }

  const availabilityStatus = stripLegacyMarkup(availabilityMatch[1]).replace(/^\/{2}\s*/, '');
  const title = stripLegacyMarkup(titleMatch[1]);
  const body = stripLegacyMarkup(briefing.slice(ruleIndex + '[RULE]'.length));
  if (!availabilityStatus || !title || !body) {
    return fail('story.contractBriefing', 'Mission briefing semantic fields cannot be empty.');
  }

  const rewardText = stripLegacyMarkup(story.contractRewardSummary || '');
  const rewardMatch = rewardText.match(/Deposit:\s*([0-9,]+)\s*CR\s*Success:\s*([0-9,]+)\s*CR/i);
  if (!rewardMatch) {
    return fail(
      'story.contractRewardSummary',
      'Expected typed Deposit and Success credit amounts in the protected reward summary.',
    );
  }

  const fingerprintNodes = collectFingerprintNodes(cardType.children);
  if (fingerprintNodes.length !== 1) {
    return fail('cardType.children', 'Expected exactly one fingerprint-hold action node.');
  }
  const fingerprint = fingerprintNodes[0];
  if (fingerprint.type !== 'button' || fingerprint.binding !== 'contractCtaLabel') {
    return fail(
      'cardType.children',
      'The fingerprint action must remain a button bound to contractCtaLabel.',
    );
  }
  if (!story.contractCtaLabel) {
    return fail('story.contractCtaLabel', 'The fingerprint action label is required.');
  }

  const candidate: MissionBriefingSourceV1 = {
    schemaVersion: 1,
    type: 'MissionBriefing',
    id: story.id,
    layoutVariant: 'contract-left',
    slots: {
      availabilityStatus: { inline: { format: 'plain', value: availabilityStatus } },
      title: { inline: { format: 'plain', value: title } },
      body: { inline: { format: 'plain', value: body } },
      terms: {
        deposit: {
          amount: { literal: parseInteger(rewardMatch[1]) },
          currencyCode: 'credits',
        },
        successReward: {
          amount: { literal: parseInteger(rewardMatch[2]) },
          currencyCode: 'credits',
        },
      },
      primaryAction: {
        schemaVersion: 1,
        type: 'FingerprintHoldAction',
        id: `${story.id}.accept`,
        label: { inline: { format: 'plain', value: story.contractCtaLabel } },
        actionId: 'mission.accept-terms',
        holdDurationMs: fingerprint.holdDurationMs ?? 1400,
        disabled: false,
        appearance: {
          idle: 'mission-v2-r0.primary-action.idle',
          holding: 'mission-v2-r0.primary-action.holding',
          complete: 'mission-v2-r0.primary-action.complete',
          disabled: 'mission-v2-r0.primary-action.disabled',
        },
      },
    },
    appearance: {
      'frame.idle': 'mission-v2-r0.frame.idle',
      'panel.idle': 'mission-v2-r0.panel.idle',
      'terms.idle': 'mission-v2-r0.terms.idle',
      'primary-action.idle': 'mission-v2-r0.primary-action.idle',
    },
  };

  return validateMissionBriefingSourceV1(candidate);
};
