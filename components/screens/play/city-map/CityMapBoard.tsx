import { Show, createMemo, createSignal, untrack } from 'solid-js';
import { buildCityMap, type CityMap } from '@/services/playgame/city-map';
import { CityMapSvg } from './CityMapSvg';
import { CityMapLandmarks } from './CityMapLandmarks';
import { CityMapSlots } from './CityMapSlots';
import { LandmarkTooltip } from './LandmarkTooltip';
import { useCityMapLandmarkHover } from './useCityMapHover';
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
    showLandmarks?: boolean;
    showSlots?: boolean;
  };
}

export const CityMapBoard = (props: CityMapBoardProps) => {
  const [selectedSlotId, setSelectedSlotId] = createSignal<string | null>(null);
  const initialDebug = untrack(() => props.debug);
  const [debugState, setDebugState] = createSignal<CityMapDebugState>({
    showMap: true,
    showBuildings: initialDebug?.showBuildings ?? true,
    showRoads: initialDebug?.showRoads ?? true,
    showLabels: initialDebug?.showLabels ?? true,
    showLandmarks: initialDebug?.showLandmarks ?? true,
    showSlots: initialDebug?.showSlots ?? true,
    showRouteDemo: false,
  });
  const city = createMemo(() => props.city || buildCityMap(props.seed ?? 'new-game-city'));
  const width = () => props.width || city().width;
  const height = () => props.height || city().height;
  const slots = createMemo(() => city().districts.flatMap((district) => district.slots || []));
  const landmarks = createMemo(() => city().landmarks || city().districts.flatMap((district) => district.landmarks || []));
  const interactive = () => props.interactive ?? true;
  const hover = useCityMapLandmarkHover({
    landmarks,
    board: () => ({ width: width(), height: height() }),
    enabled: () => interactive() && debugState().showLandmarks && (props.showVenueTooltips ?? true),
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
          <Show when={debugState().showLandmarks}>
            <CityMapLandmarks landmarks={landmarks()} hoveredLandmarkId={hover.hoveredLandmarkId()} />
          </Show>
          <Show when={debugState().showSlots}>
            <CityMapSlots
              slots={slots()}
              selectedSlotId={selectedSlotId()}
              interactive={interactive()}
              onSlotClick={(slot) => setSelectedSlotId(slot.id)}
            />
          </Show>
        </svg>
        <LandmarkTooltip
          landmark={hover.hoveredLandmark()}
          board={{ width: width(), height: height() }}
        />
        <CityMapDebugDock state={debugState()} onToggle={toggleDebug} />
      </div>
    </section>
  );
};
