# Material Preview Generic Interactions Plan

## Goal

Refactor the main material preview so any rendered material target can be tested in place with the same generic interaction system: hover, pressed, active/selectable, and focus preview. This should work for the Contract CTA child material, nav items, toolbar buttons, currency buttons, feed child surfaces, and future editable targets without adding bespoke handlers for every component.

This plan is subordinate to `docs/material-preview-emission-rules.md`: preview DOM/CSS is sacred product output. Interaction state must be stored in RAM and passed into product renderers. Do not add permanent `data-*` attributes, wrapper frames, debug classes, or hidden nodes to the material DOM to make interaction tracking easier.

The end state is:

- The selected editable target can be hovered, pressed, and focused directly in the phone preview.
- An optional all-on-screen mode can let any visible material target respond.
- Force Preview still pins the selected target state when enabled.
- Static targets do not accidentally behave like buttons.
- Feed carousel dragging still works.
- State edits keep enabling the edited state and do not get pruned by top-level feed card capabilities.

## Important Current Context

Relevant files:

- `components/screens/MainMaterialPreviewScreen.tsx`
- `components/ui/material-lab/MaterialRecipeEditor.tsx`
- `components/ui/material-lab/MaterialRecipeTypes.ts`
- `components/ui/material-lab/MaterialPrimitives.tsx`
- `src/styles/ui-material-lab.css`

Known recent fixes:

- CTA child material state edits were being stripped because selected feed child updates were pruned with top-level `feedCards` capabilities. Preserve the fix that prunes selected feed target recipes by the selected target's own capabilities.
- `MainMaterialPreview` already passes `selectedFeedPreviewState` so Force Preview can render the selected feed child state instead of top-level `feedCards` static rest.
- `State Surface`, `State Glow`, `Edge Emission`, `State Text`, and `State Motion` should be disabled when the selected state overlay is off.

Known current gap:

- Nav items have explicit click/active wiring through `activeNavIndex`, `navItemState`, and per-item `onClick`.
- Feed CTA is just a `MaterialButton` inside `FeedCardTreeNode`, receiving the feed carousel's shared `surfaceState`. It does not have target-specific hover/pressed/focus interaction state.
- Feed carousel owns pointer events for dragging, so CTA press testing must coexist with drag detection.

## Implementation Strategy

Do this as a small enabling refactor first, then migrate behaviors onto it.

Do not rewrite the material recipe system. The missing layer is between "this rendered thing is an editable preview target" and "what visual state should it show right now?"

## Phase 1: Add Shared Preview Target Types

Create shared local types near the main preview target code in `MainMaterialPreviewScreen.tsx`. If the file becomes too crowded, extract to a new sibling module later, but keep the first pass close to usage.

Suggested types:

```ts
type PreviewInteractionMode = 'selected-only' | 'all-on-screen';

type PreviewInteractionRole =
  | 'static'
  | 'momentary'
  | 'selectable'
  | 'container'
  | 'text';

interface PreviewInteractionSnapshot {
  mode: PreviewInteractionMode;
  selectedTargetId: string;
  forcePreview: boolean;
  forcedState: MaterialRecipeState;
  hoveredTargetId: string | null;
  pressedTargetId: string | null;
  focusedTargetId: string | null;
  activeTargetIds: ReadonlySet<string>;
}

interface PreviewTargetFrameProps {
  targetId: string;
  role: PreviewInteractionRole;
  selected?: boolean;
  focusable?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  children: JSX.Element;
}
```

These types represent RAM state and component props. They are not permission to add permanent editor metadata to product DOM.

Use existing interaction role values where possible:

- `static` -> no live hover/press unless force preview is active.
- `momentary` -> hover and pressed.
- `selectable` -> hover, pressed, and active.
- `container` and `text` -> normally hover/focus only if the editor mode allows it, but no pressed feedback by default.

## Phase 2: Add One Generic Target Shell

Add a component in `MainMaterialPreviewScreen.tsx`:

```tsx
const PreviewTargetFrame = (props: PreviewTargetFrameProps) => (
  <div
    class={`main-material-preview-target ${props.selected ? 'is-editing-target' : ''} ${props.class || ''}`}
    data-material-target-id={props.targetId}
    data-material-role={props.role}
    tabIndex={props.focusable ? 0 : undefined}
    style={props.style}
  >
    {props.children}
  </div>
);
```

Updated architecture rule:

- If a migrated target needs an editor wrapper, that wrapper must be an outside editor shell, not a product-internal node.
- Prefer passing `targetId`, role, and selection handlers through Solid props/closures.
- If a wrapper is temporarily needed inside the product subtree during migration, treat it as legacy debt and remove it when the target family moves to product DOM.
- If a target id is temporarily emitted as `data-material-target-id` inside product DOM, document it as a migration compromise and do not export it.

Then gradually replace ad hoc wrappers:

- `FeedNodeFrame` should emit the data attributes for the node target id.
- Top-level parts can be wrapped or receive data attributes directly.
- Nav items should get target ids per item, not just the shared `navBar` part.
- Toolbar and currency buttons should get target ids per button if they need independent interaction testing.

For the first implementation, do not over-migrate. Start with:

1. Feed CTA child target.
2. Nav items.
3. Toolbar buttons.
4. Currency buttons.

## Phase 3: Add Generic Visual State Resolver

Add a pure helper:

```ts
const resolvePreviewVisualState = (args: {
  targetId: string;
  role: PreviewInteractionRole;
  snapshot: PreviewInteractionSnapshot;
  fallbackState: MaterialRecipeState;
}): MaterialRecipeState => {
  const {
    targetId,
    role,
    snapshot,
    fallbackState,
  } = args;

  const isSelected = snapshot.selectedTargetId === targetId;
  const isEligible = snapshot.mode === 'all-on-screen' || isSelected;

  if (snapshot.forcePreview && isSelected) return snapshot.forcedState;
  if (!isEligible) return fallbackState;

  if (role === 'static') return fallbackState;
  if (snapshot.pressedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'pressed';
  if (snapshot.activeTargetIds.has(targetId) && role === 'selectable') return 'active';
  if (snapshot.hoveredTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';

  // Current recipe states are rest | hover | active | pressed.
  // Until a distinct focus recipe state is added, focus should preview hover for momentary/selectable controls.
  if (snapshot.focusedTargetId === targetId && (role === 'momentary' || role === 'selectable')) return 'hover';

  return fallbackState;
};
```

Notes:

- Do not add `focus` to `MaterialRecipeState` in the first pass unless explicitly requested. The current material state model is `rest | hover | active | pressed`.
- Focus preview can map to `hover` initially. A later design pass can add true focus styling or a separate focus-visible outline.
- Force Preview should override live hover/press for the selected target. That keeps the editor predictable.

## Phase 4: Add Delegated Preview Interaction Controller

In `MainMaterialPreview`, add local signals:

```ts
const [previewInteractionMode, setPreviewInteractionMode] = createSignal<PreviewInteractionMode>('selected-only');
const [hoveredTargetId, setHoveredTargetId] = createSignal<string | null>(null);
const [pressedTargetId, setPressedTargetId] = createSignal<string | null>(null);
const [focusedTargetId, setFocusedTargetId] = createSignal<string | null>(null);
const [activeTargetIds, setActiveTargetIds] = createSignal<ReadonlySet<string>>(new Set());
```

Prefer component-bound handlers because they do not require permanent DOM metadata. Delegated handlers are allowed only as a migration step for legacy components that have not moved to product render yet.

Legacy delegated handler shape:

```ts
const targetFromEvent = (event: Event): HTMLElement | null => (
  event.target instanceof HTMLElement
    ? event.target.closest<HTMLElement>('[data-material-target-id]')
    : null
);

const roleFromTarget = (target: HTMLElement): PreviewInteractionRole => (
  target.dataset.materialRole as PreviewInteractionRole || 'static'
);
```

Handler behavior:

- `pointerover`: set hovered target id from closest target.
- `pointerout`: clear hover when leaving the current target.
- `pointerdown`: set pressed target id if role is `momentary` or `selectable`.
- `pointerup` / `pointercancel`: clear pressed target id.
- `focusin`: set focused target id.
- `focusout`: clear focused target id if matching.
- `click`: if role is `selectable`, set active target id. Preserve existing nav active behavior while migrating.

Important:

- Do not execute real app actions from preview clicks.
- Do not make static panels clickable.
- Do not stop propagation globally. Feed carousel drag still needs pointer events.
- Do not add permanent product DOM attributes just to support delegated lookup.

## Phase 5: Resolve Feed Carousel Drag Conflicts

Feed carousel currently has pointer drag handlers on the stage. Keep them, but add a drag threshold rule:

- On pointer down inside an interactive preview target, set pressed target id.
- Track initial pointer coordinates in the carousel as it already does.
- If movement exceeds the carousel drag threshold, clear `pressedTargetId` and let carousel drag win.
- If movement stays under threshold, keep pressed feedback and allow click/up to finish normally.

Implementation hint:

- The feed carousel already tracks `dragStartX` and `dragDeltaX`.
- Add a boolean signal like `dragStartedOnInteractiveTarget`.
- When `Math.abs(rawDeltaX)` exceeds the existing threshold or a smaller activation threshold such as `8`, clear the pressed preview state through a callback prop.

Do not special-case CTA by name. Use `data-material-role`.

## Phase 6: Wire Feed Targets To Target-Specific State

Current issue:

- `FeedCardTreeNode` receives one `surfaceState` for the whole feed.
- Every child, including CTA, renders with that same state.

Refactor props:

```ts
const FeedCardTreeNode = (props: {
  node: FeedCardNode;
  story: FeedStory;
  cardType: FeedCardTypeRecipe;
  surfaceStateForTarget: (targetId: FeedMaterialTargetId, role: PreviewInteractionRole) => MaterialRecipeState;
  selectedFeedTargetClass: (targetId: FeedMaterialTargetId) => string;
}) => { ... };
```

Inside the node:

```ts
const targetId = () => feedMaterialTargetIdForNode(props.cardType.id, props.node.id);
const role = () => props.node.type === 'button' ? 'momentary' : props.node.type === 'container' ? 'container' : 'text';
const visualState = () => props.surfaceStateForTarget(targetId(), role());
```

Use `visualState()` when rendering `MaterialButton` or `MaterialPanel`.

For top-level feed card surfaces, keep the card type target id:

```ts
feedCardMaterialTargetId(cardType().id)
```

Give it role `static` or `container`.

## Phase 7: Migrate Nav Onto The Same Resolver

Nav currently has separate logic:

- `activeNavIndex`
- `navItemState(index)`
- `navItemClass(index)`

Keep `activeNavIndex` as the source of durable selection for now, but compute visual state via the generic resolver.

Suggested target ids:

```ts
const navItemTargetId = (index: number) => `nav:item:${index}`;
```

For each `MaterialNavItem`:

```tsx
const targetId = navItemTargetId(index);
const fallbackState = index === props.activeNavIndex ? 'active' : 'rest';
visualState={resolvePreviewVisualState({
  targetId,
  role: 'selectable',
  snapshot: interactionSnapshot(),
  fallbackState,
})}
```

Keep `onClick={() => props.onActiveNavIndexChange(index)}` until the generic click handler owns active selection reliably.

## Phase 8: Editor Mode Control

Add a small control near the existing preview/selection controls:

- `Selected only`
- `All on-screen`

Default: `Selected only`.

This prevents unselected surfaces from flickering while editing. It also gives designers a way to test the full screen later.

Avoid lengthy explanatory UI text. Use compact labels.

## Phase 9: Acceptance Checks

Use the in-app Browser or Playwright/Node browser control. Do not only read code.

Manual/browser flow:

1. Open `http://127.0.0.1:3000/main-material`.
2. Select `Feed Card 1 > Contract CTA child material`.
3. Scroll the right editor to `State`.
4. Click `Hover`.
5. Turn `Force Preview` on and off to verify forced state still wins when on.
6. With Force Preview off, hover the CTA in the phone preview.
7. Confirm CTA DOM/style changes to hover state.
8. Press and hold the CTA.
9. Confirm CTA DOM/style changes to pressed state.
10. Tab or focus the CTA in preview mode.
11. Confirm focus previews as hover, or whichever mapping is implemented.
12. Drag the feed carousel.
13. Confirm dragging still changes slides and clears pressed preview after drag threshold.
14. Click nav items and confirm active nav still changes.
15. Hover/press nav items and confirm transient states still work.
16. Test toolbar and currency buttons if migrated in the same pass.

Programmatic checks:

- Inspect migrated rendered target elements and confirm they do not need permanent editor-only `data-*` ids for interaction.
- If a legacy target still uses `data-material-target-id`, record it as migration debt and confirm it is not emitted by product export/runtime.
- Confirm selected CTA state edits persist in exported/local recipe state.
- Confirm no hidden sanitizer reintroduces default hover/pressed CTA states.
- Confirm static targets do not enter pressed state on click.

Commands:

```sh
npm run build
npx eslint components/ui/material-lab/MaterialRecipeEditor.tsx components/ui/material-lab/MaterialRecipeTypes.ts components/ui/material-lab/MaterialPrimitives.tsx --max-warnings 0
npx eslint components/screens/MainMaterialPreviewScreen.tsx --max-warnings 0
```

If `MainMaterialPreviewScreen.tsx` lint fails on existing warnings, report the warnings separately and do not mix that cleanup into this interaction refactor unless explicitly requested.

## Implementation Order For Codex

1. Inspect `git status --short` and current diffs first. Do not revert user changes.
2. Add shared preview interaction types and resolver.
3. Prefer component-bound interaction props/closures for migrated targets.
4. Use `PreviewTargetFrame`/data attributes only for legacy targets that have not moved to product DOM, and mark them as migration debt.
5. Refactor feed node rendering to ask `surfaceStateForTarget`.
6. Wire CTA child target through the resolver.
7. Migrate nav visual state to the resolver while preserving `activeNavIndex`.
8. Add selected-only/all-on-screen mode control.
9. Optionally migrate toolbar/currency buttons if the first two migrations are stable.
10. Verify in browser with real pointer interactions.
11. Run build and targeted lint.

## Non-Goals For First Pass

- Do not redesign the material recipe state editor.
- Do not add a new `focus` recipe state unless requested.
- Do not remove existing nav active selection behavior until the generic active-target model is proven.
- Do not make preview clicks execute real navigation or app actions.
- Do not refactor production game components yet; this plan is for the material preview.
