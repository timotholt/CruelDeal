import { describe, expect, it } from 'vitest';

import { apply } from '../apply';
import { emptyTestMatchState, testManifest } from '../testkit/runtimeFixture';
import type { MatchEvent } from '../types/events';

const GOVERNED_LOCATION_EVENT_TYPES = [
  'LOCATION_DECK_INITIALIZED',
  'LOCATION_CARD_CREATED',
  'LOCATION_CARD_DRAWN',
  'LOCATION_CARD_PLAYED',
  'LOCATION_SLOT_REVEAL_SCHEDULED',
  'LOCATION_REVEALED',
  'LOCATION_TURNED_FACE_DOWN',
  'LOCATION_SHOWN_TO_SEATS',
  'LOCATION_REPLACED',
  'LOCATIONS_SWAPPED',
  'LOCATION_MOVED',
  'LOCATION_REMOVED_FROM_LANE',
  'LOCATION_RETURNED_TO_DECK',
  'LANE_DESTRUCTION_STARTED',
  'LANE_DESTROYED',
  'LANE_CREATION_STARTED',
  'LANE_CREATED',
] as const satisfies readonly MatchEvent['type'][];

describe('C5A-4 location/lane replay ingress', () => {
  it.each(GOVERNED_LOCATION_EVENT_TYPES)(
    'rejects %s when its immutable cause is missing',
    (type) => {
      const event = { type } as MatchEvent;
      expect(() => apply(
        emptyTestMatchState(),
        event,
        testManifest([], []),
      )).toThrow(`${type} cause is required`);
    },
  );

  it.each(GOVERNED_LOCATION_EVENT_TYPES)(
    'rejects %s when its cause is empty',
    (type) => {
      const event = {
        type,
        cause: {
          sourceId: '',
          effectKind: 'SYSTEM',
          reason: '',
        },
      } as MatchEvent;
      expect(() => apply(
        emptyTestMatchState(),
        event,
        testManifest([], []),
      )).toThrow(`${type} cause sourceId must be non-empty`);
    },
  );
});
