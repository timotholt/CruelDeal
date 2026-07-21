import { Show } from 'solid-js';
import { ModalBackdrop } from '@/components/ui/ModalBackdrop';
import { Portal } from '@/components/ui/Portal';
import { ZoomInspector } from '../ZoomInspector';
import type { OpenPile } from '@/contexts/PlayUiContext';
import type { MatchPerformanceProfile } from '@/services/playgame/runtime/performanceTelemetry';
import type {
  DebugReplayStep,
  DebugReplayTimeline,
} from '@/services/playgame/debug/replayContracts';
import type { Seat } from '@/services/playgame/engine/types/ids';
import type { ResolvedCard } from '@/services/playgame/view';
import type { InspectTarget } from './inspector';
import { PileViewer } from './PileViewer';
import { ReplayDrawer } from './ReplayDrawer';

interface PlayOverlaysProps {
  readonly replayTimeline: DebugReplayTimeline | null;
  readonly replayOpen: boolean;
  readonly replayFollowingLive: boolean;
  readonly replayCursor: number;
  readonly replayStep: DebugReplayStep | null;
  readonly performanceProfile: MatchPerformanceProfile | null;
  readonly replayClientStatus: string;
  readonly seatNames: Readonly<Record<Seat, string>>;
  readonly inspectorTarget: InspectTarget | null;
  readonly openPile: OpenPile | null;
  readonly selectedPileCards: readonly ResolvedCard[];
  readonly endGamePromptVisible: boolean;
  readonly outcomeLabel: 'WIN' | 'LOSE' | 'DRAW' | null;
  readonly turn: number;
  readonly onReplayCursorChange: (cursor: number) => void;
  readonly onCopyFrameJson: () => Promise<void>;
  readonly onCopyGameJson: () => Promise<void>;
  readonly onCloseInspector: () => void;
  readonly onClosePile: () => void;
  readonly onCloseEndGamePrompt: () => void;
  readonly onExit: () => void;
}

export const PlayOverlays = (props: PlayOverlaysProps) => (
  <>
    <Show when={props.replayTimeline}>
      {(timeline) => (
        <ReplayDrawer
          open={props.replayOpen}
          followingLive={props.replayFollowingLive}
          cursor={props.replayCursor}
          stepCount={timeline().steps.length}
          steps={timeline().steps}
          performanceProfile={props.performanceProfile!}
          selectedStep={props.replayStep}
          seatNames={props.seatNames}
          clientStatus={props.replayClientStatus}
          onCursorChange={props.onReplayCursorChange}
          onCopyFrameJson={props.onCopyFrameJson}
          onCopyGameJson={props.onCopyGameJson}
        />
      )}
    </Show>

    <Portal>
      <div class="playgame-root playgame-portal-root">
        <Show when={props.inspectorTarget} keyed>
          {(target) => (
            <ZoomInspector
              target={target}
              onClose={props.onCloseInspector}
            />
          )}
        </Show>
      </div>
    </Portal>

    <Portal>
      <div class="playgame-root playgame-portal-root">
        <Show when={props.openPile}>
          {(pile) => (
            <PileViewer
              ownerName={props.seatNames[pile().owner]}
              zone={pile().zone}
              cards={props.selectedPileCards}
              onClose={props.onClosePile}
            />
          )}
        </Show>
      </div>
    </Portal>

    <Portal>
      <div class="playgame-root playgame-portal-root">
        <Show when={props.endGamePromptVisible}>
          <ModalBackdrop onClose={props.onCloseEndGamePrompt} blurAmount="lg" showCloseHint={false}>
          <div
            class="w-full max-w-md rounded-2xl border border-white/12 bg-slate-950/95 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="text-[0.7rem] font-black uppercase tracking-[0.34em] text-cyan-300/80">
              Game Ended
            </div>
            <div class="mt-3 font-black uppercase tracking-[0.12em] text-2xl">
              {props.outcomeLabel === 'WIN'
                ? `You Won On Turn ${props.turn}`
                : props.outcomeLabel === 'LOSE'
                  ? `You Lost On Turn ${props.turn}`
                  : `Draw Locked On Turn ${props.turn}`}
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-300">
              The official result is already recorded. Do you want to keep playing just for fun?
            </p>
            <div class="mt-5 grid grid-cols-2 gap-3">
              <button
                class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-rose-100 transition hover:bg-rose-500/18"
                onClick={() => {
                  props.onCloseEndGamePrompt();
                  props.onExit();
                }}
              >
                Exit Match
              </button>
              <button
                class="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-500/18"
                onClick={() => props.onCloseEndGamePrompt()}
              >
                Keep Playing
              </button>
            </div>
          </div>
          </ModalBackdrop>
        </Show>
      </div>
    </Portal>
  </>
);
