/**
 * PlayBoard — the interactive /play surface.
 *
 * Orchestrates (not implements):
 *   - fixed header / board stage / player footer shell
 *   - stable vertical LaneColumn rendering
 *   - Pointer Events drag-and-drop (useDragDrop)
 *   - opening prelude + committed transaction presentation
 *
 * Gameplay mutations go through typed runtime-backed context commands. The
 * presentation host is read-only. Rendering goes through
 * `services/playgame/view.ts` selectors.
 * UI primitives (HandCard, BoardCard, etc.) live in sibling files so they
 * can change without touching engine-coupled code.
 */

import { createEffect, createMemo, onCleanup, onMount } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import { useMatchSession } from '@/contexts/MatchSessionContext';
import { usePlayUi } from '@/contexts/PlayUiContext';
import type { VisiblePileZone } from '@/services/playgame/view';
import { HandRow } from './HandRow';
import { LaneGrid } from './LaneGrid';
import { setupDragDrop } from './useDragDrop';
import { useLaneHighlight } from './useLaneHighlight';
import { useLaneTopologyMotion } from './useLaneTopologyMotion';
import { MatchActionBar } from './MatchActionBar';
import { MatchHud } from './MatchHud';
import { PlayOverlays } from './PlayOverlays';
import { usePlayBoardViewModel } from './usePlayBoardViewModel';
import { useLanePresentationRefs } from './useLanePresentationRefs';
import { prepareHandLayoutTransition } from '@/services/playgame/presentation/handPresentation';
import {
  releaseAllHandSlots,
  releaseHandSlots,
  reserveHandSlots,
} from '@/services/playgame/presentation/handReservations';
import { startOpeningPresentation } from '@/services/playgame/presentation/openingPresentation';
import { createPlayPresentationHost } from '@/services/playgame/presentation/playPresentationHost';
import { createPlayPresentationSink } from '@/services/playgame/presentation/playPresentationSink';
import { showToast } from '@/services/playgame/toast';

interface PlayBoardProps {
  onExit?: () => void;
}

export const PlayBoard = (props: PlayBoardProps) => {
  const match = useMatchSession();
  const playUi = usePlayUi();
  const { manifest, localSeat, remoteSeat, bootstrap, openingTimeline } = match;
  const {
    presentedState: engineState,
    ui,
    setUi,
    isResolving,
    inspectorTarget,
    openMenuSeat,
    openPile,
    replayOpen,
    replayCursor,
    replayFollowingLive,
    replayClientActivity,
    turnFlowRunning,
    actions: uiActions,
  } = playUi;
  const {
    setOpenMenuSeat,
    setOpenPile,
    setReplayOpen,
    setReplayCursor,
    setReplayFollowingLive,
    setReplayClientActivity,
  } = uiActions;
  const actions = match.actions;
  const seatMeta = {
    P0: { name: bootstrap.participants.P0.displayName },
    P1: { name: bootstrap.participants.P1.displayName },
  } as const;
  const { cardRefs, cardVfxRegistry, motionSurface, bindZoneRef } = useVfx();
  const lanePresentationRefs = useLanePresentationRefs();
  const replayTimeline = createMemo(() => match.debug?.replay() ?? null);
  const view = usePlayBoardViewModel({
    manifest,
    localSeat,
    remoteSeat,
    engineState,
    ui,
    isResolving,
    turnFlowRunning,
    replayTimeline,
    replayCursor,
    openPile,
    cardStatReadModel: actions.cardStatReadModel,
    lanePowerReadModel: actions.lanePowerReadModel,
  });
  const {
    replayLastCursor,
    replayStep,
    inspectingReplayHistory,
    presentedState,
    boardLocked,
    boardInteractive,
    boardInspectable,
    boardCardResolutionLocked,
    laneIds,
    hand,
    reservedHandIds,
    interactiveHand,
    bottomLane,
    topLane,
    laneLocation: laneLoc,
    bottomPower,
    topPower,
    bottomBreakdown,
    topBreakdown,
    localHasPriority,
    localDiscard,
    localDestroyed,
    remoteDiscard,
    remoteDestroyed,
    remoteHandSize,
    localDeckSize,
    remoteDeckSize,
    selectedPileCards,
    recordedOutcomeLabel,
  } = view;
  const replayClientStatus = createMemo(() => {
    const activity = replayClientActivity();
    if (activity?.kind === 'PROCESSING_EVENTS') return 'Processing events';
    if (activity?.kind === 'PLAYING_ANIMATIONS') return 'Playing animations';
    if (activity?.kind === 'WAITING_FOR_PLAYER') {
      return `Waiting for Player ${activity.seat === 'P0' ? 1 : 2}`;
    }

    switch (engineState().phase) {
      case 'SETUP':
      case 'RESOLVING':
      case 'BETWEEN_TURNS':
        return 'Processing events';
      case 'ENDED':
        return 'Game ended';
      case 'AWAITING_INTENT':
      default:
        return `Waiting for Player ${localSeat === 'P0' ? 1 : 2}`;
    }
  });
  createEffect(() => {
    const maxIndex = replayLastCursor();
    if (replayFollowingLive()) {
      setReplayCursor(maxIndex);
    } else if (replayCursor() > maxIndex) {
      setReplayFollowingLive(true);
      setReplayCursor(maxIndex);
    }
  });

  createEffect(() => {
    if (!boardLocked() || inspectingReplayHistory()) return;
    uiActions.closeInspector();
    setOpenPile(null);
    setOpenMenuSeat(null);
  });

  useLaneHighlight({
    boardEl: () => boardEl,
    mode: () => 'hover',
    scores: () => [
      { local: bottomPower(0), remote: topPower(0) },
      { local: bottomPower(1), remote: topPower(1) },
      { local: bottomPower(2), remote: topPower(2) },
    ],
  });
  useLaneTopologyMotion({
    boardEl: () => boardEl,
    laneIds,
  });
  // ── Undo (one-card) ──────────────────────────────────────────────────────
  const handleUndoPending = async (): Promise<void> => {
    if (!boardInteractive() || isResolving()) return;
    const liveState = engineState();
    const lastStaged = [...liveState.stagedCards]
      .reverse()
      .find(token => liveState.cards.find(card => card.token === token)?.owner === localSeat);
    if (!lastStaged) return;
    // Capture the lane-card rect plus all current hand rects; after undo,
    // Solid re-renders and the lane card reappears in hand — FLIP-slide
    // both the restored card and the shuffled hand into place.
    const allIds = [lastStaged as string, ...interactiveHand().map(c => c.id)];
    const handLayoutTransition = prepareHandLayoutTransition(allIds, cardRefs);
    setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
    const undone = await actions.undoPending().finally(() => setReplayClientActivity(null));
    if (!undone) return;
    handLayoutTransition.playAfterRender();
  };

  let boardEl: HTMLDivElement | undefined;
  let toastAreaEl: HTMLDivElement | undefined;

  onMount(() => {
    const closeMenus = (e: MouseEvent) => {
      if ((e.target as Element).closest?.('.portrait-menu-anchor')) return;
      setOpenMenuSeat(null);
    };
    document.addEventListener('click', closeMenus);
    onCleanup(() => document.removeEventListener('click', closeMenus));

    if (!boardEl || !toastAreaEl) return;
    boardEl.classList.add('ready');

    const motion = motionSurface();
    if (!motion) return;
    const playRoot = boardEl.closest<HTMLElement>('.playgame-root');
    if (!playRoot) return;

    const unbindDnd = setupDragDrop({
      boardEl,
      localSeat,
      engineState,
      isResolving,
      localHand: interactiveHand,
      cardRefs,
      motionSurface: motion,
      stageCardInLane: async (cardId, lane) => {
        setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
        return actions.stageCardInLane(cardId, lane).finally(() => setReplayClientActivity(null));
      },
      undoPendingCard: async cardId => {
        setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
        return actions.undoPendingCard(cardId).finally(() => setReplayClientActivity(null));
      },
    });
    onCleanup(unbindDnd);

    const host = createPlayPresentationHost({
      manifest,
      localSeat,
      remoteSeat,
      motionSurface: motion,
      cardStatReadModel: actions.cardStatReadModel,
      cardVfxRegistry,
      handSlots: {
        reserve: cards => reserveHandSlots({ setUi }, cards),
        release: cardIds => releaseHandSlots({ setUi }, cardIds),
      },
    });
    const sink = createPlayPresentationSink({
      host,
      ui: {
        setLockedResult: result => setUi('lockedResult', result),
        setEndGamePromptVisible: value => setUi('showEndGamePrompt', value),
      },
      browser: {
        locationMap: lanePresentationRefs.mapElement,
        locationTile: lanePresentationRefs.tileElement,
        showToast: (message, options) =>
          showToast(toastAreaEl!, message, { duration: options.durationMs }),
      },
    });
    const openingPresentation = startOpeningPresentation({
      root: playRoot,
      toastArea: toastAreaEl,
      timeline: openingTimeline,
      sink,
      presentOpening: uiActions.presentOpening,
      bindPresentationSink: uiActions.bindPresentationSink,
    });

    onCleanup(() => {
      openingPresentation.dispose();
      sink.dispose();
      releaseAllHandSlots({ setUi });
      motion.cardMotion.cancelAll('presentation-invalidated');
    });
  });

  const selectReplayCursor = (cursor: number): void => {
    const maxIndex = replayLastCursor();
    const nextCursor = Math.min(Math.max(0, cursor), maxIndex);
    setReplayFollowingLive(nextCursor === maxIndex);
    setReplayCursor(nextCursor);
  };

  const togglePlayerMenu = (seat: 'P0' | 'P1'): void => {
    if (!boardInteractive()) return;
    setOpenMenuSeat(current => (current === seat ? null : seat));
  };

  const handleOpenPile = (owner: 'P0' | 'P1', zone: VisiblePileZone): void => {
    if (!boardInteractive()) return;
    setOpenMenuSeat(null);
    setOpenPile({ owner, zone });
  };

  const copyFrameJson = async (): Promise<void> => {
    const json = JSON.stringify(replayStep(), null, 2);
    await navigator.clipboard.writeText(json);
  };

  const copyGameJson = async (): Promise<void> => {
    const json = JSON.stringify(match.debug?.replay() ?? null, null, 2);
    await navigator.clipboard.writeText(json);
  };

  const handleEndTurn = (): void => {
    if (!boardInteractive() || turnFlowRunning()) return;
    setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
    void actions
      .endTurn(seat => {
        setReplayClientActivity({ kind: 'WAITING_FOR_PLAYER', seat });
      })
      .then(accepted => {
        if (!accepted) setReplayClientActivity(null);
      })
      .catch(() => setReplayClientActivity(null));
  };

  return (
    <>
      <div
        class="board play-frame"
        id="board"
        ref={element => {
          boardEl = element;
        }}
      >
        <MatchHud
          localSeat={localSeat}
          remoteSeat={remoteSeat}
          seatNames={{ P0: seatMeta.P0.name, P1: seatMeta.P1.name }}
          localHasPriority={localHasPriority()}
          openMenuSeat={openMenuSeat()}
          localCounts={{
            discard: localDiscard().length,
            destroyed: localDestroyed().length,
            banished: presentedState().banishedCounts[localSeat],
          }}
          remoteCounts={{
            discard: remoteDiscard().length,
            destroyed: remoteDestroyed().length,
            banished: presentedState().banishedCounts[remoteSeat],
          }}
          remoteDeckSize={remoteDeckSize()}
          remoteHandSize={remoteHandSize()}
          remoteEnergy={presentedState().energy[remoteSeat]}
          remoteDeckAnchorRef={bindZoneRef(`${remoteSeat}:deck`)}
          remoteHandAnchorRef={bindZoneRef(`${remoteSeat}:hand`)}
          onTogglePlayerMenu={togglePlayerMenu}
          onOpenPile={handleOpenPile}
        />

        <LaneGrid
          laneIds={laneIds()}
          location={laneLoc}
          topCards={topLane}
          bottomCards={bottomLane}
          topPower={topPower}
          bottomPower={bottomPower}
          topBreakdown={topBreakdown}
          bottomBreakdown={bottomBreakdown}
          interactive={boardInteractive()}
          inspectable={boardInspectable()}
          viewerSeat={localSeat}
          stagedCardIds={presentedState().stagedCards}
          resolutionLocked={boardCardResolutionLocked()}
          replayAvailable={replayTimeline() !== null}
          replayOpen={replayOpen()}
          onToggleReplay={() => setReplayOpen(open => !open)}
          bindMapRef={lanePresentationRefs.bindMap}
          bindLocationRef={lanePresentationRefs.bindTile}
        />

        <footer class="player-footer">
          <HandRow
            owner={localSeat}
            cards={hand()}
            reservedIds={reservedHandIds()}
            energy={presentedState().energy[localSeat]}
            interactive={boardInteractive()}
            inspectable={boardInspectable()}
          />

          <MatchActionBar
            interactive={boardInteractive()}
            resolving={isResolving()}
            resultLocked={ui.lockedResult !== null}
            outcomeLabel={recordedOutcomeLabel()}
            turn={presentedState().turn}
            deckSize={localDeckSize()}
            energy={presentedState().energy[localSeat]}
            deckAnchorRef={bindZoneRef(`${localSeat}:deck`)}
            onExit={() => props.onExit?.()}
            onUndo={handleUndoPending}
            onEndTurn={handleEndTurn}
          />
        </footer>

        <div
          ref={bindZoneRef('generated')}
          class="generated-anchor"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '48px',
            height: '68px',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />

        <div
          class="toast-area"
          id="toastArea"
          ref={element => {
            toastAreaEl = element;
          }}
        />
      </div>
      <PlayOverlays
        replayTimeline={replayTimeline()}
        replayOpen={replayOpen()}
        replayFollowingLive={replayFollowingLive()}
        replayCursor={replayCursor()}
        replayStep={replayStep()}
        performanceProfile={match.debug?.performanceProfile() ?? null}
        replayClientStatus={replayClientStatus()}
        seatNames={{ P0: seatMeta.P0.name, P1: seatMeta.P1.name }}
        inspectorTarget={inspectorTarget()}
        openPile={openPile()}
        selectedPileCards={selectedPileCards()}
        endGamePromptVisible={ui.showEndGamePrompt && ui.lockedResult !== null}
        outcomeLabel={recordedOutcomeLabel()}
        turn={presentedState().turn}
        onReplayCursorChange={selectReplayCursor}
        onCopyFrameJson={copyFrameJson}
        onCopyGameJson={copyGameJson}
        onCloseInspector={uiActions.closeInspector}
        onClosePile={() => setOpenPile(null)}
        onCloseEndGamePrompt={() => setUi('showEndGamePrompt', false)}
        onExit={() => props.onExit?.()}
      />
    </>
  );
};
