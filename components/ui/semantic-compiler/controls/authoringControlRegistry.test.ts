import { describe, expect, it } from 'vitest';
import { surfaceOptionKeys } from '../../material-lab/Surface';
import type { FeedNodeLayout } from '../../../screens/main-material/feedNodeLayoutCss';
import type { FeedTextSlotStyle } from '../../../screens/main-material/mainMaterialFeedModel';
import {
  authoringControlRule,
  authoringControlRules,
  authoringControlCssProperty,
  controlRange,
  evaluateAuthoringControl,
} from './authoringControlRegistry';

const layoutKeys = [
  'mode',
  'slot',
  'x',
  'y',
  'width',
  'height',
  'nudgeX',
  'nudgeY',
  'padding',
  'gap',
  'align',
  'justify',
  'direction',
  'reverse',
  'wrap',
  'distribute',
  'crossAlign',
  'wMode',
  'hMode',
  'selfPosition',
  'pushToEnd',
  'constraintH',
  'constraintV',
] as const satisfies readonly (keyof FeedNodeLayout)[];

const textStyleKeys = [
  'inherit',
  'overrideColor',
  'overrideOpacity',
  'overrideFont',
  'overrideSize',
  'overrideWeight',
  'overrideStyle',
  'overrideCase',
  'overrideEmboss',
  'overrideLineHeight',
  'overrideParagraphGap',
  'overrideLetterSpacing',
  'overrideAlign',
  'overridePosition',
  'textFontFamily',
  'textSizeRem',
  'lineHeight',
  'paragraphGap',
  'contentTone',
  'fontWeight',
  'fontStyle',
  'textTransform',
  'textEmbossMode',
  'textEmbossStrength',
  'textEmbossOffset',
  'textEmbossBlur',
  'letterSpacing',
  'textOpacity',
  'textAlign',
  'textX',
  'textY',
] as const satisfies readonly (keyof FeedTextSlotStyle)[];

describe('authoring control registry', () => {
  it('has stable unique identities and executable lowering metadata', () => {
    expect(new Set(authoringControlRules.map((control) => control.id)).size).toBe(authoringControlRules.length);
    for (const control of authoringControlRules) {
      expect(control.id).toMatch(/^[a-z][a-zA-Z0-9.]*$/);
      expect(control.sourcePath.length).toBeGreaterThan(0);
      expect(control.writes.length).toBeGreaterThan(0);
      expect(control.expectedResult.length).toBeGreaterThan(12);
      expect(control.cost).toBeGreaterThanOrEqual(0);
      expect(control.cost).toBeLessThanOrEqual(3);
      if (control.min !== undefined || control.max !== undefined) {
        expect(control.min).toBeTypeOf('number');
        expect(control.max).toBeTypeOf('number');
        expect(control.max!).toBeGreaterThanOrEqual(control.min!);
      }
    }
  });

  it('covers every current SurfaceOptions, layout, and text-style key', () => {
    const coveredLegacyKeys = new Set(authoringControlRules.flatMap((control) => control.legacySourceKeys));
    expect(surfaceOptionKeys.filter((key) => !coveredLegacyKeys.has(key))).toEqual([]);
    expect(layoutKeys.filter((key) => !coveredLegacyKeys.has(key))).toEqual([]);
    expect(textStyleKeys.filter((key) => !coveredLegacyKeys.has(key))).toEqual([]);
  });

  it('provides ranges from the same registry used by controls', () => {
    expect(controlRange('layout.width')).toEqual({ min: 4, max: 140, step: 1 });
    expect(controlRange('layout.nudgeX')).toEqual({ min: -80, max: 80, step: 1 });
    expect(controlRange('layout.padding')).toEqual({ min: 0, max: 40, step: 1 });
    expect(controlRange('type.lineHeight')).toEqual({ min: 0.5, max: 3, step: 0.02 });
    expect(controlRange('paint.glass.blurPx')).toEqual({ min: 0, max: 64, step: 0.25 });
    expect(() => controlRange('layout.display')).toThrow(/does not define a numeric range/);
    expect(authoringControlRule('surface.edgeWearWidth').slot).toBe('H::after');
  });

  it('evaluates declared dependencies and conflicts without editor-specific logic', () => {
    expect(evaluateAuthoringControl('surface.glassReflectionOpacity', {
      'surface.glass': true,
      'surface.glassShine': true,
    })).toEqual({
      enabled: true,
      unmetDependencies: [],
      activeConflicts: [],
    });
    expect(evaluateAuthoringControl('surface.glassReflectionOpacity', {
      'surface.glass': true,
      'surface.glassShine': false,
    })).toEqual({
      enabled: false,
      unmetDependencies: ['surface.glassShine=true'],
      activeConflicts: [],
    });
    expect(evaluateAuthoringControl(
      'surface.surfaceLayerBrightness',
      {},
      ['content-sharing-same-filter-slot'],
    )).toEqual({
      enabled: false,
      unmetDependencies: [],
      activeConflicts: ['content-sharing-same-filter-slot'],
    });
    expect(evaluateAuthoringControl('surface.textureStrength', {
      'surface.texture': 'none',
    }).enabled).toBe(false);
    expect(evaluateAuthoringControl('surface.textureStrength', {
      'surface.texture': 'rough-steel',
    }).enabled).toBe(true);
  });

  it('rejects compiler output that is not owned by the selected control', () => {
    expect(authoringControlCssProperty('type.fontSize', 'font-size')).toBe('font-size');
    expect(() => authoringControlCssProperty('type.fontSize', 'line-height')).toThrow(
      /does not declare CSS property line-height/,
    );
  });
});
