import { describe, expect, it, vi } from 'vitest';

import type { SeatPresentationBlock } from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';
import { startOpeningPresentation } from './openingPresentation';

const block = {} as SeatPresentationBlock;
const sink = {} as MatchPresentationSink;

describe('opening presentation lifecycle', () => {
  it('binds the director-owned sink before publishing the committed opening', () => {
    const calls: string[] = [];
    const unbind = vi.fn();
    const presentation = startOpeningPresentation({
      block,
      sink,
      bindPresentationSink: value => {
        expect(value).toBe(sink);
        calls.push('bind-sink');
        return unbind;
      },
      presentOpening: value => {
        expect(value).toBe(block);
        calls.push('commit-opening');
      },
    });

    expect(calls).toEqual(['bind-sink', 'commit-opening']);
    presentation.dispose();
    expect(unbind).toHaveBeenCalledOnce();
  });

  it('unbinds at most once', () => {
    const unbind = vi.fn();
    const presentation = startOpeningPresentation({
      block,
      sink,
      bindPresentationSink: () => unbind,
      presentOpening: vi.fn(),
    });

    presentation.dispose();
    presentation.dispose();
    expect(unbind).toHaveBeenCalledOnce();
  });
});
