# Galactic Snap: SolidJS Migration Guide

This document outlines the architectural shift and file-by-file changes required to migrate Galactic Snap from React to SolidJS. With 60+ files, we will use a **Pattern-Based Approach** to ensure consistency.

## 1. Architectural Philosophy Shift

### From "Re-render" to "Execution Once"
- **React**: Components are functions that re-execute every time state changes. 
- **SolidJS**: Components are setup functions that run **exactly once**. JSX is compiled to fine-grained DOM updates.

### Destructuring Props (CRITICAL)
- **React**: `const { card, size } = props;` is common.
- **SolidJS**: **DO NOT** destructure props. Use `props.card` and `props.size`. Destructuring breaks reactivity in Solid.

---

## 2. Pattern-Based Migration (60+ Files)

### Category A: Card Definitions (`/cards/*.ts`)
*   **Total Files**: ~15
*   **Status**: Mostly compatible.
*   **Action**: No changes needed to the definitions themselves as they are pure data/logic.

### Category B: Presentational UI (`/components/**/*.tsx`)
*   **Total Files**: ~30
*   **Changes**:
    1.  Replace `className` with `class`.
    2.  Replace `React.FC<Props>` with `Component<Props>`.
    3.  Remove all `React.memo()` wrappers. In Solid, components don't re-render, so manual memoization of components is obsolete.
    4.  Convert `onClick={(e) => ...}` to `onClick={(e) => ...}` (standard HTML events).

### Category C: State & Contexts (`/contexts/*.tsx`)
*   **Total Files**: ~3
*   **Action**: High complexity.
    1.  Swap `useState` for `createSignal` or `createStore` (for deep objects like UserProfile).
    2.  Use `createStore` for the `user` object in `UserContext.tsx` to allow nested updates like `setUser("decks", deckId, (ids) => [...ids, newId])`.

---

## 3. Surgical Examples (Code Comparison)

### `Card.tsx` (Deep Memo Removal)
**React (Current):**
```tsx
export const Card = React.memo(CardComponent, (prev, next) => {
    return prev.card.instanceId === next.card.instanceId;
});
```
**Solid (Target):**
```tsx
// Just export the component. Updates are handled at the property level.
export const Card: Component<CardProps> = (props) => {
  return <UnifiedCardView card={props.card} size={props.size} />;
};
```

### `useSpatialNavigation.ts` (Hook Transition)
**React (Current):**
```tsx
const [activeScreen, setActiveScreen] = useState<ScreenKey>('MENU');
const containerStyle = { transform: `translate3d(${x}%, ${y}%, 0)` };
```
**Solid (Target):**
```tsx
const [activeScreen, setActiveScreen] = createSignal<ScreenKey>('MENU');
// Use a function or memo for dynamic styles
const containerStyle = () => ({ transform: `translate3d(${x()}%, ${y()}%, 0)` });
```

---

## 4. The "Big Three" Complexity Blockers

### 1. PixiJS (`GameBoard.tsx`)
- **Challenge**: `@pixi/react` keeps Pixi objects in sync with React lifecycle.
- **Solution**: Use `onMount` to initialize a `new PIXI.Application()` and attach it to a `ref`. Manually manage the Pixi stage updates via Solid's effects.

### 2. Animations (`motion/react`)
- **Challenge**: Framer Motion is React-exclusive.
- **Solution**: Use **Solid Transition Group** for presence animations (fade in/out) and simple CSS transitions + `class:active={signal()}` for movement.

### 3. Drag and Drop (`useDragAndDrop.ts`)
- **Challenge**: React-based event handling.
- **Solution**: Use `solid-dnd` or direct PointerEvent listeners. Since Solid is closer to the metal, raw PointerEvents are often easier to manage.

---

## 5. Migration Checklist per File

For every `.tsx` file, perform these 5 checks:
- [ ] Remove `import React`. Add `import { Component, createSignal, ... } from "solid-js"`.
- [ ] Rename `className` -> `class`.
- [ ] Swap `const [s, setS] = useState` -> `const [s, setS] = createSignal`.
- [ ] Change `s` usage in JSX to `s()` (if it's a signal).
- [ ] Remove all `useMemo`, `useCallback`, and `useEffect` dependency arrays.

## 7. Phase-Based Implementation Plan

To prevent a "broken build" state for weeks, follow these incremental phases.

### Phase 1: Environment & Foundation (Infrastructure First)
*   **Target**: Get the build system running with SolidJS.
*   **Tasks**:
    1.  Install `solid-js`, `vite-plugin-solid`.
    2.  Remove React dependencies.
    3.  Update `tsconfig.json` (JSX transform settings).
    4.  Update `vite.config.ts` (Swap plugins).
    5.  Update `index.tsx` (Use Solid's `render`).
*   **Success Metric**: `npm run build` completes (even if UI is broken).

### Phase 2: Reactive State Layer (The Core)
*   **Target**: Convert the global state from React Context to Solid Stores.
*   **Files**: `UIContext.tsx`, `UserContext.tsx`, `useSpatialNavigation.ts`.
*   **Tasks**:
    1.  Convert `useUser` context provider to use `createStore`.
    2.  Migrate `UserContext` side effects (`useEffect` for syncing) to `createEffect`.
*   **Success Metric**: Data services are reactive across the app shell.

### Phase 3: Atomic Components & Shared UI (The Blocks)
*   **Target**: Port 80% of the UI components that don't have complex logic.
*   **Sub-Phases**:
    1.  **Shared UI**: `HexButton.tsx`, `SlantedButton.tsx`, `CurrencyDisplay.tsx`.
    2.  **Card Visuals**: `UnifiedCardView.tsx`, `CardBadge.tsx`, `GenomeBadge.tsx`.
*   **Tasks**: Pattern-match `className` -> `class` and `props` access.
*   **Success Metric**: Visual cards and buttons render correctly in isolation.

### Phase 4: Shell, Navigation & Screens (The Framework)
*   **Target**: Restore the spatial navigation and main menu flow.
*   **Files**: `App.tsx`, `NavigationBar.tsx`, `MainMenuScreen.tsx`, `ProfileScreen.tsx`.
*   **Tasks**:
    1.  Implement the spatial world map logic in `App.tsx` using `<For>` and `<Show>`.
    2.  Port the transition logic (500ms CSS transforms).
*   **Success Metric**: Able to "fly" between screens (Main Menu, Profile, Store).

### Phase 5: High-Complexity Modules (The Game)
*   **Target**: Functional card game and deck building.
*   **Files**: `GameContext.tsx`, `GameBoard.tsx`, `DeckScreen.tsx`, `useDragAndDrop.ts`.
*   **Critical Logic**: 
    1.  **DND**: Replace React's pointer state tracking with Solid-compatible listeners.
    2.  **PixiJS**: Re-implement the `GameBoard` canvas initialization inside `onMount`.
*   **Success Metric**: Dragging a card into a lane works.

### Phase 6: VFX, Polish & Cleanup (The Finish)
*   **Target**: Restoration of audio and visual effects.
*   **Files**: `VfxLayer.tsx`, `audio.ts`, `services/effects.ts`.
*   **Tasks**:
    1.  Convert Framer Motion effects to standard CSS animations or `solid-transition-group`.
    2.  Verify `howler` audio triggers are still firing correctly (should be unaffected mostly).

## 8. Implementation Schedule (Estimated Effort)

| Phase | Est. Time | Complexity |
| :--- | :--- | :--- |
| **P1** | 2 Hours | Low |
| **P2** | 6 Hours | High (Critical Path) |
| **P3** | 8 Hours | Medium (Repetitive) |
| **P4** | 4 Hours | Medium |
| **P5** | 12 Hours | Very High |
| **P6** | 4 Hours | Low |
