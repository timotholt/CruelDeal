import assert from 'node:assert/strict';
import {
  attrProvenance,
  domAuditNodeToCss,
  classProvenance,
  domAuditMetrics,
  domAuditNodeToHtml,
  emittedLayerToDomAuditNode,
  emptyEmissionMetrics,
  exportPlanToDomAuditNode,
  parseStyleTokens,
  styleProvenance,
  transientDomAttr,
  transientDomClass,
  type DomAuditNode,
} from './mainMaterialDomAudit';

assert.equal(classProvenance('cd-surface--glass')?.source, 'frosted');
assert.equal(classProvenance('mystery'), null);
assert.equal(attrProvenance('data-material-role')?.source, 'state');
assert.equal(styleProvenance('--feed-node-padding')?.source, 'layout');
assert.equal(styleProvenance('text-shadow')?.source, 'shadow');
assert.equal(transientDomClass('is-editing-flash'), true);
assert.equal(transientDomAttr('data-css-probe-target'), true);

const tokens = parseStyleTokens('--feed-node-padding: 4px; color: red; mystery');
assert.deepEqual(tokens.map((token) => [token.name, token.value, token.source, token.kind]), [
  ['--feed-node-padding', '4px', 'layout', 'known'],
  ['color', 'red', 'base', 'known'],
  ['mystery', '', 'unknown', 'unknown'],
]);

const node: DomAuditNode = {
  path: '0',
  tag: 'button',
  text: 'Save <Now>',
  classes: [{ key: 'c', name: 'class', value: 'cd-button', kind: 'known', reason: 'base', source: 'base', cssRules: ['.cd-button { display: inline-flex; }'] }],
  attrs: [{ key: 'a', name: 'aria-label', value: 'Save "Now"', kind: 'known', reason: 'a11y', source: 'a11y' }],
  styles: [{ key: 's', name: '--surface-fill', value: '#fff', kind: 'known', reason: 'base', source: 'base' }],
  children: [],
};
assert.equal(
  domAuditNodeToHtml(node),
  '<button class="cd-button" aria-label="Save &quot;Now&quot;" style="--surface-fill: #fff;">Save &lt;Now&gt;</button>',
);
assert.deepEqual(domAuditMetrics(node), {
  nodeCount: 1,
  classCount: 1,
  attrCount: 1,
  styleCount: 1,
  cssVariableCount: 1,
});
assert.equal(
  domAuditNodeToCss(node),
  '.cd-button { display: inline-flex; }\n\n.cd-button {\n  --surface-fill: #fff;\n}',
);
assert.deepEqual(emptyEmissionMetrics(), {
  nodeCount: 0,
  classCount: 0,
  attrCount: 0,
  styleCount: 0,
  cssVariableCount: 0,
});

const emitted = emittedLayerToDomAuditNode({
  tag: 'button',
  text: 'Go',
  classNames: ['cd-button'],
  attrs: { type: 'button', hidden: false },
  style: { '--surface-fill': '#fff' },
  children: [{ text: 'Child', classNames: ['material-text-content'] }],
});
assert.equal(emitted.tag, 'button');
assert.equal(emitted.attrs[0].source, 'native');
assert.equal(emitted.children[0].classes[0].source, 'text');

const planNode = exportPlanToDomAuditNode({
  host: { tag: 'button', classNames: ['host'], children: [{ text: 'Label' }] },
  layers: [{ emission: { classNames: ['emission'], attrs: { 'data-emission': true } } }],
});
assert.equal(planNode?.children.length, 2);
assert.equal(planNode?.children[0].attrs[0].source, 'base');

console.log('Main material DOM audit tests passed');
