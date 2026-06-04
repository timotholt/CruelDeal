# Material Workbench Design

## Goal

The Material Lab should become a reusable editing workbench that can sit beside any real screen preview. Login, Store, Main Menu, and later modal previews should all use the same material controls instead of each screen growing its own near-copy.

This keeps the production screen code separate from experimental tuning while letting us promote finished recipes back into the real game UI.

## Layout

Use a consistent three-column workbench:

```text
[ Parts ] [ 9:16 Preview ] [ Material Controls ]
```

- **Parts** is screen-specific. It lists named editable regions such as `Backdrop`, `Brand Plate`, `Primary Button`, or `Store Card`.
- **Preview** is screen-specific. It renders the actual mock screen and highlights the selected region.
- **Material Controls** is shared. It edits one `MaterialRecipe` with the canonical Material Lab controls.

The workbench shell owns the design-tool chrome. The screen preview owns only the game UI being tuned.

The preview DOM/CSS is sacred product output. The workbench may store selection, diagnostics, provenance, part metadata, and control state internally, but it must not permanently write that information into the preview DOM/CSS. If a workbench feature needs metadata, rewrite the feature to use RAM, refs, or component props instead of DOM garbage.

## Component Contract

### `MaterialWorkbenchLayout`

Shared shell for every material migration preview.

```tsx
<MaterialWorkbenchLayout
  title="Login Skin"
  subtitle="Material Preview"
  parts={parts}
  selectedPartId={selectedPart()}
  onSelectPart={setSelectedPart}
  preview={<LoginPreview />}
  editor={<MaterialRecipeEditor recipe={recipe()} onChange={updateRecipe} />}
  footer={<button>Reset</button>}
/>
```

### `MaterialRecipeEditor`

Shared editor for material-bearing UI regions.

```tsx
<MaterialRecipeEditor
  recipe={selectedRecipe()}
  onChange={(recipe) => updateSelectedRecipe(recipe)}
/>
```

It edits only reusable surface properties: material, texture, glass, tint, border, glow, gradient, radius, and numeric strengths. It does not know about login, store, or navigation.

### `MaterialPartSelector`

Shared selector for screen-specific parts.

```tsx
<MaterialPartSelector
  parts={parts}
  selectedPartId={selectedPart()}
  onSelect={setSelectedPart}
/>
```

Parts can represent either material regions or custom regions. For example, Login has a `Backdrop` part that uses custom image controls instead of `MaterialRecipeEditor`.

## Data Model

`MaterialRecipe` is the app-level recipe shape for tuning. It is intentionally close to `MaterialPanel` / `MaterialButton` props, but it is stored as plain JSON so it can be saved, copied, and promoted into named recipes later.

```ts
interface MaterialRecipe {
  material: 'raw' | 'stone';
  texture: TextureKind;
  shape: 'rect' | 'beveled';
  glass: boolean;
  glassOpacity: number;
  glassBlur: number;
  tint: TintTone;
  tintStrength: number;
  gradient: SurfaceGradient;
  sheen: boolean;
  glow: GlowTone;
  glowStrength: number;
  selected: boolean;
  border: EdgeName[];
  corners: CornerName[];
  edgeHighlight: EdgeName[];
  textureStrength: number;
  textureScale: number;
  borderOpacity: number;
  lightStrength: number;
  darkStrength: number;
  cornerSize: number;
  radius: number;
}
```

## Rules

- Do not couple the workbench to production screen behavior.
- Do not make the production login screen import the workbench.
- Do not duplicate material controls per screen.
- Let each screen keep custom non-material controls when needed, such as Login backdrop image tone.
- Store workbench recipes in localStorage for iteration, then export JSON when a direction is worth promoting.
- Preview uses the same product DOM/CSS that runtime/export would use for migrated families.
- Workbench diagnostics live in RAM, not permanent DOM attributes/classes/wrappers.
- Temporary visible editor affordances must be removed when inactive.

## Migration Path

1. Refactor `/login-material` to use the shared workbench layout and editor.
2. Move the original `/uitest` controls toward `MaterialRecipeEditor` once Login proves the API.
3. Add `/store-material` as the next screen-specific preview using the same workbench.
4. Promote stable recipes into named game UI wrappers such as `GamePanel`, `GameButton`, and `StoreItemCard`.
