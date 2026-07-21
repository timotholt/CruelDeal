import type { ClientCardDomain } from '@/services/playgame/client/contentCatalog';

export interface CardRenderModel {
  readonly key: string;
  readonly name: string;
  readonly type: ClientCardDomain | '';
  readonly cost: number;
  readonly power: number;
  readonly portraitPath: string | null;
  readonly art: string;
  readonly textDisabled: boolean;
  readonly costTone: string;
  readonly powerTone: string;
}

export interface LocationRenderModel {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly art: string;
  readonly mapArt: string | null;
  readonly revealed: boolean;
}
