import type { CardId } from '@/services/playgame/engine/types/ids';

export type CardPersistentFxKind =
  | 'fire'
  | 'ice'
  | 'acid'
  | 'electric'
  | 'poison'
  | 'barrier'
  | 'glitch'
  | 'void'
  | 'overclock'
  | 'stealth'
  | 'holy'
  | 'bleed';

export type FxPalette = {
  primary: string;
  secondary?: string;
  accent?: string;
};

export type CardPersistentFxSource = {
  id: string;
  sourceId: string;
  kind: CardPersistentFxKind;
  intensity?: number;
  priority?: number;
  palette?: FxPalette;
};

export type FxAggregateResult = {
  renderMode: 'single' | 'stacked' | 'aggregated' | 'prioritized';
  vars: Record<string, string>;
};

export type CardFxDefinition = {
  kind: CardPersistentFxKind;
  className: string;
  defaultPalette: FxPalette;
  aggregate(sources: readonly CardPersistentFxSource[]): FxAggregateResult;
};

export type CardVfxChannel =
  | 'world-motion'
  | 'impact-shake'
  | 'interaction-pose'
  | 'power-pulse'
  | 'face-transform'
  | 'surface-fx'
  | 'persistent-fx';

export type CardVfxPhase = 'entering' | 'active' | 'exiting' | 'complete';

export type CardTransientVfx = {
  id: string;
  cardId: CardId;
  source: {
    kind: 'event';
    eventId?: string;
    eventType: string;
    sourceId?: string;
  };
  channel: Exclude<CardVfxChannel, 'persistent-fx'>;
  className: string;
  vars: Record<string, string>;
  priority: number;
  createdAtMs: number;
  startedAtMs?: number;
  durationMs: number;
  exitDurationMs: number;
  cleanupAtMs: number;
  phase: CardVfxPhase;
};

export type CardPersistentVfxGroup = {
  id: string;
  cardId: CardId;
  groupKind: 'ongoing' | 'status' | 'copied-text' | 'disabled-text';
  visualKind: string;
  sources: readonly {
    sourceId: string;
    visualKind: string;
    intensity: number;
    priority: number;
    palette?: FxPalette;
  }[];
  renderMode: 'single' | 'stacked' | 'aggregated' | 'prioritized';
  vars: Record<string, string>;
  phase: 'active' | 'exiting';
  createdAtMs: number;
  updatedAtMs: number;
  exitStartedAtMs?: number;
  cleanupAtMs?: number;
};

export type CardVfxRenderModel = {
  transient: readonly CardTransientVfx[];
  persistent: readonly CardPersistentVfxGroup[];
};

export type VfxClearReason =
  | 'card-unmounted'
  | 'card-zone-hidden'
  | 'match-reset'
  | 'replay-entered'
  | 'screen-unmounted'
  | 'reduced-motion';

export type CreateTransientVfxRequest = {
  cardId: CardId;
  eventType: string;
  channel: CardTransientVfx['channel'];
  effectKind: string;
  className: string;
  vars?: Record<string, string>;
  durationMs: number;
  exitDurationMs?: number;
  priority?: number;
  dedupeKey?: string;
};

export interface CardVfxRegistry {
  createTransient(request: CreateTransientVfxRequest): string | null;
  reconcilePersistent(cardId: CardId, sources: CardPersistentFxSource[]): void;
  complete(recordId: string): void;
  clearCard(cardId: CardId, reason: VfxClearReason): void;
  clearAll(reason: VfxClearReason): void;
  getLayers(cardId: CardId): CardVfxRenderModel;
  subscribe(cardId: CardId, listener: () => void): () => void;
  tick(nowMs: number): void;
}
