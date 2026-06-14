import type {
  FeedNodeAlign,
  FeedNodeCrossAlign,
  FeedNodeDirection,
  FeedNodeDistribute,
  FeedNodeJustify,
  FeedNodeLayout,
} from './feedNodeLayoutCss';

export interface FeedLayoutRecipe {
  contentY: number;
  cardGap: number;
  newsGap: number;
}

export const layoutPackedDistributes = ['start', 'center', 'end'] as const;
export const layoutDistributeModes = ['packed', 'between', 'around', 'evenly'] as const;
export const layoutCrossPositions = ['start', 'center', 'end'] as const;
export const defaultFeedLayoutRecipe: FeedLayoutRecipe = {
  contentY: 0,
  cardGap: 16,
  newsGap: 10,
};

export type LayoutCrossPosition = typeof layoutCrossPositions[number];
export type LayoutDistributeMode = typeof layoutDistributeModes[number];

const clampFeedLayoutValue = (value: unknown, fallback: number, min: number, max: number) => {
  const next = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, next));
};

export const sanitizeFeedLayoutRecipe = (value: unknown): FeedLayoutRecipe => {
  const input = typeof value === 'object' && value !== null ? value as Partial<FeedLayoutRecipe> : {};
  return {
    contentY: clampFeedLayoutValue(input.contentY, defaultFeedLayoutRecipe.contentY, -32, 48),
    cardGap: clampFeedLayoutValue(input.cardGap, defaultFeedLayoutRecipe.cardGap, 8, 32),
    newsGap: clampFeedLayoutValue(input.newsGap, defaultFeedLayoutRecipe.newsGap, 6, 28),
  };
};

export const feedLayoutPreviewCssVars = (feed: FeedLayoutRecipe) => ({
  '--main-content-y': `${feed.contentY}px`,
});

export const feedLayoutCarouselCssVars = (
  feed: FeedLayoutRecipe,
  activeSlideIndex: number,
  dragDeltaX: number,
) => ({
  '--main-card-gap': `${feed.cardGap}px`,
  '--main-news-gap': `${feed.newsGap}px`,
  '--main-feed-slide-index': activeSlideIndex,
  '--main-feed-drag-x': `${dragDeltaX}px`,
});

const layoutCrossToAlign = (cross: FeedNodeCrossAlign): FeedNodeAlign => (
  cross === 'end' ? 'right' : cross === 'center' || cross === 'stretch' ? 'center' : 'left'
);

const layoutCrossToJustify = (cross: FeedNodeCrossAlign): FeedNodeJustify => (
  cross === 'end' ? 'end' : cross === 'center' || cross === 'stretch' ? 'center' : 'start'
);

const layoutDistributeToAlign = (distribute: FeedNodeDistribute): FeedNodeAlign => (
  distribute === 'end' ? 'right' : distribute === 'center' ? 'center' : 'left'
);

const layoutDistributeToJustify = (distribute: FeedNodeDistribute): FeedNodeJustify => (
  distribute === 'end' ? 'end' : distribute === 'center' ? 'center' : 'start'
);

export const layoutGridCell = (
  direction: FeedNodeDirection,
  visualRow: LayoutCrossPosition,
  visualColumn: LayoutCrossPosition,
): { cross: FeedNodeCrossAlign; distribute: FeedNodeDistribute } => (
  direction === 'column'
    ? { cross: visualColumn, distribute: visualRow }
    : { cross: visualRow, distribute: visualColumn }
);

export const layoutGridCellLabel = (
  visualRow: LayoutCrossPosition,
  visualColumn: LayoutCrossPosition,
) => `${visualRow === 'start' ? 'T' : visualRow === 'center' ? 'M' : 'B'}${visualColumn === 'start' ? 'L' : visualColumn === 'center' ? 'C' : 'R'}`;

export const layoutDistributeMode = (distribute: FeedNodeDistribute): LayoutDistributeMode => (
  distribute === 'between' || distribute === 'around' || distribute === 'evenly' ? distribute : 'packed'
);

export const legacyScreenAlignment = (
  direction: FeedNodeDirection,
  cross: FeedNodeCrossAlign,
  distribute: FeedNodeDistribute,
): Pick<FeedNodeLayout, 'align' | 'justify'> => (
  direction === 'column'
    ? { align: layoutCrossToAlign(cross), justify: layoutDistributeToJustify(distribute) }
    : { align: layoutDistributeToAlign(distribute), justify: layoutCrossToJustify(cross) }
);

export const layoutCrossAxisLabel = (direction: FeedNodeDirection) => (
  direction === 'column' ? 'Align X' : 'Align Y'
);

export const layoutSpreadAxisLabel = (direction: FeedNodeDirection) => (
  direction === 'column' ? 'Spread Y' : 'Spread X'
);
