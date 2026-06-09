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
assert.equal(emissionInspectorTabStatus('export-css'), 'Showing selected target export CSS payload');
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

assert.equal(
  activeEmissionPayload({
    tab: 'editor-dom',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  '<div>Editor</div>',
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-dom',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  exportHtml,
);
assert.equal(
  activeEmissionPayload({
    tab: 'export-css',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  exportCss,
);
assert.equal(
  activeEmissionPayload({
    tab: 'frame-css',
    editorDomSnapshot,
    exportHtml,
    exportCss,
    frameCssLines: [['--feed-node-gap', '4px']],
  }),
  '--feed-node-gap: 4px;',
);

console.log('Main material emission output tests passed');
