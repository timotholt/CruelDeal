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

import { For, Show, createEffect, createMemo, onCleanup, onMount } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import { Portal } from '../../ui/Portal';
import { ModalBackdrop } from '../../ui/ModalBackdrop';
import { useMatchSession } from '@/contexts/MatchSessionContext';
import { usePlayUi } from '@/contexts/PlayUiContext';
import {
  getCardsInZoneForSeat,
  type ResolvedCard,
  type ResolvedLocation,
  getHandForSeat,
  getLaneCardsForSeat,
  getLocation,
  type VisiblePileZone,
} from '@/services/playgame/view';
import type { LaneId } from '@/services/playgame/engine/types/ids';
import type {
  SeatLanePowerReadModel,
} from '@/services/playgame/runtime/seatReadModels';
import { ZoomInspector } from '../ZoomInspector';
import { HandRow } from './HandRow';
import { LaneColumn } from './LaneColumn';
import { setupDragDrop } from './useDragDrop';
import { useLaneHighlight } from './useLaneHighlight';
import { useLaneTopologyMotion } from './useLaneTopologyMotion';
import { ReplayDrawer } from './ReplayDrawer';
import { EnergyBadge } from './EnergyBadge';
import { HiddenHandIndicator } from './HiddenHandIndicator';
import { PlayerPortraitMenu } from './PlayerPortraitMenu';
import { PileViewer } from './PileViewer';
import { TurnOrb } from './TurnOrb';
import { MiniDeckIndicator } from './MiniDeckIndicator';
import { selectInteractiveHand } from './handInteractivity';
import {
  prepareHandLayoutTransition,
} from '@/services/playgame/presentation/handPresentation';
import {
  releaseAllHandSlots,
  releaseHandSlots,
  reserveHandSlots,
} from '@/services/playgame/presentation/handReservations';
import { isBoardCardResolutionLocked } from '@/services/playgame/presentation/cardFacing';
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
  const {
    manifest, localSeat, remoteSeat, bootstrap, openingTimeline,
  } = match;
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
  const { cardRefs, motionSurface, bindZoneRef } = useVfx();
  const replayTimeline = createMemo(() => match.debug?.replay() ?? null);
  const replayLastCursor = createMemo(() => Math.max(0, (replayTimeline()?.steps.length ?? 1) - 1));
  const replayStep = createMemo(() => {
    const timeline = replayTimeline();
    if (!timeline) return null;
    return timeline.steps[replayCursor()] ?? null;
  });
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
  const inspectingReplayHistory = createMemo(() => replayCursor() < replayLastCursor());
  const presentedState = createMemo(() => (
    inspectingReplayHistory() ? replayStep()?.state ?? engineState() : engineState()
  ));
  const boardLocked = createMemo(() => turnFlowRunning() || isResolving() || presentedState().phase === 'RESOLVING');
  const boardInteractive = createMemo(() => !inspectingReplayHistory() && !boardLocked());
  const boardInspectable = createMemo(() => inspectingReplayHistory() || boardInteractive());
  const boardCardResolutionLocked = createMemo(() => isBoardCardResolutionLocked({
    inspectingHistory: inspectingReplayHistory(),
    phase: presentedState().phase,
    liveResolutionLocked: ui.isFlipped,
  }));
  const laneIds = createMemo<readonly LaneId[]>(() =>
    presentedState().lanes
      .filter(lane => lane.status === 'ACTIVE')
      .map(lane => lane.id));

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

  // ── Derived projections ─────────────────────────────────────────────────
  const statReader = () => inspectingReplayHistory()
    ? undefined
    : actions.cardStatReadModel;
  const hand = createMemo<ResolvedCard[]>(() => getHandForSeat(
    presentedState(),
    localSeat,
    manifest,
    statReader(),
  ));
  const reservedHandIds = createMemo<Set<string>>(() => (
    inspectingReplayHistory() ? new Set<string>() : new Set(ui.handReservations.map((card) => card.id))
  ));
  const interactiveHand = createMemo<ResolvedCard[]>(() => {
    const reserved = reservedHandIds();
    return selectInteractiveHand(hand(), reserved);
  });

  const bottomLane = (i: LaneId): ResolvedCard[] => getLaneCardsForSeat(
    presentedState(),
    i,
    localSeat,
    manifest,
    statReader(),
  );
  const topLane = (i: LaneId): ResolvedCard[] => getLaneCardsForSeat(
    presentedState(),
    i,
    remoteSeat,
    manifest,
    statReader(),
  );
  const laneLoc = (i: LaneId): ResolvedLocation =>
    getLocation(presentedState(), i, manifest);
  const laneState = (i: LaneId) =>
    presentedState().lanes.find(lane => lane.id === i);
  const bottomPower = (i: LaneId): number =>
    laneState(i)?.power[localSeat] ?? 0;
  const topPower = (i: LaneId): number =>
    laneState(i)?.power[remoteSeat] ?? 0;
  const fallbackBreakdown = (
    lane: LaneId,
    owner: 'P0' | 'P1',
  ): SeatLanePowerReadModel => {
    const cards = getLaneCardsForSeat(
      presentedState(),
      lane,
      owner,
      manifest,
    ).map(card => ({
      label: card.name,
      basePower: card.basePower,
      permanentDelta: card.storedPowerDelta,
      ongoingDelta: 0,
      finalPower: card.power,
    }));
    const total = laneState(lane)?.power[owner] ?? 0;
    return {
      lane,
      owner,
      cards,
      cardSubtotal: cards.reduce((sum, card) => sum + card.finalPower, 0),
      laneAdditions: [],
      subtotalAfterAdditions: total,
      multipliers: [],
      effectiveMultiplier: 1,
      total,
    };
  };
  const breakdown = (lane: LaneId, owner: 'P0' | 'P1') =>
    inspectingReplayHistory()
      ? fallbackBreakdown(lane, owner)
      : actions.lanePowerReadModel(lane, owner)
        ?? fallbackBreakdown(lane, owner);
  const bottomBreakdown = (i: LaneId): SeatLanePowerReadModel =>
    breakdown(i, localSeat);
  const topBreakdown = (i: LaneId): SeatLanePowerReadModel =>
    breakdown(i, remoteSeat);
  const localHasPriority = createMemo(() => presentedState().priority === localSeat);

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
  const zoneCards = (seat: 'P0' | 'P1', zone: VisiblePileZone) =>
    getCardsInZoneForSeat(
      presentedState(),
      seat,
      zone,
      manifest,
      statReader(),
    );
  const localDiscard = createMemo(() => zoneCards(localSeat, 'DISCARD'));
  const localDestroyed = createMemo(() => zoneCards(localSeat, 'DESTROYED'));
  const localBanished = createMemo(() => zoneCards(localSeat, 'BANISHED'));
  const remoteDiscard = createMemo(() => zoneCards(remoteSeat, 'DISCARD'));
  const remoteDestroyed = createMemo(() => zoneCards(remoteSeat, 'DESTROYED'));
  const remoteBanished = createMemo(() => zoneCards(remoteSeat, 'BANISHED'));
  const remoteHandSize = createMemo(() =>
    presentedState().hands[remoteSeat].length);
  const localDeckSize = createMemo(() =>
    presentedState().deckCounts[localSeat]);
  const remoteDeckSize = createMemo(() =>
    presentedState().deckCounts[remoteSeat]);
  const recordedOutcomeLabel = createMemo(() => {
    const result = ui.lockedResult;
    if (!result) return null;
    return result.winner === localSeat ? 'WIN' : result.winner === remoteSeat ? 'LOSE' : 'DRAW';
  });

  // ── Undo (one-card) ──────────────────────────────────────────────────────
  const handleUndoPending = async (): Promise<void> => {
    if (!boardInteractive() || isResolving()) return;
    const liveState = engineState();
    const lastStaged = [...liveState.stagedCards].reverse().find(token =>
      liveState.cards.find(card => card.token === token)?.owner === localSeat);
    if (!lastStaged) return;
    // Capture the lane-card rect plus all current hand rects; after undo,
    // Solid re-renders and the lane card reappears in hand — FLIP-slide
    // both the restored card and the shuffled hand into place.
    const allIds = [lastStaged as string, ...interactiveHand().map((c) => c.id)];
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
        return actions.stageCardInLane(cardId, lane)
          .finally(() => setReplayClientActivity(null));
      },
      undoPendingCard: async (cardId) => {
        setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
        return actions.undoPendingCard(cardId)
          .finally(() => setReplayClientActivity(null));
      },
    });
    onCleanup(unbindDnd);

    const host = createPlayPresentationHost({
      manifest,
      localSeat,
      remoteSeat,
      motionSurface: motion,
      cardStatReadModel: actions.cardStatReadModel,
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
        locationMap: lane => boardEl?.querySelector<HTMLElement>(
          `.lane-map[data-lane="${lane}"]`,
        ) ?? null,
        locationTile: lane => boardEl?.querySelector<HTMLElement>(
          `.location[data-lane="${lane}"]`,
        ) ?? null,
        showToast: (message, options) => showToast(
          toastAreaEl!,
          message,
          { duration: options.durationMs },
        ),
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
    setOpenMenuSeat((current) => current === seat ? null : seat);
  };

  const handleOpenPile = (
    owner: 'P0' | 'P1',
    zone: VisiblePileZone,
  ): void => {
    if (!boardInteractive()) return;
    setOpenMenuSeat(null);
    setOpenPile({ owner, zone });
  };

  const selectedPileCards = createMemo<readonly ResolvedCard[]>(() => {
    const pile = openPile();
    if (!pile) return [];
    if (pile.owner === localSeat) {
      if (pile.zone === 'DISCARD') return localDiscard();
      if (pile.zone === 'DESTROYED') return localDestroyed();
      return localBanished();
    }
    if (pile.zone === 'DISCARD') return remoteDiscard();
    if (pile.zone === 'DESTROYED') return remoteDestroyed();
    return remoteBanished();
  });

  const copyFrameJson = async (): Promise<void> => {
    const json = JSON.stringify(replayStep(), null, 2);
    await navigator.clipboard.writeText(json);
  };

  const copyGameJson = async (): Promise<void> => {
    const json = JSON.stringify(match.debug?.replay() ?? null, null, 2);
    await navigator.clipboard.writeText(json);
  };

  return (
    <>
      <div class="board play-frame" id="board" ref={(element) => { boardEl = element; }}>
        {/* TOP HUD */}
        <header class="hud-top opponent-header match-hud">
          <div class="match-hud__identity match-hud__identity--local">
            <PlayerPortraitMenu
              owner={localSeat}
              name={seatMeta[localSeat].name}
              side="left"
              hasPriority={localHasPriority()}
              open={openMenuSeat() === localSeat}
              counts={{
                discard: localDiscard().length,
                destroyed: localDestroyed().length,
                banished: presentedState().banishedCounts[localSeat],
              }}
              onToggle={() => togglePlayerMenu(localSeat)}
              onOpenPile={(zone) => handleOpenPile(localSeat, zone)}
            />
          </div>

          <div class="match-hud__opponent-resources" aria-label="Opponent resources">
            <div class="match-hud__resource match-hud__resource--deck">
              <MiniDeckIndicator
                count={remoteDeckSize()}
                anchorRef={bindZoneRef(`${remoteSeat}:deck`)}
              />
            </div>
            <div class="match-hud__resource match-hud__resource--hand">
              <HiddenHandIndicator
                count={remoteHandSize()}
                anchorRef={bindZoneRef(`${remoteSeat}:hand`)}
              />
            </div>
            <div class="match-hud__resource match-hud__resource--energy">
              <EnergyBadge
                value={presentedState().energy[remoteSeat]}
                title={`Opponent energy ${presentedState().energy[remoteSeat]}`}
              />
            </div>
          </div>

          <div class="match-hud__identity match-hud__identity--remote">
            <PlayerPortraitMenu
              owner={remoteSeat}
              name={seatMeta[remoteSeat].name}
              side="right"
              hasPriority={!localHasPriority()}
              open={openMenuSeat() === remoteSeat}
              counts={{
                discard: remoteDiscard().length,
                destroyed: remoteDestroyed().length,
                banished: presentedState().banishedCounts[remoteSeat],
              }}
              onToggle={() => togglePlayerMenu(remoteSeat)}
              onOpenPile={(zone) => handleOpenPile(remoteSeat, zone)}
            />
          </div>
        </header>

        <main class="board-stage board-game-area">
          <Show when={replayTimeline()}>
            <button
              class="replay-toggle replay-float-toggle"
              type="button"
              onClick={() => setReplayOpen((open) => !open)}
            >
              {replayOpen() ? 'Hide Replay' : 'Replay'}
            </button>
          </Show>

          <div class="lane-track" data-active-lane-count={laneIds().length}>
            <For each={laneIds()}>
              {(laneId, order) => (
                <LaneColumn
                  laneId={laneId}
                  order={order()}
                  activeLaneCount={laneIds().length}
                  location={laneLoc(laneId)}
                  topCards={topLane(laneId)}
                  bottomCards={bottomLane(laneId)}
                  topPower={topPower(laneId)}
                  bottomPower={bottomPower(laneId)}
                  topBreakdown={topBreakdown(laneId)}
                  bottomBreakdown={bottomBreakdown(laneId)}
                  interactive={boardInteractive()}
                  inspectable={boardInspectable()}
                  viewerSeat={localSeat}
                  stagedCardIds={presentedState().stagedCards}
                  resolutionLocked={boardCardResolutionLocked()}
                />
              )}
            </For>
          </div>
        </main>

        <footer class="player-footer">
          <HandRow
            owner={localSeat}
            cards={hand()}
            reservedIds={reservedHandIds()}
            energy={presentedState().energy[localSeat]}
            interactive={boardInteractive()}
            inspectable={boardInspectable()}
          />

          <div class="action-bar">
            <button
              class={`retreat-btn${ui.lockedResult ? ' result-locked' : ''}`}
              disabled={!ui.lockedResult && (!boardInteractive() || isResolving())}
              onClick={() => {
                if (!ui.lockedResult && !boardInteractive()) return;
                props.onExit?.();
              }}
            >
              {recordedOutcomeLabel()
                ? `CLOSE (${recordedOutcomeLabel()})`
                : 'RETREAT'}
            </button>
            <TurnOrb turn={presentedState().turn} />
            <MiniDeckIndicator
              count={localDeckSize()}
              label="Your deck"
              anchorRef={(element) => {
                bindZoneRef(`${localSeat}:deck`)(element);
              }}
            />
            <button
              class="energy-button"
              title="Tap to undo last played card"
              disabled={!boardInteractive()}
              onClick={handleUndoPending}
            >
              <EnergyBadge value={presentedState().energy[localSeat]} title={`Your energy ${presentedState().energy[localSeat]}`} />
            </button>
            <button
              class="end-turn"
              disabled={!boardInteractive()}
              onClick={() => {
                if (!boardInteractive() || turnFlowRunning()) return;
                setReplayClientActivity({ kind: 'PROCESSING_EVENTS' });
                void actions.endTurn((seat) => {
                  setReplayClientActivity({ kind: 'WAITING_FOR_PLAYER', seat });
                })
                  .then((accepted) => {
                    if (!accepted) setReplayClientActivity(null);
                  })
                  .catch(() => setReplayClientActivity(null));
              }}
            >
              END TURN
            </button>
          </div>
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

        <div class="toast-area" id="toastArea" ref={(element) => { toastAreaEl = element; }} />

        <Show when={replayTimeline()}>
          {(timeline) => (
            <ReplayDrawer
              open={replayOpen()}
              followingLive={replayFollowingLive()}
              cursor={replayCursor()}
              stepCount={timeline().steps.length}
              steps={timeline().steps}
              performanceProfile={match.debug!.performanceProfile()}
              selectedStep={replayStep()}
              seatNames={{
                P0: seatMeta.P0.name,
                P1: seatMeta.P1.name,
              }}
              clientStatus={replayClientStatus()}
              onCursorChange={selectReplayCursor}
              onCopyFrameJson={copyFrameJson}
              onCopyGameJson={copyGameJson}
            />
          )}
        </Show>
      </div>

      <Portal>
        <Show when={inspectorTarget()} keyed>
          {(t) => (
            <ZoomInspector
              target={t}
              onClose={uiActions.closeInspector}
            />
          )}
        </Show>
      </Portal>

      <Portal>
        <Show when={openPile()}>
          {(pile) => (
            <PileViewer
              ownerName={seatMeta[pile().owner].name}
              zone={pile().zone}
              cards={selectedPileCards()}
              onClose={() => setOpenPile(null)}
            />
          )}
        </Show>
      </Portal>

      <Portal>
        <Show when={ui.showEndGamePrompt && ui.lockedResult}>
          <ModalBackdrop onClose={() => setUi('showEndGamePrompt', false)} blurAmount="lg" showCloseHint={false}>
            <div
              class="w-full max-w-md rounded-2xl border border-white/12 bg-slate-950/95 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div class="text-[0.7rem] font-black uppercase tracking-[0.34em] text-cyan-300/80">
                Game Ended
              </div>
              <div class="mt-3 font-black uppercase tracking-[0.12em] text-2xl">
                {recordedOutcomeLabel() === 'WIN'
                  ? `You Won On Turn ${presentedState().turn}`
                  : recordedOutcomeLabel() === 'LOSE'
                    ? `You Lost On Turn ${presentedState().turn}`
                    : `Draw Locked On Turn ${presentedState().turn}`}
              </div>
              <p class="mt-3 text-sm leading-6 text-slate-300">
                The official result is already recorded. Do you want to keep playing just for fun?
              </p>
              <div class="mt-5 grid grid-cols-2 gap-3">
                <button
                  class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/18"
                  onClick={() => {
                    setUi('showEndGamePrompt', false);
                    props.onExit?.();
                  }}
                >
                  Exit Match
                </button>
                <button
                  class="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-500/18"
                  onClick={() => setUi('showEndGamePrompt', false)}
                >
                  Keep Playing
                </button>
              </div>
            </div>
          </ModalBackdrop>
        </Show>
      </Portal>
    </>
  );
};
