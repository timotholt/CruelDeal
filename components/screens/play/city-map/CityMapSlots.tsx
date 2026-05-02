import { For, Show } from 'solid-js';
import type { CitySlot, Venue } from '@/services/playgame/city-map';

export interface CityMapSlotsProps {
  slots: readonly CitySlot[];
  venueById?: Readonly<Record<string, Venue>>;
  hoveredSlotId?: string | null;
  selectedSlotId?: string | null;
  interactive?: boolean;
  onSlotFocus?: (slot: CitySlot, venue: Venue | null) => void;
  onSlotBlur?: () => void;
  onSlotClick?: (slot: CitySlot, venue: Venue | null) => void;
}

function venueForSlot(slot: CitySlot, venueById?: Readonly<Record<string, Venue>>) {
  return slot.venueId && venueById ? venueById[slot.venueId] ?? null : null;
}

function slotLabel(slot: CitySlot, venue: Venue | null) {
  if (venue) return venue.name;
  return `Card slot ${slot.slotIndex + 1}`;
}

function slotKind(slot: CitySlot, venue: Venue | null) {
  return venue?.type || slot.slotRole || 'card-slot';
}

export const CityMapSlots = (props: CityMapSlotsProps) => {
  const interactive = () => props.interactive ?? true;
  const activateSlot = (slot: CitySlot, venue: Venue | null) => {
    if (interactive()) props.onSlotClick?.(slot, venue);
  };
  const onSlotKeyDown = (event: KeyboardEvent, slot: CitySlot, venue: Venue | null) => {
    if (!interactive() || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    props.onSlotClick?.(slot, venue);
  };

  return (
    <g class="city-map-slots" aria-label="City card slots">
      <For each={props.slots}>
        {(slot) => {
          const venue = () => venueForSlot(slot, props.venueById);
          const isHovered = () => props.hoveredSlotId === slot.id;
          const isSelected = () => props.selectedSlotId === slot.id;

          return (
            <g
              classList={{
                'city-map-slot': true,
                'city-map-slot--playable': !!slot.playableBy,
                'city-map-slot--hover': isHovered(),
                'city-map-slot--selected': isSelected(),
                [`city-map-slot--${slot.playableBy || 'neutral'}`]: true,
              }}
              data-slot-id={slot.id}
              data-venue-id={undefined}
              data-slot-kind={slotKind(slot, venue())}
              role={interactive() ? 'button' : 'img'}
              tabIndex={interactive() ? 0 : undefined}
              aria-label={slotLabel(slot, venue())}
              onFocus={() => props.onSlotFocus?.(slot, venue())}
              onBlur={() => props.onSlotBlur?.()}
              onClick={() => activateSlot(slot, venue())}
              onKeyDown={(event) => onSlotKeyDown(event, slot, venue())}
            >
              <circle class="city-map-slot__halo" cx={slot.x} cy={slot.y} r="6.8" />
              <circle class="city-map-slot__ring" cx={slot.x} cy={slot.y} r="4.1" />
              <circle class="city-map-slot__core" cx={slot.x} cy={slot.y} r="2.15" />
              <Show when={venue()}>
                {(venueData) => (
                  <text class="city-map-slot__icon" x={slot.x} y={slot.y - 7.2} aria-hidden="true">
                    {venueData().iconKey.slice(0, 2).toUpperCase()}
                  </text>
                )}
              </Show>
            </g>
          );
        }}
      </For>
    </g>
  );
};
