import { describe, expect, it } from 'vitest';
import protectedLegacyFixture from '../../../../docs/references/ui-authoring/mission-v2-current/fixture.json';
import { importCardType04MissionBriefingV1 } from '../../../screens/main-material/compatibility/importCardType04MissionBriefingV1';
import type { FeedCardTypeRecipe, FeedStory } from '../../../screens/main-material/mainMaterialFeedModel';

describe('card_type_04 one-way compatibility import', () => {
  it('imports the protected visible V2 semantics exactly once into the canonical model', () => {
    const result = importCardType04MissionBriefingV1(
      protectedLegacyFixture.story as FeedStory,
      protectedLegacyFixture.cardType as FeedCardTypeRecipe,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.source.id).toBe('season-pass-cosmic-eclipse-v2');
    expect(result.source.layoutVariant).toBe('contract-left');
    expect(result.source.slots.availabilityStatus).toEqual({
      inline: { format: 'plain', value: 'Active Contract' },
    });
    expect(result.source.slots.title).toEqual({ inline: { format: 'plain', value: 'Data Extraction' } });
    expect(result.source.slots.body).toEqual({
      inline: { format: 'plain', value: 'Extract encrypted data from Solace Corp mainframe cluster.' },
    });
    expect(result.source.slots.terms).toEqual({
      deposit: { amount: { literal: 200 }, currencyCode: 'credits' },
      successReward: { amount: { literal: 800 }, currencyCode: 'credits' },
    });
    expect(result.source.slots.primaryAction.label).toEqual({
      inline: { format: 'plain', value: 'Accept Terms' },
    });
    expect(result.source.slots.primaryAction.holdDurationMs).toBe(1400);
    expect(result.source.slots.progress).toBeUndefined();
    expect(result.source.slots.deadline).toBeUndefined();
    expect(result.source.slots.sectorMark).toBeUndefined();
  });

  it('rejects non-card_type_04 input', () => {
    const story = { ...protectedLegacyFixture.story, cardTypeId: 'card_type_01' } as FeedStory;
    const result = importCardType04MissionBriefingV1(
      story,
      protectedLegacyFixture.cardType as FeedCardTypeRecipe,
    );
    expect(result.ok).toBe(false);
  });
});
