import assert from 'node:assert/strict';
import { materialNodeLayoutCss } from './materialNodeLayoutCss';
import type { MaterialNodeLayout } from './MaterialNodeTypes';

const css = (layout?: MaterialNodeLayout) => materialNodeLayoutCss(layout) as Record<string, string> | undefined;

// --- no layout -> undefined ---
assert.equal(materialNodeLayoutCss(undefined), undefined);

// --- display: 'absolute' compiles to a self-sufficient positioned flex box ---
const abs = css({
  display: 'absolute',
  position: { left: '8%', top: '10%' },
  width: '40%',
  height: '6%',
})!;
assert.equal(abs.position, 'absolute', 'absolute -> position:absolute (no external class needed)');
assert.equal(abs.display, 'flex');
assert.equal(abs['flex-direction'], 'column');
assert.equal(abs['box-sizing'], 'border-box');
assert.equal(abs['min-width'], '0');
assert.equal(abs['min-height'], '0');
assert.equal(abs.left, '8%');
assert.equal(abs.top, '10%');
assert.equal(abs.width, '40%');
assert.equal(abs.height, '6%');

// --- absolute + row direction ---
const absRow = css({ display: 'absolute', direction: 'row' })!;
assert.equal(absRow['flex-direction'], 'row');

// --- non-absolute display passes through, no forced box model (existing behavior) ---
const flex = css({ display: 'flex', direction: 'row', gap: 8 })!;
assert.equal(flex.display, 'flex');
assert.equal(flex['flex-direction'], 'row');
assert.equal(flex.position, undefined, 'flex node must NOT be forced to position:absolute');
assert.equal(flex['box-sizing'], undefined, 'non-absolute node must not get forced box model');
assert.equal(flex.gap, '8px');

const block = css({ display: 'block' })!;
assert.equal(block.display, 'block');
assert.equal(block.position, undefined);

// --- baked layout.style is preserved and NOT clobbered by undefined fields ---
const baked = css({ style: { left: '5%', position: 'absolute', width: '12%' } as never })!;
assert.equal(baked.left, '5%', 'baked left preserved');
assert.equal(baked.position, 'absolute', 'baked position preserved');
assert.equal(baked.width, '12%', 'baked width preserved (undefined explicit width must not clobber)');

// --- explicit structured field overrides baked style ---
const override = css({ width: '20%', style: { width: '10%' } as never })!;
assert.equal(override.width, '20%', 'explicit width overrides baked style width');

// --- absolute base + baked style merge: base position, baked offsets, both present ---
const merged = css({ display: 'absolute', style: { left: '3%', top: '4%' } as never })!;
assert.equal(merged.position, 'absolute');
assert.equal(merged.left, '3%');
assert.equal(merged.top, '4%');
assert.equal(merged.display, 'flex');

// --- size modes (layout-2) ---
const hug = css({ display: 'absolute', widthMode: 'hug', heightMode: 'hug', width: '40%', height: '6%' })!;
assert.equal(hug.width, 'max-content', 'widthMode hug -> max-content (overrides explicit width)');
assert.equal(hug.height, 'auto', 'heightMode hug -> auto');

const fill = css({ display: 'absolute', widthMode: 'fill', heightMode: 'fill', width: '40%', height: '6%' })!;
assert.equal(fill.width, '100%', 'widthMode fill -> 100%');
assert.equal(fill.height, '100%', 'heightMode fill -> 100%');

const fixed = css({ widthMode: 'fixed', width: '33%', heightMode: 'fixed', height: '12%' })!;
assert.equal(fixed.width, '33%', 'fixed -> explicit width');
assert.equal(fixed.height, '12%', 'fixed -> explicit height');

// unset mode keeps explicit value
const noMode = css({ width: '25%' })!;
assert.equal(noMode.width, '25%', 'no widthMode -> explicit width unchanged');

// mode-resolved size still overrides baked style width (explicit precedence)
const modeOverBaked = css({ widthMode: 'hug', style: { width: '99%' } as never })!;
assert.equal(modeOverBaked.width, 'max-content', 'hug-resolved width overrides baked style');

console.log('materialNodeLayoutCss tests passed');
