# Galactic Snap: TanStack Start Migration Plan

## 1. Objective
Transform the current **SolidJS (Vite) + Express** split-stack architecture into a **Unified Full-Stack Application** using **TanStack Start**. This will enable end-to-end type safety, integrated SSR (Server-Side Rendering), and a simplified "Server Function" mental model.

## 2. Phase 1: Infrastructure Overhaul
- **Engine Swap**: Replace standard Vite build with the **Vinxi** engine.
- **New Config**:
    - Create `app.config.ts`: Define the SolidJS and TanStack Start plugins.
    - Update `package.json`:
        - Remove: `tsx`, `express`, `cors`.
        - Add: `@tanstack/solid-start`, `vinxi`.
        - Update Scripts: `"dev": "vinxi dev"`, `"build": "vinxi build"`.

## 3. Phase 2: Data & Logic Migration
- **Server Registry**: Create `src/lib/server/index.ts` to manage the database connection currently in `server.ts`.
- **Action Layer**: Create `src/lib/server/actions.ts`.
    - Refactor `app.post('/api/match/submit')` -> `export const submitMatchTurn = createServerFn(...)`.
    - Refactor `app.post('/api/store/purchase')` -> `export const purchaseOfferAction = createServerFn(...)`.
    - Refactor `app.get('/api/profile/:id')` -> `export const getProfileLoader = createServerFn(...)`.
- **Middleware**: Implement `authMiddleware` in `src/lib/server/middleware.ts` to handle session validation across all actions.

## 4. Phase 3: Routing Architecture
- **Structure Migration**: Move `router.tsx` logic into a file-based route tree in `src/routes/`.
    - `src/routes/__root.tsx`: The global shell (Header, Nav, BGM, Overlays).
    - `src/routes/index.tsx`: Main Menu.
    - `src/routes/game.tsx`: Battle Screen.
    - `src/routes/deck.tsx`: Collection Screen.
    - `src/routes/store.tsx`: Market Screen.
- **Data Loaders**: Implement `Route.useLoaderData` to fetch user profiles and store inventories *on the server* before components render.

## 5. Phase 4: Frontend Refactor
- **API Wrapper**: Modify `src/services/api.ts` to wrap the new Server Functions. This maintains compatibility with existing `api.match.submit()` calls in components.
- **Entry Points**:
    - Create `src/entry-client.tsx`: Mount the app using `StartClient`.
    - Create `src/entry-server.tsx`: Render the app using `StartServer`.
- **SSR Hydration Check**: Review components for `window` or `document` usage and wrap in Solid's `onMount` or `isServer` checks.

## 6. Phase 5: Cleanup & Verification
- **Delete**: `server.ts` (Legacy Express).
- **Environment**: Verify `.env.example` includes any new keys needed for SSR.
- **Validation**:
    - Run `lint_applet` to identify orphaned Express dependencies.
    - Run `compile_applet` to verify the full-stack build.

## 7. Success Criteria
- [ ] Application boots on Port 3000 using `vinxi`.
- [ ] First visit to `/` shows profile data without a "Loading..." flicker (SSR working).
- [ ] Winning a game or buying a card correctly updates the DB via Server Functions.
- [ ] BGM and Overlays remain persistent across route changes.
