import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import fixture from '../../semantic-authoring/mission-briefing/__fixtures__/mission-briefing-v1.inline.json';
import appearance from '../../semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.json';
import { compileMissionBriefingComponentV1 } from '../../semantic-compiler/mission-briefing/missionBriefingComponentCompiler';
import { MissionBriefingRuntime } from './MissionBriefingRuntime';

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
});

describe('MissionBriefing minimal semantic DOM', () => {
  it('contains content/layout semantics and no paint-layer children', async () => {
    const compiled = compileMissionBriefingComponentV1(fixture, appearance);
    if (!compiled.ok) throw new Error('Fixture must compile.');
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <MissionBriefingRuntime plan={compiled.plan} onAction={() => undefined} />
    ), container);

    expect(container.querySelectorAll('[data-semantic-component="MissionBriefing"]')).toHaveLength(1);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelectorAll('dl')).toHaveLength(1);
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].children).toHaveLength(0);
    expect(buttons[0].textContent).toBe('Accept Terms');
    expect(container.querySelector('[data-paint-helper], [aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('[class*="cd-surface__"]')).toBeNull();
    await expect(`${container.innerHTML}\n`).toMatchFileSnapshot('./__fixtures__/mission-v2-r0.dom.html');
  });

  it('applies editor-only selection decoration to the semantic part that owns it', () => {
    const compiled = compileMissionBriefingComponentV1(fixture, appearance);
    if (!compiled.ok) throw new Error('Fixture must compile.');
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <MissionBriefingRuntime
        plan={compiled.plan}
        selectionClassForPart={(part) => part === 'primaryAction' ? 'is-editing-persistent' : ''}
        onAction={() => undefined}
      />
    ), container);

    expect(container.querySelector('.mission-briefing-runtime')?.classList.contains('is-editing-persistent')).toBe(false);
    expect(container.querySelector('.mission-briefing-runtime__footer')?.classList.contains('is-editing-persistent')).toBe(false);
    expect(container.querySelector('.mission-briefing-runtime__action')?.classList.contains('is-editing-persistent')).toBe(true);
  });

  it('reserves a bounded action helper across states and changes only its paint class', () => {
    const authored = structuredClone(appearance);
    const holding = authored.graphs.find((graph) => graph.id === 'mission-v2-r0.primary-action.holding');
    if (!holding) throw new Error('Holding appearance graph is required.');
    holding.layers.push({
      id: 'fingerprint-secondary',
      type: 'maskImage',
      enabled: true,
      assetId: 'fingerprint-svgrepo-v1',
      color: '#ffffff',
      opacity: 0.1,
    } as never, {
      id: 'scan-secondary',
      type: 'scanLine',
      enabled: true,
      color: '#ffffff',
      opacity: 0.12,
      thicknessPx: 2,
      glowBlurPx: 4,
    } as never);
    const compiled = compileMissionBriefingComponentV1(fixture, authored);
    if (!compiled.ok) throw new Error(compiled.issues[0]?.message ?? 'Bounded helper fixture must compile.');
    expect(compiled.plan.shellMap?.primaryAction.slots).toEqual({
      underlay: true,
      overlay: true,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <MissionBriefingRuntime plan={compiled.plan} onAction={() => undefined} />
    ), container);

    const button = container.querySelector('button')!;
    const helper = button.querySelector<HTMLElement>('[data-paint-helper="underlay"]')!;
    const overlay = button.querySelector<HTMLElement>('[data-paint-helper="overlay"]')!;
    expect(helper).toBeTruthy();
    expect(overlay).toBeTruthy();
    expect(helper.classList.contains('ui-paint-mission-v2-r0-primary-action-holding__underlay')).toBe(false);
    expect(overlay.classList.contains('ui-paint-mission-v2-r0-primary-action-holding__overlay')).toBe(false);

    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperties(pointerDown, {
      button: { value: 0 },
      isPrimary: { value: true },
      pointerId: { value: 1 },
    });
    button.dispatchEvent(pointerDown);

    expect(button.dataset.holdState).toBe('holding');
    expect(button.querySelector('[data-paint-helper="underlay"]')).toBe(helper);
    expect(button.querySelector('[data-paint-helper="overlay"]')).toBe(overlay);
    expect(helper.classList.contains('ui-paint-mission-v2-r0-primary-action-holding__underlay')).toBe(true);
    expect(overlay.classList.contains('ui-paint-mission-v2-r0-primary-action-holding__overlay')).toBe(true);

    button.dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(button.dataset.holdState).toBe('idle');
    expect(button.querySelector('[data-paint-helper="underlay"]')).toBe(helper);
    expect(button.querySelector('[data-paint-helper="overlay"]')).toBe(overlay);
  });
});
