# City Map Composition Iteration Plan

## Purpose

Improve the live city map composition in small, runnable steps. Every completed step must produce a visible improvement on `/play`, keep the board usable, and preserve the existing block/building/slot pipeline.

This plan is deliberately incremental. The generator should never spend multiple steps in a broken intermediate state just to reach a later architecture.

## Current Visual Problems

- Some seeds leave a dead upper-right or corner void when a small island/landform would balance the frame.
- The mainland macro split repeatedly reads as a T/inverted-T composition.
- One large district is usually screen-aligned while the other two are slanted, which makes maps feel samey.
- Major roads and district seams are too coupled, so road variety risks breaking block subdivision.
- Islands currently feel like occasional flavor rather than a composition tool.

## Non-Breaking Rules

- `/play` must run after every completed step.
- The existing city map data shape must remain compatible with `CityMapBoard`, `CityMapSvg`, slots, labels, landmarks, roads, and debug toggles.
- Do not replace the block maker in this pass.
- Prefer adding optional metadata and generator templates over rewriting existing geometry internals.
- New visual features must degrade gracefully: if a template cannot produce valid geometry, fall back to the current generator.
- Playable districts must keep valid slots, labels, landmarks, buildings, and roads.
- Flavor islands may have no slots, but playable island districts must satisfy the same slot-count invariants as mainland districts.

## Verification Baseline

Run these after each step:

```bash
npm run build
npx tsx services/playgame/city-map/__tests__/city-v35.test.ts
```

For visual verification, run the app and inspect `/play` with at least these seeds:

```text
new-game-city
city-map-unit-seed
city-map-unit-seed-alt
```

When a step changes layout variety, also inspect at least 10 ad hoc seeds and save screenshots for obvious regressions.

## Step 1: Add Composition Metrics Overlay

### Goal

Make empty-corner and stale-composition problems measurable before changing terrain.

### Implementation

- Add a small composition analyzer after terrain/map generation.
- Compute visual mass per quadrant using land polygons, buildings, roads, landmarks, slots, and district labels.
- Compute simple layout fingerprints:
  - upper-right land mass score
  - largest empty quadrant
  - district angle distribution
  - macro-road angle distribution
  - approximate T-shape confidence
- Expose the analyzer through debug-only metadata and console-free tests, not production logging.

### Visual Improvement

Add a debug overlay toggle that lightly marks underfilled quadrants. This does not solve composition yet, but it makes the problem visible and inspectable in the running app.

### Acceptance

- `/play` still renders normally with the overlay off.
- Debug overlay can show which quadrant is underfilled.
- No new console spam.
- Existing tests pass.

## Step 2: Upper-Right Satellite Island Fallback

### Goal

If the upper-right is visually empty, generate a small island or peninsula there.

### Implementation

- Add a terrain post-pass that runs after base landmass generation.
- If upper-right visual mass is below threshold, propose a compact island inside the upper-right safe zone.
- Validate it against existing water, mainland coast, viewport margin, and bridge clearance.
- If the island cannot fit cleanly, skip it.
- Mark it as `compositionRole: "satellite-balance"`.
- Start with flavor-only islands: land, coast road, buildings/docks if valid, no playable slots.

### Visual Improvement

Screens like the provided example should gain a small upper-right landform instead of a dead void.

### Acceptance

- At least the known bad screenshot seed family can produce a visible upper-right island or fallback peninsula.
- The island does not overlap mainland, debug dock, board edge, or water features.
- Existing mainland districts, slots, landmarks, and routes remain unchanged unless terrain validation requires a safe fallback.
- Existing tests pass.

## Step 3: Make Satellite Islands Feel Intentional

### Goal

The island should not look like a random blob pasted into empty space.

### Implementation

- Add optional island dressing:
  - tiny coast road
  - dock ticks
  - one landmark/open-space candidate
  - sparse buildings aligned to island long axis
- Keep this island flavor-only for this step.
- Reuse existing building generation where possible. If the island is too small for buildings, render it as a lit harbor/park shape.

### Visual Improvement

The upper-right island reads as part of the city composition instead of filler.

### Acceptance

- Island silhouette is visible at gameplay scale.
- Dressing is subtle and does not compete with playable districts.
- Existing tests pass.

## Step 4: Add Macro Layout Templates Without Changing Blocks

### Goal

Break the constant T/inverted-T pattern while leaving the block maker intact.

### Implementation

Introduce a `macroLayoutTemplate` choice before `macroDivide3`:

- `classic-t`: current behavior, retained as fallback.
- `diagonal-spine`: one strong diagonal separator with a short branch.
- `offset-t`: T split shifted away from center.
- `corner-bite`: one district wraps around a smaller district.
- `coast-split`: one divider follows or responds to water/coast shape.

Each template still outputs valid regions consumed by the existing district/block path. Do not change building subdivision yet.

### Visual Improvement

Across seeds, the three playable districts no longer always form the same T-like read.

### Acceptance

- At least three templates appear across a 20-seed sample.
- All templates produce three playable mainland districts or fall back cleanly.
- Slots, labels, roads, landmarks, and buildings still render.
- Existing tests pass.

## Step 5: Decouple Decorative Arterials From District Seams

### Goal

Add diagonal or bent highway energy without making district boundaries carry all the visual variety.

### Implementation

- Add `compositionArterials` as renderable road-like corridors that do not split districts.
- Start with one template: diagonal avenue or bent avenue across the mainland.
- Attach them to `roadGraph.edges` with a distinct source/kind, but keep them out of district partition cuts.
- Render them using existing road classes or a new `composition-arterial` class.
- Keep routing optional; initially they are visual order, not gameplay topology.

### Visual Improvement

The map can show a diagonal or bent major corridor even when district shapes remain stable.

### Acceptance

- Arterials do not create invalid blocks.
- Arterials do not erase or overpaint bridges/buildings in a visually broken way.
- Road debug still works.
- Existing tests pass.

## Step 6: Bent Highway Template

### Goal

Move beyond straight diagonal roads into highways that turn and bend.

### Implementation

- Add one bent corridor generator:
  - choose 3-4 control points
  - smooth into a polyline path
  - validate against minimum length and viewport bounds
  - avoid running directly through district labels and major landmarks where possible
- Use it as a `compositionArterial` first.
- Only promote to true routing after the visual read is proven.

### Visual Improvement

The road system starts reading like planned infrastructure instead of only generated block seams.

### Acceptance

- Bent highway is visible but sparse.
- It does not create dense road spaghetti.
- It can be disabled independently by the roads debug toggle.
- Existing tests pass.

## Step 7: Playable Two-District Island Template

### Goal

Use islands as real composition variety, not only decoration.

### Implementation

- Add a rare medium/large island template.
- Split it into two physically screen-aligned districts.
- Give each island district valid:
  - labels
  - slots
  - landmarks
  - coast roads
  - sparse buildings
- Add at least one bridge or ferry-like connector back to mainland.
- Keep rarity low until visuals are proven.

### Visual Improvement

Some seeds produce a meaningfully different board: mainland plus a two-district island instead of three mainland districts only.

### Acceptance

- Island districts are playable and satisfy target slot counts.
- The island split looks intentionally screen-aligned, not accidentally rigid.
- Mainland still has enough playable area.
- Existing tests pass.

## Step 8: Layout Variety Regression Test

### Goal

Prevent future tweaks from collapsing back into the same T-shaped city.

### Implementation

- Add a deterministic sample test over fixed seeds.
- Assert a minimum number of unique `macroLayoutTemplate` values.
- Assert at least one sample contains a satellite island or island template.
- Assert playable districts always meet slot-count and bounds invariants.
- Keep visual quality judgments manual; tests only guard structural variety.

### Visual Improvement

No direct render change, but it protects the visible improvements from regression.

### Acceptance

- Test is deterministic.
- Test does not overfit exact coordinates.
- Existing build and city-map tests pass.

## Recommended Order

Do not start with bent highways. Start with the composition analyzer and upper-right island fallback because they solve the most obvious screenshot issue with the least risk.

Recommended first implementation slice:

1. Composition metrics overlay.
2. Upper-right satellite island fallback.
3. Island dressing.

After that, add macro layout templates before touching highways. The arterial/highway work is safer once the generator has a vocabulary for varied compositions.

## Done Definition

This plan is complete when:

- Empty-corner screenshots get intentional land/harbor balance.
- A 20-seed sample no longer reads as the same T-shaped city repeated.
- At least one seed shows a diagonal or bent arterial that is not a district seam.
- At least one seed shows a playable two-district island.
- `/play` remains runnable after every merged step.
- The city-map tests and production build pass after every step.
