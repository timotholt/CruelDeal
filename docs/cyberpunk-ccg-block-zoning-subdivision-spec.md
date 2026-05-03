# Cyberpunk CCG Block Zoning And Subdivision Spec

## Purpose

Define procedural rules for filling rectangular and irregular city blocks in the Cyberpunk CCG island/city generator.

The generator should not special-case "beachfront" or other scenic value directly. Land value comes from road hierarchy. Coastal roads are usually high-value roads, so coastal-facing blocks naturally become expensive frontage through the same rule system as any other major road.

## Core Model

Each block is a polygon bordered by road edges. Each bordering road edge has:

- road class
- road value weight
- direction/bearing
- edge length
- connectivity score

Suggested road value weights:

- `HIGHWAY`: `10`
- `MAJOR_ROAD`: `6`
- `MINOR_ROAD`: `3`
- `ALLEY` / `SERVICE`: `1`

The most expensive side of a block is the edge, or connected edge group, with the highest weighted frontage score:

```txt
edge_score = edge_length * road_value_weight
```

This side gets first claim on building placement.

## Block Profile

Each block receives:

- `zone`: `commercial`, `retail`, `residential`, `landmark`, `mixed_use`, `industrial_service`, `park_civic`
- `age`: `new`, `average`, `old`
- `frontage`: the highest-value road edge or connected edge group
- `subdivisionFlavor`: the layout strategy chosen from zone, age, and frontage value

The first implementation can focus on:

- `commercial`
- `residential`
- `public` / `landmark`

## Commercial Age Rule

For commercial blocks, age is primarily expressed through how many times the most expensive frontage is divided.

This is the key rule:

- `commercial_new`: few frontage divisions
- `commercial_average`: medium frontage divisions
- `commercial_old`: many frontage divisions

New commercial does not mean many small packed buildings. It means consolidated, expensive, planned real estate. A 2,000-room resort, corporate campus, mall, hotel slab, or convention center may take an entire block and run from one end of the expensive side to the other.

Old commercial does not mean inefficient frontage. It means fragmented frontage: many small tenants, bars, clinics, pawn shops, tiny hotels, old arcades, and back-lot additions.

## Commercial New

Intent:

- expensive planned development
- few frontage parcels
- large buildings
- high land utilization
- low visual randomness
- consistent setback from the expensive road

Typical forms:

- whole-block resort
- long hotel slab
- corporate block
- mall-like mass
- luxury mixed-use podium
- tower on podium
- convention center
- large trapezoid following an angled or curved frontage

Rules:

- Find highest-value frontage first.
- Divide that frontage into very few parcels, typically `1-3`.
- If the block is small or the road value is very high, allow a single building to consume most or all of the block.
- The building face along the expensive frontage must be parallel to that frontage.
- The setback from the road is a global commercial setback constant throughout the city.
- If the block fronts multiple roads, the footprint should respect the same commercial setback on every road-facing side.
- For curved or segmented frontage, use connected frontage groups rather than treating each tiny segment as unrelated.
- Prefer large clean shapes, but allow trapezoids, wedges, and irregular polygons when the parcel shape demands it.
- Interior space should be organized: service spine, support buildings, parking deck, plaza, or secondary tower.

Suggested parameters:

```txt
frontageDivisionCount = 1..3
frontageSetback = GLOBAL_COMMERCIAL_SETBACK
buildingDepth = high, often 1/2 block or full block
shapeRegularization = high
hodgepodgeNoise = low
serviceSpineProbability = high
landmarkProbabilityBonus = medium
```

## Commercial Average

Intent:

- planned but less consolidated
- medium parcels
- recognizable storefront or office rhythm
- moderate variety

Typical forms:

- several hotel/office blocks
- strip of mid-sized retail pads
- shared rear access
- mixed-use buildings along major roads

Rules:

- Divide highest-value frontage into a medium number of parcels, typically `3-7`.
- Use mostly regular geometry.
- Allow trapezoids on angled sides.
- Use a service alley or rear access line if block depth allows.
- Interior can contain smaller secondary buildings, parking, utility pads, or plazas.

Suggested parameters:

```txt
frontageDivisionCount = 3..7
frontageSetback = GLOBAL_COMMERCIAL_SETBACK
buildingDepth = medium
shapeRegularization = medium
hodgepodgeNoise = medium-low
serviceSpineProbability = medium
```

## Commercial Old

Intent:

- intense frontage usage
- many small tenants
- accumulated and physically messy
- less deep, less unified buildings

Typical forms:

- tiny storefronts
- pawn shops
- noodle shops
- clinics
- bars
- micro-hotels
- old arcades
- dense market streets
- back-lot sheds and additions

Rules:

- Divide highest-value frontage into many parcels, typically `7-16+`.
- Prefer narrow storefronts.
- Allow uneven parcel widths.
- Allow variable depths.
- Allow irregular backs and non-parallel rear edges.
- Service access can be partial, broken, or improvised.
- Interior should feel split, patched, and accumulated.

Suggested parameters:

```txt
frontageDivisionCount = 7..16+
frontageSetback = GLOBAL_COMMERCIAL_SETBACK with small variation allowed only on old blocks
buildingDepth = variable, often shallow
shapeRegularization = low
hodgepodgeNoise = high
serviceSpineProbability = low
```

## Residential Behavior

Residential does not always maximize expensive frontage the way commercial does.

General intent:

- more courtyards
- more parks
- more yards
- more haphazard interior space
- less brutal frontage monetization unless new/high-density

### Residential New

- large apartment blocks
- podium structures
- planned courtyards
- organized amenities
- efficient but less frontage-obsessed than commercial

### Residential Average

- medium apartments
- row housing
- shared parking
- small green spaces
- moderate organization

### Residential Old

- haphazard homes/apartments
- irregular interiors
- small alleys
- random gardens/courtyards
- leftover spaces
- inconsistent setbacks

Residential expensive-side behavior:

- may place premium units along high-value frontage
- may insert parks, courtyards, promenades, or view corridors
- old residential may fail to exploit frontage fully

## Landmark Behavior

Landmarks override normal economic subdivision.

Examples:

- mega-hotel
- casino
- corporate HQ
- arena
- cathedral-like data center
- monument plaza
- transit hub
- power station
- luxury resort
- arcology fragment

Rules:

- may consume an entire block
- may ignore lot subdivision
- may intentionally create plaza/open space
- should strongly consider highest-value road orientation
- should appear more often on highway/major-road blocks

Age variation:

- `new`: sleek, efficient, large, planned
- `average`: functional, expanded, partially modified
- `old`: historic, weird footprint, additions, chaotic service structures

## Subdivision Flavors

After zone and age are selected, choose a subdivision flavor.

### Iconic Edge Structure

Best for:

- `commercial_new`
- `landmark_new`
- luxury/highway blocks

Behavior:

- one large building follows the most expensive road edge
- rear area becomes support, service, secondary buildings, plaza, or tower pad
- shape may be trapezoidal or wedge-like if the edge is angled or curved

### Frontage Strip Subdivision

Best for:

- `commercial_average`
- `retail_average`

Behavior:

- expensive frontage is split into medium parcels
- rear service spine organizes the middle

### Skinny Tenant Frontage

Best for:

- `commercial_old`
- `retail_old`

Behavior:

- expensive frontage is chopped into many narrow parcels
- interior becomes irregular and hodgepodge

### Rectangular Backbone

Best for:

- blocks with one expensive angled/curved edge and one cleaner rear edge

Behavior:

- draw a straight internal division line
- front zone absorbs weird geometry
- rear zone becomes boxy support lots

### Courtyard / Park Insert

Best for:

- residential
- civic
- park-adjacent districts

Behavior:

- reserve interior or expensive-side void for courtyard, park, promenade, or shared amenity
- buildings wrap around it

### Hodgepodge Accretion

Best for:

- old zones

Behavior:

- start with a few initial lots
- randomly split, extend, merge, and add secondary structures
- produces organic accumulated messiness

## Procedural Pipeline

1. Analyze block
   - read block polygon
   - identify bordering road edges
   - compute weighted frontage score per road edge or connected edge group
   - mark highest-value side
   - compute block depth, area, aspect ratio, irregularity

2. Assign zone
   - highway frontage biases commercial, landmark, mixed-use
   - major road frontage biases commercial, retail, mixed-use
   - minor road frontage biases residential, small retail
   - interior low-access blocks bias residential, park, service

3. Assign age
   - old core biases old
   - expanded city biases average
   - reclaimed coast/corporate district/highway development biases new
   - random seed adds variation

4. Select subdivision flavor
   - based on zone, age, and road value

5. Place frontage buildings
   - highest-value frontage first
   - commercial age determines frontage division count
   - new commercial merges frontage
   - old commercial fragments frontage

6. Place service/internal structure
   - service spine
   - alley
   - courtyard
   - plaza
   - parking/service pad
   - pedestrian cut-through

7. Fill rear/interior
   - if rear is regular, use boxy lots
   - if old/hodgepodge, allow random splits
   - if residential, allow courtyards/parks
   - if landmark, allow intentional open space

8. Cleanup
   - merge tiny sliver buildings
   - delete impossible pads
   - snap nearly parallel lines
   - preserve weirdness for old districts
   - maintain access to every building

9. Score result

```txt
score =
    used_high_value_frontage * frontage_weight
  + buildable_area * area_weight
  + zone_fit_bonus
  + age_fit_bonus
  - inaccessible_building_penalty
  - excessive_sliver_penalty
  - over_ordered_old_zone_penalty
  - over_chaotic_new_zone_penalty
```

10. Output
    - building footprints
    - lot polygons
    - zone type
    - age type
    - road frontage class
    - service paths
    - parks/courtyards/plazas
    - debug metrics

## Debug Metrics

Each block should expose debug values:

- zone
- age
- chosen subdivision flavor
- highest-value frontage id/class
- frontage score
- frontage division count
- global commercial setback used
- generated building count
- high-value frontage utilization percentage
- total buildable area utilization percentage
- rejected parcel count
- sliver cleanup count
- fallback reason, if any

## Design Rules

1. Do not treat all frontage equally. Highway frontage dominates parcel logic.
2. Commercial age is mostly frontage subdivision count.
3. New commercial should look optimized, expensive, and consolidated.
4. Old commercial should look economically intense but physically messy.
5. Do not force rectangular buildings everywhere. Angled or curved expensive edges can justify trapezoids, wedges, and diagonal mega-structures.
6. Residential can waste space intentionally.
7. Landmarks can break economic rules.
8. A service spine can separate geometry systems: weird front, clean rear; clean front, support rear.
9. Age must be visible from footprint alone.

## Mental Model

Road hierarchy creates value.

Zone determines use.

Age determines subdivision style.

The most valuable side gets first claim.

The interior absorbs compromise.

For Cyberpunk CCG city generation:

- `HIGHWAY` = money edge
- `MAJOR_ROAD` = strong edge
- `MINOR_ROAD` = local edge
- `ALLEY` = support edge

New commercial says: "Use the land like a corporation designed it."

Old commercial says: "Every inch of expensive frontage became somebody's tiny business."

Residential says: "People live here, so space can become courtyards, parks, gardens, and messy leftovers."

Landmark says: "This block exists to be remembered."
