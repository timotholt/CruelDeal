import { describe, expect, it } from 'vitest';
import { compileCruelMarkupV1, parseCruelMarkupV1, plainTextFromCruelMarkupV1 } from './cruelMarkupV1';

describe('Cruel markup v1 compiler', () => {
  it('preserves nested role tokens and produces accessibility text', () => {
    const tokens = parseCruelMarkupV1('[bright]Data[/bright]\n[muted]Extraction[/muted]');
    expect(tokens).toEqual([
      { type: 'tag', tag: 'bright', children: [{ type: 'text', text: 'Data' }] },
      { type: 'break' },
      { type: 'tag', tag: 'muted', children: [{ type: 'text', text: 'Extraction' }] },
    ]);
    expect(plainTextFromCruelMarkupV1(tokens)).toBe('Data\nExtraction');
  });

  it('does not interpret tags in plain content', () => {
    const compiled = compileCruelMarkupV1('[bright]literal[/bright]', 'plain');
    expect(compiled.plainText).toBe('[bright]literal[/bright]');
    expect(JSON.stringify(compiled.tokens)).not.toContain('"tag":"bright"');
  });
});
