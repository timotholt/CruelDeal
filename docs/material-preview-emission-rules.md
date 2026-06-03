# Material Preview Emission Rules

Status: active
Date: 2026-06-03

These rules define how the material editor should render, inspect, and export UI surfaces.

## Rules

1. **DOM/CSS must not store editor knowledge.** Anything the material editor can store in memory or a registry should not be emitted as DOM attributes, classes, CSS variables, or style declarations.

2. **Preview DOM/CSS should approximate final output by default.** The on-screen preview should render as close to exported/runtime output as possible, ideally exactly, with editor affordances layered externally.

3. **Editor mutations must be temporary.** Selection flashes, probes, deletion tests, hover inspection, and measurement markers should be injected only while active, then removed.

4. **Semantic/runtime hooks are allowed.** DOM may keep attributes and elements that affect real behavior or accessibility, such as native button/link elements, `type`, `disabled`, `href`, and necessary `aria-*` state.

5. **One stable editor target hook is allowed.** A minimal hook such as `data-material-target-id`, or an internal element registry, may exist to map a clicked element to editor state. Additional editor metadata must justify why it cannot live in the registry.

6. **Diagnostics belong in an inspector registry.** Layout modes, provenance, active layers, recipe ids, fitter status, source controls, and debug data should live in an internal structure keyed by target id or element reference.

7. **CSS variables emit only when consumed.** No recipe-mirroring variables. If a variable is not consumed by active CSS in the current mode, it should not exist.

8. **Classes emit only for active behavior or style.** Classes should select active CSS, express real semantic/runtime state, or support a temporary active editor affordance. They should not describe inactive possibilities.

9. **The exporter must render-prove itself.** Inspecting serialized strings is not enough. Export DOM/CSS must be mountable in a proof surface and compared against preview output.

10. **Editor affordances should be overlay-first.** Selection outlines, drag handles, labels, probes, and flashes should live in separate overlay layers where possible, not inside the component's material DOM.

## Working Doctrine

Render the product. Store the editor. Overlay the tools. Export what renders.
