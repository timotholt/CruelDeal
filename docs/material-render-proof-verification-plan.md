# Material Render Proof Verification Plan

Status: active
Date: 2026-06-03

## Goal

Build a verification framework that proves exported and runtime material UI actually render correctly, instead of merely serializing plausible DOM/CSS.

The framework must let both a human and Codex inspect failures efficiently.

```txt
Editor render
  vs Export HTML/CSS render
  vs SolidJS runtime render
  -> measurement checks
  -> pixel comparison
  -> failure classification
  -> fix loop
```

## Problem

The inspector currently shows export DOM/CSS, but the live editor still renders editor DOM. That means export output is inspectable, but not proven.

Export is accepted only when it can be mounted and compared.

## Proof Surfaces

Add an inspector tab:

```txt
Render Proof
```

For the selected target, render:

- **Editor Render:** current live editor target.
- **Export Render:** exact serialized export HTML/CSS mounted in a proof container.
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
- **editor pollution:** export/runtime contains editor-only attrs/classes

## Inspector Output

Render Proof tab should show a concise summary:

```txt
Rest: fail, 18.4% pixels differ
Hover: fail, export has no hover delta
Pressed: fail, transform missing
Node reduction: pass, 12 -> 2
Editor attrs removed: pass
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
3. Fix emitter or runtime renderer, not the authored recipe, unless the recipe is invalid.
4. Rerun proof.
5. Add or update golden test.
6. Repeat until accepted.

Rules:

- Do not tune sliders or authored recipe values to make proof pass.
- Do not add editor-only CSS to proof output.
- Do not patch the proof container to hide an export/runtime bug.
- If export output needs inherited CSS, make that dependency explicit and emitted.

## Acceptance Criteria For CTA

CTA export/runtime is accepted when:

- exact export HTML/CSS mounts in proof surface
- Solid runtime render mounts in proof surface
- rest pixel diff is below threshold
- hover state is verified
- pressed state is verified
- text is visible and unclipped
- click target matches editor target dimensions
- no editor-only attrs/classes appear in export/runtime
- golden tests cover inactive layers, simple text, fitted text, and state behavior

## First Implementation Slice

Build `Render Proof` for selected CTA only:

1. Add proof tab.
2. Mount exact export HTML/CSS in a same-sized proof pane.
3. Mount Solid runtime renderer from emission plan.
4. Compare bounding boxes and computed styles.
5. Add screenshot crop and pixel diff.
6. Show diagnostic summary in inspector.
7. Use the report to fix CTA export/runtime bugs.
