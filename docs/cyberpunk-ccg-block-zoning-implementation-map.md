# Cyberpunk CCG Block Zoning Implementation Map

This document maps the zoning/subdivision design spec to concrete files, functions, data contracts, parameters, and return values.

Source spec:

- [cyberpunk-ccg-block-zoning-subdivision-spec.md](/Users/timotholt/Projects/CruelDeal/docs/cyberpunk-ccg-block-zoning-subdivision-spec.md)

## Goal

The generator should treat city blocks as planned real estate, not as random rectangles sprinkled inside polygons.

The core implementation idea is:

```txt
road hierarchy -> frontage value -> block profile -> subdivision flavor -> footprints -> debug metrics
```

The current implementation already has partial hooks for road hierarchy, block profiles, planning debug, and commercial-new frontage-first placement. The missing piece is making frontage analysis and subdivision contracts explicit instead of implicit inside `generateBlockBuildings`.

## Current Files

### `services/playgame/city-map/types.ts`

Defines shared map data structures.

Important existing contracts:

```ts
export interface Point {
  x: number;
  y: number;
}

export interface RoadEdge {
  id: string;
  a: Point;
  b: Point;
  source?: string;
  kind?: string;
  districtId?: string | null;
  render?: RoadRenderMeta;
  [key: string]: unknown;
}

export interface CityBlock {
  id: string;
  districtId?: string | null;
  polygon: Point[];
  centroid?: Point;
  [key: string]: unknown;
}

export interface Building {
  id: string;
  blockId?: string | null;
  districtId?: string | null;
  polygon?: Point[];
  centroid?: Point;
  render?: BuildingRenderMeta;
  [key: string]: unknown;
}
```

Needed additions:

```ts
export type BlockUseTag =
  | 'commercial'
  | 'residential'
  | 'public'
  | 'retail'
  | 'mixed_use'
  | 'industrial_service'
  | 'park_civic'
  | 'landmark';

export type BlockAgeTag = 'old' | 'average' | 'new';

export type SubdivisionFlavor =
  | 'iconic-edge-structure'
  | 'frontage-strip-subdivision'
  | 'skinny-tenant-frontage'
  | 'rectangular-backbone'
  | 'courtyard-park-insert'
  | 'hodgepodge-accretion';
```

Return-value role:

- `CityBlock.planning` should carry the chosen zoning/age/frontage/debug contract.
- `Building.polygon` remains the renderer-neutral footprint contract used by both SVG and Three.

### `services/playgame/city-map/city-v35.ts`

Owns city assembly, district/block creation, road conversion, road hazard extraction, block profile assignment, and static building generation.

Important existing functions:

#### `roadRenderForKind(kind?: string, source?: string): RoadRenderMeta`

Purpose:

- Converts road kind/source into rendering width, material, glow, and LOD group.
- This already implies road hierarchy visually.

Parameters:

- `kind?: string`: usually `highway`, `avenue`, `street`, `local`.
- `source?: string`: examples include `coast-road`, `route`, `bridge`.

Returns:

```ts
RoadRenderMeta
```

Used by spec concepts:

- road class
- road value weight
- highway/major/minor distinction

Needed tweak:

- Keep render width separate from economic value. Road value should come from a dedicated value function, not from visual width alone.

#### `roadHazardPriority(edge: RoadEdge): number`

Purpose:

- Current road-value approximation.

Parameters:

- `edge: RoadEdge`

Returns:

```ts
number // current range: 1..4
```

Current mapping:

```txt
highway -> 4
avenue/coast-road -> 3
street -> 2
other -> 1
```

Spec mapping should become:

```txt
HIGHWAY -> 10
MAJOR_ROAD -> 6
MINOR_ROAD -> 3
ALLEY/SERVICE -> 1
```

Recommended replacement:

```ts
function roadValueWeight(edge: RoadEdge): number
```

Return value:

```ts
10 | 6 | 3 | 1
```

#### `roadHazardBuffer(edge: RoadEdge): number`

Purpose:

- Defines no-building road clearance around road geometry.

Parameters:

- `edge: RoadEdge`

Returns:

```ts
number // world-space setback exclusion buffer
```

Spec concepts:

- road setback
- building-road collision prevention
- commercial frontage constant must be layered on top of this, not confused with it

#### `makeRoadHazards(edges: RoadEdge[]): RoadHazard[]`

Purpose:

- Converts road edges/polylines into segment-level hazards.
- The current commercial-new algorithm uses these hazards as frontage candidates.

Parameters:

- `edges: RoadEdge[]`

Returns:

```ts
Array<{
  a: Point;
  b: Point;
  buffer: number;
  priority?: number;
  width?: number;
}>
```

Spec concepts:

- bordering road edges
- road class
- road direction/bearing
- road width/clearance

Needed additions:

- Include original `roadId`, `roadClass`, and `roadValueWeight`.
- Distinguish "all nearby roads" from "roads actually bordering this block."

Recommended contract:

```ts
interface RoadHazard {
  roadId: string;
  a: Point;
  b: Point;
  buffer: number;
  priority: number;
  valueWeight: number;
  width: number;
  kind?: string;
  source?: string;
}
```

#### `blockRoadModernity(block, roadHazards): { score: number; priority: number }`

Purpose:

- Computes current "near important roads means more modern" score.

Parameters:

- `block: CityBlock & Record<string, any>`
- `roadHazards: RoadHazard[]`

Returns:

```ts
{
  score: number;
  priority: number;
}
```

Spec concepts:

- blocks adjacent to bigger roads are more modern
- blocks farther from big roads are older
- highway frontage biases commercial/new

Needed tweak:

- This should use explicit frontage analysis where possible, not centroid distance only.

#### `chooseBlockProfile(block, roadHazards, rng): BuildingBlockProfile`

Purpose:

- Assigns `age`, `use`, `modernityScore`, and `roadPriority`.
- Attaches `block.planning = profile`.

Parameters:

- `block: CityBlock & Record<string, any>`
- `roadHazards: RoadHazard[]`
- `rng: () => number`

Returns:

```ts
BuildingBlockProfile
```

Current return fields:

```ts
{
  age: 'old' | 'average' | 'new';
  use: 'commercial' | 'residential' | 'public';
  modernityScore?: number;
  roadPriority?: number;
}
```

Spec concepts:

- assign zone
- assign age
- commercial/residential/public split
- highway/major/minor bias

Needed return fields:

```ts
{
  age: BlockAgeTag;
  use: BlockUseTag;
  subdivisionFlavor: SubdivisionFlavor;
  frontageGroup: FrontageGroup | null;
  frontageDivisionCount: number | null;
  frontageSetback: number | null;
  modernityScore: number;
  roadPriority: number;
}
```

#### `buildStaticBuildings(cells, rng, terrain, roadHazards)`

Purpose:

- Iterates buildable blocks, assigns block planning profile, calls building generator, and creates `Building[]`.

Parameters:

- `cells: Array<CityBlock & Record<string, any>>`
- `rng: () => number`
- `terrain: TerrainV35`
- `roadHazards: RoadHazard[]`

Returns:

```ts
{
  buildings: Building[];
  openSpaces: Array<Record<string, any>>;
  landmarks: Building[];
  staticScene: {
    shadowAzimuth: number;
    shadowElevation: number;
    cacheable: boolean;
  };
}
```

Spec concepts:

- output building footprints
- output parks/courtyards/plazas through `openSpaces`
- landmarks override normal block logic

Needed tweak:

- Preserve lot polygons/service paths/debug metrics from `generateBlockBuildings`, not only building footprints.

## Building Generator File

### `services/playgame/city-map/buildings.ts`

Owns procedural building footprint generation inside a block.

Important existing contracts:

```ts
export type BlockAgeTag = 'old' | 'average' | 'new';
export type BlockUseTag = 'commercial' | 'residential' | 'public';

export interface BuildingBlockProfile {
  age: BlockAgeTag;
  use: BlockUseTag;
  modernityScore?: number;
  roadPriority?: number;
  layoutStrategy?: string;
  gridCols?: number;
  gridRows?: number;
  envelopeArea?: number;
  envelopeCoverage?: number;
  placedCount?: number;
  frontageSetback?: number;
  bypassedRoadShrink?: boolean;
  layoutFailure?: string;
}

export interface GeneratedBuildingFootprint {
  path: string;
  polygon: Point[];
  area: number;
  shade: number;
  round?: boolean;
  cx?: number;
  cy?: number;
  radius?: number;
  ringRadius?: number;
  edgeMidpoints?: Point[];
  fallback?: boolean;
}
```

#### `generateBlockBuildings(blockPolygon, gridAngle, rng, riverSegments, roadHazards, riverBuffer, profile)`

Purpose:

- Main block-to-footprints generator.

Parameters:

```ts
blockPolygon: Point[]
gridAngle: number
rng: () => number
riverSegments?: Array<{ a: Point; b: Point }> | null
roadHazards?: RoadHazard[] | null
riverBuffer = 7
profile: BuildingBlockProfile = { age: 'average', use: 'residential' }
```

Returns:

```ts
GeneratedBuildingFootprint[]
```

Spec concepts:

- place frontage buildings
- fill rear/interior
- commercial/residential/public variation
- road setback collision handling
- debug metrics via mutated `profile`

Needed contract upgrade:

```ts
interface GenerateBlockBuildingsInput {
  block: CityBlock;
  blockPolygon: Point[];
  gridAngle: number;
  rng: Rng;
  riverSegments?: Segment[];
  roadHazards: RoadHazard[];
  frontageAnalysis: BlockFrontageAnalysis;
  profile: BuildingBlockProfile;
}

interface GeneratedBlockLayout {
  buildings: GeneratedBuildingFootprint[];
  lots: LotPolygon[];
  servicePaths: ServicePath[];
  openSpaces: PlannedOpenSpace[];
  metrics: BlockPlanningMetrics;
}
```

Recommended return value:

```ts
GeneratedBlockLayout
```

The existing `GeneratedBuildingFootprint[]` can be preserved temporarily by returning `layout.buildings`.

#### `COMMERCIAL_FRONTAGE_SETBACK`

Purpose:

- Current global commercial setback constant.

Current value:

```ts
const COMMERCIAL_FRONTAGE_SETBACK = 0.22;
```

Spec concepts:

- commercial blocks use the same distance from road to building face across the city
- commercial new/average/old mostly share the same frontage setback
- old commercial can allow small variation only if needed

Needed tweak:

- Export or centralize this constant so debug/UI/tests can reference it.

Recommended contract:

```ts
export const GLOBAL_COMMERCIAL_SETBACK = 0.22;
```

#### `fillCommercialNewGrid()`

Purpose:

- Current commercial-new special path.
- Uses priority-sorted road hazards, clips frontage strips, places parallel clipped polygons, then fills interior.

Parameters:

- none directly; closes over `blockPolygon`, `profile`, `relevantRoadHazards`, `buildings`, `rng`.

Returns:

```ts
void
```

Side effects:

- pushes generated footprints into `buildings`
- mutates `profile.layoutStrategy`
- mutates `profile.frontageSetback`
- mutates `profile.envelopeArea`
- mutates `profile.envelopeCoverage`
- mutates `profile.placedCount`
- mutates `profile.layoutFailure`

Spec concepts:

- commercial new
- expensive planned development
- high land utilization
- consistent setback
- large clean shapes
- irregular/trapezoid footprints on odd plots

Needed refactor:

- Make this a pure-ish named function with explicit inputs and outputs.

Recommended function:

```ts
function generateCommercialNewLayout(input: CommercialLayoutInput): GeneratedBlockLayout
```

Parameters:

```ts
interface CommercialLayoutInput {
  blockPolygon: Point[];
  frontageGroup: FrontageGroup;
  allFrontageGroups: FrontageGroup[];
  roadHazards: RoadHazard[];
  rng: Rng;
  commercialSetback: number;
  divisionCount: 1 | 2 | 3;
}
```

Returns:

```ts
GeneratedBlockLayout
```

#### `pushRoadFrontageFootprint(hazard, t, frontage, depth, setbackOverride?)`

Purpose:

- Places a rectangular building parallel to one road segment.

Parameters:

- `hazard: RoadHazard`
- `t: number`: 0..1 position along road segment
- `frontage: number`: building width along road
- `depth: number`: building depth inward from road
- `setbackOverride?: number`

Returns:

```ts
boolean // true if accepted, false if clipped/rejected/colliding
```

Spec concepts:

- building face parallel to expensive frontage
- frontage-first placement
- building depth

Limit:

- Rectangles only. This is not enough for commercial-new odd plots or curved frontage groups.

Recommended replacement:

```ts
function buildFrontageParcelFootprint(parcel: FrontageParcel, constraints: ParcelConstraints): Point[] | null
```

Return:

```ts
Point[] | null
```

#### `pushUvCorners(uvCorners, options?)`

Purpose:

- Validates and commits a footprint from local UV coordinates.
- Handles overlap, point-in-block, river buffer, and optional road shrink/rejection.

Parameters:

```ts
uvCorners: Array<{ u: number; v: number }>
options?: { ignoreRoadShrink?: boolean }
```

Returns:

```ts
boolean
```

Spec concepts:

- cleanup impossible pads
- avoid river overlap
- avoid road overlap

Needed metric additions:

- Count rejections by reason: overlap, outside block, river, road, sliver.

#### `clipPolygonByRoadSetback(subject, hazard, setback)`

Purpose:

- Clips a polygon inward from a road by a setback distance.

Parameters:

- `subject: Point[]`
- `hazard: RoadHazard`
- `setback: number`

Returns:

```ts
Point[]
```

Spec concepts:

- same commercial setback on every road-facing side
- multi-frontage blocks
- clipped/odd-shaped building envelopes

Current state:

- Present but not central enough.

Needed use:

- Commercial-new/average/old should build parcel envelopes by repeatedly applying road setback clips to road-facing sides.

## Geometry Helpers

### `services/playgame/city-map/geometry.ts`

Important existing functions:

#### `pointInPolygon(p, polygon): boolean`

Used for:

- footprint containment
- block hit testing

#### `polygonArea(polygon): number`

Used for:

- block area
- building area
- utilization metrics

#### `polygonCentroid(polygon): Point`

Used for:

- block center
- footprint center
- inward normal selection

#### `pointToSegmentDist(px, py, a, b): number`

Used for:

- road proximity
- river proximity
- modernity score

#### `clipPolygonToRect(polygon, rect): PolygonPoint[]`

Used for:

- current commercial-new grid clipping
- can produce trapezoids/wedges from rect-grid cells clipped against an irregular block

Needed geometry additions:

```ts
function clipPolygonByHalfPlane(subject: Point[], linePoint: Point, normal: Point): Point[]
function offsetSegmentTowardPolygon(segment: Segment, polygon: Point[], distance: number): Segment
function connectedFrontageGroups(edges: FrontageEdge[], angleTolerance: number, gapTolerance: number): FrontageGroup[]
function polygonCoverage(numerator: Point[][], denominator: Point[]): number
```

## Debug UI Files

### `components/screens/play/city-map/CityMapDebugDock.tsx`

Current behavior:

- Reuses `showComposition` as the visible `Planning` toggle.

Relevant contract:

```ts
{ key: 'showComposition', label: 'Planning' }
```

Spec concepts:

- debug toggle for planning data

Needed tweak:

- Rename debug state from `showComposition` to `showPlanning` when safe.

### `components/screens/play/city-map/CityMapBoard.tsx`

Current behavior:

- Tracks hovered block.
- Displays planning tooltip when Planning debug toggle is on.

Current tooltip fields:

- `planning.use`
- `planning.age`
- block id
- area
- `planning.roadPriority`
- `planning.modernityScore`
- `planning.layoutStrategy`
- `planning.placedCount`
- `planning.envelopeCoverage`
- `planning.frontageSetback`
- `planning.bypassedRoadShrink`
- `planning.layoutFailure`

Spec concepts:

- debug metrics
- zone
- age
- chosen subdivision flavor
- frontage score
- generated building count
- buildable area utilization
- fallback reason

Needed tooltip fields:

- `frontageGroup.roadIds`
- `frontageGroup.roadClass`
- `frontageGroup.score`
- `frontageDivisionCount`
- `highValueFrontageUtilization`
- `rejectedParcelCount`
- `sliverCleanupCount`

### `components/screens/play/city-map/cityMapStyles.css`

Current behavior:

- Styles `.city-map-planning-tooltip`.

Needed behavior:

- No major change; extend only if extra rows need tighter formatting.

## New Required Contracts

These contracts make the spec directly implementable.

### `RoadValue`

File:

- `services/playgame/city-map/city-v35.ts` initially
- move to `services/playgame/city-map/planning.ts` if it grows

Contract:

```ts
type RoadClass = 'HIGHWAY' | 'MAJOR_ROAD' | 'MINOR_ROAD' | 'ALLEY' | 'SERVICE';

interface RoadValue {
  roadId: string;
  roadClass: RoadClass;
  weight: number;
  renderWidth: number;
  kind?: string;
  source?: string;
}
```

Function:

```ts
function roadValueForEdge(edge: RoadEdge): RoadValue
```

Parameters:

- `edge: RoadEdge`

Returns:

- `RoadValue`

Spec lines satisfied:

- road class
- road value weight
- highway/major/minor/alley hierarchy
- no beachfront special case

### `FrontageEdge`

File:

- recommended: `services/playgame/city-map/planning.ts`

Contract:

```ts
interface FrontageEdge {
  id: string;
  roadId: string;
  roadClass: RoadClass;
  valueWeight: number;
  a: Point;
  b: Point;
  length: number;
  angle: number;
  score: number;
  buffer: number;
}
```

Function:

```ts
function analyzeBlockFrontage(block: CityBlock, roadHazards: RoadHazard[]): BlockFrontageAnalysis
```

Parameters:

- `block: CityBlock`
- `roadHazards: RoadHazard[]`

Returns:

```ts
interface BlockFrontageAnalysis {
  edges: FrontageEdge[];
  groups: FrontageGroup[];
  primary: FrontageGroup | null;
  blockArea: number;
  blockDepth: number;
  aspectRatio: number;
  irregularity: number;
}
```

Spec lines satisfied:

- identify bordering road edges
- compute weighted frontage score
- mark highest-value side
- compute block depth, area, aspect ratio, irregularity

### `FrontageGroup`

Contract:

```ts
interface FrontageGroup {
  id: string;
  roadIds: string[];
  roadClass: RoadClass;
  valueWeight: number;
  edges: FrontageEdge[];
  polyline: Point[];
  totalLength: number;
  weightedScore: number;
  averageAngle: number;
  isCurved: boolean;
}
```

Functions:

```ts
function groupConnectedFrontageEdges(edges: FrontageEdge[]): FrontageGroup[]
function choosePrimaryFrontage(groups: FrontageGroup[]): FrontageGroup | null
```

Parameters:

- `edges: FrontageEdge[]`
- `groups: FrontageGroup[]`

Returns:

- `FrontageGroup[]`
- `FrontageGroup | null`

Spec lines satisfied:

- connected frontage groups
- curved/segmented frontage
- highest-value edge or connected edge group
- beach roads naturally win through road value

### `BuildingBlockProfile`

File:

- currently `services/playgame/city-map/buildings.ts`
- recommended home: `services/playgame/city-map/planning.ts`

Expanded contract:

```ts
interface BuildingBlockProfile {
  age: BlockAgeTag;
  use: BlockUseTag;
  subdivisionFlavor: SubdivisionFlavor;
  frontageGroupId?: string | null;
  frontageRoadClass?: RoadClass | null;
  frontageScore?: number;
  frontageDivisionCount?: number;
  frontageSetback?: number;
  modernityScore?: number;
  roadPriority?: number;
  layoutStrategy?: string;
  layoutFailure?: string;
  metrics?: BlockPlanningMetrics;
}
```

Function:

```ts
function chooseBlockProfile(
  block: CityBlock,
  frontage: BlockFrontageAnalysis,
  rng: Rng,
): BuildingBlockProfile
```

Parameters:

- `block: CityBlock`
- `frontage: BlockFrontageAnalysis`
- `rng: Rng`

Returns:

- `BuildingBlockProfile`

Spec lines satisfied:

- assign zone
- assign age
- choose subdivision flavor
- commercial age controls frontage divisions

### `frontageDivisionCountForProfile`

File:

- recommended: `services/playgame/city-map/planning.ts`

Function:

```ts
function frontageDivisionCountForProfile(
  profile: Pick<BuildingBlockProfile, 'use' | 'age'>,
  frontage: FrontageGroup,
  blockArea: number,
  rng: Rng,
): number
```

Parameters:

- `profile.use`
- `profile.age`
- `frontage`
- `blockArea`
- `rng`

Returns:

```ts
number
```

Rules:

```txt
commercial_new -> 1..3
commercial_average -> 3..7
commercial_old -> 7..16+
```

Spec lines satisfied:

- commercial age rule
- new commercial consolidated frontage
- old commercial fragmented frontage
- average commercial medium frontage rhythm

### `FrontageParcel`

Contract:

```ts
interface FrontageParcel {
  id: string;
  frontageGroupId: string;
  frontageStart: number;
  frontageEnd: number;
  frontageLength: number;
  roadClass: RoadClass;
  roadSetback: number;
  desiredDepth: number;
  envelope: Point[];
}
```

Function:

```ts
function subdivideFrontageIntoParcels(input: {
  blockPolygon: Point[];
  frontageGroup: FrontageGroup;
  divisionCount: number;
  setback: number;
  depthPolicy: DepthPolicy;
  rng: Rng;
}): FrontageParcel[]
```

Returns:

- `FrontageParcel[]`

Spec lines satisfied:

- highest-value frontage first
- divide expensive frontage into 1..3, 3..7, or 7..16+
- building face parallel to frontage
- global commercial setback
- odd-shaped parcels become odd-shaped buildings when appropriate

### `BlockPlanningMetrics`

Contract:

```ts
interface BlockPlanningMetrics {
  generatedBuildingCount: number;
  highValueFrontageUtilization: number;
  totalBuildableAreaUtilization: number;
  rejectedParcelCount: number;
  sliverCleanupCount: number;
  fallbackReason?: string;
  score?: number;
}
```

Function:

```ts
function scoreBlockLayout(layout: GeneratedBlockLayout, profile: BuildingBlockProfile): BlockPlanningMetrics
```

Returns:

- `BlockPlanningMetrics`

Spec lines satisfied:

- score result
- debug metrics
- cleanup reporting

## Concept-To-Code Map

| Spec concept | Current implementation | Needed implementation |
| --- | --- | --- |
| Road class | `RoadEdge.kind`, `RoadEdge.source`, `roadRenderForKind` | Add explicit `RoadClass` and `roadValueForEdge` |
| Road value weight | `roadHazardPriority` approximates 1..4 | Use spec weights 10/6/3/1 |
| Edge length | Available from `RoadHazard.a/b` | Store on `FrontageEdge.length` |
| Edge score | Not explicit | `FrontageEdge.score = length * valueWeight` |
| Connected frontage group | Not explicit | `groupConnectedFrontageEdges` |
| Highest-value side | Implied by sorting hazards in `generateBlockBuildings` | `BlockFrontageAnalysis.primary` |
| Block profile | `BuildingBlockProfile` in `buildings.ts` | Move/expand profile contract into planning layer |
| Zone | `profile.use` commercial/residential/public | Expand to full zone set later |
| Age | `profile.age` old/average/new | Keep, but compute from frontage + district context |
| Subdivision flavor | `profile.layoutStrategy` debug string | Add typed `SubdivisionFlavor` |
| Commercial new | `fillCommercialNewGrid` | `generateCommercialNewLayout` using frontage parcels |
| Commercial average | Generic generator | `generateCommercialAverageLayout` |
| Commercial old | Generic generator with old flags | `generateCommercialOldLayout` |
| Residential | Generic generator with residential flags | Separate residential new/average/old layout policies |
| Landmark | Some large park/landmark handling in `buildStaticBuildings` | Explicit landmark override layout |
| Global commercial setback | `COMMERCIAL_FRONTAGE_SETBACK` | Export `GLOBAL_COMMERCIAL_SETBACK` |
| Curved frontage | Segment-by-segment hazards | Connected frontage group with polyline parceling |
| Odd plot buildings | Some clipped polygons in commercial new | Parcel envelope clipping for all frontage layouts |
| Service spine | Not explicit | Add `ServicePath[]` to generated layout |
| Courtyard/park insert | Some `openSpaces` exist | Layout-level planned open spaces |
| Cleanup | Implicit rejection | Explicit cleanup pass and metrics |
| Score result | Not implemented | `scoreBlockLayout` |
| Debug metrics | Partial planning tooltip | Add frontage, division, rejection, utilization metrics |

## Pipeline Mapping

### 1. Analyze Block

New function:

```ts
analyzeBlockFrontage(block, roadHazards): BlockFrontageAnalysis
```

Uses:

- `polygonArea`
- `polygonCentroid`
- `pointToSegmentDist`
- road hazard segment length

Returns:

- frontage edges
- frontage groups
- primary frontage
- block shape metrics

### 2. Assign Zone

Existing function:

```ts
chooseBlockProfile(block, roadHazards, rng): BuildingBlockProfile
```

Recommended function:

```ts
chooseBlockProfile(block, frontageAnalysis, rng): BuildingBlockProfile
```

Returns:

- `use`
- `age`
- `subdivisionFlavor`
- frontage reference

### 3. Assign Age

Existing function:

```ts
blockRoadModernity(block, roadHazards): { score: number; priority: number }
```

Recommended function:

```ts
scoreBlockModernity(block, frontageAnalysis, districtContext, rng): number
```

Returns:

- modernity score used to select `old | average | new`

### 4. Select Subdivision Flavor

New function:

```ts
selectSubdivisionFlavor(profile, frontageAnalysis, rng): SubdivisionFlavor
```

Returns:

- one of the typed subdivision flavors

### 5. Place Frontage Buildings

Existing functions:

- `fillCommercialNewGrid`
- `pushRoadFrontageFootprint`
- `pushUvCorners`

Recommended functions:

```ts
subdivideFrontageIntoParcels(...)
buildFrontageParcelFootprint(...)
generateCommercialNewLayout(...)
generateCommercialAverageLayout(...)
generateCommercialOldLayout(...)
```

Returns:

- `GeneratedBlockLayout`

### 6. Place Service/Internal Structure

New functions:

```ts
generateServiceSpine(blockPolygon, frontageGroup, profile): ServicePath | null
generateInteriorOpenSpaces(blockPolygon, profile, rng): PlannedOpenSpace[]
```

Returns:

- service path geometry
- plaza/courtyard/parking/open-space geometry

### 7. Fill Rear/Interior

Existing behavior:

- generic UV grid fill inside `generateBlockBuildings`

Recommended functions:

```ts
fillCommercialRearInterior(...)
fillResidentialInterior(...)
fillOldHodgepodgeInterior(...)
```

Returns:

- additional lots/buildings/open spaces

### 8. Cleanup

New function:

```ts
cleanupBlockLayout(layout, profile): GeneratedBlockLayout
```

Returns:

- cleaned layout
- metrics for slivers/rejections/merges

### 9. Score Result

New function:

```ts
scoreBlockLayout(layout, profile): BlockPlanningMetrics
```

Returns:

- utilization and quality scores

### 10. Output

Existing output:

```ts
GeneratedBuildingFootprint[]
```

Recommended output:

```ts
GeneratedBlockLayout
```

`buildStaticBuildings` can keep converting `layout.buildings` into `Building[]`.

## Implementation Order

1. Add `planning.ts` with road value, frontage analysis, profile selection, division count, and metrics contracts.
2. Change `city-v35.ts` to call `analyzeBlockFrontage` before `chooseBlockProfile`.
3. Expand `BuildingBlockProfile` to include typed `subdivisionFlavor`, `frontageDivisionCount`, and primary frontage debug fields.
4. Refactor `fillCommercialNewGrid` into `generateCommercialNewLayout(input)`.
5. Add commercial-average and commercial-old frontage parcel functions using the same parcel contract but different division counts.
6. Upgrade debug tooltip to show frontage group, score, division count, and utilization.
7. Add cleanup and score metrics after the first layouts are stable.

## Acceptance Checklist

- Highway/coast-road frontage visually dominates subdivision decisions.
- Commercial-new blocks usually have `1..3` frontage parcels.
- Commercial-average blocks usually have `3..7` frontage parcels.
- Commercial-old blocks usually have `7..16+` frontage parcels.
- Commercial setback is globally consistent.
- Buildings along a curved/segmented expensive road follow that frontage as a connected group.
- Odd-shaped commercial-new parcels become clean odd-shaped buildings instead of centered rectangles.
- Residential blocks are allowed to waste/open space intentionally.
- Landmark/public blocks can override normal economics.
- Planning tooltip explains why a block looks the way it does.
