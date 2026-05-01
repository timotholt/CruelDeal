export interface Point {
  x: number;
  y: number;
}

export type PolygonPoint = Point & {
  edgeKind?: string;
  _clipNew?: boolean;
};

export interface Segment<TPoint extends Point = Point> {
  a: TPoint;
  b: TPoint;
}

export interface RectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BoundingBox extends RectBounds {
  w: number;
  h: number;
}

export interface SegmentIntersection extends Point {
  t: number;
  u: number;
}

export interface PolylabelCell extends Point {
  h: number;
  d: number;
  max: number;
}

export interface PolylabelResult extends Point {
  d: number;
}

export interface RoadNode extends Point {
  id: string;
  districtId?: string | null;
  [key: string]: unknown;
}

export interface RoadEdge {
  id: string;
  a: Point;
  b: Point;
  source?: string;
  kind?: string;
  districtId?: string | null;
  [key: string]: unknown;
}

export interface RoadGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
  [key: string]: unknown;
}

export interface CityBlock {
  id: string;
  districtId?: string | null;
  polygon: Point[];
  centroid?: Point;
  [key: string]: unknown;
}

export interface TerrainPlan {
  landPolygon?: PolygonPoint[];
  visibleLandPolygon?: PolygonPoint[];
  waterBodies?: WaterBody[];
  rivers?: RiverPath[];
  openSpaces?: OpenSpace[];
  [key: string]: unknown;
}

export interface RiverPath {
  id?: string;
  points?: Point[];
  segments?: Segment[];
  [key: string]: unknown;
}

export interface WaterBody {
  id: string;
  polygon?: Point[];
  centroid?: Point;
  [key: string]: unknown;
}

export interface OpenSpace {
  id: string;
  polygon: Point[];
  centroid?: Point;
  type?: string;
  [key: string]: unknown;
}

export interface BuildingPlan {
  buildings?: Building[];
  landmarks?: Building[];
  [key: string]: unknown;
}

export interface Building {
  id: string;
  blockId?: string | null;
  districtId?: string | null;
  polygon?: Point[];
  centroid?: Point;
  [key: string]: unknown;
}

export interface BridgePlan {
  bridges?: Bridge[];
  [key: string]: unknown;
}

export interface Bridge {
  id: string;
  districtId?: string | null;
  centroid?: Point;
  [key: string]: unknown;
}

export interface DockPlan {
  id?: string;
  districtId?: string | null;
  centroid?: Point;
  [key: string]: unknown;
}

export interface CitySlot {
  id: string;
  districtId: string;
  slotIndex: number;
  playableBy?: 'P0' | 'P1' | 'both' | null;
  slotRole?: 'shop' | 'hideout' | 'landmark' | 'bridge' | 'street' | 'utility' | string;
  ownerSeat?: 'P0' | 'P1';
  blockId?: string | null;
  venueId?: string | null;
  buildingId?: string | null;
  x: number;
  y: number;
  snapEdgeId?: string | null;
  snapPoint?: Point | null;
  snapT?: number | null;
}

export interface Venue {
  id: string;
  source: 'building' | 'openSpace' | 'waterBody' | 'bridge' | 'manifest';
  sourceId: string;
  type: string;
  tier: 'iconic' | 'major' | 'minor';
  name: string;
  typeLabel: string;
  iconKey: string;
  accentColor: string;
  bonus: { text: string };
  districtId: string | null;
  blockId: string | null;
  buildingId?: string | null;
  openSpaceId?: string | null;
  waterBodyId?: string | null;
  bridgeId?: string | null;
  centroid: Point;
  snapEdgeId?: string | null;
  snapPoint?: Point | null;
  snapT?: number | null;
}

export interface CityDistrict {
  id: string;
  idx: number;
  name: string;
  color: string;
  ownershipPolygons: Point[][];
  polygons: Point[][];
  blocks: CityBlock[];
  roads: RoadEdge[];
  slots: CitySlot[];
  dots: CitySlot[];
}

export interface CityMap {
  version: 'v35';
  seed: number | string;
  width: number;
  height: number;
  terrain: TerrainPlan;
  roadGraph: RoadGraph;
  districts: CityDistrict[];
  buildingPlan: BuildingPlan;
  bridgePlan: BridgePlan;
  coastDocks: DockPlan[];
  venues: Venue[];
  venueById: Readonly<Record<string, Venue>>;
}

export interface CutPath {
  p1: Point;
  p2: Point;
  polyline?: Point[];
  polylineMode?: 'jog' | 'smooth' | string;
}

export interface MicroLandmarkShape {
  unitSize: number;
  points: Point[];
}
