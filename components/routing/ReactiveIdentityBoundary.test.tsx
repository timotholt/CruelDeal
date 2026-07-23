import { createSignal, Show } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { ReactiveIdentityBoundary } from './ReactiveIdentityBoundary';

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.();
});

describe('ReactiveIdentityBoundary', () => {
  it('keeps the owned root mounted across descendant signal updates', () => {
    const host = document.createElement('div');
    const [identity, setIdentity] = createSignal('route-a');
    const [frame, setFrame] = createSignal(0);
    let builds = 0;

    const Child = () => {
      builds += 1;
      return <div data-owned-root>{frame()}</div>;
    };

    disposers.push(render(() => (
      <ReactiveIdentityBoundary identity={identity()} render={() => <Child />} />
    ), host));

    const originalRoot = host.querySelector('[data-owned-root]');
    expect(originalRoot?.textContent).toBe('0');

    setFrame(1);

    expect(host.querySelector('[data-owned-root]')).toBe(originalRoot);
    expect(originalRoot?.textContent).toBe('1');
    expect(builds).toBe(1);

    setIdentity('route-b');

    expect(builds).toBe(2);
    expect(host.querySelector('[data-owned-root]')?.textContent).toBe('1');
    expect(host.querySelector('[data-owned-root]')).not.toBe(originalRoot);
  });

  it('keeps one route owner while nested control flow replaces its contents', () => {
    const host = document.createElement('div');
    const [identity] = createSignal('play-route');
    const [matchReady, setMatchReady] = createSignal(false);
    let builds = 0;

    const Route = () => {
      builds += 1;
      return (
        <div data-route-root>
          <Show when={matchReady()} fallback={<div data-deck-picker />}>
            <div data-live-match />
          </Show>
        </div>
      );
    };

    disposers.push(render(() => (
      <ReactiveIdentityBoundary identity={identity()} render={() => <Route />} />
    ), host));

    const routeRoot = host.querySelector('[data-route-root]');
    expect(routeRoot?.querySelector('[data-deck-picker]')).not.toBeNull();

    setMatchReady(true);

    expect(host.querySelectorAll('[data-route-root]')).toHaveLength(1);
    expect(host.querySelector('[data-route-root]')).toBe(routeRoot);
    expect(routeRoot?.querySelector('[data-live-match]')).not.toBeNull();
    expect(builds).toBe(1);
  });
});
