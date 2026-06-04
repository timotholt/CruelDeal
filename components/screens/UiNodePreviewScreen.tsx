import '../../src/styles/ui-material-lab.css';
import { createSignal, Show } from 'solid-js';
import {
  renderUiNodeToSolid,
  validateUiNode,
  type UiNodePayload,
  type UiActionPayload,
  type UiNodeRenderContext,
} from '../ui/material-lab';

type CmsContentValue =
  | string
  | number
  | UiActionPayload['target']
  | Record<string, string | number | boolean>;

const missionTemplate: UiNodePayload = {
  id: 'mission-card',
  type: 'panel',
  materialId: 'mission-card',
  layout: { width: '460px', height: '268px' },
  children: [
    {
      id: 'deadline-badge',
      type: 'text',
      materialId: 'mission-badge',
      contentBinding: 'mission.deadline',
      layout: { display: 'flex', align: 'center', justify: 'center', width: '104px', height: '22px', position: { top: '22px', right: '50px' } },
    },
    {
      id: 'sector-mark',
      type: 'text',
      materialId: 'mission-sector',
      contentBinding: 'mission.sector',
      layout: { width: '78px', height: '50px', position: { top: '35px', left: '28px' } },
    },
    {
      id: 'mission-briefing',
      type: 'panel',
      materialId: 'mission-panel',
      layout: { display: 'flex', direction: 'column', gap: 6, padding: 14, width: '236px', height: '168px', position: { top: '72px', right: '46px' } },
      children: [
        { id: 'mission-eyebrow', type: 'text', contentBinding: 'mission.eyebrow' },
        { id: 'mission-title', type: 'text', contentBinding: 'mission.title' },
        { id: 'mission-body', type: 'text', contentBinding: 'mission.body' },
        { id: 'mission-reward-label', type: 'text', contentBinding: 'mission.rewardLabel' },
        { id: 'mission-reward-value', type: 'text', contentBinding: 'mission.rewardValue' },
        {
          id: 'mission-cta',
          type: 'button',
          materialId: 'mission-cta',
          text: 'View Contract',
          action: { id: 'viewContract', targetBinding: 'mission.viewTarget' },
          surfaceStates: {
            hover: {
              tint: 'gold',
              tintStrength: 8,
              borderOpacity: 62,
              lightStrength: 70,
            },
            pressed: {
              tint: 'gold',
              tintStrength: 24,
              glow: 'gold',
              glowStrength: 48,
              corners: 'bottom',
              emission: 'center-blip',
              emissionTone: 'gold',
              emissionStrength: 58,
              stateScale: 0.985,
              stateTranslateY: 1,
            },
          },
          layout: { width: '100%', height: '30px' },
        },
      ],
    },
  ],
};

const cmsContent: Record<string, CmsContentValue> = {
  'mission.deadline': '03 Days Left',
  'mission.sector': 'Sector\n07',
  'mission.eyebrow': '// Active Contract',
  'mission.title': 'Data\nExtraction',
  'mission.body': 'Extract encrypted corporate data from Solace Corp mainframe cluster.',
  'mission.rewardLabel': 'Reward',
  'mission.rewardValue': '1,850 CR',
  'mission.viewTarget': { kind: 'contract', id: 'contract_solace_mainframe' },
};

export const UiNodePreviewScreen = () => {
  const [lastAction, setLastAction] = createSignal<string>('(none)');

  const context: UiNodeRenderContext = {
    resolveBinding: (binding) => cmsContent[binding] as string | number | undefined,
    resolveActionTarget: (binding) => cmsContent[binding] as UiActionPayload['target'] | undefined,
    onAction: (action) => setLastAction(`${action.id} ${JSON.stringify(action.target ?? action.params ?? {})}`),
  };

  // Fail-closed: a malformed payload validates to null and we render nothing.
  const node = validateUiNode(missionTemplate, 'ui-node-preview');

  return (
    <div class="ui-node-preview">
      <header class="ui-node-preview__header">
        <p>Server-driven surface proof</p>
        <h1>UiNodePayload → Surface</h1>
      </header>

      <section class="ui-node-preview__grid">
        <div class="ui-node-preview__render">
          <div class="ui-node-preview__section-label">Rendered node</div>
          <Show when={node} fallback={<p class="ui-node-preview__error">Payload failed validation (rendered nothing - fail closed).</p>}>
            {(valid) => renderUiNodeToSolid(valid(), context)}
          </Show>
          <p class="ui-node-preview__last-action">
            last action: {lastAction()}
          </p>
        </div>

        <div class="ui-node-preview__json-stack">
          <section class="ui-node-preview__json-card" aria-label="UiNode payload JSON">
            <div class="ui-node-preview__json-head">
              <span>UI Template JSON</span>
              <span>{missionTemplate.children?.length ?? 0} child nodes</span>
            </div>
            <pre class="ui-node-preview__payload">{JSON.stringify(missionTemplate, null, 2)}</pre>
          </section>

          <section class="ui-node-preview__json-card" aria-label="CMS content JSON">
            <div class="ui-node-preview__json-head">
              <span>CMS Content JSON</span>
              <span>copy + target</span>
            </div>
            <pre class="ui-node-preview__payload ui-node-preview__payload--cms">{JSON.stringify(cmsContent, null, 2)}</pre>
          </section>
        </div>
      </section>
    </div>
  );
};
