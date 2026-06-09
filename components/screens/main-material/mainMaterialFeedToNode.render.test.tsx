import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'solid-js/web';
import { MaterialNodeRenderer } from '../../ui/material-node/MaterialNodeRenderer';
import {
  MaterialNodeDomRegistrationProvider,
  type MaterialNodeDomRegistration,
} from '../../ui/material-node/MaterialNodeFrame';
import type { MaterialNodeRenderContext } from '../../ui/material-node/MaterialNodeTypes';
import { createDefaultFeedCardTypes, mockFeedStories } from './mainMaterialFeedModel';
import { feedStoryValue, feedTextHasMarkup } from './mainMaterialFeedText';
import { feedCardTypeToMaterialNodeTree } from './mainMaterialFeedToNode';

// jsdom lacks a couple browser APIs the surface host may touch at mount.
(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const cardTypes = createDefaultFeedCardTypes() as Record<string, any>;
const cardType = cardTypes.card_type_01;
const story = (mockFeedStories as any[]).find((s) => s.cardTypeId === 'card_type_01');
const tree = feedCardTypeToMaterialNodeTree(cardType);
const context: MaterialNodeRenderContext = {
  treeId: 'parity-test',
  resolveBinding: (binding) => feedStoryValue(story, binding as any),
};

const collectBindings = (node: any, out: string[] = []): string[] => {
  if (node.binding) out.push(node.binding);
  (node.children || []).forEach((c: any) => collectBindings(c, out));
  return out;
};

const countFeedNodes = (nodes: any[]): number =>
  nodes.reduce((n, x) => n + 1 + countFeedNodes(x.children || []), 0);

describe('Phase 2b: canonical renderer parity on bridged feed tree', () => {
  let container: HTMLElement | undefined;
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    container?.remove();
    dispose = undefined;
    container = undefined;
  });

  const mount = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => MaterialNodeRenderer({ node: tree, context }) as any, container);
    return container;
  };

  it('mounts without crashing and emits one material-node per source node', () => {
    const el = mount();
    const rendered = el.querySelectorAll('.material-node');
    const bg = cardType.backgroundImage;
    const bgCount = !bg?.enabled ? 0 : bg.fadeMode !== 'none' ? 2 : 1;
    const expected = 1 + bgCount + countFeedNodes(cardType.children); // root + bg/fade + nodes
    expect(rendered.length).toBe(expected);
  });

  it('emits the canonical kind classes', () => {
    const el = mount();
    expect(el.querySelector('.material-node--container')).toBeTruthy();
    expect(el.querySelector('.material-node--text')).toBeTruthy();
  });

  it('resolves bound story copy into the rendered DOM (content parity)', () => {
    const el = mount();
    const txt = el.textContent || '';
    const resolved = collectBindings(cardType)
      .map((b) => feedStoryValue(story, b as any))
      .filter((v) => typeof v === 'string' && v.trim().length > 3 && !feedTextHasMarkup(v));
    expect(resolved.length).toBeGreaterThan(0);
    for (const v of resolved) {
      expect(txt).toContain(v.trim());
    }
  });

  it('registers every node element with a provided DOM registration (2c-i)', () => {
    let next = 0;
    const registered: Array<{ targetId: string; el: HTMLElement }> = [];
    const unregistered: string[] = [];
    const registration: MaterialNodeDomRegistration = {
      createInstanceId: () => `reg-${next++}`,
      register: (targetId, _instanceId, element) => registered.push({ targetId, el: element }),
      unregister: (instanceId) => unregistered.push(instanceId),
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(
      () => (
        <MaterialNodeDomRegistrationProvider registration={registration}>
          <MaterialNodeRenderer node={tree} context={context} />
        </MaterialNodeDomRegistrationProvider>
      ),
      container,
    );
    const rendered = container.querySelectorAll('.material-node').length;
    // one registration per mounted node element
    expect(registered.length).toBe(rendered);
    // each registration carries the live element and a non-empty target id
    for (const r of registered) {
      expect(r.el).toBeInstanceOf((globalThis as any).HTMLElement);
      expect(r.el.getAttribute('data-material-target-id')).toBe(r.targetId);
      expect(r.targetId.length).toBeGreaterThan(0);
    }
    // cleanup unregisters everything
    dispose();
    dispose = undefined;
    expect(unregistered.length).toBe(registered.length);
  });
});
