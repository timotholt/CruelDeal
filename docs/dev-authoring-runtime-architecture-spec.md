---
title: Dev, Authoring, and Runtime Architecture Spec
status: draft
owner: Platform / Tools / Game Client
---

# Dev, Authoring, and Runtime Architecture Spec

## Purpose

CruelDeal is moving toward three related but separate application concerns:

- **Game runtime/server**: the real game backend and web server, targeting TanStack Start.
- **Game clients**: the shipped player experiences, including web and future Tauri-packaged clients.
- **Authoring/dev tools**: internal tools for editing, previewing, validating, and exporting game UI/content/materials.

The current `/dev` path is the beginning of the authoring/dev surface. Over time, the test screens and labs currently scattered across root-level routes should migrate into `/dev` and eventually into a separate authoring codebase or at least a separate top-level folder.

## Current Observed State

The current app has a mixed route model:

- **Primary gameplay routes**
  - `/`
  - `/game`
  - `/play`
  - `/deck`
  - `/season`
  - `/store`
  - `/profile`
  - `/inbox`
  - `/history`
  - `/settings`
  - `/rank`
  - `/progression`

- **Current `/dev` routes**
  - `/dev`
  - `/dev/icons`
  - `/dev/ui-node`
  - `/dev/card-frame`
  - `/dev/tensor`
  - `/dev/tensor-play`

- **Dev/test routes still outside `/dev`**
  - `/icons`
  - `/uitest`
  - `/main-material`
  - `/login-material`
  - `/ui-node`
  - `/game-ui-skin-proof`
  - `/gametext-test`
  - `/gametextv2-test`

`App.tsx` currently has a dev index and bypasses normal login/providers for `/dev` and several root-level test routes. `router.tsx` also defines some `/dev/*` routes. This is useful today, but it shows that dev/authoring concerns are still mixed into the player app.

## Core Architecture Principle

Authoring and runtime should be separated by application boundary, not by duplicated rendering logic.

Authoring tools should live outside the shipped player client, but final previews inside authoring must import the same runtime modules used by the player client.

In short:

- **Separate authoring app/folder**: yes.
- **Separate final rendering implementation**: no.
- **Editor wrappers and diagnostics**: yes.
- **Duplicate client renderer**: no.

## Target Applications

### 1. Game Server / Web Runtime

Target future shape:

- TanStack Start application.
- Owns server routes, session/auth, data loading, and deployment runtime.
- Serves or coordinates the web game client.
- Integrates with CMS/content APIs and backend game services.

This should be the production web entrypoint, not the authoring workbench.

### 2. Game Clients

Future clients may include:

- Web client.
- Tauri-packaged desktop client.
- Tauri-packaged iOS client if/when mobile support is adopted.
- Tauri-packaged Android client if/when mobile support is adopted.

Clients should consume shared runtime packages where possible:

- Game rules/contracts.
- Content manifests.
- Material manifests.
- UI skin manifests.
- Asset references.
- Portable rendering data.

Because the UI direction is SolidJS, the preferred client model is to keep the production UI in shared Solid runtime packages and host/package it through the appropriate shell. TanStack Start owns the web/server runtime. Tauri owns packaged client shells. The authoring app may also use SolidJS, but it must be built separately from shipped game clients.

Not every platform integration module will be shared across Tauri targets, but the runtime UI packages, material manifests, content contracts, and game data contracts should stay shared where practical.

### 3. Authoring / Dev Tools

The authoring/dev app combines current `/dev` and test/lab surfaces:

- Material editor.
- Metallic material workbench.
- Icon lab.
- UI node preview.
- Main/login material previews.
- Game text labs.
- Game UI skin/CMS proof.
- Card frame lab.
- Tensor/city-map experiments.
- Future content/template/CMS editors.

It may eventually become:

- A separate codebase.
- A separate package in a monorepo.
- A separate top-level folder with its own entrypoint/build.
- A separate TanStack Start app if it needs server-side authoring features.

## Proposed Folder Direction

A future structure could look like:

```txt
apps/
  game-web/
    # TanStack Start production web/server game
  game-tauri/
    # Tauri shell for packaged desktop/mobile clients
  authoring/
    # Dev/authoring app replacing current /dev and root-level labs

packages/
  game-runtime/
    # game rules, shared domain logic, contracts
  ui-runtime/
    # production UI primitives and skins
  material-runtime/
    # locked metals/material renderer data and helpers
  content-contracts/
    # CMS/template manifests and validators
  authoring-tools/
    # editor-only widgets, inspectors, exporters
```

The current repository does not need to jump there immediately. The important near-term step is to stop adding new test tools as root-level player routes and migrate them under `/dev`.

## Runtime vs Authoring Dependency Rule

Dependencies must flow one way:

```txt
authoring/dev tools
  -> runtime UI/material/game packages
  -> shared content contracts
```

Runtime packages must never import authoring packages.

Allowed:

- Authoring imports `material-runtime` to render final material previews.
- Authoring imports `ui-runtime` to render the exact client component.
- Authoring wraps runtime components with handles, debug panels, JSON readouts, and exporters.
- TanStack Start and Tauri apps import the same runtime UI/material packages for shipped client rendering.

Disallowed:

- Game client imports editor controls.
- Runtime renderer imports authoring-only profile data.
- Production components depend on `/dev` screens.
- Authoring keeps its own separate final renderer that only approximates the client.

## Shared Runtime Preview Requirement

Every authoring tool that previews shippable content should provide a client-parity preview.

The client-parity preview must:

- Import the same runtime component/package as the game client.
- Use the same runtime manifest or generated artifact as the game client.
- Run through the same material/skin/content resolution path.
- Expose bugs in the real runtime path instead of hiding them behind an editor-only renderer.

Authoring may also provide draft/editor previews, but those are advisory. Client-parity preview is authoritative.

## `/dev` Route Strategy

### Near Term

Keep `/dev` inside the current Vite/Solid app, but treat it as a staging area for authoring tools.

Actions:

- Make `/dev` the canonical entrypoint for test/lab links.
- Add `/dev/*` aliases for all current root-level test routes.
- Stop adding new root-level test routes.
- Update the dev index so every lab is reachable from `/dev`.
- Mark old root-level test routes as legacy aliases.

### Mid Term

Move dev screens into a folder that communicates intent, such as:

- `components/dev/`
- `dev/screens/`
- `authoring/screens/`

Keep shared runtime components in production-safe runtime folders.

### Long Term

Split authoring/dev into its own app or package.

Possible result:

- production game web app no longer includes authoring routes in its bundle
- Tauri client builds do not include authoring routes or editor modules
- authoring app imports runtime packages for final preview
- authoring app has its own auth, data loading, CMS editing, export, and validation flows

## Existing Routes to Migrate Under `/dev`

Recommended aliases or migrations:

- `/icons` -> `/dev/icons`
- `/uitest` -> `/dev/material-ui`
- `/main-material` -> `/dev/main-material`
- `/login-material` -> `/dev/login-material`
- `/ui-node` -> `/dev/ui-node`
- `/game-ui-skin-proof` -> `/dev/game-ui-skin-proof`
- `/gametext-test` -> `/dev/gametext-v1`
- `/gametextv2-test` -> `/dev/gametext-v2`

The old routes can remain temporarily as redirects or aliases while bookmarks and workflow links are updated.

## Authoring Tool Categories

### Material and Visual Authoring

- Metallic material workbench.
- Main material editor.
- Login material preview.
- UI skin proof.
- Card frame lab.
- Icon lab.

These tools should use runtime rendering for final previews.

### Content and CMS Authoring

- UI template/content contract previews.
- Promo placement tools.
- Server-driven node payload previews.
- Copy/localization previews.

These tools should validate exported content against runtime schemas.

### Gameplay/Map Experiments

- Tensor map generator.
- Tensor play shell.
- City-map experiments.

These may remain more experimental, but any promoted runtime feature should move into shared runtime/game packages.

## Build and Bundle Goal

Production game builds should not include authoring screens unless explicitly building a dev/authoring target.

This means the future build matrix should separate:

- `game-web:dev`
- `game-web:build`
- `game-tauri:dev`
- `game-tauri:build`
- `authoring:dev`
- `authoring:build`

The current `vite` app can continue as a bridge, but the direction should be separate entrypoints.

TanStack Start and Tauri should be treated as separate app targets that share runtime packages:

- `game-web` builds the production web/server app with TanStack Start.
- `game-tauri` builds the packaged client shell with Tauri.
- `authoring` builds the internal tools app.

The authoring app can use TanStack Start too if it needs server-side authoring features, but it should still be a separate target from the production game app.

## Migration Plan

### Phase 1: Consolidate Routes

- Add `/dev` links for every current test/lab route.
- Prefer `/dev/*` links in docs and workflow notes.
- Keep old routes as temporary aliases.

### Phase 2: Separate Screens by Intent

- Move dev/lab screens out of generic `components/screens`.
- Keep production screens separate from authoring screens.
- Ensure authoring screens import runtime components rather than copying them.

### Phase 3: Extract Runtime Packages

- Extract material runtime.
- Extract UI runtime/skin registry.
- Extract content contracts and validators.
- Ensure authoring imports those packages for final preview.

### Phase 4: Separate App Entrypoints

- Create an authoring entrypoint or app.
- Remove authoring route bypasses from the production app entrypoint.
- Move `/dev` index into authoring app.

### Phase 5: TanStack Start and Tauri App Targets

- Move production web game to TanStack Start when ready.
- Define server/client data boundaries.
- Add a Tauri packaged-client target that imports the same shared Solid runtime UI packages.
- Keep authoring tools separate from the production game server and Tauri client bundles unless they intentionally share backend APIs or runtime packages.

## Open Decisions

- Should authoring be a separate app inside this repo or a separate repository?
- Should authoring use TanStack Start or remain a client-heavy app with API calls?
- Which runtime packages must be portable to Tauri desktop/mobile targets?
- Which current `/dev` experiments should become production runtime modules?
- Should old root-level test routes redirect or be removed after migration?

## Recommendation

Use `/dev` now as the consolidation point, but design it as a temporary bridge toward a true authoring app.

The final architecture should have a separate authoring/dev surface that imports shared runtime packages for client-parity preview. That gives the authoring team freedom to build heavy tools without bloating the player client, while still guaranteeing that final previews reveal the exact behavior the game client will ship.
