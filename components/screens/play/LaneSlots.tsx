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
import { BoardCard } from './BoardCard';

interface LaneSlotsProps {
  side: 'top' | 'bottom';
  laneIdx: number;
  cards: ResolvedCard[];
}

export const LaneSlots = (props: LaneSlotsProps) => {
  const slotCardForGrid = (gridIdx: number): ResolvedCard | undefined => {
    const mapping = props.side === 'top' ? [2, 3, 0, 1] : [0, 1, 2, 3];
    const s = mapping.indexOf(gridIdx);
    return props.cards[s];
  };

  return (
    <div
      class={'lane-slots ' + (props.side === 'top' ? 'top' : 'bot')}
      data-lane={props.laneIdx}
      data-side={props.side}
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
                />
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
};
