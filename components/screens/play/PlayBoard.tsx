/**
 * PlayBoard — the interactive /play surface.
 *
 * Orchestrates (not implements):
 *   - fixed header / board stage / player footer shell
 *   - stable vertical LaneColumn rendering
 *   - Pointer Events drag-and-drop (useDragDrop)
 *   - opening sequence + turn-resolve flow (script/runner)
 *
 * Gameplay mutations go through typed runtime-backed context commands. The
 * script context is presentation-only. Rendering goes through
 * `services/playgame/view.ts` selectors.
 * UI primitives (HandCard, BoardCard, etc.) live in sibling files so they
 * can change without touching engine-coupled code.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { useVfx } from '../../game/VfxHost';
import { Portal } from '../../ui/Portal';
import { ModalBackdrop } from '../../ui/ModalBackdrop';
import { usePlayGame } from '@/contexts/PlayGameContext';
import { getLanePowerBreakdown, type LanePowerBreakdown } from '@/services/playgame/engine/projections';
import {
  getCardsInZoneForSeat,
  type ResolvedCard,
  type ResolvedLocation,
  getHandForSeat,
  getLaneCardsForSeat,
  getLocation,
  getLanePower,
} from '@/services/playgame/view';
import type { MatchState as EngineMatchState } from '@/services/playgame/engine/types/state';
import type { LaneId } from '@/services/playgame/engine/types/ids';
import type { CardZone } from '@/services/playgame/engine/types/state';
import { renderRuntimeReplay } from '@/services/playgame/runtime/replayExport';
import { createScript, type Script } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence, resolveTurnFlow } from '@/services/playgame/script/flows';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { ZoomInspector } from '../ZoomInspector';
import { HandRow } from './HandRow';
import { LaneColumn } from './LaneColumn';
import { setupDragDrop } from './useDragDrop';
import { useLaneHighlight } from './useLaneHighlight';
import { useLaneTopologyMotion } from './useLaneTopologyMotion';
import { inspectTarget, closeInspect } from './inspector';
import { ReplayDrawer } from './ReplayDrawer';
import { EnergyBadge } from './EnergyBadge';
import { HiddenHandIndicator } from './HiddenHandIndicator';
import { PlayerPortraitMenu } from './PlayerPortraitMenu';
import { PileViewer } from './PileViewer';
import { TurnOrb } from './TurnOrb';
import { MiniDeckIndicator } from './MiniDeckIndicator';
import { selectInteractiveHand } from './handInteractivity';
import { releaseAllHandSlots } from '@/services/playgame/presentation/handReservations';
import { isBoardCardResolutionLocked } from '@/services/playgame/presentation/cardFacing';
import { activeLaneIds } from '@/services/playgame/engine/laneTopology';
import { createPlayfieldEventPresenter } from '@/services/playgame/presentation/playfieldEvents';

interface PlayBoardProps {
  onExit?: () => void;
}

export const PlayBoard = (props: PlayBoardProps) => {
  const pg = usePlayGame();
  const {
    engineState, manifest, ui, setUi, isResolving, actions,
    localSeat, remoteSeat, seatMeta, openingTimeline,
  } = pg;
  const { cardRefs, zoneRefs, motionSurface, bindZoneRef } = useVfx();
  const [replayOpen, setReplayOpen] = createSignal(false);
  const [replayCursor, setReplayCursor] = createSignal(0);
  const [replayFollowingLive, setReplayFollowingLive] = createSignal(true);
  const [turnFlowRunning, setTurnFlowRunning] = createSignal(false);
  const [openMenuSeat, setOpenMenuSeat] = createSignal<'P0' | 'P1' | null>(null);
  const [openPile, setOpenPile] = createSignal<{ owner: 'P0' | 'P1'; zone: CardZone } | null>(null);

  const runtimeReplay = createMemo(() => {
    // Track committed presentation progress; the export itself remains a
    // read-only bootstrap + genesis + transaction-record snapshot.
    void engineState.log.length;
    return pg.exportRuntimeReplay();
  });
  const replayTimeline = createMemo(() => {
    const replay = runtimeReplay();
    return replay ? renderRuntimeReplay(replay, manifest) : null;
  });
  const replayLastCursor = createMemo(() => Math.max(0, (replayTimeline()?.steps.length ?? 1) - 1));
  const replayStep = createMemo(() => {
    const timeline = replayTimeline();
    if (!timeline) return null;
    return timeline.steps[replayCursor()] ?? null;
  });
  const inspectingReplayHistory = createMemo(() => replayCursor() < replayLastCursor());
  const presentedState = createMemo<EngineMatchState>(() => (
    inspectingReplayHistory() ? replayStep()?.state ?? engineState : engineState
  ));
  const boardLocked = createMemo(() => turnFlowRunning() || isResolving() || presentedState().phase === 'RESOLVING');
  const boardInteractive = createMemo(() => !inspectingReplayHistory() && !boardLocked());
  const boardInspectable = createMemo(() => inspectingReplayHistory() || boardInteractive());
  const boardCardResolutionLocked = createMemo(() => isBoardCardResolutionLocked({
    inspectingHistory: inspectingReplayHistory(),
    phase: presentedState().phase,
    liveResolutionLocked: ui.isFlipped,
  }));
  const laneIds = createMemo<readonly LaneId[]>(() => activeLaneIds(presentedState()));

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
    closeInspect();
    setOpenPile(null);
    setOpenMenuSeat(null);
  });

  // ── Derived projections ─────────────────────────────────────────────────
  const hand = createMemo<ResolvedCard[]>(() => getHandForSeat(presentedState(), localSeat, manifest));
  const reservedHandIds = createMemo<Set<string>>(() => (
    inspectingReplayHistory() ? new Set<string>() : new Set(ui.handReservations.map((card) => card.id))
  ));
  const interactiveHand = createMemo<ResolvedCard[]>(() => {
    const reserved = reservedHandIds();
    return selectInteractiveHand(hand(), reserved);
  });

  const bottomLane = (i: LaneId): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, localSeat, manifest);
  const topLane = (i: LaneId): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, remoteSeat, manifest);
  const laneLoc = (i: LaneId): ResolvedLocation =>
    getLocation(presentedState(), i, manifest, localSeat);
  const bottomPower = (i: LaneId): number => getLanePower(presentedState(), i, localSeat, manifest);
  const topPower = (i: LaneId): number => getLanePower(presentedState(), i, remoteSeat, manifest);
  const bottomBreakdown = (i: LaneId): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, localSeat, manifest);
  const topBreakdown = (i: LaneId): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, remoteSeat, manifest);
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
  const localDiscard = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'DISCARD', manifest));
  const localDestroyed = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'DESTROYED', manifest));
  const localBanished = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'BANISHED', manifest));
  const remoteDiscard = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'DISCARD', manifest));
  const remoteDestroyed = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'DESTROYED', manifest));
  const remoteBanished = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'BANISHED', manifest));
  const remoteHandSize = createMemo(() => presentedState().hand[remoteSeat].length);
  const localDeckSize = createMemo(() => presentedState().deck[localSeat].length);
  const remoteDeckSize = createMemo(() => presentedState().deck[remoteSeat].length);
  const recordedOutcomeLabel = createMemo(() => {
    const result = ui.lockedResult;
    if (!result) return null;
    return result.winner === localSeat ? 'WIN' : result.winner === remoteSeat ? 'LOSE' : 'DRAW';
  });

  // ── Undo (one-card) ──────────────────────────────────────────────────────
  const handleUndoPending = async (): Promise<void> => {
    if (!boardInteractive() || isResolving()) return;
    const lastStaged = [...engineState.stagingOrder]
      .reverse()
      .find((id) => engineState.cards[id]?.owner === localSeat);
    if (!lastStaged) return;
    // Capture the lane-card rect plus all current hand rects; after undo,
    // Solid re-renders and the lane card reappears in hand — FLIP-slide
    // both the restored card and the shuffled hand into place.
    const allIds = [lastStaged as string, ...interactiveHand().map((c) => c.id)];
    const oldRects = captureHandRects(allIds, cardRefs);
    const undone = await actions.undoPending();
    if (!undone) return;
    queueMicrotask(() => playLayoutSlide(oldRects, cardRefs));
  };

  // ── Script instance for opening + resolveTurn ────────────────────────────
  let script: Script | undefined;

  let boardEl: HTMLDivElement | undefined;
  let toastAreaEl: HTMLDivElement | undefined;
  let deckEl: HTMLDivElement | undefined;

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
      stageCardInLane: actions.stageCardInLane,
      undoPendingCard: actions.undoPendingCard,
    });
    onCleanup(unbindDnd);

    // Opening authority is already committed by the runtime. The script is a
    // presentation-only reader of committed transitions plus the UI sidecar.
    const ctx: PlayScriptCtx = {
      state: engineState,
      ui,
      setUi,
      manifest,
      localSeat,
      remoteSeat,
      boardEl,
      motionSurface: motion,
      toastArea: toastAreaEl,
      cardRefs,
      zoneRefs,
      deckEl,
      presentCommittedFrame: actions.presentCommittedFrame,
      finishTurnPresentation: actions.finishTurnPresentation,
      presentPlayfieldEvent: createPlayfieldEventPresenter(playRoot),
    };
    ctx.onCancel = () => {
      releaseAllHandSlots(ctx);
      ctx.motionSurface.cardMotion.cancelAll('presentation-invalidated');
    };
    script = createScript(ctx);
    void script.run(openingSequence(openingTimeline));
    onCleanup(() => script?.cancel());
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

  const handleOpenPile = (owner: 'P0' | 'P1', zone: CardZone): void => {
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
    const json = JSON.stringify(pg.exportRuntimeReplay(), null, 2);
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
                banished: localBanished().length,
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
                banished: remoteBanished().length,
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
                  stagingOrder={presentedState().stagingOrder}
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
                deckEl = element;
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
                if (!boardInteractive() || !script || turnFlowRunning()) return;
                setTurnFlowRunning(true);
                void actions.endTurn()
                  .then((timeline) => timeline ? script?.run(resolveTurnFlow(timeline)) : undefined)
                  .finally(() => setTurnFlowRunning(false));
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
              seed={engineState.seed}
              steps={timeline().steps}
              manifest={manifest}
              replay={runtimeReplay()!}
              selectedStep={replayStep()}
              onCursorChange={selectReplayCursor}
              onCopyFrameJson={copyFrameJson}
              onCopyGameJson={copyGameJson}
            />
          )}
        </Show>
      </div>

      <Portal>
        <Show when={inspectTarget()} keyed>
          {(t) => <ZoomInspector target={t} onClose={closeInspect} />}
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
                  ? 'You Won On Turn 6'
                  : recordedOutcomeLabel() === 'LOSE'
                    ? 'You Lost On Turn 6'
                    : 'Draw Locked On Turn 6'}
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
