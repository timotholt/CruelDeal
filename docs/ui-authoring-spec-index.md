# UI Authoring Specification Index

Status: authoritative routing document
Date: 2026-07-16

Use this page to decide which UI authoring documents may direct new work.

## Authoritative

1. `docs/semantic-ui-authoring-compiler-spec.md`
   Product goals, semantic component model, appearance compiler, deterministic
   output contract, editor topology, and progress rules.
2. `docs/css-effects-surface-compiler-rulebook.md`
   Property-by-property control behavior, CSS and effect lowering, bounded
   host/underlay/content/overlay allocation, conflicts, states, and mobile cost.
3. `docs/mission-briefing-v2-vertical-slice-spec.md`
   First measurable implementation milestone and its 10-point scorecard.
4. `docs/ui-authoring-visual-capability-contract.md`
   Supported visual range, the approved Mission Briefing target, and the rule
   that migration checkpoints must not be confused with product acceptance.
5. `docs/mission-briefing-v2-scorecard.md`
   Current binary milestone status, evidence locations, active work packet, and
   the only permitted measure of implementation progress.
6. `docs/references/ui-authoring/mission-v2-target-analysis.md`
   Measured extraction of the approved Mission target: normalized region
   bounds, hierarchy, material facts, responsive invariants, and implementation
   choice boundaries.

## Supporting references

These may supply evidence or subsystem details but cannot override the
authoritative documents:

- `docs/mission-briefing-design-memory-2026-06-02.md` — visual and content
  restoration memory.
- `docs/references/ui-authoring/mission-v2-target.png` — user-approved source
  raster governed by the target analysis above.
- `docs/references/ui-authoring/mission-v2-current/` — current implementation
  checkpoint used to detect accidental migration regressions; not the target.
- `docs/ui-material-lab-spec.md` — visual observations and legacy lab inventory.
- `docs/metallic-material-system-runtime-authoring-spec.md` — specialized
  metallic/reflection provider direction.
- `docs/dev-authoring-runtime-architecture-spec.md` — broad dev/runtime route
  separation.
- `docs/game-ui-skinning-cms-agent-spec.md` — trusted CMS/skin delivery
  constraints.
- `docs/solidjs-server-driven-ui-skins-migration-plan.md` — server-delivery and
  shared-runtime migration observations.
- `docs/agent-checkpoints/editor-architecture-convergence.md` — implementation
  history only; never a product specification.

## Superseded for new architecture

These describe prior strategies and must not direct new implementation:

- `docs/first-class-surface-architecture-spec.md`
- `docs/schema-driven-surface-editor-spec.md`
- `docs/surface-emitter-rewrite-spec.md`
- `docs/surface-composition-authoring-spec.md`
- `docs/main-material-editor-control-contract-spec.md`
- `docs/main-material-editor-architecture-handoff.md`
- `docs/main-material-content-box-renderer-architecture-spec.md`
- `docs/feed-model-unification-refactor-spec.md`
- `docs/surface-emitter-css-extraction.md`

Their useful observations may be migrated deliberately. Their governing ideas
are rejected where they assume a universal generic node, flat surface field bag,
one universal DOM template, unbounded layer-shaped DOM, class-discovered
behavior, editor DOM export, or control/test completion as the primary measure
of progress.

## Current editor/lab names

| Existing surface | Intended status |
| --- | --- |
| `/main-material` Main Material Editor | migration source for the Main UI Editor |
| Mission Briefing V2 tools inside `/main-material` | migration source for the focused Mission editor mode |
| `/uitest` Material UI Editor | reference-only Material Lab |
| `/ui-node` UI-node preview | static schema/runtime proof; not an editor or production schema |
| `/dev/shiny` Shiny Material Authoring | specialized material/provider lab |

There are not two permitted production schemas or renderers. A focused Mission
workspace may look like a second editor, but it edits the same canonical
document and uses the same compiler/runtime as the Main UI Editor.

## Work-start rule

Before changing UI authoring code, name the Mission scorecard criterion being
advanced. If the work does not advance a current criterion or remove a blocker
that prevents one, it belongs in a later milestone.

The active work packet and its explicit non-goals are recorded in
`docs/mission-briefing-v2-scorecard.md`. Only one owner changes the canonical
schema/compiler path at a time. Parallel work is limited to non-overlapping
evidence, fixtures, visual baselines, or independently specified contracts.
