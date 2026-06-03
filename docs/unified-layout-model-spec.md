# Unified Layout Model Spec

Status: draft / proposal
Date: 2026-06-03
Scope: every node in the material/feed system (cards, mission briefings, top bar, currency row, nav, toolbar, buttons). Not mission-briefing-specific.

## 1. Problem

The editor places nodes as **absolute boxes**: each node has fixed `x / y / width% / height%`. Boxes never react to content. That makes flow behaviors impossible with sliders alone:

- short text can't vertically center (box doesn't know text height)
- a box can't shrink-wrap its text
- a button can't sit "after" the text — it's a separate absolutely-placed node
- a horizontal menu and a vertical card are built with different bespoke CSS, not one model

HTML solves all of this with **flow layout + intrinsic sizing**. The unification is: **make every node an auto-layout box (flexbox), driven by data/sliders.** A row menu and a column card become the *same container* with `direction` flipped. One primitive, many parameters.

## 2. Core principle

> One node type. It is a box that lays out its children along an axis (or holds them absolutely). Direction, alignment, spacing, and per-axis sizing are parameters. This is Flexbox / Figma auto-layout expressed as editor data that compiles to CSS flex.

Two concerns stay **orthogonal** to layout (already built, keep as-is):

- **Markup axis**: `on/off` — parse `[..]` tokens vs literal.
- **Render axis**: `fit/flow` — autoscale text to the box vs natural size.

Layout decides the box; Markup/Render decide how a *text leaf* fills it. Section 7 ties them together.

## 3. The box model (every node)

```
Node {
  // --- container behavior: how THIS node arranges its children ---
  layout: {
    mode:        'stack' | 'absolute'      // flow children, or free x/y children
    direction:   'row' | 'column'          // main axis (stack mode only)
    reverse:     boolean                    // row-reverse / column-reverse
    wrap:        boolean                    // allow wrapping to next line
    distribute:  'start'|'center'|'end'|'between'|'around'|'evenly'  // MAIN axis
    align:       'start'|'center'|'end'|'stretch'                    // CROSS axis
    gap:         number(px)                 // space between children
    padding:     {t,r,b,l} or uniform px    // inner inset
  }

  // --- this node's own size, per axis ---
  size: {
    w: { mode: 'fixed'|'hug'|'fill', value?: number, unit?: '%'|'px', min?, max? }
    h: { mode: 'fixed'|'hug'|'fill', value?: number, unit?: '%'|'px', min?, max? }
  }

  // --- how THIS node sits inside its parent ---
  self: {
    position:  'in-flow' | 'absolute'      // absolute = escape the stack (overlay/pin)
    x?, y?:    number                       // used when position absolute
    alignSelf?: 'auto'|'start'|'center'|'end'|'stretch'   // override parent cross align
    pushToEnd?: boolean                     // margin-auto before: pin to far end (footer)
    nudgeX?, nudgeY?: number                // px micro-offset (keep existing)
    order?:    number                       // reorder within stack
  }

  // --- content (unchanged axes) ---
  content?:  text/markup
  markup?:   'auto'|'on'|'off'
  render?:   'auto'|'fit'|'flow'
  surface?:  MaterialRecipe
  children?: Node[]
}
```

This is a superset of today's fields; Section 9 maps the migration.

## 4. Container parameters (stack mode)

Compiles directly to flex on the node:

| param | CSS |
|---|---|
| `direction` + `reverse` | `flex-direction: row\|column[-reverse]` |
| `distribute` (main) | `justify-content: flex-start\|center\|flex-end\|space-between\|space-around\|space-evenly` |
| `align` (cross) | `align-items: flex-start\|center\|flex-end\|stretch` |
| `gap` | `gap` |
| `padding` | `padding` |
| `wrap` | `flex-wrap: wrap` |

A **menu/toolbar** = `direction: row`. A **mission briefing / card body** = `direction: column`. Same node, one toggle apart.

## 5. Alignment is axis-relative (naming change)

Today: `Align` = horizontal, `Justify` = vertical. That only works for columns. With direction as a parameter, alignment must be **axis-relative**:

- **Distribute** = along the main axis (the direction). Gets `start/center/end` + `between/around/evenly`.
- **Align** = across the cross axis. Gets `start/center/end/stretch`.

Concrete reading:
- `direction: column` → Distribute = vertical (top/center/bottom), Align = horizontal (left/center/right). **Matches today's Justify/Align.**
- `direction: row` → Distribute = horizontal, Align = vertical. (flips)

UI: label the two controls with arrows that follow `direction` (like Figma) so "Distribute ↕ / Align ↔" rotates to "Distribute ↔ / Align ↕" when you switch to row. Same two sliders, meaning follows direction. Migration: today's `Justify`→`Distribute`, today's `Align`→`Align (cross)`; for existing column nodes the values carry over unchanged.

## 6. Sizing model — Fixed / Hug / Fill (per axis)

The shrink-wrap answer. Each axis of each node is one of:

| mode | meaning | CSS |
|---|---|---|
| **Fixed** | explicit size (slider) | `width: N% \| Npx` (today's behavior) |
| **Hug** | shrink to content | `width: fit-content` / `height: auto` |
| **Fill** | take parent's leftover | main axis → `flex: 1`; cross axis → `align-self: stretch` |

Resolution rules (must define to avoid loops):

1. **Hug needs intrinsic content.** A text leaf hugs to its text box. A container hugs to `sum(children) + gaps + padding` on the main axis, `max(children)` on the cross axis.
2. **Fill needs a sized parent.** Fill resolves against the parent's resolved size on that axis. Fill main-axis = grow to share leftover. Fill cross-axis = stretch to parent cross size.
3. **Hug parent + Fill child (circular).** Parent hugs children, child wants to fill parent → undefined. Rule: a Fill child inside a Hug parent on the same axis **falls back to Hug** (shrink to content). Warn in the editor.
4. **min/max** clamp the resolved size on each axis.

Slider behavior: in Hug/Fill the W (or H) slider greys out (Figma model). Fixed re-enables it.

## 7. Text + Fit, reconciled with sizing

`Hug` and `Fit` are **inverses** and must not both be "on":

- **Hug** = the box follows the text → text renders at natural size, box grows. (`render: flow`, size: hug)
- **Fit** = the text follows the box → box is Fixed/Fill, text scales to fill it (GameTextV2 glyph-fit for raw, ScaleToFit box-fit for markup).

Decision rule for a text leaf:

| size on the constrained axis | render | result |
|---|---|---|
| Hug | (forced) flow | box = text size, no scaling |
| Fixed / Fill | flow | text natural; clips if overflow |
| Fixed / Fill | fit | text scales to box (never overflow) |

So `Render: fit/flow` only matters when the box is Fixed/Fill. If a node is Hug, render is implicitly flow. Editor should grey `fit` when the relevant axis is Hug.

Markup `on/off` stays fully orthogonal in all cases.

## 8. Buttons and other children = just children

A button is a node. To make it "flow with the text," put text-leaf + button as **children of a stack container**:

- **Button under text:** container `direction: column`, Hug height. Children: [text, button]. Button sits right after text, pushed by text height. True flow.
- **Button pinned to card bottom:** same, but button `self.pushToEnd = true` (`margin-top: auto`). (This replaces today's `slot: footer`.)
- **Button row (actions):** a nested container `direction: row`, holding multiple buttons, distribute `between`/`center`.
- **Button inline mid-sentence:** out of scope for the container model — would need an inline `[button]` markup token (separate, heavier feature). Only build if a button must wrap *inside* a paragraph.

No new concept for 99% of cases — buttons are children of a stack.

## 9. Migration from the current model

Field-by-field; existing data keeps working via derived defaults:

| today | new | derive |
|---|---|---|
| `layout.mode: flow` | `mode: stack` | flow→stack |
| `layout.mode: absolute` | `mode: absolute` (container) / child `self.position: absolute` | — |
| `layout.slot: footer` | child `self.pushToEnd: true` | — |
| `layout.slot: overlay` | child `self.position: absolute` | — |
| `layout.slot: body/auto` | `self.position: in-flow` | — |
| `layout.align` (l/c/r) | `align` (cross) for columns; remap by direction | carry value |
| `layout.justify` (s/c/e) | `distribute` (main) | carry value |
| `layout.width/height %` | `size.w/h = {mode: fixed, value, unit:'%'}` | wrap |
| `layout.x/y` | `self.x/y` (absolute only) | — |
| `layout.gap / padding` | `layout.gap / padding` | unchanged |
| `nudgeX/Y` | `self.nudgeX/Y` | unchanged |
| `markup / render` | unchanged | — |

Default for a legacy node: `mode: stack` if it has flow children else `absolute`; both size axes `fixed %`. Visual output identical until the user opts into Hug/Fill/row.

## 10. The whole UI surfaces as a few controls

Per selected node:

- **Layout**: `Stack ↔ Absolute`. If Stack: `Direction row/column`, `Reverse`, `Wrap`.
- **Distribute** (main): start/center/end/between/around. Arrow follows direction.
- **Align** (cross): start/center/end/stretch. Arrow follows direction.
- **Gap**, **Padding** (4-side or uniform).
- **W**: `Fixed | Hug | Fill` + slider (slider active only on Fixed).
- **H**: `Fixed | Hug | Fill` + slider.
- **Self** (how it sits in parent): `In-flow | Absolute`, `Pin-to-end`, `Align-self`, nudge.
- (existing) **Markup**, **Render**, surface controls.

Most nodes only touch Direction + Distribute + Align + a sizing mode.

## 11. Implementation sketch

Renderer already compiles `layout → CSS` in `feedNodeLayoutCss`. Extend it to emit:

```
display: flex;
flex-direction: <direction[-reverse]>;
justify-content: <distribute>;
align-items: <align>;
gap; padding; flex-wrap;
```
and per child:
```
width/height: <fixed value | fit-content | (fill → flex:1 / align-self:stretch)>;
position: <in-flow=static | absolute + x/y>;
margin-<dir>: auto  (pushToEnd);
align-self; order; transform: translate(nudge);
```

This is mostly a data→CSS mapping; no custom layout engine. The hard parts are the **sizing resolution rules** (§6) and **greying invalid combinations** in the editor (§6–§7).

Unifies the bespoke layouts too (eventual): top bar = row stack, currency row = row stack + gap, nav = row stack distribute-evenly, toolbar = row stack, card body = column stack. They can migrate off hand-written grid/flex CSS onto the same primitive.

## 12. Build order (incremental, each shippable)

1. **JUSTIFY for short flow text** — `.main-material-card-node-flow-text: flex 1→0 1 auto`. Tiny. Unblocks vertical align now (Q1).
2. **Sizing toggle Fixed/Hug/Fill** on W and H, column nodes only first. Delivers shrink-wrap (Q2) + working vertical center.
3. **Text/Fit reconciliation** (§7): grey `fit` when axis is Hug; auto-flow when Hug.
4. **Buttons as flow children** (Q3-A): expose `pushToEnd`, ensure a stack container can hold text+button. Mostly UI + the slot→self mapping.
5. **Direction row/column** + axis-relative Distribute/Align rename. Unlocks menus = row containers.
6. **Migrate bespoke bars** (top bar, currency, nav, toolbar) onto the primitive. Cleanup, optional.

## 13. Decisions (locked)

1. **Alignment = Figma.** Two controls, axis-relative: a main-axis **Distribute** (`packed: start/center/end` OR `space-between/around/evenly`) and a cross-axis **Align** (`start/center/end/stretch/baseline`). Editor surfaces it as Figma does: a 3×3 alignment grid + a "packed vs spaced" distribution mode. Arrows/grid orientation follow `direction`.
2. **Absolute children = Figma constraints** (§14), not raw x/y. Horizontal constraint `left | right | left-right | center | scale`, vertical `top | bottom | top-bottom | center | scale`, resolved against the parent box. "Absolute" = Figma's "ignore auto-layout."
3. **No inline `[button]` markup token.** Buttons are stack children only.
4. **Bespoke bars rebuilt, not migrated.** Top bar / currency row / nav / toolbar are thrown away and re-authored as new nodes in this paradigm (row stacks). No need to preserve their current settings — current ones are throwaway.

Remaining minor: percent-vs-px for Fixed under a Hug parent (rule: Fixed-% only valid under a Fixed/Fill parent on that axis; otherwise treat as px). Wrap ships in the direction step (§12.5).

## 14. Constraints (absolute children, Figma model)

When `self.position: absolute` (child ignores the stack), it is pinned to the parent box via per-axis constraints instead of flowing:

```
self.constraints: {
  h: 'left' | 'right' | 'left-right' | 'center' | 'scale'
  v: 'top'  | 'bottom'| 'top-bottom'| 'center' | 'scale'
}
```

Resolution against parent content box (W×H):
- `left/top`: offset fixed from that edge (uses `x`/`y`).
- `right/bottom`: offset fixed from the far edge.
- `left-right` / `top-bottom`: pin both edges → element stretches with parent (size follows parent on that axis).
- `center`: keep centered; offset is from center.
- `scale`: position+size scale proportionally with parent (percentage of parent on that axis).

Compiles to absolute positioning with `left/right/top/bottom/width` chosen per constraint. Overlay nodes (today's `slot: overlay`) become `position: absolute` + default `center/center` or `left/top`.
```
