import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'solid-js/web';

import { HiddenHandIndicator } from './HiddenHandIndicator';
import { MiniDeckIndicator } from './MiniDeckIndicator';

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

describe('opponent zone transfer anchors', () => {
  it('registers the front deck card rather than the whole deck stack', () => {
    let anchor: HTMLElement | undefined;
    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => <MiniDeckIndicator count={8} anchorRef={(element) => { anchor = element; }} />,
      host,
    ));

    expect(anchor).toBeInstanceOf(HTMLSpanElement);
    expect(anchor?.classList.contains('mini-deck__back')).toBe(true);
    expect(anchor?.classList.contains('mini-deck__back--front')).toBe(true);
    expect(anchor?.dataset.zoneAnchor).toBe('remote-deck');
    expect(anchor?.dataset.cardTransferAnchor).toBe('deck');
    expect(anchor?.parentElement?.classList.contains('mini-deck__stack')).toBe(true);
  });

  it.each([
    { count: 0, left: '0px' },
    { count: 1, left: '0px' },
    { count: 2, left: '11px' },
    { count: 3, left: '22px' },
    { count: 8, left: '22px' },
  ])('registers one card-sized hand destination for count $count', ({ count, left }) => {
    let anchor: HTMLElement | undefined;
    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(
      () => <HiddenHandIndicator count={count} anchorRef={(element) => { anchor = element; }} />,
      host,
    ));

    expect(anchor).toBeInstanceOf(HTMLSpanElement);
    expect(anchor?.classList.contains('hidden-hand__transfer-anchor')).toBe(true);
    expect(anchor?.dataset.zoneAnchor).toBe('remote-hand');
    expect(anchor?.dataset.cardTransferAnchor).toBe('hand');
    expect(anchor?.style.left).toBe(left);
    expect(anchor?.parentElement?.classList.contains('hidden-hand__backs')).toBe(true);
  });
});
