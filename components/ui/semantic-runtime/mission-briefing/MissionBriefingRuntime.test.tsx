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
});
