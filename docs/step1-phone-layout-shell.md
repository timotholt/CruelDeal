# Step 1: Phone Layout Shell for Tensor Map

**Depends on:** tensor-to-citymap-migration.md (context only — no code deps)
**Unblocks:** Step 2 (debug menu tabs), Step 3 (island clipping), Step 4 (routing)

---

## Goal

Mount the tensor map generator inside the existing 9:16 phone board layout
(header, map area, hand row, action bar) so it looks and feels like a real
game screen — not a standalone full-page canvas with dat.gui floating over it.

The tensor canvas replaces the SVG/Three renderer area. The surrounding chrome
(HUD, hand, action bar) stays exactly as it is today.

---

## Current State

**Tensor map** (`/dev/tensor` route):
- Full-page `<div>` + `<canvas>` filling the viewport
- `dat.gui` floating top-right
- No game chrome, no HUD, no hand row
- Managed by `TensorMapView.tsx` → `boot.ts`

**Game board** (`/play` route):
- 9:16 column centered in viewport (`--board-w`, `--board-h`)
- `board-wrap` → `board` → `hud-top` + `board-game-area` + `hand-row` + `action-bar`
- `board-game-area` holds `CityMapBoard` → SVG/Three renderers
- CSS in `src/styles/playgame.css`, key vars:
  ```
  --board-w: min(calc(100vh * 9 / 16), 100vw, 420px);
  --board-h: calc(var(--board-w) * 16 / 9);
  ```

---

## Architecture Decision

**Do NOT embed the tensor canvas inside `CityMapBoard`.**

`CityMapBoard` consumes a `CityMap` data object. The tensor generator is not
yet producing `CityMap` objects (that's the adapter work in the migration doc).
Instead, create a parallel game-shell component that hosts the tensor canvas
in the same 9:16 chrome.

This keeps the two paths independent until the adapter is ready.

---

## New Component

Create `components/screens/TensorPlayScreen.tsx`:

```
TensorPlayScreen
  ├── board-wrap (existing CSS)
  │   └── board city-game-board (existing CSS)
  │       ├── hud-top (player chips, turn orb)
  │       ├── tensor-game-area (NEW — replaces board-game-area)
  │       │   └── <canvas> (tensor map, sized to fill this area)
  │       ├── city-hand-row (cards)
  │       └── city-action-bar (buttons)
```

### Key constraints

1. **Canvas must fill `tensor-game-area`** — not the whole viewport.
   `DomainController` already uses `getContainerWidth()` / `getContainerHeight()`
   from `tensor/context.ts`, so it will size correctly if we pass the right
   container element.

2. **dat.gui must be scoped to the container** — `new dat.GUI({ autoPlace: true })`
   appends to `document.body`. We need to either:
   - Set `autoPlace: false` and manually append to the container, or
   - Keep `autoPlace: true` and accept it floats over the phone layout
     (acceptable for now — Step 2 replaces it anyway).

3. **The canvas aspect ratio will NOT be 1:1** — the game area is roughly
   9:14 (board width × remaining height after HUD/hand/action). The tensor
   generator works with arbitrary `worldDimensions` so this is fine — just
   pass the container size.

---

## Work

### 1. Create `TensorPlayScreen.tsx`

```tsx
// components/screens/TensorPlayScreen.tsx
import { onMount, onCleanup } from 'solid-js';
import { boot } from '@/services/playgame/city-map/tensor/boot';
import Util from '@/services/playgame/city-map/tensor/util';
import '@/src/styles/playgame.css';

export const TensorPlayScreen = () => {
  let areaRef: HTMLDivElement | undefined;
  let canvasRef: HTMLCanvasElement | undefined;

  onMount(() => {
    if (!areaRef || !canvasRef) return;
    const { cleanup } = boot(areaRef, canvasRef);
    onCleanup(cleanup);
  });

  return (
    <div class="playgame-root city-play-root" style={{ width: '100%', height: '100%', background: '#000' }}>
      <div class="board-wrap">
        <div class="board city-game-board ready">
          {/* HUD — simplified for now */}
          <div class="hud-top city-game-board__hud">
            <div class="hud-top__center" style="flex:1; text-align:center">
              <span style="font-family:var(--font-mono); font-size:10px; color:var(--muted); letter-spacing:0.1em">
                TENSOR MAP
              </span>
            </div>
          </div>

          {/* Map area — tensor canvas lives here */}
          <div ref={areaRef} class="board-game-area city-map-game-area"
               style="position:relative; overflow:hidden">
            <canvas
              id={Util.CANVAS_ID}
              ref={canvasRef}
              style="position:absolute; inset:0; width:100%; height:100%"
            />
          </div>

          {/* Hand row placeholder */}
          <div class="city-hand-row" style="min-height:60px" />

          {/* Action bar */}
          <div class="action-bar city-action-bar">
            <button class="end-turn" type="button">GENERATE</button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### 2. Add route

In `router.tsx`, add a new dev route:

```tsx
const devTensorPlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/tensor-play',
  component: () => {
    const TensorPlayScreen = lazy(() =>
      import('./components/screens/TensorPlayScreen').then(m => ({ default: m.TensorPlayScreen }))
    );
    return <TensorPlayScreen />;
  },
});
```

### 3. Adjust `boot.ts` for non-square containers

`boot.ts` currently works fine — `DomainController` reads container size
from `context.ts`. The only issue is `dat.gui` placement. For now, use
`autoPlace: false` and append the GUI element into the container:

```ts
const gui = new dat.GUI({ autoPlace: false });
container.appendChild(gui.domElement);
gui.domElement.style.position = 'absolute';
gui.domElement.style.top = '0';
gui.domElement.style.right = '0';
gui.domElement.style.zIndex = '10';
```

### 4. Handle tall/narrow aspect ratio

The old map uses `VIEW_W=1440, VIEW_H=1792` (≈9:11). The tensor generator
uses `worldDimensions` which can be set to any size. In `boot.ts`, compute
world dimensions from the container aspect:

```ts
const BASE_SIZE = 800;
const aspect = container.clientWidth / container.clientHeight;
const worldW = aspect >= 1 ? BASE_SIZE : BASE_SIZE * aspect;
const worldH = aspect >= 1 ? BASE_SIZE / aspect : BASE_SIZE;
```

This ensures the generated city fills the visible area regardless of phone
aspect ratio.

---

## What This Does NOT Do

- Does not produce `CityMap` objects (that's the adapter)
- Does not replace the real `/play` route (that still uses `CityMapBoard`)
- Does not remove dat.gui (that's Step 2)
- Does not add slots, districts, or routing (Steps 3-4)

---

## Acceptance

- `/dev/tensor-play` shows 9:16 phone layout with tensor canvas in the middle
- HUD bar visible at top
- Hand row / action bar visible at bottom
- Canvas fills the game area, not the whole screen
- Zoom/pan still work within the canvas area
- dat.gui controls accessible (positioned inside the game area)
- Generate produces a city map that fits the visible area
