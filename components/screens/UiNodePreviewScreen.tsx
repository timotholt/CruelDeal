import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import { createMemo, createSignal, Show } from 'solid-js';
import {
  renderUiNodeToSolid,
  uiNodeRichTextThemeVars,
  validateUiNode,
  validateUiNodeTheme,
  type UiNodePayload,
  type UiActionPayload,
  type UiNodeRenderContext,
  type UiNodeTheme,
} from '../ui/material-lab';
import { MaterialRichText } from '../ui/material-node';

type CmsContentValue =
  | string
  | number
  | UiActionPayload['target']
  | Record<string, string | number | boolean>;

type JsonTabId = 'template' | 'cms' | 'theme';

const missionTemplate: UiNodePayload = {
  id: 'mission-card',
  type: 'panel',
  materialId: 'mission-card',
  layout: { width: '390px', height: '600px' },
  children: [
    {
      id: 'deadline-badge',
      type: 'text',
      materialId: 'mission-badge',
      contentBinding: 'mission.deadline',
      layout: { display: 'absolute', align: 'center', justify: 'center', width: '148px', height: '36px', position: { top: '60px', left: '199px' } },
    },
    {
      id: 'sector-mark',
      type: 'text',
      materialId: 'mission-sector',
      contentBinding: 'mission.sector',
      contentMode: 'rich',
      layout: { display: 'absolute', width: '70px', height: '84px', position: { top: '66px', left: '27px' } },
    },
    {
      id: 'mission-briefing',
      type: 'panel',
      materialId: 'mission-panel',
      layout: { display: 'absolute', align: 'start', justify: 'start', hMode: 'hug', width: '10.5rem', padding: 16, position: { top: '28%', left: '47%' } },
      contentBinding: 'mission.briefing',
      contentMode: 'rich',
      children: [
        {
          id: 'mission-cta',
          type: 'button',
          materialId: 'mission-cta',
          contentBinding: 'mission.ctaLabel',
          action: { id: 'viewContract', targetBinding: 'mission.viewTarget' },
          surfaceStates: {
            hover: {
              tint: 'gold',
              tintStrength: 8,
              borderOpacity: 62,
              lightStrength: 70,
              glow: 'gold',
              glowStrength: 1,
              corners: 'all',
              edgeHighlight: 'top',
              cornerSize: 17,
            },
            pressed: {
              tintStrength: 4,
              lightStrength: 8,
              darkStrength: 34,
              contentTone: 'black',
              fontWeight: 800,
              fontStyle: 'normal',
              textTransform: 'uppercase',
              letterSpacing: 0.05,
              stateScale: 0.985,
              stateTranslateY: 2,
            },
          },
          layout: { width: '100%', height: '45px' },
        },
      ],
    },
  ],
};

const cmsContent: Record<string, CmsContentValue> = {
  'mission.deadline': '03 Days Left',
  'mission.sector': 'Sector\n[black]07[/black]',
  'mission.briefing': '[h1][acc1]//[/acc1] Active Contract[/h1]\n[h2]Data\n[acc2]Extraction[/acc2][/h2][RULE][body]Extract encrypted corporate data from Solace Corp mainframe cluster.[/body][DIVIDER]\n[h1]Reward[/h1][h3]1,850 [acc1]CR[/acc1][/h3]',
  'mission.ctaLabel': 'View Contract',
  'mission.viewTarget': { kind: 'contract', id: 'contract_solace_mainframe' },
};

const feedFontCondensed = '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif';
const feedFontDin = '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif';

const uiNodeTheme: UiNodeTheme = {
  richText: {
    missionPanel: {
      align: 'left',
      base: {
        tone: 'white',
        fontFamily: feedFontCondensed,
        sizeRem: 0.65,
        lineHeight: 1.4,
        paragraphGap: -3,
        weight: 100,
        letterSpacing: 0.05,
        opacity: 90,
        embossMode: 'shadow',
        embossStrength: 50,
        embossOffset: 20,
        embossBlur: 10,
      },
      h1: {
        fontFamily: feedFontDin,
        sizeRem: 0.65,
        letterSpacing: 0.07,
        transform: 'uppercase',
        embossMode: 'inherit',
      },
      h2: {
        fontFamily: feedFontDin,
        sizeRem: 1.7,
        lineHeight: 1,
        letterSpacing: 0.02,
        transform: 'uppercase',
        embossMode: 'inherit',
      },
      h3: {
        fontFamily: feedFontDin,
        sizeRem: 1.2,
        lineHeight: 1.5,
        embossMode: 'inherit',
      },
      h4: { embossMode: 'inherit' },
      acc1: { tone: 'gold', embossMode: 'inherit' },
      acc2: { tone: 'gray', embossMode: 'inherit' },
      rule: { tone: 'gold', opacity: 76 },
      divider: { tone: 'muted', opacity: 51, thicknessPx: 1, gapTopEm: 0.8, gapBottomEm: 0.5 },
    },
    sectorMark: {
      align: 'center',
      base: {
        tone: 'muted',
        fontFamily: feedFontCondensed,
        sizeRem: 0.78,
        lineHeight: 1,
        paragraphGap: 0,
        weight: 700,
        letterSpacing: 0.02,
        transform: 'uppercase',
        opacity: 78,
        embossMode: 'dark',
        embossStrength: 100,
        embossOffset: 50,
        embossBlur: 50,
      },
    },
  },
};
const validUiNodeTheme = validateUiNodeTheme(uiNodeTheme, 'ui-node-preview-theme') ?? uiNodeTheme;

export const UiNodePreviewScreen = () => {
  const [lastAction, setLastAction] = createSignal<string>('(none)');
  const [activeJsonTab, setActiveJsonTab] = createSignal<JsonTabId>('template');
  const jsonTabs: Array<{ id: JsonTabId; label: string; meta: string; value: unknown }> = [
    { id: 'template', label: 'UI Template JSON', meta: `${missionTemplate.children?.length ?? 0} child nodes`, value: missionTemplate },
    { id: 'cms', label: 'CMS Content JSON', meta: 'copy + target', value: cmsContent },
    { id: 'theme', label: 'Theme Defaults JSON', meta: 'rich + emboss', value: uiNodeTheme },
  ];
  const activeJson = createMemo(() => jsonTabs.find((tab) => tab.id === activeJsonTab()) ?? jsonTabs[0]);

  const context: UiNodeRenderContext = {
    resolveBinding: (binding) => cmsContent[binding] as string | number | undefined,
    renderRichText: (value, node) => (
      <MaterialRichText
        value={value}
        style={uiNodeRichTextThemeVars(node.id === 'sector-mark' ? validUiNodeTheme.richText.sectorMark : validUiNodeTheme.richText.missionPanel)}
      />
    ),
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
          <section class="ui-node-preview__json-card" aria-label="UiNode JSON inspector">
            <div class="ui-node-preview__json-tabs" role="tablist" aria-label="UiNode JSON sections">
              {jsonTabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeJsonTab() === tab.id}
                  class="ui-node-preview__json-tab"
                  classList={{ 'is-active': activeJsonTab() === tab.id }}
                  onClick={() => setActiveJsonTab(tab.id)}
                >
                  {tab.label.replace(' JSON', '')}
                </button>
              ))}
            </div>
            <div class="ui-node-preview__json-head">
              <span>{activeJson().label}</span>
              <span>{activeJson().meta}</span>
            </div>
            <pre class={`ui-node-preview__payload ui-node-preview__payload--${activeJson().id}`}>{JSON.stringify(activeJson().value, null, 2)}</pre>
          </section>
        </div>
      </section>
    </div>
  );
};
