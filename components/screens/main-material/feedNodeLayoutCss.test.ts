import { describe, expect, it } from 'vitest';
import { feedNodeLayoutCss, type FeedNodeLayout } from './feedNodeLayoutCss';

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

const keys = (value: object) => Object.keys(value).sort();

describe('feedNodeLayoutCss', () => {
  it('omits disabled spacing and default column direction', () => {
    const css = feedNodeLayoutCss(layout());

    expect(keys(css)).toEqual([
      'align-items',
      'height',
      'justify-content',
      'left',
      'text-align',
      'top',
      'width',
    ]);
    expect(css).not.toHaveProperty('gap');
    expect(css).not.toHaveProperty('--feed-node-gap');
    expect(css).not.toHaveProperty('--feed-node-padding');
    expect(css).not.toHaveProperty('flex-direction');
    expect(css).not.toHaveProperty('flex-wrap');
    expect(css).not.toHaveProperty('position');
  });

  it('emits spacing vars only when spacing is nonzero', () => {
    const css = feedNodeLayoutCss(layout({ gap: 12, padding: 8 }));

    expect(css).toMatchObject({
      gap: '12px',
      '--feed-node-gap': '12px',
      '--feed-node-gap-scale': '0.12',
      '--feed-node-padding': '8px',
    });
  });

  it('can force an explicit zero padding var for measurement-sensitive children', () => {
    const css = feedNodeLayoutCss(layout(), { forcePaddingVar: true });

    expect(css).toMatchObject({
      '--feed-node-padding': '0px',
    });
    expect(css).not.toHaveProperty('--feed-node-gap');
  });

  it('emits row and wrap only when those features are active', () => {
    const css = feedNodeLayoutCss(layout({ direction: 'row', wrap: true }));

    expect(css).toMatchObject({
      'flex-direction': 'row',
      'flex-wrap': 'wrap',
    });
  });

  it('omits width for left-right constraints', () => {
    const css = feedNodeLayoutCss(layout({ constraintH: 'left-right' }));

    expect(css).toMatchObject({
      left: '10%',
      right: '60%',
      top: '20%',
      height: '40%',
    });
    expect(css).not.toHaveProperty('width');
  });

  it('emits center constraints as center plus relative offsets', () => {
    const css = feedNodeLayoutCss(layout({ x: 0, y: 0, constraintH: 'center', constraintV: 'center' }));

    expect(css).toMatchObject({
      left: 'calc(50% + 0%)',
      top: 'calc(50% + 0%)',
      transform: 'translateX(-50%) translateY(-50%)',
    });
    expect(css).not.toHaveProperty('right');
    expect(css).not.toHaveProperty('bottom');
  });

  it('applies center constraint offsets relative to the center', () => {
    const css = feedNodeLayoutCss(layout({ x: -12, y: 8, constraintH: 'center', constraintV: 'center' }));

    expect(css).toMatchObject({
      left: 'calc(50% + -12%)',
      top: 'calc(50% + 8%)',
    });
  });

  it('emits one push-to-end margin for the active axis', () => {
    expect(feedNodeLayoutCss(layout({ mode: 'flow', slot: 'footer' }))).toMatchObject({
      'margin-top': 'auto',
    });
    expect(feedNodeLayoutCss(layout({ mode: 'flow', slot: 'footer', direction: 'row' }))).toMatchObject({
      'margin-left': 'auto',
    });
  });
});
