import assert from 'node:assert/strict';
import { configureLogging } from '../../utils/logger';
import type { UiNodePayload, UiNodeTheme } from '../ui/material-lab';
import {
  createUiNodePreviewJsonReadout,
  uiNodePreviewOutputModeByTab,
} from './uiNodePreviewJsonReadout';

configureLogging({ level: 'silent', policy: 'continue' });

assert.equal(uiNodePreviewOutputModeByTab.template, 'ui-node');
assert.equal(uiNodePreviewOutputModeByTab.cms, 'ui-node-content');
assert.equal(uiNodePreviewOutputModeByTab.theme, 'ui-node-theme');

const node: UiNodePayload = {
  id: 'test-node',
  type: 'button',
  text: 'Run',
};

const parsed = JSON.parse(createUiNodePreviewJsonReadout('template', node)) as {
  id?: unknown;
  type?: unknown;
};
assert.equal(parsed.id, 'test-node');
assert.equal(parsed.type, 'button');

assert.equal(createUiNodePreviewJsonReadout('template', { id: 'bad', type: 'script' }), '{}\n');

const cms = JSON.parse(createUiNodePreviewJsonReadout('cms', {
  'mission.title': 'Solace',
  'mission.target': { kind: 'contract', id: 'contract_solace' },
})) as Record<string, unknown>;
assert.equal(cms['mission.title'], 'Solace');
assert.deepEqual(cms['mission.target'], { kind: 'contract', id: 'contract_solace' });
assert.equal(createUiNodePreviewJsonReadout('cms', { 'mission.bad': ['not', 'allowed'] }), '{}\n');

const theme: UiNodeTheme = {
  richText: {
    missionPanel: {
      base: { tone: 'white', fontFamily: 'ui-sans-serif', sizeRem: 0.8 },
      h1: { tone: 'gold', transform: 'uppercase' },
    },
  },
};
const parsedTheme = JSON.parse(createUiNodePreviewJsonReadout('theme', theme)) as UiNodeTheme;
assert.equal(parsedTheme.richText.missionPanel.h1?.tone, 'gold');
assert.equal(createUiNodePreviewJsonReadout('theme', { richText: { missionPanel: { h1: { tone: 'banana' } } } }), '{}\n');

console.log('UiNode preview JSON readout tests passed');
