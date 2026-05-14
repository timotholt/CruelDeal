import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest';
import type { CardDef, LocationDef } from '@/services/playgame/engine/manifest';

export type AssetKind = 'card-front' | 'card-back' | 'location-lane';
export type AssetProvider = 'openai' | 'leonardo';
export type CandidateStatus = 'generated' | 'approved' | 'rejected' | 'promoted';

export interface AssetSpec {
  aspectRatio: '5:7' | '4:15';
  width: number;
  height: number;
}

export interface WorkbenchAsset {
  id: string;
  kind: AssetKind;
  defId: string;
  displayName: string;
  currentPath: string;
  targetPath: string;
  manifestFile?: string;
  manifestField?: string;
  statusHint: 'missing' | 'deprecated' | 'ready';
  spec: AssetSpec;
  promptInputs: Record<string, string | number | string[] | null>;
}

export interface AssetCandidateRecord {
  id: string;
  batchId: string;
  assetKind: AssetKind;
  assetId: string;
  displayName: string;
  provider: AssetProvider;
  providerModel: string;
  providerRequestId?: string;
  generatedAt: string;
  updatedAt: string;
  status: CandidateStatus;
  promptTemplateId: string;
  promptTemplateVersion: number;
  promptInputs: Record<string, string | number | string[] | null>;
  finalPrompt: string;
  negativePrompt?: string;
  requestedSize: { w: number; h: number };
  providerOutputSize?: { w: number; h: number };
  committedSize: { w: number; h: number };
  aspectRatio: '5:7' | '4:15';
  dimensionsDivisibleBy8: true;
  rawPath: string;
  normalizedPath: string;
  promotedPath?: string;
  manifestPath?: string;
  reviewerNotes?: string;
  engineTargetPath: string;
}

export interface WorkbenchState {
  version: 1;
  candidates: AssetCandidateRecord[];
}

export const CARD_RUNTIME_SPEC: AssetSpec = {
  aspectRatio: '5:7',
  width: 640,
  height: 896,
};

export const LANE_RUNTIME_SPEC: AssetSpec = {
  aspectRatio: '4:15',
  width: 384,
  height: 1440,
};

const cardTargetPath = (defId: string): string => `/art/cards/${defId}/portrait.webp`;

const locationTargetPath = (location: LocationDef): string => {
  const current = location.cosmetic.art.map.path;
  const base = current.split('/').pop()?.replace(/\.[^.]+$/, '') || location.defId;
  return `/art/maps/${base}.webp`;
};

export const buildWorkbenchAssets = (): WorkbenchAsset[] => {
  const cards = Object.values(BOOTSTRAP_MANIFEST.cards)
    .sort((a, b) => a.defId.localeCompare(b.defId))
    .map((card: CardDef): WorkbenchAsset => ({
      id: `card-front:${card.defId}`,
      kind: 'card-front',
      defId: card.defId,
      displayName: card.cosmetic.displayName || card.name,
      currentPath: card.cosmetic.art.portrait.path,
      targetPath: cardTargetPath(card.defId),
      manifestFile: 'services/playgame/engine/manifest/content/cyberpunk-cards.ts',
      manifestField: 'cosmetic.art.portrait.path',
      statusHint: card.cosmetic.art.portrait.path ? 'ready' : 'missing',
      spec: CARD_RUNTIME_SPEC,
      promptInputs: {
        name: card.name,
        displayName: card.cosmetic.displayName,
        defId: card.defId,
        cardType: card.cardType,
        cost: card.cost,
        power: card.basePower,
        frame: card.cosmetic.frame ?? 'common',
        rulesText: card.cosmetic.rulesText,
        flavorText: card.cosmetic.flavorText,
        accent: card.cosmetic.accent ?? '',
      },
    }));

  const locations = Object.values(BOOTSTRAP_MANIFEST.locations)
    .sort((a, b) => a.defId.localeCompare(b.defId))
    .map((location: LocationDef): WorkbenchAsset => ({
      id: `location-lane:${location.defId}`,
      kind: 'location-lane',
      defId: location.defId,
      displayName: location.cosmetic.displayName || location.name,
      currentPath: location.cosmetic.art.map.path,
      targetPath: locationTargetPath(location),
      manifestFile: 'services/playgame/engine/manifest/content/locations.ts',
      manifestField: 'cosmetic.art.map.path',
      statusHint: 'deprecated',
      spec: LANE_RUNTIME_SPEC,
      promptInputs: {
        name: location.name,
        displayName: location.cosmetic.displayName,
        defId: location.defId,
        description: location.cosmetic.description,
        accent: location.cosmetic.accent ?? '',
      },
    }));

  const cardBack: WorkbenchAsset = {
    id: 'card-back:default',
    kind: 'card-back',
    defId: 'default',
    displayName: 'Default Card Back',
    currentPath: '',
    targetPath: '/art/cards/backs/default.webp',
    statusHint: 'missing',
    spec: CARD_RUNTIME_SPEC,
    promptInputs: {
      name: 'Default Card Back',
      defId: 'default',
      description: 'Reusable face-down card back for Cruel Deal.',
    },
  };

  return [...locations, cardBack, ...cards];
};

export const GLOBAL_STYLE_PROMPT = [
  'Cruel Deal is a cyberpunk tactical card game.',
  'Art direction: neon-noir, grimy corporate dystopia, scavenged tech, wet streets, holographic signage, sharp silhouettes, cinematic lighting, readable composition at small card size.',
  'Avoid text, logos, watermarks, UI, borders, frames, captions, and realistic copyrighted characters.',
  'Make the image feel collectible and game-ready.',
].join(' ');

export const buildPromptForAsset = (asset: WorkbenchAsset): string => {
  if (asset.kind === 'card-front') {
    return [
      GLOBAL_STYLE_PROMPT,
      `Create a portrait-format card illustration for "${asset.promptInputs.name}".`,
      `Card type: ${asset.promptInputs.cardType}.`,
      `Gameplay identity: cost ${asset.promptInputs.cost}, power ${asset.promptInputs.power}, rarity ${asset.promptInputs.frame}.`,
      `Rules inspiration: ${asset.promptInputs.rulesText || 'No rules text.'}`,
      `Flavor inspiration: ${asset.promptInputs.flavorText || 'No flavor text.'}`,
      `Accent color cue: ${asset.promptInputs.accent || 'use cyberpunk contrast'}.`,
      'Composition: single clear subject, centered silhouette, dramatic foreground read, simple background shapes, no card frame, no text.',
      `Output target: exact 5:7 portrait art normalized to ${asset.spec.width}x${asset.spec.height}.`,
    ].join('\n');
  }

  if (asset.kind === 'location-lane') {
    return [
      GLOBAL_STYLE_PROMPT,
      `Create a tall lane/location illustration for "${asset.promptInputs.name}" in Cruel Deal.`,
      `Gameplay mood: ${asset.promptInputs.description}.`,
      `Accent color cue: ${asset.promptInputs.accent || 'use cyberpunk contrast'}.`,
      'Composition: environmental scene, strong vertical lane read, atmospheric depth, clear focal architecture or landmark, no characters dominating the image, no text.',
      'The image should cover one full play lane behind enemy slots, the location strip, and player slots.',
      `Output target: exact 4:15 portrait lane art normalized to ${asset.spec.width}x${asset.spec.height}.`,
    ].join('\n');
  }

  return [
    GLOBAL_STYLE_PROMPT,
    'Create a premium card back for Cruel Deal, a cyberpunk tactical card game.',
    'Symmetrical design, neon circuitry, black chrome, subtle corporate-danger motif, collectible physical card feel, strong center emblem, readable at tiny size.',
    'No readable text, no logos, no watermark, no card front frame.',
    `Output target: exact 5:7 portrait card back normalized to ${asset.spec.width}x${asset.spec.height}.`,
  ].join('\n');
};
