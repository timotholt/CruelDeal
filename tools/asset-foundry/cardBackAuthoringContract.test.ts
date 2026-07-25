import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CARD_RUNTIME_SPEC } from '../../services/assets/workbench';
import {
  CARD_BACK_RUNTIME_HEIGHT,
  CARD_BACK_RUNTIME_WIDTH,
} from '../../components/game-surfaces/system/card-backs/cardBackExport';
import {
  CARD_BACK_LAB_FAVORITE_DEFAULTS,
  CARD_BACK_LAB_SHARP_FONT,
  CARD_BACK_LAB_SHARP_FONT_URL,
} from '../../components/screens/cardBackLabDefaults';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('card-back authoring boundary', () => {
  it('exports the existing game asset dimensions without redefining them', () => {
    expect({
      width: CARD_BACK_RUNTIME_WIDTH,
      height: CARD_BACK_RUNTIME_HEIGHT,
    }).toEqual({
      width: CARD_RUNTIME_SPEC.width,
      height: CARD_RUNTIME_SPEC.height,
    });
    expect(CARD_RUNTIME_SPEC.aspectRatio).toBe('5:7');
  });

  it('keeps the authoring renderer out of the main game route catalog', () => {
    const router = source('../../router.tsx');
    const foundryEntry = source('./main.tsx');

    expect(router).not.toContain("'./components/screens/CardBackLabScreen.tsx'");
    expect(foundryEntry).toContain("import { CardBackLabScreen }");
    expect(foundryEntry).toContain("get('tool') === 'card-backs'");
  });

  it('leaves the production card-back surface contract free of authoring dependencies', () => {
    const runtime = source('../../components/game-surfaces/system/CardBackSurface.tsx');

    expect(runtime).toContain('class="system-card-back"');
    expect(runtime).toContain('class="system-card-back__mark"');
    expect(runtime).not.toContain('three');
    expect(runtime).not.toContain('WebGL');
    expect(runtime).not.toContain('CardBackMaterial');
  });

  it('publishes authored candidates to the established default card-back target', () => {
    const workbench = source('../../services/assets/workbench.ts');
    const lab = source('../../components/screens/CardBackLabScreen.tsx');

    expect(workbench).toContain("targetPath: '/art/cards/backs/default.webp'");
    expect(lab).toContain("engineTargetPath: '/art/cards/backs/default.webp'");
    expect(lab).toContain("fetch('/api/assets/author-card-back'");
  });

  it('starts from the approved favorite authoring preset without changing runtime defaults', () => {
    expect(CARD_BACK_LAB_FAVORITE_DEFAULTS).toMatchObject({
      variant: 'onyx',
      motion: 'dynamic',
      font: CARD_BACK_LAB_SHARP_FONT,
      emblemFont: CARD_BACK_LAB_SHARP_FONT,
      caption: 'Cruel Comp',
      emblem: 'cc',
      microTextA: 'Cruel Company',
      microTextB: 'V 1.00',
      light: {
        color: '#ffffff', ambient: 1.2, x: 0.9, y: 0.11, height: 0.53,
        intensity: 1.32, falloff: 20, shadowSoftness: 20,
      },
      relief: {
        outerBorderWidth: 48, railWidth: 7, hexWidth: 40, grooveWidth: 30,
        bevelSoftness: 8.5, goldHeight: 0.175, hexHeight: 0.4,
        identityHeight: 0.3, grooveDepth: 0.12, curveRadius: 18,
      },
      typography: {
        caption: { size: 38, spacing: 0, x: 5, y: 12 },
        emblem: { size: 136, spacing: 5, x: 1, y: -22 },
      },
    });
    expect(CARD_BACK_LAB_SHARP_FONT_URL).toBe('/fonts/card-back-authoring/Sharp.ttf');
    expect(source('../../components/game-surfaces/system/card-backs/CruelCompanyCardBackDesign.ts'))
      .toContain("caption: 'CC'");
  });
});
