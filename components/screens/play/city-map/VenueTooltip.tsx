import { Show } from 'solid-js';
import type { CitySlot, Venue } from '@/services/playgame/city-map';
import { placeVenueTooltip, type Size, type VenueTooltipLayout } from './useCityMapHover';

export interface VenueTooltipProps {
  slot: CitySlot | null;
  venue: Venue | null;
  board: Size;
  layout?: VenueTooltipLayout;
}

function fallbackVenueName(slot: CitySlot) {
  return slot.slotRole ? `${slot.slotRole} venue` : `Slot ${slot.slotIndex + 1}`;
}

export const VenueTooltip = (props: VenueTooltipProps) => {
  const layout = () => props.slot
    ? props.layout ?? placeVenueTooltip(props.slot, props.board)
    : null;

  return (
    <Show when={props.slot && layout()}>
      {(placed) => {
        const slot = () => props.slot as CitySlot;
        const venue = () => props.venue;
        const icon = () => (venue()?.iconKey || slot().slotRole || 'V').slice(0, 2).toUpperCase();
        const name = () => venue()?.name || fallbackVenueName(slot());
        const bonus = () => venue()?.bonus?.text || venue()?.typeLabel || 'Venue slot';

        return (
          <>
            <svg
              class="venue-tooltip-link"
              viewBox={`0 0 ${props.board.width} ${props.board.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={placed().connectorStart.x}
                y1={placed().connectorStart.y}
                x2={placed().connectorEnd.x}
                y2={placed().connectorEnd.y}
              />
            </svg>
            <div
              class="venue-tooltip"
              style={{
                left: `${(placed().x / props.board.width) * 100}%`,
                top: `${(placed().y / props.board.height) * 100}%`,
                width: `${(placed().width / props.board.width) * 100}%`,
                height: `${(placed().height / props.board.height) * 100}%`,
              }}
              role="status"
              aria-live="polite"
            >
              <div class="venue-tooltip__icon" aria-hidden="true">{icon()}</div>
              <div class="venue-tooltip__body">
                <div class="venue-tooltip__name">{name()}</div>
                <div class="venue-tooltip__bonus">{bonus()}</div>
              </div>
            </div>
          </>
        );
      }}
    </Show>
  );
};
