import { createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { findPath, routeToSvgPath, type Building, type CityMap, type Point } from '@/services/playgame/city-map';

interface RouteDemoLayerProps {
  city: CityMap;
  active: boolean;
  width: number;
  height: number;
}

interface RouteDemo {
  pathD: string;
  from: Point;
  to: Point;
}

function onMap(point: Point | null | undefined, width: number, height: number) {
  const margin = 20;
  return !!point && point.x >= margin && point.x <= width - margin && point.y >= margin && point.y <= height - margin;
}

function districtForBuilding(city: CityMap, building: Building) {
  const looseCity = city as CityMap & { cellDistrict?: Record<string, string> };
  return building.districtId || (building.cellId ? looseCity.cellDistrict?.[building.cellId] : null) || null;
}

function routeCandidates(city: CityMap, width: number, height: number) {
  const byDistrict = new Map<string, Building[]>();
  for (const building of city.buildingPlan.buildings || []) {
    if (!building.snapEdgeId || !building.snapPoint || !building.centroid) continue;
    if (!onMap(building.centroid, width, height) || !onMap(building.snapPoint, width, height)) continue;
    const districtId = districtForBuilding(city, building);
    if (!districtId) continue;
    const bucket = byDistrict.get(districtId) || [];
    bucket.push(building);
    byDistrict.set(districtId, bucket);
  }
  return [...byDistrict.values()].filter((bucket) => bucket.length > 0);
}

function pickRoute(city: CityMap, width: number, height: number, step: number): RouteDemo | null {
  const buckets = routeCandidates(city, width, height);
  if (buckets.length < 2) return null;
  for (let attempt = 0; attempt < 18; attempt++) {
    const aBucket = buckets[(step + attempt) % buckets.length];
    const bBucket = buckets[(step + attempt + 1 + (attempt % Math.max(1, buckets.length - 1))) % buckets.length];
    if (aBucket === bBucket) continue;
    const a = aBucket[(step * 3 + attempt) % aBucket.length];
    const b = bBucket[(step * 5 + attempt) % bBucket.length];
    const route = findPath(city, a.id, b.id);
    if (!route || route.waypoints.length < 2) continue;
    return {
      pathD: routeToSvgPath(route.waypoints),
      from: route.waypoints[0],
      to: route.waypoints[route.waypoints.length - 1],
    };
  }
  return null;
}

export const RouteDemoLayer = (props: RouteDemoLayerProps) => {
  const [route, setRoute] = createSignal<RouteDemo | null>(null);

  createEffect(() => {
    if (!props.active) {
      setRoute(null);
      return;
    }

    let step = 0;
    const update = () => {
      setRoute(pickRoute(props.city, props.width, props.height, step));
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
          viewBox={`0 0 ${props.width} ${props.height}`}
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
