import { For, Show } from 'solid-js';
import type {
  ResolvedCard,
  VisiblePileZone,
} from '@/services/playgame/view';
import { CardRenderer } from './rendering/CardRenderer';

interface PileViewerProps {
  ownerName: string;
  zone: VisiblePileZone;
  cards: readonly ResolvedCard[];
  onClose: () => void;
}

const zoneLabel = (zone: VisiblePileZone): string => {
  switch (zone) {
    case 'DISCARD':
      return 'Discard';
    case 'DESTROYED':
      return 'Destroyed';
    case 'BANISHED':
      return 'Banished';
  }
};

export const PileViewer = (props: PileViewerProps) => {
  return (
    <div class="pile-viewer" onClick={() => props.onClose()}>
      <div class="pile-viewer__panel" onClick={(e) => e.stopPropagation()}>
        <div class="pile-viewer__header">
          <div>
            <div class="pile-viewer__eyebrow">{props.ownerName}</div>
            <div class="pile-viewer__title">{zoneLabel(props.zone)} Pile</div>
          </div>
          <button class="pile-viewer__close" type="button" onClick={() => props.onClose()}>Close</button>
        </div>

        <div class="pile-viewer__count">{props.cards.length} card{props.cards.length === 1 ? '' : 's'}</div>

        <Show when={props.cards.length > 0} fallback={<div class="pile-viewer__empty">No cards here yet.</div>}>
          <div class="pile-viewer__grid">
            <For each={props.cards}>
              {(card) => (
                <div class="card pile-viewer__card" data-card-type={card.type}>
                  <CardRenderer card={card} />
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
};
