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

## Block Ground Plane Rule

Every plot type is rendered and planned as a block-owned parcel, not as buildings floating directly on global terrain.

Each buildable block owns a dark block ground plane:

- The block ground plane uses the block polygon.
- Buildings are placed on top of that block ground plane.
- Roads, bridges, rivers, and water bodies remain separate network/terrain geometry.
- Building-road separation should come from parcel/block geometry and building setback rules, not from renderer outlines.
- Commercial, residential, industrial, civic, park, landmark, hospitality, infrastructure, and mixed-use plots all follow this rule.

This applies to rectangular, rotated, diagonal, curved, waterfront, river-adjacent, and irregular blocks. For curved rivers and curved roads, the rule is still valid as long as the block polygon carries enough sampled points to represent the curved boundary. If a block boundary is stored as a coarse straight chord while the road or river is visibly curved, the geometry contract is wrong; the renderer should not hide that mismatch with screen-space outlines.

Renderer layering should read as:

```txt
terrain/water -> block ground planes -> roads/rivers/bridges -> buildings -> labels/debug overlays
```

The block ground plane is the visual separator between building footprints and adjacent road/water networks. Buildings can still use zone-specific setbacks, yards, courts, service space, and frontage behavior, but they should always sit on their block's own parcel ground.

## Block Profile

Each block receives:

- `zone`: land-use family, such as `residential`, `commercial_retail`, `commercial_office`, `hospitality`, `industrial`, `civic_public`, `park_open`, `infrastructure_service`, `landmark`, or `mixed_use`
- `age`: `new`, `average`, `old`
- `frontage`: the highest-value road edge or connected edge group
- `subdivisionFlavor`: the layout strategy chosen from zone, age, and frontage value

## Land-Use Families

The generator should not collapse all non-residential activity into one `commercial` bucket. Different land uses respond to valuable frontage in different ways.

### Residential

Purpose:

- housing
- apartments
- row homes
- residential towers
- mixed-density neighborhoods

Frontage behavior:

- valuable frontage may become yard, garden, courtyard, formal setback, entry court, promenade, or view corridor
- buildings do not always push to the expensive street
- high-value residential can look spacious rather than maximally filled

Shape behavior:

- can use repeated small lots, apartment bars, courtyards, towers, gardens, and leftover spaces
- old residential can be loose and irregular
- new residential can be organized but still allow open space

### Commercial Retail

Purpose:

- storefronts
- shops
- restaurants
- bars
- markets
- street-facing services

Frontage behavior:

- valuable frontage is direct money
- buildings should usually face the expensive street
- corners are highly valuable
- old retail fragments frontage into many small tenants

Shape behavior:

- new retail may become mall/podium/pad development
- average retail has medium repeated frontage
- old retail has skinny frontage and messy rear additions

### Commercial Office

Purpose:

- office blocks
- corporate buildings
- clinics
- business towers
- clean mixed-use slabs

Frontage behavior:

- values major roads, transit, prestige, and visibility
- may use plazas, entry courts, or setbacks on expensive streets
- less storefront-obsessed than retail, but still needs clear access

Shape behavior:

- cleaner, larger, more regular than retail
- can use podiums, office slabs, towers, plazas, and parking/service courts

### Hospitality

Purpose:

- hotels
- resorts
- inns
- casinos
- convention lodging
- luxury destination blocks

Frontage behavior:

- behaves partly like residential and partly like commercial
- may put lawn, garden, drop-off loop, pool deck, plaza, or formal setback on the most valuable side
- still needs legible access, arrival, and service

Shape behavior:

- can be huge or small
- can consume an entire block
- can be a long hotel bar, tower/podium, courtyard hotel, resort block, or tiny old hotel
- may use open space as a feature, not waste

### Industrial

Purpose:

- warehouses
- factories
- logistics
- port/rail/service yards
- maintenance depots
- production sheds

Frontage behavior:

- favors access more than prestige
- values highways, service roads, rail/port edges, and cheap large parcels
- does not need attractive storefront frontage

Shape behavior:

- favors big, long, simple buildings
- long sheds, warehouses, loading yards, service courts
- should cluster strongly with other industrial/service blocks
- frontage may be dominated by driveways, yards, loading, and fences

### Civic Public

Purpose:

- schools
- hospitals
- government buildings
- transit hubs
- plazas
- public institutions

Frontage behavior:

- can claim high-value frontage for symbolic presence or access
- may use plazas, setbacks, lawns, and formal entries

Shape behavior:

- can override economic subdivision
- often includes planned open space

### Park Open

Purpose:

- parks
- plazas
- buffers
- waterfront open space
- pocket parks
- courtyards
- leftover public land

Frontage behavior:

- does not obey normal same-zone inertia
- can appear as an intentional interrupt between zones
- can occupy expensive or cheap land depending on civic/planning intent

Shape behavior:

- can absorb awkward leftovers
- can buffer incompatible zones
- can create breathing room inside dense districts

### Infrastructure Service

Purpose:

- utilities
- substations
- maintenance yards
- parking/service lots
- transit support
- loading/support facilities

Frontage behavior:

- values access and adjacency, not beauty
- often appears near industrial, highways, rail/service roads, or behind commercial blocks

Shape behavior:

- can occupy awkward or low-prestige parcels
- can use yards, pads, long sheds, and fenced service zones

### Landmark

Purpose:

- unique memorable blocks
- arenas
- casino resorts
- megastructures
- civic monuments
- signature towers

Frontage behavior:

- can override normal zoning economics
- should still orient to major value edges unless intentionally anti-grid

Shape behavior:

- may consume whole blocks
- may ignore normal subdivision

### Mixed Use

Purpose:

- residential over retail
- office/hospitality podiums
- street-facing retail plus towers
- hybrid urban blocks

Frontage behavior:

- street-level frontage behaves like retail/commercial
- upper/deeper block behavior can behave like residential, office, or hospitality

Shape behavior:

- podiums, towers, courtyards, and frontage strips are all valid

## Zone Inertia And Zone Change

Land use has inertia. Residential districts should produce mostly residential blocks. Commercial districts should produce mostly commercial blocks. Industrial districts should produce mostly industrial/service blocks. Parks are an exception: they can interrupt, buffer, or absorb leftover space.

Each district should start with a dominant zone mix:

```txt
old core        -> commercial_retail + residential + hospitality
waterfront      -> hospitality + commercial_retail + park_open
highway corridor -> commercial_office + hospitality + industrial + infrastructure_service
interior grid   -> residential
backland/edge   -> industrial + infrastructure_service
civic center    -> civic_public + park_open + landmark
```

Then each block scores candidate zones from district identity, neighboring zones, road hierarchy, shape, and seeded mutation:

```txt
zone_score =
    district_affinity
  + neighbor_inertia
  + road_pressure
  + shape_pressure
  + planned_exception
  + seeded_variation
```

### Neighbor Inertia

Blocks should usually continue the land use around them:

- same-zone neighbor across local/minor street: strong inertia
- same-zone neighbor across major road: medium inertia
- same-zone neighbor across highway, rail, river, coast, or hard barrier: weak inertia
- same-zone neighbor inside same district cell/cluster: very strong inertia

Suggested continuation chance before road/shape overrides:

```txt
same cluster / same local grid: 80-90%
across minor street:           70-85%
across medium/major street:    45-70%
across highway/hard barrier:   10-35%
```

These are not hard random switches. They are weights. Road pressure and shape pressure can overpower them.

### Zone Change Triggers

Land use can change when a strong urban force appears:

- major road or highway frontage
- transit/bridge/route node
- waterfront/coastal road
- industrial access edge
- very large or very long block
- unusually small leftover block
- adjacency to park/civic/landmark
- boundary between districts
- planned mutation for variety

Suggested mutation/switch pressure:

```txt
minor local variation:        0-10%
major road frontage:         20-40%
highway / transit node:      35-60%
waterfront / scenic edge:    25-55%
industrial service edge:     30-60%
district boundary:           25-50%
park/civic planned interrupt: special override
```

### Shape Pressure

Block shape should influence zone selection:

- big/long/simple blocks bias `industrial`, `commercial_office`, `hospitality`, or `landmark`
- small skinny high-frontage blocks bias `commercial_retail` or old commercial
- interior square/quiet blocks bias `residential`
- awkward leftovers bias `park_open`, `infrastructure_service`, old residential, or old retail
- waterfront/high-value large blocks bias `hospitality`, `landmark`, or park/open civic use

### Park Exception

Parks do not need same-zone continuity. They can appear as:

- planned civic interruption
- waterfront amenity
- neighborhood park
- plaza inside commercial/hospitality
- buffer between industrial and residential
- leftover odd space
- central courtyard/common area

Parks should not be treated as a normal district-spreading land use.

## Commercial Age Rule

For commercial retail and most commercial office blocks, age is primarily expressed through how many times the most expensive frontage is divided.

This is the key rule:

- `commercial_new`: few frontage divisions
- `commercial_average`: medium frontage divisions
- `commercial_old`: many frontage divisions

New commercial does not mean many small packed buildings. It means consolidated, expensive, planned real estate. A corporate campus, mall, office slab, retail podium, or convention/commercial center may take an entire block and run from one end of the expensive side to the other.

Old commercial does not mean inefficient frontage. It means fragmented frontage: many small tenants, bars, clinics, pawn shops, old arcades, and back-lot additions.

## Rectangle-First Commercial Baseline

Rectangular and near-rectangular commercial blocks are the foundation of the zoning system. They must work before triangle, trapezoid, coastline, corner, or multi-frontage templates are trusted.

A rectangular commercial block should never look like random buildings centered in empty lots. It should read as planned land use.

Baseline rectangle pipeline:

1. Rank all road-facing sides by road value.
2. Choose the highest-value side as the primary frontage.
3. Build a local planning frame from that frontage:
   - `u`: parallel to the expensive road
   - `v`: inward from the expensive road
4. Apply the global commercial setback from every road-facing side.
5. Divide the primary frontage according to commercial age.
6. Place primary frontage buildings first.
7. Fill the rear/interior using the same planning frame.
8. Use leftover space only for explicit service, plaza, public, parking, or secondary structures.

Rectangle quality rules:

- Building fronts on the expensive side must be parallel to that side.
- Frontage setback must be visually constant across the entire city.
- Gaps between commercial buildings should be small and intentional.
- Buildings should occupy whole grid cells or merged grid cells.
- Commercial new should not scatter many unrelated small rectangles.
- Commercial average should show a medium repeated rhythm.
- Commercial old should show many narrow storefronts and varied depths.
- A rectangle can be rotated; the logic must still work in the frontage-local frame.
- The generator should not use generic centered random placement for commercial rectangles.

### What Valuable Frontage Means By Zone

Valuable frontage does not mean the same thing for every land use.

Commercial uses valuable frontage for direct monetization:

- storefronts
- office entries
- retail pads
- corporate frontage
- signage and pedestrian access

So commercial buildings should usually put building faces close to the most expensive street, with a consistent commercial setback.

Residential uses valuable frontage for prestige, access, view, privacy, and livability:

- front yards
- gardens
- courtyards
- setbacks
- promenades
- view corridors
- apartment entries
- high-status frontage units

So expensive residential may intentionally put yard, garden, courtyard, or setback space on the most valuable side. That is not wasted space if the block reads as residential. The key difference is:

- commercial monetizes the expensive edge with building/storefront frontage
- residential can monetize the expensive edge with open space, setback, view, and prestige

### Commercial Rectangle Age Gradient

Commercial age mainly changes how the expensive side is divided.

#### Commercial New Rectangle

Frontage behavior:

- few divisions on the highest-value side
- usually `1-3` primary frontage parcels
- larger units on expensive frontage
- may use one building for most or all of the block
- may merge multiple grid cells into a mega-building

Interior behavior:

- organized podium, service court, plaza, parking, C-shape court, L-shape court, or support pads with explicit access
- high coverage
- minimal wasted space
- visual rhythm should feel corporate, planned, and expensive
- no orphan middle buildings with no road, court, spine, or service access

Expected look:

- corporate slabs
- malls
- convention centers
- mixed-use podiums
- big clean rectangles or clean merged rectangles
- C-shaped or L-shaped developments around parking/service/plaza space
- frontage buildings with back-side service courts, not isolated middle buildings

#### Commercial Average Rectangle

Frontage behavior:

- medium divisions on the highest-value side
- usually `3-7` primary frontage parcels
- medium-sized units
- repeated but not perfectly uniform

Interior behavior:

- rear service alley or shared access if space allows
- secondary buildings can be smaller
- some variation, but still organized

Expected look:

- several office blocks
- medium retail pads
- mixed-use strips
- small plazas or parking/service spaces

#### Commercial Old Rectangle

Frontage behavior:

- many divisions on the highest-value side
- usually `7-16+` primary frontage parcels
- narrow storefronts
- smaller frontage units
- uneven widths are allowed

Interior behavior:

- depths can vary strongly
- back-lot additions are common
- service access may be broken or partial
- rear buildings can feel accumulated

Expected look:

- tiny shops
- pawn shops
- bars
- clinics
- noodle shops
- markets
- messy additions behind a dense frontage strip

Rectangle implementation rule:

Commercial new, average, and old may share the same global setback, but they must not share the same frontage subdivision count. The visual difference between them should be obvious from parcel size alone.

## Commercial New

Intent:

- expensive planned development
- few frontage parcels
- large buildings
- high land utilization
- low visual randomness
- consistent setback from the expensive road

Typical forms:

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
- Interior space should be organized as access-supporting space: service court, parking deck, plaza, C-shape court, L-shape court, loading/service yard, or secondary tower with an explicit access path.
- Avoid standalone middle buildings that have no street frontage, driveway, service spine, court, or plaza connection.
- If an interior building exists, it must explain its access visually.

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

- several office blocks
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

Residential does not maximize expensive frontage the way commercial does. It can value the best street by creating better front yards, gardens, courtyards, entries, views, and prestige space.

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
- may place front yards or formal setbacks on high-value frontage
- may insert parks, courtyards, promenades, or view corridors
- may pull buildings back from the valuable street if that improves residential character
- old residential may fail to exploit frontage fully

## Hospitality Behavior

Hospitality should not be treated as generic commercial. Hotels and resorts are access-driven like commercial, but frontage and open space can behave more like residential prestige space.

General intent:

- arrival matters
- view and prestige matter
- open space can be a feature
- building size can range from tiny to block-consuming
- access, drop-off, and service must be legible

### Hospitality New

- can consume an entire block
- can be a huge resort, convention hotel, tower podium, or casino/hotel complex
- may use lawn, pool, plaza, garden, drop-off loop, or formal setback on the most valuable side
- may form C-shapes, L-shapes, courtyard hotels, or podium/tower structures
- should have clear arrival and service logic

### Hospitality Average

- medium hotels
- mixed frontage and setback behavior
- may use parking/drop-off/service courts
- can share block space with retail or office

### Hospitality Old

- small hotels
- inns
- micro-hotels
- older lodging above retail
- tighter frontage and irregular back areas

Hospitality expensive-side behavior:

- may place building face near valuable frontage if retail/casino/convention-like
- may pull building back for lawn, driveway, drop-off, garden, pool, or plaza
- may occupy huge or small parcels depending on age and road/water value
- should not create inaccessible interior buildings

## Industrial Behavior

Industrial should not be treated as commercial storefront real estate. It is access, loading, production, and logistics first.

General intent:

- big or long buildings
- loading yards
- service courts
- cheap/access-heavy land
- simple shapes
- strong clustering with industrial and infrastructure service

### Industrial New

- large warehouses
- long logistics sheds
- production plants
- organized truck yards
- clean access roads
- big repeated rectangles

### Industrial Average

- medium warehouses
- mixed sheds and yards
- shared loading/service space
- moderate organization

### Industrial Old

- older sheds
- workshops
- irregular service yards
- patched additions
- messy access but still access-driven

Industrial expensive-side behavior:

- values highways, service roads, rail, port, and industrial access edges
- does not need pretty storefront frontage
- may put yards, loading, fences, and driveways on the road side
- favors long buildings parallel or perpendicular to access roads
- should rarely use tiny decorative buildings in the middle of a block

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

## Triangle / Wedge Block Templates

Odd-shaped blocks should not be treated as one generic failure case. A triangle, trapezoid, or one-sided wedge can usually be solved by asking one question first:

Which side is expensive?

The answer determines where the clean subdivision goes, where the odd geometry is allowed to live, and whether the leftover space should become a building, park, service area, plaza, or common yard.

### Template A: Flat-Side Frontage Ladder

Best when:

- the expensive side is a mostly flat side
- the opposite side is also reasonably parallel
- the wedge distortion is mild

Behavior:

- subdivide parallel to the expensive side
- keep building fronts at the global commercial setback
- allow parcel depth to vary as the wedge narrows or widens
- strongest default for commercial average and commercial old wedge blocks

This is the "normal city lot" answer: the valuable side is clean, and the weirdness is absorbed in depth.

### Template B: Diagonal Frontage Band

Best when:

- the expensive side is the diagonal or angled side
- the angled side is a highway, major road, or coastal road
- the block has a cleaner cheap backside

Behavior:

- make the primary building band parallel to the diagonal frontage
- keep every frontage building exactly `GLOBAL_COMMERCIAL_SETBACK` from that road
- divide the expensive diagonal frontage according to commercial age
- commercial new uses few large divisions
- commercial average uses medium divisions
- commercial old uses many skinny divisions
- use the rear remainder for cheaper secondary buildings, parking/service, public space, or back-lot structures

This is the important high-value odd-block case. If the diagonal road is expensive, the generator should not waste it with centered rectangles or unrelated orthogonal grids.

### Template C: Cheap Diagonal Remainder

Best when:

- the expensive side is flat
- the diagonal side is the cheapest or least important side
- the main usable block can be a clean rectangle or ladder

Behavior:

- use the flat expensive frontage with regular parallel lots
- push triangular leftover space to the cheap diagonal edge
- leftover can become a park, service yard, utility triangle, plaza, or one odd-shaped building
- commercial new may use the triangle as a deliberate signature building if the site is large

This template intentionally dumps weirdness into the least valuable side.

### Template D: Multi-Frontage Ring With Common Core

Best when:

- two or more sides are valuable
- no single side should consume the entire planning logic
- the block is commercial new, mixed-use, civic, or high-density residential

Behavior:

- create frontage bands along each valuable side
- each band obeys its own road angle and global setback
- leave a middle common zone
- the common zone can be courtyard, park, plaza, loading/service court, transit pad, or private amenity

This is the "every side matters" pattern. It is not wasted space if the interior is intentionally labeled as common/service/public space and the road-facing real estate is used well.

### Template E: Back-Diagonal Absorber

Best when:

- the diagonal side is the cheapest side
- one or two non-diagonal sides are more valuable
- the block should read as planned from the street

Behavior:

- subdivide clean frontage along the valuable flat sides first
- place secondary lots perpendicular or parallel to those valuable sides
- let the diagonal backside absorb all leftover distortion
- triangular remainder should usually be service, parking, utility, park, or low-value odd building

This is similar to Template C, but useful when there are multiple valuable non-diagonal sides.

### Template F: Corner-Priority Fan

Best when:

- the highest land value is concentrated at a corner
- two important roads meet
- the corner itself is more important than either side alone

Behavior:

- give the corner first claim
- place a flagship building, tower pad, hotel, transit node, or large commercial structure at the corner
- subdivide outward from that corner along both road faces
- remaining rear parcels can become smaller secondary buildings or service/common space

This solves wedge blocks where the prize is not a side, but an intersection. It should appear on commercial new, landmark, and major-road junction blocks.

### Triangle Template Selection Rules

1. Compute road value for every block side or frontage group.
2. If one side clearly dominates and is diagonal or curved, choose Template B.
3. If one side clearly dominates and is flat, choose Template A or C.
4. If the diagonal side is low value, choose Template C or E and put irregular remainder there.
5. If two adjacent high-value sides meet, choose Template F.
6. If three or more sides are valuable, choose Template D.
7. If no side is clearly valuable and the block is old residential or old commercial, allow hodgepodge accretion.
8. Commercial new should prefer A, B, D, E, or F over generic centered rectangles.

### Why This Solves Many Odd Blocks

Most "bad" odd-shaped blocks are not actually hard because they are odd. They are hard because the generator does not know which edge is allowed to be ugly.

These templates make that explicit:

- valuable side: clean, parallel, consistent setback, intentional frontage divisions
- cheap side: absorbs leftovers
- multi-value sides: wrap buildings and use the center intentionally
- corner-value sites: prioritize the corner before subdividing the rest

This should solve a large share of triangle, trapezoid, wedge, coastal, diagonal-road, and corner blocks without needing a unique algorithm for every shape.

## Procedural Pipeline

1. Analyze block
   - read block polygon
   - identify bordering road edges
   - compute weighted frontage score per road edge or connected edge group
   - mark highest-value side
   - compute block depth, area, aspect ratio, irregularity

2. Assign zone
   - choose from land-use families, not only commercial/residential/public
   - start from district dominant zone mix
   - apply neighbor inertia
   - weaken inertia across major streets, highways, water, rail, and district boundaries
   - apply road pressure from highest-value frontage
   - apply shape pressure from block size/aspect/access
   - allow park/open/civic planned exceptions

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
