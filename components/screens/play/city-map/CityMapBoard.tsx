import { Show, createMemo, createSignal } from 'solid-js';
import { buildCityMap, type CityMap } from '@/services/playgame/city-map';
import { CityMapSvg } from './CityMapSvg';
import { CityMapSlots } from './CityMapSlots';
import { VenueTooltip } from './VenueTooltip';
import { useCityMapHover } from './useCityMapHover';
import { CityMapDebugDock, type CityMapDebugState } from './CityMapDebugDock';
import { RouteDemoLayer } from './RouteDemoLayer';
import './cityMapStyles.css';

export interface CityMapBoardProps {
  seed?: string | number;
  city?: CityMap;
  width?: number;
  height?: number;
  interactive?: boolean;
  showVenueTooltips?: boolean;
  debug?: {
    showLabels?: boolean;
    showBuildings?: boolean;
    showRoads?: boolean;
    showSlots?: boolean;
  };
}

export const CityMapBoard = (props: CityMapBoardProps) => {
  const [selectedSlotId, setSelectedSlotId] = createSignal<string | null>(null);
  const [debugState, setDebugState] = createSignal<CityMapDebugState>({
    showMap: true,
    showBuildings: props.debug?.showBuildings ?? true,
    showRoads: props.debug?.showRoads ?? true,
    showLabels: props.debug?.showLabels ?? true,
    showSlots: props.debug?.showSlots ?? true,
    showRouteDemo: false,
  });
  const city = createMemo(() => props.city || buildCityMap(props.seed ?? 'new-game-city'));
  const width = () => props.width || city().width;
  const height = () => props.height || city().height;
  const slots = createMemo(() => city().districts.flatMap((district) => district.slots || []));
  const interactive = () => props.interactive ?? true;
  const hover = useCityMapHover({
    slots,
    board: () => ({ width: width(), height: height() }),
    enabled: interactive,
  });
  const toggleDebug = (key: keyof CityMapDebugState) => {
    setDebugState((state) => ({ ...state, [key]: !state[key] }));
  };

  return (
    <section class="city-map-board" aria-label="City map board">
      <div class="city-map-board__surface" {...hover.bind}>
        <Show when={debugState().showMap}>
          <CityMapSvg
            city={city()}
            width={width()}
            height={height()}
            debug={{
              showLabels: debugState().showLabels,
              showBuildings: debugState().showBuildings,
              showRoads: debugState().showRoads,
              showSlots: false,
            }}
          />
        </Show>
        <RouteDemoLayer city={city()} active={debugState().showRouteDemo} width={width()} height={height()} />
        <svg
          class="city-map-board__slot-layer"
          viewBox={`0 0 ${width()} ${height()}`}
          preserveAspectRatio="none"
          aria-hidden={!interactive()}
        >
          <Show when={debugState().showSlots}>
            <CityMapSlots
              slots={slots()}
              venueById={city().venueById}
              hoveredSlotId={hover.hoveredSlotId()}
              selectedSlotId={selectedSlotId()}
              interactive={interactive()}
              onSlotFocus={(slot) => hover.setPointerPoint(slot)}
              onSlotBlur={hover.clearHover}
              onSlotClick={(slot) => setSelectedSlotId(slot.id)}
            />
          </Show>
        </svg>
        <VenueTooltip
          slot={hover.hoveredSlot()}
          venue={hover.hoveredSlot()?.venueId ? city().venueById[hover.hoveredSlot()!.venueId!] : null}
          board={{ width: width(), height: height() }}
        />
        <CityMapDebugDock state={debugState()} onToggle={toggleDebug} />
      </div>
    </section>
  );
};
