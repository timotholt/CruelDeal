import '../../src/styles/ui-material-lab.css';
import '../../src/styles/main-material-preview.css';
import { createMemo, createSignal, Show } from 'solid-js';
import {
  renderUiNodeToSolid,
  uiNodeRichTextThemeVars,
  validateUiNode,
  type UiNodePayload,
  type UiActionPayload,
  type UiNodeRenderContext,
  type UiNodeRichTextTheme,
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
      layout: { display: 'absolute', align: 'center', justify: 'center', width: '140px', height: '28px', position: { top: '96px', right: '42px' } },
    },
    {
      id: 'sector-mark',
      type: 'text',
      materialId: 'mission-sector',
      contentBinding: 'mission.sector',
      contentMode: 'rich',
      layout: { display: 'absolute', width: '92px', height: '70px', position: { top: '124px', left: '36px' } },
    },
    {
      id: 'mission-briefing',
      type: 'panel',
      materialId: 'mission-panel',
      layout: { display: 'absolute', align: 'start', justify: 'start', width: '202px', height: '350px', padding: 16, position: { top: '166px', right: '34px' } },
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
              contentTone: 'black',
              fontWeight: 800,
              fontStyle: 'normal',
              textTransform: 'uppercase',
              letterSpacing: 0.05,
            },
          },
          layout: { width: '142px', height: '36px' },
        },
      ],
    },
  ],
};

const cmsContent: Record<string, CmsContentValue> = {
  'mission.deadline': '03 Days Left',
  'mission.sector': 'Sector\n[black]07[/black]',
  'mission.briefing': '[h1][acc1]//[/acc1] Active Contract[/h1]\n[h2]Data\n[acc2]Extraction[/acc2][/h2][RULE][body]Extract encrypted corporate data from Solace Corp mainframe cluster.[/body][DIVIDER]\n[h4]Reward[/h4][h3]1,850 [acc1]CR[/acc1][/h3]',
  'mission.ctaLabel': 'View Contract',
  'mission.viewTarget': { kind: 'contract', id: 'contract_solace_mainframe' },
};

const feedFontCondensed = '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif';
const feedFontDin = '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif';
const feedFontSystem = 'ui-sans-serif, system-ui, sans-serif';

const uiNodeTheme: { richText: Record<string, UiNodeRichTextTheme> } = {
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
        transform: 'none',
        opacity: 90,
        embossMode: 'shadow',
        embossStrength: 50,
      },
      normal: {
        tone: 'white',
        fontFamily: feedFontSystem,
        sizeEm: 1.1,
        lineHeight: 1,
        weight: 500,
        transform: 'none',
        embossMode: 'dark',
        embossStrength: 100,
      },
      body: {
        tone: 'white',
        fontFamily: feedFontSystem,
        sizeEm: 1.1,
        lineHeight: 1,
        weight: 500,
        transform: 'none',
        embossMode: 'dark',
        embossStrength: 100,
      },
      h1: {
        tone: 'white',
        fontFamily: feedFontDin,
        sizeEm: 0.65,
        lineHeight: 1,
        weight: 600,
        letterSpacing: 0.07,
        transform: 'uppercase',
        opacity: 70,
      },
      h2: {
        tone: 'white',
        fontFamily: feedFontDin,
        sizeEm: 1.7,
        lineHeight: 1,
        weight: 700,
        letterSpacing: 0.02,
        transform: 'uppercase',
      },
      h3: {
        tone: 'white',
        fontFamily: feedFontDin,
        sizeEm: 1.2,
        lineHeight: 1.5,
        weight: 600,
        letterSpacing: 0.02,
        transform: 'uppercase',
        opacity: 94,
      },
      h4: {
        tone: 'muted',
        fontFamily: feedFontCondensed,
        sizeEm: 0.8,
        lineHeight: 1,
        weight: 600,
        letterSpacing: 0.08,
        transform: 'uppercase',
        opacity: 84,
        embossMode: 'dark',
        embossStrength: 100,
      },
      acc1: { tone: 'gold', letterSpacing: 0.08, transform: 'inherit', opacity: 90 },
      acc2: { tone: 'gray', letterSpacing: 0.02, transform: 'uppercase', opacity: 94 },
      rule: { tone: 'gold', opacity: 100 },
      divider: { tone: 'white', opacity: 34, thicknessPx: 1, gapTopEm: 0.9, gapBottomEm: 0.78 },
    },
    sectorMark: {
      align: 'center',
      base: {
        tone: 'gold',
        fontFamily: feedFontDin,
        sizeRem: 0.74,
        lineHeight: 0.92,
        paragraphGap: 0,
        weight: 800,
        letterSpacing: 0.08,
        transform: 'uppercase',
        opacity: 90,
        embossMode: 'shadow',
        embossStrength: 50,
      },
      normal: { tone: 'gold', sizeEm: 0.82, opacity: 78 },
      acc1: { tone: 'gold' },
    },
  },
};

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
        style={uiNodeRichTextThemeVars(node.id === 'sector-mark' ? uiNodeTheme.richText.sectorMark : uiNodeTheme.richText.missionPanel)}
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
