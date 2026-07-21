import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SeatTransactionTimeline } from '../runtime/projection';
import type { MatchPresentationSink } from './presentationDirector';
import { startOpeningPresentation } from './openingPresentation';

const timeline = {} as SeatTransactionTimeline;
const sink = {} as MatchPresentationSink;

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe('opening presentation choreography', () => {
  it('preserves the accepted prelude order before binding the committed-frame sink', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const toastArea = document.createElement('div');
    const calls: string[] = [];
    const dismiss = vi.fn();
    const unbind = vi.fn();

    const presentation = startOpeningPresentation({
      root,
      toastArea,
      timeline,
      sink,
      presentOpening: value => {
        expect(value).toBe(timeline);
        calls.push('commit-opening');
      },
      bindPresentationSink: value => {
        expect(value).toBe(sink);
        calls.push('bind-sink');
        return unbind;
      },
      presentPlayfieldEvent: async event => {
        calls.push(event.type);
      },
      showOpeningToast: (area, message, options) => {
        expect(area).toBe(toastArea);
        expect(message).toBe('CRUEL DEAL');
        expect(options).toEqual({ duration: 2_500 });
        calls.push('show-title');
        return { dismiss };
      },
    });

    expect(calls).toEqual(['commit-opening', 'HIDE_PLAYFIELD']);

    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toEqual([
      'commit-opening',
      'HIDE_PLAYFIELD',
      'show-title',
    ]);

    await vi.advanceTimersByTimeAsync(2_800);
    expect(calls).toEqual([
      'commit-opening',
      'HIDE_PLAYFIELD',
      'show-title',
      'SHOW_PLAYFIELD',
    ]);

    await vi.advanceTimersByTimeAsync(150);
    expect(calls).toEqual([
      'commit-opening',
      'HIDE_PLAYFIELD',
      'show-title',
      'SHOW_PLAYFIELD',
      'bind-sink',
    ]);

    presentation.dispose();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(unbind).toHaveBeenCalledOnce();
  });

  it('cannot bind the gameplay presenter after disposal during the prelude', async () => {
    vi.useFakeTimers();
    const bindPresentationSink = vi.fn(() => vi.fn());
    const dismiss = vi.fn();
    const presentation = startOpeningPresentation({
      root: document.createElement('div'),
      toastArea: document.createElement('div'),
      timeline,
      sink,
      presentOpening: vi.fn(),
      bindPresentationSink,
      presentPlayfieldEvent: async () => undefined,
      showOpeningToast: () => ({ dismiss }),
    });

    await vi.advanceTimersByTimeAsync(200);
    presentation.dispose();
    await vi.runAllTimersAsync();
    await flushPromises();

    expect(dismiss).toHaveBeenCalledOnce();
    expect(bindPresentationSink).not.toHaveBeenCalled();
  });
});
