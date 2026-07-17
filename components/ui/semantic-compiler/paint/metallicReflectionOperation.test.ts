import { describe, expect, it } from 'vitest';
import {
  compileMetallicReflectionOperation,
  metallicReflectionClass,
} from './metallicReflectionOperation';

describe('metallic reflection operation', () => {
  it('lowers one text choice to one class with no helper DOM', () => {
    expect(compileMetallicReflectionOperation({
      material: 'gold',
      target: 'text',
    })).toEqual({
      operation: 'metallicReflection',
      material: 'gold',
      target: 'text',
      className: 'metal-gold',
      slot: 'C',
      helperCount: 0,
      cost: 1,
    });
  });

  it('uses the existing surface host for button and progress fills', () => {
    expect(metallicReflectionClass({
      material: 'bronze',
      target: 'surface',
    })).toBe('metal-surface-bronze');
    expect(compileMetallicReflectionOperation({
      material: 'silver',
      target: 'surface',
    }).helperCount).toBe(0);
  });
});
