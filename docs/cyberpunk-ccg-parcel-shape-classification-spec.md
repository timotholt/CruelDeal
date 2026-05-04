# Cyberpunk CCG Parcel Shape Classification Spec

## Purpose

The city-map building pipeline needs a geometry classification layer before it chooses a building template.

The current generator knows zoning and frontage value, but it still treats many parcel shapes as generic polygons. That creates bad cases:

- large "new" commercial or hospitality blocks with accidental empty backs
- clipped triangle fragments accepted as buildings
- rotated rectangles treated differently from axis-aligned rectangles
- curved/coastal blocks forced through straight-rectangle logic
- odd blocks "filled" numerically but not planned believably

This spec defines a parcel shape classifier. The classifier does not place buildings. It answers:

- What general shape is this block?
- What orientation is that shape in?
- Which sides are straight, curved, valuable, cheap, tiny, or awkward?
- Which template families are eligible?
- Is the shape too ambiguous to build on confidently?

The classifier is a new pipeline layer:

```txt
raw block polygon
  -> parcel shape classification
  -> frontage/value analysis
  -> zoning/profile selection
  -> template routing
  -> layout generation
  -> scoring/debug
```

Shape classification is geometry. Zoning/frontage is economics. Template routing combines them.

## Recommended File

```txt
services/playgame/city-map/parcel-shapes.ts
```

This file should be independent from building placement. It may import geometry helpers, road/frontage types, and city-map point types, but it should not import the building generator.

## Pipeline Storage

### CityBlock Storage

Store the full classification on each `CityBlock`:

```ts
block.shape = classifyParcelShape(block, {
  frontageAnalysis,
  roadHazards,
  terrain,
});
```

Recommended `CityBlock` attachment:

```ts
export interface CityBlock {
  id: string;
  districtId?: string | null;
  polygon: Point[];
  centroid?: Point;
  frontageAnalysis?: BlockFrontageAnalysis;
  shape?: ParcelShapeClassification;
  planning?: BuildingBlockProfile;
  [key: string]: unknown;
}
```

The repo currently keeps `CityBlock` open with `[key: string]: unknown`, so implementation can attach `shape` before formalizing the type.

### Planning Storage

`BuildingBlockProfile` should store only the template-relevant summary, not the full shape object.

Recommended profile fields:

```ts
interface BuildingBlockProfile {
  shapeFamily?: ParcelShapeFamily;
  shapeOrientation?: ParcelOrientation;
  triangleOrientation?: TriangleOrientation;
  shapeConfidence?: number;
  shapeTemplateHints?: LayoutTemplateHint[];
  shapeFallbackReason?: string;
  selectedTemplate?: LayoutTemplateId;
}
```

Reason:

- `block.shape` is the full diagnostic and geometry record.
- `block.planning` is the zoning/template/debug contract consumed by building generation and UI.
- Building generation can read the full `block.shape` later when template solvers need detailed sides, axes, or usable cores.

### Pipeline Order

Recommended order inside `buildStaticBuildings`:

```ts
for (const block of cells) {
  if (!block.buildable) continue;

  const frontageAnalysis = analyzeBlockFrontage(block, roadHazards);
  block.frontageAnalysis = frontageAnalysis;

  const shape = classifyParcelShape(block, {
    frontageAnalysis,
    roadHazards,
    terrain,
  });
  block.shape = shape;

  const profile = chooseBlockProfile(block, frontageAnalysis, rng, zoningContext);
  applyShapeFallbacks(block, profile, shape);
  block.planning = profile;

  const templateChoice = chooseLayoutTemplate({ block, shape, frontageAnalysis, profile });
  profile.selectedTemplate = templateChoice.template;

  const layout = generateLayoutForTemplate({ block, shape, frontageAnalysis, profile, templateChoice });
}
```

Short-term implementation can classify shape before `chooseBlockProfile` and let `chooseBlockProfile` read `block.shape`.

Long-term implementation should separate:

```txt
choose zone
choose subdivision/template
generate layout
score layout
```

## Unknown Shape Fallback

If the classifier cannot confidently identify a block shape, the block should not be forced through commercial or residential building templates.

Default rule:

```txt
unclassified + low confidence -> park_open
```

This is intentional. A bad building block looks broken. A small green/open/public block looks planned.

Fallback behavior:

- If `shape.family === 'unclassified'` and `shape.confidence < 0.45`, set planned use to `park_open` unless the block is explicitly landmark/civic-critical.
- If the block is too small, too thin, or too broken to build, set `park_open` or `infrastructure_service`.
- If the block sits on major infrastructure, rail, highway interchange, port, or utility adjacency, prefer `infrastructure_service`.
- If the block is waterfront/high-value but unclassified, prefer `park_open`, `civic_public`, or `landmark` over commercial.
- Never let low-confidence shape classification produce random clipped commercial fragments.

Suggested fallback function:

```ts
function fallbackUseForUnclassifiedParcel(input: {
  shape: ParcelShapeClassification;
  frontage: BlockFrontageAnalysis;
  districtRole?: DistrictLandUseRole;
}): BlockUseTag {
  if (shape.family === 'tiny' || shape.family === 'sliver') return 'park_open';
  if (shape.infrastructurePressure > 0.65) return 'infrastructure_service';
  if (shape.waterfrontPressure > 0.55) return 'park_open';
  if (shape.confidence < 0.45) return 'park_open';
  return 'park_open';
}
```

Debug reason:

```txt
shapeFallbackReason = "unclassified-low-confidence-park"
```

## Core Types

### ParcelShapeFamily

```ts
export type ParcelShapeFamily =
  | 'rectangle'
  | 'rotated_rectangle'
  | 'parallelogram'
  | 'skewed_quad'
  | 'angled_frontage_quad'
  | 'irregular_quad'
  | 'long_strip'
  | 'triangle'
  | 'wedge'
  | 'trapezoid'
  | 'l_shape'
  | 't_shape'
  | 'courtyard_candidate'
  | 'curved_frontage'
  | 'crescent'
  | 'bulged_rectangle'
  | 'pinched_irregular'
  | 'organic_blob'
  | 'sliver'
  | 'tiny'
  | 'unclassified';
```

Meaning:

- `rectangle`: axis-aligned or field-aligned rectangular block with high rectangularity.
- `rotated_rectangle`: rectangle whose dominant axis is not close to screen/card axes.
- `parallelogram`: four-sided parcel with opposite sides parallel but non-right corners.
- `skewed_quad`: high-fit four-sided parcel whose frontage/back or side relationships are skewed enough that plain rectangle logic is unsafe.
- `angled_frontage_quad`: four-sided parcel where the valuable frontage side is not perpendicular to both side boundaries, often producing two clean corners and two road-skewed corners.
- `irregular_quad`: four-sided parcel with no stable rectangle, trapezoid, or parallelogram relation.
- `long_strip`: high aspect-ratio parcel with consistent width and one or two long sides.
- `triangle`: three dominant sides and one meaningful apex.
- `wedge`: triangle-like parcel with a tiny fourth side, rounded point, or clipped apex.
- `trapezoid`: four dominant sides with one pair mostly parallel.
- `l_shape`: concave parcel with one clear missing corner.
- `t_shape`: concave parcel with a stem and crossbar.
- `courtyard_candidate`: large block suitable for an internal court even if not concave yet.
- `curved_frontage`: one dominant curved valuable side and a buildable back.
- `crescent`: two curved sides, often water/road bounded, with long organic strip behavior.
- `bulged_rectangle`: rectangular core plus one rounded/organic bulge.
- `pinched_irregular`: two lobes connected by a narrow waist.
- `organic_blob`: valid buildable parcel but no simple template family dominates.
- `sliver`: too thin for normal buildings.
- `tiny`: too small for normal buildings.
- `unclassified`: classifier could not decide safely.

### ParcelOrientation

```ts
export type ParcelOrientation =
  | 'horizontal'
  | 'vertical'
  | 'diagonal_ne'
  | 'diagonal_nw'
  | 'diagonal_se'
  | 'diagonal_sw'
  | 'rotated'
  | 'curved'
  | 'unknown';
```

Orientation describes the dominant planning axis, not the screen's visual impression after camera rotation.

### TriangleOrientation

```ts
export type TriangleOrientation =
  | 'point_north'
  | 'point_south'
  | 'point_east'
  | 'point_west'
  | 'point_ne'
  | 'point_nw'
  | 'point_se'
  | 'point_sw'
  | 'flat_top'
  | 'flat_bottom'
  | 'flat_left'
  | 'flat_right'
  | 'valuable_long_side'
  | 'valuable_short_side'
  | 'valuable_apex'
  | 'unknown';
```

Triangle orientation needs both geometry and economics:

- Geometry orientation: where the apex points.
- Economic orientation: which side is valuable.

A triangle with `point_east` may still route differently if the valuable frontage is the west flat side versus the north diagonal side.

### Shape Side

```ts
export interface ShapeSide {
  id: string;
  points: Point[];
  chordStart: Point;
  chordEnd: Point;
  midpoint: Point;

  length: number;
  chordLength: number;
  curvature: number;
  angle: number;
  normalInward: Point;

  kind:
    | 'straight'
    | 'slightly_curved'
    | 'curved'
    | 'corner_cluster'
    | 'tiny_sliver_edge';

  orientation:
    | 'north'
    | 'south'
    | 'east'
    | 'west'
    | 'diagonal_ne'
    | 'diagonal_nw'
    | 'diagonal_se'
    | 'diagonal_sw'
    | 'curved'
    | 'unknown';

  adjacentRoadIds: string[];
  adjacentRoadClass?: RoadClass;
  frontageValue: number;
  isPrimaryFrontage: boolean;
  isSecondaryFrontage: boolean;
  isCheapBackSide: boolean;
  isWaterfront: boolean;
  isServiceSide: boolean;
}
```

### Awkward Remainder

```ts
export interface AwkwardRemainder {
  id: string;
  kind:
    | 'rear_triangle'
    | 'side_sliver'
    | 'corner_sliver'
    | 'bulge'
    | 'pinch'
    | 'concave_bite'
    | 'curved_margin'
    | 'unknown';
  polygon: Point[];
  area: number;
  usableForBuilding: boolean;
  recommendedUse:
    | 'park'
    | 'plaza'
    | 'parking'
    | 'service_yard'
    | 'utility'
    | 'landscape'
    | 'secondary_building'
    | 'discard';
  reason: string;
}
```

### Classification Result

```ts
export interface ParcelShapeClassification {
  family: ParcelShapeFamily;
  orientation: ParcelOrientation;
  triangleOrientation?: TriangleOrientation;

  area: number;
  perimeter: number;
  compactness: number;
  aspectRatio: number;
  rectangularity: number;
  convexity: number;
  concavity: number;
  thinness: number;
  curvature: number;

  primaryAxisAngle: number;
  secondaryAxisAngle: number;
  orientedBounds: OrientedBounds;

  vertices: ShapeVertex[];
  sides: ShapeSide[];

  longestSideId?: string;
  shortestSideId?: string;
  flattestSideId?: string;
  mostCurvedSideId?: string;
  primaryFrontageSideId?: string;
  cheapBackSideId?: string;

  usableCore?: Point[];
  awkwardRemainders: AwkwardRemainder[];

  infrastructurePressure: number;
  waterfrontPressure: number;
  buildabilityScore: number;

  templateHints: LayoutTemplateHint[];
  confidence: number;
  reasons: string[];
  fallbackReason?: string;
}
```

### Oriented Bounds

```ts
export interface OrientedBounds {
  center: Point;
  axisU: Point;
  axisV: Point;
  width: number;
  depth: number;
  angle: number;
  corners: Point[];
  area: number;
  fit: number;
}
```

`fit` is:

```txt
polygonArea / orientedBounds.area
```

For a rectangle this is close to `1`. For a triangle this is near `0.5`. For concave/organic shapes it is lower or less stable.

## Classification Algorithm

### 1. Normalize Polygon

Input:

```ts
function classifyParcelShape(
  block: CityBlock,
  context: ParcelShapeClassificationContext,
): ParcelShapeClassification
```

Normalization steps:

1. Remove duplicate consecutive points.
2. Remove edges shorter than `EPS_EDGE_LENGTH`, unless removing them would destroy a meaningful apex.
3. Merge almost-collinear points when angle delta is under `COLLINEAR_EPS_DEG`.
4. Preserve smooth curves as point runs instead of collapsing them to one chord.
5. Ensure polygon winding is consistent.
6. Compute centroid and signed area.

Important:

- Do not erase sampled curved coast/river/road edges during simplification.
- The classifier needs both a simplified side model and the original sampled boundary.

Recommended output from normalization:

```ts
interface NormalizedParcelPolygon {
  original: Point[];
  simplified: Point[];
  curvePreserved: Point[];
  area: number;
  centroid: Point;
  winding: 'cw' | 'ccw';
}
```

### 2. Compute Basic Metrics

Metrics:

```txt
area
perimeter
axis-aligned bounding box
oriented bounding box
aspect ratio
compactness
convex hull area
convexity
concavity
minimum width estimate
thinness
principal axis angle
```

Definitions:

```txt
compactness = 4 * PI * area / perimeter^2
convexity = area / convexHullArea
concavity = 1 - convexity
rectangularity = area / orientedBoundingBoxArea
aspectRatio = max(obb.width, obb.depth) / min(obb.width, obb.depth)
thinness = minWidth / maxLength
```

Expected ranges:

- square/rectangle: high rectangularity, high convexity, moderate/high compactness
- triangle: rectangularity near `0.45-0.65`, high convexity, three sides
- long strip: high aspect ratio, medium rectangularity, low thinness
- crescent: lower convexity, high curvature, elongated
- sliver: very high aspect ratio or very low min width

### 3. Group Edges Into Sides

The polygon's raw edges are not necessarily planning sides. Curved coastlines and smoothed roads may contain many sampled points.

Group rules:

1. Consecutive edges with small angle change become a straight side.
2. Consecutive edges with gradual angle change and consistent curvature become a curved side.
3. Tiny jagged edges near a corner become a `corner_cluster`.
4. Very small leftover edges become `tiny_sliver_edge`.

Each side gets:

- side polyline
- chord start/end
- chord length
- actual length
- curvature ratio
- average angle
- inward normal
- adjacent frontage/road info

Curvature:

```txt
curvature = actualPolylineLength / chordLength - 1
```

Suggested thresholds:

```txt
curvature < 0.03 -> straight
0.03..0.12 -> slightly_curved
> 0.12 -> curved
```

### 4. Attach Frontage Economics To Sides

Use existing `BlockFrontageAnalysis` to map frontage groups to shape sides.

Side matching:

- Compare side chord/polyline to frontage group polyline.
- Match by segment proximity and angle compatibility.
- Assign adjacent road ids and road class.
- Compute side frontage value.

Side value:

```txt
frontageValue =
  roadClassWeight
  + waterfrontWeight
  + transit/service access bonus
  + frontage length bonus
  - service/alley penalty
```

This lets the template router say:

```txt
triangle + valuable longest side -> diagonal frontage band
triangle + cheap sliver side -> absorb sliver into service/open
curved side + high value -> curved frontage band
curved side + low value -> rectangular core with curved landscape margin
```

### 5. Early Exit For Tiny And Sliver Parcels

Classify these before trying any rich shape logic.

Tiny:

```txt
area < MIN_BUILDABLE_BLOCK_AREA
or oriented bounds width < MIN_BUILDABLE_WIDTH
or depth < MIN_BUILDABLE_DEPTH
```

Sliver:

```txt
aspectRatio > SLIVER_ASPECT_RATIO
or minWidth < SLIVER_MIN_WIDTH
or compactness very low with no usable core
```

Fallback:

- `tiny` -> `park_open`, `plaza`, or `infrastructure_service`
- `sliver` -> `park_open`, `linear plaza`, `utility`, `buffer`, `service strip`

### 6. Detect Rectangles And Rotated Rectangles

A rectangle is detected using oriented bounds and side relationships, not screen axes.

Criteria:

```txt
side count: 4 dominant sides, or many points grouped into 4 sides
rectangularity >= 0.82
convexity >= 0.94
opposite sides mostly parallel
adjacent sides roughly perpendicular
aspectRatio not extreme unless long_strip
```

Axis-aligned vs rotated:

```txt
if primaryAxisAngle is close to 0/90 degrees -> rectangle
else -> rotated_rectangle
```

Template implications:

- commercial new -> rectangle frontage band
- hospitality new -> campus/court/podium template
- residential -> grid/courtyard/block-edge template
- industrial -> service-yard/warehouse template

### 7. Detect Long Strips

Criteria:

```txt
aspectRatio >= 3.0
minWidth usable
two dominant long sides
frontage length high relative to depth
```

Subtypes:

- straight long strip
- curved long strip
- waterfront strip
- service/industrial strip

Template implications:

- commercial -> frontage strip with rear/service margin
- industrial -> long warehouse/service strip
- residential -> row housing/apartment bar
- park -> greenway/linear park

### 8. Detect Triangles

Use side grouping first. Do not rely only on raw vertex count.

Triangle criteria:

```txt
3 dominant sides
convexity high
rectangularity near triangle range
one apex opposite longest side
no deep concavity
```

Triangle data:

```ts
interface TriangleShapeData {
  apex: Point;
  baseSideId: string;
  sideAId: string;
  sideBId: string;
  apexDirection: TriangleOrientation;
  longestSideId: string;
  valuableSideId: string;
  valuableSidePosition: 'base' | 'left_side' | 'right_side' | 'apex_corner';
}
```

Triangle orientation:

- Geometry:
  - `flat_top`
  - `flat_bottom`
  - `flat_left`
  - `flat_right`
  - `point_ne`, etc.
- Economics:
  - `valuable_long_side`
  - `valuable_short_side`
  - `valuable_apex`

Template implications:

- valuable long side -> `commercial_triangle_diagonal_band`
- valuable flat side -> `commercial_triangle_flat_ladder`
- valuable apex/corner -> `commercial_corner_fan`
- low-value triangle -> `park_absorb_irregular`
- hospitality/waterfront triangle -> `hospitality_iconic_wedge`

### 9. Detect Wedges

Wedge criteria:

```txt
4 sides where one side is tiny
or triangle with rounded/clipped apex
or tapered quadrilateral with one end much narrower than the other
```

Template implications:

- valuable wide end -> frontage ladder, taper to rear
- valuable long diagonal -> diagonal band
- valuable point -> iconic wedge/corner fan
- cheap point -> service/plaza/green absorption

### 10. Detect Trapezoids

Criteria:

```txt
4 dominant sides
one pair mostly parallel
other pair not parallel
convexity high
rectangularity medium/high
```

Template implications:

- commercial -> frontage band with varying parcel depth
- residential -> row/grid with one irregular margin
- industrial -> large pad aligned to longest/value side

### 10.5 Detect Angled Four-Sided Parcels

Four-sided parcels need more detail than "rectangle" versus "not rectangle." A high oriented-bounds fit does not mean the parcel has four right angles.

Subtypes:

```txt
rectangle:
  opposite sides parallel
  adjacent sides perpendicular
  high oriented-bounds fit

parallelogram:
  opposite sides parallel
  adjacent sides not perpendicular

trapezoid:
  one opposite side pair mostly parallel
  other pair not parallel

angled_frontage_quad:
  four dominant sides
  valuable frontage side is angled relative to side boundaries
  often has two clean/right-ish corners and two road-skewed corners

skewed_quad:
  high-fit four-sided parcel
  frontage/back relation is not clean enough for plain rectangle logic

irregular_quad:
  four dominant sides but no stable relation
```

Template implications:

- `rectangle` can use the strict rectangle frontage-band adapter.
- `parallelogram`, `trapezoid`, `skewed_quad`, and `angled_frontage_quad` should use an angled-quad frontage-band adapter.
- The angled-quad adapter uses the actual valuable frontage side as the front building line, not the oriented bounding box.
- Side seams are generated from frontage station lines and clipped to the parcel; they are not assumed to form right angles with every parcel boundary.
- `irregular_quad` should either use a conservative angled-quad adapter or absorb awkward areas into plaza/service/park space.

### 11. Detect Concave L/T/Courtyard Candidates

Concavity matters. A concave block should not be filled like a convex rectangle.

L-shape:

```txt
one strong concave notch
two rectangular lobes
missing-corner signature
```

T-shape:

```txt
one stem
one crossbar
center connection
```

Courtyard candidate:

```txt
large enough for internal open space
frontage value high
compactness moderate/high
one or more sides suitable for enclosing a court
```

Template implications:

- commercial new -> L/C court or podium/court
- hospitality -> courtyard hotel/resort/campus
- civic -> plaza/campus
- residential -> perimeter courtyard

### 12. Detect Curved Frontage

Criteria:

```txt
one dominant side is curved or slightly curved
curved side has high frontage value
usable depth behind curve
```

Template implications:

- commercial -> sampled curved frontage band
- hospitality -> waterfront/highway campus or crescent hotel
- residential -> curved perimeter block or towers with open frontage
- park -> promenade/green edge

Implementation note:

Curved frontage should be handled by stationing along the side polyline:

```txt
frontage station 0..length
front building line = inward offset side
parcel boundaries = normal rays at station divisions
rear line = offset side by desired depth
clip to buildable envelope
```

### 13. Detect Crescent

Criteria:

```txt
two long curved sides
elongated parcel
roughly consistent width
water/road on one or both curved sides
```

Template implications:

- hospitality -> crescent court/resort
- park -> waterfront promenade
- commercial -> sparse curved strip, not dense grid
- residential -> curved slab/tower sequence

### 14. Detect Bulged Rectangle

Criteria:

```txt
high-quality rectangular core can be fitted
one side or corner has excess bulge
bulge area is meaningful but not dominant
```

Template implications:

- use rectangle template for core
- use bulge as plaza, parking, landscape, small landmark, or secondary pad
- do not let bulge distort all parcel seams

### 15. Detect Pinched Irregular

Criteria:

```txt
two lobes connected by narrow waist
minimum cross-section much smaller than average width
concavity or curvature medium/high
```

Template implications:

- split into two sub-blocks
- use waist as open/service/access space
- if split confidence is low, fallback to park/open

### 16. Organic Blob Or Unclassified

Organic blob:

```txt
valid area
not too thin
no high-confidence simple family
could still support civic, park, landmark, hospitality, or sparse buildings
```

Unclassified:

```txt
metrics conflict
side grouping unstable
confidence low
usable core unclear
```

Fallback:

- `organic_blob` can route to park, civic, landmark, hospitality campus, or sparse layout.
- `unclassified` defaults to `park_open`.

## Template Hints

The classifier should emit hints, not final layout decisions.

```ts
export type LayoutTemplateHint =
  | 'frontage_band'
  | 'rotated_frontage_band'
  | 'curved_frontage_band'
  | 'diagonal_frontage_band'
  | 'flat_ladder'
  | 'corner_fan'
  | 'single_iconic_pad'
  | 'rear_service_yard'
  | 'rear_plaza'
  | 'parking_field'
  | 'courtyard'
  | 'split_lobes'
  | 'absorb_sliver_as_open'
  | 'fallback_park';
```

Hints are combined with zone/use:

```txt
shape hint frontage_band + commercial_new -> few large frontage parcels
shape hint frontage_band + commercial_old -> many skinny frontage parcels
shape hint courtyard + hospitality -> hotel court/campus
shape hint absorb_sliver_as_open + any use -> no sliver buildings
shape hint fallback_park -> park_open
```

## Template Router

Recommended router file:

```txt
services/playgame/city-map/layout-template-router.ts
```

Router input:

```ts
interface LayoutTemplateRouterInput {
  block: CityBlock;
  shape: ParcelShapeClassification;
  frontage: BlockFrontageAnalysis;
  profile: BuildingBlockProfile;
}
```

Router output:

```ts
export type LayoutTemplateId =
  | 'commercial_rectangle_frontage_band'
  | 'commercial_rotated_rectangle_frontage_band'
  | 'commercial_triangle_diagonal_band'
  | 'commercial_triangle_flat_ladder'
  | 'commercial_wedge_iconic'
  | 'commercial_curved_frontage_band'
  | 'commercial_crescent_court'
  | 'hospitality_waterfront_campus'
  | 'hospitality_courtyard_resort'
  | 'hospitality_iconic_wedge'
  | 'industrial_long_service_strip'
  | 'residential_quiet_grid'
  | 'residential_courtyard_block'
  | 'civic_plaza_campus'
  | 'park_absorb_irregular'
  | 'infrastructure_service_sliver'
  | 'fallback_open_block';

interface LayoutTemplateChoice {
  template: LayoutTemplateId;
  confidence: number;
  reasons: string[];
}
```

Router examples:

```txt
commercial_new + rectangle
  -> commercial_rectangle_frontage_band

commercial_new + rotated_rectangle
  -> commercial_rotated_rectangle_frontage_band

commercial_new + triangle + valuable longest side
  -> commercial_triangle_diagonal_band

commercial_new + triangle + valuable flat side
  -> commercial_triangle_flat_ladder

commercial_new + wedge + valuable apex
  -> commercial_wedge_iconic

hospitality_new + curved_frontage + waterfront/highway
  -> hospitality_waterfront_campus

hospitality_new + courtyard_candidate
  -> hospitality_courtyard_resort

industrial + long_strip
  -> industrial_long_service_strip

unclassified + low confidence
  -> park_absorb_irregular
```

## Debug UI

The Planning debug hover is the primary inspection surface for this system.

Rule:

```txt
When the Planning debug toggle is on, hovering any buildable plot must show how that plot was identified and why that identification routed to its selected template.
```

This is not optional debug garnish. Shape classification will be impossible to tune from screenshots unless the hover tells us what the classifier believed.

Planning tooltip should show:

```txt
shape triangle / point_se
shape confidence 82%
template commercial_triangle_diagonal_band
primary side HIGHWAY / curved no
cheap side SERVICE
awkward rear_triangle -> service_yard
fallback none
```

Minimum debug fields:

- shape family
- orientation
- confidence
- selected template
- fallback reason
- primary frontage side
- awkward remainder count
- shape reasons, limited to the top two or three short strings

Suggested `CityMapBoard` tooltip fields:

```txt
shape {shapeFamily} / {shapeOrientation} / {confidence}
template {selectedTemplate}
fallback {shapeFallbackReason}
why {shape.reasons[0]}
```

If the plot is unclassified, the tooltip must make that visible:

```txt
shape unclassified / unknown / 31%
template park_absorb_irregular
fallback unclassified-low-confidence-park
why side grouping unstable
```

If the plot is converted to park/open/service because the shape was bad, the tooltip should still appear on hover. The point is to show that the system intentionally absorbed the bad parcel instead of silently failing to generate buildings.

Planning hover outline rule:

- Do not blindly smooth the whole plot polygon for hover.
- Hard corners must remain hard.
- Only boundary runs that were generated as smoothed/curved runs should render as curved in the hover outline.
- If side-level smoothing metadata is unavailable, use the raw polygon path for hover rather than applying global smoothing.
- Future fix: store a display boundary on the block, e.g. `block.displayPath` or `block.shape.sides[].displayPath`, so hover/debug, SVG, and Three can inspect the same partially-smoothed parcel boundary.

## Acceptance Rules

### Classifier Acceptance

- Axis-aligned rectangles and rotated rectangles classify separately.
- Triangle orientation is stable under rotation and flipping.
- Curved frontage blocks preserve curve information as sides.
- Slivers and tiny parcels classify before commercial layout routing.
- Concave blocks do not classify as simple rectangles only because their oriented bounding box fits.
- Unclassified low-confidence blocks do not route to commercial building templates.

### Layout Pipeline Acceptance

- No `commercial_new` template should accept tiny triangle/sliver footprints as normal buildings.
- A low-confidence shape can become green/open space without being considered a failure.
- Template choice is explainable from `shape + frontage + zoning`.
- Tooltip can answer why a block became park/open instead of buildings.

### Renderer Acceptance

- Renderer consumes block bases and building polygons; it does not infer shape family.
- Shape classification is used before building generation, not during rendering.
- Curved/sampled parcel boundaries stay in `CityBlock.polygon` and `block.shape.sides`.

## Implementation Phases

### Phase 1: Classification Data Only

- Add `parcel-shapes.ts`.
- Add core types.
- Implement polygon normalization and basic metrics.
- Attach `block.shape` in `buildStaticBuildings`.
- Copy summary fields into `block.planning`.
- Add debug tooltip fields.
- Do not change building templates yet, except for unclassified/tiny/sliver fallback to park/open.

### Phase 2: Template Router

- Add `layout-template-router.ts`.
- Route existing commercial-new path through a template id.
- Add fallback for `unclassified`, `tiny`, and `sliver`.
- Keep current generator as fallback only for known-safe rectangles.

### Phase 3: Rectangle And Rotated Rectangle Solvers

- Implement commercial rectangle frontage-band solver.
- Implement rotated rectangle using the same local frame.
- Add hospitality rectangle/courtyard policy.
- Reject sliver buildings in `new` commercial/hospitality.

### Phase 4: Triangle And Wedge Templates

- Implement triangle template family:
  - diagonal frontage band
  - flat frontage ladder
  - corner fan
  - single iconic wedge
  - cheap sliver/open absorption
- Implement wedge variants.

### Phase 5: Smoothed Irregular Templates

- Implement curved frontage band.
- Implement crescent/campus templates.
- Implement bulged rectangle core-plus-bulge.
- Implement pinched split-lobe routing.

## Non-Goals

- This classifier is not a GIS-grade cadastral engine.
- It does not need perfect computational geometry for every possible polygon.
- It should prefer a clean fallback park/open result over a bad building result.
- It should not place buildings.
- It should not mutate road or terrain geometry.

## Key Rule

Do not make one universal building layout algorithm.

Classify the parcel first. Choose a template second. Generate buildings third.

When classification fails, make the block green/open/service instead of forcing ugly buildings.
