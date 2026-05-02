import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { findPathBetweenCoords, routeToSvgPath, type CityMap, type Point } from '@/services/playgame/city-map';
import type { CityMapViewport } from './camera';

interface RouteDemoLayerProps {
  city: CityMap;
  active: boolean;
  width: number;
  height: number;
  viewport?: CityMapViewport;
}

interface RouteDemo {
  pathD: string;
  from: Point;
  to: Point;
}

function pickRoute(city: CityMap, step: number): RouteDemo | null {
  // 1. Gather all playable slots
  const allSlots = city.districts.flatMap(d => d.slots || []).map(s => ({
    x: s.x, y: s.y, type: 'slot'
  }));

  // 2. Gather actual named landmarks (stadiums, parks, major buildings)
  const allLandmarks = (city.landmarks || []).map(v => ({
    x: v.centroid.x, y: v.centroid.y, type: 'landmark'
  }));

  // 3. Combine them
  const pool = [...allSlots, ...allLandmarks];
  if (pool.length < 2) return null;

  // 4. Pick two random points
  const pt1 = pool[(step * 7) % pool.length];
  const pt2 = pool[(step * 13 + 1) % pool.length];

  if (pt1 === pt2) return null;

  const route = findPathBetweenCoords(city, pt1.x, pt1.y, pt2.x, pt2.y);
  if (!route || route.waypoints.length < 2) return null;

  return {
    pathD: routeToSvgPath(route.waypoints),
    from: route.waypoints[0],
    to: route.waypoints[route.waypoints.length - 1],
  };
}

export const RouteDemoLayer = (props: RouteDemoLayerProps) => {
  const [route, setRoute] = createSignal<RouteDemo | null>(null);
  const viewport = () => props.viewport || { x: 0, y: 0, width: props.width, height: props.height };

  createEffect(() => {
    if (!props.active) {
      setRoute(null);
      return;
    }

    let step = 0;
    const update = () => {
      setRoute(pickRoute(props.city, step));
      step += 1;
    };
    update();
    const timerId = window.setInterval(update, 2800);
    onCleanup(() => window.clearInterval(timerId));
  });

  return (
    <Show when={props.active && route()}>
      {(activeRoute) => (
        <svg
          class="city-map-route-demo"
          viewBox={`${viewport().x} ${viewport().y} ${viewport().width} ${viewport().height}`}
          preserveAspectRatio="none"
          aria-label="Route demo"
        >
          <path class="city-map-route-demo__glow" d={activeRoute().pathD} />
          <path class="city-map-route-demo__path" d={activeRoute().pathD} />
          <circle class="city-map-route-demo__endpoint" cx={activeRoute().from.x} cy={activeRoute().from.y} r="3.2" />
          <circle class="city-map-route-demo__endpoint" cx={activeRoute().to.x} cy={activeRoute().to.y} r="3.2" />
        </svg>
      )}
    </Show>
  );
};
