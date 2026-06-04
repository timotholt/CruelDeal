# Material Preview Emission Rules

Status: active
Date: 2026-06-03

These rules define how the material editor should render, inspect, and export UI surfaces.

## Governing Principle

The preview DOM and CSS are sacred. They must be the same product DOM and CSS that the game runtime/export path uses.

Editor knowledge belongs in RAM: Solid state, stores, registries, maps, and emission plans. If a current editor feature depends on permanent DOM attributes, extra classes, wrapper nodes, hidden spans, probe elements, or CSS variables that the game runtime would not need, that feature should be rewritten. Do not preserve polluted DOM for compatibility.

Allowed editor additions are only temporary visual affordances that are visible right now, such as a selected outline or a short flash. They must be owned by the editor, removed when inactive, and excluded from export/runtime output.

## Rules

1. **DOM/CSS must not store editor knowledge.** Anything the material editor can store in memory or a registry must not be emitted as DOM attributes, classes, CSS variables, style declarations, or wrapper nodes.

2. **Preview DOM/CSS must be final output.** The on-screen preview renders the same product DOM/CSS as runtime/export. "Close enough" is not the target.

3. **Editor mutations must be temporary and justified.** A mutation is allowed only when a current visible editor feature is active. When the feature stops, the DOM/CSS mutation is removed.

4. **Semantic/runtime hooks are allowed.** DOM may keep attributes and elements that affect real behavior or accessibility, such as native button/link elements, `type`, `disabled`, `href`, and necessary `aria-*` state.

5. **Prefer event-bound identity over DOM identity.** Selection should be wired through Solid props, closures, refs, or an internal element registry. A permanent `data-*` target id is a temporary migration compromise, not the final architecture.

6. **Diagnostics belong in RAM.** Layout modes, provenance, active layers, recipe ids, fitter status, source controls, and debug data live in internal structures keyed by component id, signal state, or element reference.

7. **CSS variables emit only when consumed.** No recipe-mirroring variables. If a variable is not consumed by active CSS in the current mode, it should not exist.

8. **Classes emit only for product behavior or style.** Classes select active runtime CSS or express real semantic/runtime state. Editor-only classes are temporary visual effects only.

9. **The exporter must render-prove identity.** Inspecting serialized strings is not enough. Export DOM/CSS must be mountable in a proof surface and match the preview product render.

10. **No speculative editor affordances.** Do not add handles, labels, probes, hit-test layers, measurement UI, or debug wrappers unless a current feature actually uses them. If they are needed, they live in RAM and temporary editor UI, not the product DOM.

## Working Doctrine

Render the product. Store the editor in RAM. Export what renders.
