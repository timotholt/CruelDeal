import { Show, createSignal, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MatchSessionProvider,
  useMatchSession,
  type MatchSessionContextValue,
} from './MatchSessionContext';
import { PlayProviders } from './PlayProviders';
import {
  PlayUiProvider,
  usePlayUi,
  type PlayUiContextValue,
} from './PlayUiContext';
import { DEBUG_DECKS } from '@/services/playgame/debug/debugDecks';
import { buildDebugMatchBootstrap } from '@/services/playgame/debug/buildDebugBootstrap';
import type { MatchClient } from '@/services/playgame/client/matchClient';
import type { MatchAuthorityTestDriver } from '@/services/playgame/testing/authorityTestDriver';
import { MATCH_AUTHORITY_TEST_DRIVERS } from '@/services/playgame/testing/authorityRegistry';
import type { SeatPresentationBlock } from '@/services/playgame/runtime/projection';
import type { MatchPresentationSink } from '@/services/playgame/presentation/presentationDirector';

interface Harness {
  readonly match: MatchSessionContextValue;
  readonly ui: PlayUiContextValue;
}

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

const disposers: Array<() => void> = [];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  while (disposers.length > 0) disposers.pop()?.();
  document.body.replaceChildren();
});

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function debugBootstrap(seed: string) {
  return buildDebugMatchBootstrap(
    DEBUG_DECKS[0],
    DEBUG_DECKS[7],
    seed,
  );
}

function mountSession(client: MatchClient): Harness {
  let harness!: Harness;
  const Probe = () => {
    const match = useMatchSession();
    const ui = usePlayUi();
    onMount(() => { harness = { match, ui }; });
    return null;
  };
  const host = document.createElement('div');
  document.body.append(host);
  disposers.push(render(
    () => (
      <PlayProviders client={client}>
        <Probe />
      </PlayProviders>
    ),
    host,
  ));
  return harness;
}

async function createClient(
  driver: MatchAuthorityTestDriver,
  seed: string,
): Promise<MatchClient> {
  return driver.createClient(debugBootstrap(seed), { developerAccess: true });
}

async function waitForIdle(harness: Harness): Promise<void> {
  await vi.waitFor(() => {
    expect(harness.ui.isResolving()).toBe(false);
    expect(harness.ui.turnFlowRunning()).toBe(false);
  });
}

async function commitTwoTurns(harness: Harness): Promise<void> {
  const submitEndTurn = async (): Promise<void> => {
    const submitted = harness.match.actions.endTurn();
    if (vi.isFakeTimers()) {
      vi.advanceTimersToNextFrame();
      await vi.advanceTimersToNextTimerAsync();
    }
    await expect(submitted).resolves.toBe(true);
  };

  await submitEndTurn();
  await submitEndTurn();
}

type TestPresentationHooks = {
  readonly beforeTransaction?: (
    frames: readonly import('@/services/playgame/runtime/projection').SeatTransactionFrame[],
  ) => void;
  readonly beforeFrame?: (frame: import('@/services/playgame/runtime/projection').SeatTransactionFrame) => void;
  readonly afterFrame?: (
    frame: import('@/services/playgame/runtime/projection').SeatTransactionFrame,
    signal: AbortSignal,
  ) => Promise<void> | void;
  readonly afterTransaction?: () => Promise<void> | void;
};

const preparedTestSink = (hooks: TestPresentationHooks): MatchPresentationSink => ({
  prepareTransaction: async (frames) => {
    hooks.beforeTransaction?.(frames);
    return null;
  },
  prepareBeat: async beat => {
    const frame = beat.frames[0];
    hooks.beforeFrame?.(frame);
    return {
      beatId: beat.id,
      firstFrame: frame.frame,
      lastFrame: beat.frames.at(-1)!.frame,
      declaredDurationMs: 0,
      presentAfterAdoption: async (signal) => {
        await hooks.afterFrame?.(frame, signal);
        return signal.aborted ? 'CANCELLED' : 'COMPLETED';
      },
      cancel: () => undefined,
    };
  },
  afterTransaction: async () => hooks.afterTransaction?.(),
});

for (const authorityDriver of MATCH_AUTHORITY_TEST_DRIVERS) {
describe(`${authorityDriver.id} PlayUi committed-transaction interleavings`, () => {
  it('H1/H6 completely blocks transaction two and keeps the UI locked between queued runs', async () => {
    const harness = mountSession(await createClient(
      authorityDriver,
      'interleave-complete-block',
    ));
    const gate = deferred();
    const order: string[] = [];
    const lockSamples: Array<{
      readonly boundary: string;
      readonly resolving: boolean;
      readonly turnFlowRunning: boolean;
    }> = [];
    let activeTransaction = '';
    let blocked = false;
    let transactionCount = 0;

    harness.ui.actions.bindPresentationSink(preparedTestSink({
      beforeTransaction: (frames) => {
        activeTransaction = frames[0]?.transactionId ?? 'empty';
        transactionCount++;
        order.push(`begin:${activeTransaction}`);
        if (transactionCount === 2) {
          lockSamples.push({
            boundary: 'second-begin',
            resolving: harness.ui.isResolving(),
            turnFlowRunning: harness.ui.turnFlowRunning(),
          });
        }
      },
      afterFrame: (frame) => {
        order.push(`frame:${frame.transactionId}:${frame.index}`);
        if (blocked) return;
        blocked = true;
        return gate.promise;
      },
      afterTransaction: () => {
        order.push(`end:${activeTransaction}`);
        if (transactionCount === 1) {
          lockSamples.push({
            boundary: 'first-end',
            resolving: harness.ui.isResolving(),
            turnFlowRunning: harness.ui.turnFlowRunning(),
          });
        }
      },
    }));

    await commitTwoTurns(harness);

    expect(order.filter(step => step.startsWith('begin:'))).toHaveLength(1);
    expect(harness.match.snapshot().state.turn).toBe(3);
    expect(harness.ui.isResolving()).toBe(true);

    gate.resolve();
    await waitForIdle(harness);

    const begins = order.filter(step => step.startsWith('begin:'));
    const firstId = begins[0]!.slice('begin:'.length);
    const secondId = begins[1]!.slice('begin:'.length);
    expect(order.indexOf(`end:${firstId}`))
      .toBeLessThan(order.indexOf(`begin:${secondId}`));
    expect(lockSamples).toEqual([
      { boundary: 'first-end', resolving: true, turnFlowRunning: true },
      { boundary: 'second-begin', resolving: true, turnFlowRunning: true },
    ]);
    expect(harness.ui.presentedState()).toBe(harness.match.snapshot().state);
  });

  it('H3 snaps a failed transaction, invalidates the queue, and resyncs', async () => {
    const harness = mountSession(await createClient(
      authorityDriver,
      'interleave-failure-snap',
    ));
    const gate = deferred();
    const transactions: string[] = [];
    let firstTransaction = '';
    let blocked = false;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    harness.ui.actions.bindPresentationSink(preparedTestSink({
      beforeTransaction: (frames) => {
        const id = frames[0]?.transactionId ?? 'empty';
        transactions.push(id);
        firstTransaction ||= id;
      },
      afterFrame: (frame) => {
        if (blocked || frame.transactionId !== firstTransaction) return;
        blocked = true;
        return gate.promise;
      },
    }));

    await commitTwoTurns(harness);
    expect(transactions).toHaveLength(1);
    gate.reject(new Error('synthetic animation failure'));
    await waitForIdle(harness);

    expect(transactions).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(harness.ui.presentationRecovery()).toEqual({ kind: 'READY' });
    expect(harness.ui.presentedState()).toBe(harness.match.snapshot().state);
  });

  it('H3 times out a hung transaction, invalidates the queue, and resyncs', async () => {
    vi.useFakeTimers();
    const harness = mountSession(await createClient(
      authorityDriver,
      'interleave-timeout-snap',
    ));
    const never = new Promise<void>(() => undefined);
    const transactions: string[] = [];
    let firstTransaction = '';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    harness.ui.actions.bindPresentationSink(preparedTestSink({
      beforeTransaction: (frames) => {
        const id = frames[0]?.transactionId ?? 'empty';
        transactions.push(id);
        firstTransaction ||= id;
      },
      afterFrame: frame => frame.transactionId === firstTransaction
        ? never
        : undefined,
    }));

    await commitTwoTurns(harness);
    expect(transactions).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(5_001);
    vi.useRealTimers();
    await waitForIdle(harness);

    expect(transactions).toHaveLength(1);
    expect(consoleError).toHaveBeenCalledOnce();
    expect(harness.ui.presentationRecovery()).toEqual({ kind: 'READY' });
    expect(harness.ui.presentedState()).toBe(harness.match.snapshot().state);
  });

  it('H4 fast-forwards once, drains the queue, and ignores stale hook completion', async () => {
    const harness = mountSession(await createClient(
      authorityDriver,
      'interleave-fast-forward',
    ));
    const gate = deferred();
    const transactions: string[] = [];
    let blocked = false;

    harness.ui.actions.bindPresentationSink(preparedTestSink({
      beforeTransaction: frames => {
        transactions.push(frames[0]?.transactionId ?? 'empty');
      },
      afterFrame: () => {
        if (blocked) return;
        blocked = true;
        return gate.promise;
      },
    }));

    await commitTwoTurns(harness);
    expect(transactions).toHaveLength(1);
    expect(harness.ui.actions.requestPresentationFastForward()).toBe(true);
    expect(harness.ui.actions.requestPresentationFastForward()).toBe(false);
    await waitForIdle(harness);

    expect(transactions).toHaveLength(2);
    const finalState = harness.ui.presentedState();
    gate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.ui.presentedState()).toBe(finalState);
    expect(finalState).toBe(harness.match.snapshot().state);
  });

  it('H5 disposal invalidates a pending hook and remount adopts current authority', async () => {
    const client = await createClient(
      authorityDriver,
      'interleave-dispose-remount',
    );
    const gate = deferred();
    let match!: MatchSessionContextValue;
    let currentUi!: PlayUiContextValue;
    let setUiMounted!: (mounted: boolean) => void;

    const MatchProbe = () => {
      match = useMatchSession();
      return null;
    };
    const UiProbe = () => {
      const ui = usePlayUi();
      onMount(() => { currentUi = ui; });
      return null;
    };
    const Root = () => {
      const [uiMounted, setMounted] = createSignal(true);
      setUiMounted = setMounted;
      return (
        <MatchSessionProvider client={client}>
          <MatchProbe />
          <Show when={uiMounted()}>
            <PlayUiProvider><UiProbe /></PlayUiProvider>
          </Show>
        </MatchSessionProvider>
      );
    };
    const host = document.createElement('div');
    document.body.append(host);
    disposers.push(render(() => <Root />, host));

    const disposedUi = currentUi;
    disposedUi.actions.bindPresentationSink(preparedTestSink({ afterFrame: () => gate.promise }));
    await expect(match.actions.endTurn()).resolves.toBe(true);
    expect(disposedUi.isResolving()).toBe(true);

    setUiMounted(false);
    await Promise.resolve();
    const disposedCursor = disposedUi.presentedState();
    gate.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(disposedUi.presentedState()).toBe(disposedCursor);

    setUiMounted(true);
    await Promise.resolve();
    expect(currentUi).not.toBe(disposedUi);
    expect(currentUi.presentedState()).toBe(match.snapshot().state);
    expect(currentUi.isResolving()).toBe(false);
  });

  it('H7 runtime and local-AI publication complete while presentation is blocked', async () => {
    const harness = mountSession(await createClient(
      authorityDriver,
      'interleave-ai-independent',
    ));
    const gate = deferred();
    const published: SeatPresentationBlock[] = [];
    let hookStarted = false;
    harness.match.subscribePresentationBlocks(
      block => published.push(block),
    );
    harness.ui.actions.bindPresentationSink(preparedTestSink({
      afterFrame: () => {
        hookStarted = true;
        return gate.promise;
      },
    }));

    await expect(harness.match.actions.endTurn()).resolves.toBe(true);

    expect(published).toHaveLength(1);
    expect(published[0]?.frames.some(
      frame => frame.event?.type === 'TURN_RESOLUTION_STARTED',
    )).toBe(true);
    expect(harness.match.snapshot().state.turn).toBe(2);
    expect(harness.match.snapshot().state).toEqual(published[0]?.postState);
    expect(harness.ui.isResolving()).toBe(true);
    expect(hookStarted).toBe(false);

    await new Promise<void>(
      resolve => requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    expect(hookStarted).toBe(true);

    expect(harness.ui.actions.requestPresentationFastForward()).toBe(true);
    await waitForIdle(harness);
    gate.resolve();
  });
});
}
