import assert from 'node:assert/strict';
import type { DomAuditNode } from './mainMaterialDomAudit';
import {
  activeEmissionPayload,
  cssDeclarationText,
  emissionInspectorTabStatus,
  refreshedEmissionPayloadStatus,
  tabLabel,
} from './mainMaterialEmissionOutput';

assert.equal(tabLabel('frame-css'), 'Frame CSS');
assert.equal(cssDeclarationText('--surface-fill', '#fff'), '--surface-fill: #fff;');
assert.equal(refreshedEmissionPayloadStatus('export-dom', 'live-dom'), 'Refreshed Export DOM from live DOM');
assert.equal(refreshedEmissionPayloadStatus('export-dom', 'fallback-plan'), 'Refreshed Export DOM from fallback plan');
assert.equal(refreshedEmissionPayloadStatus('export-dom', null), 'No Export DOM payload for this target');

const editorDomSnapshot: DomAuditNode = {
  path: '0',
  tag: 'div',
  text: 'Editor',
  classes: [],
  attrs: [],
  styles: [],
  children: [],
};
const exportHtml = '<button>Launch</button>';
const exportCss = '.cd-button { color: white; }';
const frameCssLines: Array<[string, string | number]> = [
  ['--feed-node-gap', '4px'],
  ['--feed-node-opacity', 0.84],
];

const visibleTabOutput = [
  {
    tab: 'export-dom',
    label: 'Export DOM',
    status: 'Showing selected target export DOM payload',
    payload: exportHtml,
  },
  {
    tab: 'export-css',
    label: 'Export CSS',
    status: 'Showing selected target export CSS payload',
    payload: exportCss,
  },
  {
    tab: 'editor-dom',
    label: 'Editor DOM',
    status: 'Showing cleaned live editor DOM subtree',
    payload: '<div>Editor</div>',
  },
  {
    tab: 'frame-css',
    label: 'Frame CSS',
    status: 'Showing frame layout CSS only',
    payload: '--feed-node-gap: 4px;\n--feed-node-opacity: 0.84;',
  },
] as const;

for (const expected of visibleTabOutput) {
  assert.equal(tabLabel(expected.tab), expected.label);
  assert.equal(emissionInspectorTabStatus(expected.tab), expected.status);
  assert.equal(
    activeEmissionPayload({
      tab: expected.tab,
      editorDomSnapshot,
      exportHtml,
      exportCss,
      frameCssLines,
    }),
    expected.payload,
  );
}

assert.equal(
  activeEmissionPayload({
    tab: 'editor-dom',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines,
  }),
  '<div>Editor</div>',
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-dom',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines,
  }),
  exportHtml,
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-css',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines,
  }),
  exportCss,
);
assert.equal(
  activeEmissionPayload({
    tab: 'frame-css',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines,
  }),
  '--feed-node-gap: 4px;\n--feed-node-opacity: 0.84;',
);

assert.equal(
  activeEmissionPayload({
    tab: 'editor-dom',
    editorDomSnapshot: null,
    exportHtml,
    exportCss,
    frameCssLines,
  }),
  '',
);

console.log('Main material emission output tests passed');
