# Mission Briefing V2 Execution Scorecard

Status: authoritative progress ledger
Date: 2026-07-16
Parent: `docs/mission-briefing-v2-vertical-slice-spec.md`

This file is the only implementation progress report for Mission Briefing V2.
Update a row only when its required proof exists on the canonical path. Files
changed, tests added, controls completed, and time spent are not score.

## Current score

`9 / 10`

M1 through M8 and M10 now pass; only M9 remains. Mission Briefing has a strict semantic
source and required-function boundary; its fingerprint action uses typed
runtime identity, complete input/cancellation semantics, and exactly-one trusted
event dispatch. Its first typed appearance document now compiles to reviewed
Paint IR, a Chromium allocation report, deterministic CSS, and a checked-in
minimal semantic DOM golden with zero decorative helper elements. The editor
and authenticated player screen now render the same compiled component-plan API
and checked appearance artifact. The focused editor now owns semantic content,
optional/required slots, paint graph order/state/parameters, undo/redo, and
compile/run as one canonical workflow. A deterministic exact-size proof route
now records the full-screen comparison. The condensed font and local shell/
compiler defects are resolved; the full screen still lacks the approved R0
background artwork.

## Current implementation evidence

- The real editor is `/main-material`; `/uitest` is a one-recipe Material Lab and
  `/ui-node` is a static schema/runtime proof.
- Mission Briefing V2 remains selectable through the legacy `card_type_04`
  compatibility seam; its authoring authority is the separate versioned
  `MissionBriefingSourceV1`, not the generic `FeedCardNode` tree.
- The fingerprint's typed runtime plan now reaches the real Main preview from
  canonical source. `FingerprintHoldAction` owns its state/input behavior and
  dispatches `UiActionEvent`; visual CSS classes no longer identify behavior.
- Generic material surfaces still emit decorative spans per active layer.
- normal Export DOM/CSS is reconstructed from the mounted preview DOM and CSSOM,
  not compiled from canonical source.
- a pinned Mission V2 capture/environment set now exists under
  `docs/references/ui-authoring/mission-v2-current/`; it is an implementation
  checkpoint, not the visual goal.
- `docs/references/ui-authoring/mission-v2-target.png` is the user-approved
  visual goal as of 2026-07-16.
- `components/ui/semantic-authoring/mission-briefing/missionBriefingSource.ts`
  is now the canonical Mission source; it has no dependency on the Feed model.
- Selecting `card_type_04` now suppresses its generic node/content/layout and
  material controls in favor of a semantic-ownership panel. Required-slot
  removal attempts return a stable denial without changing the source.
- The real preview now renders the semantic Mission panel at R0's normalized
  bounds (`left .011`, `top .305`, `width .486`, `height .525`) over the existing
  feed media while preserving sibling chrome.
- Mission appearance compiles from a strict source fixture into checked-in
  Paint IR, Chromium 150 allocation, CSS, and an exact DOM golden. The compiler
  owns paint only; runtime layout remains authoritative.
- `MissionBriefingRuntime` consumes only `MissionBriefingComponentPlanV1`; it no
  longer imports authoring schema or Material Lab. `/main-material` compiles live
  canonical source into that plan, while authenticated `/` consumes the
  checked-in plan from the same six-file artifact.
- `npm run ui:mission-v2:generate:check` proves the checked artifact is current.
  Clean double compilation writes two isolated directories and compares exact
  bytes plus manifest hashes.
- `docs/references/ui-authoring/mission-v2-workflow-proof.json` records the real
  browser authoring workflow and the focused runtime/action proof. Trial edits
  were undone back to the pre-proof canonical document.
- `/main-material?mission-proof=1` is a deterministic capture seam over the real
  editor preview/runtime. It bypasses local storage and workbench chrome without
  introducing a second renderer.
- `docs/references/ui-authoring/mission-v2-conformance/` records the exact
  941x1672 target/current/difference images, browser environment, DOM audit, and
  whole-screen metric. It keeps M9 failed because the background proxy is a
  materially different composition.

## Binary criteria

| ID | Status | Existing partial evidence | Required closure evidence |
| --- | --- | --- | --- |
| M1 | pass | strict schemas and valid/invalid fixtures in `components/ui/semantic-authoring/mission-briefing/`; canonical persistence uses a separate versioned key and excludes Feed/presentation markers | complete |
| M2 | pass | `missionBriefingCommands.test.ts` proves every required-slot denial preserves source; `card_type_04` generic editors are suppressed and expose the denial through `MissionBriefingOwnershipPanel` | complete |
| M3 | pass | typed Mission appearance fixture, exact Paint IR golden, and reviewed Chromium 150 allocation report cover panel glass/fill/texture/reflection/border/shadow plus fingerprint states | complete |
| M4 | pass | focused controller/component cases cover pointer, captured-pointer boundary loss, keyboard, Escape, blur, pointer cancel/loss, disabled, unmount, reduced motion, and repeat suppression | complete |
| M5 | pass | `fingerprintHoldController.test.ts` proves one exact `UiActionEvent`; `missionBriefingComponentCompiler.test.ts` proves canonical component/action identity reaches the runtime plan | complete |
| M6 | pass | editor and authenticated player screen both render `MissionBriefingRuntime` from `MissionBriefingComponentPlanV1` and import the same artifact CSS; browser identity inspection reports the same plan version, class, bounds, and minimal DOM | complete |
| M7 | pass | exact `mission-v2-r0.dom.html` golden has one semantic action button with no paint children; allocation report records `helpers: []`; browser inspection found zero helper nodes | complete |
| M8 | pass | aggregate compiler emits the required six files; two fresh directories compare byte-for-byte; manifest member hashes and aggregate hash verify; checked-in `--check` passes | complete |
| M9 | fail | R0 and an exact-size migrated runtime comparison are pinned; semantic bounds and shell composition match, while the replacement background remains visibly different | approved/supplied R0-equivalent background followed by a passing recorded full-screen/component comparison |
| M10 | pass | focused semantic editor changes content, required/optional slots, paint-layer order/state/parameters, undo/redo, and compile/run over one canonical source; browser workflow plus 67 focused tests are recorded | complete |

## Completed work packet

### P0 — target registration and current checkpoint

Status: complete on 2026-07-16. The user identified R0 as the goal; the current
capture is retained only as implementation evidence. No Mission runtime files
were changed while producing it.

Outcome: pin both truths needed for migration: the approved visual destination
and the current implementation checkpoint.

Required artifacts:

```text
docs/references/ui-authoring/
  mission-v2-target.png
  mission-v2-target-analysis.md
docs/references/ui-authoring/mission-v2-current/
  environment.json
  fixture.json
  idle.png
  holding.png
  complete.png
  dom-summary.json
  README.md
```

`environment.json` records browser build, OS, viewport, DPR, color profile,
fonts, animation clock/state, and asset identities. `fixture.json` is the exact
current V2 story/card source. `dom-summary.json` records the selected Mission
subtree element count and a normalized structural outline; it does not become a
future export format.

Exit proof: R0 is stored by hash as the approved visual destination, and the
current fixture/environment/idle/holding/complete/DOM evidence is stored as a
separately labeled checkpoint.

Non-goals: no visual tuning, schema extraction, renderer replacement, generic
surface cleanup, performance work, or broad test infrastructure.

## Completed work packet

### P1 — semantic spine (targets M1/M2)

Status: complete on 2026-07-16.

- implement the executable source shape from the milestone spec;
- add one explicit `card_type_04 -> MissionBriefingSourceV1` import adapter;
- reject missing required slots, generic primary actions, unknown fields, and
  invalid currency/progress/hold values;
- prove canonical save contains no feed-node schema or legacy presentation/class
  behavior marker.

Expected compiled delta: one valid versioned Mission source plus rejection of
documents that remove or replace its required function. Expected visual delta:
none.

Proof: schema fixtures, importer fixture, canonical serialization inspection,
required-slot command denial, separate persistence tests, and a successful
production build. Focused proof command passes 25 tests across four files.

Non-goals: visual retuning, DOM optimization, cross-browser work, generalized
registries, and editor-control cleanup.

## Completed work packet

### P2 — real hold action (targets M4/M5)

Status: complete on 2026-07-16.

- carry typed action identity through the runtime plan;
- replace CSS-class behavior discovery with one hold state machine;
- support all specified pointer/keyboard/cancellation paths;
- dispatch one trusted action event;
- preserve the current checkpoint during this behavior-only packet without
  treating its composition as final.

Expected compiled delta: the fingerprint action remains visually unchanged but
uses typed identity, complete input/cancellation semantics, and dispatches one
trusted action event. Expected visual delta: none outside interaction states.

Proof: 23 focused tests across controller, runtime component, and source-plan
bridge; no runtime class-substring fingerprint detection remains; production
build succeeds.

Non-goals: R0 layout/material tuning, Paint IR, artifact emission, and editor
navigation changes.

## Completed work packet

### P3 — appearance compiler (targets M3/M7)

Status: complete on 2026-07-16.

- define the discriminated PaintLayer subset and Chromium target table required
  by Mission panel, reward region, primary action, fingerprint glyph, and scan;
- emit and review one allocation report;
- lower visual concepts to host CSS and pseudo-elements before permitting a
  helper element;
- match R0's Mission panel composition/material target; use the current
  checkpoint only to detect accidental loss of unrelated working capability.

Expected compiled delta: Mission panel, terms, fingerprint, and scan appearance
become a typed Paint IR with an explicit Chromium allocation report and
minimal-host/pseudo-element decisions. Expected visible delta: begin moving the
Mission composition toward R0 without retheming unrelated UI.

Proof: valid/invalid Paint IR fixtures, deterministic allocation report, emitted
DOM inspection, and a target-region visual capture.

Closure proof: exact Paint IR/allocation/CSS goldens, exact semantic DOM golden,
63 focused tests across the complete Mission spine, successful production build,
and a real Chrome preview inspection with zero console errors. Browser geometry
matches the R0 panel region exactly. The proof also caught and removed a compiler
defect where paint CSS incorrectly overrode runtime positioning; paint output no
longer owns layout. The fingerprint mask is emitted as a self-contained SVG paint
resource instead of falling back to an unmasked rectangle.

Non-goals: generalized browser abstraction, performance work, solid-tree
navigation, and unrelated Material Lab cleanup.

## Completed work packet

### P4 — artifact identity (targets M6/M8)

Status: complete on 2026-07-16.

- emit the parent spec's artifact directory;
- render `component-plan.json` through the same Solid runtime in editor and game;
- prove byte-identical clean double compilation.

Closure proof: the six-file artifact lives at
`components/ui/semantic-artifacts/mission-briefing-v1/mission-v2-r0/` and includes
manifest, component plan, appearance CSS, runtime-rendered reference HTML,
allocation, and diagnostics. The generator has a stale-output check. Focused
Mission proof passes 67 tests across 11 files and the production build succeeds.
Real Chrome inspection of both `/main-material` and authenticated `/` reports
`semantic-ui-v1`, the same panel class, identical R0-normalized bounds, zero
paint helpers, one childless action button, and no console errors.

The P4 migration also removes the action-only compatibility bridge. The compiled
runtime is a native semantic path with no authoring or Material Lab dependency.

## Completed work packet

### P5 — focused editor and workflow (targets M9/M10)

Status: complete for M10 on 2026-07-16; M9 moved to the next packet because its
remaining inputs are external visual assets rather than editor architecture.

- add a focused Mission workspace inside the Main UI Editor;
- use the repository `solid-tree` package only for editor navigation/selection,
  not as a product schema or renderer;
- pass the full author-edit-hold-undo-redo-compile-run workflow;
- approve the migrated R0-conformance capture.

Closure proof: the ownership panel edits canonical content and terms, enforces
required slots, removes/restores optional slots, edits the typed appearance
graphs, and provides document-wide undo/redo plus a compile pin/return-live
cycle. Browser proof caught and fixed number inputs that changed the control but
not semantic source. The recorded workflow ends on `semantic-ui-v1`, zero paint
helper elements, and a childless native action button; the trial document is
then restored. Eleven focused files pass 67 tests, artifact staleness check
passes, and the production build succeeds.

## Active work packet

### P6 — R0 environment and visual conformance (targets M9)

Acquire or approve a replacement for the exact R0 server-room background, then
repeat the recorded full-screen comparison. Do not reopen semantic source, compiler/runtime identity, editor
workflow, generic Material Lab, performance, or test infrastructure unless the
visual comparison exposes a direct defect in those paths.

Progress on 2026-07-16: the exact-size proof exposed and closed local defects in
shared shell composition, clean-profile semantic selection, reproducible font
loading, per-layer background sizing/repeat, asymmetric chamfer geometry,
top-only divider allocation, fingerprint brackets, and Mission text/footer
alignment. The proof route reports one of each required logical shell region,
one Mission component, one childless semantic action, zero paint helpers, and
zero browser errors.

Current blocker: the exact standalone R0 blue server-room/hand/datablock
background is not present in the repository. The closest local image is a
materially different composition, so M9 remains failed despite the now-matching
screen and Mission geometry.

## Agent and conversation protocol

At the beginning of a work turn report exactly:

```text
Active packet and criterion:
Expected visible/compiled delta:
Proof to run:
Explicit non-goals:
```

Use parallel agents for read-only code tracing, fixture preparation,
checkpoint/target capture analysis, or disjoint contracts. Keep one owner on canonical schema,
compiler, and runtime integration. Reconcile agent results before production
edits. If safe boundaries do not exist, work single-threaded.

At the end of a turn report only:

- score before and after;
- evidence created;
- blocker family removed or narrowed;
- next active packet.

If the score does not move, report the specific artifact that became less
uncertain. If two consecutive cycles do not move a criterion, stop and revise
the approach instead of expanding tests or contracts.
