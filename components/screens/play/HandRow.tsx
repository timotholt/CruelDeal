import { For, createMemo, untrack } from 'solid-js';
import type { ResolvedCard } from '@/services/playgame/view';
import { HAND_SLOT_RESERVE_MS } from '@/services/playgame/presentation/handPresentation';
import type { Seat } from '@/services/playgame/engine/types/ids';
import { useVfx } from '@/components/game/VfxHost';
import { HandCard } from './HandCard';

interface HandRowProps {
  owner: Seat;
  cards: ResolvedCard[];
  reservedIds: ReadonlySet<string>;
  energy: number;
  interactive: boolean;
  inspectable?: boolean;
}

interface HandSlotProps {
  cardId: string;
  cardById: Map<string, ResolvedCard>;
  reservedIds: ReadonlySet<string>;
  energy: number;
  interactive: boolean;
  inspectable?: boolean;
}

const HandSlot = (props: HandSlotProps) => {
  const initialCard = untrack(() => props.cardById.get(props.cardId) as ResolvedCard);
  const card = createMemo<ResolvedCard>(
    (previous) => props.cardById.get(props.cardId) ?? previous,
    initialCard,
  );
  const reserved = createMemo(() => props.reservedIds.has(props.cardId));

  return (
    <HandCard
      card={card()}
      playable={card().cost <= props.energy}
      interactive={props.interactive && !reserved()}
      inspectable={(props.inspectable ?? props.interactive) && !reserved()}
      hidden={reserved()}
    />
  );
};

export const HandRow = (props: HandRowProps) => {
  const { bindZoneRef } = useVfx();
  const handScale = createMemo(() => {
    const n = props.cards.length;
    if (n <= 4) return 1;
    if (n <= 5) return 0.9;
    if (n <= 6) return 0.82;
    return 0.74;
  });
  const cardIds = createMemo<string[]>(() => props.cards.map((card) => card.id));
  const cardById = createMemo<Map<string, ResolvedCard>>(() => (
    new Map(props.cards.map((card) => [card.id, card]))
  ));

  return (
    <div
      ref={bindZoneRef(`${props.owner}:hand`)}
      class="hand"
      id="hand"
      data-drop-zone="hand"
      aria-label="Return selected staged card to hand"
      style={{
        '--hand-scale': handScale().toFixed(3),
        '--hand-slot-reserve-ms': `${HAND_SLOT_RESERVE_MS}ms`,
      }}
    >
      <For each={cardIds()}>
        {(cardId) => (
          <HandSlot
            cardId={cardId}
            cardById={cardById()}
            reservedIds={props.reservedIds}
            energy={props.energy}
            interactive={props.interactive}
            inspectable={props.inspectable}
          />
        )}
      </For>
    </div>
  );
};
