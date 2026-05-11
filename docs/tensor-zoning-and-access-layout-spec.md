# Tensor Zoning And Access-Based Building Layout Spec

## Goal

Add a zoning and access layer between parcelization and building generation.

The current generator often treats a buildable polygon as empty area to fill. That creates jigsaw-like blocks where buildings are recursively packed into every part of a square plot. Real cities are usually not built that way. Most buildings need access: they front a street, waterfront promenade, service road, alley, plaza, or some other circulation edge.

The target model:

```text
roads/water define parcels
zoning defines parcel purpose
age defines subdivision grain
frontage/access defines where buildings can exist
```

## Non-Goals

- Do not build a full city simulation.
- Do not require perfect real-world zoning law.
- Do not rewrite tensor road generation.
- Do not make every parcel dense.
- Do not remove the existing renderer.
- Do not force every building to touch a road; exceptions exist, but access should be the default rule.

## Core Principles

### 1. Access Beats Fill

Most buildings should touch or face an access edge.

Valid access edges include:

- main/yellow roads
- major roads
- minor roads
- waterfront promenades or coast roads
- alleys/service lanes if generated later
- plaza/public-space edges for civic or landmark districts

Invalid default behavior:

```text
take a square block
recursively pack small buildings into the whole area
```

Preferred default behavior:

```text
find usable frontage/access edges
place one or more rows of buildings from those edges inward
leave rear yards, courtyards, service space, open space, or interior voids depending on zoning
```

Interior buildings can exist, but only when there is a reason:

- industrial campus
- public service campus
- landmark complex
- large commercial block with internal arcade/service lane
- generated alley network

### 2. Zoning Decides Behavior

Density alone is not enough. A parcel can be high-value but not packed.

Examples:

- waterfront hospitality: high value, larger lots, setbacks, open space
- yellow-road commercial: high frontage usage, compact street wall
- residential: smaller buildings, yards/setbacks, repeated narrow lots
- industrial: large footprints, fewer buildings, uses most of the parcel
- public service: large building plus grounds
- landmark: no normal buildings, special geometry or open space

### 3. Age Decides Grain

Age is a style modifier on top of zoning.

Old development:

- smaller units
- narrow frontage
- deeper lots
- finer grain
- shallow buildings on frontage side with depth extending into the block
- examples: older San Francisco row/block patterns

New development:

- larger units
- fewer subdivisions
- more block-scale footprints
- stronger corner usage
- more efficient or planned layouts
- may use most of the plot

### 4. Zoning Clusters Spatially

Zoning should not be rolled independently per parcel.

Neighborhoods cluster:

- residential tends to be near residential
- industrial tends to form districts
- hospitality clusters near waterfront/landmarks
- commercial follows main roads and major intersections

Big streets can reset zoning.

Heuristic:

```text
small streets connect same-zone parcels
major roads weaken zone continuity
yellow/main roads often terminate or reset zones
rivers/coastlines strongly shape nearby zones
```

This gives random variation without every parcel feeling random.

## Zoning Types

```ts
export type ZoneType =
  | 'commercial'
  | 'industrial'
  | 'residential'
  | 'hospitality'
  | 'public-service'
  | 'landmark';
```

## Development Age

```ts
export type DevelopmentAge =
  | 'old'
  | 'mixed'
  | 'new';
```

## Parcel Classification

Add a parcel-level semantic model:

```ts
export interface ZonedParcel {
  polygon: Vector[];
  frontages: ParcelFrontage[];
  zone: ZoneType;
  age: DevelopmentAge;
  accessEdges: ParcelFrontage[];
  districtId: string;
  density: number;       // 0..1
  value: number;         // 0..1
  buildableDepth: number;
}
```

`density` and `value` are separate.

Waterfront can be high value but medium density.

Yellow-road commercial can be both high value and high density.

Industrial can be medium value but large footprint.

Landmark can be high value and zero normal-building density.

## Zone Selection Signals

### Commercial

Favored by:

- yellow/main frontage
- major intersections
- high road centrality
- near public service or landmarks
- some waterfront, especially harbor/promenade edges

Layout:

- strong frontage usage
- buildings face the highest-priority street
- wasted/loading/open space goes behind buildings
- corners are used well
- few random internal buildings unless an arcade/alley exists

### Industrial

Favored by:

- large parcels
- low scenic/waterfront value
- edges of city
- major road access
- regular/simple parcel shapes

Layout:

- large buildings
- fewer subdivisions
- may consume most of the block
- service yards in leftover space
- less frontage charm

### Residential

Favored by:

- minor and major road grids
- distance from main/yellow road intensity
- interior districts
- clustering with existing residential

Layout:

- uses rear frontage/access better than commercial
- old residential: narrow, deep lots
- new residential: larger lots, more setbacks
- grass/front yards often on frontage side
- not all interior area must be packed

### Hospitality

Favored by:

- waterfront
- parks
- landmarks
- scenic edges
- major roads near water

Layout:

- premium frontage
- larger footprints or paired buildings
- setbacks and open space
- fewer tiny lots
- good corner/water usage

### Public Service

Favored by:

- large parcels
- major/main road access
- district centers
- near residential but not necessarily on the busiest corridor

Layout:

- one or a few large buildings
- grounds/open areas
- campuses
- civic setbacks

### Landmark

Favored by:

- very large parcels
- important intersections
- waterfront nodes
- parks/lakes/plazas
- district centers

Layout:

- no normal recursive buildings
- special open-space or landmark generator
- parks, lakes, plazas, monuments, stadium-like footprints later

## District Clustering

Add a district assignment step after parcelization and frontage detection.

### Parcel Graph

Represent parcels as graph nodes.

Edges connect parcels that are nearby or share a boundary/access corridor.

Edge strength depends on separator:

```text
same side of minor road: strong
across minor road: medium
across major road: weak
across yellow/main road: very weak / reset
across river: no continuity unless bridged
across coast/ocean: no continuity
```

### Zone Seeding

Seed zones from strong signals:

- yellow corridors seed commercial
- waterfront scenic stretches seed hospitality
- interior grids seed residential
- large edge parcels seed industrial/public-service
- large parks/open shapes seed landmark

### Zone Flooding

Flood-fill or region-grow zones across the parcel graph.

Rules:

- same zone spreads easily across minor streets
- major roads reduce spread chance
- yellow/main roads often stop spread and allow a new zone
- water boundaries stop spread
- district size is capped so zones do not take over the whole map

Pseudo:

```ts
for each seed:
  queue seed parcel
  while queue not empty and district below size cap:
    for neighbor:
      spreadChance = baseZoneAffinity
      spreadChance *= roadSeparatorMultiplier
      spreadChance *= frontageCompatibility
      if random() < spreadChance:
        assign neighbor to district
```

Unassigned parcels get filled by nearest/most-compatible district or default residential.

## Age Assignment

Age should cluster too.

Signals:

- old near dense historic grids, irregular older road patterns, city centers
- new near large regular parcels, waterfront redevelopment, edge districts
- mixed near transition areas

Heuristic:

```text
small parcels + dense minor roads -> old
large parcels + regular roads -> new
commercial corridors -> mixed/new
waterfront hospitality -> mixed/new
industrial -> new/mixed
```

Age modifies lot layout without changing the zone.

## Access-Based Layout

Add a new module:

```text
services/playgame/city-map/tensor/impl/zoned_lot_layout.ts
```

Initial public contract:

```ts
export interface ZonedLotLayoutInput {
  parcels: ZonedParcel[];
  defaultMinArea: number;
}

export interface ZonedLotLayoutResult {
  lots: Vector[][];
  stats: {
    parcelCount: number;
    lotCount: number;
    zoneCounts: Record<ZoneType, number>;
    ageCounts: Record<DevelopmentAge, number>;
    fallbackCount: number;
    rejectedCount: number;
    ms: number;
  };
}

export function generateZonedLots(input: ZonedLotLayoutInput): ZonedLotLayoutResult;
```

### General Layout Rule

For most zones:

```text
choose access/frontage edges
generate buildings from those edges inward
do not recursively fill unreachable interior area
```

Interior area becomes:

- rear yards
- courtyards
- parking/service yards
- grass/open space
- industrial yards
- plaza/campus land

### Commercial Layout

```text
frontage street wall
usable depth from frontage
rear service void
strong corner buildings
```

Old commercial:

- narrower storefronts
- shallower buildings
- tighter rhythm

New commercial:

- larger footprints
- corner anchors
- fewer repeated units

### Residential Layout

```text
front setback / yard
building row behind setback
deep lots if old
larger lots if new
```

Old residential:

- narrow/deep lots
- many similar units
- usually one frontage row

New residential:

- larger lots
- fewer buildings
- more varied setbacks

### Industrial Layout

```text
one/few large buildings
uses most of parcel
service yard on least valuable edge
```

Industrial can violate the "only frontage row" rule because large buildings often occupy interior land, but they still need service access.

### Hospitality Layout

```text
waterfront/main frontage oriented
larger buildings
setbacks/open space
view corridors
```

Hospitality should use waterfront frontage well but not pack tiny units along it.

### Public Service Layout

```text
large central/campus building
grounds/open space
strong access from major/main road
```

### Landmark Layout

```text
no standard lots
special polygon remains as park/lake/plaza/monument
```

For the first implementation, landmark parcels can simply return no building lots and rely on park/landmark renderers later.

## Implementation Phases

### Phase A: Data Only

- Add `ZoneType`, `DevelopmentAge`, `ZonedParcel`.
- Add a pure zoning classifier module.
- Produce debug stats only.
- Do not change building layout yet.

### Phase B: Simple Zone Assignment

Assign zones per parcel using local signals:

- frontage kind
- parcel area
- compactness
- waterfront distance/frontage
- main-road frontage

No clustering yet.

### Phase C: Cluster Zones

Build parcel adjacency graph.

Add district seeding and flood-fill.

Use big roads as reset boundaries.

### Phase D: Zone-Aware Layout

Replace frontage-only layout with zoned layout for island parcelized buildings.

Keep frontage-only layout as fallback.

### Phase E: Extend To All Map Shapes

Convert regular `PolygonFinder` blocks into `ZonedParcel`s.

Use the same zoned layout for peninsula, island, and landlocked maps.

## Debugging Requirements

Add debug overlays before heavy tuning:

- color parcels by zone
- color parcels by age
- show district IDs
- show primary frontage
- show access edges
- show generated lots
- show rejected/no-access parcels

Add profiler stats:

- zone counts
- age counts
- district counts
- average lots per zone
- rejected parcels by reason

## Acceptance Criteria

- Buildings are not jigsaw-packed into every valid polygon by default.
- Most buildings touch or face a road/waterfront/access edge.
- Commercial uses high-priority frontage better than residential.
- Residential leaves plausible frontage yards/setbacks and rear/courtyard space.
- Industrial creates larger block-scale buildings.
- Waterfront parcels feel valuable but not necessarily overcrowded.
- Similar zones cluster across local neighborhoods.
- Yellow/main roads can reset zone clusters.
- The same seed remains deterministic.
