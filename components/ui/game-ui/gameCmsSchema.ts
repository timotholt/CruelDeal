import * as v from 'valibot';
import { fault } from '../../../utils/logger';
import { summarizeValibotIssues } from '../material-lab/surfaceValidate';
import {
  ctaContentSchema,
  boundedNumber,
  id,
  imageId,
  isoDate,
  locale,
  optionalBoundedNumber,
  paletteTokenSchema,
  routeId,
  safeActionSchema,
  schemaVersion,
} from './gameUiSchemaPrimitives';
import type { GamePaletteTokens } from './gameUiThemeSchema';

export interface SafeActionRef {
  id:
    | 'openNews'
    | 'openStoreOffer'
    | 'openEvent'
    | 'openMission'
    | 'openDeck'
    | 'openRoute'
    | 'openProfile'
    | 'openCurrencyStore';
  params?: Record<string, string | number | boolean>;
}

export interface CtaContent {
  label: string;
  action: SafeActionRef;
}

export interface ProfileSummary {
  id: string;
  displayName: string;
  title?: string;
  level: number;
  xpCurrent?: number;
  xpMax?: number;
  avatarImageId?: string;
  badgeImageId?: string;
}

export interface ResourceBalance {
  id: string;
  label: string;
  amount: number;
  iconId: string;
  tone?: keyof GamePaletteTokens;
  action?: SafeActionRef;
}

export interface NavItem {
  id: string;
  label: string;
  iconId: string;
  routeId: string;
  badge?: 'dot' | number | string;
  disabled?: boolean;
}

export interface PromoItem {
  id: string;
  kind: 'news' | 'store' | 'event' | 'season' | 'mission' | 'community';
  title: string;
  eyebrow?: string;
  body?: string;
  imageId?: string;
  focalPoint?: { x: number; y: number };
  cta?: CtaContent;
  startsAt?: string;
  endsAt?: string;
  priority?: number;
  analyticsId?: string;
}

export interface NewsItem {
  id: string;
  category: 'patch' | 'event' | 'community' | 'system';
  title: string;
  summary: string;
  imageId?: string;
  cta?: CtaContent;
  publishedAt?: string;
}

export interface StoreOffer {
  id: string;
  title: string;
  description?: string;
  priceResourceId?: string;
  priceAmount?: number;
  rewardIds?: string[];
  imageId?: string;
  cta?: CtaContent;
  startsAt?: string;
  endsAt?: string;
}

export interface MissionBrief {
  id: string;
  title: string;
  faction?: string;
  location?: string;
  description: string;
  rewardResourceId?: string;
  rewardAmount?: number;
  difficulty?: 'easy' | 'normal' | 'hard' | 'elite';
  estimatedMinutes?: number;
  cta?: CtaContent;
}

export interface DeckSummary {
  id: string;
  title: string;
  archetype?: string;
  power?: number;
  rank?: string;
  cardCount?: number;
  maxCards?: number;
  imageId?: string;
  cta?: CtaContent;
}

export interface GameCmsContent {
  schemaVersion: 1;
  locale: string;
  profile: ProfileSummary;
  resources: Record<string, ResourceBalance>;
  nav: {
    bottom: NavItem[];
    toolbar?: NavItem[];
  };
  promos: Record<string, PromoItem>;
  news: Record<string, NewsItem>;
  storeOffers: Record<string, StoreOffer>;
  missions: Record<string, MissionBrief>;
  decks?: Record<string, DeckSummary>;
}

const optionalDate = () => v.optional(isoDate());
const optionalImage = () => v.optional(imageId());

const profileSchema = v.strictObject({
  id: id(),
  displayName: v.string(),
  title: v.optional(v.string()),
  level: boundedNumber(1, 999),
  xpCurrent: optionalBoundedNumber(0, 999999999),
  xpMax: optionalBoundedNumber(1, 999999999),
  avatarImageId: optionalImage(),
  badgeImageId: optionalImage(),
});

const resourceSchema = v.strictObject({
  id: id(),
  label: v.string(),
  amount: v.pipe(v.number(), v.minValue(0), v.maxValue(999999999)),
  iconId: id(),
  tone: v.optional(paletteTokenSchema),
  action: v.optional(safeActionSchema),
});

const navItemSchema = v.strictObject({
  id: id(),
  label: v.string(),
  iconId: id(),
  routeId: routeId(),
  badge: v.optional(v.union([v.literal('dot'), v.number(), v.string()])),
  disabled: v.optional(v.boolean()),
});

const promoSchema = v.strictObject({
  id: id(),
  kind: v.picklist(['news', 'store', 'event', 'season', 'mission', 'community'] as const),
  title: v.string(),
  eyebrow: v.optional(v.string()),
  body: v.optional(v.string()),
  imageId: optionalImage(),
  focalPoint: v.optional(v.strictObject({
    x: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    y: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  })),
  cta: v.optional(ctaContentSchema),
  startsAt: optionalDate(),
  endsAt: optionalDate(),
  priority: optionalBoundedNumber(-1000, 1000),
  analyticsId: v.optional(id()),
});

const newsSchema = v.strictObject({
  id: id(),
  category: v.picklist(['patch', 'event', 'community', 'system'] as const),
  title: v.string(),
  summary: v.string(),
  imageId: optionalImage(),
  cta: v.optional(ctaContentSchema),
  publishedAt: optionalDate(),
});

const storeOfferSchema = v.strictObject({
  id: id(),
  title: v.string(),
  description: v.optional(v.string()),
  priceResourceId: v.optional(id()),
  priceAmount: optionalBoundedNumber(0, 999999999),
  rewardIds: v.optional(v.array(id())),
  imageId: optionalImage(),
  cta: v.optional(ctaContentSchema),
  startsAt: optionalDate(),
  endsAt: optionalDate(),
});

const missionSchema = v.strictObject({
  id: id(),
  title: v.string(),
  faction: v.optional(v.string()),
  location: v.optional(v.string()),
  description: v.string(),
  rewardResourceId: v.optional(id()),
  rewardAmount: optionalBoundedNumber(0, 999999999),
  difficulty: v.optional(v.picklist(['easy', 'normal', 'hard', 'elite'] as const)),
  estimatedMinutes: optionalBoundedNumber(1, 1440),
  cta: v.optional(ctaContentSchema),
});

const deckSchema = v.strictObject({
  id: id(),
  title: v.string(),
  archetype: v.optional(v.string()),
  power: optionalBoundedNumber(0, 999999999),
  rank: v.optional(v.string()),
  cardCount: optionalBoundedNumber(0, 999),
  maxCards: optionalBoundedNumber(1, 999),
  imageId: optionalImage(),
  cta: v.optional(ctaContentSchema),
});

export const gameCmsContentSchema: v.GenericSchema<GameCmsContent> = v.strictObject({
  schemaVersion: schemaVersion(),
  locale: locale(),
  profile: profileSchema,
  resources: v.record(v.string(), resourceSchema),
  nav: v.strictObject({
    bottom: v.array(navItemSchema),
    toolbar: v.optional(v.array(navItemSchema)),
  }),
  promos: v.record(v.string(), promoSchema),
  news: v.record(v.string(), newsSchema),
  storeOffers: v.record(v.string(), storeOfferSchema),
  missions: v.record(v.string(), missionSchema),
  decks: v.optional(v.record(v.string(), deckSchema)),
}) as v.GenericSchema<GameCmsContent>;

export const validateGameCmsContent = (input: unknown, label = 'game-cms-content'): GameCmsContent | null => {
  const result = v.safeParse(gameCmsContentSchema, input);
  if (result.success) return result.output;
  fault('game.cms.invalid', { label, issues: summarizeValibotIssues(result.issues) });
  return null;
};
