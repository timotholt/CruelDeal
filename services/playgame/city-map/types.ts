import type { ParcelShapeClassification } from './parcel-shapes';
import type { BlockFrontageAnalysis, BuildingBlockProfile } from './planning';

export interface Point {
  x: number;
  y: number;
}

export type BuildingLodGroup = 'micro' | 'lowrise' | 'midrise' | 'tower' | 'landmark';
export type BuildingMaterialKey = 'lowrise' | 'midrise' | 'tower' | 'landmark' | 'industrial';
export type BuildingRoofStyle = 'flat' | 'antenna' | 'tiered' | 'mechanical';
export type RoadRenderMaterialKey = 'local' | 'street' | 'avenue' | 'highway' | 'bridge' | 'route';
export type RoadRenderLodGroup = 'major' | 'minor' | 'micro';
export type TerrainMaterialKey = 'land' | 'water' | 'park' | 'plaza' | 'industrial';
export type PhysicalRoadClass = 'highway' | 'arterial' | 'avenue' | 'street' | 'local' | 'alley' | 'service';
export type RoadStyleId = 'tight_grid' | 'loose_grid' | 'curvy_residential' | 'industrial_spine' | 'coastal_curve' | 'old_core';

export interface BuildingRenderMeta {
  extrudable: boolean;
  staticMesh: boolean;
  height: number;
  baseElevation: number;
  roofStyle: BuildingRoofStyle;
  materialKey: BuildingMaterialKey;
  emissiveStrength: number;
  windowDensity: number;
  shadowImportance: number;
  lodGroup: BuildingLodGroup;
}

export interface RoadRenderMeta {
  width: number;
  elevation: number;
  glowStrength: number;
  materialKey: RoadRenderMaterialKey;
  lodGroup: RoadRenderLodGroup;
}

export interface TerrainRenderMeta {
  elevation: number;
  materialKey: TerrainMaterialKey;
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
  centerline?: Point[];
  roadClass?: PhysicalRoadClass;
  physicalWidth?: number;
  corridorPolygon?: Point[];
  source?: string;
  kind?: string;
  districtId?: string | null;
  pm2001?: {
    generator: 'global-goal' | 'local-constraint' | 'connector' | 'coast' | 'fallback';
    styleId: RoadStyleId;
    hierarchyDepth: number;
  };
  render?: RoadRenderMeta;
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

export type ParcelGenerationKind =
  | 'frontage-strip'
  | 'corner-frontage'
  | 'multi-frontage'
  | 'interior-obb'
  | 'patio'
  | 'whole-block'
  | 'merge-recovery';

export interface CityParcel {
  id: string;
  blockId: string;
  districtId?: string | null;
  polygon: Point[];
  centroid?: Point;
  buildable?: boolean;
  kind?: 'lot' | 'park' | 'plaza' | 'service' | 'patio';
  frontageAnalysis?: BlockFrontageAnalysis;
  shape?: ParcelShapeClassification;
  planning?: BuildingBlockProfile;
  area?: number;
  fieldAngle?: number;
  generationKind?: ParcelGenerationKind;
  frontageRoadIds?: string[];
  frontageSideCount?: number;
  frontageDepth?: number;
  frontageWidth?: number;
  parentBlockArea?: number;
  parcelCoverageRole?: 'buildable' | 'frontage' | 'interior' | 'open-space' | 'service' | 'recovery';
  [key: string]: unknown;
}

export interface TerrainPlan {
  landPolygon?: PolygonPoint[];
  visibleLandPolygon?: PolygonPoint[];
  waterBodies?: WaterBody[];
  rivers?: RiverPath[];
  openSpaces?: OpenSpace[];
  render?: TerrainRenderMeta;
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
  render?: TerrainRenderMeta;
  [key: string]: unknown;
}

export interface OpenSpace {
  id: string;
  polygon: Point[];
  centroid?: Point;
  type?: string;
  render?: TerrainRenderMeta;
  [key: string]: unknown;
}

export interface BuildingPlan {
  parcels?: CityParcel[];
  buildings?: Building[];
  landmarks?: Building[];
  [key: string]: unknown;
}

export interface Building {
  id: string;
  blockId?: string | null;
  parcelId?: string | null;
  districtId?: string | null;
  polygon?: Point[];
  centroid?: Point;
  render?: BuildingRenderMeta;
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
  render?: RoadRenderMeta;
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
  slotRole?: 'card-slot' | 'street' | string;
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

export type DistrictLandmarkTiming = 'on-reveal' | 'ongoing' | 'end-of-turn';

export interface DistrictLandmark {
  id: string;
  districtId: string;
  districtIdx?: number | null;
  sourceVenueId?: string | null;
  source: 'building' | 'openSpace' | 'waterBody' | 'bridge' | 'manifest';
  sourceId: string;
  type: string;
  typeLabel: string;
  iconKey: string;
  name: string;
  accentColor: string;
  timing: DistrictLandmarkTiming;
  effectPlaceholder: string;
  centroid: Point;
  blockId?: string | null;
  buildingId?: string | null;
  openSpaceId?: string | null;
  waterBodyId?: string | null;
  bridgeId?: string | null;
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
  playable?: boolean;
  ownershipPolygons: Point[][];
  polygons: Point[][];
  blocks: CityBlock[];
  roads: RoadEdge[];
  slots: CitySlot[];
  dots: CitySlot[];
  landmarks?: DistrictLandmark[];
  landmarkPoints?: Array<{ x: number; y: number }>;
  maxLandmarks?: number;
  targetSlotCount?: number;
  labelAnchor?: { x: number; y: number };
}

export interface CityMap {
  version: 'v35';
  seed: number | string;
  width: number;
  height: number;
  terrain: TerrainPlan;
  roadGraph: RoadGraph;
  districts: CityDistrict[];
  blocks?: CityBlock[];
  cells?: CityBlock[];
  parcels?: CityParcel[];
  buildingPlan: BuildingPlan;
  bridgePlan: BridgePlan;
  coastDocks: DockPlan[];
  composition?: {
    macroLayoutTemplate?: string;
  };
  landmarks?: DistrictLandmark[];
  landmarkById?: Readonly<Record<string, DistrictLandmark>>;
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
