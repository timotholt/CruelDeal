import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildDebugMatchBootstrap } from '../../debug/buildDebugBootstrap';
import { DEBUG_DECKS } from '../../debug/debugDecks';
import { LocalMatchSessionAdapter } from '../localMatchSessionAdapter';
import { MatchSession } from '../matchSession';

const source = (relativePath: string): string => readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

describe('Phase 3b opening authority', () => {
  it('keeps the cosmetic opening presenter incapable of gameplay mutation or event slicing', () => {
    const openingPresenter = source('../../presentation/openingPresentation.ts');
    const playUi = source('../../../../contexts/PlayUiContext.tsx');

    expect(existsSync(new URL('../../script', import.meta.url))).toBe(false);
    expect(openingPresenter).not.toMatch(
      /evalEffect|executeRulesCommands|dispatchReaction|operationService|events\.slice|frames\.slice/,
    );
    expect(openingPresenter).not.toContain('.dispatch(');
    expect(openingPresenter).not.toContain('setPresentedState');
    expect(openingPresenter).toContain('options.presentOpening(options.block)');
    expect(openingPresenter).toContain('options.bindPresentationSink(options.sink)');
    expect(playUi).toContain('const blockQueue: SeatPresentationBlock[] = []');
    expect(playUi).toContain('enqueueBlock(block)');
    expect(playUi).toContain('seatPresentationBlockToTransactionTimeline(block)');
    expect(playUi).toContain('await director.present(timeline, sink)');
  });

  it('preserves an opening location reaction at the same ordered frames live and in replay', () => {
    const session = MatchSession.fromBootstrap(buildDebugMatchBootstrap(
      DEBUG_DECKS[0],
      DEBUG_DECKS[7],
      'phase3b-0',
    ));
    const adapter = new LocalMatchSessionAdapter(session, { developerAccess: true });
    const canonical = session.runtime.initialization().opening;
    const live = adapter.initialization().opening;
    const replayFrames = adapter.debug!.replay().steps.filter(
      step => step.transactionId === live.transactionId,
    );

    const revealIndex = canonical.transitions.findIndex(
      transition => transition.event.type === 'LOCATION_REVEALED',
    );
    const reactionIndex = canonical.transitions.findIndex(
      transition => 'cause' in transition.event
        && transition.event.cause.effectKind === 'LOCATION'
        && transition.event.cause.reason === 'onReveal',
    );
    expect(revealIndex).toBeGreaterThanOrEqual(0);
    expect(reactionIndex).toBeGreaterThan(revealIndex);

    const reveal = canonical.transitions[revealIndex]!;
    const reaction = canonical.transitions[reactionIndex]!;
    expect(live.frames.find(frame => frame.frame === reveal.frame)?.event?.type)
      .toBe('LOCATION_REVEALED');
    expect(live.frames.find(frame => frame.frame === reaction.frame)?.event?.type)
      .toBe(reaction.event.type);

    expect(replayFrames.map(step => ({
      frame: step.frame,
      event: step.event,
    }))).toEqual(canonical.transitions.map(transition => ({
      frame: transition.frame,
      event: transition.event,
    })));
    expect(live.frames.map(frame => (
      replayFrames.find(step => step.frame === frame.frame)?.state
    ))).toEqual(live.frames.map(frame => frame.after));
    expect(replayFrames.at(-1)?.state).toEqual(live.postState);
  });
});
