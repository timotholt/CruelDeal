# Unified Material Node Tree Refactor Spec

Date: 2026-06-02

Refactor name: Unified Material Node Tree

## Purpose

Build one shared SolidJS component system for the main material preview/editor so these UI pieces are authored, rendered, selected, previewed, and edited through the same code path:

- Carousel page
- Mission briefing
- CTA button
- NavBar
- NavBar button
- TopBar
- ProfileButton
- CurrencyButton
- Toolbar
- Toolbar button

The target is maximum shared code where it makes sense, split into focused SolidJS component files. Templates may differ by UI domain, but material rendering, recursive node rendering, text rendering, button rendering, selection targeting, shared style behavior, and editor target derivation must be shared.

This spec is written so an implementer can execute the refactor without needing to re-infer the architecture.

## Current State Summary

The existing main material preview has two different levels of abstraction:

1. Feed card / mission briefing nodes are already close to the desired model.
   - `FeedCardNode` has `type: 'container' | 'text' | 'button'`.
   - `FeedCardTreeNode` recursively renders the tree.
   - Container and text nodes use `MaterialPanel`.
   - Button nodes use `MaterialButton`.
   - Text nodes use `FeedRichText`.
   - Node selection uses feed-specific target ids.

2. Top bar, profile button, currency buttons, toolbar buttons, nav container, and nav buttons still use a mixture of handwritten JSX and direct primitive usage.
   - They share `MaterialPanel` and `MaterialButton`.
   - They do not share the feed tree renderer.
   - Their editable target structure is not a generic material node tree.
   - Some layout and identity concepts are embedded directly in `MainMaterialPreviewScreen.tsx`.

The result is that the app shares paint primitives but not the full UI/component model. That is the root problem this refactor addresses.

## Architectural Goal

There should be one shared material node system:

```txt
MaterialTree
  MaterialNode
    surface recipe
    layout recipe
    content recipe
    state/interaction role
    binding
    shared style reference
    children
```

Every listed UI piece should be expressible as data and rendered by the same `MaterialNodeRenderer`.

The intended final relationship is:

```txt
Carousel template
Mission briefing template
NavBar template
TopBar template
Toolbar template
  -> MaterialNodeRenderer
       -> MaterialNodeSurface
            -> MaterialPanel / MaterialButton / media / text
       -> MaterialRichText
       -> shared selection and preview-state code
       -> existing MaterialRecipe / MaterialPrimitives paint stack
```

The old `FeedCardTreeNode` should become the starting point for the shared renderer, not a feed-only special case.

## Non-Goals

Do not redesign the visuals as part of the first implementation. Preserve current visual output as much as possible.

Do not replace `MaterialPanel`, `MaterialButton`, or the existing `MaterialRecipe` paint stack. They are the lower-level primitives the new system should use.

Do not build a totally generic page-builder framework. This is a material UI authoring system for this app's preview/editor.

Do not move carousel gesture behavior, nav active-tab behavior, or command actions into the shared renderer. Domain behavior should be passed through a render context.

Do not keep separate renderer branches for top bar, nav bar, toolbar, and feed card once their behavior can be represented by the shared node schema.

## Design Principles

1. Same code path for same concept.
   - A CTA button, nav button, currency button, profile button, and toolbar button are all material button nodes.
   - They may have different recipes, bindings, icons, actions, or layout, but they should use the same renderer branch.

2. Paint belongs to material recipes.
   - CSS may control layout, size, position, overflow, grid, flex, and responsive constraints.
   - CSS should not define material base fills, glass, bevel paint, tint, texture, border, gradient, glow, or text emboss for editable nodes.

3. Domain templates define structure.
   - Mission briefing can define its own node tree.
   - TopBar can define its own node tree.
   - NavBar can define its own node tree.
   - The renderer should not know what a "mission briefing" is.

4. Bindings provide data.
   - A node can bind to `contractBriefing`, `contractCtaLabel`, `wallet.credits`, `nav.main.label`, etc.
   - The renderer resolves bindings through a context object.
   - The renderer should not import story, wallet, or nav data directly.

5. Shared styles are explicit.
   - Repeated controls should refer to shared style ids.
   - Example: all nav buttons can share `nav.button`.
   - Example: all toolbar buttons can share `toolbar.button`.
   - Example: all currency chips can share `topBar.currencyButton`.

6. Component files stay small and purposeful.
   - Avoid another single large component file.
   - Split type definitions, renderer pieces, binding helpers, tree traversal, templates, and editor target derivation.

## Proposed File Structure

Add a shared material node module under `components/ui/material-node/`.

```txt
components/ui/material-node/
  index.ts
  MaterialNodeTypes.ts
  MaterialNodeRenderer.tsx
  MaterialNodeSurface.tsx
  MaterialNodeContent.tsx
  MaterialNodeFrame.tsx
  MaterialRichText.tsx
  MaterialNodeBindings.ts
  MaterialNodeTargets.ts
  MaterialNodeTraversal.ts
  MaterialNodeTemplates.ts
```

Keep feature-specific templates either beside the consuming screen at first or in a dedicated template folder once stable:

```txt
components/screens/main-material/
  mainMaterialTemplates.ts
  feedMaterialTemplateAdapter.ts
  topBarMaterialTemplate.ts
  navMaterialTemplate.ts
  toolbarMaterialTemplate.ts
```

If the implementer wants fewer moves in the first pass, templates may initially live in `components/screens/MainMaterialPreviewScreen.tsx` and be extracted later. The shared renderer files should still be created early.

Update `components/ui/material-lab/index.ts` only if it is helpful to re-export shared material-node APIs. Prefer a separate `components/ui/material-node/index.ts` so material lab primitives and material node rendering do not become tangled.

## Core Types

Create `components/ui/material-node/MaterialNodeTypes.ts`.

The exact type names can be adjusted, but the responsibilities must remain.

```ts
import type { JSX } from 'solid-js';
import type {
  MaterialEditorCapabilities,
  MaterialRecipe,
  MaterialRecipeState,
} from '../material-lab';

export type MaterialNodeKind =
  | 'container'
  | 'button'
  | 'text'
  | 'media'
  | 'slot';

export type MaterialNodeRole =
  | 'static'
  | 'container'
  | 'text'
  | 'momentary'
  | 'selectable'
  | 'disclosure';

export type MaterialNodeContentMode =
  | 'plain'
  | 'rich'
  | 'icon'
  | 'media'
  | 'none';

export interface MaterialNodeLayout {
  className?: string;
  style?: JSX.CSSProperties;
  display?: 'block' | 'flex' | 'grid' | 'absolute';
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: number;
  padding?: number;
  width?: string;
  height?: string;
  minWidth?: string;
  minHeight?: string;
  position?: {
    left?: string;
    right?: string;
    top?: string;
    bottom?: string;
    inset?: string;
  };
}

export interface MaterialNodeContent {
  mode?: MaterialNodeContentMode;
  text?: string;
  binding?: string;
  mediaSrc?: string;
  mediaAlt?: string;
  iconKey?: string;
  className?: string;
  style?: JSX.CSSProperties;
}

export interface MaterialNodeSharedStyleRef {
  id: string;
  label: string;
}

export interface MaterialNodeRecipe {
  id: string;
  label: string;
  kind: MaterialNodeKind;
  role?: MaterialNodeRole;
  surface?: MaterialRecipe;
  layout?: MaterialNodeLayout;
  content?: MaterialNodeContent;
  capabilities?: Partial<MaterialEditorCapabilities>;
  sharedStyle?: MaterialNodeSharedStyleRef;
  children?: MaterialNodeRecipe[];
}

export interface MaterialNodeResolvedContent {
  text?: string;
  mediaSrc?: string;
  mediaAlt?: string;
  icon?: JSX.Element;
}

export interface MaterialNodeRenderContext {
  treeId: string;
  selectedNodeId?: string;
  hoveredNodeId?: string | null;
  pressedNodeId?: string | null;
  focusedNodeId?: string | null;
  activeNodeIds?: ReadonlySet<string>;
  forcePreview?: boolean;
  forcedState?: MaterialRecipeState;
  allOnScreenPreview?: boolean;
  resolveBinding?: (binding: string, node: MaterialNodeRecipe) => MaterialNodeResolvedContent | string | number | undefined;
  resolveIcon?: (iconKey: string, node: MaterialNodeRecipe) => JSX.Element | undefined;
  previewStateForNode?: (node: MaterialNodeRecipe, role: MaterialNodeRole) => MaterialRecipeState;
  targetIdForNode?: (node: MaterialNodeRecipe) => string;
  selectedClassForNode?: (node: MaterialNodeRecipe) => string;
  onNodeAction?: (node: MaterialNodeRecipe) => void;
  onPointerDown?: (node: MaterialNodeRecipe, event: PointerEvent) => void;
  onPointerUp?: (node: MaterialNodeRecipe, event: PointerEvent) => void;
}
```

Important notes:

- `treeId` namespaces target ids.
- `binding` is a string key resolved by the context.
- `sharedStyle` is not automatically applied by the renderer unless the calling template has already resolved the material recipe. It is metadata for editor grouping and persistence.
- `capabilities` can narrow editor panels per node.
- `layout.className` should provide layout classes only.
- `surface` remains a `MaterialRecipe`.

## Renderer Responsibilities

Create `components/ui/material-node/MaterialNodeRenderer.tsx`.

`MaterialNodeRenderer` receives:

```ts
interface MaterialNodeRendererProps {
  node: MaterialNodeRecipe;
  context: MaterialNodeRenderContext;
}
```

It must:

1. Resolve the target id.
2. Resolve the node role.
3. Resolve preview state.
4. Resolve selected/flash CSS class.
5. Render a `MaterialNodeFrame`.
6. Render the correct surface/content branch based on `node.kind`.
7. Recursively render children.

The renderer should not know about feed stories, nav items, wallet balances, or toolbar commands. Those are context bindings and actions.

Expected branch behavior:

```txt
container:
  MaterialPanel
  optional content
  children

button:
  MaterialButton
  content
  optional children for icon/value layout if needed

text:
  MaterialPanel
  MaterialRichText or plain text

media:
  img/span/icon wrapper
  optional MaterialPanel if surface is present

slot:
  does not render by itself unless context expands it
  may be avoided in first pass if repeated nodes are materialized before rendering
```

Recommendation: avoid implementing dynamic slot expansion inside the first renderer pass. Instead, materialize repeated children in the template adapter. Example: create five nav button nodes and three currency button nodes before rendering.

## Surface Rendering

Create `components/ui/material-node/MaterialNodeSurface.tsx`.

This component should be the only place that decides between `MaterialPanel`, `MaterialButton`, or non-surface media.

Inputs:

```ts
interface MaterialNodeSurfaceProps {
  node: MaterialNodeRecipe;
  role: MaterialNodeRole;
  visualState: MaterialRecipeState;
  context: MaterialNodeRenderContext;
  children?: JSX.Element;
}
```

Rules:

- `button` nodes use `MaterialButton`.
- `container` and `text` nodes use `MaterialPanel`.
- `media` nodes:
  - if `surface` exists, wrap media in `MaterialPanel`;
  - otherwise render the media directly.
- `slot` nodes are not rendered in first pass unless explicitly materialized.

Use the existing conversion helpers:

- `materialRecipeToSurfaceProps`
- `materialRecipeToStaticSurfaceProps`
- `materialRecipeToInteractiveSurfaceProps`

The current helper logic in `MainMaterialPreviewScreen.tsx` should move into shared utilities:

```txt
materialRecipeItemProps
materialSurfacePropsForPart
```

But rename them generically:

```txt
materialNodeSurfaceProps
materialNodeButtonProps
```

The new helpers should be driven by node role and state, not by `MainPartId`.

## Content Rendering

Create `components/ui/material-node/MaterialNodeContent.tsx`.

Responsibilities:

- Resolve content text from `node.content.text` or `node.content.binding`.
- Resolve media source from `node.content.mediaSrc` or binding.
- Resolve icon from `node.content.iconKey` through context.
- Choose plain text vs rich text.

For rich text, extract the reusable parts of current `FeedRichText` into `MaterialRichText.tsx`.

Important: the current rich text implementation has feed-card-specific style resolution. Split it into:

1. A generic parser/renderer for markup tokens:
   - `[accent]`
   - `[h1]`
   - `[h2]`
   - `[rule]`
   - `[divider]`
   - color/tone tags

2. A style context that maps tags to CSS classes/vars.

First pass may keep a compatibility wrapper:

```txt
FeedRichText -> MaterialRichText with feed tag style adapter
```

Do not duplicate rich text parsing in top bar, buttons, or toolbar labels.

## Frame and Selection Attributes

Create `components/ui/material-node/MaterialNodeFrame.tsx`.

Responsibilities:

- Apply `data-material-node-id`.
- Apply `data-material-target-id`.
- Apply `data-material-role`.
- Apply node layout CSS.
- Apply selection CSS classes.
- Provide a stable wrapper for editor hover/click behavior.

Example output:

```html
<div
  class="material-node material-node--button topbar-currency-button is-editing-persistent"
  data-material-node-id="currency.credits"
  data-material-target-id="main.topbar.currency.credits"
  data-material-role="momentary"
>
  ...
</div>
```

Selection/flash/persistent classes should become generic:

```txt
is-editing-persistent
is-editing-flash
is-editing-flash-a
is-editing-flash-b
```

Existing CSS can keep these class names.

## Binding System

Create `components/ui/material-node/MaterialNodeBindings.ts`.

Bindings are deliberately simple string keys.

Examples:

```txt
story.contractBriefing
story.contractCtaLabel
story.contractBadge
story.sectorLabel
topBar.commander
wallet.credits.value
wallet.gold.value
wallet.tokens.value
nav.0.label
nav.0.icon
toolbar.0.label
toolbar.0.action
```

Binding resolution is supplied by the consuming screen:

```ts
const resolveMainMaterialBinding = (binding: string, node: MaterialNodeRecipe) => {
  switch (binding) {
    case 'topBar.commander':
      return 'COMMANDER';
    case 'wallet.credits.value':
      return '500';
    case 'story.contractBriefing':
      return activeStory.contractBriefing;
  }
};
```

Do not hardcode app data into `MaterialNodeRenderer`.

## Target Derivation and Editor Tree

Create `components/ui/material-node/MaterialNodeTargets.ts`.

Responsibilities:

- Convert a `MaterialNodeRecipe` tree into editable targets.
- Preserve parent/child depth.
- Attach `onChange` handlers supplied by the consuming screen.
- Support shared style editing.

Generic target shape should be compatible with current `MaterialEditableTarget`:

```ts
export interface MaterialNodeEditableTarget {
  id: string;
  label: string;
  recipe: MaterialRecipe;
  capabilities: MaterialEditorCapabilities;
  interactionRole?: MaterialNodeRole;
  sharedStyleId?: string;
  onChange: (recipe: MaterialRecipe) => void;
  children?: MaterialNodeEditableTarget[];
}
```

For nodes without `surface`, either:

- exclude them from material target list, or
- include them with only layout/content editor capabilities if those panels exist.

First pass should focus on material targets only, because the existing editor mostly edits material recipes.

## Tree Traversal Utilities

Create `components/ui/material-node/MaterialNodeTraversal.ts`.

Functions:

```ts
findMaterialNodeById(tree, nodeId)
updateMaterialNodeById(tree, nodeId, updater)
mapMaterialNodeTree(tree, mapper)
flattenMaterialNodeTree(tree)
cloneMaterialNodeTree(tree)
```

Use these instead of bespoke feed-only helpers:

- current `updateFeedNodeById`
- current `findFeedNodeById`
- current `cloneFeedCardNode`

The feed-specific helpers can remain temporarily as wrappers during migration.

## Template System

Templates produce `MaterialNodeRecipe` trees.

Create or extract these templates:

```txt
createCarouselPageTemplate
createMissionBriefingTemplate
createNavBarTemplate
createTopBarTemplate
createToolbarTemplate
```

Templates should produce data only. They should not render JSX.

### Carousel Page Template

Tree:

```txt
carouselPage.container
  carouselPage.background.media
  carouselPage.fade.media/container
  missionBriefing.container
```

Notes:

- Carousel slide motion stays in `FeedCarousel` or a future `MaterialCarousel`.
- Background image and fade may remain domain-specific during first pass.
- The important part is that the mission briefing card itself is rendered through `MaterialNodeRenderer`.

### Mission Briefing Template

Tree:

```txt
missionBriefing.container
  missionBriefing.deadlineBadge.text/container
  missionBriefing.body.text
  missionBriefing.cta.button
  missionBriefing.sectorMark.text/container
```

Bindings:

```txt
story.contractBadge
story.contractBriefing
story.contractCtaLabel
story.sectorLabel
```

The current feed card types can still define multiple mission briefing variants. They should store `MaterialNodeRecipe[]` instead of `FeedCardNode[]` after migration.

### CTA Button Template

CTA button is not a separate renderer. It is:

```txt
kind: 'button'
role: 'momentary'
binding: 'story.contractCtaLabel'
sharedStyle: { id: 'missionBriefing.cta', label: 'CTA Button' }
```

It should use the same `button` branch as nav, toolbar, profile, and currency buttons.

### NavBar Template

Tree:

```txt
navBar.container
  navButton.battlePass.button
    navButton.battlePass.icon.media/text
    navButton.battlePass.label.text
  navButton.comms.button
  navButton.main.button
  navButton.assets.button
  navButton.exchange.button
```

Shared styles:

```txt
navBar.container
navBar.button
navBar.button.icon
navBar.button.label
```

Bindings:

```txt
nav.0.icon
nav.0.label
nav.0.active
```

Active state:

- Context should include `activeNodeIds`.
- The renderer maps active nodes to `MaterialRecipeState` through `previewStateForNode`.
- Do not create nav-only active rendering in the shared button renderer.

### TopBar Template

Tree:

```txt
topBar.container
  topBar.profileButton.button
    topBar.profileButton.icon.media
  topBar.commander.text
  topBar.walletGroup.container
    topBar.currency.credits.button
      topBar.currency.credits.icon.media
      topBar.currency.credits.value.text
    topBar.currency.gold.button
      topBar.currency.gold.icon.media
      topBar.currency.gold.value.text
    topBar.currency.tokens.button
      topBar.currency.tokens.icon.media
      topBar.currency.tokens.value.text
```

Shared styles:

```txt
topBar.frame
topBar.profileButton
topBar.commanderText
topBar.walletGroup
topBar.currencyButton
topBar.currencyIcon
topBar.currencyValue
```

This is the direct fix for top bar being a separate unfinished stack. The top bar should render the same button/text/container node types as mission briefing.

### Toolbar Template

Tree:

```txt
toolbar.container
  toolbar.button.log.button
  toolbar.button.playConquest.button
  toolbar.button.deckAssault.button
  toolbar.button.playLadder.button
  toolbar.button.count.button
```

Shared styles:

```txt
toolbar.container
toolbar.button
toolbar.button.darkVariant
toolbar.button.redVariant
```

First pass can handle variants by assigning different recipes per node while still using the same button renderer.

## Shared Styles and Repeated Nodes

Add explicit shared style metadata to repeated nodes.

Example:

```ts
{
  id: 'topBar.currency.credits',
  label: 'Credits',
  kind: 'button',
  sharedStyle: { id: 'topBar.currencyButton', label: 'Currency Button' },
  surface: currencyButtonRecipe,
}
```

The editor should be able to expose two concepts:

1. The individual node target.
2. The shared style target.

Initial implementation may preserve existing behavior:

- `CurrencyButton` edits all 3 currency chips.
- `NavBar Button` edits all 5 nav buttons.
- `Toolbar Button` edits all 5 toolbar buttons.

Longer-term behavior can allow an override per repeated node, but that is not necessary for this refactor.

## Material Editor Capabilities

Keep capabilities but make them node-driven instead of part-driven.

Examples:

```txt
container: material, shape, texture, tint, gradient, glass, border, glow, shadow, states optional
button: material, shape, texture, tint, gradient, glass, border, glow, content, states
text: material optional, content, text style, states optional
media: media controls, tint optional, material optional
slot: no direct material unless materialized
```

The current `materialEditorCapabilitiesByPart` can be migrated into template defaults:

```txt
topBar.container.capabilities
topBar.profileButton.capabilities
topBar.currencyButton.capabilities
toolbar.button.capabilities
navBar.button.capabilities
missionBriefing.cta.capabilities
```

Do not keep a long-lived global `MainPartId -> capabilities` table for things that are now nodes.

## CSS Rules

Create shared node CSS only for structural concerns.

Possible shared CSS file:

```txt
src/styles/material-node.css
```

Or add a section to `src/styles/ui-material-lab.css` if the team prefers fewer style files.

Allowed:

```css
.material-node { position: relative; }
.material-node--container { display: block; }
.material-node--button { min-width: 0; }
.material-node__media { width: 100%; height: 100%; object-fit: cover; }
```

Allowed template layout CSS:

```css
.main-material-topbar-tree { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; }
.main-material-wallet-group { display: flex; gap: 5px; }
.main-material-toolbar-tree { display: grid; grid-template-columns: ...; }
```

Forbidden for editable nodes:

```css
background: ...
border: ...
box-shadow: ... as material paint
texture image backgrounds
glass highlights
material gradients
text emboss/shadow for material text
```

Exception: non-editable decorative or media fade layers may keep CSS backgrounds if they are not material-controlled.

## Main Migration Plan

### Phase 1: Extract generic node types and traversal

Files:

```txt
components/ui/material-node/MaterialNodeTypes.ts
components/ui/material-node/MaterialNodeTraversal.ts
components/ui/material-node/index.ts
```

Tasks:

1. Add shared node type definitions.
2. Add clone/find/update/flatten traversal helpers.
3. Add exports.
4. Do not change UI behavior yet.

Acceptance:

- TypeScript compiles.
- No visual changes.

### Phase 2: Extract rich text renderer

Files:

```txt
components/ui/material-node/MaterialRichText.tsx
components/screens/MainMaterialPreviewScreen.tsx
```

Tasks:

1. Move generic parsing/rendering from current `FeedRichText`.
2. Keep feed-specific style mapping as props or adapter functions.
3. Replace current `FeedRichText` internals with a wrapper around `MaterialRichText`.

Acceptance:

- Mission briefing rich text renders identically.
- `[h1]`, `[h2]`, `[rule]`, `[divider]`, `[accent]`, and color tags still work.

### Phase 3: Extract generic renderer from `FeedCardTreeNode`

Files:

```txt
components/ui/material-node/MaterialNodeFrame.tsx
components/ui/material-node/MaterialNodeContent.tsx
components/ui/material-node/MaterialNodeSurface.tsx
components/ui/material-node/MaterialNodeRenderer.tsx
components/screens/MainMaterialPreviewScreen.tsx
```

Tasks:

1. Move recursive rendering logic from `FeedCardTreeNode`.
2. Keep feed card rendering visually identical by adapting `FeedCardNode` into `MaterialNodeRecipe`.
3. Use `MaterialNodeRenderer` for mission briefing children.
4. Keep `FeedCarousel` and slide behavior as-is.

Acceptance:

- Mission briefing and CTA still render.
- Node selection still works.
- CTA still uses `MaterialButton`.
- Visual output should be within minor CSS/layout tolerance.

### Phase 4: Convert feed card node schema

Files:

```txt
components/screens/MainMaterialPreviewScreen.tsx
components/screens/main-material/feedMaterialTemplateAdapter.ts
```

Tasks:

1. Either rename `FeedCardNode` to `MaterialNodeRecipe` or create an adapter.
2. Replace feed-only traversal helpers with shared traversal helpers.
3. Keep feed-specific text style resolution as adapter logic.

Acceptance:

- Editing mission briefing card type, child nodes, and CTA button still works.
- Export/import still serializes the same user-editable data or has a clearly versioned migration.

### Phase 5: Convert toolbar buttons

Files:

```txt
components/screens/MainMaterialPreviewScreen.tsx
components/screens/main-material/toolbarMaterialTemplate.ts
```

Tasks:

1. Create toolbar material tree.
2. Render toolbar through `MaterialNodeRenderer`.
3. Remove direct toolbar `MaterialButton` JSX.
4. Preserve existing labels and variants.
5. Preserve existing interaction role.

Acceptance:

- Toolbar still shows five buttons.
- Toolbar button material editor still edits the repeated/shared button style.
- No toolbar-specific paint CSS remains.

### Phase 6: Convert nav bar and nav buttons

Files:

```txt
components/navigation/MaterialNavItem.tsx
components/screens/MainMaterialPreviewScreen.tsx
components/screens/main-material/navMaterialTemplate.ts
```

Tasks:

1. Decide whether `MaterialNavItem` becomes a thin wrapper around `MaterialNodeRenderer` or is replaced in the preview.
2. Create nav tree with container and five button nodes.
3. Use context active state for selected nav item.
4. Preserve active state styling through material state overlays.

Acceptance:

- Nav shows five buttons.
- Active nav button still visually differs.
- Editing nav button material edits all nav buttons unless a future override is intentionally added.
- Nav button uses same button renderer branch as CTA.

### Phase 7: Convert top bar, profile button, and currency buttons

Files:

```txt
components/screens/MainMaterialPreviewScreen.tsx
components/screens/main-material/topBarMaterialTemplate.ts
src/styles/main-material-preview.css
```

Tasks:

1. Create top bar material tree.
2. Render top bar through `MaterialNodeRenderer`.
3. Replace handwritten top bar `MaterialPanel`, profile `MaterialPanel`, and currency `MaterialButton` JSX with node tree rendering.
4. Preserve top bar layout CSS only.
5. Make `ProfileButton` a button node.
6. Make each `CurrencyButton` a button node.
7. Make commander text a text node.
8. Use shared style id for currency buttons.

Acceptance:

- Top bar selection tree shows child nodes.
- Profile button uses same button node renderer as CTA/nav/toolbar.
- Currency buttons use same button node renderer as CTA/nav/toolbar.
- Top bar no longer owns material logic outside the shared renderer.

### Phase 8: Generic editor target tree

Files:

```txt
components/ui/material-node/MaterialNodeTargets.ts
components/screens/MainMaterialPreviewScreen.tsx
```

Tasks:

1. Derive editable target tree from material node tree.
2. Replace bespoke feed target flattening where possible.
3. Represent shared style groups cleanly.
4. Keep existing UI tree labels stable enough that users do not lose orientation.

Acceptance:

- UI tree can select mission briefing, CTA button, top bar, profile button, currency button, nav bar, nav button, toolbar, toolbar button.
- Selected material editor changes the correct node/shared style.
- Selection overlay still flashes/persists on the correct visual node.

### Phase 9: Remove obsolete paint CSS

Files:

```txt
src/styles/main-material-preview.css
src/styles/ui-material-lab.css
```

Tasks:

1. Audit classes for editable-node paint.
2. Remove or convert paint CSS to material recipes.
3. Keep layout CSS.
4. Verify `material: none` and turning off glass/gradient/border/texture behaves consistently.

Acceptance:

- Editable UI components do not fight hidden CSS paint.
- Transparent/off material states reveal the actual layer beneath.

## Suggested Implementation Order Within One Coding Session

For a first serious implementation pass, do not try to convert every UI area at once.

Best first pass:

1. Create shared files and types.
2. Extract `MaterialNodeRenderer` from `FeedCardTreeNode`.
3. Keep mission briefing working through the new renderer.
4. Stop.

Best second pass:

1. Convert toolbar buttons.
2. Convert nav buttons.
3. Stop.

Best third pass:

1. Convert top bar.
2. Convert profile button.
3. Convert currency buttons.
4. Stop.

This sequencing prevents top bar complexity from corrupting the shared renderer before the renderer is proven against mission briefing.

## Detailed Current-to-New Mapping

### Existing `FeedCardNode`

Current:

```txt
FeedCardNode
  id
  label
  type
  binding
  layout
  surface
  children
```

New:

```txt
MaterialNodeRecipe
  id
  label
  kind
  role
  content.binding
  layout
  surface
  children
```

Mapping:

```txt
type -> kind
binding -> content.binding
layout -> layout
surface -> surface
children -> children
```

### Existing `FeedCardTreeNode`

Current renderer branches:

```txt
container -> MaterialPanel + children
text -> MaterialPanel + FeedRichText
button -> MaterialButton
```

New renderer branches:

```txt
container -> MaterialNodeSurface -> MaterialPanel + MaterialNodeContent + children
text -> MaterialNodeSurface -> MaterialPanel + MaterialNodeContent -> MaterialRichText/plain
button -> MaterialNodeSurface -> MaterialButton + MaterialNodeContent + optional children
media -> MaterialNodeContent media
```

### Existing Top Bar JSX

Current:

```txt
MaterialPanel topBar
  MaterialPanel profile
  commander div
  currencies div
    MaterialButton credits
    MaterialButton gold
    MaterialButton tokens
```

New:

```txt
MaterialNodeRenderer topBar.container
  profileButton.button
  commander.text
  walletGroup.container
    credits.button
    gold.button
    tokens.button
```

## Data Persistence and Import/Export

The main material preview currently exports:

```txt
backdrop
title
feed
feedStories
feedCardTypes
feedStoryImageOverrides
selectedFeedStoryId
editingFeedCardTypeId
selectedFeedTargetId
nav
surfaces
```

After refactor, avoid a breaking export format unless necessary.

Recommended transitional format:

```txt
feedCardTypes: still present
surfaces: still present for non-migrated parts
materialTrees: optional new object
```

Example:

```ts
materialTrees: {
  topBar,
  toolbar,
  navBar,
}
```

During migration:

- If `materialTrees.topBar` exists, use it.
- Otherwise build top bar tree from old `surfaces.topBar`, `surfaces.profile`, and `surfaces.currencies`.
- If `materialTrees.toolbar` exists, use it.
- Otherwise build toolbar tree from old `surfaces.toolbar`.
- If `materialTrees.navBar` exists, use it.
- Otherwise build nav tree from old `surfaces.navContainer` and `surfaces.nav`.

This lets old local storage continue to load.

## State and Interaction Model

Use the same state names already used by material recipes:

```txt
rest
hover
active
pressed
```

Node role determines which states matter:

```txt
static: rest only
container: rest, hover optional if selectable in editor
text: rest only unless explicitly interactive
momentary: rest, hover, pressed
selectable: rest, hover, active, pressed
disclosure: rest, hover, active, pressed
```

The renderer should call:

```ts
context.previewStateForNode?.(node, role)
```

If no function is provided, use:

```txt
activeNodeIds has node id -> active
pressedNodeId equals node id -> pressed
hoveredNodeId equals node id -> hover
else rest
```

Forced preview state:

- If `context.forcePreview` is true and the selected node matches, use `context.forcedState`.
- If `context.allOnScreenPreview` is true, role-compatible nodes may use `context.forcedState`.

This replaces feed/nav/topbar-specific preview state branches over time.

## Testing and Verification

Run at minimum:

```txt
npm run build
```

If there are targeted tests for material rendering, run them. If not, build is the required baseline.

Manual verification on `http://127.0.0.1:3000/main-material`:

1. Mission briefing renders.
2. CTA button renders and can be selected.
3. CTA button material edits still apply.
4. Feed carousel still drags/slides.
5. Toolbar renders five buttons.
6. Toolbar button material edits all toolbar buttons.
7. Nav renders five buttons.
8. Active nav state still appears.
9. Nav button material edits all nav buttons.
10. Top bar renders profile, commander, and currencies.
11. Profile button material edits profile button.
12. Currency button material edits all currency buttons.
13. Selection overlay highlights the selected node.
14. Turning material base to `none` behaves the same for CTA, nav button, toolbar button, profile button, and currency button.
15. Turning texture/glass/gradient/border off behaves the same for all button nodes.

## Failure Modes to Avoid

Avoid creating `TopBarNodeRenderer`, `ToolbarNodeRenderer`, or `NavNodeRenderer` with copied logic from `FeedCardTreeNode`. Templates are fine. Separate renderers are not.

Avoid keeping `FeedCardTreeNode` as the real renderer and adding a second generic renderer beside it. Extract and reuse the same code path.

Avoid adding CSS material paint because it is faster for one visual issue. That recreates the original problem.

Avoid making shared styles implicit by matching labels. Use explicit `sharedStyle.id`.

Avoid letting bindings leak into renderer logic. The renderer can ask the context for a binding value; it should not know what `wallet.gold.value` means.

Avoid converting every part in one huge unverified patch. Prove mission briefing first, then migrate other regions.

## Success Criteria

The refactor is complete when:

- Mission briefing, CTA button, NavBar button, ProfileButton, CurrencyButton, and Toolbar button all render through the same button/container/text node renderer.
- The top bar is no longer handwritten as a separate material stack.
- The editor tree is derived from material nodes or compatible shared target metadata.
- Shared repeated styles are explicit and editable.
- Material layer controls have the same meaning across UI pieces.
- Component code is split into focused SolidJS files under `components/ui/material-node/`.
- Remaining CSS for these UI pieces is layout-only or clearly non-editable decoration.

## Final Target Mental Model

The app should have many templates, but only one material UI engine:

```txt
Different structures:
  carousel page
  mission briefing
  top bar
  nav bar
  toolbar

Same engine:
  MaterialNodeRenderer
  MaterialSurface
  MaterialButton branch
  MaterialPanel branch
  MaterialRichText
  selection target derivation
  preview state resolution
  shared style metadata
```

That is the line to hold during implementation. Different recipes are good. Different duplicated component logic for the same material concept is the thing this refactor is meant to end.
