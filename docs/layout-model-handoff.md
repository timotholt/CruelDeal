# Continue: Unified Layout Model (Figma auto-layout) for CruelDeal material editor

You are finishing a multi-stage refactor. Read the spec first:
  docs/unified-layout-model-spec.md   (decisions locked in §13, constraints in §14)

Everything lives in ONE file unless noted:
  components/screens/MainMaterialPreviewScreen.tsx   (~12k lines, SolidJS)
  src/styles/main-material-preview.css
  components/ui/ScaleToFit.tsx        (box-fit scaler, done)
  components/ui/GameTextV2.tsx        (glyph-fit, done)
  components/ui/material-node/MaterialTextContent.tsx  (render-mode switch)

## GOAL
Make every node a Flexbox/Figma auto-layout box driven by data. One primitive; row vs
column is a param (menus = row, cards = column). Replaces the old absolute-box model.

## ALREADY DONE — Stages A, B, C (don't redo)

Data model on `FeedNodeLayout` (interface ~line 255) — legacy fields stay; these added optional:
  direction, reverse, wrap, distribute, crossAlign, wMode, hMode, selfPosition, pushToEnd, constraintH, constraintV
Types defined ~line 173 (FeedNodeDirection/Distribute/CrossAlign/SizeMode/SelfPosition/ConstraintH/ConstraintV).

Resolvers (~just above `feedNodeLayoutCss`): resolveLayout{Direction,Distribute,CrossAlign,WMode,HMode,SelfPosition,PushToEnd}.
Each returns the explicit field if set, else DERIVES legacy behavior so old data compiles byte-identical.
Mappings: distributeToJustifyContent, crossAlignToAlignItems.

`feedNodeLayoutCss` (compiler) routes through resolvers: emits position(in-flow→relative/absolute),
flex-direction, flex-wrap, width/height (fixed→%, hug→max-content/auto, fill→auto if in-flow else 100%),
margin-top/left:auto (pushToEnd, axis-aware), justify-content, align-items, gap, text-align.

`FeedNodeFrame` (~line 11845) emits data-attrs: data-w-mode, data-h-mode, data-self-pos, data-direction, data-wrap.

Sanitizer `sanitizeFeedNodeLayout` (~line 10028) validates all new fields (optional → fallback).
createFeedNodeLayout leaves new fields undefined (derive). cloneFeedCardNode spreads layout (carries them).

CSS (main-material-preview.css):
- Hug: `[data-h-mode="hug"]`/`[data-w-mode="hug"]` make flow-stack position:relative+overflow:visible (drives box size), surface position:absolute (background).
- Direction: `[data-direction="row"] > .flow-stack { flex-direction:row }`, `[data-wrap="true"]` → wrap.
- Fill: direction-aware grow/stretch on `.flow-stack > [data-h-mode="fill"]` / `[data-w-mode="fill"]`.
- flow-text flex scoped by render mode: `[data-material-text-render="fit"|"rich-fit"] { flex:1 1 0 }` (fill, fitter needs definite height), else `flex:0 1 auto` (natural, justify can position).

Editor UI (controls panel, ~line 10855 "Layout" section): added Direction (column/row)+wrap row;
W and H each now `fixed|hug|fill` MiniButton toggles + a "W size"/"H size" Slider disabled unless fixed.
Also earlier: Markup (auto/on/off) + Render (auto/fit/flow) axis toggles (~10565), Justify labels are top/center/bottom.

Render axes (orthogonal, done): `node.markup` (auto/on/off) + `node.sizing` (auto/fit/flow) →
`resolveFeedNodeRenderMode` → 'raw'|'rich'|'fit'|'rich-fit'. rich-fit = ScaleToFit(box-fit) for cooked+fit.
`feedTextCss` sets `text-align:'inherit'` so the layout ALIGN drives flow text (one align source).

## REMAINING — do these

### Stage D — self / constraints (Figma pin model)
- Wire `selfPosition: 'absolute'` children to Figma constraints (§14): constraintH (left|right|left-right|center|scale), constraintV (top|bottom|top-bottom|center|scale). Compile in feedNodeLayoutCss to absolute left/right/top/bottom/width.
- Fold legacy `slot`: footer → pushToEnd (already derived), overlay → selfPosition absolute (already derived).
- Add editor controls: Self position (in-flow/absolute), Pin (constraint grid or two selects H/V), Pin-to-end toggle.
- The old CSS rule `[data-feed-layout-slot="footer"]{margin-top:auto}` is now redundant with pushToEnd inline margin — verify no double effect; remove the CSS rule if so.

### Stage E — rebuild bespoke bars on the new primitive (no need to preserve old settings)
Throw away the hand-written grid/flex for: top bar, currency row, nav, toolbar. Re-author each as a
row-stack container node (direction:row, gap, distribute, sized children). They currently are bespoke
CSS classes (.main-material-topbar grid, .main-material-button-bar grid, .main-material-currencies, nav).
Build them as new FeedCardNode trees (or equivalent) using mode:flow/stack + direction:row + child sizing.
Delete the dead bespoke CSS after. Verify each bar visually matches/improves.

### Stage F — editor polish (Figma alignment UI)
- Replace ALIGN(left/center/right)+JUSTIFY(top/center/bottom) with axis-relative Figma controls:
  a 3×3 alignment grid (cross × main packed positions) + a distribute mode (packed vs space-between/around/evenly).
  Data already supports: layout.distribute (start/center/end/between/around/evenly), layout.crossAlign (start/center/end/stretch).
  Arrows/grid orientation should follow layout.direction.
- Grey W/H sliders already done; extend greying/disabled logic to invalid combos (e.g. fit when axis is hug — see spec §7).
- Add min/max size inputs (spec §6) if time.

## CONVENTIONS / GOTCHAS (learned the hard way)
- Back-compat is sacred: legacy nodes (no new fields) MUST render identical. Always derive in resolvers.
- updateSelectedNodeLayout(key, value) is the editor setter; keys are keyof FeedNodeLayout.
- MiniButton, For, Show, Slider(has `disabled`), SectionLabel are the UI primitives in use.
- HUG needs content in-flow to size the box; surface must be the absolute background layer. Text-LEAF nodes
  (text nested INSIDE the surface, no flow-stack sibling) are NOT yet covered by hug CSS — add the surface-content
  in-flow path if a leaf needs hug. Container nodes (flow-stack sibling) work.
- FIT modes need the text element to FILL (flex:1) for definite height (ScaleToFit/GameTextV2 measure it);
  FLOW modes want natural height (flex:0) so justify can position. This is why flow-text flex is scoped by
  data-material-text-render. Don't globally set flex:0 — it blanks fit (regression we already hit & fixed).
- Pre-existing typecheck errors (unrelated): FeedCardTypeRecipe, MaterialPanelProps, FeedNodeLayout-literal
  "missing mode/slot/nudgeX/nudgeY" at various createFeedNodeLayout/object call sites, Seat, CardBadge. Ignore them;
  just ensure YOUR changes add no NEW errors: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep MainMaterial`.
- Lint is strict (--max-warnings 0); no unused vars (type `const x: T[] = []` not `[]`).

## HOW TO VERIFY (the app)
- Dev server: `npm run dev` (vite, port 3000). Route: http://localhost:3000/main-material.
- It's a browser preview editor. Left = node tree (click "X child material" to select). Right = controls panel.
- Editor state persists in localStorage keys: "cruel-deal.main-material-preview.v23" and ".material-presets.v1".
  Clear them + reload to reset to defaults.
- Drive/inspect via DOM: select a node by clicking its tree button; controls are .ui-lab-control-row (find by
  the <span> label); toggles are buttons inside; sliders are input[type=range] (set .value via the native
  setter + dispatch 'input' event). Selected node renders in the phone; nodes are .main-material-card-node
  (data-direction/data-w-mode/etc), content in .main-material-card-node-flow-stack.
- Verify by measuring getBoundingClientRect, computed styles, and data-* attrs — numbers beat screenshots.

## STYLE
- Match existing code style. Keep changes scoped + back-compat. Verify each stage in the running app before moving on.
- Commit per stage if asked; otherwise leave working tree for review.
