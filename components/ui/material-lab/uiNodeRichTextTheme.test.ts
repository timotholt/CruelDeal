import { strict as assert } from 'node:assert';
import { uiNodeRichTextThemeVars, uiNodeTextEmbossShadow } from './uiNodeRichTextTheme';

const vars = uiNodeRichTextThemeVars({
  align: 'center',
  base: { tone: 'white', lineHeight: 1.2, paragraphGap: -2, weight: 600 },
  h2: { tone: 'gold', sizeEm: 1.7, weight: 800, letterSpacing: 0.02, transform: 'uppercase', embossMode: 'shadow', embossStrength: 50 },
  acc1: { tone: 'gold' },
  divider: { tone: 'white', opacity: 34, thicknessPx: 1, gapTopEm: 0.7, gapBottomEm: 0.5 },
});

assert.equal(vars['text-align'], 'center');
assert.equal(vars['font-weight'], '600');
assert.equal(vars.opacity, '1');
assert.equal(vars['--feed-rich-base-line'], '1.2');
assert.equal(vars['--feed-rich-paragraph-gap'], '-2px');
assert.equal(vars['--feed-rich-alt-title'], 'rgb(248 215 112)');
assert.equal(vars['--feed-rich-alt-title-size'], '1.7em');
assert.equal(vars['--feed-rich-alt-title-track'], '0.02em');
assert.equal(vars['--feed-rich-divider-opacity'], '0.34');
assert.match(String(vars['--feed-rich-alt-title-shadow']), /rgb\(0 0 0/);
assert.equal(uiNodeTextEmbossShadow({ embossMode: 'none', embossStrength: 100 }), 'none');
