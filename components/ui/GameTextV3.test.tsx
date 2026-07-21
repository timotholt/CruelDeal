import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';

import { GameTextV3 } from './GameTextV3';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

(globalThis as { ResizeObserver?: typeof ResizeObserverStub }).ResizeObserver ??= ResizeObserverStub;

const originalDescriptors = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
};
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

const restoreDescriptor = (name: keyof typeof originalDescriptors) => {
  const descriptor = originalDescriptors[name];
  if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
};

afterEach(() => {
  (Object.keys(originalDescriptors) as Array<keyof typeof originalDescriptors>).forEach(restoreDescriptor);
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.replaceChildren();
});

describe('GameTextV3 layout fitting', () => {
  it('ignores ancestor paint transforms when comparing layout overflow', () => {
    for (const [name, value] of Object.entries({
      clientWidth: 100,
      clientHeight: 40,
      offsetWidth: 100,
      offsetHeight: 20,
      scrollWidth: 100,
      scrollHeight: 20,
    })) {
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        get: () => value,
      });
    }
    HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 90, 36);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const dispose = render(
      () => (
        <GameTextV3
          text="LEON"
          baseFontSize={1.05}
          fitMode="paragraph"
          maxLines={100}
          minScale={0.48}
        />
      ),
      host,
    );

    expect(host.querySelector('[data-game-text="inner"]')?.getAttribute('data-game-text-scale')).toBe('1.0000');
    dispose();
  });
});
