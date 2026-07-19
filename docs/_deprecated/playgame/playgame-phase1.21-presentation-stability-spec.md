# Phase 1.21 — Deterministic 9:16 Play Surface

## Status

Deprecated / implemented and exit-proven on 2026-07-18. Retained as historical
layout-contract evidence; it is no longer an active implementation plan.

Phase 1.21 is a presentation-architecture phase after Phase 1.2. It does not
change match rules, engine authority, lane identity, location lifecycle, or
replay semantics.

## Executive Decision

The `/play` surface will be rebuilt around one immutable spatial contract:

1. The complete required game UI always occupies an exact 9:16 frame.
2. That frame contains three fixed regions: opponent header, board stage, and
   local-player footer.
3. Each active lane is one persistent vertical DOM object containing its map,
   opponent slots, location card, and local-player slots.
4. Temporary animation nodes live in a dedicated absolute VFX layer and never
   participate in layout.
5. Pointer-based drag-and-drop is a hard requirement on mouse, pen, and touch.

This is not a visual redesign. It is a layout-ownership and interaction
stability redesign intended to prevent gameplay state and animation from
moving unrelated parts of the board.

## Product Goal

Playing, drawing, revealing, moving, destroying, or animating a card must not
move the header, footer, board stage, location row, or lane slot geometry.

The only ordinary structural movement permitted during a match is:

- cards moving within or between already allocated slots and zones
- hand cards closing or opening horizontal space inside the fixed hand region
- active lanes sliding horizontally when lane topology changes
- intentional presentation overlays and VFX

No game action may change the vertical partition of the 9:16 frame.

## Core Problem

The current play surface has multiple layout authorities:

- `AppViewport` creates the canonical 9:16 center frame.
- playgame CSS independently defines `--board-w` and `--board-h`.
- `BoardSizer` measures the app frame and writes another board size to `:root`.
- `PlayBoard` renders opponent slots, locations, and player slots as three
  separate sibling grids that must remain synchronized.
- `useLaneMaps` measures those grids and imperatively creates a fourth,
  absolutely positioned representation of each lane.
- hand and board space are negotiated by flex growth and an auto margin.
- temporary animation wrappers can inherit persistent grid/flex classes.

The visible shifts are not independent CSS mistakes. They are the recurring
result of persistent layout, measured overlays, responsive sizing, and
animation sharing ownership of the same geometry.

The fix is to represent the product structure directly in the DOM: one
canonical frame, three fixed regions, one vertical object per lane, and one
non-layout layer for all temporary motion.

## Hard Requirements

Phase 1.21 cannot close unless all of these are true:

1. The required game surface is exactly 9:16 on every device and window shape.
2. A 9:21 phone, foldable, tablet, desktop window, or landscape display never
   stretches the game surface away from 9:16.
3. Space outside the 9:16 frame is letterbox/exterior-shell space. Required
   controls never move into it.
4. The opponent header, board stage, and player footer own fixed shares of the
   9:16 frame and cannot grow from their contents.
5. The player footer always contains two rows: the hand and the action row.
6. Every active lane owns one opponent 2x2 slot grid, one location card area,
   and one local-player 2x2 slot grid.
7. One, two, and three active lanes have identical vertical geometry.
8. Changing active-lane count changes lane horizontal positions only.
9. Drag-and-drop works with mouse, trackpad, pen, and touch.
10. Dragging a hand card to a lane and dragging an undoable staged card back to
    the hand remain supported.
11. Dragging never directly mutates engine state. It submits the existing
    governed play/undo command and reacts to the accepted or rejected result.
12. Animations cannot become flex or grid children of the persistent layout.
13. Map visibility, location reveal, card reveal, and card flight cannot
    change persistent layout geometry.
14. Replay inspection cannot use a different board structure from live play.
15. Existing card-deal, hand-scale, hand-shift, card-play, undo, transfer, and
    reveal choreography remains behaviorally equivalent through the migration.
16. `deriveCardTransfers` remains the canonical event-to-animation
    normalization seam.
17. Existing card and zone anchor keys remain stable across the DOM migration.
18. No checkpoint changes persistent layout ownership and rewrites animation
    behavior in the same unproved step.

## Exact 9:16 Frame Contract

### One sizing authority

`AppViewport` is the sole owner of the canonical game-frame dimensions.
Playgame components fill that frame with `width: 100%` and `height: 100%`.

Phase 1.21 removes playgame-owned writes to global `--board-w` and
`--board-h`. `BoardSizer` must not independently recompute a second 9:16
rectangle.

The canonical size is conceptually:

```text
available width  = safe visual viewport width
available height = safe visual viewport height

frame width  = min(
  available width,
  available height * 9 / 16,
  optional desktop maximum
)
frame height = frame width * 16 / 9
```

The optional desktop maximum may make the frame smaller, but it may never
alter the aspect ratio.

### Tall-phone behavior

On a 9:21 phone, the frame fills the available width and consumes exactly
16/21 of the available height. The remaining 5/21 is exterior space split
above and below the centered game frame, subject to safe-area positioning.

The implementation must not:

- stretch the frame to 9:21
- distribute the extra height into the board stage
- increase the footer or header because more device height exists
- anchor required controls outside the 9:16 frame

### Wide and landscape behavior

When height is limiting, the frame fills the available height and is
horizontally letterboxed. Desktop side rails may use that exterior space, but
the complete match remains playable when both rails are absent.

### Safe areas

The exterior app shell owns `env(safe-area-inset-*)`. It places the canonical
9:16 frame inside the safe visual rectangle. Internal playgame components do
not independently add safe-area padding because doing so would create another
frame-size authority.

### Responsive behavior

The game frame remains the container-query root. Internal components respond
to the frame's dimensions, not `window.innerWidth`, `100vw`, or browser-width
media queries.

## Fixed Three-Region Shell

The persistent frame uses a three-row grid:

```text
9:16 game frame
├─ opponent header
├─ board stage
└─ player footer
   ├─ hand
   └─ action row
```

Initial allocation:

```css
.play-frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows:
    minmax(0, 8fr)
    minmax(0, 71fr)
    minmax(0, 21fr);
}
```

The exact 8/71/21 calibration may be adjusted during Checkpoint 1, but it must
sum to the whole frame and becomes frozen when that checkpoint closes.

Every region requires `min-width: 0` and `min-height: 0`. Content min-size must
never enlarge a region.

### Header

The header owns opponent identity, opponent hand/deck/energy status, priority,
turn number, and allowed debug/replay access.

Header contents may scale, truncate, or compact within the header. They may not
increase header height.

### Board stage

The board stage owns only persistent lanes and stage-local presentation
overlays. It consumes the exact remainder between header and footer.

The board stage does not use content-height flex distribution. Lane cards,
location text, maps, and animations cannot affect stage height.

### Player footer

The footer is itself a fixed two-row grid:

```css
.player-footer {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
}
```

The first row owns the hand. The second owns retreat, energy/undo, and end
turn. Hand count, card hover, reservation, drag, and draw animation cannot
change footer height.

## Lane-Oriented DOM

### Required structure

The current transposed structure of three independent lane rows is replaced by
one keyed `LaneColumn` per active lane:

```text
.board-stage
└─ .lane-track
   ├─ .lane-column[data-lane]
   │  ├─ .lane-map
   │  ├─ .lane-slots.top
   │  │  └─ four stable .slot nodes
   │  ├─ .location
   │  └─ .lane-slots.bot[data-drop-zone="lane"]
   │     └─ four stable .slot nodes
   ├─ .lane-column[data-lane]
   └─ .lane-column[data-lane]
```

`LaneColumn` is keyed by stable `LaneId`, never by current array index.

### Lane track

The lane track is a fixed positioning surface. Each keyed lane receives a
canonical center derived from its ordinal in `activeLaneOrder`:

```css
.lane-track {
  position: absolute;
  inset: 0;
}

.lane-column {
  position: absolute;
  left: calc(var(--lane-center) - (var(--canonical-lane-width) / 2));
  inline-size: var(--canonical-lane-width);
  block-size: 100%;
}
```

`--lane-center` is emitted as a percentage rather than relying on CSS division.
The lane column keeps the canonical three-lane width:

- one lane: centered at 50%
- two lanes: centered at 25% and 75%
- three lanes: centered at 1/6, 1/2, and 5/6

After topology adoption, surviving keyed lanes FLIP from their old `x` to this
new canonical `left` using the independent CSS `translate` property. The
canonical `left`, width, and height are not animated. This makes topology
changes slide lanes without resizing cards or lanes.

### Lane column

Every lane column fills the board-stage height and owns the same vertical
template:

```css
.lane-column {
  position: absolute;
  inline-size: var(--canonical-lane-width);
  block-size: 100%;
  display: grid;
  grid-template-rows:
    minmax(0, 1fr)
    var(--location-height)
    minmax(0, 1fr);
}
```

The opponent and player play areas each contain an invariant 2x2 grid. Their
four slot nodes remain mounted even when empty.

Cards do not size slots. Slot geometry is established before cards render.
Cards are positioned inside slots and may visually overflow only where the
design explicitly permits it.

### Location and map

The location tile and lane map belong to the same `LaneColumn`.

The map is a persistent background layer:

```css
.lane-map {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
```

Location reveal changes a class or data attribute controlling opacity. It
does not create, remove, measure, prepend, or reposition the map node.

`useLaneMaps` and its base-layout `ResizeObserver` become unnecessary and are
deleted after the lane-column migration.

### Topology changes

`activeLaneOrder` remains authoritative for current left-to-right order.

When a lane is added, removed, or reordered:

1. Capture stable lane-column rectangles.
2. Adopt the new active-lane order.
3. Animate surviving lanes horizontally with FLIP transforms.
4. Animate entering/exiting lane visuals in the VFX layer or a
   presentation-retained shell.
5. Clear transforms at the canonical destination.

Topology animation may change lane `x`; it may not change lane `y`, width,
height, slot geometry, header, footer, or board-stage geometry.

## Layout Ownership Rules

Persistent layout must follow these rules:

1. No generic selector such as `.board > *` may assign positioning to
   unrelated board children.
2. Every structural component owns its own `display`, `position`, sizing, and
   overflow contract.
3. Base layout must not depend on `getBoundingClientRect()`.
4. Base layout must not append imperative DOM nodes.
5. Base layout must not require `ResizeObserver` except at the outer app-frame
   boundary or for canvas backing-store resolution.
6. Persistent custom properties are scoped to the play frame, not `:root`.
7. Layout transitions must not animate `width`, `height`, `flex-basis`,
   margins, grid tracks, or padding during ordinary gameplay.
8. Ordinary movement uses `transform` and `opacity`.
9. Hand sibling rearrangement uses a fixed-height track plus transform-based
   FLIP. It cannot transfer space to or from the board stage.
10. Location descriptions truncate or scale within their fixed tile; text
    cannot enlarge the location row.

## Dedicated VFX Layer

The play frame owns one explicit VFX layer:

```text
.play-frame
├─ .opponent-header
├─ .board-stage
├─ .player-footer
└─ .play-vfx-layer
```

```css
.play-vfx-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: var(--z-vfx);
}
```

All temporary objects are created through a VFX-layer API:

- reveal flyers
- zone-transfer cards
- destroyed/banished cards
- drag ghosts
- lane-entry and lane-exit clones
- particles and transient highlights

Temporary objects must not inherit structural classes such as `.lane-slots`,
`.hand`, `.row`, or `.lane-column`.

Every temporary object is absolutely positioned, has
`pointer-events: none`, and is removed on success, cancellation, timeout, or
screen disposal.

## Animation Preservation Contract

Phase 1.21 protects animation behavior while replacing layout ownership.
Existing animation code is not rewritten as part of the lane-DOM migration
unless a characterization test proves the old behavior and a parity test
proves its replacement.

### Protected semantic contracts

The following contracts remain authoritative:

- `deriveCardTransfers(before, event, after)` and its event-to-zone mappings
- `CardTransfer` route, face, timing, duration, easing, scale, and opacity
- `cardRefs` keyed by card instance ID
- `zoneRefs` keyed by logical zone and stable `LaneId`
- hand reservation sequencing and timeout cleanup
- FLIP capture-before/adopt/slide-after ordering
- reveal order and designer-authored pacing
- resting rotation composed exactly once
- runtime-backed stage and undo commands

Phase 1.21 may change how an anchor rectangle is obtained and where a temporary
node is mounted. It may not silently change what animation a committed event
means.

### Motion-surface boundary

Animation modules depend on one presentation adapter rather than the board DOM
shape:

```ts
interface PlayMotionSurface {
  readonly frame: HTMLElement;
  readonly overlay: HTMLElement;

  cardRect(cardId: CardId): DOMRect | null;
  zoneRect(zone: CardZoneRef): DOMRect;
  toOverlayRect(viewportRect: DOMRect): DOMRect;

  mountTemporary(node: HTMLElement): () => void;
}
```

The adapter owns:

- viewport-to-frame coordinate conversion
- registered card and zone anchor lookup
- the dedicated VFX mount point
- cleanup of temporary nodes

Dealing, transfer, reveal, and shifting code must not query lane-row structure
or append directly into the persistent board.

The adapter is introduced and proven against the current DOM before
`LaneColumn` changes the DOM. After that point, lane transposition changes
anchor registration only.

### Transform ownership

Card motion uses distinct nested transform owners:

```text
.card-motion-shell       FLIP translate and drag/source positioning
└─ .card-resting-shell   canonical lane resting rotation
   └─ .card-visual       scale, hover, reveal, and card-local VFX
```

One node must not own two competing transform responsibilities.

This preserves the existing useful composition in which hand wrappers shift
while inner cards scale. The same ownership becomes explicit for lane cards,
transfer flyers, and reveal flyers.

During initial migration, existing card-size tokens, hand-scale thresholds,
durations, easings, and resting-angle values remain unchanged. Visual
retuning is a later phase and cannot be bundled into Phase 1.21.

### Animation endpoint contract

An animation starts from and lands on stable registered anchors.

For a card landing in a tilted slot:

- the source/destination anchor is the untransformed card layout box
- the resting angle is composed exactly once
- the final flyer center, dimensions, and angle match the real card
- the real card and flyer may overlap for one committed paint before flyer
  removal

Animation failure or cancellation reveals the canonical real element and
cleans up the flyer. It cannot change match state or persistent layout.

## Pointer Drag-and-Drop Contract

### Hard requirement

Drag-and-drop is part of Phase 1.21, not a follow-up. Phase 1.21 cannot close
with desktop-only or mouse-only interaction.

The canonical implementation uses Pointer Events rather than native HTML5
drag events. One implementation must support:

- mouse
- trackpad
- pen
- single-touch dragging

Native `draggable`, `dragstart`, `dragover`, and `drop` are removed after the
pointer controller is proven. Maintaining independent desktop and mobile drag
implementations is not permitted.

### Stable interaction anchors

Every draggable card exposes:

```html
data-card-id="..."
data-drag-source="hand"
```

or, for a staged undo:

```html
data-card-id="..."
data-drag-source="lane"
data-undoable="true"
```

Every lane destination exposes:

```html
data-drop-zone="lane"
data-lane-id="..."
```

The local hand destination exposes:

```html
data-drop-zone="hand"
```

The controller resolves stable `LaneId` values from data attributes. It never
interprets DOM ordinal position as lane identity.

### Gesture state machine

```text
IDLE
  └─ pointerdown
      PRESSED
        ├─ pointerup before threshold -> tap/inspect
        ├─ movement beyond threshold -> DRAGGING
        └─ cancellation -> IDLE

DRAGGING
  ├─ pointermove -> update ghost and candidate target
  ├─ pointerup on valid target -> COMMITTING
  ├─ pointerup elsewhere -> RETURNING
  └─ cancellation -> RETURNING

COMMITTING
  ├─ command accepted -> animate/adopt canonical destination -> IDLE
  └─ command rejected -> RETURNING

RETURNING
  └─ animate ghost to source; restore source -> IDLE
```

The movement threshold distinguishes tap-to-inspect from drag. It is defined
in frame-relative or CSS-pixel terms and tested at narrow-phone dimensions.

### Pointer lifecycle

On `pointerdown`:

1. Verify the card is currently interactive.
2. Record `pointerId`, card ID, logical source, source anchor, and current
   presentation generation.
3. Call `setPointerCapture(pointerId)`.
4. Do not mutate game state.

On transition to `DRAGGING`:

1. Create a drag ghost in `.play-vfx-layer`.
2. Keep the source's allocated layout space.
3. Dim or hide only the source artwork.
4. Mark the play frame as dragging for visual feedback.

On `pointermove`:

1. Move only the ghost with `transform`.
2. Hit-test persistent drop-zone elements using the pointer's frame-relative
   coordinates.
3. Resolve the candidate by stable lane ID.
4. Show valid, invalid, full, or unavailable feedback without committing.

On `pointerup`:

- Hand to lane submits `stageCardInLane(cardId, laneId)`.
- Undoable lane card to hand submits `undoPendingCard(cardId)`.
- The engine/runtime command result decides acceptance.
- Rejection returns the ghost to its source and leaves canonical state intact.

### Drag-to-transfer handoff

An accepted pointer drop must not create a visible second play animation.

For hand-to-lane play:

1. The real hand card retains its allocated hand space during pointer drag.
2. The pointer ghost follows the pointer in the VFX layer.
3. On accepted drop, that same ghost becomes the prepared visual source for
   the canonical hand-to-lane transfer.
4. The runtime-backed stage command adopts the real card into the lane.
5. The existing transfer timing lands the prepared ghost on the registered
   lane slot.
6. Visibility hands off to the real lane card at the canonical endpoint.
7. Existing FLIP behavior shifts surviving hand cards within the fixed footer.

The pointer ghost must not disappear and then be replaced by a second flyer.
The stage event must not replay a second hand-to-lane flight during turn
resolution for a local card that was already presented during planning.

Rejected or cancelled drops use the same ghost to return to the source
anchor, then restore source visibility.

### Touch and coordinate behavior

Draggable card surfaces use `touch-action: none` and suppress native image/text
dragging only on those surfaces. The rest of the game frame does not receive a
blanket touch-action override.

Pointer coordinates are always interpreted in client space and converted
relative to the current 9:16 frame rectangle. The controller must not assume
that the frame begins at viewport `(0, 0)`: on a 9:21 phone it is vertically
letterboxed, and on a landscape or desktop viewport it is horizontally
letterboxed.

Moving into exterior letterbox or rail space produces no lane target. Browser
zoom, device-pixel ratio, and safe-area placement must not offset the drag
ghost or change which lane is hit.

Pointermove samples are coalesced through one animation-frame update. A drag
does not synchronously perform layout reads and writes for every raw pointer
event.

### Cancellation

The drag session must cleanly cancel on:

- `pointercancel`
- lost pointer capture
- window or document visibility loss
- component unmount
- match/session replacement
- presentation-generation change
- resolution lock beginning
- source card becoming invalid
- candidate lane being destroyed or becoming unavailable
- a second pointer attempting to take ownership

Cancellation removes highlights and ghosts, restores source visibility, and
never leaves module-global card identity behind.

### Topology during drag

Lane topology may change because of already committed presentation while a
pointer is active. The controller must either:

- cancel before adopting the topology frame, or
- invalidate cached targets, relayout, and continue only if the source and
  target remain legal

It may not drop using a stale lane rectangle or silently reinterpret a lane
index.

### Accessibility

Tap-to-inspect remains distinct from drag. Existing click/keyboard play
alternatives may remain, but they do not replace the drag-and-drop requirement.
Focus, disabled state, and accessible lane labels must survive the DOM
migration.

## Engine and Runtime Boundary

Phase 1.21 is presentation-only.

It consumes:

- projected match state
- stable card IDs and lane IDs
- existing runtime-backed stage and undo commands
- committed presentation transitions
- registered card and zone anchors

It must not:

- add a second game-state store
- mutate cards or lanes directly
- infer legality as authority
- dispatch reducer events from CSS or animation callbacks
- change event order, frames, replay, AI, or location rules

The UI may precompute visual eligibility, but the runtime command remains the
authority for acceptance.

## Reactivity and DOM Stability

The following nodes remain mounted and keyed whenever their logical entity
exists:

- play frame
- three major frame regions
- active lane columns
- each lane's two 2x2 slot grids
- all four slots in each grid
- each lane's location tile
- each lane's map background
- hand region and action row
- VFX layer

Reactive state updates content and data attributes. It does not replace the
layout skeleton.

Imperative presentation code receives registered anchors but does not own
persistent DOM creation.

## Migration Plan

### Checkpoint 0 — Animation characterization and motion adapter

Build:

- create deterministic fixtures for existing deal, scale, hand-shift, play,
  undo, move, reveal, destroy, discard, banish, return, and generated-card
  animations
- record protected durations, easings, face states, scale thresholds,
  resting angles, source/destination anchors, and sequencing
- introduce `PlayMotionSurface` beneath existing animation call sites while
  retaining the current board DOM
- route existing temporary animation mounts through the adapter without
  changing their visible choreography
- add transform-ownership assertions for motion, resting rotation, and visual
  scale layers

Proof:

- all existing transfer-normalization and choreography tests remain green
- current and adapter-backed animation paths produce equivalent contracts
- deterministic browser recordings show no endpoint, timing, scale, or
  sequencing regression
- the current DOM can run entirely through `PlayMotionSurface` before any
  `LaneColumn` work begins

Stop rule:

- Checkpoint 1 may not start until the adapter-backed current DOM passes the
  animation-preservation matrix.

### Checkpoint 1 — Frame authority and fixed regions

Build:

- make `AppViewport` the only exact-9:16 owner
- make `/play` fill the frame
- introduce fixed header/stage/footer grid
- isolate hand and action row inside the footer
- replace toast position measurement with a stage-relative CSS anchor
- remove `BoardSizer` sizing writes

Proof:

- exact 9:16 frame on 9:21, common phone, tablet, desktop, and landscape sizes
- invariant header/stage/footer rectangles across hand counts and turn state
- no required control outside the frame
- Checkpoint 0 animation contracts remain green without recalibration

### Checkpoint 2 — Persistent lane columns

Build:

- create keyed `LaneColumn`
- transpose enemy/location/player rows into each lane
- preserve stable zone and card refs
- embed map background in each lane
- implement one/two/three-lane horizontal placement
- implement horizontal topology FLIP
- delete `useLaneMaps` and synchronized row layout

Proof:

- lane vertical geometry is identical at one, two, and three active lanes
- location reveal changes opacity without changing any persistent rectangle
- lane destruction/addition changes only active lane horizontal positions
- replay and live state render the same lane order
- animation modules require no knowledge of lane-column DOM structure
- Checkpoint 0 animation contracts remain green without recalibration

### Checkpoint 3 — Pointer drag-and-drop

Build:

- introduce the pointer drag-session controller
- retain source layout space during drag
- create drag ghosts only in VFX layer
- support hand-to-lane stage and lane-to-hand undo
- handle cancellation, rejection, and topology invalidation
- remove native HTML5 drag implementation

Proof:

- complete pointer/device/topology matrix is green
- rejected and cancelled drags leave state and DOM clean
- drag never changes header, stage, footer, lane, or slot rectangles
- accepted local play uses one continuous pointer-ghost-to-transfer motion
- card-play, hand-shift, and undo preservation contracts remain green

### Checkpoint 4 — Animation isolation and deletion

Build:

- route all temporary card/lane objects through VFX layer
- make reveal/transfer endpoints use stable anchor geometry
- remove structural-class inheritance from flyers
- delete obsolete flex rows, catch-all selectors, sizing variables, and
  imperative layout paths
- add architecture fences

Proof:

- reveal and transfer landing deltas are within tolerance
- animation cancellation cannot strand hidden real cards
- Checkpoint 0 animation contracts remain green through the final VFX layer
- production build, lint, runtime, replay, presentation, and browser gates pass

## Verification Matrix

### Frame sizes

At minimum, browser proofs cover:

| Class | Example viewport | Expected behavior |
| --- | --- | --- |
| Tall 9:21 phone | 390x910 | Exact 9:16 frame, vertical exterior space |
| Typical tall phone | 390x844 | Exact 9:16 frame, vertical exterior space |
| Narrow phone | 320x568 | Exact 9:16 frame, compact container-query styling |
| Tablet portrait | 768x1024 | Exact 9:16 frame, exterior space |
| Desktop | 1440x900 | Exact 9:16 frame, horizontal rails/letterbox |
| Landscape phone | 844x390 | Exact 9:16 frame, horizontal exterior space |

For every case:

```text
abs(frame.height - frame.width * 16 / 9) <= 1 CSS pixel
frame is fully contained by the safe visual viewport
```

### Geometry invariants

Capture rectangles before and after each operation:

- stage a card
- undo a staged card
- draw one card
- draw multiple cards
- reveal a card
- reveal a location
- increase/decrease displayed power
- resolve a turn
- open/close an inspector
- switch replay cursor
- destroy a lane
- add a lane
- reorder lanes

For ordinary non-topology operations, these rectangles must remain within
0.5 CSS pixels:

- game frame
- header
- board stage
- footer
- hand region
- action row
- every lane column
- every slot
- every location tile

For topology operations:

- frame/header/stage/footer remain within 0.5 CSS pixels
- surviving lane `y`, width, and height remain within 0.5 CSS pixels
- only intended lane `x` changes

### Drag-and-drop matrix

Every required case runs with mouse and emulated touch:

- play into lane 1, 2, and 3
- play with one, two, and three active lanes
- play into each of four progressive slot positions
- reject insufficient energy
- reject full lane
- reject unavailable/destroyed lane
- cancel outside the board
- cancel through `pointercancel`
- cancel when resolution begins
- cancel when topology invalidates the target
- undo a pending card back to hand
- tap without threshold movement opens inspection rather than dragging
- rapid repeated pointer input creates at most one drag session

After every case:

- canonical state matches command outcome
- no drag ghost remains
- no source card remains hidden
- no stale drop highlight remains
- no pointer capture remains
- no layout region moved unexpectedly

### Animation preservation matrix

Checkpoint 0 establishes deterministic fixtures for:

- opening deal in committed order
- ordinary draws into hands containing zero through seven cards
- every existing hand-count scaling threshold
- hand sibling shifting after draw, stage, undo, discard, and return
- local card play from every hand position into every lane and progressive
  slot position
- pending-card undo from every lane back to the hand
- remote face-down play
- reveal at every resting angle used by board cards
- lane-to-lane movement
- visible-to-destroyed, discarded, and banished transfer
- destroyed/discarded/banished return to hand or lane
- generated card to hand and generated card to lane
- animation cancellation, timeout, and screen disposal

Each fixture records and asserts:

- semantic `CardTransfer` route
- face state
- duration and easing
- scale and opacity endpoints
- source and destination logical zones
- source and destination anchor centers and dimensions
- resting rotation
- hand reservation and sibling-shift ordering
- temporary-node cleanup and real-card visibility restoration

Browser-level preservation accepts normal subpixel rendering variance but does
not permit silent choreography drift. Timing, easing, scale thresholds, or
sequencing may change only through an explicit later visual-design decision,
not as a side effect of Phase 1.21 layout work.

At the close of every checkpoint, the full preservation matrix reruns. A
checkpoint cannot merge by updating expected fixtures to match an unexplained
new behavior.

### Animation endpoint matrix

Card reveal and transfer tests cover every resting tilt used by board cards.
At the final flight frame:

```text
abs(flyer.centerX - card.centerX) <= 0.5px
abs(flyer.centerY - card.centerY) <= 0.5px
abs(flyer.layoutWidth - card.layoutWidth) <= 0.5px
abs(flyer.layoutHeight - card.layoutHeight) <= 0.5px
resting rotation is composed exactly once
```

## Architecture Fences

Automated fences must fail if:

1. Playgame code writes global `--board-w` or `--board-h`.
2. Persistent lane maps are created with `document.createElement`.
3. Base board-layout modules use `getBoundingClientRect()` or
   `ResizeObserver`.
4. A temporary flyer receives a persistent structural layout class.
5. Temporary animation code appends directly into the persistent board rather
   than the VFX layer.
6. Native HTML5 drag handlers return after the pointer migration closes.
7. A drop target exposes only a positional index instead of stable `LaneId`.
8. Layout-affecting CSS transitions are added to header, board stage, footer,
   lane columns, slot grids, or location tiles.
9. Required play controls render into desktop rails or exterior letterbox
   space.
10. A playgame component sizes itself from browser viewport units instead of
    the canonical game-frame container.
11. Animation code queries lane-row or lane-column DOM structure instead of
    registered motion anchors.
12. A layout checkpoint changes protected transfer timing, easing, scale,
    face, or sequencing fixtures without an explicit approved visual change.
13. Motion, resting rotation, and visual scale are assigned to the same
    transform owner.
14. An accepted pointer drop discards its ghost and starts a visibly separate
    second hand-to-lane flyer.
15. A locally presented staged card replays its hand-to-lane flight during
    resolution adoption.

## Performance Requirements

- Pointer movement updates at most one transform and bounded target feedback
  per animation frame.
- Pointermove does not write reactive game state.
- Base layout performs no per-frame DOM measurement.
- Lane-map reveal is compositor-friendly opacity work.
- Card and lane movement uses transform/opacity whenever possible.
- VFX cleanup is bounded on success, cancellation, timeout, and unmount.
- No implementation may trade layout stability for a permanent
  `will-change` allocation on every board element.

## Non-Goals

Phase 1.21 does not:

- redesign card art, card text, or game visual identity
- change card or location mechanics
- change the maximum number of active lanes
- change lane destruction or creation semantics
- change match bootstrap, frames, replay, AI, or validation
- implement collection or matchmaking
- move required gameplay into desktop rails
- create a physics-based drag system
- permit freeform lane placement
- support more than one simultaneous card drag

## Exit Checklist

Phase 1.21 is complete only when:

- [x] Checkpoint 0 captures the complete protected animation matrix.
- [x] Existing animation call sites run through the proven
      `PlayMotionSurface`.
- [x] Deal, scale, hand-shift, play, undo, transfer, and reveal choreography
      remains behaviorally equivalent.
- [x] Card and zone anchor keys remain stable across the DOM migration.
- [x] Motion, resting rotation, and visual scale have distinct transform
      owners.
- [x] `AppViewport` is the sole exact-9:16 sizing authority.
- [x] The game frame remains exact 9:16 on a 9:21 phone and every verification
      viewport.
- [x] Exterior space never changes internal game geometry.
- [x] Header, board stage, and footer use fixed non-content-growing tracks.
- [x] Footer contains fixed hand and action rows.
- [x] Every active lane renders as one stable keyed `LaneColumn`.
- [x] Every lane contains two stable 2x2 slot grids and one location tile.
- [x] Lane maps are persistent lane-local backgrounds.
- [x] One, two, and three lanes preserve lane size and vertical geometry.
- [x] Lane topology transitions are horizontal-only for surviving lanes.
- [x] Pointer drag-and-drop works for mouse, pen, and touch.
- [x] Hand-to-lane play and pending-lane-to-hand undo both work.
- [x] Accepted play is one continuous drag-ghost-to-transfer motion.
- [x] Drag cancellation and rejection leave no stale presentation state.
- [x] Native HTML5 drag ownership has been removed.
- [x] All temporary animation nodes live in the VFX layer.
- [x] Reveal and transfer animations land within endpoint tolerance.
- [x] Ordinary gameplay produces no persistent-region geometry drift.
- [x] Replay and live play share the same board structure.
- [x] Architecture fences, focused tests, production build, and scoped lint
      are green.

## Implementation Evidence — 2026-07-18

- Canonical `/play` no longer mounts `BoardSizer`.
- The live board renders one fixed `play-frame` grid column with fixed
  header/stage/footer rows.
- The live frame measured `430 × 764.4375` CSS pixels (9:16 within browser
  subpixel tolerance); a 9:21 viewport retained the same 9:16 internal ratio.
- Header, stage, and footer remained `414` CSS pixels wide while the opening
  deal changed the hand from two cards to four.
- Every live lane remained `130.65625 × 537.078125` CSS pixels.
- A real browser drag staged a hand card into lane 3; reverse drag restored it
  to hand. Stage and footer rectangles were unchanged and no temporary node
  remained after either animation.
- Pointer-controller tests cover mouse, pen, and touch through the same path.
- Lane-center tests cover one, two, and three lanes; topology motion uses
  horizontal-only FLIP `translate` on surviving keyed lane columns.
- Focused presentation/component tests: 27/27 passing.
- Location lifecycle/power primitive tests: 90/90 passing.
- Runtime Phase-0 gate: 71/71 passing with 200 property cases.
- TypeScript and Rust protocol conformance: 4/4 and 2/2 passing.
- Production build and scoped lint pass.

## Definition of Failure

Phase 1.21 is not complete if the board merely looks stable in one screenshot.

Any of the following fails the phase:

- the internal frame stretches to fit a tall phone
- playing a card moves the board stage vertically
- revealing a location reconstructs or remeasures its map
- a flyer inherits grid or flex layout from its destination
- one/two/three-lane modes use different lane heights or card sizes
- card dealing, scaling, shifting, playing, undo, transfer, or reveal timing
  changes merely because the DOM was reorganized
- expected animation fixtures are rewritten to bless unexplained differences
- pointer drop produces a ghost disappearance followed by a second flyer
- a local card repeats its play flight during resolution adoption
- touch drag is deferred after desktop drag is declared complete
- a rejected drag leaves a hidden card or stale highlight
- an animation or drag callback decides gameplay state
- a new CSS exception is required for each card, location, or topology case
