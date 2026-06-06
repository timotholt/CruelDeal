import { strict as assert } from 'node:assert';
import { configureLogging } from '../../../utils/logger';
import { uiNodeRichTextThemeVars, uiNodeTextEmbossShadow, validateUiNodeTheme } from './uiNodeRichTextTheme';

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
assert.equal(vars['--feed-rich-body-size'], '1em');
assert.equal(vars['--feed-rich-body-font'], 'inherit');
assert.equal(vars['--feed-rich-body-shadow'], 'inherit');
assert.equal(vars['--feed-rich-acc1'], 'rgb(248 215 112)');
assert.equal(vars['--feed-rich-acc1-track'], 'inherit');
assert.equal(vars['--feed-rich-acc1-transform'], 'inherit');
assert.equal(vars['--feed-rich-acc1-shadow'], 'inherit');
assert.equal(uiNodeTextEmbossShadow({ embossMode: 'inherit' }), 'inherit');
assert.equal(uiNodeTextEmbossShadow({ embossMode: 'none', embossStrength: 100 }), 'none');

const validTheme = {
  richText: {
    missionPanel: {
      align: 'left',
      base: { tone: 'white', lineHeight: 1.4, paragraphGap: -3, embossMode: 'shadow', embossStrength: 50, embossOffset: 20, embossBlur: 10 },
      h2: { tone: 'gray', fontFamily: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif', sizeEm: 1.7, weight: 700 },
      acc3: { tone: 'red' },
      acc4: { tone: 'green' },
    },
  },
};

assert.equal(validateUiNodeTheme(validTheme)?.richText.missionPanel.base?.paragraphGap, -3);
assert.equal(validateUiNodeTheme({ richText: { missionPanel: { acc3: { tone: 'red' } } } })?.richText.missionPanel.acc3?.tone, 'red');
assert.equal(validateUiNodeTheme({ richText: { missionPanel: { h1: { embossMode: 'inherit' } } } })?.richText.missionPanel.h1?.embossMode, 'inherit');

configureLogging({ policy: 'continue', level: 'silent' });
assert.equal(validateUiNodeTheme({ richText: { missionPanel: { base: { tone: 'banana' } } } }), null);
assert.equal(validateUiNodeTheme({ richText: { missionPanel: { madeUp: 1 } } }), null);
configureLogging({ policy: 'throw', level: 'silent' });
assert.throws(() => validateUiNodeTheme({ richText: { missionPanel: { base: { tone: 'banana' } } } }), (err: unknown) => {
  return err instanceof Error && err.message === 'ui.node.theme.invalid';
});
