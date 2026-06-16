# Main Material Content-Box Renderer Architecture

Date: 2026-06-16

## Objective

Make nodes in the Main Material editor tree behave like normal HTML parent/child layout without giving up the current layered material surface model.

The user-facing rule should be simple:

- The node surface owns glass, blur, border, bevel, texture, tint, glow, and state overlays.
- The node content box owns padding, gap, alignment, text, and child placement.
- Children in the left editor tree are rendered inside their parent content box by default.
- Full-frame/overlay behavior is explicit, not accidental.

## Current Problem

The current renderer already has a surface layer and a child stack, but the model is implicit:

```html
<div class="material-node">
  <section class="material-node-surface"></section>
  <div class="main-material-card-node-flow-stack">
    <child-node />
  </div>
</div>
```

This preserves glass effects, but it makes editor semantics hard to reason about:

- The visible parent is the surface, but children are not inside that surface element.
- Parent padding is emitted both as frame style and as `--feed-node-padding` for the flow stack.
- Absolute children can feel frame-relative even when the editor tree implies content-relative.
- The editor labels nodes as real children, but the renderer treats the content stack as a host detail.

The result is recurring confusion around padding, gap, borders, and child indentation.

## Target DOM Contract

Every renderable node should compile to this canonical shape:

```html
<div class="material-node-frame" data-material-node-id="mission-briefing">
  <section class="material-node-surface" aria-hidden="true"></section>

  <div class="material-node-content-box">
    <span class="material-node-own-content">...</span>
    <div class="material-node-frame" data-material-node-id="child-a">...</div>
    <div class="material-node-frame" data-material-node-id="child-b">...</div>
  </div>
</div>
```

The surface remains a sibling of the content box so glass/blur/border effects can continue to fill the full frame. The content box becomes the canonical parent for own content and children.

## Layout Semantics

### Frame

The frame owns:

- x/y position in the parent formatting context
- width/height/min-size/max-size
- frame-relative overlays when explicitly requested
- selection outline and editor instrumentation

The frame does not own ordinary child padding/gap.

### Surface

The surface owns:

- material recipe rendering
- glass/blur/border/bevel/texture/edge wear/glow
- state overlays
- full-frame visual extent

The surface should usually be:

```css
.material-node-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
```

### Content Box

The content box owns:

- `padding`
- `gap`
- `display`
- `flex-direction`
- `align-items`
- `justify-content`
- text alignment
- clipping policy for ordinary content
- default containing block for child nodes

The content box should usually be:

```css
.material-node-content-box {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: var(--node-padding, 0px);
  display: flex;
  flex-direction: column;
  gap: var(--node-gap, 0px);
}
```

## Position Context

Add an explicit position context concept:

```ts
type MaterialNodePositionContext = 'content-box' | 'frame';
```

Default: `content-box`.

- `content-box`: absolute children position against the padded content area.
- `frame`: absolute children position against the full frame, ignoring content padding.

Use `frame` only for intentional overlays, full-bleed art, badges pinned to a card corner, and selection/audit artifacts.

## Compatibility Plan

Do not rip out the existing renderer in one pass.

Keep these names as compatibility aliases during migration:

- `main-material-card-node-flow-stack`
- `main-material-card-node-surface`
- `main-material-card-node--container-frame`

Add new canonical classes alongside them:

- `material-node-frame`
- `material-node-surface-layer`
- `material-node-content-box`

CSS should initially target both old and new selectors.

## Implementation Plan

### Phase 1: Formalize Content Box

Files:

- `components/ui/material-node/MaterialNodeRenderer.tsx`
- `components/ui/material-node/MaterialNodeTypes.ts`
- `components/ui/material-node/materialNodeLayoutCss.ts`
- `src/styles/main-material-preview.css`

Work:

- Add `contentBoxClassForNode` to `MaterialNodeRenderContext`.
- Rename renderer conceptually from `childStackClass` to content box, while keeping the old callback as an alias.
- Render own content and children inside one content box for container nodes.
- Add a default content-box class from the canonical renderer so hosts do not need to remember it.

Acceptance:

- Existing Main Material page renders unchanged.
- Existing tests pass.
- DOM has a stable `.material-node-content-box` on every container node.

### Phase 2: Move Padding/Gap Semantics To Content Box

Files:

- `components/screens/main-material/feedNodeLayoutCss.ts`
- `components/screens/main-material/mainMaterialFeedToNode.ts`
- `src/styles/main-material-preview.css`

Work:

- Keep frame position/size in `layout.style`.
- Emit padding/gap/alignment variables for the content box.
- Stop relying on frame padding for normal child indentation.
- Preserve frame padding only as a temporary compatibility output where tests depend on it.

Acceptance:

- Parent padding changes child indentation in a way that matches normal HTML.
- Surface still fills the full visual frame.
- Existing reward/footer layout remains stable.

### Phase 3: Content-Relative Absolute Children

Files:

- `components/screens/main-material/feedNodeLayoutCss.ts`
- `components/ui/material-node/materialNodeLayoutCss.ts`
- `components/screens/main-material/mainMaterialFeedModel.ts`

Work:

- Add `positionContext?: 'content-box' | 'frame'` to layout.
- Default new nodes to `content-box`.
- Treat `slot: 'overlay'` and explicit overlay nodes as `frame`.
- Migrate old saved layouts conservatively: existing absolute nodes keep current visual behavior until touched or migrated by targeted node id.

Acceptance:

- A new child added under a padded parent starts inside the parent padding.
- Existing top bar, nav, badges, and overlay controls do not jump.

### Phase 4: Editor Contract Cleanup

Files:

- `components/screens/main-material/mainMaterialFeedEditors.tsx`
- `components/screens/main-material/mainMaterialDomAudit.ts`
- export/emission inspector files

Work:

- Rename UI labels so users see `Padding` as content padding.
- Add advanced control for `Position Box: Content | Frame`.
- Make DOM export label content-box styles as layout, not mysterious skin.
- In emission panel, show `Frame`, `Surface`, and `Content Box` sections separately.

Acceptance:

- Users can tell where padding/gap/border live.
- The left tree maps to visible DOM nesting.
- Export/debug output explains the three layers.

### Phase 5: Remove Compatibility Debt

Only after a stable pass:

- Collapse duplicate data/class selectors.
- Remove old `childStackClassForNode` naming.
- Remove frame padding compatibility assertions.
- Update architecture docs and tests to canonical names only.

## Test Plan

Add or update focused tests:

- Container renders a content box containing children.
- Surface remains a sibling and absolute background.
- Parent padding indents an in-flow child by exactly the padding amount.
- Gap spaces real child elements.
- Absolute child defaults to content-box positioning.
- Overlay child can opt into frame positioning.
- Main Material V2 reward/footer visual geometry remains stable.

Suggested commands:

```bash
npx tsx components/screens/main-material/mainMaterialFeedToNode.test.ts
npx tsx components/screens/main-material/mainMaterialNodeTreeOperations.test.ts
npx vitest run components/screens/main-material/feedNodeLayoutCss.test.ts components/screens/main-material/mainMaterialFeedToNode.render.test.tsx
```

## Risks

- Some existing layouts may have been hand-tuned around frame-relative positioning.
- Saved local editor state can preserve stale geometry unless migrations are targeted.
- Surface screenshots may appear unchanged while DOM semantics change, so tests need to assert structure and geometry.
- Export/emission tooling may temporarily show duplicate concepts until frame/surface/content are split in the inspector.

## Rollback Point

Rollback tag before this architecture work:

```bash
main-material-reward-layout-checkpoint-2026-06-16
```
