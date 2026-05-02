import { For, Show } from 'solid-js';
import type {
  BridgePlan,
  Building,
  BuildingPlan,
  CityDistrict,
  CityMap,
  CitySlot,
  Point,
  RoadEdge,
  TerrainPlan,
} from '@/services/playgame/city-map';
import './cityMapStyles.css';

export interface CityMapSvgProps {
  city: CityMap;
  width: number;
  height: number;
  hoveredDistrictId?: string | null;
  onDistrictHover?: (id: string | null) => void;
  debug?: {
    showLabels?: boolean;
    showBuildings?: boolean;
    showRoads?: boolean;
    showSlots?: boolean;
  };
}

type PathBacked = {
  path?: string;
};

type RenderBuilding = Building & PathBacked & {
  shade?: number;
  render?: {
    lodGroup?: 'lowrise' | 'midrise' | 'tower' | string;
  };
};

type RenderOpenSpace = PathBacked & {
  id: string;
  kind?: string;
  type?: string;
  role?: string;
  polygon?: Point[];
  centroid?: Point;
};

type RenderWaterBody = PathBacked & {
  id: string;
  kind?: string;
  outerWidth?: number;
  polygon?: Point[];
};

type RenderDock = PathBacked & {
  id?: string;
  polygon?: Point[];
};

type RenderRoadEdge = RoadEdge & PathBacked & {
  riverBank?: boolean;
};

type RenderBridge = NonNullable<BridgePlan['bridges']>[number] & PathBacked & {
  center?: Point;
  deckWidth?: number;
  x?: number;
  y?: number;
};

type RenderDistrict = CityDistrict & {
  bbox?: Rect;
  labelAnchor?: Point;
  ownershipPath?: string;
  boundarySegments?: Array<{ a: Point; b: Point }>;
  buildablePolygons?: Point[][];
};

type RenderBuildingPlan = BuildingPlan & {
  openSpaces?: RenderOpenSpace[];
};

type RenderTerrainPlan = TerrainPlan & {
  mainland?: PathBacked & { polygon?: Point[] };
  landmasses?: Array<PathBacked & { id: string; polygon?: Point[] }>;
  waterBodies?: RenderWaterBody[];
  openSpaces?: RenderOpenSpace[];
};

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const fmt = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '0.00';

function polygonToPath(points: readonly Point[] = []) {
  if (points.length === 0) return '';
  return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${fmt(point.x)} ${fmt(point.y)}`).join(' ')} Z`;
}

function polylineToPath(points: readonly Point[] = []) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${fmt(point.x)} ${fmt(point.y)}`).join(' ');
}

function edgeToPath(edge: RenderRoadEdge) {
  return edge.path || polylineToPath([edge.a, edge.b]);
}

function rectForPolygons(polygons: readonly Point[][]) {
  const points = polygons.flat();
  if (points.length === 0) return null;
  return points.reduce<Rect>((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

function centroid(points: readonly Point[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function districtAnchor(district: RenderDistrict) {
  if (district.labelAnchor) return district.labelAnchor;
  const polygons = district.ownershipPolygons?.length ? district.ownershipPolygons : district.polygons;
  const bounds = district.bbox || rectForPolygons(polygons);
  if (bounds) return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  return centroid(polygons.flat());
}

function districtLabel(district: RenderDistrict) {
  const text = district.name || district.id;
  const bounds = district.bbox || rectForPolygons(district.polygons);
  const maxLen = bounds && bounds.maxX - bounds.minX < 70 ? 4 : 9;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function districtHoverPolygons(district: RenderDistrict) {
  return district.ownershipPolygons?.length ? district.ownershipPolygons : district.polygons;
}

function majorDistrictBoundaryPath(district: RenderDistrict) {
  const segments = district.boundarySegments || [];
  return segments
    .filter((segment) => {
      const dx = Math.abs(segment.b.x - segment.a.x);
      const dy = Math.abs(segment.b.y - segment.a.y);
      const length = Math.hypot(dx, dy);
      const ratio = Math.max(dx, dy) / Math.max(0.01, Math.min(dx || 0.01, dy || 0.01));
      return length >= 7.5 && (dx < 0.01 || dy < 0.01 || ratio >= 2.35);
    })
    .map((segment) => `M ${fmt(segment.a.x)} ${fmt(segment.a.y)} L ${fmt(segment.b.x)} ${fmt(segment.b.y)}`)
    .join(' ');
}

function roadKind(edge: RenderRoadEdge) {
  if (edge.source === 'coast-road' || edge.id === 'mainland-coast-road') return 'coast';
  if (edge.kind === 'highway') return 'highway';
  if (edge.kind === 'avenue') return 'avenue';
  if (edge.kind === 'street') return 'street';
  if (edge.kind === 'local') return 'local';
  return 'main';
}

const roadLayerOrder: ReturnType<typeof roadKind>[] = ['river-bank', 'local', 'street', 'main', 'coast', 'avenue', 'highway'];

function orderedRoadEdges(edges: readonly RenderRoadEdge[]) {
  const rank = (edge: RenderRoadEdge) => {
    const kind = edge.riverBank ? 'river-bank' : roadKind(edge);
    const index = roadLayerOrder.indexOf(kind);
    return index >= 0 ? index : roadLayerOrder.indexOf('main');
  };
  return edges.slice().sort((a, b) => rank(a) - rank(b));
}

function buildingTone(building: RenderBuilding, index: number) {
  if (building.render?.lodGroup === 'tower') return 'tower';
  if ((building.shade ?? index % 2) < 0.5) return 'a';
  return 'b';
}

function buildingPath(building: RenderBuilding) {
  return building.path || polygonToPath(building.polygon || []);
}

function openSpacePath(space: RenderOpenSpace) {
  return space.path || polygonToPath(space.polygon || []);
}

function landPaths(city: CityMap) {
  const terrain = city.terrain as RenderTerrainPlan;
  const landmasses = terrain.landmasses || [];
  if (landmasses.length > 0) {
    return landmasses
      .map((landmass) => ({ id: landmass.id, path: landmass.path || polygonToPath(landmass.polygon || []) }))
      .filter((landmass) => landmass.path);
  }
  const landPolygon = terrain.visibleLandPolygon || terrain.landPolygon || terrain.mainland?.polygon;
  const path = terrain.mainland?.path || polygonToPath(landPolygon || []);
  return path ? [{ id: 'land', path }] : [];
}

function waterBodies(city: CityMap) {
  return ((city.terrain as RenderTerrainPlan).waterBodies || []).filter((body) => body.kind !== 'ocean');
}

function openSpaces(city: CityMap) {
  const buildingSpaces = ((city.buildingPlan as RenderBuildingPlan).openSpaces || []);
  const terrainSpaces = ((city.terrain as RenderTerrainPlan).openSpaces || []);
  const byId = new Map<string, RenderOpenSpace>();
  for (const space of [...buildingSpaces, ...terrainSpaces]) byId.set(space.id, space);
  return [...byId.values()].filter((space) => openSpacePath(space));
}

function allSlots(city: CityMap): CitySlot[] {
  return city.districts.flatMap((district) => district.slots?.length ? district.slots : district.dots || []);
}

export const CityMapSvg = (props: CityMapSvgProps) => {
  const showLabels = () => props.debug?.showLabels ?? true;
  const showBuildings = () => props.debug?.showBuildings ?? true;
  const showRoads = () => props.debug?.showRoads ?? true;
  const showSlots = () => props.debug?.showSlots ?? false;
  const viewWidth = () => props.city.width || props.width;
  const viewHeight = () => props.city.height || props.height;

  return (
    <svg
      class="city-map-svg"
      width={props.width}
      height={props.height}
      viewBox={`0 0 ${viewWidth()} ${viewHeight()}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Generated city map"
    >
      <rect class="city-map-svg__water" x="0" y="0" width={viewWidth()} height={viewHeight()} />
      <rect class="city-map-svg__shade" x="0" y="0" width={viewWidth()} height={viewHeight()} />

      <g class="city-map-svg__land-layer">
        <For each={landPaths(props.city)}>
          {(land) => (
            <g>
              <path class="city-map-svg__land" d={land.path} />
              <path class="city-map-svg__land-shade" d={land.path} />
              <path class="city-map-svg__coastline" d={land.path} />
            </g>
          )}
        </For>
      </g>

      <g class="city-map-svg__open-spaces">
        <For each={openSpaces(props.city)}>
          {(space) => (
            <path
              classList={{
                'city-map-svg__open-space': true,
                'city-map-svg__open-space--compound': space.kind === 'compound' || space.type === 'compound',
              }}
              d={openSpacePath(space)}
            />
          )}
        </For>
      </g>

      <g class="city-map-svg__coast-docks">
        <For each={(props.city.coastDocks || []) as RenderDock[]}>
          {(dock, index) => (
            <path
              class="city-map-svg__coast-dock"
              d={dock.path || polygonToPath(dock.polygon || [])}
              data-dock-index={index()}
            />
          )}
        </For>
      </g>

      <Show when={showBuildings()}>
        <g class="city-map-svg__buildings">
          <For each={(props.city.buildingPlan.buildings || []) as RenderBuilding[]}>
            {(building, index) => (
              <path
                class={`city-map-svg__building city-map-svg__building--${buildingTone(building, index())}`}
                d={buildingPath(building)}
              />
            )}
          </For>
          <For each={(props.city.buildingPlan.landmarks || []) as RenderBuilding[]}>
            {(building) => (
              <path class="city-map-svg__building city-map-svg__building--landmark" d={buildingPath(building)} />
            )}
          </For>
        </g>
      </Show>

      <Show when={showRoads()}>
        <g class="city-map-svg__roads">
          <For each={orderedRoadEdges(props.city.roadGraph.edges as RenderRoadEdge[])}>
            {(edge) => (
              <Show when={!edge.riverBank}>
                <path
                  class={`city-map-svg__road-underlay city-map-svg__road-underlay--${roadKind(edge)}`}
                  d={edgeToPath(edge)}
                />
              </Show>
            )}
          </For>
          <For each={orderedRoadEdges(props.city.roadGraph.edges as RenderRoadEdge[])}>
            {(edge) => (
              <path
                class={`city-map-svg__road city-map-svg__road--${edge.riverBank ? 'river-bank' : roadKind(edge)}`}
                d={edgeToPath(edge)}
              />
            )}
          </For>
        </g>
      </Show>

      <g class="city-map-svg__water-features">
        <For each={waterBodies(props.city)}>
          {(body) => (
            <path
              class="city-map-svg__river"
              d={body.path || polygonToPath(body.polygon || [])}
              style={{ 'stroke-width': `${(body.outerWidth || 7) + 2}px` }}
            />
          )}
        </For>
      </g>

      <g class="city-map-svg__bridges">
        <For each={(props.city.bridgePlan.bridges || []) as RenderBridge[]}>
          {(bridge) => (
            <Show when={bridge.path}>
              <g>
                <path
                  class="city-map-svg__bridge-underlay"
                  d={bridge.path}
                  style={{ 'stroke-width': `${(bridge.deckWidth || 1.8) + 1.6}px` }}
                />
                <path
                  class="city-map-svg__bridge"
                  d={bridge.path}
                  style={{ 'stroke-width': `${bridge.deckWidth || 1.8}px` }}
                />
              </g>
            </Show>
          )}
        </For>
      </g>

      <g class="city-map-svg__district-boundaries">
        <For each={props.city.districts as RenderDistrict[]}>
          {(district) => (
            <Show when={majorDistrictBoundaryPath(district)}>
              {(path) => <path class="city-map-svg__district-boundary" d={path()} />}
            </Show>
          )}
        </For>
      </g>

      <Show when={showSlots()}>
        <g class="city-map-svg__slots">
          <For each={allSlots(props.city)}>
            {(slot) => (
              <circle
                class={`city-map-svg__slot city-map-svg__slot--${slot.playableBy || 'neutral'}`}
                cx={slot.x}
                cy={slot.y}
                r="2.3"
              />
            )}
          </For>
        </g>
      </Show>

      <Show when={showLabels()}>
        <g class="city-map-svg__labels">
          <For each={props.city.districts as RenderDistrict[]}>
            {(district) => {
              const anchor = districtAnchor(district);
              const labelText = (district as any).label?.text || districtLabel(district);
              console.log(
                `[label-render] id=${district.id} name=${district.name} ` +
                `landmassId=${(district as any).landmassId} playable=${(district as any).playable} ` +
                `text=${labelText} at=(${anchor.x.toFixed(1)},${anchor.y.toFixed(1)})`,
              );
              return (
                <text class="city-map-svg__district-label" x={anchor.x} y={anchor.y} text-anchor="middle" dominant-baseline="middle">
                  {labelText}
                </text>
              );
            }}
          </For>
        </g>
      </Show>

      <Show when={props.hoveredDistrictId}>
        {(() => {
          console.log(`[hover-layer] rendering glow for id=${props.hoveredDistrictId}`);
          return null;
        })()}
        <g class="city-map-svg__hover-layer">
          <For each={(props.city.districts as RenderDistrict[]).filter((district) => district.id === props.hoveredDistrictId)}>
            {(district) => (
              <For each={districtHoverPolygons(district)}>
                {(polygon, index) => (
                  <path
                    class="city-map-svg__district-hover"
                    d={index() === 0 && district.ownershipPath ? district.ownershipPath : polygonToPath(polygon)}
                  />
                )}
              </For>
            )}
          </For>
        </g>
      </Show>

      <Show when={props.onDistrictHover}>
        <g
          class="city-map-svg__hit-layer"
          onMouseOver={(e) => {
            const id = (e.target as SVGElement).dataset.districtId ?? null;
            console.log(`[hover] mouseover id=${id} target=${(e.target as Element).tagName}.${(e.target as Element).getAttribute('class')}`);
            props.onDistrictHover!(id);
          }}
          onMouseLeave={() => {
            console.log('[hover] mouseleave');
            props.onDistrictHover!(null);
          }}
        >
          <For each={(props.city.districts as RenderDistrict[]).filter((d) => d.playable !== false)}>
            {(district) => (
              <For each={districtHoverPolygons(district)}>
                {(polygon) => (
                  <path
                    class="city-map-svg__district-hit"
                    d={polygonToPath(polygon)}
                    data-district-id={district.id}
                  />
                )}
              </For>
            )}
          </For>
        </g>
      </Show>
    </svg>
  );
};
