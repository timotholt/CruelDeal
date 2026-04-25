/**
 * PlayBoard — the interactive /play surface.
 *
 * Orchestrates (not implements):
 *   - hand / lanes / locations / HUD layout
 *   - lane-map overlays  (useLaneMaps)
 *   - drag-and-drop      (useDragDrop)
 *   - opening sequence + turn-resolve flow (script/runner)
 *
 * Mutations go through `actions.*` (engine events) or the script engine
 * context. Rendering goes through `services/playgame/view.ts` selectors.
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
import type { MatchEvent } from '@/services/playgame/engine/types/events';
import { exportReplayBundle, replayMatch } from '@/services/playgame/engine/replay';
import { createScript, type Script } from '@/services/playgame/script/runner';
import type { PlayScriptCtx } from '@/services/playgame/script/actions';
import { openingSequence, resolveTurnFlow } from '@/services/playgame/script/flows';
import { captureHandRects, playLayoutSlide } from '@/services/vfx/animations/layout-flip';
import { ZoomInspector } from '../ZoomInspector';
import { HandCard } from './HandCard';
import { LaneSlots } from './LaneSlots';
import { LocationTile } from './LocationTile';
import { setupDragDrop } from './useDragDrop';
import { setupLaneMaps } from './useLaneMaps';
import { inspectTarget, closeInspect } from './inspector';
import { ReplayDrawer } from './ReplayDrawer';
import { EnergyBadge } from './EnergyBadge';
import { HiddenHandIndicator } from './HiddenHandIndicator';
import { PlayerPortraitMenu } from './PlayerPortraitMenu';
import { PileViewer } from './PileViewer';
import { TurnOrb } from './TurnOrb';

interface PlayBoardProps {
  onExit?: () => void;
}

export const PlayBoard = (props: PlayBoardProps) => {
  const isDev = import.meta.env.DEV;
  const pg = usePlayGame();
  const {
    engineState, setEngineState, dispatch, manifest, ui, setUi,
    engineRng, isResolving, actions, localSeat, remoteSeat, seatMeta,
  } = pg;
  const { cardRefs, boardRef } = useVfx();
  const [replayOpen, setReplayOpen] = createSignal(false);
  const [replayEnabled, setReplayEnabled] = createSignal(false);
  const [replayFrameIndex, setReplayFrameIndex] = createSignal(0);
  const [openMenuSeat, setOpenMenuSeat] = createSignal<'P0' | 'P1' | null>(null);
  const [openPile, setOpenPile] = createSignal<{ owner: 'P0' | 'P1'; zone: CardZone } | null>(null);

  const replayTimeline = createMemo(() => {
    if (!isDev) return null;
    return replayMatch({
      seed: engineState.seed,
      manifest,
      events: engineState.log.map((entry) => entry.event as MatchEvent),
    });
  });
  const replayFrame = createMemo(() => {
    const timeline = replayTimeline();
    if (!replayEnabled() || !timeline) return null;
    return timeline.frames[replayFrameIndex()] ?? null;
  });
  const presentedState = createMemo<EngineMatchState>(() => replayFrame()?.state ?? engineState);
  const boardInteractive = createMemo(() => !replayEnabled());

  createEffect(() => {
    const timeline = replayTimeline();
    if (!timeline) return;
    const maxIndex = Math.max(0, timeline.frames.length - 1);
    if (replayFrameIndex() > maxIndex) setReplayFrameIndex(maxIndex);
  });

  // ── Derived projections ─────────────────────────────────────────────────
  const hand = createMemo<ResolvedCard[]>(() => getHandForSeat(presentedState(), localSeat, manifest));
  /**
   * Visible hand = engine hand MINUS cards still in the incoming buffer.
   * The draw-slide animation needs the new card to appear in the DOM only
   * after the event animator releases it from `ui.incoming`, otherwise the
   * card lands in its final hand slot before the deck-slide runs.
   */
  const visibleHand = createMemo<ResolvedCard[]>(() => {
    if (replayEnabled()) return hand();
    const incoming = new Set(ui.incoming.map((c) => c.id));
    return hand().filter((c) => !incoming.has(c.id));
  });

  const bottomLane = (i: LaneIdx): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, localSeat, manifest);
  const topLane = (i: LaneIdx): ResolvedCard[] => getLaneCardsForSeat(presentedState(), i, remoteSeat, manifest);
  const laneLoc = (i: LaneIdx): ResolvedLocation => getLocation(presentedState(), i, manifest);
  const bottomPower = (i: LaneIdx): number => getLanePower(presentedState(), i, localSeat, manifest);
  const topPower = (i: LaneIdx): number => getLanePower(presentedState(), i, remoteSeat, manifest);
  const bottomBreakdown = (i: LaneIdx): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, localSeat, manifest);
  const topBreakdown = (i: LaneIdx): LanePowerBreakdown => getLanePowerBreakdown(presentedState(), i, remoteSeat, manifest);
  const localHasPriority = createMemo(() => presentedState().priority === localSeat);
  const handScale = createMemo(() => {
    const n = visibleHand().length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
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
  const handleUndoPending = (): void => {
    if (!boardInteractive() || isResolving()) return;
    const lastStaged = [...engineState.stagingOrder]
      .reverse()
      .find((id) => engineState.cards[id]?.owner === localSeat);
    if (!lastStaged) return;
    // Capture the lane-card rect plus all current hand rects; after undo,
    // Solid re-renders and the lane card reappears in hand — FLIP-slide
    // both the restored card and the shuffled hand into place.
    const allIds = [lastStaged as string, ...visibleHand().map((c) => c.id)];
    const oldRects = captureHandRects(allIds, cardRefs);
    actions.undoPending();
    requestAnimationFrame(() => playLayoutSlide(oldRects, cardRefs));
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
      localHand: visibleHand,
      cardRefs,
      stageCardInLane: actions.stageCardInLane,
      undoPendingCard: actions.undoPendingCard,
    });
    onCleanup(unbindDnd);

    // Opening sequence — hand the script runner a ctx bound to the engine
    // store + UI sidecar. `drawQueue` stays empty in live play so opening
    // deals come from the seeded engine deck through CARD_DRAWN.
    const drawQueue: PlayScriptCtx['drawQueue'] = [];
    const boardWrapEl = boardRef();
    if (!boardWrapEl) return;

    const setPhase = (phase: EngineMatchState['phase']): void => {
      setEngineState('phase', phase);
    };

    const ctx: PlayScriptCtx = {
      state: engineState,
      setState: setEngineState as unknown as PlayScriptCtx['setState'],
      dispatch,
      setPhase,
      ui,
      setUi,
      manifest,
      localSeat,
      remoteSeat,
      engineRng,
      boardEl,
      boardWrap: boardWrapEl,
      toastArea: toastAreaEl,
      cardRefs,
      drawQueue,
      deckEl,
    };
    script = createScript(ctx);
    void script.run(openingSequence());
    onCleanup(() => script?.cancel());
  });

  const toggleReplayMode = (): void => {
    if (!replayEnabled()) {
      const timeline = replayTimeline();
      if (timeline) setReplayFrameIndex(timeline.frames.length - 1);
    }
    setReplayEnabled((current) => !current);
  };

  const togglePlayerMenu = (seat: 'P0' | 'P1'): void => {
    setOpenMenuSeat((current) => current === seat ? null : seat);
  };

  const handleOpenPile = (owner: 'P0' | 'P1', zone: CardZone): void => {
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

  const copyReplayJson = async (): Promise<void> => {
    const json = JSON.stringify(
      exportReplayBundle(engineState as EngineMatchState, manifest, {
        localSeat,
      }),
      null,
      2,
    );
    await navigator.clipboard.writeText(json);
  };

  return (
    <>
      <div class="board" id="board" ref={boardEl}>
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
                  viewerSeat={localSeat}
                  phase={presentedState().phase}
                  stagingOrder={presentedState().stagingOrder}
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
                  viewerSeat={localSeat}
                  phase={presentedState().phase}
                  stagingOrder={presentedState().stagingOrder}
                />
              )}
            </For>
          </div>
        </div>

        <div class="hand" id="hand" style={{ '--hand-scale': handScale().toFixed(3) }}>
          <For each={visibleHand()}>
            {(card) => (
              <HandCard
                card={card}
                playable={card.cost <= presentedState().energy[localSeat]}
                interactive={boardInteractive()}
              />
            )}
          </For>
        </div>

        <div class="action-bar">
          <button
            class={`retreat-btn${ui.lockedResult ? ' result-locked' : ''}`}
            disabled={!boardInteractive() || isResolving()}
            onClick={() => {
              if (!boardInteractive() || isResolving()) return;
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
            disabled={!boardInteractive() || isResolving()}
            onClick={handleUndoPending}
          >
            <EnergyBadge value={presentedState().energy[localSeat]} title={`Your energy ${presentedState().energy[localSeat]}`} />
          </button>
          <button
            class="end-turn"
            disabled={!boardInteractive() || isResolving()}
            onClick={() => {
              if (!boardInteractive() || isResolving() || !script) return;
              void script.run(resolveTurnFlow());
            }}
          >
            END TURN
          </button>
        </div>

        <div
          ref={deckEl}
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

        <div class="toast-area" id="toastArea" ref={toastAreaEl} />

        <Show when={isDev && replayTimeline()}>
          {(timeline) => (
            <ReplayDrawer
              open={replayOpen()}
              replayEnabled={replayEnabled()}
              frameIndex={replayFrameIndex()}
              frameCount={timeline().frames.length}
              seed={engineState.seed}
              selectedFrame={replayEnabled() ? replayFrame() : timeline().frames[timeline().frames.length - 1]}
              onToggleOpen={() => setReplayOpen((open) => !open)}
              onToggleReplay={toggleReplayMode}
              onFrameChange={setReplayFrameIndex}
              onCopyReplayJson={copyReplayJson}
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
