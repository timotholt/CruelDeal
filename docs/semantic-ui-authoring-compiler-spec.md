# Semantic UI Authoring Compiler Spec

Status: authoritative
Date: 2026-07-16
Owner: UI authoring and game client

This document is the architectural authority for the Cruel Deal UI authoring
system. When an older editor, surface, composition, emitter, or control-contract
document disagrees with this spec, this spec wins.

The first delivery governed by this architecture is defined in
`docs/mission-briefing-v2-vertical-slice-spec.md`.

The visual range and anti-regression rules are defined in
`docs/ui-authoring-visual-capability-contract.md`.

## 1. Product outcome

The product is a semantic UI authoring compiler, not a DOM layer editor and not
an unconstrained page builder.

A designer must be able to:

1. select a logical game component such as a Mission Briefing, navigation bar,
   status bar, or action;
2. edit the component's permitted content, structure, layout, states, and visual
   material layers;
3. preview the exact runtime component;
4. compile the authored document to deterministic, minimal browser HTML and CSS;
5. reproduce the result on supported browsers to the limit of their CSS and
   rendering capabilities.

The authored model may be rich. The shipped DOM must not mirror that richness
one element per layer.

### Visual source policy

`docs/references/ui-authoring/mission-v2-target.png` is the user-approved visual
authority for Mission Briefing V2. It defines that milestone's 9:16 composition,
tall lower-left contract panel, full-bleed cyan environment art, dark glass
depth, clipped metal edge language, text hierarchy, split reward/fingerprint
footer, and localized gold/cyan accents.

`public/art/login/main-menu-contract-reference.png` and the dashboard reference
set remain family-level evidence for other components and appearance variants.
They cannot override the approved Mission target.

Background-only artwork and deprecated prototype screenshots provide context,
not component geometry. A new visual direction must be explicitly accepted and
recorded; it must not emerge accidentally from what the current renderer can
produce.

## 2. Non-negotiable goals

### G1 — Semantic integrity

Logical components retain their identity and required function throughout
authoring, compilation, and runtime.

- A `NavigationBar` always represents page navigation.
- A `MissionBriefing` always presents a mission and its action.
- A `FingerprintHoldAction` is always an operable action with hold semantics.
- A designer may edit declared slots and options, but cannot turn one of these
  components into a meaningless generic container.

Semantic HTML, accessibility, state transitions, and runtime behavior are owned
by the component contract, not reconstructed from CSS class names.

### G2 — Conceptual layers without layer-shaped DOM

Designers author ordered concepts such as fill, glass, blur, texture, border,
bevel, reflection, highlight, glow, mask, and state overlay. These are compiler
source nodes. They do not imply DOM elements.

The compiler lowers them into the cheapest faithful browser paint operations:

- multiple backgrounds;
- borders and outlines;
- shadows and filters;
- masks and clips;
- `::before` and `::after` paint slots;
- inherited or generated CSS variables;
- a helper element only when the target browser cannot express the result on
  the semantic host and its pseudo-elements.

There is no permanent "one authored layer equals one span" rule and no arbitrary
fixed three-element renderer rule.

### G3 — Deterministic output and bounded visual fidelity

The same canonical source, compiler version, target profile, font/assets, and
environment manifest must produce byte-identical compiled artifacts.

Visual reproducibility has three explicit levels:

1. **Artifact exactness:** canonical JSON, generated HTML, generated CSS, class
   names, and referenced assets are byte-identical.
2. **Same-profile render exactness:** under a pinned browser build, OS/font set,
   device scale, viewport, color profile, animation time, and asset set, the
   reference capture must match the accepted baseline exactly or at a recorded
   zero-difference threshold.
3. **Cross-browser visual conformance:** supported browser profiles must satisfy
   component-specific geometry, typography, color, and image-difference
   tolerances. Literal cross-engine pixel identity is not promised where browser
   rasterizers or CSS support differ.

Unsupported effects must have an explicit fallback or be rejected for that
target profile. Silent visual degradation is a compiler defect.

### G4 — Runtime/editor identity

The editor preview and the shipped game use the same semantic component
implementation and the same compiled appearance artifact.

Editor selection boxes, provenance, handles, control state, diagnostics, and
history live outside the product subtree. Export never scrapes the live editor
DOM to discover the product contract.

### G5 — Goal-sized delivery

Architecture is accepted only when it delivers a complete, visible component
slice. A registry, adapter, validator, contract cleanup, or test suite is not a
milestone by itself.

The first milestone is Mission Briefing V2, including its fingerprint hold
action. The next component is selected only after that slice passes its exit
criteria.

### G6 — Protect migration evidence while converging on the approved target

The current editor produces useful material behavior and a partial Mission
implementation, but its captured composition is not the product target. Moving
to the semantic compiler must protect working behavior and visual capabilities
without canonizing the current centered card as the final design.

- preserve representative current output as a labeled implementation checkpoint
  before changing its render path;
- require checkpoint parity only for packets whose declared delta is
  architecture or behavior with no intentional art-direction change;
- keep the existing path available until the migrated vertical slice passes;
- make target-directed visual changes only in the declared appearance/layout
  packet and compare them against the approved target;
- treat inability to reproduce a working existing look as a missing compiler
  capability, not permission to delete that capability;
- never use checkpoint parity as a substitute for target conformance.

The light stone, dark glass/gunmetal, and black/gold references are theme and
material variants of the same component system. They must not create parallel
renderers or authored schemas.

## 3. Canonical authored model

An authored UI document has four independent but linked sections:

```text
UiDocument
  component tree     semantic components, typed slots, permitted children
  content bindings   authored copy and runtime/CMS data sources
  appearance graphs  ordered conceptual paint layers and component states
  target manifest    compiler/browser profile, assets, fonts, viewport rules
```

These sections must not collapse into one flat bag of optional CSS-like fields.

### 3.1 Semantic component definition

Each component type is registered with a versioned contract:

```text
ComponentDefinition
  type and schema version
  required function
  semantic runtime root
  typed content slots
  typed child slots and cardinality
  permitted variants
  state machine and actions
  accessibility contract
  layout ownership and exposed layout controls
  appearance parts and supported states
  migration rules
```

Examples:

- `NavigationBar` exposes a bounded list of `NavigationItem` children and an
  active destination. It owns navigation semantics, focus behavior, and active
  state.
- `MissionBriefing` exposes availability, title/body, typed mission terms,
  progress, optional mission metadata, and action slots. It owns their semantic
  relationship and responsive composition.
- `FingerprintHoldAction` exposes a label, hold duration within an allowed
  range, disabled state, and completion action. It owns pointer, keyboard,
  cancellation, progress, and accessible status behavior.

The component can expose optional children or variants without exposing the
ability to delete its required function.

### 3.2 Appearance graph

Each appearance part and state points to an ordered `AppearanceGraph`:

```text
AppearanceGraph
  base color/material
  ordered PaintLayer[]
  geometry and clipping policy
  state overrides
  responsive overrides where explicitly allowed
```

Every `PaintLayer` has a stable ID, a declared type, typed parameters, blend and
clip rules, and an enabled state. Layer order is authored data. The compiler may
combine paint operations only when doing so is visually equivalent.

Initial layer families:

- solid or gradient fill;
- image/procedural texture;
- backdrop glass and blur;
- inner/outer border and bevel;
- reflection or specular highlight;
- inner/outer glow and shadow;
- mask/clip treatment;
- state overlay.

Adding a layer family requires a target-lowering definition and a fallback
policy. Adding a new editor slider alone is not a feature.

### 3.3 Appearance ownership rules

The source model has one owner for each visual concept:

- `base` is the first paint operation in a part's graph; there is no second
  out-of-band base material field;
- geometry and clipping are part-level policy consumed by every layer; a mask
  layer supplies mask pixels but does not redefine the part's geometry;
- component interaction state is a named graph variant. A `stateOverlay` paint
  layer is only a visible overlay within such a variant, not a second state
  machine;
- the canonical interaction tokens are `idle`, `hover`, `focus-visible`,
  `holding`, `complete`, and `disabled`. Adapters may translate legacy
  `rest`/`active`/`pressed` tokens only at the migration edge.

These rules prevent the same pixels or state transition from being authored in
two competing places.

## 4. Compiler architecture

The compiler is a pure, versioned pipeline:

```text
authored document
  -> parse and schema validation
  -> semantic validation
  -> canonical normalization
  -> component expansion to Semantic Render IR
  -> appearance graphs to Paint IR
  -> browser-profile feature resolution
  -> paint-slot allocation
  -> HTML/CSS/asset emission
  -> artifact manifest and diagnostics
```

### 4.1 Semantic Render IR

This IR describes required semantic elements, component parts, content slots,
actions, state hooks, and layout relationships. It contains no editor UI and no
historical feed-node compatibility concepts.

### 4.2 Paint IR

Paint IR describes ordered visual operations independently of DOM allocation.
It is the inspectable bridge between designer intent and browser CSS.

The editor may show both the authored layers and their lowered Paint IR. It must
not pretend the current runtime spans are the authored layer model.

### 4.3 Target resolution

The compiler resolves support using an explicit browser profile. Each operation
becomes one of:

- native;
- compiled fallback;
- approximated within a declared tolerance;
- unsupported compilation error.

Feature detection at runtime may select among artifacts already defined by the
target manifest. It must not invent nondeterministic styling.

### 4.4 Paint-slot allocation

Allocation prefers, in order:

1. the semantic host's backgrounds, borders, shadows, filters, masks, and vars;
2. the host's `::before` and `::after` slots;
3. an existing semantic child when the paint belongs to that child;
4. the smallest justified decorative helper subtree.

The allocation report records which authored layers were folded into which CSS
operations and why helpers were required.

### 4.5 Stable emission

Emission must guarantee:

- stable ordering and numeric normalization;
- content-addressed or otherwise deterministic class names;
- no timestamps, random IDs, DOM measurements, or editor session IDs;
- shared-rule deduplication without changing cascade meaning;
- asset references pinned by identity;
- an artifact manifest containing schema, compiler, and target versions;
- compilation from source data, never from DOM inspection.

### 4.6 Compiler artifact and runtime boundary

One compile produces a `CompiledUiArtifact` directory:

```text
manifest.json          versions, target profile, asset/font identities, hashes
component-plan.json    semantic element/part/action plan consumed by runtime
appearance.css         stable generated rules and state variants
reference.html         deterministic fixture rendering for inspection/proof
allocation.json        authored-layer -> CSS/pseudo/helper allocation report
diagnostics.json       fallbacks, approximations, and rejected operations
```

`component-plan.json` is the runtime API. The Solid runtime component receives
that plan plus runtime content and state, renders the declared semantic elements,
and binds actions by typed action ID. It never reads the authoring schema or
reconstructs behavior from generated classes.

`reference.html` is executable proof output for a pinned content fixture. It is
not a second renderer: it is serialized from the same component plan and class
map used by the Solid runtime. Tests compare its minimal DOM and deterministic
bytes; the game normally renders the component plan so live content can change
without recompiling appearance CSS.

## 5. Runtime contract

Runtime consumes a compiled component document plus runtime content/state. It
does not consume the editor schema.

Behavior is bound by semantic component type and action ID. In particular, a
fingerprint hold action must never be detected because a class string happens
to contain `fingerprint-hold`.

The runtime may add only state and accessibility attributes required by the
component contract. Visual state selects precompiled state rules.

Runtime action dispatch uses this stable envelope:

```text
UiActionEvent
  componentInstanceId  stable within the runtime document
  actionId             declared by the semantic component source
  actionType           versioned action discriminator
  phase                complete for FingerprintHoldAction V1
  payload              schema-validated action-specific data or null
```

The trusted application maps `actionId` to game behavior. Authored documents
cannot provide executable handlers.

## 6. Authoring application topology

The codebase currently exposes several editing/lab routes. Their intended roles
are now:

### Main UI Editor

The successor to `/main-material`. It edits screen composition, selects logical
components, binds content, enters a focused component editor, previews the real
runtime tree, and compiles artifacts.

### Mission Briefing editor mode

This is a focused mode within the Main UI Editor, not an independent document
format or renderer. It edits the selected `MissionBriefing` contract, including
its permitted slots, layout variants, appearance parts, and fingerprint action.

It may have a dedicated workspace because the component is complex. It still
uses the same document, compiler, runtime component, and history as the main
editor.

### Material Lab (`/uitest`)

Reference-only. It may remain a visual experiment or migration source, but it
is not an authority and must not acquire a third production schema or renderer.

### Shiny authoring (`/dev/shiny`)

A specialized material/provider lab. Approved metallic/reflection definitions
may feed appearance layers. It does not own semantic components or a competing
screen compiler.

## 7. Migration boundaries

The existing system is evidence and migration input, not the new source model.

- `FeedCardNode`/`card_type_04` may be imported into the Mission Briefing schema
  through a bounded, versioned adapter. The adapter is not used after canonical
  save.
- `MaterialRecipe` and `SurfaceOptions` values may seed appearance graphs. Their
  flat optional-field shape does not define the graph or compiler IR.
- `MaterialNodeRenderer` may contribute runtime implementation code. It does not
  establish that all semantic components are generic nodes.
- current fingerprint CSS and timing may seed V2 appearance. Class-substring
  behavior discovery is removed at the semantic runtime boundary.
- existing DOM registries/audits may remain editor diagnostics. They are not the
  export source of truth.
- legacy Material Lab and Shiny definitions are imported only when a current
  Mission criterion needs them.

Migration follows a strangler sequence: checkpoint the current component, import
its source, compile it through the new path, compare old/new side by side, and
switch only after the current milestone's parity criteria pass. A ground-up
renderer swap is outside the authorized approach.

## 8. First measurable milestone

Mission Briefing V2 is the proving slice because it simultaneously exercises:

- a semantic composite with required purpose;
- editable content and bounded child slots;
- layered glass, bevel, texture, reflection, blur, and glow;
- a real stateful fingerprint action;
- same-runtime preview;
- deterministic compilation;
- visual comparison against repository artwork.

The milestone is complete only when every acceptance criterion in
`docs/mission-briefing-v2-vertical-slice-spec.md` passes. Completing a compiler
stage, editor panel, migration adapter, or suite of unit tests is progress, but
not milestone completion.

## 9. Proof strategy and time budget

Proof follows the cheapest path that can falsify the current claim:

1. schema/semantic fixture for component integrity;
2. deterministic double-compile comparison;
3. compiler allocation report and emitted DOM inspection;
4. one real editor-to-runtime workflow;
5. pinned visual capture for the component slice;
6. supported-browser conformance only after the primary profile passes.

For any implementation slice, proof work is capped at roughly 20% of the slice
unless a failed proof exposes a user-visible or architectural blocker. Broader
performance, memory, test-harness, or contract cleanup requires evidence that it
blocks a current acceptance criterion.

## 10. Progress rules

Every implementation session must name:

- the milestone criterion being advanced;
- the visible or compiled delta expected;
- the proof that will demonstrate it;
- explicit non-goals.

Stop and reconsider the approach when either condition occurs:

- two consecutive work cycles improve internals without changing a milestone
  criterion from failing to passing; or
- a proposed abstraction has no immediate consumer in the current vertical
  slice.

Progress is reported as acceptance criteria passed, not files changed, tests
added, contracts tightened, or time spent.

### 10.1 Parallel execution rule

Parallel agents are used only when their outputs can be reconciled without two
implementations competing for the same authority:

- one path owner controls canonical schema, compiler, and runtime integration;
- parallel agents may capture visual evidence, write fixtures against an agreed
  schema, audit current code, or draft a disjoint target-profile/allocation table;
- parallel agents do not introduce alternate component models, renderers, or
  compiler IRs;
- every parallel result is reviewed against the active scorecard criterion
  before it is merged;
- when work shares the same source-of-truth files or depends on an unresolved
  design choice, it proceeds single-threaded.

Parallelism is a latency tool, not a progress metric.

## 11. Out of scope until Mission Briefing V2 passes

- generalized optimization or bundle-size projects;
- memory or performance benchmarking without a demonstrated interaction defect;
- universal migration of every existing material recipe;
- perfecting old editor control coverage;
- navbar implementation;
- relocating all dev routes;
- making the old Material Lab and Shiny authoring schemas converge by themselves;
- preserving legacy JSON shapes except through a bounded import/migration edge.

## 12. Architecture decisions that require spec revision

Change this document before implementation if a proposal would:

- make generic nodes the source of semantic behavior;
- map authored paint layers directly to DOM children;
- introduce another production renderer or authoring schema;
- weaken deterministic artifact guarantees;
- promise cross-browser bit identity without a pinned identical renderer;
- let export depend on the editor's live DOM;
- expand the current milestone to unrelated components.
