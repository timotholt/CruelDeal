# Surface Composition Authoring Spec

Status: superseded on 2026-07-15
Authorities: `docs/semantic-ui-authoring-compiler-spec.md` and
`docs/mission-briefing-v2-vertical-slice-spec.md`

> Historical composition strategy only. Generic node trees remain useful as an
> implementation technique, but they are not allowed to erase functional
> component identity. Mission Briefing and fingerprint behavior now follow typed
> semantic contracts.

Date: 2026-06-09

Related specs:

- `docs/first-class-surface-architecture-spec.md`
- `docs/feed-card-type-system-spec.md`
- `docs/schema-driven-surface-editor-spec.md`
- `docs/game-ui-skinning-cms-agent-spec.md`

## Goal

Make the editor capable of authoring production-quality game UI out of
surface-driven components, without leaking editor concerns into runtime output
and without turning rich text into a layout system.

The editor should let a designer build screens like a mission briefing panel,
reward area, fingerprint action, CTA row, or two-column stats block by composing
ordinary nodes:

```txt
surface primitive + node tree + layout model + CMS bindings -> runtime UI
```

The same authored document must support:

- visual editing in `/material-main`
- JSON import/export
- DOM/CSS export proof
- CMS-backed content swaps
- product renderers that consume compiled runtime contracts only

## Core Thesis

A two-column layout is not a new runtime primitive. It is a normal composition:

```txt
Vertical panel
  Horizontal group
    Vertical column
    Button or action group
```

That composition should be easy to create through templates and structure
controls, but the saved/runtime model should still be a tree of ordinary nodes.

The responsibilities stay separate:

- Surface owns pixels: material, glass, texture, border, blur, edge wear,
  shadow, tint, content tone, and state overlays.
- Layout owns boxes: flow, absolute placement, direction, gap, padding,
  alignment, sizing, anchoring, and wrapping.
- Structure owns the node tree: parent/child relationships, order, grouping,
  and reusable templates.
- CMS owns content fields: labels, body copy, numeric rewards, images, actions,
  and bindings.
- Rich text owns inline typography: spans, line breaks, emphasis, fit, and text
  overflow behavior inside a text box.
- Product renderers own runtime semantics: button behavior, accessibility,
  routing, and component-specific meaning.

## Non-Goals

- Do not add CSS columns or rich-text columns as the first solution for mission
  briefing layouts.
- Do not introduce a special `twoColumn` runtime node if a normal container row
  can represent the layout.
- Do not let CMS fields store layout, material, or editor metadata.
- Do not let product DOM depend on editor-only ids, selection state, inspectors,
  provenance, or control metadata.
- Do not rewrite the whole editor in one pass.
- Do not remove current surface features while separating the architecture.

## Current State

The runtime/editor model already has most of the low-level pieces:

- `FeedCardNode` supports recursive `children`.
- Node types currently include `container`, `text`, and `button`.
- `FeedNodeLayout` supports flow and absolute positioning.
- Flow layout supports `row`, `column`, reverse, wrap, gap, line gap, padding,
  distribution, and cross-axis alignment.
- Node sizing supports fixed, hug, and fill modes.
- Absolute layout supports horizontal and vertical constraints, including center
  anchors with relative offsets.
- Text nodes support CMS-style bindings such as mission briefing, title, body,
  reward labels, reward values, CTA labels, season labels, and sector labels.
- Rich text already supports inline tokens, line breaks, dividers, and fit/flow
  sizing modes.
- Export DOM/CSS is now planned through selected material targets rather than a
  CTA-only path.

The missing editor layer is not more rendering power. The missing layer is
authoring ergonomics:

- create nodes
- remove nodes
- duplicate nodes
- reorder nodes
- wrap nodes in a group
- convert between basic node roles where safe
- apply templates that generate ordinary node subtrees
- bind nodes to CMS fields
- create CMS fields from the editor
- hide raw layout vocabulary until the user needs advanced controls

## Canonical Mission Briefing Composition

The target composition for a contract or mission briefing should be expressible
without new runtime layout primitives:

```txt
Mission Briefing Panel
  type: container
  layout: column
  surface: panel material

  Contract Eyebrow
    type: text
    binding: contractEyebrow

  Contract Title
    type: text
    binding: contractTitle

  Contract Body
    type: text
    binding: contractBody

  Terms Group
    type: container
    layout: row

    Reward Column
      type: container
      layout: column

      Deposit Label
        type: text
        binding: contractRewardLabel

      Deposit Value
        type: text
        binding: contractRewardValue

      Success Label
        type: text
        binding: contractRewardLabel

      Success Value
        type: text
        binding: contractRewardValue

    Divider
      type: container or text
      binding: contractDivider

    Fingerprint Action
      type: button
      binding: contractCtaLabel
      surface: action material
```

The editor can expose this as an `Add Terms Group` or `Two Column Group`
template. After insertion, the document remains plain nested nodes. Deleting,
moving, styling, exporting, and rendering should not care that a template
created the nodes.

## Surface Primitive Standard

The surface primitive is world-class when every component using a surface can
depend on the same compiled runtime contract:

```txt
MaterialRecipe authoring JSON
  -> MaterialRecipeCompiler
  -> SurfaceOptions + sparse surfaceStates
  -> Surface / MaterialButton / product host
  -> product DOM + product CSS vars
```

Rules:

- `SurfaceOptions` remains the renderer-facing contract.
- `MaterialRecipe` remains the authoring contract.
- Controls edit `MaterialRecipe` through schema and metadata.
- Product renderers consume compiled `SurfaceOptions` and sparse states.
- Panels, cards, buttons, chips, text boxes, nav items, CMS blocks, and template
  nodes all use the same surface pipeline.
- Export DOM/CSS serializes the product result, not the editor shell.
- Feature switches such as glass, blur, edge wear, border, texture, emission,
  and motion must behave consistently across all hosts that support surfaces.

## Structure Authoring Model

Add pure node tree operations before expanding UI controls:

```ts
insertNode(tree, parentId, node, index?)
removeNode(tree, nodeId)
duplicateNode(tree, nodeId)
moveNode(tree, nodeId, newParentId, index)
wrapNodesInContainer(tree, nodeIds, container)
unwrapContainer(tree, nodeId)
patchNode(tree, nodeId, patch)
```

The operation layer must preserve existing node ids unless an operation
explicitly duplicates or creates nodes. It should be testable without React and
without browser APIs.

Required behavior:

- removing a parent removes its descendants
- duplicating a parent duplicates descendants with fresh ids
- moving a node cannot move it into itself or one of its descendants
- wrapping adjacent siblings preserves visual order
- unwrapping a container preserves child order
- patching a node cannot silently drop material, layout, text, sizing, or CMS
  binding fields

## Node Templates

Templates are editor conveniences that create normal nodes.

First templates:

- Text Block: one text node bound or static.
- Surface Panel: one container node with a material surface.
- Vertical Group: container with `direction: column`.
- Horizontal Group: container with `direction: row`.
- Two Column Group: row container with two child containers.
- Label/Value Stack: vertical group with label and value text nodes.
- Stat Pair: label/value stack with default spacing and typography.
- Divider: thin visual separator using a surface or rich-text rule.
- CTA Row: horizontal group with one or more button nodes.
- Fingerprint Action: button or container group with action surface plus label.
- Reward Terms Group: two-column template for deposit/success/action content.
- Image/Media Layer: future node type or root media binding, depending on host.

Template rules:

- A template may set initial surface, layout, text, and binding defaults.
- A template may leave fields unbound and prompt the editor to bind later.
- A template must not create runtime-only special cases.
- A template must not require editor metadata to render.
- Template identity can be stored as optional authoring metadata only for
  future editing hints; runtime must not depend on it.

## Layout Authoring UX

The current layout system exposes too much raw vocabulary at once. The editor
should keep the existing model but present it in layers.

### Basic Layout Controls

Show these controls first:

- Position: `In layout` or `Free`
- Children: `Stack` or `Row`
- Width: `Fixed`, `Fit content`, or `Fill`
- Height: `Fixed`, `Fit content`, or `Fill`
- Anchor H: `Left`, `Center`, `Right`, or `Stretch`
- Anchor V: `Top`, `Center`, `Bottom`, or `Stretch`
- X and Y: relative offsets from the chosen anchor
- Padding
- Gap
- Align children
- Space children

### Advanced Layout Controls

Keep raw model controls available behind an advanced panel:

- slot
- reverse
- wrap
- line gap
- self positioning
- push to end
- full constraint modes
- min/max constraints if added later

### Vocabulary Rules

Avoid exposing implementation words where a user-facing term is clearer:

- `hug` becomes `Fit content`
- `fill` becomes `Fill`
- `distribute` becomes `Space children`
- `crossAlign` becomes `Align children`
- `selfPosition` becomes `Position`
- `flow` becomes `In layout`
- `absolute` becomes `Free`

The saved JSON can keep the existing tokens. The editor label layer should make
the controls understandable without changing the runtime model.

## CMS Authoring Model

CMS support should become visible in the editor without turning `/material-main`
into a full CMS product.

Add a content field registry for each editable document:

```ts
interface ContentFieldDefinition {
  id: string;
  label: string;
  type: 'shortText' | 'richText' | 'number' | 'image' | 'action';
  defaultValue: unknown;
  description?: string;
}

interface NodeContentBinding {
  fieldId: string;
  mode: 'bound' | 'staticOverride';
}
```

Editor behavior:

- text and button nodes can bind to content fields
- unbound nodes can use static placeholder text
- the editor can create a content field from a selected node
- the editor can rebind a node to a different field
- deleting a node does not delete the field by default
- deleting a field shows affected nodes before confirming
- CMS values never store layout, material, selection, or inspector state

Runtime behavior:

```txt
node binding + CMS payload -> rendered node content
```

This keeps layout and surface recipes reusable across stories, missions, events,
and future game screens.

## Rich Text Scope

Rich text should improve text boxes, not replace structure.

Allowed rich-text responsibilities:

- inline accent spans
- line breaks
- headings inside a text block
- dividers/rules inside copy when appropriate
- no-break spans
- text fitting
- max line handling
- overflow warnings
- per-span tone or emphasis tokens

Not rich-text responsibilities:

- columns
- reward/action groups
- fingerprint button placement
- global panel layout
- CMS field creation
- surface selection

If a design needs a reward area beside a fingerprint action, that is a structure
template. If body copy needs a highlighted word or manual line break, that is
rich text.

## Nine-Step Completion Plan

### 1. Surface Contract Completion

Finish the surface primitive as the universal visual contract.

Acceptance:

- every validated `SurfaceOptions` key has metadata
- generated controls cover all normal surface fields
- blur, glass, border, edge wear, texture, shadow, and emission have explicit
  host behavior
- panel and button hosts share renderer/export semantics where applicable

### 2. Product Renderer Separation

Keep product renderers clean and editor-free.

Acceptance:

- editor shell owns selection, outlines, provenance, and diagnostics
- product DOM contains only runtime-required elements, attrs, classes, and vars
- DOM/CSS export works for selected panels, text nodes, buttons, and root cards
- inspector code reads compiled contracts instead of product-internal editor
  metadata

### 3. Pure Node Tree Operations

Create the pure model layer for insert, delete, duplicate, move, wrap, unwrap,
and patch.

Acceptance:

- operations have focused tests
- invalid moves are rejected
- id generation is deterministic in tests
- operations preserve unrelated node data

### 4. Structure Editor UI

Expose the node operations in `/material-main`.

Acceptance:

- selected tree nodes can be added, deleted, duplicated, reordered, wrapped, and
  unwrapped
- destructive actions have confirmation or undo
- the left tree and preview stay in sync
- local persistence and import/export round-trip the changed tree

### 5. Layout UI Simplification

Replace confusing first-level layout controls with a human-facing control layer.

Acceptance:

- basic controls map cleanly to existing `FeedNodeLayout`
- center anchors make X/Y behave as relative offsets
- `Space children` replaces unclear `distribute` copy
- advanced controls remain available for precision work
- layout changes round-trip without changing runtime semantics

### 6. Composition Templates

Add templates for common UI structures.

Acceptance:

- templates create ordinary node trees
- two-column, reward terms, CTA row, label/value, and fingerprint action are
  available from the add menu
- template-created nodes can be edited, moved, exported, and rendered like any
  other nodes
- no runtime code branches on template identity

### 7. CMS Binding UI

Expose content fields and node bindings.

Acceptance:

- selected text/button nodes show binding controls
- editors can create, rename, rebind, and unbind content fields
- story/CMS payloads can swap without changing surfaces or layout
- import/export includes content definitions and values through the editor
  output registry

### 8. Rich Text and Text Fit Polish

Make text boxes strong enough for production copy.

Acceptance:

- rich text tokens are documented in the UI
- max lines and fit modes are easy to set
- overflow and clipping are visible in proof/diagnostics
- line breaks and inline accents remain content behavior, not layout structure

### 9. End-to-End Proof and Migration

Migrate the mission briefing target through the complete architecture.

Acceptance:

- a designer can build the reference mission briefing using templates, CMS
  bindings, surfaces, and layout controls
- saved authoring JSON compiles into runtime contracts
- DOM/CSS export matches preview for every selected target type
- build and focused contract tests pass
- no editor-only metadata is required by product renderers

## Implementation Order

The next implementation lane should be:

1. Add the pure node tree operation module and tests.
2. Wire add/delete/duplicate/move/wrap commands into the existing feed target
   tree.
3. Add a small template registry that creates ordinary node subtrees.
4. Expose `Two Column Group`, `Label/Value Stack`, and `CTA Row` first.
5. Add CMS field/binding editor for selected text and button nodes.
6. Rename/simplify the layout UI labels while preserving JSON compatibility.
7. Finish generated surface controls for any remaining manual editor groups.
8. Extend export/proof tests across node templates.
9. Migrate mission briefing composition from hand-authored defaults to template
   authored structure.

## Done Definition

This spec is complete when `/material-main` can create, edit, persist, export,
and re-render a mission briefing UI made from nested nodes, CMS bindings, and
surface recipes, with no special-case editor leakage in product DOM and no need
to encode layout as rich text.
