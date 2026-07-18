import { For, Show } from 'solid-js';
import type { CardZone } from '@/services/playgame/engine/types/state';
import type { ResolvedCard } from '@/services/playgame/view';

interface PileViewerProps {
  ownerName: string;
  zone: CardZone;
  cards: readonly ResolvedCard[];
  onClose: () => void;
}

const zoneLabel = (zone: CardZone): string => {
  switch (zone) {
    case 'DISCARD':
      return 'Discard';
    case 'DESTROYED':
      return 'Destroyed';
    case 'BANISHED':
      return 'Banished';
    default:
      return zone;
  }
};

export const PileViewer = (props: PileViewerProps) => {
  return (
    <div class="pile-viewer" onClick={props.onClose}>
      <div class="pile-viewer__panel" onClick={(e) => e.stopPropagation()}>
        <div class="pile-viewer__header">
          <div>
            <div class="pile-viewer__eyebrow">{props.ownerName}</div>
            <div class="pile-viewer__title">{zoneLabel(props.zone)} Pile</div>
          </div>
          <button class="pile-viewer__close" type="button" onClick={props.onClose}>Close</button>
        </div>

        <div class="pile-viewer__count">{props.cards.length} card{props.cards.length === 1 ? '' : 's'}</div>

        <Show when={props.cards.length > 0} fallback={<div class="pile-viewer__empty">No cards here yet.</div>}>
          <div class="pile-viewer__grid">
            <For each={props.cards}>
              {(card) => (
                <div class="pile-card" data-card-type={card.type}>
                  <div class="pile-card__badges">
                    <span class="pile-card__cost">{card.cost}</span>
                    {card.type !== 'spell'
                      ? <span class="pile-card__power">{card.power}</span>
                      : null}
                  </div>
                  <div class="pile-card__name">{card.name}</div>
                  <div class="pile-card__type">{card.type}</div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
