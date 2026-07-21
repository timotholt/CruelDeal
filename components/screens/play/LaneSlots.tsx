/**
 * LaneSlots — the 2×2 slot grid for one side of one lane.
 *
 * Demo-era grid mapping:
 *   Player: cards[s] → grid index s directly (0→top-left ... 3→bottom-right).
 *   Enemy : mirrored vertically so the closest row sits next to the
 *           locations strip (mapping = [2, 3, 0, 1]).
 */

import { For, Show } from 'solid-js';
import type { ResolvedCard } from '@/services/playgame/view';
import type { Seat } from '@/services/playgame/engine/types/ids';
import { useVfx } from '../../game/VfxHost';
import { BoardCard } from './BoardCard';

interface LaneSlotsProps {
  side: 'top' | 'bottom';
  laneIdx: number;
  cards: ResolvedCard[];
  interactive?: boolean;
  inspectable?: boolean;
  viewerSeat?: Seat;
  stagedCardIds?: readonly string[];
  resolutionLocked?: boolean;
}

export const LaneSlots = (props: LaneSlotsProps) => {
  const { bindZoneRef } = useVfx();
  const owner = (): Seat | null => {
    if (!props.viewerSeat) return null;
    return props.side === 'bottom' ? props.viewerSeat : props.viewerSeat === 'P0' ? 'P1' : 'P0';
  };
  const slotCardForGrid = (gridIdx: number): ResolvedCard | undefined => {
    const mapping = props.side === 'top' ? [2, 3, 0, 1] : [0, 1, 2, 3];
    const s = mapping.indexOf(gridIdx);
    return props.cards[s];
  };

  return (
    <div
      ref={(el) => {
        const seat = owner();
        if (seat) bindZoneRef(`${seat}:lane:${props.laneIdx}`)(el);
      }}
      class={'lane-slots ' + (props.side === 'top' ? 'top' : 'bot')}
      data-lane={props.laneIdx}
      data-side={props.side}
      data-drop-zone={props.side === 'bottom' ? 'lane' : undefined}
      data-lane-id={props.side === 'bottom' ? props.laneIdx : undefined}
    >
      <For each={[0, 1, 2, 3]}>
        {(gridIdx) => (
          <div class="slot" data-slot={gridIdx}>
            <Show when={slotCardForGrid(gridIdx)} keyed>
              {(c) => (
                <BoardCard
                  card={c}
                  side={props.side}
                  laneIdx={props.laneIdx}
                  interactive={props.interactive}
                  inspectable={props.inspectable}
                  viewerSeat={props.viewerSeat}
                  stagedCardIds={props.stagedCardIds}
                  resolutionLocked={props.resolutionLocked}
                />
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
