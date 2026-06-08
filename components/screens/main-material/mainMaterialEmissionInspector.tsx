import { For, Show } from 'solid-js';
import type { EmissionMetrics, MaterialEmissionPlan } from '../../ui/material-lab';
import {
  auditToken,
  styleProvenance,
  type DomAuditNode,
  type DomAuditToken,
} from './mainMaterialDomAudit';
import {
  cssDeclarationText,
  type EmissionInspectorTab,
} from './mainMaterialEmissionOutput';

const EmissionMetricsSummary = (props: { metrics: EmissionMetrics }) => (
  <div class="main-material-emission-metrics">
    <span>nodes <strong>{props.metrics.nodeCount}</strong></span>
    <span>classes <strong>{props.metrics.classCount}</strong></span>
    <span>attrs <strong>{props.metrics.attrCount}</strong></span>
    <span>styles <strong>{props.metrics.styleCount}</strong></span>
    <span>vars <strong>{props.metrics.cssVariableCount}</strong></span>
  </div>
);

const DomProvenanceChip = (props: { token: DomAuditToken }) => (
  <span
    class={`main-material-dom-source main-material-dom-source--${props.token.source} ${props.token.kind === 'unknown' ? 'is-unknown' : ''}`}
    title={props.token.reason}
  >
    {props.token.source}
  </span>
);

const DomAttributeToken = (props: {
  name: string;
  tokens: DomAuditToken[];
  showBadges: boolean;
  onToggleClass?: (key: string, className: string) => void;
}) => (
  <span class="main-material-dom-attr">
    <span class="main-material-dom-attr__name">{props.name}</span>
    <span class="main-material-dom-attr__equals">=</span>
    <span class="main-material-dom-attr__quote">"</span>
    <For each={props.tokens}>
      {(token, index) => (
        <>
          <span
            class={`main-material-dom-attr__value ${token.kind === 'unknown' ? 'is-unknown' : ''} ${props.name === 'class' && props.onToggleClass ? 'is-toggleable' : ''}`}
            title={props.name === 'class' && props.onToggleClass
              ? `${token.reason}. ${token.cssRules?.length ? `CSS rules:\n${token.cssRules.join('\n')}` : 'No matching CSS rules found in loaded stylesheets.'}\nClick to hide this class in the inspector.`
              : token.reason}
            onClick={() => props.name === 'class' && props.onToggleClass?.(token.key, token.value)}
          >
            {index() > 0 ? ' ' : ''}{token.value}
          </span>
          <Show when={props.showBadges}>
            <DomProvenanceChip token={token} />
          </Show>
        </>
      )}
    </For>
    <span class="main-material-dom-attr__quote">"</span>
  </span>
);

const DomStyleToken = (props: { token: DomAuditToken; showBadges: boolean }) => (
  <span class="main-material-dom-style-token">
    <span class="main-material-dom-style-token__name">{props.token.name}</span>
    <span class="main-material-dom-style-token__punct">: </span>
    <span class={`main-material-dom-style-token__value ${props.token.kind === 'unknown' ? 'is-unknown' : ''}`} title={props.token.reason}>
      {props.token.value}
    </span>
    <span class="main-material-dom-style-token__punct">;</span>
    <Show when={props.showBadges}>
      <DomProvenanceChip token={props.token} />
    </Show>
  </span>
);

const DomAuditTree = (props: {
  node: DomAuditNode;
  showBadges: boolean;
  onToggleClass?: (key: string, className: string) => void;
}) => (
  <div class="main-material-dom-node">
    <div class="main-material-dom-line">
      <span class="main-material-dom-punct">&lt;</span>
      <span class="main-material-dom-tag">{props.node.tag}</span>
      <Show when={props.node.classes.length}>
        <span> </span>
        <DomAttributeToken name="class" tokens={props.node.classes} showBadges={props.showBadges} onToggleClass={props.onToggleClass} />
      </Show>
      <For each={props.node.attrs}>
        {(token) => (
          <>
            <span> </span>
            <DomAttributeToken name={token.name} tokens={[token]} showBadges={props.showBadges} />
          </>
        )}
      </For>
      <Show when={props.node.styles.length}>
        <span> </span>
        <span class="main-material-dom-attr">
          <span class="main-material-dom-attr__name">style</span>
          <span class="main-material-dom-attr__equals">=</span>
          <span class="main-material-dom-attr__quote">"</span>
          <span class="main-material-dom-style-list">
            <For each={props.node.styles}>{(token) => <DomStyleToken token={token} showBadges={props.showBadges} />}</For>
          </span>
          <span class="main-material-dom-attr__quote">"</span>
        </span>
      </Show>
      <span class="main-material-dom-punct">&gt;</span>
      <Show when={props.node.text}>
        {(text) => <span class="main-material-dom-node__text">{text()}</span>}
      </Show>
    </div>
    <Show when={props.node.children.length}>
      <div class="main-material-dom-node__children">
        <For each={props.node.children}>{(child) => <DomAuditTree node={child} showBadges={props.showBadges} onToggleClass={props.onToggleClass} />}</For>
      </div>
    </Show>
    <Show when={props.node.children.length}>
      <div class="main-material-dom-line main-material-dom-line--close">
        <span class="main-material-dom-punct">&lt;/</span>
        <span class="main-material-dom-tag">{props.node.tag}</span>
        <span class="main-material-dom-punct">&gt;</span>
      </div>
    </Show>
  </div>
);

const ExportCssAudit = (props: { css: string; showBadges: boolean }) => {
  const rules = () => props.css
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule, ruleIndex) => {
      const open = rule.indexOf('{');
      const close = rule.lastIndexOf('}');
      const selector = open >= 0 ? rule.slice(0, open).trim() : rule;
      const body = open >= 0 && close > open ? rule.slice(open + 1, close).trim() : '';
      const declarations = body
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf(':');
          const name = separator >= 0 ? part.slice(0, separator).trim() : part;
          const value = separator >= 0 ? part.slice(separator + 1).trim() : '';
          return auditToken(`export-css:${ruleIndex}:${name}`, name, value, styleProvenance(name));
        });
      return { selector, declarations };
    });

  return (
    <div class="main-material-css-audit">
      <For each={rules()}>
        {(rule) => (
          <div class="main-material-css-rule">
            <div class="main-material-dom-line">
              <span class="main-material-dom-tag">{rule.selector}</span>
              <span class="main-material-dom-punct"> {'{'}</span>
            </div>
            <div class="main-material-css-rule__body">
              <For each={rule.declarations}>
                {(token) => <DomStyleToken token={token} showBadges={props.showBadges} />}
              </For>
            </div>
            <div class="main-material-dom-line">
              <span class="main-material-dom-punct">{'}'}</span>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

const BadgeToggle = (props: { showBadges: boolean; onToggle: () => void }) => (
  <button type="button" class={`ui-lab-mini-button ${props.showBadges ? 'is-active' : ''}`} onClick={props.onToggle}>
    badges {props.showBadges ? 'on' : 'off'}
  </button>
);


export const EmissionInspector = (props: {
  open: boolean;
  tab: EmissionInspectorTab;
  position: { x: number; y: number };
  targetLabel: string;
  targetId: string;
  cssLines: Array<[string, string | number]>;
  disabledKeys: ReadonlySet<string>;
  domSnapshot: DomAuditNode | null;
  editorMetrics: EmissionMetrics;
  exportPlan: MaterialEmissionPlan | null;
  exportDomSnapshot: DomAuditNode | null;
  exportMetrics: EmissionMetrics;
  exportHtml: string;
  exportCss: string;
  status: string;
  onToggleOpen: () => void;
  onTabChange: (tab: EmissionInspectorTab) => void;
  onToggleCssKey: (key: string) => void;
  onResetCss: () => void;
  onRefreshActive: () => void;
  onCopyActive: () => void;
  showBadges: boolean;
  onToggleBadges: () => void;
  onToggleDomClass: (key: string, className: string) => void;
  onDragStart: (event: PointerEvent & { currentTarget: HTMLDivElement }) => void;
}) => (
  <div
    class={`main-material-emission-inspector ${props.open ? 'is-open' : 'is-collapsed'}`}
    style={{ left: `${props.position.x}px`, top: `${props.position.y}px` }}
  >
    <div class="main-material-emission-inspector__header" onPointerDown={props.onDragStart}>
      <div class="main-material-emission-inspector__title">
        <span>Emission</span>
        <small>{props.targetLabel}</small>
      </div>
      <button type="button" class="ui-lab-mini-button" onPointerDown={(event) => event.stopPropagation()} onClick={props.onToggleOpen}>
        {props.open ? 'hide' : 'show'}
      </button>
    </div>
    <Show when={props.open}>
      <div class="main-material-emission-inspector__body">
        <div class="main-material-emission-inspector__tabs">
          <button type="button" class={props.tab === 'export-dom' ? 'is-active' : ''} onClick={() => props.onTabChange('export-dom')}>Export DOM</button>
          <button type="button" class={props.tab === 'export-css' ? 'is-active' : ''} onClick={() => props.onTabChange('export-css')}>Export CSS</button>
          <button type="button" class={props.tab === 'editor-dom' ? 'is-active' : ''} onClick={() => props.onTabChange('editor-dom')}>Editor DOM</button>
          <button type="button" class={props.tab === 'frame-css' ? 'is-active' : ''} onClick={() => props.onTabChange('frame-css')}>Frame CSS</button>
        </div>
        <div class="main-material-emission-inspector__target">
          <code>{props.targetId}</code>
        </div>
        <div class="main-material-emission-inspector__toolbar">
          <div class={`main-material-emission-inspector__status ${props.status ? '' : 'is-idle'}`}>
            {props.status || 'Ready'}
          </div>
          <div class="main-material-emission-inspector__panel-actions">
            <button type="button" class="ui-lab-mini-button" onClick={props.onCopyActive}>copy</button>
            <button type="button" class="ui-lab-mini-button" onClick={props.onRefreshActive}>refresh</button>
          </div>
        </div>
        <Show when={props.tab === 'editor-dom'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Editor DOM Payload</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <EmissionMetricsSummary metrics={props.editorMetrics} />
            <p class="main-material-emission-help">
              Live selected editor subtree, cleaned of editor flash. Click class values to hide/show them in this inspector; refresh restores the live emitted DOM.
            </p>
            <Show when={props.domSnapshot} fallback={<p class="main-material-emission-empty">No matching DOM node.</p>}>
              {(node) => <DomAuditTree node={node()} showBadges={props.showBadges} onToggleClass={props.onToggleDomClass} />}
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'export-dom'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Export DOM Payload</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <EmissionMetricsSummary metrics={props.exportMetrics} />
            <Show when={props.exportPlan} fallback={<p class="main-material-emission-empty">Export emission is currently implemented for selected feed CTA/button nodes only.</p>}>
              <Show when={props.showBadges && props.exportDomSnapshot} fallback={<pre class="main-material-emission-code">{props.exportHtml}</pre>}>
                {(node) => <DomAuditTree node={node()} showBadges={props.showBadges} />}
              </Show>
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'export-css'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Export CSS</span>
              <BadgeToggle showBadges={props.showBadges} onToggle={props.onToggleBadges} />
            </div>
            <Show when={props.exportPlan} fallback={<p class="main-material-emission-empty">No export CSS plan for this target yet.</p>}>
              <Show when={props.showBadges} fallback={<pre class="main-material-emission-code">{props.exportCss || '/* no export CSS emitted */'}</pre>}>
                <ExportCssAudit css={props.exportCss || '/* no export CSS emitted */'} showBadges={props.showBadges} />
              </Show>
            </Show>
          </div>
        </Show>
        <Show when={props.tab === 'frame-css'}>
          <div class="main-material-emission-inspector__panel">
            <div class="main-material-emission-inspector__panel-head">
              <span>Unified Frame CSS</span>
              <button type="button" class="ui-lab-mini-button" onClick={props.onResetCss}>reset</button>
            </div>
            <p class="main-material-emission-help">
              Inline layout declarations emitted by this selected layout frame. Material classes, layer spans, and CSS variables live in DOM HTML.
            </p>
            <div class="main-material-emission-rows">
              <For each={props.cssLines}>
                {([key, value]) => {
                  const disabled = () => props.disabledKeys.has(key);
                  return (
                    <label class={`main-material-emission-row ${disabled() ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!disabled()}
                        onChange={() => props.onToggleCssKey(key)}
                      />
                      <code>{cssDeclarationText(key, value)}</code>
                    </label>
                  );
                }}
              </For>
              <Show when={!props.cssLines.length}>
                <p class="main-material-emission-empty">Select a feed child node to inspect emitted layout CSS.</p>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  </div>
);
