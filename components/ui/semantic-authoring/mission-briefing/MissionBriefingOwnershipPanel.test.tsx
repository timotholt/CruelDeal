import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import sourceFixture from './__fixtures__/mission-briefing-v1.inline.json';
import appearanceFixture from '../../semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.json';
import { dispatchMissionBriefingCommand } from './missionBriefingCommands';
import type { MissionBriefingSourceV1 } from './missionBriefingSource';
import type { MissionAppearanceDocumentV1 } from '../../semantic-compiler/paint/paintSource';
import { MissionBriefingOwnershipPanel } from './MissionBriefingOwnershipPanel';

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
});

describe('MissionBriefingOwnershipPanel control registry integration', () => {
  it('renders numeric controls with ranges from their named authoring rules', () => {
    const source = structuredClone(sourceFixture) as MissionBriefingSourceV1;
    const appearance = structuredClone(appearanceFixture) as MissionAppearanceDocumentV1;
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = render(() => (
      <MissionBriefingOwnershipPanel
        source={source}
        defaults={source}
        appearance={appearance}
        status="ready"
        canUndo={false}
        canRedo={false}
        compiled={false}
        onCommand={(command) => dispatchMissionBriefingCommand(source, command)}
        onAppearanceChange={() => undefined}
        onUndo={() => undefined}
        onRedo={() => undefined}
        onCompile={() => undefined}
        onReturnToLive={() => undefined}
        onCopy={() => undefined}
        onCopyAppearance={() => undefined}
      />
    ), container);

    const lineHeight = container.querySelector<HTMLInputElement>('[data-control-rule="type.lineHeight"]')!;
    expect([lineHeight.min, lineHeight.max, lineHeight.step]).toEqual(['0.5', '3', '0.02']);

    const glassBlur = container.querySelector<HTMLInputElement>('[data-control-rule="paint.glass.blurPx"]')!;
    expect([glassBlur.min, glassBlur.max, glassBlur.step]).toEqual(['0', '64', '0.25']);

    const wearWidth = container.querySelector<HTMLInputElement>('[data-control-rule="paint.edgeWear.widthPx"]')!;
    expect([wearWidth.min, wearWidth.max, wearWidth.step]).toEqual(['0.5', '16', '0.1']);
  });
});
