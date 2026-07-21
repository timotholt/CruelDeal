# Card and Location Raster Surface Architecture Spec

Status: implemented; complete browser choreography smoke awaits a stable dev server

Date: 2026-07-21

Owner: play presentation, game surfaces, and visual effects

Authority:

- This document is authoritative for `/play` card fronts, card backs, location
  fronts, location backs, dynamic card statistics, persistent statuses,
  system-owned borders, and card/location-bound VFX.
- `docs/css-effects-surface-compiler-rulebook.md` remains authoritative for how
  system chrome and typed effects are lowered into browser paint operations.
- `docs/playgame-boundary-hardening-mini-spec.md` remains authoritative for the
  game-client, seat-projection, and engine isolation boundaries.

Related:

- `docs/semantic-ui-authoring-compiler-spec.md`
- `docs/css-effects-surface-compiler-rulebook.md`
- `docs/font-manager-gametext-v3-spec.md`
- `docs/playgame-endturn-choreography.md`

## 1. Product outcome

Cruel Deal must have one canonical visual pipeline for cards and one canonical
visual pipeline for locations. Every hand, lane, pile, inspector, transfer,
reveal, deck, and hidden-hand representation must consume those pipelines
instead of rebuilding or cloning their pixels.

Static card-owned and location-owned content is rasterized once at canonical
inspector resolution and reused at smaller sizes. System-owned layers remain
independent so borders, cost, power, timers, statuses, and VFX can change
without rerasterizing the static content.

The game engine must have no knowledge of:

- bitmap or canvas types;
- DOM, SVG, CSS, or browser layout;
- card or location renderers;
- visual cache keys;
- borders, status icons, or VFX channels;
- inspector, hand, lane, pile, or animation geometry.

The renderer must have no knowledge of:

- canonical match state;
- engine commands or events;
- seat-scoped card tokens;
- owners, lanes, turns, or match phases;
- modifier ledgers or effect schedules;
- drag, undo, end-turn, or inspection behavior.

The only bridge is a presentation mapper that converts the already-redacted,
seat-safe play view into renderer-safe visual models.

## 2. Decision summary

The canonical composition is:

```text
Card host owned by UI geometry and interaction
  static card-content bitmap       card-owned pixels
  system border/chrome             system-owned pixels
  dynamic cost/power               system-owned live layers
  persistent statuses              system-owned live layers
  transient surface VFX            system-owned effect layers
  interaction affordances          UI-owned, outside the renderer
```

Locations use the same ownership split:

```text
Lane host owned by UI geometry and interaction
  lane background                   lane-owned visual
  location host
    static location-content bitmap  location-owned pixels
    system location border          system-owned pixels
    persistent location statuses    system-owned live layers
    transient location VFX          system-owned effect layers
  lane score overlay                lane-owned live UI
```

Cost and power are never baked into the long-lived card-content bitmap. Lane
scores are never baked into the long-lived location-content bitmap.

The initial implementation may use DOM, SVG, and canvas internally. The public
surface contract does not expose those implementation choices. Replacing the
initial rasterizer or compositor must not require changes to the engine,
presentation director, interaction controller, or motion choreography.

## 3. Terms

### 3.1 Static content

Static content is the card-authored or location-authored portion whose pixels
normally remain stable across placement and scale changes.

Card static content includes:

- background and card-type layout;
- artwork;
- card name;
- rules text when the card design displays it;
- card-owned decorative layers;
- named visual sockets used by the system compositor.

Location static content includes:

- location background treatment;
- location artwork;
- location name;
- location rules text;
- location-owned decorative layers.

Static does not mean immutable forever. A transform or text override produces a
new static-content specification and therefore a new cache key. It does mean
that ordinary cost, power, timer, status, border, and VFX changes do not alter
the static-content cache entry.

### 3.2 System chrome

System chrome is paint owned by the game client rather than an individual card
or location definition. It includes:

- card and location borders;
- card backs and location backs;
- cost and power badges;
- selection and target outlines when rendered inside the visual host;
- common accessibility contrast treatments;
- system status frames and icons.

Card-authored content cannot choose an arbitrary z-index or paint above system
chrome.

### 3.3 Persistent status

A persistent status is visual state that remains until a later presentation
model changes or removes it. Examples include:

- a turn timer;
- delayed reveal;
- disabled text;
- locked, silenced, shielded, or marked state;
- a persistent countdown or counter.

Persistent status is not a transient VFX and is not stored inside the static
content bitmap.

### 3.4 Transient VFX

A transient VFX is a bounded visual performance with a start and terminal
condition. Examples include:

- buff or debuff flash;
- reveal flare;
- glitch pulse;
- destruction burst;
- move trail;
- impact shake.

Transient VFX never changes gameplay state and never becomes part of a cached
static bitmap.

### 3.5 Surface host

A surface host is the outer box owned by the UI. The host owns:

- placement;
- width and height;
- scaling;
- transforms and resting rotation;
- pointer input;
- drag and inspection metadata;
- visibility leases used during motion.

The renderer mounts pixels inside the host and does not alter host geometry.

## 4. Ownership matrix

| Concern | Engine | Seat-safe presentation mapper | Surface renderer | UI host | Motion/VFX |
| --- | --- | --- | --- | --- | --- |
| Canonical rules and state | owns | reads projection only | forbidden | forbidden | forbidden |
| Hidden identity redaction | projection owns | preserves | cannot reverse | cannot reverse | cannot reverse |
| Front/back visual choice | no paint knowledge | resolves semantic face | paints selected face | hosts result | animates transition |
| Static card/location content | no | creates safe content spec | rasterizes and caches | positions | reuses same model |
| Border and back design | no | selects semantic system style if needed | owns paint | no | may animate host |
| Cost and power value/tone | owns truth | emits completed `StatVisual` | paints live layer | exposes hit target | may play change cue |
| Modifier history | owns truth | may expose inspector data elsewhere | forbidden | inspector queries presentation | forbidden |
| Timers/statuses | owns truth | emits completed status visuals | paints live layers | no status logic | may animate status changes |
| Lane scores | owns truth | emits completed score visuals | location renderer forbidden | lane compositor owns | may animate score change |
| Transient VFX | emits semantic event upstream | maps to renderer-safe cue | executes bounded surface cue | hosts effect bounds | owns scheduling/cancellation |
| Drag/inspect/playability | no drawing knowledge | no | forbidden | owns | motion reads host geometry |
| Bitmap cache | no | no | owns | no | no |

## 5. Module boundary

The target module shape is:

```text
components/game-surfaces/
  contracts/
    primitives.ts
    cardSurface.ts
    locationSurface.ts
    surfaceRenderer.ts
    surfaceVfx.ts
  card/
    CardSurface.tsx
    CardContentRasterizer.ts
    CardSurfaceCompositor.ts
    cardBitmapCache.ts
  location/
    LocationSurface.tsx
    LocationContentRasterizer.ts
    LocationSurfaceCompositor.ts
    locationBitmapCache.ts
  system/
    CardBackSurface.tsx
    LocationBackSurface.tsx
    SystemBorderLayer.tsx
    StatLayer.tsx
    StatusLayer.tsx

services/playgame/presentation/appearance/
  cardAppearance.ts
  locationAppearance.ts
  laneAppearance.ts
  surfaceVfxCues.ts
```

`components/game-surfaces/**` may import shared visual primitives, fonts,
assets, and generic UI surface/effect utilities. It may not import anything
from:

- `services/playgame/engine/**`;
- `services/playgame/runtime/**`;
- `services/playgame/view.ts`;
- `contexts/MatchSessionContext.tsx`;
- `contexts/PlayUiContext.tsx`;
- play interaction or presentation-director modules.

`services/playgame/presentation/appearance/**` is the deliberate anti-corruption
layer. It may consume the seat-safe view and produce game-surface contracts. It
must not paint, measure, mount, cache, animate, or inspect DOM.

The engine and runtime may not import `components/game-surfaces/**` or its
contracts. If a shared type is useful to both the engine and renderer, that is
evidence that the type is crossing the wrong boundary.

## 6. Renderer-safe primitive types

The contracts use only immutable, serializable visual values. Renderer
instances and bitmap handles are separate runtime objects.

```ts
export interface VisualAssetRef {
  readonly src: string;
  readonly revision: string;
}

export interface RasterSize {
  readonly width: number;
  readonly height: number;
}

export type VisualColor = `#${string}`;

export type StatTone = 'base' | 'buffed' | 'debuffed';

export interface StatVisual {
  readonly value: number;
  readonly tone: StatTone;
}

export type SurfaceFace = 'front' | 'back';
```

No renderer contract contains an engine ID, seat token, event, command,
callback, DOM element, class name, or arbitrary CSS string.

## 7. Card contracts

### 7.1 Card-owned content

```ts
export interface CardContentSpec {
  /** Deterministic hash of every field that affects static content pixels. */
  readonly cacheKey: string;
  /** Renderer-owned recipe identity, not an engine card-domain enum. */
  readonly layout: 'regular' | 'spell';
  readonly name: string;
  readonly rulesText: string;
  readonly artwork: VisualAssetRef | null;
  readonly accent: VisualColor;
  readonly contentRevision: string;
}
```

`CardContentSpec` excludes:

- card instance identity;
- owner or seat;
- zone or lane;
- revealed state;
- cost and power;
- base cost and base power;
- modifier histories;
- playability;
- text-disabled state;
- statuses;
- borders and card backs;
- VFX;
- interaction callbacks.

The content rasterizer owns the internal card-authored layer graph. It may
compose artwork, text, masks, and decoration however it chooses, but the result
is clipped to the content viewport and cannot paint above system chrome.

### 7.2 System card chrome

```ts
export interface CardChromeVisual {
  readonly borderStyle: string;
  readonly borderTone: 'neutral' | 'friendly' | 'enemy';
  readonly backStyle: string;
  readonly chromeRevision: string;
}
```

These are stable visual tokens interpreted by the system renderer. They are not
CSS selectors and do not authorize card content to alter the border.

### 7.3 Persistent card status

```ts
export type CardStatusVisual =
  | {
      readonly key: string;
      readonly kind: 'timer';
      readonly value: number;
      readonly tone: 'neutral' | 'warning' | 'danger';
    }
  | {
      readonly key: string;
      readonly kind: 'disabled';
    }
  | {
      readonly key: string;
      readonly kind: 'status-icon';
      readonly icon: VisualAssetRef;
      readonly label: string | null;
      readonly tone: 'neutral' | 'positive' | 'negative';
    };
```

Status keys are presentation identities used for stable layer reconciliation.
They are not engine effect IDs. The appearance mapper may derive them from
seat-safe state, but the renderer must be unable to navigate back to an engine
object.

### 7.4 Complete card surface model

```ts
export type CardFaceVisual =
  | {
      readonly kind: 'back';
      readonly backStyle: string;
    }
  | {
      readonly kind: 'front';
      readonly content: CardContentSpec;
    };

export interface CardSurfaceModel {
  readonly kind: 'card';
  readonly face: CardFaceVisual;
  readonly chrome: CardChromeVisual;
  readonly cost: StatVisual | null;
  readonly power: StatVisual | null;
  readonly statuses: readonly CardStatusVisual[];
}
```

Rules:

1. A back-facing model contains no `CardContentSpec`.
2. A back-facing model normally contains no cost, power, or statuses unless a
   future product rule explicitly makes one of those values public.
3. Spell power is represented as `null`, never as a hidden zero.
4. Cost and power are always system layers, including unmodified values.
5. The renderer receives the completed stat tone and never calculates buff or
   debuff precedence.
6. Status order is deterministic. The compositor owns placement and collision
   rules; a status cannot supply raw coordinates or z-index.

### 7.5 Card part hit testing

The UI must not depend on internal DOM children such as `.cost` or `.power`.
Bitmap composition may not create DOM nodes for those parts.

```ts
export type CardHitPart = 'content' | 'cost' | 'power' | 'status';

export interface SurfacePoint {
  readonly x: number;
  readonly y: number;
}

export interface CardHitResult {
  readonly part: CardHitPart;
  readonly statusKey?: string;
}
```

The mounted card surface exposes deterministic hit testing in canonical local
coordinates. The UI decides what a hit means. For example, the inspector may
open a cost log after receiving `{ part: 'cost' }`; the renderer does not open
the log or know its data source.

## 8. Location and lane contracts

### 8.1 Location-owned content

```ts
export interface LocationContentSpec {
  readonly cacheKey: string;
  readonly name: string;
  readonly rulesText: string;
  readonly artwork: VisualAssetRef | null;
  readonly accent: VisualColor;
  readonly contentRevision: string;
}
```

`LocationContentSpec` excludes:

- location instance identity;
- lane identity;
- revealed state;
- top and bottom score;
- score breakdowns;
- reveal schedule;
- location counters or statuses not explicitly mapped to visual status layers;
- border, location back, VFX, and interaction callbacks.

### 8.2 Complete location surface model

```ts
export type LocationFaceVisual =
  | {
      readonly kind: 'back';
      readonly backStyle: string;
    }
  | {
      readonly kind: 'front';
      readonly content: LocationContentSpec;
    };

export interface LocationChromeVisual {
  readonly borderStyle: string;
  readonly chromeRevision: string;
}

export type LocationStatusVisual = {
  readonly key: string;
  readonly kind: 'status-icon' | 'timer' | 'disabled';
  readonly value: string | number | null;
  readonly tone: 'neutral' | 'positive' | 'negative' | 'warning';
};

export interface LocationSurfaceModel {
  readonly kind: 'location';
  readonly face: LocationFaceVisual;
  readonly chrome: LocationChromeVisual;
  readonly statuses: readonly LocationStatusVisual[];
}
```

### 8.3 Lane composition

Scores belong to a lane, not to a location. They survive location replacement
and have separate inspection data.

```ts
export interface ScoreVisual {
  readonly value: number;
  readonly tone: 'local' | 'remote';
}

export interface LaneVisualModel {
  readonly location: LocationSurfaceModel;
  readonly topScore: ScoreVisual;
  readonly bottomScore: ScoreVisual;
  readonly laneArtwork: VisualAssetRef | null;
}
```

`LaneVisualModel` is consumed by the lane UI compositor, not by the location
content rasterizer. The lane compositor may visually place score plates across
the location border while preserving their independent ownership.

## 9. Canonical geometry

Static content is rasterized in a fixed logical coordinate system:

| Surface | Canonical width | Canonical height | Aspect ratio |
| --- | ---: | ---: | ---: |
| Card | 500 | 700 | 5:7 |
| Location | 700 | 525 | 4:3 |

The canonical size is the inspector-resolution layout space. Hand, lane, pile,
deck, hidden-hand, motion, and inspector hosts scale the completed composition.
They do not cause text reflow or rerasterization merely because their displayed
size differs.

The UI host owns displayed dimensions. The renderer must fill the host without
writing width, height, transform, transition, margin, drag metadata, or pointer
behavior onto the host.

If a future display requires greater source resolution, the raster cache may
introduce a render-density dimension. It must not introduce zone-specific
layouts.

## 10. Rasterizer and bitmap cache

### 10.1 Rasterizer contract

```ts
export interface RasterArtifact {
  readonly key: string;
  readonly size: RasterSize;
  readonly bitmap: ImageBitmap;
}

export interface ContentRasterizer<Spec> {
  rasterize(spec: Spec, size: RasterSize): Promise<RasterArtifact>;
}
```

`ImageBitmap` is an implementation boundary returned by the browser rasterizer,
not a game or presentation model type. A non-browser implementation may provide
an equivalent adapter behind the same surface renderer.

The rasterizer must:

- wait for required fonts and assets before committing an artifact;
- render deterministically for the same spec, size, and renderer revision;
- use the canonical coordinate space;
- never inspect game state or DOM outside its own bounded render target;
- return an explicit fallback artifact on an asset failure;
- never mutate a previously returned bitmap.

### 10.2 Static-content cache keys

A card content cache key includes every field that changes static content
pixels:

- layout recipe and renderer revision;
- name and rules text;
- artwork source and asset revision;
- accent and card-owned decoration inputs;
- font-family and font-asset revision;
- canonical raster size and render density.

It excludes:

- card instance identity;
- zone, lane, and displayed size;
- cost and power;
- modifier histories;
- statuses and timers;
- border, back style, and interaction state;
- VFX and motion state.

Location cache keys follow the same rule for location-owned content.

### 10.3 Cache behavior

The cache must:

- deduplicate concurrent requests for the same key;
- return immutable artifacts;
- use a bounded least-recently-used or equivalent eviction policy;
- close evicted `ImageBitmap` objects when supported;
- expose deterministic test reset and metrics hooks;
- avoid persistent storage until explicitly specified;
- never require manual invalidation for ordinary visual changes.

A changed input creates a changed key. Cache entries never observe game state
and therefore cannot become logically stale.

### 10.4 Dynamic-layer caches

Small system layers may use independent paint caches. For example:

```text
stat:cost:3:debuffed:chrome-v2
stat:power:-12:buffed:chrome-v2
border:card:standard:neutral:chrome-v2
back:card:default:chrome-v2
```

These caches are paint optimizations only. They do not own the current value or
tone. When presentation emits a different `StatVisual`, the compositor requests
the corresponding visual key.

## 11. Surface renderer lifecycle

```ts
export interface SurfaceEffectLease {
  cancel(): void;
}

export interface SurfaceInstance<Model, Cue, HitResult> {
  update(model: Model): void;
  playVfx(cue: Cue): SurfaceEffectLease;
  hitTest(point: SurfacePoint): HitResult | null;
  dispose(): void;
}

export interface SurfaceRenderer<Model, Cue, HitResult> {
  mount(
    host: HTMLElement,
    model: Model,
  ): SurfaceInstance<Model, Cue, HitResult>;
}
```

Concrete aliases provide card and location types:

```ts
export type CardSurfaceRenderer = SurfaceRenderer<
  CardSurfaceModel,
  CardVfxCue,
  CardHitResult
>;

export type LocationSurfaceRenderer = SurfaceRenderer<
  LocationSurfaceModel,
  LocationVfxCue,
  LocationHitResult
>;
```

Lifecycle rules:

1. `mount` may create renderer-owned children inside `host` but may not change
   host geometry or interaction attributes.
2. `update` is idempotent for an equal visual model.
3. `update` diffs independent ownership domains. A stat or status change does
   not rerasterize static content.
4. `playVfx` starts only renderer-safe visual work and returns a cancellation
   lease.
5. `hitTest` uses canonical local coordinates and contains no UI action.
6. `dispose` cancels effects, releases bitmap leases, removes renderer-owned
   children, and is idempotent.
7. Renderer instances never subscribe to match state directly.

## 12. Paint order and protected slots

The system compositor owns the final order. Card-owned and location-owned
content is confined to its content slot.

Canonical card order:

```text
0  system underlay/backplate
1  static card-content bitmap
2  system border and frame
3  dynamic cost and power
4  persistent statuses
5  transient VFX below chrome
6  transient VFX above chrome
7  UI interaction affordances outside the surface instance
```

Canonical location order:

```text
0  system underlay/backplate
1  static location-content bitmap
2  system location border
3  persistent location statuses
4  transient location VFX below chrome
5  transient location VFX above chrome
6  lane scores owned by the lane compositor
7  UI interaction affordances outside the surface instance
```

The apparent numeric order is descriptive. Callers request named slots and
channels; they never submit raw z-index values.

Content is clipped to the canonical content viewport. Only the system
compositor may deliberately paint across a border or outside a surface.

## 13. VFX contract

### 13.1 Renderer-safe cues

```ts
export type SurfaceVfxChannel =
  | 'below-chrome'
  | 'above-chrome'
  | 'outside-surface';

export type CardVfxCue =
  | {
      readonly kind: 'power-flash';
      readonly tone: 'buff' | 'debuff';
      readonly intensity: number;
      readonly channel: 'above-chrome';
    }
  | {
      readonly kind: 'glitch';
      readonly intensity: number;
      readonly channel: 'above-chrome';
    }
  | {
      readonly kind: 'reveal';
      readonly channel: 'outside-surface';
    }
  | {
      readonly kind: 'destroy';
      readonly intensity: number;
      readonly channel: 'outside-surface';
    };
```

Renderer-safe cues contain visual parameters only. They exclude:

- engine event names;
- card or location IDs;
- source-effect IDs;
- mutation records;
- scheduled commands;
- gameplay callbacks.

The presentation VFX mapper converts authoritative event presentation into
these cues before invoking the renderer.

### 13.2 Surface VFX versus world VFX

Surface VFX are bound to one mounted surface and move with its host. World VFX,
such as a trail between two cards, remain owned by the play motion/VFX layer.
World VFX may use host geometry but may not inspect or mutate renderer internals.

### 13.3 Persistent status versus VFX

A timer or disabled marker is a persistent status, even if its value animates.
The status layer may animate from one value to the next, but its existence and
current value come from `update(model)`.

A flash acknowledging the timer change is a transient VFX and comes through
`playVfx(cue)`.

## 14. Face-down security contract

A card back or location back is an identity-free system visual.

Required invariants:

1. A back-facing card model serializes without card name, definition ID,
   artwork, rules, cost, power, or status information that is not public.
2. A back-facing location model serializes without location name, definition
   ID, artwork, rules, or reveal schedule.
3. Back cache keys are shared system keys such as `back:card:default:v2`; they
   never contain an instance identity or hidden definition identity.
4. Motion from a protected source mounts the system back surface directly. It
   never clones a redacted or face-up destination and then hides its children.
5. A face transition swaps complete surface models only at the governed
   edge-on handoff.
6. Debug instrumentation may identify the motion session outside the renderer,
   but the renderer-owned back subtree remains identity-free.

Security tests inspect serialized models, renderer-owned DOM/canvas metadata,
cache keys, and motion surrogates for forbidden identity.

## 15. Motion and inspector integration

### 15.1 No visual DOM cloning

Card and location motion must stop treating cloned DOM as a rendering API.

The motion system receives:

- a surface model snapshot;
- source and destination host rectangles;
- face transition timing;
- rotation and scale choreography.

It asks the appropriate surface renderer to mount a temporary instance in the
motion overlay. It animates the temporary host, not renderer-owned children.

At landing, the motion system performs a visibility-lease handoff to the
canonical destination host and disposes the temporary surface instance.

### 15.2 Face transitions

Both canonical faces rest at an unmirrored orientation. A face change uses two
edge-on halves:

1. animate the current face from `0deg` to `90deg`;
2. update the temporary surface model while edge-on;
3. place the new face at `-90deg`;
4. animate it to `0deg`;
5. hand off only when the destination canonical model matches.

The renderer owns the new face pixels. Motion owns only timing and transform.

### 15.3 Inspector

The inspector mounts a new surface instance from the same model used by the
source host. It does not clone the hand or lane DOM.

The inspector scales the canonical composition and uses surface hit testing for
cost, power, and status inspection. Opening an inspector must not trigger a
new static-content raster when a matching cache artifact exists.

## 16. Presentation mappers

Presentation mappers are pure and deterministic:

```ts
export function cardSurfaceModel(
  input: SeatSafeCardAppearanceInput,
): CardSurfaceModel;

export function locationSurfaceModel(
  input: SeatSafeLocationAppearanceInput,
): LocationSurfaceModel;
```

The concrete input types may wrap current `ResolvedCard`, `ResolvedLocation`,
seat-safe stat read models, and presentation-only visibility decisions. Those
types remain confined to `services/playgame/presentation/appearance/**`.

Mapper responsibilities:

- select front or back without leaking identity;
- create static-content specs and deterministic keys;
- apply harmful-modifier precedence and emit completed stat tones;
- map gameplay status into renderer-safe persistent status visuals;
- select system chrome tokens;
- omit non-public values;
- preserve deterministic status ordering.

Mapper non-responsibilities:

- rasterization;
- font measurement;
- bitmap or asset caching;
- DOM and geometry;
- animation timing;
- VFX execution;
- click, drag, undo, or inspection behavior.

## 17. Update and state-management rules

The renderer is a projection of the current visual model, never a second state
store.

Rules:

1. The seat-safe presented snapshot remains the source of truth.
2. Every UI render or presentation adoption derives a complete visual model.
3. Renderer instances reconcile to that complete model.
4. Renderer caches retain immutable pixels, not current card or location state.
5. Undo and replay produce visuals by deriving models from the selected
   presented snapshot; they do not reverse renderer mutations.
6. Cost, power, and status inspection reads remain outside the renderer.
7. A VFX completion does not mutate the persistent model.
8. Cancellation restores no gameplay state; it only releases visual resources.

This prevents buff, debuff, timer, replay, and undo behavior from becoming
coupled to bitmap invalidation.

## 18. Failure and fallback behavior

Rendering failure must be explicit and bounded.

- A failed front-content raster uses a deterministic public fallback surface
  containing only already-authorized text and system chrome.
- A failed back asset uses a built-in identity-free system back.
- A failed status icon uses a system placeholder without dropping the status.
- A failed VFX is logged and completes its lease without blocking presentation.
- A cache failure falls back to uncached rendering rather than changing visual
  ownership.
- A missing destination surface causes the motion session to recover through
  its existing governed recovery path.

Fallbacks must not read canonical state or bypass projection redaction.

## 19. Performance contract

The primary performance goal is stable, reusable pixels rather than maximal
pre-baking.

Required behavior:

- One static-content raster per distinct content key and canonical density.
- No static-content rerasterization when only placement, scale, cost, power,
  border tone, timer, status, selection, or VFX changes.
- No layout or font fitting during hand-to-lane, lane-to-hand, inspector, or
  reveal motion when the static artifact already exists.
- Concurrent identical raster requests collapse to one job.
- Inspector, hand, lane, pile, and temporary motion surfaces share artifacts.
- Dynamic stat and status updates touch only their compositor layers.
- Cache metrics expose hits, misses, in-flight deduplication, evictions, and
  raster duration in development builds.

Recommended initial budgets:

| Metric | Initial requirement |
| --- | ---: |
| Card static-cache entries | 512 maximum |
| Location static-cache entries | 64 maximum |
| Duplicate in-flight raster jobs per key | 0 |
| Static rerasterizations for one cost-only update | 0 |
| Static rerasterizations for one timer-only update | 0 |
| Static rerasterizations for hand-to-lane motion | 0 |
| Static rerasterizations for inspector open | 0 after warm cache |

These budgets may be tuned with evidence, but ownership rules may not be
weakened to meet them.

## 20. Architecture fences and tests

### 20.1 Import fences

Add source-level architecture tests proving:

- `components/game-surfaces/**` does not import playgame engine, runtime, view,
  contexts, interaction, or presentation-director modules;
- playgame engine and runtime do not import game-surface modules;
- only presentation appearance mappers import both seat-safe play view types and
  renderer-safe surface contracts;
- rasterizers do not import VFX or interaction modules;
- VFX implementations do not import engine event types.

### 20.2 Contract tests

Prove:

- equal safe inputs produce deeply equal visual models and equal cache keys;
- a cost-only or power-only change preserves the static content key;
- a timer-only change preserves the static content key;
- a transform or rules-text override changes the static content key;
- harmful modifier precedence is resolved before the renderer;
- spell power remains `null`;
- status ordering is deterministic;
- back-facing models contain no protected identity.

### 20.3 Renderer tests

Prove:

- hand, lane, pile, inspector, and motion instances consume the same static
  artifact object for the same key;
- dynamic stat updates do not invoke the content rasterizer;
- status updates do not invoke the content rasterizer;
- border changes do not invoke the content rasterizer;
- every effect lease completes or cancels exactly once;
- dispose is idempotent and releases bitmap/effect leases;
- hit testing works without relying on DOM descendants.

### 20.4 Visual and browser tests

Maintain canonical fixtures for:

- regular front;
- spell front;
- card back;
- location front;
- location back;
- base, buffed, and debuffed stats;
- negative and double-digit values;
- timer and disabled statuses;
- border and VFX ordering;
- hand, lane, inspector, transfer, undo, and reveal scales.

Browser smoke must cover:

- login through the existing Google session;
- draw into local hand;
- protected opponent draw;
- hand-to-lane stage;
- lane-to-hand undo;
- end-turn face-down transition;
- reveal cinematic and handoff;
- card and location inspection;
- location reveal;
- replay of the same sequence.

## 21. Migration plan

Cruel Deal has no backward-compatibility requirement during active
development. Each phase must delete the superseded representation when its
callers are migrated. Do not retain aliases, fallback reads, dual renderers, or
dual-write paths.

### Phase 0: Characterization and fences

- Add this spec to the architecture documentation index or relevant playgame
  checkpoint.
- Characterize current card, location, back, stat, status, inspector, motion,
  and reveal behavior.
- Add import fences for the new renderer package before implementation begins.
- Add a failing characterization for the current identity-free synthetic back
  if it does not paint the canonical back.

Exit:

- The current behavior and known defects are recorded.
- The new renderer package cannot accidentally import game state.

### Phase 1: Contracts and pure presentation mappers

- Add renderer-safe contracts.
- Add pure card, location, lane, and VFX appearance mappers.
- Move stat-tone calculation output into mapper-produced `StatVisual`.
- Add back-model security tests and static-key stability tests.
- Keep current pixels temporarily, but consume the new models directly.

Exit:

- Card and location painters no longer accept `ResolvedCard` or
  `ResolvedLocation`.
- No renderer calculates gameplay-derived presentation policy.

### Phase 2: Canonical system composition

- Introduce card and location surface hosts.
- Introduce one canonical system card back and one canonical system location
  back.
- Move borders, cost, power, and statuses into system-owned layers.
- Move lane scores out of the location content renderer and into lane
  composition.
- Make deck and hidden-hand miniatures reuse the canonical back artifact or its
  system back style token.
- Remove duplicated back gradients and obsolete flying-card back CSS.

Exit:

- There is one visual owner for every front, back, border, stat, and status.
- A protected synthetic back is visibly identical to the canonical card back.

### Phase 3: Surface-instance motion and inspector cutover

- Replace visual `cloneNode` use with renderer-mounted temporary instances.
- Make transfer, undo, reveal, and location reveal animate surface hosts.
- Make the inspector mount from the same visual model.
- Replace DOM-class cost/power click detection with canonical hit testing.
- Preserve visibility leases and governed handoff semantics.

Exit:

- Motion and inspector code never clone renderer-owned DOM.
- No face transition swaps pixels before the edge-on point.
- All canonical handoffs verify matching face models.

### Phase 4: Static-content bitmap rasterization

- Implement card and location content rasterizers at canonical resolution.
- Boot-gate required fonts and assets.
- Add bounded artifact caches with in-flight deduplication.
- Compose static artifacts with the already-separated dynamic system layers.
- Add cache metrics and rasterization regression tests.

Exit:

- Hand, lane, pile, inspector, and motion reuse the same static artifacts.
- Dynamic updates do not rerasterize static content.
- Bitmap disposal and fallback paths are proved.

### Phase 5: Cleanup and complete proof

- Delete superseded face components, render-plan caches, clone sanitizers,
  duplicated back rules, and unused flyer CSS.
- Remove compatibility props and old visual state shapes.
- Run the full architecture, playgame, application, and browser gates.
- Record cache metrics and visual proof in an implementation checkpoint.

Exit:

- Active source contains one canonical card surface architecture and one
  canonical location surface architecture.
- No old representation remains reachable or importable.

## 22. Explicit non-goals

This architecture does not:

- change card or location rules;
- change buff/debuff precedence;
- change reveal or transfer timing unless required to preserve a correct visual
  handoff;
- move modifier history or effect schedules into the renderer;
- require persistent bitmap storage;
- require WebGL or a specific canvas library;
- design a new card or location authoring editor;
- migrate non-play collection, store, deck-editor, or progression cards;
- make one authored layer equal one permanent DOM child;
- allow arbitrary card-authored code, CSS, or z-index values at runtime.

## 23. Definition of done

The architecture is complete when all of the following are true:

1. `/play` card and location renderers consume only renderer-safe visual models.
2. The engine, runtime, and renderer import fences are green.
3. Static card and location content is cached at canonical resolution.
4. Cost, power, lane scores, borders, statuses, and VFX update independently of
   static content.
5. All card and location backs are canonical system-owned visuals.
6. Face-down models and motion surfaces contain no protected identity.
7. Hand, lane, pile, inspector, transfer, undo, reveal, deck, and hidden-hand
   visuals share the appropriate canonical artifacts.
8. Motion and inspector code mount surfaces instead of cloning visual DOM.
9. Replay and undo derive complete visuals from presented snapshots rather than
   reversing renderer state.
10. No zone-specific text layout or bitmap variant exists.
11. No superseded renderer, back rule, cache, or compatibility adapter remains
    in active source.
12. `npm run test:architecture`, the focused surface tests, active typechecks,
    production build, and the complete `/play` browser smoke path are green.

## 24. First implementation milestone

The first implementation milestone is deliberately smaller than bitmap
rasterization:

1. Land the contracts and import fences.
2. Add the pure presentation appearance mappers.
3. Convert the existing card painter to consume `CardSurfaceModel` without
   changing its appearance.
4. Introduce the canonical identity-free card back.
5. Move cost, power, and border ownership into system layers.
6. Prove cost-only, power-only, timer-only, and border-only updates preserve the
   static content key.

Do not begin location migration or static bitmap generation until this card
slice passes its architecture, security, visual, motion, and inspector gates.
The purpose of the first milestone is to prove the ownership boundary before
optimizing the pixels behind it.
