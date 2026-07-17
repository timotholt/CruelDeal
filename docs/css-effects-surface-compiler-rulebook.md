# CSS and Effects Surface Compiler Rulebook

Status: authoritative
Date: 2026-07-16
Owner: UI authoring, appearance compiler, and game client

This document is the property-by-property contract for the Cruel Deal UI
authoring system. It answers four questions for every authoring control:

1. what source value the control edits;
2. what CSS class, property, variable, or effect operation it emits;
3. which physical paint slot owns the result;
4. what the designer should expect to happen.

`docs/semantic-ui-authoring-compiler-spec.md` remains the architectural
authority. This rulebook is its required lowering and control contract. When a
legacy Material Lab field, feed-node control, or renderer disagrees with this
rulebook, the legacy path is migration evidence, not authority.

## 1. Product rule

The editor is CSS with a deterministic effects compiler on top.

- Layout, sizing, spacing, typography, color, ordinary backgrounds, borders,
  radii, overflow, alignment, and positioning behave like normal CSS.
- Bevels, rough edge wear, glass stacks, masks, metallic reflection, and other
  effects that are awkward to author by hand are typed effect operations.
- A slider edits source data. It does not directly manipulate the live preview
  DOM.
- One shared compiler lowers normal CSS and effect operations into the smallest
  faithful browser representation.
- Semantic components keep their own behavior and required structure. The
  compiler styles their declared parts; it does not replace them with generic
  boxes.
- Selecting an item in the tree selects a semantic part and its ordered style
  stack. It does not select an accidental decorative `<span>`.

The authoring experience may expose familiar CSS names. It must not invent a
second layout model where `padding`, `gap`, `width`, or `justify-content` behave
differently from CSS.

## 2. Bounded surface shell

The four-element limit applies to the visual shell of one styled appearance
part. It does not count semantic descendants required by the component, such as
the title, body, mission terms, and fingerprint action inside a Mission
Briefing.

| Physical slot | DOM form | Purpose |
| --- | --- | --- |
| `H` host | required semantic element | Layout, box model, geometry, base backgrounds, border, shadows, filters, masks, and inherited variables |
| `U` underlay | optional one helper | Independently blended or backdrop-filtered paint below content |
| `C` content | existing semantic content or optional one wrapper | Text, icons, media, and child layout |
| `O` overlay | optional one helper | Reflection film, wear, scan, emission, or other paint that must sit above content |

The surface shell is therefore:

```text
H host
  U underlay?       optional
  C content         existing content or one wrapper when required
  O overlay?        optional
```

The maximum is the host plus three surface-owned children. Most output should
be one of:

- text: host only;
- simple button: host plus content;
- glass panel: host plus underlay plus content;
- reflective button: host plus content plus overlay;
- exceptional full shell: host plus underlay plus content plus overlay.

`H::before` and `H::after` are compiler paint slots, not DOM elements. They do
not relax the element limit. They are recorded in the allocation report because
they still consume exclusive paint capacity and may create compositor work.

If a graph cannot fit this shell, the compiler must choose one of these explicit
outcomes:

1. fold compatible operations into a CSS list;
2. pre-bake compatible static operations into one asset;
3. approximate within a declared target tolerance;
4. reject the graph with a slot-conflict diagnostic.

It must never append an unbounded helper subtree or silently drop an effect.

### 2.1 Paint order

The canonical order is:

```text
outer box-shadow
H background and base material
H::before reserved compiled under-content paint
U underlay
C content
H::after reserved compiled over-content paint
O overlay
outline and focus indicator
```

The allocator may use a pseudo-element in another position only when its
stacking context is explicit in the allocation report. All decorative slots use
`pointer-events: none`. Interactive behavior remains on the semantic host or a
declared semantic child.

### 2.2 Geometry ownership

The host owns the shape exactly once:

- `border-radius` and `corner-shape` where supported;
- `clip-path` only as the declared fallback;
- `overflow` according to authored overflow and effect clipping needs.

Helpers inherit the host radius/shape and use `inset: 0`. A helper must not add
an unexplained extra border, padding ring, or one-pixel inset. Border width is
included in layout through `box-sizing: border-box`.

## 3. Style stack and class contract

Every appearance part has this cascade, from lowest to highest priority:

1. browser and reset rules;
2. semantic component base class;
3. ordered shared-style references;
4. instance-authored CSS;
5. active state override;
6. active responsive override;
7. editor-only inspection overlays outside the product subtree.

The editor shows this stack when a part is selected. It must show the source of
the winning value and any overridden values.

### 3.1 When classes are used

Classes represent stable identity or discrete modes:

- component and part identity, such as `.mission-briefing__terms`;
- shared style identity, such as `.ui-style-contract-panel`;
- a deterministic generated instance rule, such as `.ui-s-4f8c2a`;
- discrete capabilities, such as `.is-beveled` or `.has-metal-reflection`;
- state selectors, such as `[data-ui-state="holding"]`.

Continuous values do not create classes. Moving a padding slider from `12px` to
`13px` updates `padding`, not a `padding-13` class. Changing glow power updates a
custom property or a compiled shadow list, not a new glow-strength class.

The runtime class list is deterministic. Class names never contain editor
session IDs, random values, or a slider value that can be represented as a CSS
declaration.

### 3.2 Direct properties and custom properties

Use a direct CSS property when the authored concept is already one CSS
property. Use a custom property when several emitted declarations consume the
same authored value or when state changes the value without reallocating slots.

Examples:

```css
.ui-s-4f8c2a {
  box-sizing: border-box;
  width: 100%;
  padding: 16px 18px;
  gap: 12px;
  --ui-glass-blur: 10px;
  --ui-reflection-opacity: 0.42;
}
```

Mode classes select a rule shape; variables supply its values:

```css
.is-beveled {
  corner-shape: bevel;
  border-radius: var(--ui-corner-tl) var(--ui-corner-tr)
    var(--ui-corner-br) var(--ui-corner-bl);
}
```

### 3.3 Shared styles and instance overrides

A shared style is an ordered source object, not an arbitrary CSS string copied
into every node. An instance may:

- inherit the shared value;
- override the value;
- clear the override and expose the shared value again.

Editing a shared style updates every referencing instance. Editing an instance
does not mutate the shared style unless the designer explicitly enters shared
style editing mode.

## 4. Machine-readable control rule

The implementation must represent each editor control with one registry entry:

```ts
interface AuthoringControlRule {
  id: string;
  label: string;
  sourcePath: string;
  valueType: 'boolean' | 'number' | 'color' | 'length' | 'enum' | 'asset' | 'text';
  unit?: 'px' | '%' | 'rem' | 'em' | 'cqw' | 'deg' | 'ms' | 'ratio';
  allowedValues?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  writes: readonly CssWriteOrPaintOperation[];
  slot: 'H' | 'H::before' | 'U' | 'C' | 'H::after' | 'O' | 'compiler';
  dependencies: readonly string[];
  conflicts: readonly string[];
  cost: 0 | 1 | 2 | 3;
  expectedResult: string;
}
```

The inspector UI, validation, compiler tests, and documentation coverage tests
must read the same registry. A visible control with no rule entry is a defect.
A rule entry with no emitted result is also a defect.

## 5. Layout and box model rules

These controls write normal CSS on `H` unless the selected part declares that a
specific semantic content wrapper owns child layout.

| Control / source | CSS write | Slot | Expected result and rules |
| --- | --- | --- | --- |
| Display `layout.display` | `display: block/flex/grid/none` | `H` | Changes formatting context. `none` also removes the part from accessibility layout only when the component contract permits it. |
| Position `layout.position` | `position: static/relative/absolute/fixed/sticky` | `H` | Uses normal containing-block rules. Effect code must not overwrite it. |
| Inset `layout.inset.*` | `top/right/bottom/left` or `inset` | `H` | Applies only to positioned elements. Opposing sides may define stretch. |
| Horizontal constraint | compiled `left/right/width` | `H` | `left-right` emits both sides and omits width; `center` emits a center anchor plus the compiler transform channel. |
| Vertical constraint | compiled `top/bottom/height` | `H` | `top-bottom` emits both sides and omits height; `center` emits a center anchor plus the compiler transform channel. |
| Width mode | `width` plus flex/grid participation | `H` | `fixed` uses authored width; `hug` uses intrinsic sizing; `fill` uses the parent layout model, normally `width: 100%` or `flex: 1 1 0`. |
| Height mode | `height` plus flex/grid participation | `H` | `fixed` uses authored height; `hug` uses `auto`; `fill` stretches or grows on the parent's main axis. |
| Width / height | `width`, `height` | `H` | Accept valid CSS lengths, percentages, and approved responsive units. Disabled while the corresponding mode does not consume the value. |
| Min/max size | `min-width`, `max-width`, `min-height`, `max-height` | `H` | Constrains the resolved size without replacing width/height intent. |
| Aspect ratio | `aspect-ratio` | `H` | Participates in normal CSS sizing. It does not force both dimensions. |
| Box sizing | `box-sizing` | `H` | Authored surfaces default to `border-box`. |
| Margin | `margin` or four longhands | `H` | Changes space outside the border. It does not move effect helpers independently. |
| Padding | `padding` or four longhands | `H` or declared `C` | Insets child content inside the border. It does not shrink, offset, or add a ring to decorative helpers. |
| Gap | `gap`, `row-gap`, `column-gap` | child-layout owner | Spaces in-flow children only. It never substitutes for padding or paragraph spacing. |
| Flex direction | `flex-direction` | child-layout owner | `row`, `row-reverse`, `column`, or `column-reverse`. |
| Flex wrap | `flex-wrap` | child-layout owner | Controls wrapping without changing child order in source. |
| Main alignment | `justify-content` | child-layout owner | `start`, `center`, `end`, `space-between`, `space-around`, or `space-evenly`. |
| Cross alignment | `align-items` | child-layout owner | `start`, `center`, `end`, `stretch`, or `baseline` where supported by the part. |
| Multi-line alignment | `align-content` | child-layout owner | Active only when a wrapped flex/grid container has extra cross-axis space. |
| Self alignment | `align-self` | `H` as child | Overrides the parent's cross-axis alignment for this part. |
| Flex grow/shrink/basis | `flex-grow`, `flex-shrink`, `flex-basis` | `H` as child | Uses normal flex sizing. `fill` may set these as a preset, but the resolved CSS remains inspectable. |
| Push to end | main-axis `margin-*: auto` | `H` as child | Column uses `margin-top: auto`; row uses `margin-left: auto`. |
| Order | `order` | `H` as child | Visual reordering is allowed only when it does not violate semantic or focus order. |
| Grid template | `grid-template-columns/rows/areas` | child-layout owner | Defines the selected container's grid. |
| Grid placement | `grid-column`, `grid-row`, `grid-area` | `H` as child | Places the selected child without adding wrappers. |
| Overflow X/Y | `overflow-x`, `overflow-y` | `H` | `visible`, `hidden`, `clip`, `auto`, or `scroll`. Effect clipping requirements must be reported if they force a stricter value. |
| Z order | `z-index` | `H` | Applies only in a stacking context. Surface shell slots remain internally ordered. |
| Nudge X/Y | compiler transform channel | `H` | Visual translation that does not affect sibling layout. It composes with state motion; it never overwrites it. |
| Opacity | `opacity` | `H` | Affects the whole part and creates a stacking context. Content-only opacity uses the typography/content rule instead. |
| Visibility | `visibility` | `H` | Preserves layout. Use semantic enabled/disabled state for behavior. |

### 5.1 Padding acceptance test

For a fixed `320px` wide border-box with a `1px` border, increasing horizontal
padding from `12px` to `20px` must:

- keep the outer width at `320px`;
- move content inward by `8px` per side;
- leave the border, bevel, texture, reflection, and wear aligned to the same
  outer shape;
- reduce only the content box;
- produce no second inset border.

### 5.2 Transform ownership

`transform` has one compiler owner. Layout nudge, centering, state scale,
state translation, and authored rotation are composed in a stable order:

```text
constraint centering -> layout translate -> authored rotate -> state translate -> state scale
```

The compiler may use individual `translate`, `rotate`, and `scale` properties
when the target profile supports them. No feature writes a separate `transform`
declaration that can clobber another feature.

## 6. Typography and content rules

Typography writes to the semantic text element or declared content slot, not to
a decorative surface layer.

| Control / source | CSS write | Slot | Expected result and rules |
| --- | --- | --- | --- |
| Text / binding | text node or trusted rich-text tokens | `C` | Content is data, not generated CSS. Rich text uses an allowlisted token grammar. |
| Font family | `font-family` | `C` | Uses the target manifest's pinned font stack. Missing fonts are a diagnostic. |
| Font size | `font-size` | `C` | Supports `rem`, component-relative `cqw`, or approved CSS lengths. No viewport-width font scaling. |
| Font weight | `font-weight` | `C` | Must correspond to an available font face or an accepted synthetic fallback. |
| Font style | `font-style` | `C` | `normal` or `italic`. |
| Line height | `line-height` | `C` | Unitless by default so it scales with font size. |
| Letter spacing | `letter-spacing` | `C` | Uses `em`. Authoring may be negative where the font permits it; product design still forbids accidental clipping. |
| Word spacing | `word-spacing` | `C` | Normal CSS behavior. |
| Case | `text-transform` | `C` | `none`, `uppercase`, `lowercase`, or `capitalize`. Source text is preserved. |
| Text alignment | `text-align` | `C` | `left`, `center`, `right`, `start`, or `end`. It does not change flex alignment. |
| Vertical text placement | parent alignment or content translate | `C` | Prefer parent layout. X/Y nudge is an explicit visual offset and composes through the transform owner. |
| Text color | `color` | `C` | Emits a direct color or a theme/material variable. |
| Text opacity | color alpha by default | `C` | Changes text only. It must not make child icons or the host transparent unless whole-content opacity was explicitly selected. |
| Text shadow / emboss | compiled `text-shadow` list | `C` | `dark`, `light`, `shadow`, or `none`; strength, offset, and blur rewrite one list. |
| Text glow | appended `text-shadow` entries | `C` | Composes with emboss in the same list. It never overwrites emboss. |
| Icon color | `color`, `fill: currentColor`, `stroke: currentColor` | `C` | Icon adapters inherit the selected tone. |
| Icon glow | `filter: drop-shadow(...)` on icon | `C` | Applies to the icon only. It composes with any icon filter list. |
| White space | `white-space` | `C` | `normal`, `nowrap`, `pre-line`, or component-approved value. |
| Wrapping | `overflow-wrap`, `word-break`, `hyphens` | `C` | Uses normal browser line breaking unless a component restricts it. |
| Overflow text | `text-overflow` plus overflow/white-space | `C` | Ellipsis requires the normal CSS preconditions and must be emitted as one preset transaction. |
| Maximum lines | `line-clamp` / `-webkit-line-clamp` preset | `C` | Clamps normal flow. It is distinct from font-size fitting. |
| Paragraph gap | margins on generated paragraph tokens | `C` | Applies between paragraphs only, never between wrapped lines. |
| Markup mode | parser mode, no CSS | compiler | `off` is literal text; `on` parses allowlisted tokens; `auto` follows the content contract. |
| Sizing mode | normal flow or text-fit runtime | `C` | `flow` is ordinary CSS; `fit` invokes the bounded text-fit helper; `auto` follows the component contract. |
| Fit mode | fit helper configuration | compiler | `single-line`, `fixed-lines`, or `paragraph`; it does not alter markup mode. |

Pure white product text is represented by equal RGB channels, normally
`#ffffff`, with opacity controlled separately. Metallic text is a material
effect and follows Section 13.

## 7. Base, background, and geometry rules

| Control / source | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Base enabled | include/omit base paint | `H` | Disabling base exposes lower page content; it does not disable unrelated effects. |
| Base color | first compiled `background-image` solid layer or `background-color` | `H` | The bottommost surface pixel source. |
| Background image | `background-image` layer | `H` | Asset identity is pinned. |
| Image fit | `background-size: cover/contain/auto` | `H` | Uses normal CSS image fitting. |
| Image position X/Y | `background-position` | `H` | Percentages follow CSS image-position rules. |
| Image repeat | `background-repeat` | `H` | Defaults to `no-repeat` for media and `repeat` for tile textures. |
| Image scale | compiled `background-size` | `H` | Scales the selected image layer only. |
| Background blend | `background-blend-mode` list | `H` | List length and order match compiled background layers. |
| Shape | mode class plus geometry properties | `H` | `rect`, rounded rectangle, or bevel/chamfer. |
| Radius | `border-radius` | `H` | Applies to host and is inherited by helpers. |
| Per-corner radius | four-value `border-radius` | `H` | Uses top-left, top-right, bottom-right, bottom-left order. |
| Bevel enabled/corners | `.is-beveled`, `corner-shape`, fallback `clip-path` | `H` | Changes only selected corners. It does not add a border. |
| Bevel size | per-corner radius/cut variables | `H` | Alters the cut geometry. Border and effects follow the same geometry. |
| Clip/mask geometry | `clip-path` or `mask` | `H` / allocated pseudo | Shape clipping is part-owned and shared. A decorative mask does not redefine layout. |

All compatible static fill, media, texture, tint, gradient, and static
reflection operations compile into one ordered background stack. The compiler
emits `background-image`, `background-size`, `background-position`,
`background-repeat`, and `background-blend-mode` as parallel lists so one
control cannot reset another with a shorthand.

## 8. Texture, tint, and static lighting rules

| Control / current migration key | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Texture preset `texture` | pinned asset or procedural image | `H` | Selects texture identity. `none` disables the operation without destroying its stored settings. |
| Texture opacity `textureStrength` | texture alpha or cross-fade amount | `H` | `0..1`; affects only texture pixels. |
| Texture scale `textureScale` | corresponding `background-size` entry | `H` | Larger values make the repeated pattern physically larger. |
| Tint tone `tint` | solid background layer and blend mode | `H` | Color tint uses the declared blend mode; white tint may use `screen`. |
| Tint strength `tintStrength` | tint alpha | `H` | `0..1`; does not alter base color data. |
| Static gradient mode `gradient` | discrete gradient recipe | `H` | `none`, `top-light`, `bottom-dark`, or `both`. |
| Light strength `lightStrength` | white-stop alpha variable | `H` | Alters the bright portion of the selected static recipe. |
| Dark strength `darkStrength` | dark-stop alpha variable | `H` | Alters the dark portion without changing base material. |
| Side sheen `sheen` | recipe mode flag | `H` | Adds/removes the secondary static directional sheen. |
| Host brightness `surfaceFilterBrightness` | compiled `filter: brightness()` entry | `H` | Affects the entire host including content. Use sparingly. |
| Paint brightness `surfaceLayerBrightness` | brightness on allocated paint slot | `U` or `O` | Affects decorative paint only. It requires a helper if it cannot be folded without affecting content. |

Toggle controls must not erase tuned values. Enabling an unconfigured effect may
seed documented defaults in one undoable transaction. Disabling preserves its
last parameters so re-enabling restores them.

## 9. Glass and blur rules

| Control / current migration key | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Glass enabled `glass` | glass wash operation | `U` preferred | Adds translucent wash; does not imply blur. |
| Glass opacity `glassOpacity` | wash alpha | `U` | Changes the glass tint/wash only. |
| Backdrop blur enabled `glassBlurEnabled` | include backdrop operation | `H` or `U` | May be active without a glass wash. |
| Backdrop blur `glassBlur` | `backdrop-filter: blur(...)` and prefixed form | `H` or `U` | Blurs pixels behind the part, not its children. |
| Backdrop saturation | `backdrop-filter: saturate(...)` | same blur owner | Composes into one filter list. |
| Glass shine `glassShine` | highlight recipe | `U` or `O` | Requires glass wash. It does not allocate another helper if the current slot can carry it. |
| Reflection opacity `glassReflectionOpacity` | shine alpha | shine owner | Changes bright reflection, not wash opacity. |
| Shine width | background-size or recipe variable | shine owner | Changes highlight width within the surface. |
| Shine height | background-size or recipe variable | shine owner | Changes highlight height. |
| Shine Y | background-position Y | shine owner | Moves the highlight without moving the glass wash. |

`backdrop-filter`, `filter`, and `opacity` are different operations and remain
separate in source. The compiler must not simulate backdrop blur by blurring the
surface's own content.

## 10. Border, bevel, edge, and wear rules

| Control / current migration key | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Border enabled `borderEnabled` | include/omit border operation | `H` or `H::before` | Native border for ordinary shapes; masked pseudo for a chamfer-following border when required. |
| Border sides `border` | border longhands | border owner | Selects top/right/bottom/left. Chamfer outlines must remain complete unless a tested segmented recipe exists. |
| Border width | `border-width` or mask padding | border owner | Included in border-box sizing. |
| Border style | `border-style` | `H` | Normal CSS values supported by target profile. |
| Border color `borderColor` | `border-color` | border owner | `inherit`, theme token, pure color, or custom color. |
| Custom border color `borderCustomColor` | color value | border owner | Used only when custom is selected. |
| Border opacity `borderOpacity` | color alpha | border owner | Does not alter element opacity. |
| Lit border `borderLit` | inset highlight/shadow list | `H` | Adds directional light to the same border geometry; no second ring. |
| Edge highlight `edgeHighlight` | gradient or shadow entries | allocated paint slot | Selects lit edges without adding DOM. |
| Highlight corners `corners` | corner gradient entries | allocated paint slot | Selects corners. Rounded joins use the same host radius. |
| Corner highlight size `cornerSize` | gradient size | highlight owner | Controls arm/spread size. |
| Glow tone `glow` | glow color variables | `H` shadow list or paint slot | Requires at least one selected edge/corner or a declared outer glow recipe. |
| Glow strength `glowStrength` | alpha, blur, and spread variables | glow owner | Recomputes one stable shadow/gradient recipe. |
| Edge wear enabled `edgeWear` | include/omit wear operation | `H::after` or `O` | Preserves configured texture when disabled. |
| Wear texture `edgeWearTexture` | mask image asset | wear owner | `none` disables visible wear but does not erase other wear settings. |
| Wear opacity `edgeWearOpacity` | wear paint alpha | wear owner | Affects chips/scratches only. |
| Wear width `edgeWearWidth` | mask/border band width | wear owner | Measures inward from the exact host outline. It does not create a competing border. |
| Wear scale `edgeWearScale` | mask size | wear owner | Changes texture frequency. |
| Wear layer `edgeWearLayer` | allocation preference | compiler | `below-highlights` or `above-highlights`; this is ordering, not a new element. |

### 10.1 Seam and miter rule

Polygonal and SVG borders must not show one-pixel joints where segments meet.
The preferred order is:

1. one closed path or one closed polygon stroke;
2. `stroke-linejoin: miter` with an explicit miter limit for SVG;
3. one masked solid border for CSS chamfers;
4. overlapping segments only as a tested fallback.

Separate side gradients are not acceptable when they produce doubled corners,
gaps, or a ring outside the intended outline.

## 11. Shadow, glow, emission, and filter rules

| Control / current migration key | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Drop shadow `dropShadow` | include/omit shadow | `H` | Outer shadow sits outside the shape and does not clip content. |
| Shadow opacity `shadowOpacity` | shadow color alpha | `H` | `0` makes the operation visually inactive. |
| Shadow blur `shadowBlur` | `box-shadow` blur | `H` | Does not change geometry. |
| Shadow X/Y `shadowX`, `shadowY` | `box-shadow` offsets | `H` | Moves the shadow only. |
| Shadow spread `shadowSpread` | `box-shadow` spread | `H` | Positive expands; negative contracts. |
| Inner shadow | `inset box-shadow` | `H` | Compiles into the same ordered shadow list. |
| Emission type `emission` | discrete gradient recipe or `none` | `O` preferred | `line`, `center-blip`, or `rail-and-blip`. |
| Emission edge `emissionEdge` | background position/orientation | emission owner | Rotates/anchors the recipe to the selected edge. |
| Emission tone `emissionTone` | emission RGB | emission owner | Uses theme/material tone. |
| Emission strength `emissionStrength` | opacity and drop-shadow alpha | emission owner | `0` leaves the recipe configured but visually inactive. |
| Emission length `emissionLength` | background-size axis | emission owner | Percentage of the selected edge. |
| Emission thickness `emissionThickness` | background-size cross axis | emission owner | Pixel thickness of the rail. |
| Emission blip size `emissionBlipSize` | radial background size | emission owner | Size of center blip. |

`box-shadow`, `text-shadow`, `filter`, and `backdrop-filter` each have one
compiler owner and emit one ordered list. Feature code appends operations to the
source list; it never writes a competing declaration.

## 12. State and motion rules

Canonical states are `idle`, `hover`, `focus-visible`, `holding`, `complete`,
and `disabled`. Legacy `rest`, `active`, and `pressed` are translated only by a
migration adapter.

| Control / current migration key | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Interactive | semantic behavior capability plus state selectors | compiler | Does not infer behavior from class text. |
| Preview state `visualState` | editor-only state input | compiler | Selects a compiled state without changing authored idle data. |
| State enabled `stateful` | include/omit state overrides | compiler | Internal migration control, not a product style. |
| State scale `stateScale` | state transform channel | `H` | Composes with layout transforms. |
| State translate Y `stateTranslateY` | state transform channel | `H` | Composes with centering/nudge. |
| State color/opacity/type overrides | state CSS rule or variables | existing owner | Change values only; no slot is allocated or removed at interaction time. |
| Disabled | `[disabled]` or `aria-disabled` plus state rule | semantic host | Behavior and visuals stay synchronized. |
| Focus visible | `:focus-visible` outline/ring | semantic host | Never depends on hover capability. |

The allocator reserves the union of slots required by every state at compile
time. If `idle` has no emission but `holding` does, the emission slot still
exists in the compiled shell and is transparent at idle. State changes never
mount or unmount decorative helpers.

Pointer and tilt updates modify shared custom properties only. They do not set
component state, rebuild textures, or trigger Solid component reconciliation.

## 13. Metallic material and moving reflection rules

Metallic appearance is a provider-backed effect, not a hand-authored stack of
classes on every node.

### 13.1 Runtime usage

The authored source selects a stable material ID:

```html
<span class="metal-gold">Yellow Gold World</span>
```

The generated equivalent may include one deterministic instance class for
other authored CSS, but applying the material remains one conceptual choice.
The locked runtime also accepts `gold18k` as an explicit compatibility alias;
generated artifacts use `metal-gold`.
The application shell loads the metallic provider once. The provider:

- publishes the immutable reflection film and locked base colors as root
  variables;
- lazily bakes experimental material textures only when the Shiny authoring
  screen is mounted;
- installs one pointer listener and, after explicit iOS permission, one motion
  listener;
- writes normalized `--reflex-gx` and `--reflex-gy` root variables;
- never installs listeners per metallic element;
- never re-bakes a texture in response to movement.

The class works because its CSS consumes the already-published variables. The
class itself does not execute JavaScript.

### 13.2 Node controls

| Control | Emission | Slot | Expected result and dependencies |
| --- | --- | --- | --- |
| Material profile | `.metal-{id}` or provider variable set | `H` for text, `O` for surface film | Selects locked gold/silver/bronze definition. |
| Reflection enabled | `.has-metal-reflection` or operation enabled flag | compiler | Static fallback remains a valid metal color. |
| Reflection intensity | `--metal-reflection-alpha` | reflection owner | Changes moving film contrast without changing base metal. |
| Reflection zoom | `--metal-reflection-scale` / background size | reflection owner | Larger zoom makes the source pattern features smaller in the visible surface, according to the provider's documented convention. |
| Reflection X/Y travel | `--metal-travel-x/y` | reflection owner | Maps normalized global vector to bounded texture shift. |
| Reflection offset | background-position base variables | reflection owner | Separates bright and dark features without changing travel speed. |
| Reflection blur/softness | pre-baked source or provider filter setting | reflection owner | Runtime uses finalized data. Per-frame blur animation is forbidden. |
| Grain | baked texture parameter | author-time compiler | Finalized at build time; not a runtime slider. |
| Stop colors / karat | material definition | author-time compiler | Finalized at build time; not editable per node in the game. |

Kan Token is a fixed corporate identity. It always uses the locked Kan material
and geometry selected at build time. Consumers do not select silver, bronze, or
a per-instance Kan gradient. Its reflection zoom remains author-time data until
the identity is finalized.

### 13.3 Text, buttons, and token allocation

- Metallic text uses the text element itself with `background-clip: text`,
  transparent text fill, and the shared moving background position. It adds no
  helper.
- A metallic button background uses the host background when no independently
  blended content-above film is required; otherwise it uses `O`. The locked
  host classes are `.metal-surface-gold`, `.metal-surface-silver`, and
  `.metal-surface-bronze`.
- A metallic progress fill uses its existing semantic fill element.
- Kan Token uses its specialized SVG mask/path implementation and the same
  provider vector. It is not forced through the generic surface shell.

On iOS, motion permission must be requested from a user gesture. Permission is
session-scoped and may need to be requested again after a refresh. Pointer
fallback remains available. The material stays visible when motion is denied.

## 14. Allocation and conflict rules

The compiler attempts each operation in authored order using this matrix:

| Operation family | Preferred allocation | Compatible folding | Exclusive conflicts |
| --- | --- | --- | --- |
| Fill, image, static gradient, texture, tint | `H` backgrounds | One ordered background list | Operations requiring independent clipping/filtering |
| Static reflection | `H` backgrounds | Other static backgrounds | Independently moving or blended reflection |
| Moving reflection | text host or `O` | Other film backgrounds sharing movement/clip | Edge wear/scan requiring different movement or blend |
| Backdrop glass | `H` or `U` | Wash and blur in one underlay | Content that must appear below and above the same glass |
| Border | native `H` border | Per-side values and lit inset shadows | Masked chamfer border competing for `H::before` |
| Bevel/chamfer | `H` geometry | All helpers inherit | A child requiring a different outer geometry |
| Shadows/glows | `H` shadow list | Multiple inner/outer shadows | A filter-only effect that cannot be represented as shadow |
| Edge/corner highlights | background list or pseudo | Multiple gradients with same order/clip | Pseudo already occupied by incompatible mask |
| Edge wear | `H::after` or `O` | Other masks with identical movement/order | Scan/emission with different order or filter |
| Mask image | `H::before` | Same-color masks merged into one mask list | Chamfer border needing the same pseudo |
| Scan/emission | `H::after` or `O` | Shared overlay background/filter | Wear or reflection requiring a different movement/order |

When two operations want one exclusive slot, allocation proceeds in this order:

1. merge compatible lists;
2. move one operation to an unused bounded slot;
3. pre-bake static operations;
4. use the target profile's declared approximation;
5. reject with both layer IDs and the contested slot.

The compiler may not resolve a conflict by changing authored order, removing
clipping, moving content, or making an effect transparent without a diagnostic.

### 14.1 Current implementation debt

The current `MaterialSurface` renderer emits separate spans for material,
texture, tint, gradient, glass, glow, emission, border, edge wear, edge
highlights, and corners. Corner highlights add four more child spans. This is
the exact structure this rulebook retires.

The current semantic Mission paint compiler already demonstrates the intended
direction by folding backgrounds and shadow lists and using host pseudos. It
still rejects some pseudo conflicts instead of using the bounded `U`/`O`
helpers. The shared compiler must generalize that allocator rather than preserve
either legacy extreme.

## 15. Performance policy

DOM count is not the same as rendering cost. Every control rule carries a cost:

| Cost | Typical work | Policy |
| --- | --- | --- |
| `0` | layout, typography, solid color, ordinary border | Freely usable within component constraints |
| `1` | static image, static gradients, modest shadows, masks | Normal use; assets remain bounded and cached |
| `2` | backdrop blur, mix-blend, large masks, multiple wide glows | Limit area/count and verify on target phones |
| `3` | animated background/mask, continuously changing filters, large translucent blur | Explicit mobile budget and performance proof required |

Phone defaults:

- one global pointer/tilt controller;
- root variable updates capped at 30 FPS by default, with explicit 15 FPS
  low-power and 60 FPS high-refresh modes;
- no per-node input listeners;
- no per-frame Solid signals for purely visual pointer movement;
- no per-frame canvas work;
- no runtime texture rebake;
- no permanent `will-change` on every metallic element;
- reflection active on the intended minority of the UI, approximately the
  product's 15% gold accent area, not the entire screen;
- reduced-motion and denied-motion fallbacks remain visually complete.

Any cost-3 operation must report estimated painted area, instance count, update
source, and fallback in the artifact diagnostics.

## 16. Editor behavior

The left tree shows semantic components and stylable parts. Selecting a part
opens:

1. its semantic identity and content binding;
2. its ordered style stack and winning property sources;
3. CSS-native Layout, Spacing, Type, Background, Border, and Overflow groups;
4. effect groups supported by that part;
5. the allocation preview: `H`, `H::before`, `U`, `C`, `H::after`, and `O`;
6. diagnostics for conflicts, fallbacks, and mobile cost.

The editor does not expose decorative helpers as normal children. A debug
inspector may reveal them read-only.

Controls are capability-filtered by semantic part. A text part may expose
metallic text but not backdrop glass. A panel may expose glass but not text-fit
unless it owns a text slot. Hidden controls retain data only when the schema
permits it; unsupported controls are validation errors, not invisible runtime
surprises.

## 17. Verification contract

The following tests are required:

1. **Registry coverage:** every visible control has one
   `AuthoringControlRule`; every source rule is surfaced or deliberately
   internal.
2. **Single-control fixtures:** each rule changes only its declared source paths
   and emitted CSS/effect operation.
3. **Dependency fixtures:** effect toggles seed defaults in one undoable
   transaction and preserve tuned values while disabled.
4. **Conflict fixtures:** every exclusive-slot pair either folds, reallocates,
   pre-bakes, approximates with a diagnostic, or rejects.
5. **DOM budget:** each styled part emits at most `H + U + C + O`; semantic
   descendants are separately justified by the component contract.
6. **State stability:** changing state never changes surface shell structure.
7. **Cascade proof:** shared styles, instance overrides, state overrides, and
   responsive overrides resolve in the documented order.
8. **Computed CSS proof:** layout, padding, gap, alignment, type, border, and
   overflow match expected browser computed values.
9. **Geometry proof:** border, bevel, wear, reflection, and helpers share the
   exact outer shape with no one-pixel ring or corner seam.
10. **Mobile visual proof:** accepted phone viewports show no overlap, clipping,
    trail, stale frame, or text overflow.
11. **Performance proof:** target-phone trace reports update rate, paint area,
    compositor layers, and frame stability for the accepted component fixture.
12. **Determinism proof:** compiling the same source twice produces identical
    CSS, class names, allocation report, diagnostics, and assets.

## 18. Migration sequence

Implementation follows this order:

1. create the machine-readable control registry and coverage test;
2. route layout, spacing, and typography through direct CSS declarations;
3. introduce the bounded `H/U/C/O` allocator and allocation report;
4. fold base, texture, tint, static gradient, border, and shadows onto `H`;
5. move glass, wear, reflection, and emission through bounded slot allocation;
6. reserve the union of slots across states;
7. adapt the locked metallic provider as one reflection operation;
8. migrate Mission Briefing V2 part by part with side-by-side visual proof;
9. delete the legacy one-span-per-effect renderer only after the migrated slice
   passes its scorecard.

The migration is complete when the editor's controls, compiled artifact,
runtime preview, and exported runtime all consume the same registry and
compiler. A visually correct preview produced by a separate legacy path does
not satisfy this contract.

## Appendix A: Current source-key migration crosswalk

This appendix names every current Material Lab surface key so migration and
coverage tests can trace it to this rulebook. It does not preserve the flat
`SurfaceOptions` object as the future source model.

| Current keys | Destination |
| --- | --- |
| `renderMode` | Compiler invocation context. No product CSS. |
| `material`, `materialColor` | Section 7 base paint. |
| `shape`, `bevelCorners`, `bevelSize`, `radius` | Section 7 host geometry. |
| `texture`, `textureStrength`, `textureScale` | Section 8 texture operation. |
| `tint`, `tintStrength` | Section 8 tint operation. |
| `gradient`, `sheen`, `lightStrength`, `darkStrength` | Section 8 static-light recipe. |
| `glass`, `glassOpacity`, `glassReflectionOpacity`, `glassBlurEnabled`, `glassBlur`, `glassShine`, `glassHighlightWidth`, `glassHighlightHeight`, `glassHighlightY` | Section 9 glass operations. |
| `borderEnabled`, `border`, `borderColor`, `borderCustomColor`, `borderLit`, `borderOpacity` | Section 10 border operation. |
| `corners`, `edgeHighlight`, `cornerSize`, `glow`, `glowStrength` | Section 10 highlight/glow operations. |
| `edgeWear`, `edgeWearTexture`, `edgeWearOpacity`, `edgeWearWidth`, `edgeWearScale`, `edgeWearLayer` | Section 10 wear operation. |
| `dropShadow`, `shadowOpacity`, `shadowBlur`, `shadowX`, `shadowY`, `shadowSpread` | Section 11 shadow operation. |
| `surfaceFilterBrightness`, `surfaceLayerBrightness` | Section 8 host/decorative brightness. |
| `textContent` | Section 6 content data. |
| `contentLayer` | Compiler allocation preference for `C` below or above glass. It may require `U`; it must not duplicate content. |
| `textFontFamily`, `textSizeRem`, `fontWeight`, `fontStyle`, `textTransform`, `letterSpacing`, `textAlign` | Section 6 typography. |
| `contentOpacity`, `contentTone`, `contentGlowStrength`, `textEmboss`, `textX`, `textY` | Section 6 text paint and placement. |
| `iconTone`, `iconGlowStrength` | Section 6 icon paint. |
| `emission`, `emissionEdge`, `emissionTone`, `emissionStrength`, `emissionLength`, `emissionThickness`, `emissionBlipSize` | Section 11 emission operation. |
| `stateScale`, `stateTranslateY` | Section 12 state transform channels. |
| `selected`, `interactive`, `hoverPreview`, `stateful`, `stateVars`, `visualState` | Editor/runtime state inputs in Section 12. `selected` and `hoverPreview` are editor-only; `interactive` comes from the semantic contract; `stateful` and `stateVars` are legacy migration data; `visualState` is preview state. |

## Appendix B: Current layout and text-key crosswalk

The current feed layout keys map as follows:

| Current keys | Destination |
| --- | --- |
| `mode`, `selfPosition` | Section 5 formatting/position mode. `mode` is a legacy preset; `selfPosition` resolves to normal `position`. |
| `slot` | Semantic component slot assignment. It does not emit visual CSS by itself. |
| `x`, `y`, `constraintH`, `constraintV` | Section 5 inset and constraint compilation. |
| `width`, `height`, `wMode`, `hMode` | Section 5 sizing. |
| `nudgeX`, `nudgeY` | Section 5 compiler transform channel. |
| `padding`, `gap` | Section 5 box spacing. |
| `align`, `crossAlign` | Section 5 `text-align` or cross-axis alignment according to the selected control. The future registry uses separate source paths so one value cannot ambiguously own both. |
| `justify`, `distribute` | Section 5 main-axis alignment. `justify` is a legacy compact value; `distribute` is the explicit destination. |
| `direction`, `reverse`, `wrap` | Section 5 flex direction and wrapping. |
| `pushToEnd` | Section 5 auto-margin preset. |

The current feed text keys map as follows:

| Current keys | Destination |
| --- | --- |
| `inherit` | Shared-style inheritance mode in Section 3. |
| `overrideColor`, `overrideOpacity`, `overrideFont`, `overrideSize`, `overrideWeight`, `overrideStyle`, `overrideCase`, `overrideEmboss`, `overrideLineHeight`, `overrideParagraphGap`, `overrideLetterSpacing`, `overrideAlign`, `overridePosition` | Legacy override flags. Future source stores an absent property for inherit and a present property for override; no parallel boolean is required. |
| `textFontFamily`, `textSizeRem`, `lineHeight`, `paragraphGap`, `fontWeight`, `fontStyle`, `textTransform`, `letterSpacing`, `textAlign` | Section 6 typography. |
| `contentTone`, `textOpacity` | Section 6 text color and alpha. |
| `textEmbossMode`, `textEmbossStrength`, `textEmbossOffset`, `textEmbossBlur` | Section 6 compiled `text-shadow` recipe. |
| `textX`, `textY` | Section 6 content placement through the single transform owner. |
| `textRender` | Legacy derived value. Future source keeps `markup` and `sizing` independent. |
| `markup`, `sizing`, `fitMode`, `maxLines` | Section 6 parser, flow/fit, and line-limit controls. |

## Appendix C: Paint operation crosswalk

The current semantic Paint IR operations remain typed effect inputs:

| Paint type | Rulebook destination |
| --- | --- |
| `fill` | Section 7 host base/background. |
| `backdropGlass` | Section 9 host or `U`. |
| `texture` | Section 8 host background stack. |
| `edgeWear` | Section 10 `H::after` or `O`. |
| `border` | Section 10 host border or allocated pseudo. |
| `reflection` | Section 8 static reflection or Section 13 moving reflection. |
| `shadow` | Section 11 host shadow list. |
| `glow` | Sections 10 and 11 compiled shadow/gradient list. |
| `maskImage` | Section 14 allocated mask slot. |
| `cornerBrackets` | Section 10 highlight geometry or a compiled background asset. |
| `scanLine` | Section 14 `H::after` or `O`. |
