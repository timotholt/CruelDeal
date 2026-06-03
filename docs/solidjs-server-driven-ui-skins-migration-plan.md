# SolidJS Server-Driven UI And Downloadable Skins Migration Plan

Status: active
Date: 2026-06-03

## Goal

Move the game UI toward trusted SolidJS runtime rendering that can be driven by server-delivered UI data and downloadable skins, without sending arbitrary HTML, CSS, or JavaScript over the wire.

The server sends validated data. The client owns rendering, actions, accessibility, and safety.

```txt
Server skin/node payload
  -> client validation
  -> recipe/skin resolution
  -> material emission plan
  -> trusted SolidJS runtime DOM/CSS
```

## Non-Goals

- Do not rewrite the whole game UI in one pass.
- Do not send raw Solid components, executable JavaScript, or arbitrary CSS from the server.
- Do not replace working legacy UI until a component family has runtime proof.
- Do not make the material editor the runtime renderer.

## Core Contracts

### Skin Manifest

Skins should be downloadable data packages with explicit compatibility and asset boundaries.

```ts
interface SkinManifest {
  id: string;
  version: string;
  displayName: string;
  appliesTo: string[];
  compatibility: {
    minClientVersion: string;
    materialSchemaVersion: string;
  };
  assets: SkinAsset[];
  recipePatches: Record<string, MaterialRecipePatch>;
}
```

### UI Node Payload

Server-driven UI should describe trusted node intent, not markup.

```ts
interface UiNodePayload {
  id: string;
  type: 'button' | 'panel' | 'text' | 'image' | 'slot';
  variant?: string;
  materialId?: string;
  skinId?: string;
  layout?: UiLayoutPayload;
  contentBinding?: string;
  stateModel?: 'static' | 'momentary' | 'selectable' | 'disclosure';
  action?: {
    id: string;
    params?: Record<string, string | number | boolean>;
  };
  children?: UiNodePayload[];
}
```

### Runtime Rendering Contract

The client renders UI payloads through trusted SolidJS components.

```txt
UiNodePayload
  -> validate
  -> resolve material/skin/content/action
  -> create emission plan
  -> render SolidJS runtime component
```

## Migration Phases

### Phase 1: Define And Validate Payloads

- Add schema types for `SkinManifest`, `UiNodePayload`, and recipe patches.
- Add runtime validation for downloaded payloads.
- Reject unknown node types, unsupported layout modes, arbitrary CSS, arbitrary JS, and unapproved asset URLs.
- Keep action handling client-owned: server sends action ids, client maps them to trusted handlers.

Acceptance:

- Invalid skins fail closed.
- Unknown actions do not execute.
- Missing assets fall back to a safe default skin.

### Phase 2: Build The Client Skin Registry

- Add a local registry for built-in skins.
- Add a downloaded registry for earned/unlocked skins.
- Resolve skins by id with compatibility checks.
- Cache skin assets through an allowlisted asset loader.
- Support fallback chains:

```txt
requested skin
  -> compatible downloaded skin
  -> built-in fallback skin
  -> base recipe
```

Acceptance:

- A player-earned skin can be activated by id.
- Missing/incompatible skins do not break UI rendering.

### Phase 3: Build The SolidJS Runtime Renderer

- Add `renderUiNodeToSolid(node, context)`.
- Use material emission plans as the runtime rendering contract.
- Do not render from editor DOM.
- Do not render from untrusted server markup.

Acceptance:

- CTA button payload renders through a trusted Solid component.
- Runtime DOM matches the emission plan contract.
- Runtime component supports label, disabled state, click action, and skin id.

### Phase 4: Component Family Migration

Migrate one family at a time.

Order:

1. CTA buttons
2. Toolbar buttons
3. Nav tabs
4. Wallet chips
5. Profile button
6. Mission/feed panels
7. Full feed cards
8. Top/bottom shell

Each family must have:

- server payload schema
- skin/material resolver
- Solid runtime renderer
- export HTML/CSS renderer
- render proof
- golden tests

### Phase 5: Feature Flags And Rollout

Keep old and new UI paths side by side.

Suggested flags:

```txt
legacy
runtime-solid
server-driven
proof
```

Rollout order:

1. Render hidden proof only.
2. Render side-by-side proof in editor.
3. Enable runtime Solid for one component family.
4. Enable server-driven payloads for that family.
5. Remove legacy only after proof and gameplay are stable.

## Safety Rules

- Server payloads are data, not code.
- Client owns all actions.
- Client owns allowed element types.
- Client owns allowed CSS properties and variables.
- Client owns accessibility rules.
- Client owns asset loading and caching.
- Downloaded skins must be versioned, validated, and revocable.

## First Concrete Slice

CTA button runtime skin slice:

1. Define CTA `UiNodePayload`.
2. Define CTA skin manifest entry.
3. Resolve `UiNodePayload + SkinManifest` into a material emission plan.
4. Render that plan as SolidJS.
5. Add proof harness comparison against editor and export HTML/CSS.
6. Add tests for base, textured, disabled, simple label, fitted label, and invalid skin fallback.
