# Mission Briefing V2 Vertical Slice Spec

Status: authoritative milestone spec
Date: 2026-07-16
Parent: `docs/semantic-ui-authoring-compiler-spec.md`

## 1. Outcome

Deliver one complete, trustworthy authoring-to-runtime slice for Mission
Briefing V2.

A designer selects a Mission Briefing in the Main UI Editor, edits its bounded
content and visual parts, operates its fingerprint hold action in the real
preview, compiles it, and receives deterministic minimal HTML/CSS that the game
runtime uses without reinterpretation.

This milestone is not complete when the editor merely displays controls or when
the fingerprint animates. It is complete when the component remains semantic,
the action performs a declared function, the visual target is met, and the
compiled artifact satisfies the footprint and reproducibility criteria below.

## 2. Evidence and reference hierarchy

Use evidence in this order:

1. this spec for product behavior and acceptance;
2. `docs/references/ui-authoring/mission-v2-target.png` for the approved Mission
   Briefing composition, hierarchy, placement, and material language;
3. `public/art/login/main-menu-contract-reference.png` for compatible game UI
   family evidence outside the explicit Mission target;
4. `docs/references/ui-authoring/dashboard-gunmetal-glass.jpg` and the daily
   briefing regions in the other references for the supported visual range;
5. `docs/ui-authoring-visual-capability-contract.md` for shared visual grammar
   and preservation rules;
6. `docs/mission-briefing-design-memory-2026-06-02.md` for recoverable copy,
   proportions, and appearance observations;
7. current Mission Briefing V2 code and captures as migration evidence, not as
   the target or architecture.

The approved target already depicts the fingerprint `ACCEPT TERMS` action.
Therefore:

- the image is authoritative for hierarchy, density, glass/metal treatment,
  bevels, texture, contrast, gold/cyan accent language, and fingerprint
  placement;
- this spec is authoritative for fingerprint behavior, action identity,
  accessibility, and state transitions;
- generated copy, portrait details, icons, logos, and incidental image artifacts
  are not canonical runtime data.

`editor-temp-bg.png`, `material-preview-bg.jpeg`, and
`cruel-company-final-login.png` are preview-context images, not Mission Briefing
layout authorities.

### 2.1 Target scope boundary

The R0 image shows a whole 9:16 screen so the Mission panel can be judged in
context. The semantic ownership boundary is:

- `MissionBriefing` owns the tall lower-left contract panel, including
  availability status, title, progress, body, divider, mission terms, and
  fingerprint action;
- profile, resource/status chrome, secondary navigation, background scene, and
  bottom navigation are sibling semantic components or screen context;
- the Mission milestone must preserve the target panel's placement and visual
  relationship to those siblings without absorbing them into its schema or DOM.

The current compact centered card is implementation evidence only. Matching it
does not satisfy visual acceptance.

## 3. Semantic contract

Component type: `MissionBriefing`

Required purpose: present a mission's identity, summary, reward/terms, status,
and a primary mission action as one coherent unit.

Required slots:

| Slot | Type | Cardinality | Notes |
| --- | --- | ---: | --- |
| `title` | rich text | 1 | Mission identity; cannot be removed |
| `body` | rich text | 1 | Mission summary; cannot be removed |
| `terms` | `MissionTermsSourceV1` | 1 | Typed deposit and success reward data |
| `primaryAction` | `MissionAction` | 1 | V2 uses `FingerprintHoldAction` |

Optional slots:

| Slot | Type | Cardinality | Notes |
| --- | --- | ---: | --- |
| `availabilityStatus` | text/status | 0..1 | e.g. `AVAILABLE CONTRACT` |
| `deadline` | status text/data | 0..1 | e.g. `03 DAYS LEFT` |
| `sectorMark` | text/mark | 0..1 | e.g. `SECTOR 07` |
| `progress` | progress data | 0..1 | compact mission progress treatment |

The author may edit content, hide optional slots, choose approved variants, and
reorder only slots declared reorderable by the component version. The author
may not delete the primary action, replace required slots with generic
containers, or detach the reward/action region so it ceases to be part of the
Mission Briefing.

### 3.1 Executable V1 source shape

The first implementation uses one discriminated source contract, not a generic
node tree:

```text
MissionBriefingSourceV1
  schemaVersion: 1
  type: "MissionBriefing"
  id: stable authored ID
  layoutVariant: "contract-left"
  slots
    title: ContentSourceV1
    body: ContentSourceV1
    terms: MissionTermsSourceV1
    primaryAction: FingerprintHoldActionSourceV1
    availabilityStatus?: ContentSourceV1
    deadline?: ContentSourceV1
    sectorMark?: ContentSourceV1
    progress?: ProgressSourceV1
  appearance: named part/state -> AppearanceGraph reference

MissionTermsSourceV1
  deposit?: CurrencyAmountSourceV1
  successReward: CurrencyAmountSourceV1

CurrencyAmountSourceV1
  amount: non-negative integer or allowlisted numeric binding
  currencyCode: allowlisted stable currency ID

ProgressSourceV1
  completed: integer >= 0
  total: integer in 1..12 and >= completed

ContentSourceV1
  inline: { format: "plain" | "cruel-markup-v1", value: string }
  or binding: { key: allowlisted content key }

FingerprintHoldActionSourceV1
  schemaVersion: 1
  type: "FingerprintHoldAction"
  id: stable authored ID
  label: ContentSourceV1
  actionId: stable declared action ID
  holdDurationMs: integer in 400..5000
  disabled: boolean
  completionMessage?: ContentSourceV1
  appearance: named state/part -> AppearanceGraph reference
```

V1 does not permit arbitrary slot reordering or arbitrary children. Its
`contract-left` layout variant owns the structure in section 5. Later component
versions may add declared variants through migration rules.

M1/M2 require fixtures proving: a valid inline-content document, a valid bound
content document, rejection of every missing required slot, rejection of an
unknown child/slot/type/action field, rejection of invalid currency/progress or
hold values, and rejection of attempts to replace `primaryAction` with a generic
button or `terms` with a rich-text blob.

The R0 conformance fixture includes `availabilityStatus`, a four-segment
progress value, deposit `200 CR`, success reward `800 CR`, and no floating
deadline badge or semantic sector mark. The `D7` visible in the source art is
environment content, not a Mission slot.

## 4. Component parts exposed for appearance

The editor exposes these named appearance parts:

- `frame` — optional outer composition frame;
- `panel` — primary dark glass briefing panel;
- `availabilityStatus`;
- `deadlineBadge` for variants that declare it;
- `sectorMark`;
- `rewardRegion`;
- `primaryAction`;
- `fingerprintGlyph`;
- `progressScan`;
- text roles: availability status, title, body, terms label/value, action label.

Each part may have `idle`, `hover`, `focus-visible`, `holding`,
`complete`, and `disabled` appearances where semantically applicable. States are
declared by the component contract, not authored as arbitrary CSS selectors.

The conceptual layer stack must support the visual families visible in the
reference: dark translucent fill, frosted/background blur, worn texture,
hairline border, asymmetric bevel/highlight, restrained inner reflection,
shadow, and localized gold glow. Authored layers compile into CSS paint slots;
they do not each create an element.

## 5. Layout contract

The component owns its internal composition. The editor exposes bounded layout
choices rather than raw freedom by default.

Required V2 structure:

```text
MissionBriefing
  narrative region: availability status, title, progress, body
  footer region
    mission terms: deposit and success reward
    FingerprintHoldAction
```

The narrative and footer regions remain related at all supported sizes. The
fingerprint action must not overlap or obscure the mission terms.

Initial art-directed placement may use the historical proportions as a starting
point, but the component must own responsive behavior. Historical percentages
are reference observations, not canonical source structure.

The default 9:16 composition should preserve these visual priorities:

1. mission title is the strongest text in the panel;
2. the dark panel remains readable over detailed background art;
3. reward and action form a clearly separated footer;
4. the primary action is obviously interactive;
5. gold is an accent, not the dominant fill;
6. bevels and texture remain visible without reducing text contrast.

## 6. Fingerprint hold action

Component type: `FingerprintHoldAction`, satisfying the `MissionAction` slot.

### 6.1 Inputs

- label;
- action ID;
- hold duration, default 1400 ms and constrained by the component schema;
- disabled state;
- optional completion message;
- appearance references for supported states.

On completion the runtime emits the `UiActionEvent` defined by the parent
architecture spec with `actionType: "fingerprint-hold/v1"`, `phase: "complete"`,
and `payload: null`. The parent application owns the trusted `actionId` handler.
The V1 acknowledgement interval is 520 ms unless the parent resets sooner; it
affects only the `complete` presentation and cannot redispatch the action.

### 6.2 State machine

```text
idle
  -> holding          pointer press or keyboard activation begins
holding
  -> idle             release, pointer cancel/loss, blur, Escape, or disabled
  -> complete         uninterrupted duration reached
complete
  -> idle             acknowledgement interval ends or parent resets
```

Completion dispatches the declared action exactly once. The visual scan is a
representation of state; its animation ending is not the source of business
behavior.

### 6.3 Input and accessibility acceptance

- Pointer/touch press starts the hold.
- Releasing or cancelling before the duration never dispatches completion.
- Space or Enter provides an equivalent keyboard path with defined cancellation.
- Focus remains visible against the authored material.
- The runtime exposes a semantic button and an accessible name.
- Holding/progress and completion are conveyed without requiring color alone.
- Reduced-motion mode preserves timing and completion semantics while replacing
  or suppressing nonessential scan motion.
- Repeated pointer events or key repeat cannot dispatch duplicate completions.
- Leaving the component, losing pointer capture, disabling it, or unmounting it
  clears pending work.

Behavior dispatch is keyed by component/action identity. Detection by CSS class
substring is forbidden.

## 7. Editor workflow acceptance

One uninterrupted workflow must demonstrate all of the following:

1. Open the Main UI Editor and select a Mission Briefing.
2. Enter its focused Mission Briefing editor mode without changing documents or
   renderers.
3. Edit title/body/reward content and see the real runtime component update.
4. Select `panel`, `rewardRegion`, and `primaryAction` appearance parts and edit
   at least layer order, enabled state, and representative glass/glow/reflection
   parameters.
5. Hide and restore one optional slot.
6. Attempting to remove or replace a required semantic slot is prevented with a
   clear explanation.
7. Operate and cancel the fingerprint hold, then complete it and observe the
   action event.
8. Undo and redo an authored change.
9. Compile the document and open the compiled result using the same runtime
   component contract.

No acceptance credit is given for an editor-only preview or for changes that are
not present in the compiled artifact.

## 8. Compiled output acceptance

### 8.1 DOM

The emitted DOM contains only elements required for semantic content, layout,
and interaction.

- The primary action is one semantic `button` host.
- The fingerprint, scan, glass, border, bevel, reflection, and glow create zero
  DOM children solely because they are authored appearance layers when the
  supported target can express them with CSS/pseudo-elements.
- Mission content elements are allowed because they carry content or semantic
  grouping, not because each visual layer demands a span.
- Any decorative helper required by a browser limitation must be reported by
  the allocator with the unsupported feature and target profile. It becomes a
  reviewed exception, not a reusable default.
- No editor selection, provenance, control, or history markup is present.

### 8.2 CSS and artifact

- Compiling the same fixture twice produces byte-identical HTML, CSS, manifest,
  and class names.
- Layer order changes produce a stable, explainable Paint IR/allocation delta.
- Disabled layers produce no residual paint rule unless required by a declared
  state override.
- CSS uses only features allowed by the target profile or its declared fallback.
- Runtime content changes do not require recompiling unrelated appearance rules.
- Export is produced from canonical source and compiler output, never by
  scraping the editor preview DOM.

## 9. Visual acceptance

The first target-conformance capture uses the repository's primary supported
Chromium profile at the agreed 9:16 viewport and environment manifest.

Before implementation begins, the team records:

- browser build;
- OS and font files;
- viewport and device pixel ratio;
- color profile;
- animation clock/state;
- reference story/content fixture;
- background image and asset identities.

The initial target comparison uses the 941 × 1672 R0 raster or an exact uniform
scale of that aspect ratio. The measured bounds in
`docs/references/ui-authoring/mission-v2-target-analysis.md` are the calibration
contract. In particular:

- Mission panel: approximately `[.011, .305, .497, .830]` of the viewport;
- title block: approximately `[.051, .362, .445, .470]`;
- reward/terms region: approximately `[.051, .650, .227, .794]`;
- fingerprint target: approximately `[.273, .647, .454, .784]`;
- bottom navigation context begins near `.864` viewport height.

Major region bounds should remain within ±1.5% of viewport width/height during
initial calibration. Passing these bounds alone is insufficient: typography,
background focal composition, glass depth, clipped silhouette, texture, and
interaction clarity still require visual review.

Acceptance proceeds in two gates:

### Gate A — art-direction review

At the full 9:16 screen and component crop, the result must be judged faithful
to R0's lower-left placement, tall panel proportions, title/body/footer rhythm,
text contrast, cyan-black environmental integration, dark glass depth, subtle
hex texture, restrained reflection, clipped edge language, and gold accent
usage.

The fingerprint region is judged for placement, scale, scan/glow language, and
interaction clarity as well as behavior.

The existing editor capture is a migration checkpoint, not Gate A. The
additional light-stone and black/gold references prove future range; they do not
authorize retheming this slice or rebuilding every dashboard component now.

### Gate B — reproducible capture

Once Gate A is approved, its capture becomes the pinned baseline. Repeated
captures under the identical environment must meet the recorded zero-difference
or explicitly approved threshold. Other supported browser profiles receive
their own baseline and conformance tolerances; they are not compared as though
their rasterizers were identical.

## 10. Milestone scorecard

The milestone has ten binary criteria:

| ID | Criterion | Required proof |
| --- | --- | --- |
| M1 | Versioned semantic component and slot schema | valid/invalid fixtures |
| M2 | Required function cannot be authored away | editor workflow + validation |
| M3 | Appearance layers compile through Paint IR | layer-to-allocation report |
| M4 | Fingerprint pointer and keyboard behavior complete | focused interaction proof |
| M5 | Completion dispatches one real action | runtime event proof |
| M6 | Editor preview and compiled runtime share component/output | identity inspection |
| M7 | Minimal DOM rule passes | emitted DOM inspection |
| M8 | Deterministic artifact rule passes | clean double compile |
| M9 | Primary-profile art direction approved | signed R0-conformance capture |
| M10 | One full author-edit-compile-run workflow passes | browser workflow recording |

Score is reported as `criteria passed / 10`. The slice is complete only at
`10/10`; partial scores identify the next product blocker.

The live status and evidence paths are maintained in
`docs/mission-briefing-v2-scorecard.md`. A criterion changes to pass only when
the required proof is checked in and names the canonical source/compiler path;
legacy behavior or an editor-only demonstration is recorded as partial evidence
but receives no point.

For architecture-only changes, M6, M7, and M8 do not override checkpoint
protection. M9 passes only when the migrated runtime conforms to R0; reproducing
the current compact card cannot pass it.

## 11. Implementation order

Implementation advances through these work packets unless evidence shows a
dependency is wrong:

1. **P0 — target and implementation checkpoint:** pin R0 as the approved target;
   capture current V2 idle/holding/complete output, DOM count, story fixture,
   assets/fonts, and primary Chromium environment. This earns no point but
   prevents both target drift and accidental loss of working capabilities.
2. **P1 — semantic spine (M1/M2):** implement section 3.1 plus one bounded
   `card_type_04` import fixture. Canonical save contains no `FeedCardNode` or
   presentation/class-discovered behavior.
3. **P2 — real hold action (M4/M5):** bind typed fingerprint identity to one
   pointer/keyboard state machine and dispatch one `UiActionEvent`. Preserve the
   current checkpoint during this behavior-only packet; do not claim its layout
   as final.
4. **P3 — appearance compiler (M3/M7):** define only the part/layer operations
   used by Mission V2, lower them through Paint IR, and remove decorative
   layer-shaped DOM while converging the component and screen placement on R0.
5. **P4 — artifact identity (M6/M8):** produce the artifact set defined by the
   parent spec and prove preview/runtime identity plus clean double compilation.
6. **P5 — focused editor and visual gate (M9/M10):** author the same canonical
   document through a focused workspace, approve the primary capture, and pass
   one author-edit-compile-run workflow.

Each packet names its expected criterion transition, proof, and non-goals before
code changes begin. Two consecutive cycles without a criterion transition stop
the packet and force an architecture review.

Compatibility import for existing `card_type_04` data is an edge adapter. It
must not dictate the new semantic schema or leak old class-driven behavior into
runtime.

## 12. Explicit non-goals

- rebuilding every existing editor control;
- migrating every feed card type;
- general navbar authoring;
- performance or memory optimization without a failed interaction criterion;
- generalized cross-browser snapshot infrastructure beyond what this component
  needs;
- preserving the current generic two-column/fingerprint subtree as either the
  product model or the visual target;
- rebuilding the target image's top chrome or bottom navigation inside the
  Mission component;
- polishing unrelated Material Lab or Shiny authoring workflows.
