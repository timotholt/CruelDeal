import { createRoot, createSignal } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_MANIFEST } from '@/services/playgame/engine/manifest/bootstrap';
import type { SeatVisibleMatchState } from '@/services/playgame/runtime/projection';
import type { UiState } from '@/services/playgame/view';
import { usePlayBoardViewModel } from './usePlayBoardViewModel';

const state = (
  overrides: Partial<SeatVisibleMatchState> = {},
): SeatVisibleMatchState => ({
  turn: 1,
  phase: 'AWAITING_INTENT',
  priority: 'P0',
  energy: { P0: 1, P1: 1 },
  maxEnergy: { P0: 1, P1: 1 },
  nextTurnEnergyBonus: { P0: 0, P1: 0 },
  deckCounts: { P0: 8, P1: 9 },
  locationDeckCount: 9,
  hands: { P0: [], P1: [] },
  cards: [],
  lanes: [],
  stagedCards: [],
  discard: { P0: [], P1: [] },
  destroyed: { P0: [], P1: [] },
  banished: { P0: [], P1: [] },
  banishedCounts: { P0: 0, P1: 0 },
  result: null,
  ...overrides,
} as SeatVisibleMatchState);

const ui: UiState = {
  handReservations: [],
  history: [],
  isFlipped: false,
  lockedResult: null,
  showEndGamePrompt: false,
};

describe('PlayBoard view model', () => {
  it('derives layout and interaction state without owning match mutation', () => {
    createRoot((dispose) => {
      const [engineState, setEngineState] = createSignal(state({
        lanes: [
          { id: 3, status: 'ACTIVE', location: null, cards: { P0: [], P1: [] }, power: { P0: 0, P1: 0 } },
          { id: 8, status: 'DESTROYED', location: null, cards: { P0: [], P1: [] }, power: { P0: 0, P1: 0 } },
        ],
      }));
      const [resolving, setResolving] = createSignal(false);
      const view = usePlayBoardViewModel({
        manifest: BOOTSTRAP_MANIFEST,
        localSeat: 'P0',
        remoteSeat: 'P1',
        engineState,
        ui,
        isResolving: resolving,
        turnFlowRunning: () => false,
        replayTimeline: () => null,
        replayCursor: () => 0,
        openPile: () => null,
        cardStatReadModel: () => null,
        lanePowerReadModel: () => null,
      });

      expect(view.laneIds()).toEqual([3]);
      expect(view.localDeckSize()).toBe(8);
      expect(view.remoteDeckSize()).toBe(9);
      expect(view.boardInteractive()).toBe(true);

      setResolving(true);
      expect(view.boardInteractive()).toBe(false);

      setResolving(false);
      setEngineState(state({ phase: 'RESOLVING' }));
      expect(view.boardLocked()).toBe(true);
      expect(view.boardInspectable()).toBe(false);
      dispose();
    });
  });
});
