/**
 * PlayBoard — the interactive /play surface.
 *
 * Orchestrates (not implements):
 *   - hand / lanes / locations / HUD layout
 *   - lane-map overlays  (useLaneMaps)
 *   - drag-and-drop      (useDragDrop)
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
import type { LaneIdx } from '@/services/playgame/engine/types/ids';
import type { CardZone } from '@/services/playgame/engine/types/state';
import { renderRuntimeReplay } from '@/services/playgame/runtime/replayExport';
import { createScript, type Script } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence, resolveTurnFlow } from '@/services/playgame/script/flows';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { ZoomInspector } from '../ZoomInspector';
import { HandRow } from './HandRow';
import { LaneSlots } from './LaneSlots';
import { LocationTile } from './LocationTile';
import { setupDragDrop } from './useDragDrop';
import { setupLaneMaps } from './useLaneMaps';
import { useLaneHighlight } from './useLaneHighlight';
import { inspectTarget, closeInspect } from './inspector';
import { ReplayDrawer } from './ReplayDrawer';
import { EnergyBadge } from './EnergyBadge';
import { HiddenHandIndicator } from './HiddenHandIndicator';
import { PlayerPortraitMenu } from './PlayerPortraitMenu';
import { PileViewer } from './PileViewer';
import { TurnOrb } from './TurnOrb';
import { selectInteractiveHand } from './handInteractivity';
import { releaseAllHandSlots } from '@/services/playgame/presentation/handReservations';
import { isBoardCardResolutionLocked } from '@/services/playgame/presentation/cardFacing';

interface PlayBoardProps {
  onExit?: () => void;
}

export const PlayBoard = (props: PlayBoardProps) => {
  const isDev = import.meta.env.DEV;
  const pg = usePlayGame();
  const {
    engineState, manifest, ui, setUi, isResolving, actions,
    localSeat, remoteSeat, seatMeta, openingTimeline,
  } = pg;
  const { cardRefs, zoneRefs, boardRef, bindZoneRef } = useVfx();
  const [replayOpen, setReplayOpen] = createSignal(false);
  const [replayFrameIndex, setReplayFrameIndex] = createSignal(0);
  const [replayFollowingLive, setReplayFollowingLive] = createSignal(true);
  const [turnFlowRunning, setTurnFlowRunning] = createSignal(false);
  const [openMenuSeat, setOpenMenuSeat] = createSignal<'P0' | 'P1' | null>(null);
  const [openPile, setOpenPile] = createSignal<{ owner: 'P0' | 'P1'; zone: CardZone } | null>(null);

  const runtimeReplay = createMemo(() => {
    if (!isDev) return null;
    // Track committed presentation progress; the export itself remains a
    // read-only bootstrap + genesis + transaction-record snapshot.
    void engineState.log.length;
    return pg.exportRuntimeReplay();
  });
  const replayTimeline = createMemo(() => {
    const replay = runtimeReplay();
    return replay ? renderRuntimeReplay(replay, manifest) : null;
  });
  const replayLastIndex = createMemo(() => Math.max(0, (replayTimeline()?.frames.length ?? 1) - 1));
  const replayFrame = createMemo(() => {
    const timeline = replayTimeline();
    if (!timeline) return null;
    return timeline.frames[replayFrameIndex()] ?? null;
  });
  const inspectingReplayHistory = createMemo(() => replayFrameIndex() < replayLastIndex());
  const presentedState = createMemo<EngineMatchState>(() => (
    inspectingReplayHistory() ? replayFrame()?.state ?? engineState : engineState
  ));
  const boardLocked = createMemo(() => turnFlowRunning() || isResolving() || presentedState().phase === 'RESOLVING');
  const boardInteractive = createMemo(() => !inspectingReplayHistory() && !boardLocked());
  const boardInspectable = createMemo(() => inspectingReplayHistory() || boardInteractive());
  const boardCardResolutionLocked = createMemo(() => isBoardCardResolutionLocked({
    inspectingHistory: inspectingReplayHistory(),
    phase: presentedState().phase,
    liveResolutionLocked: ui.isFlipped,
  }));

  createEffect(() => {
    const maxIndex = replayLastIndex();
    if (replayFollowingLive()) {
      setReplayFrameIndex(maxIndex);
    } else if (replayFrameIndex() > maxIndex) {
      setReplayFollowingLive(true);
      setReplayFrameIndex(maxIndex);
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

  const bottomLane = (i: LaneIdx): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, localSeat, manifest);
  const topLane = (i: LaneIdx): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, remoteSeat, manifest);
  const laneLoc = (i: LaneIdx): ResolvedLocation => getLocation(presentedState(), i, manifest);
  const bottomPower = (i: LaneIdx): number => getLanePower(presentedState(), i, localSeat, manifest);
  const topPower = (i: LaneIdx): number => getLanePower(presentedState(), i, remoteSeat, manifest);
  const bottomBreakdown = (i: LaneIdx): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, localSeat, manifest);
  const topBreakdown = (i: LaneIdx): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, remoteSeat, manifest);
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
  const localDiscard = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'DISCARD', manifest));
  const localDestroyed = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'DESTROYED', manifest));
  const localBanished = createMemo(() => getCardsInZoneForSeat(presentedState(), localSeat, 'BANISHED', manifest));
  const remoteDiscard = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'DISCARD', manifest));
  const remoteDestroyed = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'DESTROYED', manifest));
  const remoteBanished = createMemo(() => getCardsInZoneForSeat(presentedState(), remoteSeat, 'BANISHED', manifest));
  const remoteHandSize = createMemo(() => presentedState().hand[remoteSeat].length);
  const remoteDeckSize = createMemo(() => presentedState().deck[remoteSeat].length);
  const recordedOutcomeLabel = createMemo(() => {
    const result = ui.lockedResult;
    if (!result) return null;
    return result.winner === localSeat ? 'WIN' : result.winner === remoteSeat ? 'LOSS' : 'DRAW';
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

    // Lane overlay art comes from the locations the engine already assigned
    // in createInitialEngineState. NO RNG here — each lane's map must match
    // the lane's location def, otherwise the revealed tile shows one name
    // and the background shows a different biome.
    const lanePaths: [string | null, string | null, string | null] = [
      laneLoc(0).mapArt,
      laneLoc(1).mapArt,
      laneLoc(2).mapArt,
    ];
    const maps = setupLaneMaps(boardEl, lanePaths);
    onCleanup(maps.dispose);

    const unbindDnd = setupDragDrop({
      boardEl,
      localSeat,
      engineState,
      isResolving,
      localHand: interactiveHand,
      cardRefs,
      stageCardInLane: actions.stageCardInLane,
      undoPendingCard: actions.undoPendingCard,
    });
    onCleanup(unbindDnd);

    // Opening authority is already committed by the runtime. The script is a
    // presentation-only reader of committed frames plus the UI sidecar.
    const boardWrapEl = boardRef();
    if (!boardWrapEl) return;

    const ctx: PlayScriptCtx = {
      state: engineState,
      ui,
      setUi,
      manifest,
      localSeat,
      remoteSeat,
      boardEl,
      boardWrap: boardWrapEl,
      toastArea: toastAreaEl,
      cardRefs,
      zoneRefs,
      deckEl,
      presentCommittedFrame: actions.presentCommittedFrame,
      finishTurnPresentation: actions.finishTurnPresentation,
    };
    ctx.onCancel = () => releaseAllHandSlots(ctx);
    script = createScript(ctx);
    void script.run(openingSequence(openingTimeline));
    onCleanup(() => script?.cancel());
  });

  const selectReplayFrame = (index: number): void => {
    const maxIndex = replayLastIndex();
    const nextIndex = Math.min(Math.max(0, index), maxIndex);
    setReplayFollowingLive(nextIndex === maxIndex);
    setReplayFrameIndex(nextIndex);
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
    const json = JSON.stringify(replayFrame(), null, 2);
    await navigator.clipboard.writeText(json);
  };

  const copyGameJson = async (): Promise<void> => {
    const json = JSON.stringify(pg.exportRuntimeReplay(), null, 2);
    await navigator.clipboard.writeText(json);
  };

  return (
    <>
      <div class="board" id="board" ref={(element) => { boardEl = element; }}>
        {/* TOP HUD */}
        <div class="hud-top">
          <div class="hud-top__side hud-top__side--left">
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

          <Show when={isDev && replayTimeline()}>
            <button
              class="replay-toggle hud-replay-toggle"
              type="button"
              onClick={() => setReplayOpen((open) => !open)}
            >
              {replayOpen() ? 'Hide Replay' : 'Replay'}
            </button>
          </Show>

          <div class="hud-top__center">
            <TurnOrb turn={presentedState().turn} />
          </div>

          <div class="hud-top__side hud-top__side--right">
            <div class="opponent-cluster">
              <HiddenHandIndicator count={remoteHandSize()} />
              <div class="opponent-stat" title={`Deck ${remoteDeckSize()}`}>
                <span class="opponent-stat__label">Deck</span>
                <span class="opponent-stat__value">{remoteDeckSize()}</span>
              </div>
              <EnergyBadge value={presentedState().energy[remoteSeat]} title={`Opponent energy ${presentedState().energy[remoteSeat]}`} />
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
          </div>
        </div>

        <div class="board-game-area">
          <div class="row enemy-row">
            <For each={[0, 1, 2] as const}>
              {(i) => (
                <LaneSlots
                  side="top"
                  laneIdx={i}
                  cards={topLane(i)}
                  interactive={boardInteractive()}
                  inspectable={boardInspectable()}
                  viewerSeat={localSeat}
                  stagingOrder={presentedState().stagingOrder}
                  resolutionLocked={boardCardResolutionLocked()}
                />
              )}
            </For>
          </div>

          <div class="row locations">
            <For each={[0, 1, 2] as const}>
              {(i) => (
                <LocationTile
                  location={laneLoc(i)}
                  laneIdx={i}
                  bottomPower={bottomPower(i)}
                  topPower={topPower(i)}
                  bottomBreakdown={bottomBreakdown(i)}
                  topBreakdown={topBreakdown(i)}
                  interactive={boardInspectable()}
                />
              )}
            </For>
          </div>

          <div class="row player-row">
            <For each={[0, 1, 2] as const}>
              {(i) => (
                <LaneSlots
                  side="bottom"
                  laneIdx={i}
                  cards={bottomLane(i)}
                  interactive={boardInteractive()}
                  inspectable={boardInspectable()}
                  viewerSeat={localSeat}
                  stagingOrder={presentedState().stagingOrder}
                  resolutionLocked={boardCardResolutionLocked()}
                />
              )}
            </For>
          </div>
        </div>

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
            disabled={!boardInteractive() || isResolving()}
            onClick={() => {
              if (!boardInteractive()) return;
              props.onExit?.();
            }}
          >
            {recordedOutcomeLabel()
              ? `RETREAT (${recordedOutcomeLabel()})`
              : 'RETREAT'}
          </button>
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

        <div
          ref={(el) => {
            deckEl = el;
            bindZoneRef(`${localSeat}:deck`)(el);
          }}
          class="deck-anchor"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-80px',
            bottom: '120px',
            width: '48px',
            height: '68px',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />
        <div
          ref={bindZoneRef(`${remoteSeat}:deck`)}
          class="deck-anchor deck-anchor--remote"
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '-80px',
            top: '120px',
            width: '48px',
            height: '68px',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />
        <div
          ref={bindZoneRef(`${remoteSeat}:hand`)}
          class="hand-anchor hand-anchor--remote"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '64px',
            width: '70px',
            height: '100px',
            transform: 'translateX(-50%)',
            visibility: 'hidden',
            'pointer-events': 'none',
          }}
        />
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

        <Show when={isDev && replayTimeline()}>
          {(timeline) => (
            <ReplayDrawer
              open={replayOpen()}
              followingLive={replayFollowingLive()}
              frameIndex={replayFrameIndex()}
              frameCount={timeline().frames.length}
              seed={engineState.seed}
              frames={timeline().frames}
              manifest={manifest}
              replay={runtimeReplay()!}
              selectedFrame={replayFrame()}
              onFrameChange={selectReplayFrame}
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
                  : recordedOutcomeLabel() === 'LOSS'
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
