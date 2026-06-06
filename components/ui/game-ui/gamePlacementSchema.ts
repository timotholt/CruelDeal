import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import { summarizeValibotIssues } from '../material-lab/surfaceValidate';
import { id, schemaVersion } from './gameUiSchemaPrimitives';

export interface GameUiPlacements {
  schemaVersion: 1;
  home: {
    heroPromo?: string;
    newsRail?: string[];
    storePromo?: string;
    activeMission?: string;
    deckSummary?: string;
  };
  shell: {
    bottomNav?: string[];
    toolbar?: string[];
    topBarResources?: string[];
  };
  store?: {
    featuredOffer?: string;
    offerRail?: string[];
  };
}

const idArray = () => v.array(id());

export const gameUiPlacementsSchema: v.GenericSchema<GameUiPlacements> = v.strictObject({
  schemaVersion: schemaVersion(),
  home: v.strictObject({
    heroPromo: v.optional(id()),
    newsRail: v.optional(idArray()),
    storePromo: v.optional(id()),
    activeMission: v.optional(id()),
    deckSummary: v.optional(id()),
  }),
  shell: v.strictObject({
    bottomNav: v.optional(idArray()),
    toolbar: v.optional(idArray()),
    topBarResources: v.optional(idArray()),
  }),
  store: v.optional(v.strictObject({
    featuredOffer: v.optional(id()),
    offerRail: v.optional(idArray()),
  })),
}) as v.GenericSchema<GameUiPlacements>;

export const validateGameUiPlacements = (input: unknown, label = 'game-ui-placements'): GameUiPlacements | null => {
  const result = v.safeParse(gameUiPlacementsSchema, input);
  if (result.success) return result.output;
  fault('game.placements.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};
