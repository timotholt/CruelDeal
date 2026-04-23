# Location Power Inspector Spec

## Summary

Yes, we can make the location inspector behave more like the card inspector without a large architecture rewrite.

This is a moderate projection-and-UI extension, not a deep engine redesign.

The right approach is:

1. Add a canonical engine-side lane power breakdown projection.
2. Feed that breakdown into the `/play` location zoom inspector.
3. Let players click the top or bottom lane score inside the location inspector to open a score breakdown panel.

The main architectural caution is that the current presentation-layer `getLanePower()` in `services/playgame/view.ts` is not canonical. It sums resolved card power and does not account for lane-only effects like `LANE_POWER_ADD` or `LANE_POWER_MULTIPLIER`. The spec below fixes that by moving the location inspector onto engine-derived lane breakdown data.

## Goals

- In the `/play` location inspector, allow clicking a lane score to see how that score was calculated.
- Mirror the card inspector interaction model as much as possible.
- Correctly explain:
  - per-card base power
  - permanent card deltas
  - live ongoing card modifiers
  - lane-only additive effects
  - lane multipliers
- Keep the engine as the single source of truth.

## Non-Goals

- Do not add replay or turn-history reconstruction.
- Do not explain hidden information the player should not see.
- Do not replace the existing card power inspector model.
- Do not implement a generalized “formula debugger” for every projection in the game.

## Current State

### What already exists

- Card inspector supports click-to-open power and cost logs in `components/screens/ZoomInspector.tsx`.
- Card logs are backed by:
  - permanent event history (`powerLog`, `costHistory`)
  - live projection data (`powerModifiers`, `costLog`)
- Location zoom target already carries:
  - `laneIdx`
  - `bottomPower`
  - `topPower`
  - DOM element

### What is missing

- No lane score breakdown projection exists.
- Location inspector has no score-specific interaction state.
- The UI-facing `getLanePower()` in `services/playgame/view.ts` is a simplified sum of card power and is not suitable as a canonical explanation source.

## Architecture Assessment

### Is this a big change?

No. This is not a large architecture change.

It is a moderate feature that touches three layers:

- engine projection layer
- presentation/view layer
- zoom inspector UI

The engine event model does not need to change.
The match state model does not need to change.
The manifest model does not need to change.

## Proposed Design

### 1. Add canonical lane score breakdown projections

Create a new projection module, for example:

- `services/playgame/engine/projections/lane-breakdown.ts`

Add exported helpers such as:

```ts
interface LaneCardContribution {
  cardId: CardId;
  defId: string;
  name: string;
  basePower: number;
  permanentDelta: number;
  ongoingDelta: number;
  finalCardPower: number;
}

interface LaneAdditiveContribution {
  sourceId: CardId | LocationId;
  label: string;
  delta: number;
}

interface LaneMultiplierContribution {
  sourceId: CardId | LocationId;
  label: string;
  factor: number;
}

interface LanePowerBreakdown {
  lane: LaneIdx;
  owner: Owner;
  cards: LaneCardContribution[];
  cardSubtotal: number;
  laneAdditions: LaneAdditiveContribution[];
  subtotalAfterAdditions: number;
  multipliers: LaneMultiplierContribution[];
  effectiveMultiplier: number;
  total: number;
}
```

Primary API:

```ts
function getLanePowerBreakdown(
  state: MatchState,
  lane: LaneIdx,
  owner: Owner,
  manifest: Manifest,
): LanePowerBreakdown
```

### 2. Make lane total and lane breakdown come from the same source

Refactor engine `getLanePower()` to reuse `getLanePowerBreakdown().total`, or share an internal helper.

This avoids drift between:

- score shown on the board
- score used for winner calculation
- score shown in inspector breakdown

### 3. Stop using the simplified UI-only lane power calculation

In `services/playgame/view.ts`, replace the current presentation-layer `getLanePower()` with a thin wrapper around the engine projection:

```ts
import { getLanePower as getEngineLanePower } from './engine/projections';
```

This is required even before the breakdown panel is fully useful, because lane-only effects already need canonical handling.

### 4. Extend the location inspect target

Current location inspect target:

```ts
{
  kind: 'location';
  location: ResolvedLocation;
  laneIdx: number;
  bottomPower: number;
  topPower: number;
  element: HTMLElement;
}
```

Proposed:

```ts
{
  kind: 'location';
  location: ResolvedLocation;
  laneIdx: number;
  bottomPower: number;
  topPower: number;
  bottomBreakdown: LanePowerBreakdown;
  topBreakdown: LanePowerBreakdown;
  element: HTMLElement;
}
```

This keeps the inspector read-only and avoids recomputing breakdowns in multiple UI components.

### 5. Add clickable score hotspots in the location zoom inspector

In `components/screens/ZoomInspector.tsx`, for `target.kind === 'location'`:

- make the top score clickable
- make the bottom score clickable
- store local state like:

```ts
const [laneLogSide, setLaneLogSide] = createSignal<'top' | 'bottom' | null>(null);
```

Behavior:

- click top score -> open top-side breakdown panel
- click bottom score -> open bottom-side breakdown panel
- click same score again -> close panel
- click elsewhere outside the location -> close inspector

### 6. Add a lane score breakdown panel

Create a new UI component, for example:

- `components/screens/LanePowerPanel.tsx`

This should visually parallel `StatLogPanel`, but use lane-specific sections:

- `Cards`
- `Lane`
- `Multipliers`
- `Total`

Suggested display:

```text
Base Cards
  THORN CHOIR          2 -> 4
  SUN BEACON           5 -> 5
  Subtotal                 9

Ongoing
  SUN BEACON            +1
  THORN CHOIR           +1
  Subtotal After Ongoing 11

Lane
  SENTINEL             +1
  Subtotal After Lane   12

Multipliers
  SCIENCE LAB          x2

Final
  24
```

### 7. Card contributions should reuse existing card projection concepts

Per-card row math should be assembled from:

- manifest base power
- `card.powerDelta`
- `getCardPowerModifiers()`

This preserves consistency with the current card inspector.

### 8. Lane-only effects must remain separate from card rows

This is especially important for effects like:

- `LANE_POWER_ADD` from Sentinel
- `LANE_POWER_MULTIPLIER` from Science Lab / Iron Man style effects

These should never be shown as if they changed a card’s own power.

## UX Notes

- The location inspector should feel like a direct extension of the current card inspector.
- Clicking a score should be discoverable:
  - pointer cursor
  - subtle title like `View score breakdown`
- Only the score chips should open the score breakdown.
- Clicking the art/body of the zoomed location should still close the inspector unless we later decide location cards need richer controls.

## Edge Cases

- Hidden location: score breakdown still works if the lane score is visible.
- Empty lane with lane-only bonus: panel should show `Cards subtotal = 0`, then lane additions/multipliers.
- Multiplier with zero subtotal: final score should remain `0`.
- Both card ongoing and lane-level bonuses present: keep them separated in the panel.
- Unknown source id: fall back to raw `sourceId`.

## Implementation Plan

### Phase 1: Canonicalize lane scoring

- Add `getLanePowerBreakdown()` in engine projections.
- Refactor engine `getLanePower()` to reuse it.
- Update `services/playgame/view.ts` to delegate lane total to engine projection.

### Phase 2: Thread breakdowns to the inspector

- Extend `InspectTarget` location shape.
- Build `topBreakdown` / `bottomBreakdown` in `LocationTile` or `PlayBoard`.
- Pass them into `openInspect()`.

### Phase 3: Build the UI panel

- Add `LanePowerPanel.tsx`.
- Add score-click state to `ZoomInspector.tsx`.
- Render the appropriate breakdown panel when a location score is clicked.

### Phase 4: Verification

- Add projection tests for:
  - card-only lanes
  - Sentinel lane bonus
  - Science Lab multiplier
  - combined additive + multiplier
- Add a UI-level smoke test if the project later adds component test coverage for `/play`.

## Test Cases

- Thorn Choir played first, Sun Beacon played second in same lane:
  - clicking Sun Beacon card power shows Thorn Choir in card inspector
  - clicking location score shows both card-level and lane-level contributions correctly
- Sentinel in lane alone:
  - Sentinel card inspector remains `5`
  - location score breakdown shows `Cards = 5`, `Lane +1`, `Total = 6`
- Science Lab lane:
  - score breakdown shows multiplier separately, not as card power
- Face-down source card:
  - unrevealed ongoings do not appear in breakdown

## Recommendation

Proceed with this feature.

It is not a big architecture change, and the required work is mostly additive. The only important cleanup is replacing the current UI-only lane total helper with a canonical engine-backed score projection so the explanation panel is built on correct math.
