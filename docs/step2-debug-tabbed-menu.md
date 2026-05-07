# Step 2: Tabbed Debug Menu (Replace dat.gui)

**Depends on:** Step 1 (phone layout shell — canvas in 9:16 chrome)
**Unblocks:** All future UI iteration (styles, options, download stay accessible)

---

## Goal

Replace dat.gui with a SolidJS tabbed debug panel. Two tabs:

- **Tab 1 — Generation**: all tensor map controls (zoom, generate, tensor field,
  map params, style, options, download)
- **Tab 2 — Debug**: existing `CityMapDebugState` toggles from the current
  `CityMapDebugDock`

This consolidates both control panels into one unified UI that works on phones.

---

## Why Replace dat.gui

1. **dat.gui is not touch-friendly** — tiny sliders, no scroll, clips on small
   screens.
2. **dat.gui appends to body** — fights with the 9:16 layout. Scoping it is
   hacky.
3. **dat.gui can't share state with SolidJS** — every control uses callbacks
   with no reactive integration. Changes in the tensor engine don't reflect
   in the UI and vice versa.
4. **Two separate debug UIs** — dat.gui for tensor, `CityMapDebugDock` for
   game board. Merging them into one panel reduces confusion.

---

## Current dat.gui Structure (from `boot.ts`)

```
zoom        (slider 0.2–5)
generate    (button)
▶ Tensor Field
    (basis fields, noise, park noise, etc.)
▶ Map
    (coastline params, road params, building params)
▶ Style
    colourScheme (dropdown)
    zoomBuildings (checkbox)
    buildingModels (checkbox)
    showFrame (checkbox)
    orthographic (checkbox)
    cameraX, cameraY (sliders)
▶ Options
    drawCentre (checkbox)
    highDPI (checkbox)
▶ Download
    imageScale (slider 1–5)
    PNG (button)
```

## Current CityMapDebugDock Structure

```
City Map, Three, Road-Face Blocks, PM2001 Roads,
Road Corridors, Buildings, Roads, Labels, Landmarks,
Slots, Route Demo, Planning, Wireframe, Districts,
Arterials, Islands, Mass, Seed Info, Tensor Field,
Tensor Seeds, Rejected Roads, SVG Pan Perf
(all checkboxes)
```

---

## New Component

Create `components/debug/TensorDebugPanel.tsx`:

```
TensorDebugPanel
  ├── drag handle (reuse from CityMapDebugDock)
  ├── collapse toggle
  ├── tab bar: [Generation] [Debug]
  │
  ├── Tab: Generation
  │   ├── Generate button (prominent)
  │   ├── Zoom slider
  │   ├── Section: Tensor Field (collapsible)
  │   ├── Section: Map (collapsible)
  │   ├── Section: Style (collapsible)
  │   │   ├── colourScheme dropdown
  │   │   ├── zoomBuildings, buildingModels, showFrame toggles
  │   │   ├── orthographic toggle
  │   │   └── cameraX, cameraY sliders
  │   ├── Section: Options (collapsible)
  │   │   ├── drawCentre, highDPI toggles
  │   └── Section: Download (collapsible)
  │       ├── imageScale slider
  │       └── PNG button
  │
  └── Tab: Debug
      ├── (all CityMapDebugState rows)
      └── road generation mode selector
```

---

## Data Flow

### Problem: dat.gui talks to classes imperatively

Currently `boot.ts` creates class instances (`TensorFieldGUI`, `MainGUI`,
`RoadGUI`, `WaterGUI`, `Buildings`) and passes dat.gui folders into their
constructors. The classes self-register controls.

### Solution: Extract a config object, keep classes

Don't rewrite the tensor engine classes. Instead:

1. **Define a reactive config store** that mirrors what dat.gui controlled:
   ```ts
   interface TensorMapConfig {
     zoom: number;
     colourScheme: string;
     zoomBuildings: boolean;
     buildingModels: boolean;
     showFrame: boolean;
     orthographic: boolean;
     cameraX: number;
     cameraY: number;
     drawCentre: boolean;
     highDPI: boolean;
     imageScale: number;
     // Tensor field params (nested)
     // Road params (nested)
     // Water params (nested)
   }
   ```

2. **On config change, push values into the engine classes** — same as what
   the dat.gui `.onChange()` callbacks do today. This is a thin bridge, not
   a rewrite.

3. **On generate, call `mainGui.generateEverything()`** — same as today.

### Phase approach

**Phase A (quick):** Keep dat.gui but HIDE it. Build the SolidJS panel that
calls the same functions via refs. dat.gui still exists underneath as the
state owner — the SolidJS panel just mirrors and drives it.

**Phase B (clean):** Remove dat.gui entirely. SolidJS panel becomes the state
owner. Engine classes receive config via setter methods instead of dat.gui
folders.

Recommendation: Do Phase A first. It's safe, testable, and lets us verify
the phone panel works before touching engine internals.

---

## Styling

The panel should match the existing game chrome:
- Background: `var(--panel)` with `backdrop-filter: blur(12px)`
- Font: `var(--font-mono)` at 10px
- Accent: `var(--accent)` for active tab
- Toggles: small pill switches, not checkboxes
- Sliders: styled range inputs
- Sections: collapsible with `▶` / `▼` chevrons
- Mobile: panel slides up from bottom edge, max-height 50vh, scrollable

---

## Work

### 1. Create config store

```ts
// services/playgame/city-map/tensor/config-store.ts
import { createStore } from 'solid-js/store';

export const [tensorConfig, setTensorConfig] = createStore<TensorMapConfig>({
  zoom: 1,
  colourScheme: 'Default',
  // ... defaults matching boot.ts
});
```

### 2. Create TensorDebugPanel component

- Render tabs + collapsible sections
- Read from `tensorConfig`
- On change, call `setTensorConfig` which triggers effects
- Generate button calls an exposed `generate()` function

### 3. Bridge to boot.ts

Export control functions from `boot.ts` that the panel can call:
```ts
export interface TensorControls {
  generate: () => void;
  setZoom: (z: number) => void;
  changeColourScheme: (scheme: string) => void;
  // etc.
}
```

### 4. Wire into TensorPlayScreen

```tsx
<TensorDebugPanel controls={controls()} config={tensorConfig} />
```

### 5. Remove dat.gui dependency (Phase B)

- Remove `dat.gui` from `package.json`
- Remove all `dat.GUI` imports from tensor code
- Engine classes receive params directly instead of self-registering

---

## Acceptance

- Phone-sized screen shows the tabbed panel (not dat.gui)
- Generation tab: can change colour scheme, click generate, adjust zoom
- Debug tab: all existing toggles present and functional
- Panel is draggable and collapsible
- Panel doesn't obscure the map when collapsed
- All dat.gui functionality is reachable through the panel
