# Tensor Frontage-Aware Building Layout Spec

## Goal

Replace the current one-size-fits-all recursive building subdivision with a frontage-aware lot layout pass.

The city should read as intentional:

- important streets attract important frontage
- waterfront land is valuable and should not behave like leftover scraps
- ordinary blocks should be less mechanically packed
- fill-in parcels should be less random and more street-oriented

The core rule:

```text
building layout follows the best available frontage
```

## Non-Goals

- Do not rewrite tensor road generation.
- Do not change the 2D or 3D building renderer in this pass.
- Do not add zoning simulation yet.
- Do not make every parcel dense.
- Do not remove existing `PolygonFinder` until the new path is visually stable.

## Current Problem

Building generation currently has two different inputs but one generic splitter.

Regular road blocks:

```text
roads
-> Graph
-> PolygonFinder closed faces
-> shrink
-> recursive longest-side subdivision
```

Parcelized fill-in blocks:

```text
land - water - blocked areas
split by roads
-> buildable parcels
-> shrink
-> recursive longest-side subdivision
```

The recursive splitter has no concept of street importance, water value, or parcel frontage. It only knows:

- polygon area
- longest side
- random split point between 40% and 60%
- chance to leave a polygon undivided

That creates two visual failures:

- regular city blocks become overly packed and repetitive
- repaired/fill-in parcels become random, sparse, or awkward because they often have odd shapes

## Design Principle

Parcelization should answer:

```text
where can buildings exist?
```

Frontage-aware layout should answer:

```text
which edge should these buildings face, and how intense should development be?
```

Those should be separate steps.

## Frontage Priority

Street size means street importance.

Waterfront is also high-value frontage.

Initial frontage scoring:

```ts
export type FrontageKind =
  | 'main-road'      // yellow street
  | 'waterfront'     // river, coast, canal, harbor edge
  | 'major-road'     // big white street
  | 'minor-road'     // small white street
  | 'park'
  | 'internal'
  | 'unknown';

export const FRONTAGE_SCORE: Record<FrontageKind, number> = {
  'main-road': 100,
  'waterfront': 90,
  'major-road': 70,
  'minor-road': 45,
  'park': 35,
  'internal': 15,
  'unknown': 5,
};
```

This ordering is intentional:

```text
yellow street > waterfront > big white street > small white street > park/internal edge
```

Waterfront should score above major roads because waterfront property is usually premium land. Main/yellow roads remain the highest score because they are the strongest city-structure signal and should keep reading as civic/commercial corridors.

## Data Model

Add frontage metadata to buildable parcels.

```ts
export interface ParcelFrontage {
  kind: FrontageKind;
  score: number;
  edge: [Vector, Vector];
  sourceId?: string;
  sourceRoadClass?: 'main' | 'major' | 'minor' | 'bridge';
  length: number;
}

export interface BuildableParcel {
  polygon: Vector[];
  frontages: ParcelFrontage[];
}
```

The existing parcelizer may continue to return `Vector[][]` during transition, but the target contract should become:

```ts
export interface BuildableParcelizerResult {
  parcels: BuildableParcel[];
  stats: BuildableParcelizerStats;
}
```

## Frontage Detection

For each parcel edge, classify nearby source geometry.

### Road Frontage

When a parcel edge lies near or overlaps a road edge, classify it by road class:

- `main` -> `main-road`
- `major` -> `major-road`
- `minor` -> `minor-road`
- `bridge` -> use the bridge's source road class

Road class must be preserved when building planar parcel edges. Avoid throwing away class information in `buildable_parcelizer.ts`.

### Waterfront Frontage

When a parcel edge lies near:

- island coastline
- river polygon edge
- canal polygon edge
- harbor/ocean boundary

classify it as `waterfront`.

Waterfront must not mean "build into water." It means the parcel edge faces water and should receive premium frontage behavior after the buildable land has already been clipped safely.

### Multiple Frontages

A parcel can have multiple frontages. Choose the primary frontage by:

1. highest score
2. longer edge length as tie-breaker
3. road frontage over internal edge as final tie-breaker

Secondary frontages should still influence corner lots later.

## Layout Behavior By Frontage

### Main Road Frontage

Yellow roads should create the most orderly, valuable frontage:

- larger buildings
- fewer tiny subdivisions
- low vacancy
- strong alignment to the road edge
- occasional larger anchor buildings

Suggested tuning:

```ts
minLotDepth: 18-28
lotWidthRange: 18-45
mergeChance: 0.18
gapChance: 0.03
setback: 3-5
```

### Waterfront Frontage

Waterfront should be valuable, but less rigid than main roads:

- medium-to-large lots
- more spacing and setbacks
- occasional larger waterfront parcels
- fewer tiny buildings
- layout follows the water-facing edge when no stronger road frontage exists

Suggested tuning:

```ts
minLotDepth: 20-36
lotWidthRange: 22-60
mergeChance: 0.22
gapChance: 0.08
setback: 5-9
```

### Major Road Frontage

Big white streets are strong but less dominant than yellow roads:

```ts
minLotDepth: 16-28
lotWidthRange: 16-38
mergeChance: 0.12
gapChance: 0.05
setback: 3-6
```

### Minor Road Frontage

Small white streets should produce smaller, more residential-scale lots:

```ts
minLotDepth: 10-22
lotWidthRange: 10-28
mergeChance: 0.06
gapChance: 0.08
setback: 2-5
```

### Internal / Unknown Frontage

Unknown edges should be conservative:

- avoid dense random scatter
- use one or two simple buildings if the parcel is small
- leave very awkward slivers empty
- prefer fallback recursive subdivision only for compact polygons

## Proposed Algorithm

### Phase 1: Metadata Plumbing

Preserve road class through parcelization.

Current shape:

```ts
roadPolylines: Vector[][]
```

Target shape:

```ts
export interface ClassifiedPolyline {
  id: string;
  kind: 'road' | 'bridge' | 'waterfront';
  roadClass?: 'main' | 'major' | 'minor';
  points: Vector[];
}
```

`MainGUI.parcelizeIslandBuildableLand()` should pass main, major, minor, bridge, river, and coastline sources separately or as classified inputs.

### Phase 2: Parcel Frontage Assignment

After faces are extracted:

1. iterate parcel boundary edges
2. find nearby classified source edges within an epsilon
3. assign frontage kind and score
4. attach sorted `frontages` to each parcel

Use world-space geometry only. Do not use camera, zoom, screen coordinates, or CSS dimensions.

### Phase 3: Frontage-Oriented Lot Layout

Add a new pure geometry module:

```text
services/playgame/city-map/tensor/impl/frontage_lot_layout.ts
```

Initial public contract:

```ts
export interface FrontageLotLayoutInput {
  parcels: BuildableParcel[];
  defaultMinArea: number;
  defaultShrinkSpacing: number;
}

export interface FrontageLotLayoutResult {
  lots: Vector[][];
  stats: {
    parcelCount: number;
    lotCount: number;
    usedFrontageCount: number;
    fallbackCount: number;
    rejectedSliverCount: number;
    ms: number;
  };
}

export function generateFrontageLots(input: FrontageLotLayoutInput): FrontageLotLayoutResult;
```

Layout strategy:

1. shrink parcel inward by frontage-specific setback
2. choose primary frontage edge
3. project parcel into a local coordinate system:
   - `u`: along frontage
   - `v`: inward from frontage
4. generate one or more rows of lots along `u`
5. clip generated lot rectangles back to the parcel polygon
6. reject tiny/sliver lots
7. use fallback recursive subdivision only when frontage cannot be determined

## Visual Acceptance Criteria

Regular blocks should:

- no longer look maximally packed by default
- still have enough density to read as city blocks
- include occasional larger buildings and occasional lightly used lots

Fill-in parcels should:

- align to nearby streets or water
- avoid random postage-stamp scatter
- avoid giant empty buildable regions
- avoid buildings crossing roads/water

Waterfront should:

- visibly support buildings when parcel width allows
- prefer larger, cleaner lots than minor streets
- avoid tiny chaotic buildings along coast/river edges

Main/yellow streets should:

- feel like premium corridors
- get the strongest, most coherent frontage
- not be overwhelmed by tiny residential-scale splitting

## Implementation Plan

### Slice A: Classify Inputs

- Add `ClassifiedPolyline`.
- Pass road class into the parcelizer.
- Preserve source edge IDs through planar face extraction where possible.
- Add waterfront source edges from river/coast polygons.

### Slice B: Attach Frontage Metadata

- Add `BuildableParcel`.
- Return both polygon and frontage metadata from parcelization.
- Add debug profiler stats for frontage classification:
  - parcels with main frontage
  - parcels with waterfront frontage
  - parcels with major/minor frontage
  - fallback/unknown parcels

### Slice C: New Lot Layout

- Add `frontage_lot_layout.ts`.
- Use it only for parcelized island buildings first.
- Keep current `Buildings.generate()` for non-island maps.
- Keep current recursive subdivision as fallback.

### Slice D: Unify Regular Blocks

Once island results look stable, convert regular `PolygonFinder` block output to `BuildableParcel` with frontage metadata too.

At that point both regular blocks and fill-in blocks use the same lot layout system.

## Risks

- Overfitting to one visual sample: mitigate with seeded screenshots across map shapes and sizes.
- Waterfront over-density: tune waterfront gap/setback separately from road frontage.
- Edge classification noise: use snap epsilon and length thresholds to avoid tiny accidental frontage fragments.
- Performance: keep frontage detection bbox-indexed or edge-indexed if naive nearest-edge checks become expensive.

## Debug Controls

Eventually add debug toggles:

- show parcel frontages
- color frontage by class
- show primary frontage edge
- show fallback parcels
- show lot row direction

These should go in the existing tensor debug panel after the generation algorithm is stable.

## Success Criteria

- Regular blocks are less uniformly packed.
- Fill-in parcels are less random.
- Waterfront land is used when it is physically buildable.
- Yellow streets produce the strongest visible development pattern.
- Big white streets and small white streets produce different scales of lot layout.
- The building pass remains deterministic for the same seed.
