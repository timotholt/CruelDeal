import type { Manifest } from '../engine/manifest/types';
import { getAllCardTemplates } from '../engine/projections/cardTemplate';
import { getAllLocationTemplates } from '../engine/projections/locationTemplate';

export type ClientCardDomain = 'character' | 'spell';

export interface ClientCardContent {
  readonly defId: string;
  readonly version: number;
  readonly name: string;
  readonly domain: ClientCardDomain;
  readonly baseCost: number;
  readonly basePower: number | null;
  readonly rulesText: string;
  readonly accent: string | null;
  readonly portraitPath: string | null;
}

export interface ClientLocationContent {
  readonly defId: string;
  readonly version: number;
  readonly name: string;
  readonly description: string;
  readonly accent: string | null;
  readonly mapArtPath: string;
}

export interface MatchClientConstants {
  readonly laneCapacity: number;
  readonly turnLimit: number;
  readonly handCap: number;
  readonly deckSize: number;
}

/**
 * Player-facing immutable content needed to render a projected match.
 * Gameplay expressions, rulesets, disabled content, and canonical manifest
 * policy deliberately do not cross this boundary.
 */
export interface MatchContentCatalog {
  readonly version: number;
  readonly protocolVersion: number;
  readonly constants: MatchClientConstants;
  readonly cards: Readonly<Record<string, ClientCardContent>>;
  readonly locations: Readonly<Record<string, ClientLocationContent>>;
}

export function projectMatchContentCatalog(
  manifest: Manifest,
): MatchContentCatalog {
  const cards = Object.fromEntries(
    getAllCardTemplates(manifest).map(template => [
      template.defId,
      Object.freeze({
        defId: template.defId,
        version: template.version,
        name: template.name,
        domain: template.domain,
        baseCost: template.baseCost,
        basePower: template.basePower,
        rulesText: template.rulesText,
        accent: template.accent,
        portraitPath: template.portraitPath,
      } satisfies ClientCardContent),
    ]),
  );
  const locations = Object.fromEntries(
    getAllLocationTemplates(manifest).map(template => [
      template.defId,
      Object.freeze({
        defId: template.defId,
        version: template.version,
        name: template.name,
        description: template.description,
        accent: template.accent,
        mapArtPath: template.mapArtPath,
      } satisfies ClientLocationContent),
    ]),
  );

  return Object.freeze({
    version: manifest.version,
    protocolVersion: manifest.protocolVersion,
    constants: Object.freeze({
      laneCapacity: manifest.constants.laneCapacity,
      turnLimit: manifest.constants.turnLimit,
      handCap: manifest.constants.handCap,
      deckSize: manifest.constants.deckSize,
    }),
    cards: Object.freeze(cards),
    locations: Object.freeze(locations),
  });
}

export const getClientCardContent = (
  catalog: MatchContentCatalog,
  defId: string,
): ClientCardContent | null => catalog.cards[defId] ?? null;

export const getClientLocationContent = (
  catalog: MatchContentCatalog,
  defId: string,
): ClientLocationContent | null => catalog.locations[defId] ?? null;
