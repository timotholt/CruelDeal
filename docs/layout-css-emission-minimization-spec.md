# Layout CSS Emission Minimization Spec

Status: active
Date: 2026-06-03
Scope: material/feed/chrome nodes in `components/screens/MainMaterialPreviewScreen.tsx` and `src/styles/main-material-preview.css`.

## Goal

The unified layout model should emit CSS as if each node had been hand-authored for exactly its active behavior: no fallback noise, no disabled feature declarations, no "just in case" layout rules.

The editor data model may stay expressive. The emitted CSS must be sparse.

## Principle

Resolved layout values are not the same as emitted CSS.

- Resolvers answer "what does this mean?"
- Emitters answer "what CSS is strictly necessary to make this node render that way?"

A feature that is unset, default, disabled, or irrelevant must emit no CSS for that feature.

## Ownership Boundary

`FeedNodeLayout` owns:

- node position
- width and height behavior
- main/cross axis
- gap and padding
- wrap
- distribution and alignment
- absolute constraints
- push-to-end
- nudge

CSS files own:

- app shell framing
- pointer/drag behavior
- transitions
- typography and icon skin
- material visuals, shadows, texture, glow
- tiny affordance styling such as carousel dot shape

CSS files must not re-declare layout already expressible by `FeedNodeLayout`, unless the rule is documented as a browser or component-library reset.

## Sparse Emission Rules

The layout compiler must build style objects by appending only needed keys.

Never emit:

- `undefined`, `null`, empty strings, or no-op values
- browser defaults unless the app relies on a different default
- model defaults that only exist for editor clarity
- CSS for inactive feature flags
- CSS for legacy fields after a new field has fully replaced them

Prefer:

- no key over a default key
- one shorthand over several longhands only when all longhand values are actually needed
- data attributes for debugging only when they are actively used by CSS, tests, or editor inspection

## Canonical Defaults

These defaults are chosen to minimize CSS output while preserving current behavior.

| Concern | Default meaning | Emit when |
|---|---|---|
| `selfPosition` | in flow | node is absolute or needs positioning context |
| `direction` | column | row or reverse is active, or flex context must be explicit |
| `reverse` | false | true |
| `wrap` | false | true |
| `distribute` | start | not start |
| `crossAlign` | stretch | not stretch |
| `gap` | 0 | nonzero |
| `padding` | 0 | nonzero |
| `wMode` | fixed | hug/fill, or fixed value differs from parent/semantic default |
| `hMode` | fixed | hug/fill, or fixed value differs from parent/semantic default |
| `pushToEnd` | false | true |
| `nudgeX/Y` | 0 | either nonzero |
| `constraintH` | left | absolute node and not left, or left offset is needed |
| `constraintV` | top | absolute node and not top, or top offset is needed |

Browser defaults may differ from model defaults. The emitter should prefer browser defaults when they produce the same visual result.

## Feature-Gated Emission

Each feature owns its own emission block.

### Position

Emit `position:absolute` only for absolute nodes.

Emit `position:relative` only when at least one is true:

- the node has absolute children that need this node as containing block
- editor selection pseudo-elements need the node as containing block
- a skin or behavior rule explicitly requires relative positioning

Do not emit `left`, `right`, `top`, `bottom`, `width`, or `height` for in-flow nodes unless sizing requires it.

### Absolute Constraints

For absolute nodes, emit only the longhands needed by the selected constraint:

- `left`: `left`, plus width if fixed
- `right`: `right`, plus width if fixed
- `left-right`: `left` and `right`; omit width
- `center`: `left: calc(...)` plus `translateX(-50%)`; width if fixed
- `scale`: percent left and percent width

Same rule for vertical constraints.

If a constraint does not use a far edge, do not emit that far edge.

### Flex Container

Emit flex container CSS only when the node has flow children or rendered flow content.

Emit:

- `display:flex` only when a flex layout is required
- `flex-direction` only when not browser/default-equivalent
- `flex-wrap` only when `wrap=true`
- `justify-content` only when not default-equivalent
- `align-items` only when not default-equivalent
- `gap` only when nonzero

If a node has no flow children and no flow text, it should not emit flex-axis CSS.

### Size

Fixed size emits only the axis that must be constrained.

Hug emits only the CSS needed to let content define the axis.

Fill emits only the CSS needed in the parent/axis context:

- main-axis fill: `flex-grow`/`flex-basis` only on in-flow children
- cross-axis fill: `align-self:stretch` only if parent cross alignment would not already stretch
- absolute fill: constraints should prefer `left-right` or `top-bottom` rather than `width:100%`/`height:100%`

### Push To End

Emit exactly one auto margin, axis-aware:

- column: `margin-top:auto`
- row: `margin-left:auto`

Do not keep legacy slot CSS for footer behavior.

### Text Fit vs Flow

If an axis is Hug, Fit is inactive. Inactive Fit emits no fitter-specific CSS and no measurement wrapper CSS beyond what Flow needs.

Fit CSS must only apply to render modes that use fit measurement.

Flow CSS must only apply to render modes that use natural text flow.

## Data Attributes

Data attributes are useful while the system is still being validated, but they are still emitted DOM.

Keep only attributes that are used by:

- CSS selectors
- browser/DOM verification
- editor inspection
- debugging a still-active migration

Retire attributes once the CSS and tests no longer need them.

## CSS File Policy

`main-material-preview.css` must be divided mentally into three allowed kinds of rules:

1. **Shell**: phone/screen/frame/backdrop wrappers.
2. **Behavior**: drag transforms, transitions, pointer-event affordances.
3. **Skin**: typography, icon shape, material visual treatment.

If a rule says where a material node sits or how its children are arranged, first try to move it into `FeedNodeLayout`.

Allowed exceptions must be commented near the rule.

## Implementation Plan

1. Add a `compactStyle()` helper that removes unset/no-op values from `JSX.CSSProperties`.
2. Split `feedNodeLayoutCss()` into small append-only emitters:
   - `emitPositionCss`
   - `emitConstraintCss`
   - `emitSizeCss`
   - `emitFlexCss`
   - `emitSpacingCss`
   - `emitTransformCss`
3. Add exact-key tests for representative layouts.
4. Remove data attributes no longer used by CSS/tests.
5. Audit CSS for layout ownership after each converted component.

## Required Tests

Tests should assert exact emitted keys, not only visual behavior.

Minimum cases:

- default in-flow leaf emits no flex CSS
- row stack emits only row/flex keys it needs
- wrap false emits no `flex-wrap`
- zero gap emits no `gap`
- zero padding emits no padding variable
- absolute left/top emits no right/bottom
- absolute left-right emits no width
- center constraint emits only center offset and transform
- push-to-end emits one auto margin on the active axis
- hug disables fit emission
- disabled background image emits no image/fade styles

Browser verification should still measure important composed layouts:

- top bar
- feed stage/track/slide/dots
- bottom chrome
- at least one card with a button child

## Acceptance Criteria

A node passes the minimal-emission standard when:

- every emitted style key can be explained by an active feature
- deleting any emitted key changes the visual result or interaction behavior
- enabling a feature adds only that feature's keys
- disabling a feature removes all of that feature's keys
- no CSS file rule duplicates layout that the node model can emit

## Non-Goals

Do not convert visual skin to inline styles merely to reduce CSS file length.

Do not remove CSS that belongs to material rendering, texture, typography, or animation just because it is verbose.

Do not make the compiler clever enough to become a layout engine. It should emit minimal CSS for explicit model choices, not infer design intent from rendered measurements.
