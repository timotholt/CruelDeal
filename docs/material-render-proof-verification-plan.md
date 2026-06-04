# Material Render Proof Verification Plan

Status: active
Date: 2026-06-03

## Goal

Build a verification framework that proves export/runtime material UI uses the same product DOM/CSS subtree as the editor preview, instead of merely serializing plausible alternate DOM/CSS.

The framework must let both a human and Codex inspect failures efficiently.

```txt
Preview product render
  vs Export HTML/CSS render
  vs SolidJS runtime render
  -> measurement checks
  -> pixel comparison
  -> failure classification
  -> fix loop
```

## Problem

The inspector currently shows export DOM/CSS, but the live editor can still render legacy editor DOM around or inside the product target. That means export output is inspectable, but not proven and not trusted.

Export is accepted only when it can be mounted and compared against the live preview product subtree. For the first migration pass, export should serialize that product subtree directly after editor-owned metadata has been moved outside the boundary. It must not be an unrelated minimal structure.

## Proof Surfaces

Add an inspector tab:

```txt
Render Proof
```

For the selected target, render:

- **Preview Product Render:** current live preview product subtree, excluding editor shell UI.
- **Export Render:** exact serialized export HTML/CSS mounted in a proof container. Its structure should be recognizable as the preview product subtree.
- **Solid Runtime Render:** trusted SolidJS runtime renderer output from the same emission plan.
- **Diff:** measurement and pixel comparison output.

## Critical Rule

Export proof must mount the exact serialized export output:

```html
<style>
  /* exact export CSS */
</style>
<!-- exact export HTML -->
```

The proof harness may provide sizing and isolation containers, but it must not patch the exported button's look to make the test pass.

The proof harness must audit both preview product subtree and export. If either contains editor-only storage/diagnostic nodes/classes/attrs, proof fails. If export removes active visual layers before equivalence is proven, proof fails.

## Proof Container

The proof container should:

- match the selected editor target's width and height
- isolate proof CSS from the editor page
- avoid inherited editor styling except a controlled baseline
- report when an export relies on missing inherited styles

Suggested shape:

```html
<div class="material-render-proof">
  <div class="material-render-proof__pane" data-proof-mode="editor"></div>
  <div class="material-render-proof__pane" data-proof-mode="export"></div>
  <div class="material-render-proof__pane" data-proof-mode="solid-runtime"></div>
  <canvas class="material-render-proof__diff"></canvas>
</div>
```

## Automated Checks

### DOM Checks

For each proof surface:

- node count
- class count
- attribute count
- inline style declaration count
- CSS variable count
- editor-only attributes/classes
- editor-only wrapper nodes
- hidden probe/diagnostic nodes
- semantic/native attributes
- text content
- click target presence

### Layout Checks

Compare:

- bounding box width/height
- text bounding box
- overflow/clipping
- padding/inset effect
- hit target dimensions

### Computed Style Checks

Compare key computed styles:

- `font-family`
- `font-size`
- `font-weight`
- `font-style`
- `letter-spacing`
- `text-transform`
- `color`
- `text-shadow`
- `background`
- `border`
- `border-radius`
- `box-shadow`
- `filter`
- `transform`
- `opacity`

### State Checks

Run each supported target in:

- rest
- hover
- pressed
- active/current
- disabled

If a state is unsupported by export/runtime, the proof result must say that explicitly.

## Pixel Comparison

Use browser screenshots:

1. Locate editor target bounding box.
2. Render export/runtime proof at the same size.
3. Capture cropped screenshots.
4. Compare pixels with tolerance.

Report:

- total differing pixels
- percent difference
- max channel delta
- average delta
- bounding box mismatch
- transparent/empty output detection

Suggested thresholds:

```txt
0.0% - 1.0%: pass
1.0% - 3.0%: warning
> 3.0%: fail
```

Thresholds should be tuned per component family because texture noise and subpixel font rendering may need tolerance.

## Failure Classification

The verifier should classify likely causes:

- **text/fitter:** text size, wrapping, clipping, font, line-height, transform
- **layout:** width, height, padding, alignment, placement
- **material layer:** texture, gradient, tint, glass, edge wear
- **border/shadow:** border sides, opacity, inset highlight, drop shadow
- **state:** hover, pressed, active, disabled missing or wrong
- **runtime:** Solid render differs from export HTML render
- **preview pollution:** live preview product subtree still stores editor knowledge in permanent attrs/classes/nodes that should be moved to RAM or an external editor shell
- **export pollution:** export/runtime contains editor-only attrs/classes/nodes
- **false minimization:** export structure differs from preview product subtree because active visual layers were optimized away without proof

## Inspector Output

Render Proof tab should show a concise summary:

```txt
Rest: fail, 18.4% pixels differ
Hover: fail, export has no hover delta
Pressed: fail, transform missing
Node reduction: pass, 12 -> 2
Preview/product DOM clean: pass
Text visible: pass
Likely cause: text/fitter + state
```

It should also expose:

- cropped editor image
- cropped export image
- cropped runtime image
- diff image
- computed-style diff table
- copyable diagnostic JSON

## Fix Loop

1. Run proof for selected target.
2. Read failure category.
3. Fix product boundary, editor shell, export serializer, or runtime renderer, not the authored recipe, unless the recipe is invalid.
4. Rerun proof.
5. Add or update golden test.
6. Repeat until accepted.

Rules:

- Do not tune sliders or authored recipe values to make proof pass.
- Do not add editor-only CSS to proof output or live product preview.
- Do not patch the proof container to hide an export/runtime bug.
- If export output needs inherited CSS, make that dependency explicit and emitted.
- If an editor feature needs metadata, store it in RAM rather than product DOM.

## Acceptance Criteria For CTA

CTA export/runtime is accepted when:

- exact export HTML/CSS mounts in proof surface
- Solid runtime render mounts in proof surface
- export is the same product subtree/emission plan used by the editor preview
- rest pixel diff is below threshold
- hover state is verified
- pressed state is verified
- text is visible and unclipped
- click target matches editor target dimensions
- no editor-only storage/diagnostic attrs/classes/nodes appear in export/runtime
- active visual layers are not removed until proof says they are equivalent
- golden tests cover inactive layers, simple text, fitted text, and state behavior

## First Implementation Slice

Build `Render Proof` for selected CTA only:

1. Add proof tab.
2. Locate the live preview CTA product subtree and separately audit the editor shell.
3. Mount exact export HTML/CSS in a same-sized proof pane.
4. Mount Solid runtime renderer from the same product component/emission plan when available.
5. Compare bounding boxes and computed styles.
6. Add screenshot crop and pixel diff.
7. Show diagnostic summary in inspector.
8. Use the report to fix CTA preview/export/runtime bugs.
