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

  it('resolves absolute size modes to fixed, hug, and fill CSS', () => {
    expect(feedNodeLayoutCss(layout({ wMode: 'fixed', hMode: 'fixed' }))).toMatchObject({
      width: '30%',
      height: '40%',
    });
    expect(feedNodeLayoutCss(layout({ wMode: 'hug', hMode: 'hug' }))).toMatchObject({
      width: 'max-content',
      height: 'auto',
    });
    expect(feedNodeLayoutCss(layout({ wMode: 'fill', hMode: 'fill' }))).toMatchObject({
      width: '100%',
      height: '100%',
    });
  });

  it('resolves in-flow size modes to flex-compatible inline CSS', () => {
    const fixed = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'in-flow',
      wMode: 'fixed',
      hMode: 'fixed',
    }));
    expect(fixed).toMatchObject({
      position: 'relative',
      width: '30%',
      height: '40%',
    });

    const hug = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'in-flow',
      wMode: 'hug',
      hMode: 'hug',
    }));
    expect(hug).toMatchObject({
      position: 'relative',
      width: 'max-content',
      height: 'auto',
    });

    const fill = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'in-flow',
      wMode: 'fill',
      hMode: 'fill',
    }));
    expect(fill).toMatchObject({
      position: 'relative',
      width: 'auto',
      height: 'auto',
    });
  });

  it('keeps in-flow nodes relative and omits absolute offsets', () => {
    const css = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'in-flow',
      slot: 'body',
      x: 40,
      y: 50,
      constraintH: 'right',
      constraintV: 'bottom',
    }));

    expect(css).toMatchObject({
      position: 'relative',
      width: '30%',
      height: '40%',
    });
    expect(css).not.toHaveProperty('left');
    expect(css).not.toHaveProperty('right');
    expect(css).not.toHaveProperty('top');
    expect(css).not.toHaveProperty('bottom');
  });

  it('treats overlay flow nodes as absolute by default', () => {
    const css = feedNodeLayoutCss(layout({ mode: 'flow', slot: 'overlay' }));

    expect(css).toMatchObject({
      left: '10%',
      top: '20%',
      width: '30%',
      height: '40%',
    });
    expect(css).not.toHaveProperty('position');
  });

  it('applies flow nudges as transforms without clobbering center constraints', () => {
    const inFlow = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'in-flow',
      nudgeX: 12,
      nudgeY: -8,
    }));
    expect(inFlow).toMatchObject({
      position: 'relative',
      transform: 'translate(12px, -8px)',
    });

    const centeredAbsoluteFlow = feedNodeLayoutCss(layout({
      mode: 'flow',
      selfPosition: 'absolute',
      constraintH: 'center',
      constraintV: 'center',
      nudgeX: 12,
      nudgeY: -8,
    }));
    expect(centeredAbsoluteFlow).toMatchObject({
      left: 'calc(50% + 10%)',
      top: 'calc(50% + 20%)',
      transform: 'translateX(-50%) translateY(-50%) translate(12px, -8px)',
    });
  });

  it('maps spread and cross-axis alignment to flex declarations', () => {
    expect(feedNodeLayoutCss(layout({ distribute: 'between', crossAlign: 'stretch' }))).toMatchObject({
      'justify-content': 'space-between',
      'align-items': 'stretch',
    });
    expect(feedNodeLayoutCss(layout({ distribute: 'around', crossAlign: 'end' }))).toMatchObject({
      'justify-content': 'space-around',
      'align-items': 'flex-end',
    });
    expect(feedNodeLayoutCss(layout({ distribute: 'evenly', crossAlign: 'center' }))).toMatchObject({
      'justify-content': 'space-evenly',
      'align-items': 'center',
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
    expect(feedNodeLayoutCss(layout({ mode: 'flow', slot: 'body', pushToEnd: true }))).toMatchObject({
      'margin-top': 'auto',
    });
    expect(feedNodeLayoutCss(layout({ mode: 'flow', slot: 'footer', pushToEnd: false }))).not.toHaveProperty('margin-top');
  });
});
