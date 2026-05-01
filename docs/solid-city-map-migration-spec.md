# SolidJS City Map Migration Spec

## Purpose

Move the new procedural city map renderer out of the browser-Babel prototype in `docs/test/cyberpunk ccg/` and into the main SolidJS application. The goal is not a one-file port. The goal is a typed, testable map system that can become the `NEW GAME` destination in the main app. Gameplay integration, card passing, drag/drop, scoring, replay, and any reused legacy engine contracts are later layers.

This is a plan only. Do not implement it as part of this spec.

## Current State

### Prototype Map

The active prototype runs at:

`docs/test/cyberpunk ccg/Nightrun CCG v3.html`

It loads browser globals and Babel-transformed scripts:

- `city-map-config-v3.js`
- `city-map-geometry-v3.js`
- `city-map-paths-v3.js`
- `city-map-land-v3.js`
- `city-map-water-v3.js`
- `city-map-terrain-v4.js`
- `city-map-v4-preview.jsx`
- `city-map-placement-v3.js`
- `city-map-partition-v3.js`
- `city-map-v35.js`
- `city-map-buildings-v3.js`
- `city-map-bridges-v3.js`
- `city-map-rules-v3.js`
- `city-map-routing-v1.js`
- `city-map-venues-v1.js`
- `game-v3.jsx`
- `styles-v3.css`
- `city-map-v3.css`

Important properties of the prototype:

- Generation and rendering are mixed through `window.*` globals.
- React is used only in the prototype UI and preview renderer.
- The gameplay prototype already has city slots, venues, hover popups, routing, districts, buildings, open spaces, water, bridges, and card placement dots.
- The city generator mutates/enriches data in a few places, especially routing and venue assignment.
- It is loaded outside Vite’s module graph, so there is no TypeScript validation, no normal bundling, and no app-level test coverage.

### Main App

The main app is SolidJS + Vite:

- Entry: `index.tsx`
- Routes: `router.tsx`
- Play shell: `components/screens/PlayScreen.tsx`
- Play board: `components/screens/play/PlayBoard.tsx`
- Board sizing: `components/screens/play/BoardSizer.tsx`
- Current lane maps: `components/screens/play/useLaneMaps.ts`
- Lane slots: `components/screens/play/LaneSlots.tsx`
- Location strip: `components/screens/play/LocationTile.tsx`
- Drag/drop: `components/screens/play/useDragDrop.ts`
- Engine view selectors: `services/playgame/view.ts`
- Engine state types: `services/playgame/engine/types/state.ts`
- Manifest location/card types: `services/playgame/engine/manifest/types.ts`
- Play styling: `src/styles/playgame.css`

The current `/play` layout is Marvel Snap style:

- top enemy row
- middle location row
- bottom player row
- three lanes, each lane with 4 enemy slots and 4 player slots
- static lane map overlays inserted by `setupLaneMaps()`

This old board design is conceptually abandoned. Do not delete the code, because it may still contain useful implementation pieces, content ideas, animation patterns, and rule concepts. But it should not guide the new product design. We are no longer making a Marvel Snap clone.

Gameplay is not designed yet. Do not treat the current engine, old board, card passing, fixed three-lane structure, fixed four-slot capacity, or lane scoring as final product requirements. The current city map demo is valuable because it demonstrates the mood, surface, hover behavior, venue slots, districts, and exploratory feel of the future game before the final gameplay concept exists. Preserve that demo-like flexibility during the Solid migration.

Conceptual direction:

- Lanes become districts.
- Fixed lane slots become variable venue slots.
- Districts can have different numbers and kinds of playable slots.
- Venues should matter as places: stores, hideouts, bridges, parks, malls, landmarks, towers, and future authored locations.
- Old card-rule concepts such as `on reveal`, `ongoing`, triggered effects, costs, power, modifiers, deck/hand/discard zones, and replay tooling may be reused.
- Old board structure, lane count, lane scoring, top/bottom lane rows, and Marvel Snap pacing are not requirements.

The main navigation `NEW GAME` button should launch the new city map design directly once the city map shell compiles and routes correctly.

The first app integration milestone is intentionally narrow:

- click `NEW GAME` in `components/navigation/HomeCommandBar.tsx`
- route to a Solid city map screen
- build successfully under Vite
- render the new city map design
- avoid card passing, card staging, district scoring, and gameplay-rule concerns until later

## Migration Principles

- Keep generation pure and renderer-only state separate from future gameplay state.
- Do not import `window.CityMap*` globals into the app.
- Do not keep React in the final map renderer.
- Do not wire the city map directly into the legacy engine until the app can build, route, and render the new map shell, and only reuse engine pieces if they fit the new design.
- Treat card passing, card staging, turn flow, scoring, and district-resolution rules as later design milestones.
- The first Solid route can be a visual city board with generated venue slots and no playable cards.
- The old board can remain in source as a fallback/debug reference, but `NEW GAME` should launch the city map design.
- Do not preserve fixed lanes as a product constraint. Any compatibility layer must be temporary and clearly labeled legacy.
- Maintain determinism: city seed must derive from explicit route/debug/scenario state, not `Date.now()` or `Math.random()`.
- The first Solid integration should be easy to back out, but it does not need to hide behind the old board if the product decision is that `NEW GAME` means the new map.
- The prototype can remain as a visual lab until the Solid renderer reaches parity.

## Target Architecture

### New Main-App Modules

Create a proper city map package under `services/playgame/city-map/`:

```text
services/playgame/city-map/
  config.ts
  geometry.ts
  paths.ts
  terrain.ts
  land.ts
  water.ts
  placement.ts
  partition.ts
  buildings.ts
  bridges.ts
  routing.ts
  venues.ts
  city-v35.ts
  types.ts
  index.ts
  __tests__/
    geometry.test.ts
    routing.test.ts
    venues.test.ts
    determinism.test.ts
```

Create Solid renderer modules under `components/screens/play/city-map/`:

```text
components/screens/play/city-map/
  CityMapBoard.tsx
  CityMapSvg.tsx
  CityMapSlots.tsx
  VenueTooltip.tsx
  useCityMapModel.ts
  useCityMapHover.ts
  cityMapStyles.css
```

Keep the new code separate from `docs/test/cyberpunk ccg/`. The prototype should only be a source reference.

## Data Model

### Core City Types

Define explicit TypeScript interfaces in `services/playgame/city-map/types.ts`.

Minimum required types:

```ts
export interface Point {
  x: number;
  y: number;
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
```

### Future District Gameplay Layer

The old engine currently stages cards by lane, not arbitrary city slot. Treat that as legacy, not the target. The first `NEW GAME` city map launch does not need a gameplay model. Add one only after the game design starts to settle.

Target direction:

- Districts are the primary board regions.
- Each district owns a variable number of venue slots.
- Slot capacity can vary by district, venue type, map seed, scenario, or future authored content.
- A district may have no slots, a few slots, or many slots.
- Slots may have roles and eligibility rules instead of top/bottom row ownership.
- A card may eventually target a district, a venue, a route, a bridge, a building, or another card.

Possible future model:

```ts
export interface DistrictBoardState {
  districtId: string;
  slotIds: readonly string[];
  control?: 'P0' | 'P1' | 'contested' | null;
  score?: number;
  effects: readonly DistrictEffect[];
}

export interface CityCardPlacement {
  cardId: string;
  districtId: string;
  slotId?: string | null;
  venueId?: string | null;
  x: number;
  y: number;
}
```

Future rules:

- Do not assume exactly three active board regions.
- Do not assume each region has the same number of slots.
- Do not assume each slot belongs to a top or bottom player row.
- Preserve reusable card concepts such as `on reveal`, `ongoing`, triggered effects, modifiers, and zones if they still fit the future design.
- Rewrite or replace lane-specific concepts when they conflict with districts and venues.

This keeps the migration honest: old code can be mined for useful ideas, but districts and venue slots are the new conceptual center.

## Generation Port Plan

### Phase 1: Pure Module Extraction

Port the generator from globals to typed modules. Do this before touching the Solid UI.

Source files:

- `docs/test/cyberpunk ccg/city-map-config-v3.js`
- `docs/test/cyberpunk ccg/city-map-geometry-v3.js`
- `docs/test/cyberpunk ccg/city-map-paths-v3.js`
- `docs/test/cyberpunk ccg/city-map-land-v3.js`
- `docs/test/cyberpunk ccg/city-map-water-v3.js`
- `docs/test/cyberpunk ccg/city-map-terrain-v4.js`
- `docs/test/cyberpunk ccg/city-map-v35.js`
- `docs/test/cyberpunk ccg/city-map-buildings-v3.js`
- `docs/test/cyberpunk ccg/city-map-bridges-v3.js`
- `docs/test/cyberpunk ccg/city-map-routing-v1.js`
- `docs/test/cyberpunk ccg/city-map-venues-v1.js`

Target files:

- `services/playgame/city-map/*.ts`

Required changes:

- Replace IIFEs with ES module exports.
- Replace `window.CityMap*` lookups with explicit imports.
- Replace implicit global constants with imports from `config.ts`.
- Make every enrichment function return a new object or clearly document mutation.
- Move `makeRng` dependency to a local deterministic helper or a shared non-gameplay utility.
- Normalize all generated IDs to stable strings.
- Preserve `buildCityV35(seed)` as the first public entry point.

Public API:

```ts
export function buildCityMap(seed: string | number, opts?: CityMapOptions): CityMap;
export function summarizeCityMap(city: CityMap): CityMapSummary;
export function findCityRoute(city: CityMap, fromVenueId: string, toVenueId: string): CityRoute | null;
```

Do not include Solid, DOM, or SVG code in this package.

### Phase 2: Determinism And Unit Tests

Before renderer work, prove the generated city is stable.

Tests:

- Same seed returns same summary.
- Same seed returns same slot IDs and venue IDs.
- Every active slot has a valid `venueId`.
- Every `venueId` resolves in `venueById`.
- District slot counts satisfy generated or authored constraints.
- No active slot is outside board bounds.
- Routing enrichment does not create dangling edge IDs.
- Bottom-edge slot hover cases have valid coordinates and venue metadata.

Suggested test files:

- `services/playgame/city-map/__tests__/determinism.test.ts`
- `services/playgame/city-map/__tests__/venues.test.ts`
- `services/playgame/city-map/__tests__/routing.test.ts`

### Phase 3: Solid Static Renderer

Build a non-interactive Solid map first.

Component:

`components/screens/play/city-map/CityMapSvg.tsx`

Inputs:

```ts
interface CityMapSvgProps {
  city: CityMap;
  width: number;
  height: number;
  hoveredDistrictId?: string | null;
  debug?: CityMapDebugOptions;
}
```

Responsibilities:

- Render land/water.
- Render roads.
- Render bridges.
- Render buildings/open spaces.
- Render district labels.
- Render optional debug overlays.

Not responsible for:

- card placement
- gameplay state
- drag/drop
- venue hover tooltips
- district scoring
- VFX

This mirrors the existing `CityMapV4Preview` visually, but as Solid TSX with typed props.

### Phase 4: Solid Slots And Venue Tooltips

Create:

- `CityMapSlots.tsx`
- `VenueTooltip.tsx`
- `useCityMapHover.ts`

`CityMapSlots` should render interactive slot markers from `CitySlot[]`.

`useCityMapHover` should implement the board-level nearest-slot hover logic from the prototype, because the prototype proved small DOM hitboxes can fail near map edges.

Tooltip requirements:

- No native `title` attributes.
- Only custom tooltip UI.
- Minimal content:
  - icon
  - venue name
  - bonus line
- Small font and compact padding.
- Tooltip stays far enough from the slot that the slot remains visible.
- Connector line exits from the bottom edge of the tooltip.
- Connector line is a single diagonal segment, not an elbow.
- Tooltip is clamped to the board.

The hover algorithm should be independent of DOM slot hitboxes:

```ts
function nearestHoverSlot(point: Point, slots: readonly CitySlot[]): CitySlot | null {
  const radius = 18;
  let best: CitySlot | null = null;
  let bestD = Infinity;
  for (const slot of slots) {
    const d = squaredDistance(point, slot);
    if (d < bestD) {
      best = slot;
      bestD = d;
    }
  }
  return best && bestD <= radius * radius ? best : null;
}
```

Tooltip placement should be a reusable pure function:

```ts
export function placeVenueTooltip(anchor: Point, board: Size): VenueTooltipLayout;
```

This enables unit tests for top/bottom/edge cases.

### Phase 5: Wire `NEW GAME` To The City Map Shell

The main navigation button is:

`components/navigation/HomeCommandBar.tsx`

Current behavior:

```tsx
onClick={() => internalNavigate('PLAY')}
```

The migration target is that this button launches the new city map design. The old lane board does not need to remain the default `NEW GAME` destination.

Recommended route shape:

```text
/play           new city map shell, launched by NEW GAME
/play/legacy    optional old board route while migration is in progress
```

The exact route names can change, but the product contract should stay simple: `NEW GAME` opens the city map.

Implementation plan for this phase:

- Create a Solid city map screen or shell component.
- Route `NEW GAME` to that shell.
- Ensure the shell imports only Vite/TypeScript modules, not prototype globals.
- Render the city map, generated districts, venues, and hoverable slots.
- Include enough placeholder UI chrome to prove it fits the app.
- Do not pass cards to slots.
- Do not stage cards into the legacy engine.
- Do not calculate district control, scoring, or old lane power.
- Do not require player deck validity to render the map.

This phase answers:

- Does `NEW GAME` launch the new map surface?
- Does the app build with the ported map modules?
- Does the route link correctly through TanStack Router?
- Does the city map render at the real app viewport size?
- Can the user hover venue slots and see minimal venue popups?

### Phase 6: Sketch A District Gameplay Boundary

Once the city map route builds and renders, define the boundary where future gameplay can attach. This is not required for the first `NEW GAME` launch, and it should not force the old lane model onto the city.

The legacy engine has three lanes. The city map has districts, venues, variable slots, roads, bridges, and landmarks. Do not force those models together. If a temporary adapter is needed for experimentation, label it legacy and keep it out of the core city model.

Create:

`components/screens/play/city-map/useCityMapModel.ts`

Inputs:

- city seed
- generated `CityMap`
- optional scenario/debug config
- optional future game state

Outputs:

```ts
interface CityMapBoardModel {
  city: CityMap;
  districts: readonly CityDistrict[];
  activeDistrictIds: readonly string[];
  slotsByDistrictId: Readonly<Record<string, readonly CitySlot[]>>;
  cardPlacements: readonly CityCardPlacement[];
  hoverSlots: readonly CitySlot[];
}
```

Card placement projection, for later:

```ts
interface CityCardPlacement {
  cardId: string;
  districtId: string;
  seat: 'P0' | 'P1';
  slotId?: string | null;
  venueId?: string | null;
  x: number;
  y: number;
}
```

The model can initially return empty `cardPlacements`. That is acceptable. The purpose is to reserve the boundary where later card passing, hand state, district rules, venue bonuses, route mechanics, or other gameplay concepts will attach.

Future rules:

- Do not store derived geometry in future engine state.
- Store semantic intent: district, venue, slot, route, card target, timing window, etc.
- Derive visual placements from semantic state plus the generated city.
- Replays should restore the city seed and semantic actions, not hard-coded pixel positions.
- Pending/staged cards, if that concept survives, should appear in their projected city slot or district.

### Phase 7: City-Aware Drag And Drop

Only after the `NEW GAME` city shell builds, routes, and renders should drag/drop become city-aware. Do not base this on `stageCardInLane`.

Current drag/drop:

`components/screens/play/useDragDrop.ts`

Legacy staging API:

`actions.stageCardInLane(cardId, laneIdx)`

Possible future behavior:

- Dragging over a bottom city slot highlights its venue/slot.
- Dropping on a valid city slot stages or previews that card at the venue.
- Dropping on a district may target the district instead of a specific slot.
- Dropping on a route, bridge, or landmark may eventually be legal if gameplay wants it.
- The UI should preserve the semantic target if the future rules need slot-level or venue-level mechanics.

Recommended approach:

- Add city drag/drop as new code, not as a lane-drop wrapper.
- Reuse nearest-slot lookup from hover.
- Use district/venue/slot eligibility rules from the future gameplay model.
- If a district or venue is full, locked, or not eligible, do not highlight it.

Future optional gameplay API:

```ts
stageCardInCityTarget(cardId, {
  districtId,
  slotId,
  venueId,
  targetKind,
})
```

Do not add this until there is a gameplay need for target-level mechanics.

### Phase 8: District And Venue Semantics

The legacy engine treats locations as lane-level effects. That is not the target. Districts and venues are richer than locations and should be allowed to become first-class gameplay concepts when the game design is ready.

Initial rule for the migration:

- District = primary board area.
- City venue = visual/address/bonus annotation.
- Venue bonus text is cosmetic until rules support it.
- Landmark/venue identity should still be present in the data so future gameplay can use it.

Future bridge:

```ts
interface DistrictRuleDef {
  cityMap?: {
    preferredVenueTypes?: string[];
    preferredTiers?: ('iconic' | 'major' | 'minor')[];
    districtTheme?: string;
    minSlots?: number;
    maxSlots?: number;
  };
}
```

This lets future scenario or district rules influence which districts/venues are selected without requiring card logic to know about city geometry.

## Solid Component Contract

Initial top-level component for the `NEW GAME` route:

```tsx
<CityMapBoard
  seed={seed}
  interactive={true}
  showVenueTooltips={true}
/>
```

Initial responsibilities:

- Build or receive a generated `CityMap`.
- Render map geometry and venue slots.
- Handle hover/click inspection for venues.
- Avoid card, deck, legacy engine, scoring, replay, and drag/drop props.

Possible later gameplay-capable component:

```tsx
<CityMapBoard
  city={city}
  gameState={districtGameState}
  activeDistrictIds={activeDistrictIds}
  cardPlacements={cardPlacements}
  interactive={true}
  onTargetCard={(cardId, target) => actions.targetCityCard(cardId, target)}
  onInspectCard={(card, element) => openInspectCard(card, element)}
  onInspectVenue={(venue, element) => openInspect(...)}
/>
```

This shape is illustrative, not final. It intentionally names districts, placements, and targets rather than lanes.

Phase 5 should begin with route-shell props, not legacy engine props:

```tsx
<CityMapBoard
  seed={seed}
  width={CITY_BOARD_W}
  height={CITY_BOARD_H}
  debug={isDev ? cityMapDebug() : undefined}
/>
```

Start visual-only. Add game props incrementally.

## Styling Plan

Do not dump prototype CSS wholesale into `src/styles/playgame.css`.

Recommended split:

- Keep board layout in `src/styles/playgame.css`.
- Put city map specifics in `components/screens/play/city-map/cityMapStyles.css`.
- Import the city map CSS from `CityMapBoard.tsx` or from the play route style entry.

Style classes:

```text
city-map-board
city-map-svg
city-map-slot
city-map-slot--playable
city-map-slot--occupied
city-map-slot--hover
city-map-district
city-map-district--active
venue-tooltip
venue-tooltip-link
```

Avoid native `title` attributes on city map interactive elements. Use custom accessible labels if needed:

```tsx
aria-label={`${venue.name}: ${venue.bonus.text}`}
```

## File Migration Matrix

| Prototype Source | Main-App Target | Notes |
|---|---|---|
| `city-map-config-v3.js` | `services/playgame/city-map/config.ts` | Export constants, palette, dimensions. |
| `city-map-geometry-v3.js` | `services/playgame/city-map/geometry.ts` | Pure math, high unit-test value. |
| `city-map-paths-v3.js` | `services/playgame/city-map/paths.ts` | SVG path helpers only. |
| `city-map-terrain-v4.js` | `services/playgame/city-map/terrain.ts` | No DOM, no globals. |
| `city-map-land-v3.js` | `services/playgame/city-map/land.ts` | Docks/coast helpers. |
| `city-map-water-v3.js` | `services/playgame/city-map/water.ts` | River/lake/bank roads. |
| `city-map-placement-v3.js` | `services/playgame/city-map/placement.ts` | Placement utilities. |
| `city-map-partition-v3.js` | `services/playgame/city-map/partition.ts` | BSP/cell partitioning. |
| `city-map-buildings-v3.js` | `services/playgame/city-map/buildings.ts` | Building/open space generation. |
| `city-map-bridges-v3.js` | `services/playgame/city-map/bridges.ts` | Bridge planner. |
| `city-map-v35.js` | `services/playgame/city-map/city-v35.ts` | Public generator core. |
| `city-map-routing-v1.js` | `services/playgame/city-map/routing.ts` | Routing enrichment and pathfinding. |
| `city-map-venues-v1.js` | `services/playgame/city-map/venues.ts` | Venue taxonomy, names, slot assignment. |
| `city-map-v4-preview.jsx` | `components/screens/play/city-map/CityMapSvg.tsx` | Solid renderer. |
| `styles-v3.css` map sections | `components/screens/play/city-map/cityMapStyles.css` | Do not port unrelated card/game CSS. |
| `game-v3.jsx` city board parts | `CityMapBoard.tsx`, `CityMapSlots.tsx`, `VenueTooltip.tsx` | Split by responsibility. |

## Integration Milestones

### Milestone A: TypeScript Generator Compiles

Deliverables:

- `services/playgame/city-map/index.ts`
- `buildCityMap(seed)` works in a unit test.
- No Solid renderer yet.

Acceptance:

- `npm run build` passes.
- Determinism tests pass.
- Prototype remains untouched.

### Milestone B: Solid Static Map Preview

Deliverables:

- `CityMapSvg.tsx`
- optional Story/test route or dev-only render inside `/play`

Acceptance:

- Map renders in Solid without React.
- No `window.CityMap*` use.
- No Babel script tags.

### Milestone C: `NEW GAME` Opens City Map Shell

Deliverables:

- `CityMapBoard.tsx` visual-only mode
- route entry for the city map shell
- `HomeCommandBar.tsx` `NEW GAME` navigation points at the city map route
- old `PlayBoard.tsx` kept only as legacy/debug reference if needed

Acceptance:

- `npm run build` passes.
- Clicking `NEW GAME` opens the city map design.
- The route renders without requiring card passing or a started match.
- The map fills the available game surface.
- Venue slots and minimal hover popups work.
- No React runtime is required for the map.

### Milestone D: City Slots Exist Without Cards

Deliverables:

- venue-backed city slots
- variable slot counts per district
- empty `cardPlacements` output
- route-level placeholder state for later hand/card integration

Acceptance:

- Slots are generated from venues/buildings/landmarks.
- Different districts may have different slot counts.
- Slots can be hovered and inspected.
- Bottom-edge slots show tooltips.
- No card drag/drop is required.
- No district scoring or card rules are required.

### Milestone E: City-Aware Interactions

Deliverables:

- nearest-slot hover
- venue tooltip
- city slot hit testing
- optional cardless click/select state
- later extension point for drag/drop

Acceptance:

- Bottom-edge slots show tooltips.
- Tooltip uses only custom UI.
- Tooltip line exits from bottom of box as one diagonal segment.
- No browser-native `title` tooltips appear.

### Milestone F: Gameplay Integration Later

Deliverables:

- future card flow model
- hand/card rendering on or near city slots
- drag/drop into venue slots
- district/venue target model
- scoring, control, or bonus rules once designed
- optional reuse of `on reveal`, `ongoing`, triggered effects, modifiers, costs, and zones

Acceptance:

- Cards can be played into city venues.
- Future game state and UI state agree.
- Venue bonuses have typed manifest data.
- Replay/debug bundles can restore the generated city board.

## Risks And Mitigations

### Risk: Reusing The Legacy Engine Too Early

Mitigation:

Do not involve the legacy engine in the first `NEW GAME` city map route. Render the city as a standalone app surface first. When gameplay returns, design district/venue state first and reuse old engine pieces only when they fit.

### Risk: Porting Prototype Globals As-Is

Mitigation:

Port generator files into pure TypeScript modules before rendering. Avoid `window.*` entirely.

### Risk: Solid Rendering Becomes A Giant Component

Mitigation:

Split static map, slots, tooltips, hover, and model projection into separate files.

### Risk: Drag/Drop Breaks Existing Play

Mitigation:

Do not add drag/drop to the first city route. Keep `setupDragDrop()` scoped to the legacy board until city slot projection is proven.

### Risk: Tooltip And Slot Hitboxes Fail Near Edges

Mitigation:

Use board-level nearest-slot detection rather than relying on the DOM box around a small marker.

### Risk: Map Generation Is Too Expensive

Mitigation:

Memoize by seed. Build city once per map seed. Keep generation stable while allowing hover, selection, debug overlays, and future gameplay state to update independently.

### Risk: Current Prototype Visual Bugs Leak Into Main App

Mitigation:

Treat the prototype as reference behavior, not source truth. Add tests for placement, clamping, and slot metadata.

## Testing Plan

### Unit Tests

- geometry helpers
- path helpers
- city determinism
- venue assignment
- tooltip placement
- nearest slot hover
- district slot selection
- variable slot-count constraints

### Integration Tests

- `NEW GAME` navigates to the city map route.
- The city map route renders without a match in progress.
- The city map route renders without hand/card data.
- `npm run build` includes the city map modules without Babel globals.
- bottom-edge venue slot hover creates tooltip.

### Visual QA

Use the in-app browser and screenshots for:

- desktop board
- narrow board
- top-edge slots
- bottom-edge slots
- left/right-edge slots
- dense slot cluster
- route transition from main menu
- minimal venue tooltip placement

## Rollback Plan

The first routed integration should be easy to back out. Rollback is:

1. Point `NEW GAME` back to the previous route.
2. Keep the city map route reachable only through a dev/debug path.
3. Keep generator package unused but compiled.
4. Remove city route registration if it causes build or navigation regressions.

Do not delete legacy board files until the city board has passed build, navigation, visual QA, and later gameplay QA. They are no longer the product target, but they remain useful as references while the migration is incomplete.

## Open Questions

- Should `/play` itself become the city map route, with the old board moved to `/play/legacy`, or should the city map use a new route name first?
- How many active districts should a typical match/scenario use?
- Should districts have authored slot-count ranges, generated slot-count ranges, or both?
- Should venue bonuses become gameplay rules, or remain visual flavor until a later gameplay system exists?
- Should district/scenario definitions influence city generation through manifest metadata?
- Should routing be exposed in gameplay, or remain a visual/debug affordance?
- Should map generation be cached per seed in memory only, or persisted in replay/debug bundles?

## Recommended First Implementation Slice

Start with the smallest useful slice:

1. Port `geometry.ts`, `paths.ts`, `config.ts`.
2. Port enough of `city-v35.ts` dependencies to run `buildCityMap(seed)`.
3. Port `venues.ts`.
4. Add determinism and venue tests.
5. Build a visual-only `CityMapSvg.tsx`.
6. Build a `CityMapBoard.tsx` route shell.
7. Wire `NEW GAME` in `HomeCommandBar.tsx` to the city map route.
8. Confirm `npm run build` passes.

Stop there before touching drag/drop, card placement, or gameplay rules.
