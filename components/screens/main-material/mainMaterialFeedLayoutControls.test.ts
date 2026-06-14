import assert from 'node:assert/strict';
import {
  defaultFeedLayoutRecipe,
  feedLayoutCarouselCssVars,
  feedLayoutPreviewCssVars,
  layoutCrossAxisLabel,
  layoutDistributeMode,
  layoutGridCell,
  layoutGridCellLabel,
  layoutSpreadAxisLabel,
  layoutXControlLabel,
  layoutXRange,
  layoutYControlLabel,
  layoutYRange,
  legacyScreenAlignment,
  sanitizeFeedLayoutRecipe,
} from './mainMaterialFeedLayoutControls';
import type { FeedNodeLayout } from './feedNodeLayoutCss';

const layout = (overrides: Partial<FeedNodeLayout> = {}): FeedNodeLayout => ({
  mode: 'absolute',
  slot: 'auto',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  nudgeX: 0,
  nudgeY: 0,
  padding: 0,
  gap: 0,
  align: 'left',
  justify: 'start',
  ...overrides,
});

assert.deepEqual(defaultFeedLayoutRecipe, {
  contentY: 0,
  cardGap: 16,
  newsGap: 10,
});

assert.deepEqual(sanitizeFeedLayoutRecipe(null), defaultFeedLayoutRecipe);
assert.deepEqual(sanitizeFeedLayoutRecipe({
  contentY: -999,
  cardGap: 999,
  newsGap: Number.NaN,
}), {
  contentY: -32,
  cardGap: 32,
  newsGap: 10,
});
assert.deepEqual(sanitizeFeedLayoutRecipe({
  contentY: 999,
  cardGap: -999,
  newsGap: 999,
}), {
  contentY: 48,
  cardGap: 8,
  newsGap: 28,
});

assert.deepEqual(feedLayoutPreviewCssVars({ contentY: -12, cardGap: 18, newsGap: 14 }), {
  '--main-content-y': '-12px',
});

assert.deepEqual(feedLayoutCarouselCssVars({ contentY: 7, cardGap: 22, newsGap: 19 }, 2, -37), {
  '--main-card-gap': '22px',
  '--main-news-gap': '19px',
  '--main-feed-slide-index': 2,
  '--main-feed-drag-x': '-37px',
});

assert.deepEqual(
  layoutGridCell('column', 'end', 'start'),
  { cross: 'start', distribute: 'end' },
  'in column direction, grid rows control vertical distribution and columns control horizontal cross-axis alignment',
);

assert.deepEqual(
  layoutGridCell('row', 'end', 'start'),
  { cross: 'end', distribute: 'start' },
  'in row direction, grid rows control vertical cross-axis alignment and columns control horizontal distribution',
);

assert.deepEqual(
  legacyScreenAlignment('column', 'end', 'start'),
  { align: 'right', justify: 'start' },
  'column compatibility must store cross-axis as align and distribution as justify',
);

assert.deepEqual(
  legacyScreenAlignment('row', 'end', 'start'),
  { align: 'left', justify: 'end' },
  'row compatibility must store distribution as align and cross-axis as justify',
);

assert.equal(layoutGridCellLabel('start', 'start'), 'TL');
assert.equal(layoutGridCellLabel('center', 'center'), 'MC');
assert.equal(layoutGridCellLabel('end', 'end'), 'BR');

assert.equal(layoutDistributeMode('start'), 'packed');
assert.equal(layoutDistributeMode('center'), 'packed');
assert.equal(layoutDistributeMode('end'), 'packed');
assert.equal(layoutDistributeMode('between'), 'between');
assert.equal(layoutDistributeMode('around'), 'around');
assert.equal(layoutDistributeMode('evenly'), 'evenly');

assert.equal(layoutCrossAxisLabel('column'), 'Align X');
assert.equal(layoutCrossAxisLabel('row'), 'Align Y');
assert.equal(layoutSpreadAxisLabel('column'), 'Spread Y');
assert.equal(layoutSpreadAxisLabel('row'), 'Spread X');

assert.equal(layoutXControlLabel(), 'X');
assert.equal(layoutYControlLabel(), 'Y');
assert.equal(layoutXControlLabel(layout({ constraintH: 'center' })), 'X Offset');
assert.equal(layoutYControlLabel(layout({ constraintV: 'center' })), 'Y Offset');
assert.equal(layoutXControlLabel(layout({ constraintH: 'right' })), 'Right');
assert.equal(layoutYControlLabel(layout({ constraintV: 'bottom' })), 'Bottom');
assert.equal(layoutXControlLabel(layout({ mode: 'flow', selfPosition: 'in-flow' })), 'Old X');
assert.equal(layoutYControlLabel(layout({ mode: 'flow', selfPosition: 'in-flow' })), 'Old Y');
assert.deepEqual(layoutXRange(layout()), { min: -50, max: 150 });
assert.deepEqual(layoutYRange(layout()), { min: -50, max: 150 });
assert.deepEqual(layoutXRange(layout({ constraintH: 'center' })), { min: -80, max: 80 });
assert.deepEqual(layoutYRange(layout({ constraintV: 'center' })), { min: -80, max: 80 });

console.log('Feed layout control mapping tests passed');
