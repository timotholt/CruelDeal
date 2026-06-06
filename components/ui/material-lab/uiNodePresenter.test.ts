import assert from 'node:assert/strict';
import { surfaceKindForType, uiLayoutToStyle } from './uiNodePresenter';

// --- layout mapping ----------------------------------------------------------
assert.equal(uiLayoutToStyle(undefined), undefined);

assert.deepEqual(
  uiLayoutToStyle({ display: 'flex', direction: 'row', align: 'center', justify: 'between', gap: 8, padding: 16, width: '100%' }),
  {
    display: 'flex',
    'flex-direction': 'row',
    'align-items': 'center',
    'justify-content': 'space-between',
    gap: '8px',
    padding: '16px',
    width: '100%',
  },
);

// display 'absolute' becomes position, not display.
assert.deepEqual(
  uiLayoutToStyle({ display: 'absolute', position: { inset: '0' } }),
  { position: 'absolute', inset: '0' },
);

// token maps for align/justify edge cases.
assert.equal(uiLayoutToStyle({ align: 'start' })?.['align-items'], 'flex-start');
assert.equal(uiLayoutToStyle({ align: 'end' })?.['align-items'], 'flex-end');
assert.equal(uiLayoutToStyle({ justify: 'around' })?.['justify-content'], 'space-around');

// gap 0 still emits (explicit), absent fields omitted.
assert.equal(uiLayoutToStyle({ gap: 0 })?.gap, '0px');
assert.equal('height' in (uiLayoutToStyle({ width: '10px' }) ?? {}), false);
assert.equal(uiLayoutToStyle({ hMode: 'hug', height: '23rem' })?.height, 'auto');
assert.equal(uiLayoutToStyle({ hMode: 'fill', height: '23rem' })?.height, '100%');

// --- surface kind by type ----------------------------------------------------
assert.equal(surfaceKindForType('button', false), 'button');
assert.equal(surfaceKindForType('button', true), 'button');
assert.equal(surfaceKindForType('panel', false), 'panel');
assert.equal(surfaceKindForType('text', false), 'bare');
assert.equal(surfaceKindForType('text', true), 'panel');
assert.equal(surfaceKindForType('image', false), 'bare');
assert.equal(surfaceKindForType('image', true), 'panel');
assert.equal(surfaceKindForType('slot', false), 'bare');

console.log('UI node presenter tests passed');
