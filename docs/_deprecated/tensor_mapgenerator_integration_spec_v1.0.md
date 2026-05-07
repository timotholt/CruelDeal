# MapGenerator-master → SolidJS Integration Spec

**Project:** CruelDeal — Tensor City Map Generator
**Version:** v1.0
**Date:** 2026-05-06
**Supersedes:** tensor_road_generation_option_spec_v0.1.txt (extraction approach)
**Strategy change:** Load the *full working generator* inside SolidJS first, then iteratively decouple.

---

## 0. Context & Rationale

The previous spec (v0.1) proposed **extracting** core algorithms from
MapGenerator-master and slotting them into the existing `buildCityV35` pipeline.
That extraction was attempted in `tensor-broken/` and partially failed.

New approach: **Get MapGenerator-master running inside the SolidJS app first.**
Once it renders and generates successfully, incrementally replace its UI layer
(dat.gui) and plumb its output into `CityMap`.

Advantages:
- Proven, working code stays intact during migration.
- Each refactor step can be tested against the known-good original.
- `MapGenerator-backup/` remains as an untouched reference.

---

## 1. Source Inventory

### 1.1 MapGenerator-master file map

```
src/
  main.ts                       ← App shell (dat.gui, canvas, render loop)
  colour_schemes.json           ← Colour theme presets
  html/
    index.html                  ← Minimal DOM scaffold
    style.css                   ← Canvas positioning
  ts/
    vector.ts                   ← 2D vector class (mutable, chainable)
    util.ts                     ← Constants, CSS colour parser, dat.gui helpers
    model_generator.ts          ← STL/3D export (not needed in game)
    impl/                       ← CORE ALGORITHMS — NO UI DEPS
      tensor.ts                 ← Tensor math (2x2 symmetric traceless)
      tensor_field.ts           ← Combines basis fields, noise, park/sea masking
      basis_field.ts            ← Grid & Radial field primitives
      integrator.ts             ← RK4 streamline integrator
      streamlines.ts            ← StreamlineGenerator (road polylines)
      grid_storage.ts           ← Spatial hash for collision detection
      graph.ts                  ← Builds intersection graph from streamlines
      polygon_finder.ts         ← Finds enclosed polygons (city blocks)
      polygon_util.ts           ← Point-in-polygon, shrink, area, etc.
      water_generator.ts        ← Coastline & river generation
    ui/                         ← UI LAYER — dat.gui + DOM + Canvas
      domain_controller.ts      ← Singleton: pan/zoom, coordinate transforms
      drag_controller.ts        ← interactjs drag for tensor field centres
      tensor_field_gui.ts       ← TensorFieldGUI extends TensorField + dat.gui
      main_gui.ts               ← Orchestrates generation pipeline + dat.gui
      road_gui.ts               ← Road generation UI wrapper
      water_gui.ts              ← Water generation UI wrapper
      canvas_wrapper.ts         ← Canvas/SVG drawing abstraction
      style.ts                  ← DefaultStyle / RoughStyle renderers
      buildings.ts              ← Building lot/model generation
```

### 1.2 Dependency audit

| MapGenerator dep       | CruelDeal equivalent       | Action                    |
|------------------------|---------------------------|---------------------------|
| `simplex-noise@2.4`   | (none)                    | Add to deps               |
| `simplify-js@1.2`     | (none)                    | Add to deps               |
| `jsts@2.1`            | (none)                    | Add to deps               |
| `isect@3.0`           | (none)                    | Add to deps (used by graph.ts) |
| `polyk@0.24`          | (none)                    | Add to deps               |
| `d3-quadtree@1.0`     | (none)                    | Add to deps               |
| `@svgdotjs/svg.js@3`  | (none)                    | Add to deps               |
| `roughjs@4.2`         | (none)                    | Add to deps (Rough style) |
| `loglevel@1.6`        | (none)                    | Add to deps               |
| `three@0.115`         | `three@0.184`             | Use game's version; adapt if API breaks |
| `dat.gui@0.7`         | SolidJS UI                | Replace in Phase 2        |
| `interactjs@1.9`      | (none)                    | Add to deps (drag; replace in Phase 2) |
| `file-saver@2.0`      | (none)                    | Not needed (no download)  |
| `jszip@3.4`           | (none)                    | Not needed (no STL)       |
| `three-csg-ts@1.0`    | (none)                    | Not needed (no STL)       |
| `threejs-export-stl`  | (none)                    | Not needed (no STL)       |

### 1.3 Build system delta

| Aspect         | MapGenerator-master | CruelDeal        |
|----------------|---------------------|------------------|
| Bundler        | Gulp + Browserify   | Vite             |
| TS version     | 3.8 (ES5 target)   | 5.8 (ES2022)     |
| Module format  | CommonJS bundle     | ESM              |
| UI framework   | dat.gui + raw DOM   | SolidJS          |
| Entry point    | `window.onload`     | SolidJS component |

---

## 2. Architecture — Three-Phase Plan

### Phase 1: Load & Render (this spec's primary target)
Get MapGenerator-master rendering inside a SolidJS component. dat.gui stays.
User can generate maps via the dat.gui panel.

### Phase 2: Replace UI
Swap dat.gui with SolidJS controls. Remove interactjs drag. Make generation
callable via a programmatic API (`generateCity(seed, config) → MapData`).

### Phase 3: Bridge to CityMap
Adapt MapGenerator output (roads, blocks, buildings, water) into the game's
`CityMap` type. Wire into `buildCityV35` as `roadGenerationMode: "tensor"`.

---

## 3. Phase 1 — Detailed Design

### 3.1 File layout

```
services/playgame/city-map/tensor-working/
  MapGenerator-master/          ← UNTOUCHED source (git reference)
  MapGenerator-backup/          ← UNTOUCHED backup

services/playgame/city-map/tensor/
  index.ts                      ← Public barrel: <TensorMapView /> component
  TensorMapView.tsx             ← SolidJS wrapper component
  boot.ts                       ← Adapted Main class (no window.onload)
  patch-imports.ts              ← Any shimming needed for ESM migration

  impl/                         ← COPIED from MapGenerator-master/src/ts/impl/
    tensor.ts                     (migrated to ESM, TS 5.8 compat)
    tensor_field.ts
    basis_field.ts
    integrator.ts
    streamlines.ts
    grid_storage.ts
    graph.ts
    polygon_finder.ts
    polygon_util.ts
    water_generator.ts

  ui/                           ← COPIED from MapGenerator-master/src/ts/ui/
    domain_controller.ts          (migrated; singleton → instance-based later)
    drag_controller.ts
    tensor_field_gui.ts
    main_gui.ts
    road_gui.ts
    water_gui.ts
    canvas_wrapper.ts
    style.ts
    buildings.ts

  vector.ts                     ← COPIED from MapGenerator-master/src/ts/
  util.ts
  model_generator.ts            ← COPIED but optional; can stub for Phase 1
  colour_schemes.json           ← COPIED from MapGenerator-master/src/
```

### 3.2 Migration steps for each file

1. **Copy** `src/ts/impl/*`, `src/ts/ui/*`, `src/ts/vector.ts`, `src/ts/util.ts`,
   `src/colour_schemes.json` into the new `tensor/` tree.

2. **Fix imports** in every file:
   - `import * as log from 'loglevel'` → keep (add loglevel dep)
   - `import * as SimplexNoise from 'simplex-noise'` → ESM default import
   - `import * as simplify from 'simplify-js'` → ESM default import
   - `import * as dat from 'dat.gui'` → keep for Phase 1
   - `import * as ColourSchemes from './colour_schemes.json'` → Vite JSON import
   - Internal relative paths updated to new directory structure

3. **TypeScript 5.8 fixes** (expected):
   - `const enum` → regular `enum` (or keep with `isolatedModules` shim)
   - Implicit `any` in places where TS 3.8 was lenient
   - `resolveJsonModule` already enabled in tsconfig

4. **DOM wiring** — see §3.3.

### 3.3 SolidJS wrapper component

```tsx
// tensor/TensorMapView.tsx
import { onMount, onCleanup } from 'solid-js';

export default function TensorMapView() {
  let containerRef: HTMLDivElement;

  onMount(() => {
    // Dynamically import boot to avoid side-effects at module level
    import('./boot').then(({ bootMapGenerator }) => {
      bootMapGenerator(containerRef);
    });
  });

  onCleanup(() => {
    // Tear down animation loop, remove event listeners
  });

  return (
    <div ref={containerRef!} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg id="tensor-map-svg" />
      <canvas id="tensor-map-canvas" />
      <canvas id="tensor-img-canvas" style={{ display: 'none' }} />
    </div>
  );
}
```

### 3.4 Boot adapter (`boot.ts`)

Adapted from `main.ts`. Key changes:

| Original (`main.ts`)                | Adapted (`boot.ts`)                           |
|--------------------------------------|-----------------------------------------------|
| `window.addEventListener('load', …)` | Called from `onMount` via `bootMapGenerator()` |
| `document.getElementById('map-canvas')` | Scoped lookup within `containerRef`         |
| `Util.CANVAS_ID = 'map-canvas'`     | Override to `'tensor-map-canvas'`              |
| `Util.IMG_CANVAS_ID = 'img-canvas'` | Override to `'tensor-img-canvas'`              |
| `Util.SVG_ID = 'map-svg'`           | Override to `'tensor-map-svg'`                 |
| `new dat.GUI()`                      | Keep for Phase 1                               |
| `requestAnimationFrame(this.update)` | Store RAF id for cleanup                       |
| `DomainController` singleton resize  | Scope to container, not window                 |

```ts
// tensor/boot.ts — sketch
export function bootMapGenerator(container: HTMLElement): () => void {
  // Override element IDs so MapGenerator finds its canvases inside our component
  // (We'll modify util.ts to accept these or use container-scoped lookups.)

  const canvas = container.querySelector('#tensor-map-canvas') as HTMLCanvasElement;
  const imgCanvas = container.querySelector('#tensor-img-canvas') as HTMLCanvasElement;

  // Size canvas to container
  const resize = () => {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  };
  resize();

  // Boot the generator
  const main = new Main(container);  // Adapted Main class
  main.generate();

  // Return cleanup function
  return () => {
    main.destroy();
  };
}
```

### 3.5 `DomainController` adaptation

The singleton currently binds to `window` for resize and scroll events.

**Phase 1 minimal fix:**
- Accept an optional `HTMLElement` container in `getInstance(container?)`.
- If container provided, read dimensions from container instead of `window`.
- Bind `wheel` listener to the canvas element, not window.
- Store the container ref so `screenDimensions` reflects container size.

**Phase 2 full fix:**
- Remove singleton pattern; pass as dependency injection.

### 3.6 `Util` adaptation

- Make `CANVAS_ID`, `IMG_CANVAS_ID`, `SVG_ID` configurable (constructor or setter)
  so they don't collide with other DOM elements in the SolidJS app.
- Replace `document.getElementById(...)` calls in `main.ts`/`style.ts` with
  `container.querySelector(...)`.

### 3.7 dat.gui handling (Phase 1)

Keep dat.gui as-is for Phase 1. It will render its own floating panel. This is
acceptable for a dev/debug integration. The panel will be visible alongside the
SolidJS UI.

In Phase 2, replace dat.gui with SolidJS signals + UI components.

### 3.8 CSS isolation

MapGenerator's `style.css` sets `html, body { overflow: hidden; margin: 0 }` and
positions canvases as `position: fixed`. These will conflict with the game UI.

Fix: Scope the canvas styles to the component container:

```css
/* Only apply within our component */
.tensor-map-container canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
```

Do **not** import MapGenerator's `style.css` globally.

---

## 4. Dependency Installation

```bash
npm install simplex-noise@2 simplify-js jsts isect polyk d3-quadtree \
  @svgdotjs/svg.js roughjs loglevel dat.gui interactjs
npm install -D @types/dat.gui @types/d3-quadtree @types/jsts
```

Note: `simplex-noise@2` is required (v3+ has breaking API changes).
If the game already uses `three`, do not downgrade — adapt the three.js usage
in `model_generator.ts` or stub it (STL export not needed).

---

## 5. Known Migration Issues

### 5.1 `const enum` in `basis_field.ts`

```ts
export const enum FIELD_TYPE { Grid, Radial }
```

Vite with `isolatedModules: true` cannot inline `const enum` across files.
**Fix:** Change to regular `enum` or string union.

### 5.2 SimplexNoise import

MapGenerator: `import * as SimplexNoise from 'simplex-noise'`
simplex-noise@2 default export is a class.
**Fix:** `import SimplexNoise from 'simplex-noise'` (ESM default).

### 5.3 simplify-js import

MapGenerator: `import * as simplify from 'simplify-js'`
**Fix:** `import simplify from 'simplify-js'` (ESM default).

### 5.4 dat.gui import

MapGenerator: `import * as dat from 'dat.gui'`
**Fix:** `import dat from 'dat.gui'` or `import * as dat from 'dat.gui'`
depending on version. May need `@types/dat.gui`.

### 5.5 loglevel import

MapGenerator: `import * as log from 'loglevel'`
**Fix:** `import log from 'loglevel'` (ESM default).

### 5.6 JSON import

MapGenerator: `import * as ColourSchemes from './colour_schemes.json'`
Vite handles JSON imports natively.
**Fix:** `import ColourSchemes from './colour_schemes.json'`.

### 5.7 `window.innerWidth/Height` in DomainController

The singleton reads window dimensions. Inside a SolidJS component, we need
container dimensions instead.
**Fix:** See §3.5.

### 5.8 `document.getElementById` in main.ts, style.ts

Multiple files use hardcoded element IDs.
**Fix:** See §3.6 — pass container ref, use `container.querySelector`.

### 5.9 Three.js version mismatch

MapGenerator uses `three@0.115`; game uses `three@0.184`. API changes between
these versions are significant.
**Fix:** `model_generator.ts` is only used for STL export (not needed).
If any Three.js code is used in rendering, adapt or stub. For Phase 1 the
only Three.js usage is in `model_generator.ts` — safe to skip.

### 5.10 isect import

The `isect` library may not have proper ESM exports.
**Fix:** May need `import isect from 'isect'` or dynamic require shim.
Check at build time.

---

## 6. Route in the SolidJS App

For Phase 1, add a dev-only route or debug panel:

```tsx
// Example: add to the game's router or debug dock
import TensorMapView from '@/services/playgame/city-map/tensor/TensorMapView';

// Full-page dev route
<Route path="/dev/tensor-map" component={TensorMapView} />

// Or embed in CityMapDebugDock
<Show when={debugState().showTensorGenerator}>
  <TensorMapView />
</Show>
```

---

## 7. Verification Criteria — Phase 1

Phase 1 is **done** when:

1. `npm run dev` compiles with zero TS errors related to tensor files.
2. Navigating to the tensor map view shows a canvas with the dat.gui panel.
3. Clicking "generate" in dat.gui produces visible roads on the canvas.
4. Pan (drag) and zoom (scroll) work within the component.
5. Multiple colour schemes can be selected.
6. The rest of the game UI is unaffected (no global CSS leaks, no DOM ID conflicts).
7. `MapGenerator-backup/` is completely untouched.
8. `MapGenerator-master/` is completely untouched.

---

## 8. Phase 2 Preview — Replace dat.gui

After Phase 1 is verified:

1. Create a SolidJS panel component mirroring dat.gui controls.
2. Extract a `MapGeneratorAPI` class from `Main`:
   - `generate(): void`
   - `setColourScheme(name: string): void`
   - `getStreamlines(): Vector[][]`
   - `getPolygons(): Vector[][]`
   - `getBuildings(): BuildingModel[]`
3. Remove dat.gui dependency.
4. Remove interactjs — implement drag with pointer events.
5. Remove singleton `DomainController` — use per-instance.

---

## 9. Phase 3 Preview — Bridge to CityMap

After Phase 2:

1. Extract roads as `TensorRoadSegment[]` from `StreamlineGenerator`.
2. Convert `Vector[][]` streamlines → `RoadEdge[]` with `source: "tensor-road"`.
3. Extract block polygons from `PolygonFinder` → `CityBlock[]`.
4. Wire into `buildCityV35` pipeline:
   - Reuse existing terrain, coast roads, bridges.
   - Tensor generates interior roads only.
   - Blocks assigned to districts via existing `makeMainlandDistricts`.
5. Run existing downstream: parcels, buildings, routing, venues.
6. Render via existing `createCityMapRenderModel`.

This is the point where the v0.1 spec's §9 pipeline becomes relevant.

---

## 10. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| simplex-noise@2 vs @3 API break | Build failure | Pin `simplex-noise@2.4.0` |
| isect has no ESM export | Build failure | Use dynamic import or bundler shim |
| dat.gui CSS conflicts with Tailwind | Visual glitches | Scope dat.gui styles |
| Three.js version mismatch | model_generator.ts breaks | Stub STL export for Phase 1 |
| DomainController singleton + multiple instances | State corruption | Phase 1: single instance; Phase 2: DI |
| Performance (large map in game UI) | Jank | Generate off-screen, render result |
| `const enum` across file boundaries | TS compile error | Convert to regular enum |

---

## 11. Files NOT to Touch

- `services/playgame/city-map/tensor-working/MapGenerator-master/*` — reference only
- `services/playgame/city-map/tensor-working/MapGenerator-backup/*` — backup only
- `services/playgame/city-map/tensor-broken/*` — previous attempt, keep for reference
- `services/playgame/city-map/city-v35.ts` — not yet (Phase 3)
- `services/playgame/city-map/types.ts` — not yet (Phase 3)
- `services/playgame/city-map/index.ts` — not yet (Phase 3)

---

## 12. Implementation Order (Phase 1)

```
 1. Create services/playgame/city-map/tensor/ directory
 2. Copy impl/ files from MapGenerator-master/src/ts/impl/
 3. Copy ui/ files from MapGenerator-master/src/ts/ui/
 4. Copy vector.ts, util.ts, colour_schemes.json
 5. Fix all import paths for new directory structure
 6. Fix ESM imports (SimplexNoise, simplify, loglevel, etc.)
 7. Fix const enum → enum
 8. Install npm dependencies
 9. Create TensorMapView.tsx (SolidJS wrapper)
10. Create boot.ts (adapted Main class)
11. Override element IDs / scoped DOM lookups
12. Add dev route or debug toggle
13. Fix CSS scoping
14. Test: compile, render, generate
15. Fix any remaining TS 5.8 issues
16. Verify all 7 criteria from §7
```

Estimated effort: 4–8 hours for a developer familiar with both codebases.
