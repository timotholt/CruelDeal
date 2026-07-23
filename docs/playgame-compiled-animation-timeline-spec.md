# Playgame Compiled Animation Timeline

Status: ready for implementation

Date: 2026-07-21

Scope: all time-based `/play` presentation driven by committed match Frames,
plus the opening transaction prelude

Compatibility policy: clean replacement; no legacy animation API, timing
adapter, fallback renderer, CSS-timer path, or dual execution path

## Authority

This specification governs:

- how a seat-projected committed Frame becomes a browser presentation;
- how presentation steps become one compiled animation timeline;
- how card actors, location actors, canonical DOM, layout movement, transient
  VFX, sound, camera motion, and presentation-only UI cues share that timeline;
- how presentation is prepared before state adoption and bound after state
  adoption;
- how a presentation starts, completes, pauses, cancels, fails, and cleans up;
- how opening, turn-resolution, card-transfer, card-reveal, location-reveal,
  and turn-banner choreography are authored and verified;
- the tests and source fences required before the old timing paths can be
  removed.

This specification incorporates and supersedes the timing, execution, and
failure-policy portions of:

- `docs/playgame-animation-actor-architecture.md`;
- `docs/playgame-endturn-choreography.md`.

The permanent actor-pool, visual-ownership, face-readiness, and handoff rules
from the actor document are restated here and remain required. The visible
end-turn order from the choreography document also remains required. Its prior
"best-effort" missing-anchor/timeout behavior is explicitly superseded: a
required presentation may not silently skip, pop, teleport, or advance.

The following documents remain authoritative outside this scope:

- `docs/playgame-transactional-rules-kernel-spec.md` for gameplay authority;
- `docs/playgame-effect-resolution-timeline-and-wire-spec.md` for canonical
  Frames, seat projection, atomic wire blocks, and source/target evidence;
- `docs/app-viewport-system.md` for the fixed 9:16 game viewport;
- `docs/card-location-raster-surface-spec.md` for card and location rendering.

Where another active document conflicts with this specification about browser
animation timing, presentation lifecycle, visual fallback behavior, or
animation completion, this specification wins.

## Executive decision

CruelDeal will use a compiled animation timeline for every committed
presentation beat.

The permanent law is:

> One committed presentation beat consumes one or more contiguous committed
> Frames and produces exactly one authored storyboard. The storyboard is
> prepared against the beat's first `before` state, bound against the committed
> DOM for the beat's final `after` state, compiled once into visual tracks and
> timed cues, started on one browser clock, awaited through one completion
> promise, and cleaned up before the next beat begins. A beat consumes one Frame
> by default. A multi-Frame beat is legal only when one exhaustive author claims
> every Frame and preserves all visible causal evidence in the compiled
> storyboard.

An animation is not a collection of promises, `setTimeout` calls, transition
listeners, CSS classes with private durations, or components that remove
themselves later. It is immutable scheduled data compiled before playback.

The browser performs interpolation, holds, pauses, overlap, and synchronized
visual tracks. JavaScript prepares resources, compiles the schedule, starts the
clock, dispatches explicitly timed non-visual cues, performs the final visual
handoff, and resolves one outcome.

## Product goal

From any seat-safe committed presentation block, the client must be able to:

1. process Frames strictly in committed order;
2. show each required visual event exactly once;
3. keep every source, destination, card face, map, and text surface readable;
4. prevent one presentation from starting before the prior one has completely
   handed off and cleaned up;
5. reproduce the same choreography at normal, slow, or test playback rates
   without selecting a different implementation;
6. pause and resume without losing cues or jumping through intermediate state;
7. cancel deliberately without leaking actors, styles, visibility leases,
   hand reservations, VFX, or audio scheduling work;
8. identify the exact authored step, track, cue, and browser time when a visual
   defect occurs;
9. change timing in one storyboard definition without finding independent
   timers elsewhere in the UI.

The target authoring experience is:

```ts
storyboard('card-reveal', ({ step }) => [
  step('enter', {
    durationMs: 350,
    nextStepAfterMs: 350,
    tracks: [/* move, scale, first flip half */],
    cues: [{ atMs: 0, kind: 'audio', sound: 'reveal' }],
  }),
  step('hold', {
    durationMs: 350,
    nextStepAfterMs: 350,
    tracks: [/* same apex values: browser holds */],
  }),
  step('return', {
    durationMs: 320,
    nextStepAfterMs: 320,
    tracks: [/* return to canonical slot */],
  }),
]);
```

No caller manually waits 350 milliseconds between those steps. The compiler
calculates one schedule and the runner awaits one result.

## Core problem in the current implementation

The current top-level authority boundary is basically correct:

```text
committed SeatPresentationBlock
  -> PresentationDirector
  -> prepare before adoption
  -> adopt frame.after
  -> pre-paint reactive commit barrier
  -> animate after adoption
  -> next Frame
```

The failure is below that boundary. Timing and completion are currently owned
by multiple mechanisms:

- `playPresentationSink.ts` directly waits for lock beats and turn banners;
- `toast.ts` owns a different CSS duration and removal timer;
- `eventAnimator.ts` starts sounds and VFX at broad imperative phases and
  serially awaits transfers;
- `cardMotionSession.ts` creates CSS transitions, waits for their expected
  duration, and performs a separate midpoint model swap;
- `cardRevealAnimation.ts` chains enter, hold, and return with separate waits;
- `locationRevealAnimation.ts` starts map and tile transitions, waits for a
  midpoint, replaces the surface model, then waits again;
- transient VFX carry independent duration and cleanup timestamps;
- opening presentation has independent title, playfield, settle, and sink-bind
  timers.

These mechanisms do not share one definition of:

- when the presentation began;
- which steps overlap;
- which step owns a property;
- when the presentation is visibly complete;
- when a midpoint cue should fire;
- when cleanup is legal;
- whether the next Frame may begin.

The recurring flash, pop, teleport, double-banner, premature cleanup, and
overlapping-animation bugs are consequences of this missing representation.
They are not isolated CSS calibration defects.

## Non-goals

This specification does not:

- change engine rules, Frame order, replay truth, or player-wire messages;
- put animation durations or CSS keyframes on the server;
- serialize browser geometry, animation profiles, or audio settings into
  canonical match history;
- let presentation infer game outcomes from card text or final state;
- replace Solid, the card/location surface model, or the 9:16 viewport shell;
- recreate card DOM for each transfer or reveal;
- route pointer-driven dragging through a fixed-duration storyboard while the
  pointer is actively moving;
- make audio playback length block gameplay presentation unless an authored
  visual hold explicitly requires that time;
- retain old animation fixtures, old timing helpers, or compatibility adapters;
- allow missing targets, missing anchors, missing actors, or failed
  compilation to select a simpler animation.

## Architectural placement

The compiled timeline belongs entirely in the browser presentation layer:

```text
Match authority and server
  -> commits canonical Frames
  -> projects one seat-safe atomic presentation block

PlayUi presentation queue
  -> supplies blocks in order

PresentationDirector
  -> exclusively iterates transactions and presentation beats
  -> exclusively adopts every Frame consumed by a beat
  -> exclusively crosses the reactive DOM-commit barrier

TransactionPresentationPlanner
  -> indexes the complete atomic block and its finite effect-invocation tree
  -> partitions every Frame into exactly one contiguous presentation beat
  -> defaults to one-Frame beats
  -> permits multi-Frame beats only through exhaustive typed authors

BeatStoryboardRegistry
  -> chooses one storyboard author for every event/effect claimed by the beat
  -> creates semantic animation nodes from the beat's Frames and trace evidence

PreparedBeatPresentation
  -> acquires actors and visibility leases
  -> captures source geometry
  -> preloads authorized face/art assets

StoryboardCompiler
  -> expands typed routine calls, sequences, parallels, and staggers
  -> rejects recursive routine definitions and unbounded fan-out
  -> resolves post-adoption targets
  -> calculates absolute time
  -> validates property ownership
  -> emits WAAPI tracks and a cue schedule

StoryboardRunner
  -> mounts every owned resource
  -> starts every track on one DocumentTimeline origin
  -> dispatches cues from the same clock
  -> awaits one result
  -> hands off and cleans up
```

### What must not own the timeline

- The engine and server must not know animation timing.
- `MatchSession` and `MatchRuntime` must not know animation timing.
- replay folding must not execute storyboards.
- Solid components must not sequence committed event animations.
- CSS must not contain a second duration that decides logical completion.
- card and location surface renderers must not remove their own temporary
  presentation actors.
- audio, VFX, and toast services must not advance the Frame cursor.
- `PresentationDirector` must not contain card-, location-, or effect-specific
  choreography.

## Required module structure

The implementation should converge on this structure. Exact filenames may be
adjusted during implementation, but ownership may not move across the stated
boundaries.

```text
services/playgame/presentation/
  presentationDirector.ts
  playPresentationSink.ts
  transactionPresentationPlanner.ts
  effectInvocationIndex.ts
  animationBudgets.ts

  storyboard/
    contracts.ts
    nodes.ts
    builder.ts
    routineRegistry.ts
    routineSchemas.ts
    expand.ts
    schedule.ts
    compiler.ts
    runner.ts
    cueScheduler.ts
    waapiDriver.ts
    diagnostics.ts
    animationProfile.ts

  routines/
    primitives.ts
    cardLifecycle.ts
    locationLifecycle.ts
    sharedEffects.ts
    multiTarget.ts

  storyboards/
    registry.ts
    transactionOpening.ts
    turnBanner.ts
    cardTransfer.ts
    cardReveal.ts
    locationReveal.ts
    cardPower.ts
    cardDestroy.ts
    cardTransform.ts
    laneTopology.ts

  cardMotion/
    cardMotionActorPool.ts
    cardMotionSession.ts
    canonicalVisibility.ts
    createCardSurrogate.ts

  effectMotion/
    effectActorPool.ts
    effectPresets.ts
```

`cardMotion` remains the private owner of permanent actors and canonical
visibility leases. It stops being an independent timer/transition engine and
instead contributes visual targets and track specifications to a storyboard.

## Canonical terminology

### Simulation Frame

The deterministic, monotonically increasing engine coordinate stored in match
history. It is not a browser animation frame and not wall-clock time.

### Presentation block

The complete seat-safe atomic transaction delivered to the client. Interaction
is locked while its Frames are being presented.

### Presentation beat

The smallest browser presentation unit awaited by `PresentationDirector`. A
beat owns a non-empty contiguous range of committed Frames. Its `before` state
is the first Frame's `before`; its `after` state is the last Frame's `after`.
Every Frame in a block belongs to exactly one beat and retains its canonical
identity for replay and diagnostics.

Most beats contain one Frame. A multi-Frame beat exists only to express one
visually atomic committed action, such as a finite multi-target destroy
invocation or a contiguous draw/play/reveal chain. Grouping never changes the
engine history and never permits presentation to invent or reorder outcomes.

### Storyboard

An immutable client-authored description of one presentation beat. A
storyboard contains ordered steps but no live DOM nodes, timers, `Animation`
objects, callbacks, or mutable state.

### Animation routine

A named, typed, parameterized authoring function that expands into immutable
animation nodes. Routines are compile-time composition only. They do not own a
clock, await work, mutate game state, or call another runner.

### Animation node

An authoring AST node: primitive step, sequence, parallel group, staggered
group, or routine call. All nodes are expanded and flattened before binding or
playback. No animation node survives as executable callback logic in the
compiled timeline.

### Step

One author-facing section of a storyboard. A step declares:

- `durationMs`: how long the step's authored interval lasts;
- `nextStepAfterMs`: how far the accumulated start cursor advances before the
  next step begins;
- visual track fragments local to the step;
- timed cues local to the step.

The next step may start before, at, or after the current step's end.

### Visual track

A time-varying visual property or managed visual effect owned by the
storyboard. Tracks contribute to canonical duration and cleanup.

### Cue

An instantaneous non-interpolated action dispatched at one exact storyboard
time. Audio start, a permitted noncritical surface variant swap, haptic
feedback, and diagnostic markers are cues. A cue cannot own an undeclared
duration.

### Actor

A pre-mounted stable DOM renderer temporarily leased to a storyboard for
movement or reveal. Actors are implementation-private and are never addressed
by content or server messages.

### Prepared presentation

The unique resource owner created before a beat's Frames are adopted. It
captures source representations, acquires actors and leases, and preloads every
immutable surface needed by the beat, including surfaces first visible in an
intermediate Frame.

### Compiled timeline

The immutable browser-bound result containing concrete target elements,
normalized keyframes, absolute cue times, total duration, cleanup resources,
and diagnostic metadata.

### Runner

The sole runtime owner of WAAPI `Animation` objects and the master presentation
clock for one compiled timeline.

### Composition and concurrency

Reusable storyboard fragments may be composed during authoring, but the result
must be flattened into one `BeatStoryboard` before compilation. A fragment may
not start a nested runner, return a second `finished` promise, or create a
private clock.

Concurrency is exact:

- transactions are presented serially;
- presentation beats inside a transaction are presented serially;
- Frames are consumed in canonical order and exactly once by those beats;
- steps inside one beat may overlap according to `nextStepAfterMs`;
- tracks inside one storyboard may run concurrently when their target/channel
  ownership does not conflict;
- multiple actors may animate concurrently inside one storyboard;
- no track from the next beat may overlap the current beat.

Staggering several cards is authored as several steps or fragments with
different accumulated start times. It is not an imperative loop that sleeps
between cards.

## Animation composition language

The authoring layer needs reusable subroutines, but it does not need runtime
recursion. CruelDeal will use a small typed animation AST that is fully
expanded before playback.

### Node contract

```ts
type AnimationNode =
  | PrimitiveStepNode
  | SequenceNode
  | ParallelNode
  | StaggerNode
  | RoutineCallNode;

interface PrimitiveStepNode {
  readonly kind: 'STEP';
  readonly step: StoryboardStep;
}

interface SequenceNode {
  readonly kind: 'SEQUENCE';
  readonly children: readonly AnimationNode[];
}

interface ParallelNode {
  readonly kind: 'PARALLEL';
  readonly children: readonly AnimationNode[];
}

interface StaggerNode {
  readonly kind: 'STAGGER';
  readonly intervalMs: Milliseconds;
  readonly children: readonly AnimationNode[];
}

interface RoutineCallNode<P extends RoutineId = RoutineId> {
  readonly kind: 'CALL';
  readonly routine: P;
  readonly params: RoutineParams[P];
}
```

The builder exposes `step`, `sequence`, `parallel`, `stagger`, and `call`.
`forEachTarget` is a convenience that maps an already ordered, finite target
array into child nodes; it is not a runtime node and may not execute a new
selector.

Composition timing is mechanical:

- `sequence(A, B)` starts `B` at the accumulated next-start boundary of `A`;
- `parallel(A, B)` starts both at the same parent offset and occupies the
  maximum child span;
- `stagger(t, [A, B, C])` starts the children at `0`, `t`, and `2t`, and
  occupies the maximum resulting end;
- `call(id, params)` expands the registered routine at the call's parent
  offset;
- a primitive step retains its explicit `durationMs` and `nextStepAfterMs`.

The compiler recursively expands the finite AST and then flattens it into the
existing `BeatStoryboard.steps`. That compiler traversal may be implemented
iteratively, but its output and limits are identical. Playback contains no
routine calls, loops, child promises, `onfinish` callbacks, or nested runners.

### Routine registry

```ts
interface AnimationRoutineDefinition<Id extends RoutineId> {
  readonly id: Id;
  readonly params: RuntimeSchema<RoutineParams[Id]>;
  expand(
    context: RoutineAuthoringContext,
    params: RoutineParams[Id],
  ): AnimationNode;
}
```

The routine registry is closed and typechecked. Registration validates:

- unique routine IDs;
- parameter schemas and preset references;
- an acyclic routine-call graph;
- a maximum authored call depth of 16;
- no asynchronous expansion;
- no DOM, engine mutation, timer, random-number, or network access;
- no access to hidden identities outside the projected beat context.

Routine definitions may call lower-level routines, but cycles are build
failures. Engine effect nesting is different: the planner may traverse the
finite committed invocation tree, whose depth was already budgeted by the
engine. That traversal produces routine calls and is completely flattened
before playback. It cannot cause new gameplay work.

### Chaining law

An animation never imperatively calls another animation when it finishes.
This code shape is forbidden:

```ts
daggerAnimation.onfinish = () => bleedDestroyAnimation(target);
```

The canonical shape is scheduled data:

```ts
sequence(
  call('dagger-strike', daggerParams),
  call('card-bleed-destroy', bleedParams),
);
```

The compiler calculates both absolute intervals before either begins. The
runner starts one timeline and its one completion gates the next beat.

### Expansion budgets

One beat must fit the generated `PresentationExpansionBudget` for the match's
frozen `PlayerPresentationCapacityProfile`:

```ts
interface PresentationExpansionBudget {
  readonly maximumPrimitiveSteps: number;
  readonly maximumVisualTracks: number;
  readonly maximumTimedCues: number;
  readonly maximumAuthoredRoutineDepth: 16;
  readonly maximumCardActors: number;
  readonly maximumEffectActors: number;
}
```

The generator consumes the kernel `ResolutionBudget`, lane/slot capacity, and
the registry-declared finite worst-case expansion cost for every projected
event, trace outcome, routine, target, and created entity. It emits one
versioned profile artifact used by match bootstrap and the compiler. A registry
or kernel-budget change fails generation until the legal-work upper bound is
recomputed and the browser-capacity proof passes. Hand-maintained constants
such as "512 steps" are not accepted as proof.

Every authored routine call path remains capped at depth 16 independent of the
engine's effect-tree depth: engine invocations are finite input data and do not
become recursive routine calls.

Actor capacity is not an unrelated magic number in this budget. The compiler
first builds conservative actor-live **interval envelopes** for every expanded
card and effect use, performs deterministic allocation against those envelopes,
and proves the maximum number of overlapping leases is no greater than the pool
capacity derived from the match's frozen
`PlayerPresentationCapacityProfile`. Non-overlapping envelopes may reuse a
physical actor; overlapping envelopes may not.

For fixed-duration work, the envelope is the exact planned interval. For
`SPEED` work, preparation calculates the earliest possible start using every
preceding speed step's `minDurationMs` and the latest possible end using every
preceding/current speed step's `maxDurationMs`, including authored overlap and
gap rules. After destination geometry binds, the compiler calculates exact
durations and intervals and proves each exact interval is contained by its
reserved envelope. Exact intervals may become smaller or move within the
envelope; they may never extend outside it. A bound duration outside its
declared min/max range or an exact interval outside its envelope is a
validation failure before playback.

The generated artifact is consumed through one `animationBudgets.ts` module.
The ruleset capacity profile, derived actor-pool requirements, and expansion
budgets are validated before match bootstrap and again before beat state
adoption. Therefore a legal committed block from an accepted match profile
must fit. Runtime excess means a malformed/mismatched block and enters the
typed resync path; it is never permission to drop targets or choose a simpler
visual.

## Parameter and geometry contract

Routine parameters describe meaning, not DOM implementation.

```ts
type AuthoredGeometryRef =
  | { readonly kind: 'CARD'; readonly card: SeatCardToken; readonly anchor: CardAnchor }
  | { readonly kind: 'LOCATION'; readonly lane: LaneId; readonly anchor: BoxAnchor }
  | { readonly kind: 'ZONE'; readonly zone: ZoneAnchorKey; readonly anchor: BoxAnchor }
  | { readonly kind: 'LANE'; readonly lane: LaneId; readonly side: 'LOCAL' | 'REMOTE'; readonly anchor: BoxAnchor }
  | { readonly kind: 'VIEWPORT'; readonly x: Normalized; readonly y: Normalized }
  | {
      readonly kind: 'ENTITY';
      readonly entity: SeatEntityRef;
      readonly anchor: CardAnchor | BoxAnchor;
    }
  | {
      readonly kind: 'OFFSET';
      readonly from: AuthoredGeometryRef;
      readonly dx: number;
      readonly dy: number;
    };

type MotionTiming =
  | { readonly kind: 'DURATION'; readonly durationMs: Milliseconds }
  | {
      readonly kind: 'SPEED';
      readonly pixelsPerSecond: PositiveFinite;
      readonly minDurationMs: Milliseconds;
      readonly maxDurationMs: Milliseconds;
    };

interface MotionParams {
  readonly from: AuthoredGeometryRef;
  readonly to: AuthoredGeometryRef;
  readonly timing: MotionTiming;
  readonly easing: EasingId;
  readonly path: MotionPathId;
  readonly effect: MotionEffectPresetId | null;
}
```

`AuthoredGeometryRef` is the only geometry type exposed to routines and content
recipes. The prepared-presentation binder later converts it into an
epoch-specific `PreparedGeometryRef`; the DOM binder resolves that prepared
reference into finite coordinates. Those stages are different types and may
not be cast or structurally substituted for one another.

An `ENTITY` reference is resolved using only seat-projected information:

- a visible card or location resolves to its public card/location geometry;
- a `HIDDEN` entity with an `observableAnchor` resolves only to that zone or
  lane-side anchor;
- a `HIDDEN` entity with no observable anchor resolves to the explicit
  `REDACTED_NO_VISUAL` disposition and cannot produce a geometry track;
- a hidden blocker may drive an anonymous shield/blocked-impact centered on the
  visible attempted target, but never blocker geometry or identity.

There is no inference from hidden identity, canonical server state, array
position, or a default origin.

`DURATION` and `SPEED` are mutually exclusive. After all geometry is bound, a
speed-based duration is calculated once:

```text
durationMs = clamp(
  round(pathLengthPx / pixelsPerSecond * 1000),
  minDurationMs,
  maxDurationMs,
)
```

The resulting duration is frozen before schedule compilation. Authors never
pass `DOMRect`, `HTMLElement`, CSS selectors, arbitrary keyframe objects, or a
free-form effect string. Paths, easings, effects, sounds, and card anchors are
closed typed preset IDs.

Parameters may also carry source/target tokens, face state, scale, rotation,
stagger interval, sound preset, effect intensity, and semantic reason. They may
not carry callbacks.

## Basic animation library

The library has three layers. Higher layers compose lower layers; callers use
the highest routine that expresses the committed event.

### Primitive tracks

| Routine | Responsibility |
| --- | --- |
| `translate` | Move one actor between bound geometry references. |
| `arc-translate` | Move on a stable authored arc with the same endpoint contract. |
| `fade` | Animate opacity with explicit start/end values. |
| `scale` | Animate the scale channel without owning translation. |
| `rotate` | Animate a declared rotation channel. |
| `flip-face` | Animate the pre-mounted two-sided face shell through edge-on; no JavaScript swap determines card/location face correctness. |
| `hold` | Extend a visible authored value for an explicit duration. |
| `shake` | Apply a bounded transient impact/camera displacement. |
| `pulse` | Apply a bounded scale/brightness emphasis. |
| `play-sound` | Emit one exact-time audio cue. |
| `emit-effect` | Lease and animate one typed effect actor or managed effect layer. |

### Card and location routines

| Routine | Required composition |
| --- | --- |
| `card-transfer` | source capture, optional lift, path motion, destination handoff |
| `card-draw` | deck-to-hand transfer with seat-authorized face |
| `card-stage` | hand-to-lane transfer; local staged card remains face-up until committed resolution |
| `card-reveal` | enter, face turn/swap, readable apex hold, return, canonical handoff |
| `card-move` | lane-to-lane transfer plus awaited layout motion |
| `card-return-to-hand` | lane-to-hand transfer and destination fan reconciliation |
| `card-discard` | hand exit, discard effect, pile handoff |
| `card-destroy` | impact/effect phase, death phase, destroyed-pile or hidden handoff |
| `card-banish` | distinct banish effect and canonical removal handoff |
| `card-transform` | glitch/cover, edge-safe model swap, reveal/handoff |
| `card-power-change` | affected pulse and exact number transition |
| `card-cost-change` | affected pulse and exact number transition |
| `location-reveal` | tile flip and map fade with identical start/end |
| `location-replace` | outgoing cover, model/map swap, incoming reveal |
| `location-move` | location actor motion plus lane ownership handoff |
| `lane-create` | topology reservation, lane entry, location/card reconciliation |
| `lane-destroy` | governed card exits, location exit, topology collapse |
| `lane-reflow` | awaited FLIP motion for one/two/three fixed-size lanes |

### Shared effect routines

| Routine | Responsibility |
| --- | --- |
| `dagger-strike` | lease a dagger effect actor, travel source-to-target, impact cue, release |
| `card-bleed-destroy` | animate per-card bleeding/death while its card actor remains sole visual owner |
| `blocked-impact` | strike the intended target and show the projected blocker without applying death |
| `projectile-strike` | generic source-to-target projectile with typed art/effect preset |
| `beam-link` | source/target beam with bounded hold and release |
| `buff-burst` | source-to-target positive effect followed by power/cost presentation |
| `debuff-burst` | source-to-target negative effect followed by power/cost presentation |
| `spawn-burst` | cover a created actor's entrance without inventing its identity or destination |
| `target-no-longer-present` | explicit zero-duration diagnostic disposition for projected invalidated/no-change outcomes with no legal visible target |

This catalog is the minimum common language, not a promise that every card has
identical art. A card or location may select different typed presets and
timings while reusing the same lifecycle routine.

### Content ownership and card-specific choreography

Animation behavior never belongs to the simulation engine. The ownership law
is:

```text
engine rules and trace evidence
  -> what happened, source, targets, outcomes, blockers, order

shared presentation routines
  -> reusable visual mechanics and operation-family choreography

card/location presentation recipe
  -> typed routine selection, preset selection, timing parameters, and assets
```

Reusable routines such as `dagger-strike`, `card-bleed-destroy`, and
`multi-target-destroy` live under
`services/playgame/presentation/routines/`. A card-specific recipe composes
those routines and supplies typed parameters. It cannot select gameplay
targets, change outcomes, or mutate state.

The desired content-package shape is:

```text
content/cards/<card-slug>/
  card.json
  presentation.json
  assets/

content/locations/<location-slug>/
  location.json
  presentation.json
  assets/
```

The engine manifest generator imports only authoritative rule data from
`card.json`. The browser presentation-manifest generator imports
`presentation.json` and presentation assets. Server/engine modules cannot import
the presentation manifest or browser routines.

`presentation.json` is data, not executable content code. Its schema permits
only registered routine IDs, closed preset IDs, validated numeric timing/style
parameters, and asset references. It cannot contain code, callbacks, selectors,
loops, expressions, imports, or arbitrary keyframes. Shared executable
choreography exists only in the typed routine registry. The manifest generator
schema-validates every recipe and emits a generated typed manifest; runtime
code never executes a card-authored module.

Operation-family choreography remains shared. For example, the generic
multi-target destroy author owns target iteration, trace validation, blocked
outcomes, staggering, actor acquisition, and cleanup. A Killmonger-like card
recipe selects dagger and bleeding presets and supplies their timing; it does
not reimplement the destroy loop or test its own card definition ID.

A genuinely unique animation begins in that card or location's presentation
recipe by composing shared primitives. When a second content item needs the
same choreography, the composition is promoted to the shared routine registry.
The card recipes then reference the shared routine. This is a source-ownership
move, not a compatibility alias or duplicate implementation.

Every operation family has one required base presentation policy. Optional
content recipes override typed style parameters at build time. The generated
client manifest therefore contains one resolved recipe per content item; the
runtime does not probe for a card-specific implementation and then select a
different emergency path.

### Basic event-to-routine matrix

The exhaustive registry begins with this disposition. `refresh` means the
canonical surface updates inside the beat without a structural actor transfer;
`cue` means an explicitly authored zero-duration or UI routine. Neither means
"unimplemented."

| Committed event family | Basic authored disposition |
| --- | --- |
| `CARD_STAGED` | `card-stage` for remote/committed structural movement; local interactive staging reconciles through the same final handoff contract |
| `CARD_DRAWN` | `card-draw` |
| `CARD_CREATED` | `spawn-burst` plus `card-transfer` selected by committed destination |
| `CARD_ZONE_CHANGED` | `card-transfer` selected by authoritative before/after zones |
| `CARD_REVEALED` | `card-reveal` |
| `CARD_DESTROYED` | `card-destroy`, or claimed by a trace-driven multi-target destroy beat |
| `CARD_BANISHED` | `card-banish` |
| `CARD_DISCARDED` | `card-discard` |
| `CARD_MOVED` / `CARD_RETURNED_TO_LANE` | `card-move` / lane-return transfer |
| `CARD_TRANSFORMED` | `card-transform` |
| `CARD_POWER_CHANGED` / `CARD_COST_CHANGED` | number refresh plus `card-power-change` / `card-cost-change` |
| card tags, text override, counters | surface refresh plus typed pulse only when the data is visible |
| reveal scheduling, play completion | explicit cue/source-emphasis or dispatch-only lifecycle marker |
| energy/max-energy/next-turn bonus changes | resource-counter transition and optional typed resource pulse |
| deck shuffle | deck-stack shuffle routine when the zone is visible; otherwise a seat-safe deck cue |
| location deck initialization | dispatch-only setup while playfield is hidden |
| location create/draw/play | location actor transfer selected by authoritative zones |
| location reveal / turn face-down / show to seats | `location-reveal` or reverse face routine with seat-safe model |
| location replace | `location-replace` |
| locations swapped / location moved | parallel `location-move` plus awaited lane/card layout tracks |
| location removed / returned to deck | location exit/return transfer |
| location tags/counters | surface refresh plus typed pulse when visible |
| lane destruction start/destroyed | one claimed `lane-destroy` beat; governed card destructions retain their own trace-exact subroutines |
| lane creation start/created | one claimed `lane-create` beat; initial hidden setup is dispatch-only by opening contract |
| match setup completed | opening-prelude lifecycle marker |
| turn resolution started | interaction-lock/phase cue; no invented delay |
| turn started | `turn-banner` plus resource/header transitions authored in committed order |
| turn ended | explicit phase cue; no independent timer |
| match ended | result banner and final interaction state |
| `GAMEPLAY_RNG_ADVANCED`, pending-effect scheduled/consumed, OR-window open/close, recursion-limit hit, intent rejected | `NOT_PROJECTED`; these canonical events are absent from `SeatAnimationEvent` because the current seat projector returns `null` |

The projected source union `SeatAnimationEvent['type']` is a closed
discriminated union and is checked with `satisfies` so a newly added projected
event type fails the projector, wire schema, fixture types, and this registry
until all supply one concrete disposition. The architecture fence rejects any
replacement such as `{ type: MatchEvent['type']; data: Record<string,
JsonValue> }`; unprojected canonical events do not masquerade as generic
animation input.

## Effect invocation planning and multi-target beats

### Derived invocation index

Before any beat is prepared, `TransactionPresentationPlanner` builds an
immutable `EffectInvocationIndex` from the complete ordered
`SeatTransactionFrame[]`. Every materialized Frame must preserve
`effect: SeatEffectTraceEntry | null` verbatim from its wire frame. The index is
derived client presentation data; it is not a field supplied by the wire or
engine.

```ts
interface DerivedEffectInvocation {
  readonly token: string;
  readonly parentToken: string | null;
  readonly source: SeatEntityRef;
  readonly ability: SeatAbilityRef;
  readonly candidates: readonly SeatEntityRef[];
  readonly outcomes: readonly DerivedTargetOutcome[];
  readonly children: readonly DerivedEffectInvocation[];
  readonly firstProjectedFrameIndex: number;
  readonly lastProjectedFrameIndex: number;
  readonly childInsertionPoints: readonly DerivedChildInsertionPoint[];
}

interface DerivedTargetOutcome {
  readonly attemptToken: string;
  readonly attemptOrdinal: number;
  readonly operation: string;
  readonly target: SeatEntityRef;
  readonly result: EffectTargetResult;
  readonly blockedBy: readonly SeatEntityRef[];
  readonly reason: EffectOutcomeReason | null;
  readonly projectedFrameIndex: number;
}

interface DerivedChildInsertionPoint {
  readonly childToken: string;
  readonly projectedFrameIndex: number;
  readonly afterParentOutcomeOrdinal: number | null;
  readonly beforeParentOutcomeOrdinal: number | null;
}
```

The planner derives the frame range and child insertion points by scanning
trace entries in projected-array order. Indices address positions in
`SeatTransactionFrame[]`, not canonical Frame numbers; canonical numbers may
contain allowed gaps. A child insertion point records the child's start
position relative to the surrounding parent target outcomes. No author derives
this structure independently.

For each child, `afterParentOutcomeOrdinal` is the greatest parent outcome
ordinal occurring before the child's STARTED entry, or `null` when the child
begins before the parent's first outcome. `beforeParentOutcomeOrdinal` is the
least parent outcome ordinal occurring after the child's COMPLETED entry, or
`null` when it completes after the parent's last outcome. Depth-first trace
nesting requires the child's complete projected range to lie between those
boundaries. A canonical Frame-number gap has no other meaning and cannot be
used as an insertion signal.

The index verifies unique tokens, valid parents, exact nesting, exact candidate
order, contiguous outcome ordinals, completion checksums, and exact projected
frame ranges for any requested grouped beat. Seat projection must retain the
complete start/outcome/completion transcript for every invocation, using
`HIDDEN` references where necessary. An incomplete invocation is a malformed
block rejected before presentation and routed to `RESYNC_REQUIRED`; it is not
silently reduced to a dispatch-only gap.

### Beat partition

```ts
interface PresentationBeat {
  readonly id: string;
  readonly frames: readonly [SeatTransactionFrame, ...SeatTransactionFrame[]];
  readonly before: SeatVisibleMatchState;
  readonly after: SeatVisibleMatchState;
  readonly claim: BeatFrameClaim;
  readonly author: PresentationBeatAuthor;
}
```

The planner starts with one beat per Frame. A typed multi-Frame author may
replace a contiguous range only when:

1. every projected Frame in the range is claimed exactly once;
2. no Frame outside the range is claimed;
3. every mechanical event and effect trace entry in the range has an explicit
   animation or dispatch disposition;
4. the author consumes committed source, candidate, target, result, blocker,
   and ordering evidence rather than selecting targets;
5. all intermediate visible surfaces can be prepared from the projected Frame
   snapshots before adoption;
6. the authored order preserves the invocation tree's causal order;
7. the grouping author passes its event-family-specific proof suite.
8. every intermediate geometry is resolvable from a captured before rectangle,
   a registered zone anchor, a final bound destination, or the shared pure
   layout model. Until the shared layout model exists and passes DOM
   conformance, a grouped beat may not require intermediate lane-slot geometry.

The first required multi-Frame authors are:

- homogeneous multi-target operations such as destroy, banish, power change,
  and cost change;
- contiguous card lifecycle chains such as draw -> stage/play -> reveal;
- location replace -> reveal chains when both facts are visually one action.

Unrecognized or non-contiguous shapes remain one-Frame beats. This is not a
visual fallback: one-Frame presentation is the canonical exhaustive author for
that shape.

### Multi-Frame adoption

A grouped beat is prepared while its first `before` state is mounted. The
prepared owner must preload every authorized model/effect and reserve every
card/location/effect actor interval needed by the claimed Frames. Actors whose
lifetimes do not overlap may reuse one pre-mounted pool slot according to the
validated actor-liveness plan. Mounted sources and every seat-visible derived
surface that would otherwise change at adoption acquire their required pixel
or displayed-value leases before adoption.

`PresentationDirector` then advances all claimed Frames in canonical order in
one synchronous Solid `batch()` with no `await`, microtask, layout read, or
rendering opportunity between advances. It crosses exactly one reactive commit
barrier after the batch and then binds final canonical destinations. The actors
retain sole visual ownership of every intermediate object while the compiled
storyboard runs. The client remains interaction-locked. Individual Frames
remain present in replay and diagnostics even though live DOM paints only the
beat's actor choreography and final canonical state.

Batch adoption may not visibly expose `beat.after` early. Every seat-visible
surface whose displayed value differs between `beat.before`, any claimed
intermediate snapshot, and `beat.after` must have exactly one disposition:

- an owned visual/value track beginning from the currently displayed value;
- a displayed-value lease that freezes the pre-adoption value until the owning
  track begins and hands it off; or
- an explicit non-visual disposition proving the value is not rendered for
  that seat.

This rule includes card cost/power text, lane totals, Energy, hand/deck counts,
turn/header values, location counters, and any future derived UI. Canonical
signals may contain final values after adoption, but renderers consult the
presentation lease until synchronous handoff. An unowned visible value change
during batch adoption is a compilation/claim failure.

If an intermediate surface cannot be prepared without hidden information, the
multi-Frame author is invalid for that seat and that shape must have a separate
seat-safe exhaustive author. It may not reveal the identity, use a placeholder
for an identity that should be visible during the beat, or silently omit the
animation.

### Nested effects

The engine's properly nested invocation tokens form a finite tree. A beat
author may walk that tree and emit child routine calls in committed depth-first
order. This is presentation compilation over already committed data, not
gameplay recursion.

The invocation index also records each child invocation's insertion position
between parent target outcomes. A target program includes any nested child
program caused after that target before control returns to its parent. A
multi-target author may overlap or stagger sibling target programs only when
their claimed trace ranges contain no causally ordered nested work and their
operation author explicitly declares them presentation-commutative. Otherwise
the programs are sequenced in committed depth-first order. Visual speed never
overrides engine causality.

For a Jubilee-like committed chain, the author can compose:

```text
draw child from deck
-> play child to lane
-> reveal child
-> present child's nested On Reveal invocation
-> return to the parent invocation's next committed outcome
```

A draw alone never implies a flip or reveal. The author composes those routines
only when corresponding committed Frames exist. A card's animation routine
cannot manufacture the child reveal, invoke card text, or decide whether the
child effect repeats.

### Multi-target destroy proof: Killmonger shape

For a source with 23 projected candidate cards, the destroy author consumes
all 23 ordered outcomes. Assuming the trace contains no nested on-destroy
subtree between those outcomes, it creates one presentation-commutative child
program per candidate that has a legal visual disposition:

```ts
function cardTargetGeometry(target: SeatEntityRef): AuthoredGeometryRef | null {
  switch (target.kind) {
    case 'CARD':
      return entityAnchor(target, 'center');
    case 'HIDDEN':
      return target.observableAnchor === null
        ? null
        : observableAnchorGeometry(target.observableAnchor);
    case 'LOCATION':
    case 'LANE':
    case 'PLAYER':
    case 'ZONE':
    case 'SYSTEM':
      throw new PresentationContractError(
        `Card-target operation received ${target.kind}`,
      );
  }
}

function daggerParams(
  source: SeatEntityRef,
  target: AuthoredGeometryRef,
): MotionParams {
  return {
    from: entityAnchor(source, 'center'),
    to: target,
    timing: duration(260),
    path: 'FAST_ARC',
    easing: 'IMPACT_OUT',
    effect: 'STEEL_DAGGER_TRAIL',
  };
}

const diagnosticDispositions: DiagnosticDisposition[] = [];
const visualTargetPrograms: AnimationNode[] = [];

for (const outcome of invocation.outcomes) {
  const target = cardTargetGeometry(outcome.target);
  if (target === null || outcome.result === 'INVALIDATED' || outcome.result === 'NO_CHANGE') {
    diagnosticDispositions.push({
      outcome,
      kind: target === null ? 'REDACTED_NO_VISUAL' : 'TARGET_NO_LONGER_PRESENT',
    });
    continue;
  }

  visualTargetPrograms.push(
    outcome.result === 'AFFECTED'
      ? sequence(
          call('dagger-strike', daggerParams(invocation.source, target)),
          call('card-bleed-destroy', {
            target: outcome.target,
            durationMs: milliseconds(420),
            effect: 'CRIMSON_BLEED',
          }),
        )
      : sequence(
          call('dagger-strike', daggerParams(invocation.source, target)),
          call('blocked-impact', {
            target: outcome.target,
            blockers: outcome.blockedBy,
            anonymousBlockerVisual: outcome.blockedBy.some(ref => ref.kind === 'HIDDEN'),
            reason: outcome.reason,
          }),
        ),
  );
}

return parallel(
  dispatchDiagnosticsAtTimeZero(diagnosticDispositions),
  stagger(milliseconds(55), visualTargetPrograms),
);
```

The bleed for each affected target begins at that target's dagger impact; it
does not wait for every dagger. With the example timings, the 23-target beat
finishes in approximately:

```text
260ms dagger + (22 * 55ms stagger) + 420ms death = 1,890ms
```

It does not take `23 * 680ms`, and it does not launch 23 untracked callbacks.
Blocked targets receive a visible blocked impact and never run the death
routine. A hidden blocker is represented only by an anonymous impact on the
legal target geometry. Invalidated/no-change and fully redacted targets receive
only their explicitly authored zero-duration diagnostic disposition and do not
consume a stagger slot. The final affected set must exactly equal projected
`EFFECT_TARGET_RESOLVED(result: AFFECTED)` entries and the completion checksum.

The 1,890 ms example assumes the stated absence of nested reactions between
targets. When committed on-destroy or other nested work prevents sibling
programs from being presentation-commutative, the author preserves the
depth-first trace order and total beat time can grow linearly. That longer
causal presentation is correct behavior, not a scheduler defect.

The destroy author is operation-family code. It may not test for a Killmonger
card definition ID.

## End-to-end implementation flow

The production path is deliberately boring and inspectable:

```text
receive one atomic SeatPresentationBlock
-> build and validate EffectInvocationIndex
-> partition all Frames into exact PresentationBeats

for each beat, serially:
  select exhaustive beat/event/effect authors
  -> emit typed AnimationNode tree using shared routines
  -> expand all routine calls and finite target maps
  -> calculate actor/effect/resource requirements
  -> prepare actors, source surfaces, leases, assets, and geometry references
  -> adopt all claimed Frames in one synchronous non-painting batch
  -> cross the reactive commit barrier
  -> bind final geometry and calculate speed-derived durations
  -> flatten and validate one BeatStoryboard
  -> compile all absolute keyframes and cues
  -> start one WAAPI master clock
  -> await one completion
  -> perform canonical handoff and cleanup
  -> continue to the next beat
```

Responsibility is split as follows:

- `TransactionPresentationPlanner` understands Frame/effect structure but not
  DOM or keyframes;
- `BeatStoryboardRegistry` selects operation/event authors but not game
  targets;
- animation routine definitions understand reusable visual choreography but
  not server transport or card rules;
- `BeatStoryboardExpander` removes calls, sequences, parallels, and staggers;
- the prepared beat owner acquires all DOM-backed resources;
- `StoryboardCompiler` binds geometry and calculates one immutable timeline;
- `StoryboardRunner` owns playback and the only completion promise;
- `PresentationDirector` owns state adoption and serial beat progression.

No other layer may skip, restart, recursively invoke, or independently await a
committed animation.

## Authoring contracts

The exact TypeScript spelling may change only if the same invariants remain
statically expressible.

### Time values

```ts
declare const millisecondsBrand: unique symbol;

type Milliseconds = number & {
  readonly [millisecondsBrand]: 'Milliseconds';
};

function milliseconds(value: number): Milliseconds;
```

`milliseconds()` must reject:

- `NaN`;
- positive or negative infinity;
- negative values;
- unsafe integers;
- fractional values unless sub-millisecond authoring is deliberately added
  later with corresponding tests.

Raw numbers from server data never become durations.

### Storyboard and steps

```ts
interface BeatStoryboard {
  readonly id: string;
  readonly source:
    | {
        readonly kind: 'BEAT';
        readonly transactionId: string;
        readonly firstFrame: number;
        readonly lastFrame: number;
      }
    | { readonly kind: 'TRANSACTION_PRELUDE'; readonly transactionId: string };
  readonly steps: readonly StoryboardStep[];
}

interface StoryboardStep {
  readonly id: string;
  readonly durationMs: Milliseconds;
  readonly nextStepAfterMs: Milliseconds;
  readonly tracks: readonly VisualTrackSpec[];
  readonly cues: readonly StoryboardCue[];
}
```

Step IDs must be unique within a storyboard. Track IDs and cue IDs must also
be unique within their respective storyboard.

`nextStepAfterMs` is explicit in stored authored data. A builder may default it
to `durationMs`, but the resulting `BeatStoryboard` must contain the concrete
value so inspection never depends on builder defaults.

### Visual target references

Authored storyboards refer to semantic targets rather than DOM selectors:

```ts
type VisualTargetRef =
  | { readonly kind: 'CARD_ACTOR'; readonly card: SeatCardToken }
  | { readonly kind: 'CARD_CANONICAL'; readonly card: SeatCardToken }
  | { readonly kind: 'CARD_ACTOR_ROOT'; readonly card: SeatCardToken }
  | { readonly kind: 'CARD_ACTOR_RESTING_SHELL'; readonly card: SeatCardToken }
  | { readonly kind: 'CARD_ACTOR_FACE_SHELL'; readonly card: SeatCardToken }
  | { readonly kind: 'ZONE_ANCHOR'; readonly zone: ZoneAnchorKey }
  | { readonly kind: 'LOCATION_ACTOR'; readonly lane: LaneId }
  | { readonly kind: 'LOCATION_CANONICAL'; readonly lane: LaneId }
  | { readonly kind: 'LOCATION_MAP'; readonly lane: LaneId }
  | { readonly kind: 'LANE'; readonly lane: LaneId }
  | { readonly kind: 'PLAYFIELD' }
  | { readonly kind: 'TURN_BANNER' };
```

The binder owns the only mapping from these references to live elements. A
storyboard author may not call `querySelector`, read layout, or hold an
`HTMLElement`.

### Visual channels

Every animatable target exposes named channels with exclusive property
ownership:

```ts
type VisualChannel =
  | 'layout'       // left, top, width, height
  | 'opacity'
  | 'resting-pose' // non-cinematic card rotation
  | 'face-turn'    // rotateY and face-edge behavior
  | 'scale'
  | 'map-opacity'
  | 'lane-position'
  | 'banner-pose'
  | 'effect';
```

Channel ownership prevents two unrelated systems from concatenating or
overwriting the same `transform` string. For card actors:

- actor root owns layout and opacity;
- resting shell owns resting rotation;
- face shell owns scale and `rotateY`;
- surface renderer owns static face content;
- transient effect layers own their own effect properties.

The compiler rejects overlapping property ownership on the same concrete
element. There is no last-writer-wins behavior.

### Track specifications

```ts
type VisualTrackSpec =
  | ElementTrackSpec
  | CardGeometryTrackSpec
  | LayoutFlipTrackSpec
  | ManagedEffectTrackSpec;

interface ElementTrackSpec {
  readonly kind: 'ELEMENT';
  readonly id: string;
  readonly target: VisualTargetRef;
  readonly channel: VisualChannel;
  readonly keyframes: readonly RelativeStyleKeyframe[];
}

interface RelativeStyleKeyframe {
  readonly atMs: Milliseconds;
  readonly styles: Readonly<Record<AnimatableStyleProperty, string | number>>;
  readonly easing?: string;
}

interface CardGeometryTrackSpec {
  readonly kind: 'CARD_GEOMETRY';
  readonly id: string;
  readonly card: SeatCardToken;
  readonly from: AuthoredGeometryRef;
  readonly to: AuthoredGeometryRef;
  readonly easing: string;
  readonly opacity?: { readonly from: number; readonly to: number };
}

interface LayoutFlipTrackSpec {
  readonly kind: 'LAYOUT_FLIP';
  readonly id: string;
  readonly targets: readonly VisualTargetRef[];
  readonly easing: string;
}

interface ManagedEffectTrackSpec {
  readonly kind: 'MANAGED_EFFECT';
  readonly id: string;
  readonly effect: PresentationEffectRef;
  readonly target: VisualTargetRef;
  readonly localStartMs: Milliseconds;
  readonly durationMs: Milliseconds;
}
```

Every relative keyframe time must fall within its owning step's inclusive
`[0, durationMs]` range. A track fragment with no keyframes is invalid.

During preparation, authored references are converted into epoch-specific
references:

```ts
type PreparedGeometryRef =
  | {
      readonly kind: 'CAPTURED_SOURCE';
      readonly card: SeatCardToken;
      readonly sourceEpoch: GeometryEpoch;
    }
  | {
      readonly kind: 'CANONICAL_DESTINATION';
      readonly card: SeatCardToken;
      readonly destinationEpoch: GeometryEpoch;
    }
  | {
      readonly kind: 'INTERMEDIATE_LANE_SLOT';
      readonly card: SeatCardToken;
      readonly lane: LaneId;
      readonly side: 'LOCAL' | 'REMOTE';
      readonly projectedSnapshotIndex: number;
    }
  | { readonly kind: 'ZONE_ANCHOR'; readonly zone: ZoneAnchorKey }
  | { readonly kind: 'VIEWPORT_POINT'; readonly x: Normalized; readonly y: Normalized }
  | { readonly kind: 'GENERATED_ORIGIN'; readonly origin: GeneratedOriginPresetId };

interface BoundGeometry {
  readonly rect: FiniteReadonlyRect;
  readonly anchorPoint: FinitePoint;
  readonly geometryEpoch: GeometryEpoch | null;
}
```

The preparation binder chooses the source epoch for the first segment, a pure
projected-layout result for every intermediate lane slot, and the final
destination epoch for the last segment. The geometry binder then resolves each
`PreparedGeometryRef` to `BoundGeometry` before compilation. There is no
`UNKNOWN`, nullable, default rectangle, `(0, 0)` geometry, or runtime search for
"whatever anchor currently exists."

### Cues

```ts
type StoryboardCue =
  | AudioCue
  | NoncriticalSurfaceSwapCue
  | HapticCue
  | CameraCue
  | DiagnosticCue;

interface CueBase {
  readonly id: string;
  readonly atMs: Milliseconds;
}

interface AudioCue extends CueBase {
  readonly kind: 'AUDIO';
  readonly sound: PresentationSoundId;
  readonly volume: number;
}

interface NoncriticalSurfaceSwapCue extends CueBase {
  readonly kind: 'SURFACE_SWAP';
  readonly surface: NoncriticalSurfaceId;
  readonly variant: NoncriticalSurfaceVariantId;
}

interface HapticCue extends CueBase {
  readonly kind: 'HAPTIC';
  readonly pattern: PresentationHapticId;
}

interface CameraCue extends CueBase {
  readonly kind: 'CAMERA';
  readonly effect: PresentationCameraEffectId;
}

interface DiagnosticCue extends CueBase {
  readonly kind: 'DIAGNOSTIC';
  readonly label: string;
}
```

Cue `atMs` is relative to the owning step and must fall within the step's
inclusive interval.

`NoncriticalSurfaceId` is generated only from surfaces whose correctness does
not determine a card/location face, hidden identity, geometry, score, resource,
or gameplay-readable value. Card/location face shells are deliberately
unrepresentable by this cue type. Validation also rejects any generated
noncritical-surface registration that resolves inside a card or location face
actor.

Cues are synchronous edge notifications. They may not:

- return a promise that controls timeline completion;
- call gameplay commands;
- adopt match state;
- enqueue another committed Frame;
- start an unowned visual duration;
- install their own timer;
- remove resources owned by the storyboard.

If a visual behavior has duration, it is a visual or managed-effect track. If
a pause is required after an audio cue, the storyboard authors an explicit
hold step. The natural length of an audio asset is not used as timeline truth.

## Schedule compilation

Compilation is deterministic data processing. It does not mutate the DOM and
does not start an animation.

### Step start and end calculation

Given ordered steps `S0..Sn`, let:

```text
start(0) = 0
end(i) = start(i) + duration(i)
start(i + 1) = start(i) + nextStepAfter(i)
```

The accumulated cursor advances by `nextStepAfterMs`, not by `durationMs`.

Therefore:

- `nextStepAfterMs === durationMs` means sequential steps;
- `nextStepAfterMs < durationMs` means overlap;
- `nextStepAfterMs > durationMs` means a deliberate gap;
- `nextStepAfterMs === 0` means the next step begins simultaneously.

Example:

| Step | Duration | Next starts after | Absolute start | Absolute end |
|---|---:|---:|---:|---:|
| Enter | 400 | 300 | 0 | 400 |
| Flip | 350 | 350 | 300 | 650 |
| Hold | 500 | 500 | 650 | 1150 |
| Return | 300 | 300 | 1150 | 1450 |

The canonical storyboard duration is:

```text
max(
  every step end,
  every managed effect end,
  every absolute cue time
)
```

For the example it is 1450 milliseconds, not the sum of all durations.

### Absolute track and cue time

For a relative keyframe or cue in step `i`:

```text
absoluteTime = start(i) + localAtMs
```

Stable cue order is:

1. absolute time;
2. step ordinal;
3. cue ordinal within the step.

Two cues at the same time are both valid and execute in that stable order.

### Keyframe normalization

The compiler groups visual fragments by concrete target and channel. It emits
one normalized property timeline for each owned channel.

For a compiled storyboard duration `T > 0`:

```text
waapiOffset = absoluteTime / T
```

Every emitted offset must be finite and within `[0, 1]`.

The compiler inserts explicit hold values where a property must remain stable
between authored changes. A hold is not a JavaScript wait. It is two keyframes
with the same value at different absolute times.

The compiler must also establish a value at time zero and at total duration for
every channel it owns. Those values come from the prepared source, the authored
track, or the final canonical destination. They may not come from an unrelated
computed-style default that can change during playback.

### Discontinuities

A permitted instantaneous noncritical visual discontinuity must be represented
as an explicit cue. It may not be smuggled into two imperative timers.

For card and location flips, a pre-mounted two-sided renderer using
`backface-visibility` is mandatory. Both seat-authorized faces are ready before
playback, and the face change is therefore a pure visual track sharing the
master clock. A timing-sensitive JavaScript `SURFACE_SWAP` cue may not
determine card/location face correctness. Surface-swap cues remain available
only for noncritical surfaces whose contract explicitly permits a
discontinuity.

### Easing

Easing belongs to the interval beginning at an authored keyframe. The compiler
must preserve authored per-segment easing. Unknown or invalid easing strings
are compile errors.

There is no global CSS easing rule that silently changes an authored track.

### Conflict detection

Compilation fails if:

- two overlapping tracks own the same target, channel, and property;
- a track targets an element outside the mounted play presentation root;
- a required semantic target cannot be bound;
- geometry is missing or has non-finite values;
- an actor or visibility lease was not prepared before adoption;
- an authored final face disagrees with the canonical destination face;
- a keyframe lies outside its step;
- a cue lies outside its step;
- a managed effect extends beyond its declared duration;
- a storyboard contains duplicate IDs;
- the total duration is non-finite or unsafe.

Compilation errors do not select a pop, fade, teleport, clone, or no-animation
path.

### Zero-duration storyboards

A storyboard with no visual duration may contain time-zero cues and synchronous
handoff work. It completes in the same microtask after those cues and handoffs
run exactly once.

A required structural movement may not be authored as zero duration in the
normal animation profile.

## Prepared presentation lifecycle

The current loose `beforeFrame`/`afterFrame` pair will be replaced by one
explicit resource owner.

Recommended contract:

```ts
interface MatchPresentationSink {
  prepareTransaction?(
    frames: readonly SeatTransactionFrame[],
    signal: AbortSignal,
  ): Promise<PreparedTransactionPresentation | null>;

  prepareBeat(
    beat: PresentationBeat,
    signal: AbortSignal,
  ): Promise<PreparedBeatPresentation>;

  afterTransaction?(
    signal: AbortSignal,
  ): Promise<void>;
}

interface PreparedBeatPresentation {
  readonly beatId: string;
  readonly firstFrame: number;
  readonly lastFrame: number;
  readonly declaredDurationMs: number;
  present(
    signal: AbortSignal,
    adopt: () => Promise<void>,
  ): Promise<PresentationOutcome>;
  cancel(reason: PresentationCancelReason): void;
}

interface PreparedTransactionPresentation {
  readonly transactionId: string;
  readonly declaredDurationMs: number;
  present(signal: AbortSignal): Promise<PresentationOutcome>;
  cancel(reason: PresentationCancelReason): void;
}
```

`PreparedBeatPresentation` is opaque to `PresentationDirector`. The sink owns
its concrete type and all browser resources inside it.

### Before adoption

`prepareBeat()` runs against the currently mounted representation of
`beat.before`. It must:

1. select exhaustive storyboard authors for every claimed event/effect;
2. derive seat-safe transfers from every claimed Frame snapshot;
3. capture all source geometry and source face/models;
4. acquire permanent actors;
5. acquire visibility leases for mounted sources;
6. reserve required destination layout space;
7. preload all authorized raster/surface content used by the beat;
8. diff every rendered derived value across claimed snapshots and acquire its
   required value lease or prove it is not rendered;
9. expand routine calls, allocate actor-live intervals, and build the immutable
   semantic storyboard;
10. return one prepared resource owner.

Preparation may be asynchronous for actual asset readiness. The director must
await it before adopting any Frame in the beat. Asset preparation does not count as
storyboard time because no visual clock has started.

### Authored adoption handoff

Only `PresentationDirector` may create the one-shot `adopt()` capability and
only the prepared beat owner may invoke it. For a one-Frame beat it adopts that
Frame's `after` state. For a multi-Frame beat it advances every claimed Frame
in canonical order inside one synchronous non-painting batch, leaving the live
state at `beat.after`.

The prepared owner keeps canonical rendering at `beat.before` while its actors
present the transition. At the storyboard's authored handoff cue it freezes
the actors in their final pose and calls `adopt()`. The state write inside
`adopt()` is synchronous and non-painting; its returned promise crosses the
pre-paint reactive commit barrier. The owner must keep its actors and leases
mounted until that promise settles, then remove them so the already-committed
canonical DOM takes over the same pixels.

`adopt()` is single-use. Completing without calling it or calling it more than
once is a presentation-contract failure. Animation code may never look up a
newly adopted element in order to begin: all required actors, geometry, and
models must have been prepared from `beat.before` plus the seat-safe committed
Frame data.

### Presentation and cleanup

`present()` must:

1. use only the prepared owner resources and immutable storyboard;
2. mount or activate all storyboard-owned effects;
3. start the compiled timeline once;
4. await its authored handoff cue;
5. freeze actor final poses and invoke `adopt()` synchronously;
6. await the reactive commit promise returned by `adopt()`;
7. release all actors, visibility/value leases, reservations, effects, and
   inline animation state;
8. resolve only after cleanup is complete.

No resource may be acquired outside the prepared owner and cleaned by another
service later.

## PresentationDirector contract

`PresentationDirector` remains the only committed-state adoption authority.
`TransactionPresentationPlanner` is pure: it partitions Frames but cannot
adopt them or start presentation.

Its canonical loop becomes:

```ts
const transactionPrelude = await sink.prepareTransaction?.(
  timeline.frames,
  signal,
);
if (transactionPrelude) await transactionPrelude.present(signal);

const beats = planner.partition(timeline.frames);
for (const beat of beats) {
  const prepared = await sink.prepareBeat(beat, signal);
  let adoptionPromise: Promise<void> | null = null;
  const adopt = () => {
    if (adoptionPromise) throw new Error('beat adopted twice');
    cursor.advanceBatch(beat.frames);
    adoptionPromise = reactiveCommitBarrier();
    return adoptionPromise;
  };
  await prepared.present(signal, adopt);
  if (!adoptionPromise) throw new Error('beat completed without adoption');
  await adoptionPromise;
}

await sink.afterTransaction?.(signal);
```

`cursor.advanceBatch()` is synchronous, contains no `await`, microtask, DOM
layout read, or foreign callback. Exactly one `reactiveCommitBarrier()` follows
each beat adoption. The exact implementation must still guard generation
changes before and after every awaited boundary.

The director may maintain a timeout watchdog as a defect detector. A watchdog:

- is not the animation clock;
- is not normal completion;
- may not resolve a presentation as successful;
- may not select another visual implementation;
- must cancel owned resources and enter the explicit `RESYNC_REQUIRED`
  recovery path defined below.

The normal playback watchdog budget must be derived from declared work after
compilation:

```text
watchdogBudget =
  preparationBudget
  + (compiledTotalDuration / effectivePlaybackRate)
  + boundedDiagnosticGrace
```

It must not be a fixed value that rejects a valid long or debug-slow
storyboard. Preparation/resource loading may have its own bounded failure
budget, but expiration is still failure rather than permission to animate a
placeholder.

An explicit user/developer fast-forward is different from failure recovery. It
must cancel/clean the active presentation owner, deliberately adopt the
transaction `postState`, release the presentation-block lock, restore the
interaction mode allowed by that post-state, and record its use in diagnostics.

An unexpected compile, target, actor, timeout, or runner failure must not
silently snap and continue playing later Frames. It cancels and cleans the
active owner, adopts the transaction `postState`, releases the
presentation-block lock, enters `RESYNC_REQUIRED`, and requests a fresh
seat-projected snapshot. Gameplay commands remain disabled by
`RESYNC_REQUIRED` until that snapshot installs. This is protocol recovery, not
successful presentation and not an alternate animation path.

Queue invalidation, resync request/snapshot/ack messages, delivery epochs, and
revision restart semantics are owned by the wire spec's “Snapshot, reconnect,
and resync” contract. Presentation code may not invent a second recovery queue
policy.

## WAAPI driver and master clock

The runner will use the browser's Web Animations API through a small injected
driver. Storyboard authors and tests must not call `Element.animate()`
directly.

Recommended driver contract:

```ts
interface AnimationTimelineDriver {
  compileTrack(track: CompiledVisualTrack): TimelineAnimation;
  createClock(durationMs: Milliseconds): TimelineClock;
  startTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void;
  pauseTogether(
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): SuspendedTimeline;
  resumeTogether(
    suspended: SuspendedTimeline,
    clock: TimelineClock,
    animations: readonly TimelineAnimation[],
  ): void;
  subscribeWakeups(
    onWakeup: (kind: 'ANIMATION_FRAME' | 'COARSE') => void,
  ): () => void;
}

interface SuspendedTimeline {
  readonly masterCurrentTimeMs: Milliseconds;
}

interface TimelineClock {
  readonly currentTimeMs: number;
  readonly finished: Promise<void>;
  play(): void;
  pause(): void;
  cancel(): void;
  setPlaybackRate(rate: number): void;
}
```

The browser implementation creates:

- one master `Animation` on `document.timeline` with the canonical duration;
- one WAAPI animation for each compiled target/channel track;
- one shared start origin for the master and all tracks.

Every visual animation uses the same total duration and globally normalized
offsets, or otherwise receives an exactly equivalent delay/start-time binding
to the same origin. Calling `animate()` sequentially and accepting slightly
different implicit start times is not sufficient.

The runner resolves completion only after:

1. the master clock has reached total duration;
2. every required WAAPI track has fulfilled its `finished` promise;
3. all due cues have been dispatched once;
4. all managed visual effects have completed;
5. final canonical handoff and cleanup have completed.

There is no successful `setTimeout(totalDuration)` path and no
`transitionend`/timeout race.

### CSS relationship

CSS continues to own static appearance, layout, colors, typography, and the
normal non-animated canonical state. The compiled timeline owns dynamic
time-varying values for committed presentation.

- Storyboard playback uses WAAPI keyframe objects; it does not inject a new
  `<style>` element per run.
- A property controlled by a running storyboard must not also have a CSS
  `transition` or CSS `animation` that changes the same property.
- WAAPI tracks use explicit start and end values and active fill while running.
- Finished animations are not left indefinitely in `fill: forwards` state.
- Before track cancellation/removal, the runner transfers the final visible
  state to its canonical owner or performs actor handoff in the same task.
- Temporary actors are parked or removed only after canonical ownership is
  ready.

CSS keyframes remain permitted for UI animation that is genuinely outside
committed presentation and for persistent state-driven effects, provided those
effects do not claim the same properties or completion contract.

## Cue scheduling

CSS and WAAPI do not execute arbitrary JavaScript at intermediate keyframes.
The runner therefore owns one cue scheduler driven by the master animation's
`currentTime`. It uses both animation-frame wakeups and one coarse bounded
wakeup timer. Neither wakeup is a clock: every dispatch decision samples the
master time. The coarse wakeup prevents cue starvation in environments that
throttle animation frames while still presenting the document.

On each driver tick the scheduler:

1. reads the current master time;
2. takes every undispatched cue whose absolute time is less than or equal to
   that time;
3. dispatches them in stable compiled order;
4. marks them dispatched before invoking the cue port;
5. never dispatches them again.

The scheduler does not create one timer per cue.

For every cue it records `dispatchedAtMasterTimeMs` and
`latenessMs = dispatchedAtMasterTimeMs - atMs`. Product profiles declare a
bounded cue-lateness tolerance; exceeding it is diagnostic evidence and a test
failure, not permission to reorder or drop the cue.

At normal completion it performs one final due-cue drain at total duration
before handoff. On cancellation it dispatches no future cues.

### Visibility suspension

When the document becomes hidden during a storyboard, the runner first samples
and stores the master `currentTime` once, then pauses the master and every
visual track as one operation. On resume it samples one new
`document.timeline.currentTime`, rebases the master and every track from the
stored master time and that single origin, and restarts the cue wakeups. A
track's independently sampled time is never authoritative and sequential
`play()` calls may not establish independent origins.

This prevents:

- visual completion while request-animation-frame cue dispatch is suspended;
- several delayed sounds firing together on return;
- the director advancing through an unseen transaction;
- cleanup occurring while the browser was unable to paint the final state.

An audio cue already dispatched before suspension is not rewound. Audio policy
may pause long-form narration separately, but ordinary one-shot SFX remain
one-shot cues.

## Audio contract

Presentation audio becomes a required injected capability:

```ts
interface PresentationAudioPort {
  play(cue: Readonly<{
    sound: PresentationSoundId;
    volume: number;
    storyboardId: string;
    cueId: string;
  }>): void;
}
```

The port is always present.

- Normal mode binds it to the authoritative audio service.
- Muted mode binds it to an explicit silent implementation selected by user
  settings.
- Tests bind it to a recording implementation.

Optional chaining is not the audio architecture.

All `PresentationSoundId` values must resolve through a validated manifest at
build/test time. An unknown sound ID is an authoring failure. Browser autoplay
denial or device audio failure is recorded as audio telemetry but cannot
change Frame order, visual completion, or select alternate choreography.

Audio assets are initialized/preloaded outside the cue's critical instant. A
cue invokes playback synchronously from the runner's perspective. The runner
does not await the natural sound length.

If a future voiced line must remain on screen for its entire authored length,
content supplies a validated duration and the storyboard authors a matching
visual hold. Runtime decoding length does not become canonical presentation
time.

## VFX contract

Transient visual effects that visibly occupy time must be owned tracks:

```ts
interface ManagedPresentationEffect {
  readonly animation: TimelineAnimation | null;
  readonly finished: Promise<void>;
  cancel(): void;
  dispose(): void;
}
```

The storyboard declares the effect's start and duration. The effect adapter
receives the shared clock/origin and may not create an independent cleanup
timer.

Examples:

- power flash;
- destroy burst;
- glitch flash;
- movement trail;
- camera shake with visible duration;
- location glow;
- card reveal halo.

Persistent effects derived from ongoing state are not committed beat
storyboards. They remain state-reconciled render layers with explicit state
ownership, but their controlling values enter through the
`PresentationReadModel` and participate in the surface-binding manifest and
lease audit. They must not be mistaken for transient event VFX and must not
delay beat completion.

Particle systems may use an internal render loop, but their progress and
termination for a managed transient effect must derive from the storyboard
clock. `Date.now()` cleanup deadlines are not permitted for storyboard-owned
effects.

## Permanent actor and visibility contract

### Actor pool

The play motion surface owns a fixed pool of pre-mounted card actors. An actor
is a stable DOM node containing one mounted `CardSurface` renderer.

Pool sizing is derived from the same frozen
`PlayerPresentationCapacityProfile` supplied to the kernel, runtime, and
presentation at match bootstrap. For the standard ruleset, three active lanes
times four cards per owner establishes a maximum of 24 simultaneously resident
board cards. The standard presentation profile pre-mounts 32 card actors and
32 general effect actors, but those values are accepted only because generated
worst-case beat proofs show they cover the profile. The number 32 is a
validated product choice, not the proof itself.

Capacity represents the maximum number of overlapping live intervals, not the
total number of cards or effects touched by a beat. Preparation expands the
entire beat and creates an immutable plan:

```ts
interface ActorLeasePlan {
  readonly cardAssignments: readonly ActorIntervalAssignment[];
  readonly effectAssignments: readonly ActorIntervalAssignment[];
  readonly maximumSimultaneousCardActors: number;
  readonly maximumSimultaneousEffectActors: number;
}

interface ActorIntervalAssignment {
  readonly semanticUseId: string;
  readonly poolIndex: number;
  readonly earliestStartMs: Milliseconds;
  readonly latestEndMs: Milliseconds;
}
```

The allocator sorts envelopes by
`(earliestStartMs, latestEndMs, semanticUseId)`, releases an assignment when its
half-open `[earliestStartMs, latestEndMs)` envelope has ended, and assigns the
lowest available stable pool index. Zero-duration diagnostic dispositions do
not allocate actors. Thus a 23-target stagger may reuse actors whose
death/effect envelopes no longer overlap, but can never reuse one that could
remain visible for any legal bound geometry.

Effect actors do not contain `CardSurface` and do not consume card actors. An
effect preset selects a renderer already mounted inside an effect actor; it
does not create arbitrary DOM during playback.

If future rules increase simultaneous board occupancy, the authoritative lane
capacity profile, generated worst-case choreography corpus, and derived pool
minimum must be updated together. A browser-presented match whose profile
exceeds its validated pool capacity is rejected before match creation; it
cannot discover that mismatch during a turn.

Actor exhaustion is a contract failure. It does not authorize DOM cloning,
teleporting, popping, or actor creation outside the pool.

### Session responsibility

`CardMotionSession` continues to own:

- one acquired actor;
- source and destination visibility leases;
- captured source model and geometry;
- canonical endpoint validation;
- final face/model agreement;
- handoff and cancellation cleanup.

It stops owning:

- CSS transition strings;
- midpoint timers;
- duration guard timers;
- sequential `animateTo()` waits;
- its own animation clock.

The replacement session API contributes targets and track fragments to the
storyboard builder. One possible shape is:

```ts
interface CardMotionSession {
  readonly cardId: SeatCardToken;
  addGeometryTrack(builder: StoryboardBuilder, spec: CardMotionSpec): void;
  addFaceTrack(builder: StoryboardBuilder, spec: CardFaceMotionSpec): void;
  bindCanonicalDestination(): BoundCardDestination;
  handoff(): void;
  cancel(reason: PresentationCancelReason): void;
}
```

The actor pool remains private. Storyboard authors cannot acquire raw actor
nodes directly.

### Single visual owner

At every instant exactly one representation owns a card's pixels:

```text
canonical source
  -> prepared actor
  -> running actor
  -> canonical destination
```

Source capture and lease acquisition happen before state adoption. Destination
lease acquisition happens after adoption but before paint. Actor removal and
canonical visibility restoration occur synchronously in one handoff task.

There is never a frame in which both representations are visibly painted or
neither representation is prepared to paint.

### Derived-value leases

Card pixel ownership is not sufficient for an atomic multi-frame beat. Adopting
all claimed Frames may immediately change counters and derived values in the
canonical DOM even though the animation has not reached those moments. The
play surface therefore owns one `PresentationValueLeaseRegistry` alongside the
visibility registry.

```ts
// Current generated core families; this union is generated, not hand-edited.
type PresentationValueKey =
  | `card:${SeatCardToken}:power`
  | `card:${SeatCardToken}:cost`
  | `lane:${LaneId}:${'LOCAL' | 'REMOTE'}:total`
  | `seat:${Seat}:energy`
  | `seat:${Seat}:hand-count`
  | `seat:${Seat}:deck-count`
  | `turn:number`
  | `turn:phase`
  | `location:${LaneId}:counter:${string}`;

interface PresentationValueLease<T> {
  readonly key: PresentationValueKey;
  readonly displayValue: T;
  updateAtCue(nextValue: T): void;
  handoffCanonical(): void;
  cancel(): void;
}

interface PresentationValueLeaseRegistry {
  acquire<T>(
    key: PresentationValueKey,
    initialDisplayValue: T,
    ownerBeatId: string,
  ): PresentationValueLease<T>;
  displayedValue<T>(key: PresentationValueKey, canonicalValue: T): T;
  assertNoOwner(key: PresentationValueKey): void;
  assertEmpty(): void;
}

type PresentationSurfaceBindingManifest = Readonly<Record<
  PresentationSurfaceBindingId,
  PresentationSurfaceBindingDefinition<unknown>
>>;

type PresentationSurfaceDisposition =
  | 'DISPLAYED_VALUE_LEASE'
  | 'ACTOR_OWNED_PIXELS'
  | 'PERSISTENT_VISUAL_STATE'
  | 'NOT_RENDERED';

type NonRenderedReason =
  | 'SEAT_REDACTED'
  | 'STATE_NOT_APPLICABLE'
  | 'SURFACE_DISABLED_BY_PROFILE'
  | 'OUTSIDE_ACTIVE_LAYOUT';

interface PresentationSurfaceBindingDefinition<TValue> {
  readonly bindingId: PresentationSurfaceBindingId;
  readonly rendererModules: readonly RendererModuleId[];
  readonly canonicalInputPaths: readonly SeatVisibleStateFieldPath[];
  enumerate(
    state: SeatVisibleMatchState,
    viewerSeat: Seat,
  ): readonly PresentationSurfaceInstance<TValue>[];
}

interface PresentationSurfaceInstance<TValue> {
  readonly key: PresentationValueKey;
  readonly disposition: PresentationSurfaceDisposition;
  readonly canonicalValue: TValue;
  readonly nonRenderedReason: NonRenderedReason | null;
}

interface PresentationReadModel {
  value<K extends PresentationValueKey>(key: K): PresentationValueFor<K>;
  surfaceDisposition(key: PresentationValueKey): PresentationSurfaceDisposition;
}

interface MountedPresentationSurfaceRegistry {
  register(
    bindingId: PresentationSurfaceBindingId,
    key: PresentationValueKey,
    rendererModule: RendererModuleId,
  ): () => void;
  snapshot(): readonly MountedPresentationSurface[];
  assertMatches(expected: readonly PresentationSurfaceInstance<unknown>[]): void;
}
```

The build generates one closed `PresentationSurfaceBindingManifest`, the
`PresentationValueKey` union, and its `PresentationValueFor<K>` value mapping
from registered binding declarations. The entries shown above are the required
core families, not an escape hatch for future UI.
Adding a new derived rendering—including a cards-remaining label, status badge,
or ongoing-effect glow—requires a manifest binding and therefore extends the
generated key union.

Every play renderer receives committed match data only through
`PresentationReadModel`; it cannot import, accept, or dereference raw
`SeatVisibleMatchState`/canonical signals. The read model resolves an active
presentation lease first and canonical state second. There is exactly one
owner per key. A lease is acquired before the non-painting adoption batch,
advances only through a compiled value track or exact cue, and hands off
synchronously when its displayed value equals the beat's canonical final
value.

An AST/source architecture fence rejects direct committed-state reads anywhere
in the play renderer module graph except generated binding selectors, the
planner, and the state-only replay inspector. It also verifies that every
manifest-listed renderer calls the read-model accessor for its registered
surface. Persistent state-derived visual layers must register as
`PERSISTENT_VISUAL_STATE` and read their controlling state through the same
path; if that state changes inside a beat, the layer receives a value/visual
lease or actor-owned track exactly like a text counter.

During preparation the planner diffs every visible derived surface across all
claimed snapshots. Each changing key must have exactly one of:

- an actor/visual track that owns its pixels for the entire interval;
- a `PresentationValueLease` and an authored value track/cue sequence; or
- a manifest instance with disposition `NOT_RENDERED`, a non-null stable
  reason, and no mounted renderer registration for that key.

Preparation evaluates the manifest enumerators against `beat.before`, every
claimed projected snapshot, and `beat.after`, then reconciles the expected
rendered instances against the mounted surface registry. A missing registration
for an expected rendered instance, a mounted instance declared `NOT_RENDERED`,
or a direct raw-state read is a contract failure. This is the machine-checkable
non-rendered proof; absence from the DOM by itself is not proof.

An unowned changing visible value is a claim/compile failure. Cleanup asserts
that no value lease, visibility lease, or actor assignment survives handoff.

### Face readiness

Face-down actors are immediately paintable. Before a face-up reveal begins,
the prepared presentation must have the immutable authorized front
`CardSurfaceModel` and its raster artifact ready.

The card face at the cinematic apex cannot depend on a component mounting,
font loading, network response, or raster generation after the storyboard
clock starts.

## Layout and geometry contract

### Pure canonical layout model

Intermediate lane geometry is calculated by the same pure layout model that
places canonical lanes and card slots:

```ts
interface LaneLayoutInput {
  readonly activeLaneOrder: readonly LaneId[];
  readonly playfieldRect: FiniteReadonlyRect;
}

interface LaneSlotLayoutInput {
  readonly lane: ProjectedLaneSnapshot;
  readonly laneRect: FiniteReadonlyRect;
  readonly constants: Readonly<LaneLayoutConstants>;
}

interface LaneLayoutConstants {
  readonly laneWidthPx: PositiveFinite;
  readonly laneHeightPx: PositiveFinite;
  readonly laneGapPx: NonNegativeFinite;
  readonly cardWidthPx: PositiveFinite;
  readonly cardHeightPx: PositiveFinite;
  readonly cardGapPx: NonNegativeFinite;
  readonly locationBandHeightPx: PositiveFinite;
  readonly localBand: Readonly<FiniteReadonlyRect>;
  readonly remoteBand: Readonly<FiniteReadonlyRect>;
  readonly restingRotationsDeg: readonly FiniteNumber[];
}

interface CardPlacement {
  readonly rect: FiniteReadonlyRect;
  readonly slotIndex: number;
  readonly restingRotationDeg: FiniteNumber;
  readonly zIndex: number;
}

function layoutActiveLanes(input: LaneLayoutInput): ReadonlyMap<LaneId, FiniteReadonlyRect>;

function layoutLaneSlots(
  input: LaneSlotLayoutInput,
): ReadonlyMap<SeatCardToken, Readonly<CardPlacement>>;
```

These functions are deterministic, have no DOM/browser imports, and accept
only projected snapshot data plus frozen layout constants. The canonical
renderer consumes their output to set lane/card CSS variables or absolute
placements. Prepared intermediate geometry consumes the exact same output for
`INTERMEDIATE_LANE_SLOT`; it does not reimplement spacing, fan order, resting
rotation, or one/two/three-lane centering.

Until this model and its conformance proof exist, the planner must not group a
beat that requires an intermediate lane-slot position. It must select a legal
smaller beat boundary instead. Stable deck/hand/zone anchors do not require an
intermediate lane-slot calculation.

A real-browser conformance test renders the canonical board and compares each
lane/card placement to the pure result within 0.5 CSS pixels for one, two, and
three active lanes; zero through four cards on each lane side; every resting
rotation preset; and the fixed 9:16 coordinate frame. A mismatch fails the
layout contract.

### Source and destination epochs

Source geometry is captured from `beat.before`. Destination geometry is
resolved after `beat.after` commits to the DOM. Intermediate actor geometry is
derived from claimed projected snapshots and stable lane/zone anchors during
preparation; it does not require painting each intermediate canonical state.

The play motion surface maintains a geometry epoch. Preparation records the
source epoch; binding records the destination epoch. Non-finite or disconnected
geometry is a failure.

The fixed 9:16 game frame remains the coordinate space. Viewport letterboxing
or outer-window changes may not change lane/card layout midway through one
storyboard. Responsive wrapper changes are applied between storyboard runs.

### Layout FLIP

Surviving-card reflow and lane topology movement are tracks in the same
storyboard as the structural event that caused them.

They use:

```text
captured before rect
  -> adopted canonical after rect
  -> inverse visual offset
  -> compiled track to zero
```

They do not start an unawaited `playCardLayoutSlide()` promise beside another
animation. Parallel layout and structural motion end when the compiled
storyboard's latest owned track ends.

### Transform ownership

Layout, resting rotation, face flip, and scale remain on separate nested actor
elements. The compiler must not concatenate unrelated transform strings or
overwrite a transform owned by another channel.

## Required choreography contracts

The new implementation must preserve the current accepted visible design. It
changes scheduling and ownership, not the desired look.

### Opening transaction

The opening is one committed presentation block, not a set of locally invented
state transitions.

Required sequence:

1. The `.playgame-root` starts hidden before its first paint.
2. The setup snapshot renders all three fixed-size lane shells and all three
   face-down location cards while hidden.
3. Initial lane creation does not run lane-slide animation.
4. The transaction-level opening storyboard runs the title and playfield
   visibility tracks.
5. Removing the static hidden state and starting the playfield opacity track
   happen in the same task, so default opacity is never painted between them.
6. The playfield becomes visible with all three lanes already present.
7. Only after the opening prelude finishes does the director begin the
   committed opening Frames: opening draws, first location reveal, turn-start
   draw, and remaining bookkeeping in committed order.
8. The sink is bound before presentation begins; it is not attached after an
   independent settle timer.

There is no 200 ms lead-in timer, 2800 ms title hold timer, 150 ms settle timer,
or show-then-bind gap outside the compiled opening storyboard.

### Location reveal

For `LOCATION_REVEALED`:

1. the face-down location actor is prepared before adoption;
2. the canonical revealed map starts at opacity zero under lease;
3. map fade and location flip start at the same absolute timeline time;
4. they have the same authored total duration;
5. the already-mounted two-sided surface exposes the front only after the
   flipping actor crosses edge-on;
6. the map and card finish together;
7. canonical handoff is synchronous;
8. no location, tile, map, or lane disappears and remounts between phases.

Canonical opening example:

| Track | Start | End |
|---|---:|---:|
| Map opacity 0 -> 1 | 0 | 700 |
| Location back -> edge | 0 | 350 |
| Location front -> rest | 350 | 700 |
| Reveal audio cue | 0 | instantaneous |

### Turn banner

`TURN N` is one storyboard with one total duration. Fade-in, hold, and fade-out
are keyframe intervals on one banner track.

The banner DOM and its background treatment share the same timeline and
cleanup owner. There is no shorter sink hold plus a longer CSS animation plus
a later removal timer. The text cannot complete and then flash on or off again.

### End-turn resolution

The committed Frame order remains:

1. local staged cards turn face-down in place;
2. remote staged cards fly face-down from the remote hand anchor to their exact
   lane slots;
3. the priority player's eligible cards reveal one at a time;
4. the non-priority player's eligible cards reveal one at a time;
5. location, draw, energy, and bookkeeping Frames continue in committed order.

The compiled timeline does not reorder visible causal actions. A multi-Frame
beat may overlap only actions its exhaustive author claims as one atomic
choreography; it may not cross the local-face-down, remote-stage, priority
reveal, or non-priority reveal boundaries listed above.

### Remote deck to hand

- A prepared face-down actor starts at the registered remote deck anchor.
- It flies visibly to the registered hidden-hand anchor for the full authored
  duration.
- Header counters adopt their committed values without replacing the actor.
- The same storyboard is used during the opening and later turns.

### Remote hand to lane

- A prepared face-down actor starts at the registered remote hand anchor.
- The destination canonical lane card is mounted and leased after adoption.
- The actor flies to its exact card rectangle and resting rotation.
- It hands off face-down.

### Card reveal

- The actor is captured face-down from the canonical lane before adoption.
- It moves to the cinematic apex and changes to the authorized front only at
  edge-on.
- The full name and rules surface are ready and readable at the apex.
- The browser holds the apex through repeated keyframe values, not a timer.
- It returns to exact lane geometry and resting rotation.
- It hands off face-up exactly once.

### Structural card transfers

Draw, create, stage, move, return, destroy, discard, banish, transform, and zone
change continue to derive their semantic source and destination from
the claimed Frame snapshots. Each required transfer receives a storyboard or
an explicit dispatch-only disposition.

No structural transfer may become dispatch-only because a target was missing.

### Lane topology

Runtime lane creation, destruction, and reordering animate fixed-size lanes
horizontally inside the stable 9:16 playfield. Initial setup is explicitly
non-animated while hidden. Runtime topology changes use storyboard-owned FLIP
tracks and are awaited.

### Planning interaction

Pointer dragging remains pointer-driven rather than timeline-driven. Existing
hand layout, drag actor, valid target outline, drop, and undo behavior are
regression controls.

Once the pointer is released, any fixed-duration accept/reject/return animation
may use the same storyboard compiler through an interaction runner. It must not
enter the committed `PresentationDirector` queue or mutate server truth.

## Reduced-motion and playback profiles

Timing policy is selected through an explicit immutable animation profile:

```ts
interface PresentationAnimationProfile {
  readonly id: 'normal' | 'reduced-motion' | 'debug-slow';
  readonly durationScale: number;
  readonly structuralMinimumMs: Milliseconds;
  readonly decorativeEffects: 'full' | 'reduced' | 'none';
  readonly playbackRate: number;
  readonly cueLatenessToleranceMs: Milliseconds;
}
```

The normal profile preserves authored timing.

Reduced motion may:

- shorten movement;
- replace large scale/rotation with short opacity changes;
- suppress decorative managed effects;
- preserve structural visibility, face changes, cue order, and handoff.

It may not skip required visual ownership or use a different imperative code
path.

Debug slow motion changes the runner playback rate. It does not multiply every
timer or choose alternate choreography. Cues remain synchronized because they
read master animation time.

## Cancellation, disposal, and failure

### Deliberate cancellation

The following may deliberately cancel a run:

- screen disposal;
- match replacement;
- explicit developer/user fast-forward;
- presentation generation supersession;
- explicit interaction animation cancellation.

Cancellation must synchronously or deterministically:

1. stop the cue scheduler;
2. cancel the master and every WAAPI animation;
3. cancel managed effects;
4. suppress future cues;
5. release visibility leases;
6. release presentation value leases;
7. release hand reservations;
8. park actors;
9. remove temporary inline styles and DOM;
10. resolve a typed cancelled outcome, not successful completion.

### Failure

Failures include:

- missing required anchor;
- missing actor;
- actor-pool exhaustion;
- missing canonical destination;
- face/model mismatch;
- invalid geometry;
- asset preparation failure;
- storyboard validation failure;
- keyframe conflict;
- WAAPI creation or playback rejection;
- watchdog timeout;
- cleanup invariant failure.

Failure is observable. The active presentation owner is cancelled and cleaned,
the transaction `postState` is adopted, the presentation-block lock is
released, and the client enters `RESYNC_REQUIRED` while requesting a fresh
seat-projected snapshot. Gameplay commands remain disabled because of that
protocol state—not because a failed animation owner remains locked. The system
must retain:

- transaction ID;
- simulation Frame;
- projected event type;
- storyboard ID;
- active step and track IDs;
- master clock time;
- bound target identities;
- actor/lease counts;
- the causative error.

There is no `catch { continue }` around required presentation.
There is also no alternate animation, pop-only path, or declaration of
successful presentation during recovery.

### Cleanup invariants

After completion, cancellation, or failure:

- no released actor is visible;
- no actor remains assigned to a card;
- no canonical visibility lease remains;
- no presentation value lease remains;
- no temporary location actor remains mounted;
- no destination remains hidden;
- no hand reservation remains;
- no WAAPI animation remains running;
- no cue remains scheduled;
- no storyboard-owned transient VFX remains active;
- no storyboard-owned inline style remains unless it is the committed canonical
  end style and has been transferred to normal render ownership.

## Determinism and replay relationship

Animation timing is client presentation policy, not simulation determinism.

Given:

- the same seat-projected Frame;
- the same presentation animation profile;
- the same viewport geometry class;
- the same content surface revision;

the author and compiler must produce the same:

- storyboard ID;
- ordered step IDs;
- absolute step starts and ends;
- total duration;
- visual target/channel plan;
- cue order and cue times;
- required actor and anchor identities.

Pixel coordinates may differ across physical viewport sizes, but they are
resolved from the same semantic geometry references inside the fixed 9:16
frame.

Canonical replay stores Frames, not compiled browser keyframes. Replay
presentation uses the same storyboard registry, compiler, runner, and actors as
live presentation. It does not maintain a second animation implementation.

There are two intentionally different replay entry points:

- **animated replay playback** feeds retained seat-projected atomic presentation
  blocks through `TransactionPresentationPlanner` and the same director,
  compiler, value/visibility leases, actor pools, and runner as live play;
- **interactive frame scrubbing** is a state-only diagnostic view that installs
  one selected `SeatPresentationFrame.after` snapshot and never starts an
  animation, reserves an actor, or dispatches a cue.

The replay UI must label these modes. Scrubbing is not evidence that an event
has a second animation path, and animated playback may not call a scrub-only
state installer between compiled beats.

`MatchClient` retains the ordered, validated `SeatPresentationBlock` log for
the current seat and match session after each block completes successfully or
is explicitly fast-forwarded. A block that enters `RESYNC_REQUIRED` is not
added; the installed snapshot begins a new replay-log segment. That seat-safe
log is the sole local animated-replay input. An authority-backed replay may
re-request the same ordered seat-projected blocks under existing replay
authorization, but it cannot synthesize animation input from canonical state,
scrubber snapshots, debug summaries, or final states. A block still pending in
the live presentation queue is not replayable, and reconnect/resync records a
new replay-log segment beginning at the installed snapshot revision rather than
inventing animations for missed blocks.

Developer replay may expose a presentation sidecar for the selected Frame:

```ts
interface StoryboardDiagnosticSnapshot {
  readonly storyboardId: string;
  readonly beatId: string;
  readonly claimedFrames: readonly number[];
  readonly invocationTokens: readonly string[];
  readonly totalDurationMs: number;
  readonly steps: readonly {
    id: string;
    startMs: number;
    endMs: number;
  }[];
  readonly tracks: readonly {
    id: string;
    target: string;
    channel: VisualChannel;
  }[];
  readonly cues: readonly {
    id: string;
    kind: StoryboardCue['kind'];
    atMs: number;
    dispatched: boolean;
  }[];
  readonly currentTimeMs: number;
  readonly outcome: PresentationOutcome | null;
}
```

This sidecar is diagnostic and never enters canonical state, wire Frames, or
reconciliation hashes.

### Effect-resolution evidence

When a projected block includes seat-safe effect-resolution evidence, the
invocation index and beat author may use its source, candidates, affected
targets, blocked targets, and outcomes to author presentation tracks. They
must consume that evidence directly rather than re-running selectors or
inferring targeting from the final board.

For example, a destroy invocation may author:

- a source emphasis track for the invoking card;
- staggered target tracks for every candidate;
- destroy effects only for affected targets;
- blocked-impact effects for blocked targets with legal geometry, using an
  anonymous target-centered treatment for redacted blockers.

Those tracks form one storyboard for the owning beat. Presentation cannot add,
remove, or reorder authoritative targets.

## Exhaustive storyboard registry

Every projected event type has exactly one compile-time disposition:

```ts
type BeatPresentationDisposition =
  | { readonly kind: 'STORYBOARD'; readonly author: BeatStoryboardAuthor }
  | { readonly kind: 'DISPATCH_ONLY'; readonly reason: string }
  | { readonly kind: 'NOT_PROJECTED'; readonly reason: string };
```

Adding a projected event must fail typechecking until its disposition is
authored. `DISPATCH_ONLY` is a deliberate presentation decision, not a missing
implementation marker.

A transfer-derived event cannot declare `DISPATCH_ONLY` when state comparison
shows a required visible zone change.

The registry is the only event-to-storyboard switch. Specialized storyboard
files do not inspect unrelated event types.

## Validation rules

Validation runs before compilation and is available independently in tests.

It must reject:

- empty IDs or duplicate IDs;
- invalid times or easing;
- out-of-range relative keyframes or cues;
- missing time-zero/time-end values after normalization;
- conflicting channel/property ownership;
- undeclared semantic targets;
- cue actions not in the closed union;
- a `SURFACE_SWAP` registration targeting card/location faces or any
  gameplay-readable surface;
- asynchronous cue handlers;
- managed effects without declared duration and cleanup ownership;
- normal-profile required transfers with zero duration;
- storyboards that request hidden canonical identity unavailable to the seat;
- references to canonical engine IDs absent from seat projection;
- unbounded actor requirements;
- actor-live intervals exceeding the frozen ruleset/presentation capacity;
- an exact bound interval that escapes its reserved min/max envelope;
- changing rendered values without one exact visual/value owner;
- a rendered surface absent from the generated binding manifest, a manifest
  rendering missing its read-model registration, or a forbidden direct
  committed-state read;
- a final visual face inconsistent with `beat.after`;
- a multi-Frame claim with a gap, overlap, or unclaimed Frame;
- a grouped invocation whose trace nesting or completion checksum is invalid;
- a routine-call cycle or an expansion-budget violation;
- a content presentation recipe containing executable code, an unregistered
  routine/preset ID, or an out-of-schema parameter.

Build-time validation covers authored presets and sound/effect IDs. Runtime
binding validation covers live DOM targets and geometry.

## Test contract

Tests are product contracts. Timing tests must inspect intermediate state, not
only the final DOM.

### Pure schedule tests

Required examples:

- sequential steps;
- overlapping steps;
- simultaneous steps;
- deliberate gaps;
- a step whose duration extends past later step starts;
- total duration determined by the latest ending overlap;
- stable same-time cue ordering;
- normalized offsets exactly at 0 and 1;
- explicit holds;
- zero-duration dispatch-only storyboards;
- invalid numeric values;
- duplicate IDs;
- cue/keyframe range violations;
- property conflicts;
- deterministic compile equality.

### Property-based schedule tests

Generate bounded valid step lists and prove:

- `start(i + 1) = start(i) + nextStepAfter(i)`;
- every end is `start + duration`;
- total duration is the maximum owned end;
- all emitted offsets are finite and within `[0, 1]`;
- cue order is stable;
- compilation does not mutate input;
- compiling equal input twice yields structurally equal output;
- invalid conflicting ownership never compiles;
- every speed-timed exact interval is contained by the conservative envelope
  generated from preceding/current min/max durations and overlap rules.

### Runner tests

Use an injected fake timeline driver to prove:

- all animations receive one start origin;
- the runner does not resolve before the master and every track finish;
- cues dispatch once when the clock crosses their time;
- large clock jumps drain every due cue in stable order;
- cancellation suppresses future cues;
- pause samples one master time and resume rebases every track from one new
  document-timeline origin;
- animation-frame starvation still dispatches due cues from the coarse wakeup
  using master time and records bounded lateness;
- background/foreground cycles preserve cue state and never burst future cues;
- debug playback rate changes clock rate, not authored offsets;
- cleanup runs once after normal completion;
- cleanup runs once after cancellation;
- track rejection becomes typed failure;
- no completion depends on wall-clock `setTimeout`.

### Prepared-beat integration tests

Prove the exact lifecycle:

```text
prepare source
-> acquire source actor/lease
-> adopt every claimed Frame in one non-painting batch
-> reactive commit barrier
-> bind destination/lease
-> compile
-> start
-> cue/track intermediate assertions
-> finish
-> handoff
-> cleanup
-> next prepare
```

The next beat must not prepare before the current beat has completed handoff and
cleanup. Every canonical Frame must be claimed exactly once even when a beat
contains several Frames.

For a grouped beat, instrumentation must additionally prove:

- Frame adoption occurs inside one Solid `batch()` with no `await`, microtask,
  DOM layout read, or foreign callback inside it;
- exactly one `reactiveCommitBarrier()` occurs after the batch;
- a request-animation-frame sentinel cannot observe an intermediate canonical
  snapshot;
- an entity that exists only in an intermediate snapshot is never rendered by
  canonical DOM and is visible only through its prepared actor;
- every changing rendered counter/value is held by an exact value lease until
  its authored cue/track and canonical handoff.
- a persistent ongoing-effect layer whose controlling state changes inside the
  beat remains on its leased pre-adoption presentation state until the authored
  transition/handoff; it cannot pop to `beat.after` at adoption.

### Routine-composition tests

- routine registry rejects duplicate IDs and call cycles;
- `sequence`, `parallel`, and `stagger` produce exact absolute offsets;
- `forEachTarget` preserves projected candidate order;
- speed-based duration clamps only after geometry binding;
- fixed-duration and speed timing cannot both be specified;
- equal AST plus equal bound geometry compiles structurally equally;
- expansion at each budget limit succeeds and one over each limit fails;
- compiled output contains no call nodes, callbacks, loops, or child promises;
- cancellation releases every card and effect actor acquired by nested calls.

### Multi-target effect tests

- a fully observable 23-target destroy compiles 23 dagger routines and the
  correct affected death or blocked-impact routine for every visual outcome;
- each affected bleed starts at its own dagger impact time;
- stagger offsets are exact and total duration matches the maximum child end;
- blocked and indestructible cards never receive a death routine;
- affected cards hidden from final canonical state remain visible through
  actors until their authored death completes;
- invocation completion counts match the compiled affected/blocked/
  invalidated/no-change dispositions;
- a `HIDDEN` target with an observable anchor uses only that anchor;
- a `HIDDEN` target without an observable anchor receives
  `REDACTED_NO_VISUAL`, compiles no geometry, and consumes no stagger slot;
- a `HIDDEN` blocker produces an anonymous target-centered blocked impact and
  never exposes or binds blocker geometry;
- no card definition ID participates in operation-family selection;
- nested invocation traces remain in committed depth-first order;
- Wong-like sibling invocations compile once per committed invocation token;
- Jubilee/Thor-like nested and retriggered chains compile the finite projected
  invocation tree without creating new effect work or recursively starting a
  runner;
- a draw-only trace does not compile a flip or reveal;
- a committed draw -> play -> reveal chain uses the shared draw, transfer, and
  reveal routines exactly once each;
- an entity created and destroyed within one block keeps one seat token, uses
  its authorized intermediate model, and completes spawn/reveal/death before
  actor cleanup even though it is absent from `postState`;
- an identity-hidden transient entity exposes no front model and uses only its
  permitted anchor/no-visual dispositions;
- replay preserves every claimed canonical Frame and reports the owning beat.
- animated replay consumes only retained/re-requested validated
  `SeatPresentationBlock` objects; pending live blocks and scrubber snapshots
  are rejected as replay input.

### Actor tests

- actor nodes are pre-mounted and retain identity across sessions;
- actor count is bounded;
- generated worst-case ruleset/reaction beats compute actor/effect live
  intervals and remain within the frozen profile's pool capacity;
- the interval allocator reuses non-overlapping leases and never reuses
  overlapping leases;
- speed-timed actor assignments remain collision-free at all combinations of
  declared minimum/maximum bound durations;
- a ruleset capacity profile beyond the validated pool is rejected before
  match creation;
- source and destination leases are exact;
- start, midpoint, apex, landing, and parked states are asserted;
- face model changes only at the authored edge-on time;
- canonical source and destination never paint simultaneously;
- cancellation parks actors and restores canonical visibility;
- pool exhaustion fails loudly.

### Choreography tests

Required observable-time tests:

- opening initially displays three lanes simultaneously;
- no opening screen flash occurs before the first location reveal;
- opening title has one fade/hold/fade lifecycle;
- `TURN 2` has one fade/hold/fade lifecycle and never reappears;
- location flip and map fade share start and end times;
- remote opening deck-to-hand microanimation lasts its authored duration;
- later-turn remote deck-to-hand uses the same storyboard;
- remote hand-to-lane motion lasts its authored duration;
- local and remote reveal cinematics use the same routine with authorized face
  differences only;
- reveal text is present and readable at the apex;
- end-turn Frames remain strictly ordered;
- layout FLIP and structural motion may overlap inside one storyboard but the
  next beat waits for both;
- destroy/power/transform VFX end under storyboard ownership.

### Audio and cue tests

- every authored sound ID resolves;
- audio is dispatched at its compiled time, not a broad phase label;
- mute uses the explicit silent port;
- cancellation before a cue prevents it;
- cancellation after a cue does not replay it;
- audio duration does not delay visual completion;
- a permitted noncritical surface swap and audio at the same timestamp use
  stable authored order;
- card/location face targets are unrepresentable as surface-swap cues and a
  forged critical-surface registration fails validation.

### Browser tests

JSDOM/fake-clock tests are necessary but insufficient. A real-browser gate must
exercise native WAAPI and visually or programmatically inspect:

- common `startTime` across tracks;
- intermediate computed transforms and opacity;
- actual `finished` settlement;
- background-tab pause/resume;
- occluded/throttled cue wakeup without master-time drift;
- no flash between visibility ownership handoffs;
- normal and debug-slow profiles;
- one opening draw;
- one later-turn remote draw;
- one remote stage;
- one local reveal;
- one remote reveal;
- one location reveal;
- one power effect;
- one destroy effect.

The browser gate should retain screenshots or structured trace artifacts for
start, midpoint, and end when practical.

### Architecture fences

Source-level tests must enforce:

- only `waapiDriver.ts` constructs WAAPI `Animation`/`KeyframeEffect` objects or
  calls `Element.animate()` for committed presentation;
- storyboard authors do not access the DOM;
- content `presentation.json` recipes are schema-validated data and cannot
  import or execute code;
- generated presentation manifests contain only registered routine/preset IDs
  and validated parameters;
- `PresentationDirector` contains no event-type choreography;
- play renderer modules cannot read committed match state outside the generated
  presentation binding selectors/read model;
- every displayed derived value and persistent state-derived visual has a
  generated binding and mounted-registration conformance test;
- `SeatAnimationEvent` remains a closed projected union; generic
  `Record<string, JsonValue>` payloads are forbidden;
- production storyboard, runner, card-reveal, location-reveal, card-motion,
  and turn-banner modules contain no `setTimeout` animation pacing;
- no storyboard-owned CSS class declares an independent `animation-duration`;
- no required transfer contains pop, teleport, skip, fallback, or
  missing-anchor recovery branches;
- `playSfx` is not optional at the runner boundary;
- the event registry is exhaustive;
- animated replay enters the same planner/director/compiler/runner path as live
  play, while scrub mode never enters it;
- the old animation entry points are absent after cutover.

The director watchdog is the only permitted presentation **completion**
timeout and must be identified by an explicit source-fence exception. The cue
scheduler's one coarse wakeup timer has a separate narrow exception: it only
wakes a master-time sample, cannot complete/advance a storyboard, cannot own a
cue deadline, and cannot be used as animation pacing.

### Required test command

Add a focused first-class command:

```json
{
  "test:presentation": "vitest run services/playgame/presentation components/screens/play/playPresentationArchitecture.test.ts contexts/PlayUiInterleaving.test.tsx"
}
```

The exact file list may be refined, but the command must cover compiler,
runner, actors, sink, director, UI interleaving, choreography, and architecture
fences without depending on authentication or authority type.

Before merge/handoff, also run:

```text
npm run typecheck:playgame
npm run typecheck:tests
npm run test:engine:authorities
npm run build
```

The full engine regression remains governed by `AGENTS.md`: offer it before a
merge/push/handoff and run it immediately when explicitly requested.

## Telemetry and debugging

Every run records presentation-only timing:

- preparation start/end;
- post-adoption binding start/end;
- compile start/end;
- master clock start/end;
- pause intervals;
- cue dispatch times;
- managed effect completion;
- handoff start/end;
- cleanup completion;
- outcome.

Observed times are diagnostic and never feed back into authored timing.

Developer replay should display:

- current simulation Frame;
- active storyboard and step;
- master animation time / total duration;
- active target/channel tracks;
- pending and dispatched cues;
- actor and lease ownership;
- playback profile and rate.

Slow motion must be a runner playback-rate control. It must not modify source
constants or require a separate server.

## Migration plan

Migration happens on one implementation lane with no runtime fallback. During
the migration, an event type has exactly one owner: old or compiled. Once an
event is migrated, its old path is deleted in the same checkpoint.

The integration branch is not exit-ready while any committed animation owns
independent timing.

### Checkpoint A — compiler and runner foundation

Implementation evidence: [playgame-compiled-animation-timeline-checkpoint-a.md](./playgame-compiled-animation-timeline-checkpoint-a.md).
Checkpoint A is implemented and proven without production event wiring.

Build:

- contracts and branded time validation;
- generated closed `SeatAnimationEvent` payload union and exhaustive projected
  event disposition registry;
- typed animation AST and builder;
- closed, schema-validated, acyclic routine registry;
- `sequence`, `parallel`, `stagger`, `call`, and finite target mapping;
- schedule calculation;
- keyframe normalization;
- conflict validation;
- fake and native WAAPI drivers;
- master-clock runner;
- cue scheduler;
- diagnostics;
- normal/reduced/debug profiles;
- pure and property-based tests.

No production event uses the runner until this checkpoint is proven.

Exit proof:

- the compiler and runner pass independently;
- no DOM or engine imports exist in the pure schedule/compiler modules;
- no runner completion timer exists;
- routine calls flatten completely before runner input;
- one real-browser multi-track/cue demonstration finishes from native WAAPI.

### Checkpoint B — sink/director lifecycle and transaction prelude

Replace:

- loose `beforeFrame`/`afterFrame` prepared maps;
- delayed opening sink binding;
- opening lead-in/title/show/settle timers;
- independent playfield visibility events.

Build:

- `TransactionPresentationPlanner` and exact Frame partition validation;
- field-by-field wire materialization that preserves
  `SeatTransactionFrame.effect` verbatim;
- `PreparedBeatPresentation`;
- awaited preparation before adoption;
- transaction-prelude storyboard;
- initial hidden-to-visible playfield ownership;
- explicit `RESYNC_REQUIRED` recovery state and fresh seat-snapshot request.

Exit proof:

- all three lane shells appear simultaneously;
- the opening has no flash/pop before the first location reveal;
- the next beat cannot prepare before cleanup;
- preparation failure does not adopt any Frame in the beat;
- post-adoption failure does not silently continue.

### Checkpoint C — turn banner and location reveal

Migrate:

- turn banner fade/hold/fade;
- toast background ownership;
- location map fade;
- location card flip;
- edge-on surface handoff;
- location reveal audio cue.

Delete:

- toast removal timer for the committed turn-banner path only; unrelated
  noncommitted notification toasts retain their existing owner until separately
  migrated;
- turn banner hold timer;
- location reveal waits and transition strings.

Exit proof:

- `TURN 2` runs once without a second flash;
- map and location flip start and finish together;
- no location/map/tile remount flash;
- cancellation restores exact canonical visibility.

### Checkpoint D — wholesale card-motion mechanism cutover

Migrate the complete card-motion mechanism in one checkpoint:

- remote deck -> remote hand;
- remote hand -> lane;
- local deck -> local hand;
- generated -> hand/lane;
- lane -> lane;
- lane -> hand;
- lane/hand/deck -> discard/destroyed/banished;
- transform/replace routes;
- local private stage reconciliation;
- reveal enter, face turn, readable apex hold, and return;
- reveal audio and pre-mounted two-sided face rendering;
- simultaneous layout FLIP, exact final rotation, and final geometry;
- pure intermediate lane-slot layout and its DOM conformance proof.

Convert `CardMotionSession` from a transition/timer owner into an actor/lease
and track-contribution owner wholesale. It may not retain transition/timer
methods for routes that happen to migrate later. The route list above is the
acceptance matrix for one mechanism, not permission for route-by-route runtime
ownership.

Delete all `CardMotionSession` `animateTo()` waits, CSS transition strings,
midpoint/reveal waits, duration guards, unawaited layout-slide promises, and
the old reveal-animation entry point in the same checkpoint.

Exit proof:

- opening and later-turn remote draws use the same route/storyboard;
- remote stage never teleports;
- local hand interaction remains unchanged;
- every route hands off with zero active actors/leases;
- the generated card-motion interval-envelope proof covers every route and
  remains within the card-actor pool before the cutover is enabled;
- missing required anchors fail instead of popping;
- local and remote faces are readable at the apex;
- face changes once at edge-on;
- return has no final snap;
- next reveal waits for handoff/cleanup;
- layout movement and reveal remain synchronized.

### Checkpoint E — multi-frame effects, value leases, VFX, and lane topology

Migrate:

- power, destroy, transform, move trail, camera, and other transient VFX;
- homogeneous multi-target effect beats and the invocation index;
- all required displayed-value leases for card stats, lane totals, resources,
  counts, turn/header, and location counters;
- the generated surface-binding manifest, `PresentationReadModel`, mounted-surface
  registry, and raw-state-read fence, migrating every play renderer to
  read-model accessors;
- the primitive, card/location, and shared-effect routine catalog;
- all SFX phase labels to exact cue times;
- runtime lane topology motion;
- managed effect cleanup to the shared clock;
- generated worst-case interval-envelope and capacity proofs for multi-target,
  nested reaction, created-entity, VFX, and lane-topology choreography.

Keep persistent state-derived card effects outside Frame duration.

Exit proof:

- no transient presentation registry uses wall-clock cleanup deadlines;
- every sound/effect ID validates;
- the 23-target destroy and blocked-target proofs are green;
- the complete generated actor/effect liveness proof is within the frozen
  ruleset presentation profile before any multi-target author is enabled;
- affected, blocked, invalidated, and unchanged visual dispositions match the
  projected trace exactly;
- lane movement is awaited and initial setup remains non-animated;
- pause/resume holds VFX and cues in sync.

### Checkpoint F — replay and browser convergence

Build:

- animated replay entry through the same transaction planner, director,
  compiler, leases, actor pools, and runner as live presentation;
- explicitly state-only interactive frame scrubbing;
- native-WAAPI browser coverage for every choreography route;
- pause/resume rebasing, cue-starvation wakeups, and cue-lateness diagnostics.

Exit proof:

- animated replay and live play emit structurally equal storyboards for the
  same projected block/profile/geometry class;
- scrubbing starts zero animations and cues;
- native-browser gates cover opening/later draw, remote stage, local/remote
  reveal, location reveal, power, destroy, layout, and background/resume;
- all actor/value/visibility ownership invariants are green.

### Checkpoint G — deletion and convergence

Delete or collapse the superseded implementations:

- `eventAnimator.ts` imperative execution path;
- timer-based portions of `cardMotionSession.ts`;
- timer-based `cardRevealAnimation.ts`;
- timer-based `locationRevealAnimation.ts`;
- committed-banner timer ownership in `toast.ts`;
- `openingPresentation.ts` independent pacing;
- old `SfxCue.timing` phase labels;
- production presentation waits used as animation clocks;
- CSS animations/transitions that independently own committed presentation
  completion.

Rename the surviving modules according to their final responsibility rather
than preserving old names through adapters.

Exit proof:

- architecture fences prove one path;
- focused presentation suite is green;
- authority/interleaving suite is green;
- typechecks and build are green;
- browser choreography matrix is green;
- no compatibility aliases, adapters, feature flags, fallback reads, or
  dual-write paths remain.

## Implementation stop rules

Do not proceed to the next migration checkpoint when:

- an existing migrated animation no longer matches its accepted visible
  choreography;
- a test proves only final cleanup but not intermediate time;
- a required browser case has not been observed;
- a new timeout or CSS duration was added outside the compiled timeline;
- a missing target is being treated as permission to continue;
- the implementation requires server keyframes or gameplay changes;
- the same event can choose old or new animation code at runtime;
- a card actor, visibility lease, hand reservation, or managed effect leaks;
- slow motion changes behavior rather than only rate;
- presentation can advance while the document is hidden.

## Final exit criteria

The compiled animation timeline architecture is complete only when all of the
following are true:

- one exhaustive registry maps every projected event to one storyboard or one
  deliberate non-animation disposition;
- one pure planner partitions every canonical Frame into exactly one
  presentation beat;
- one closed acyclic routine registry supplies the shared basic animation
  language and compiles away before playback;
- one compiler calculates all committed-presentation time;
- one runner owns all WAAPI tracks and timed cues for a beat;
- one completion promise gates the director;
- all required card and location animations use permanent/prepared actors;
- audio is a required timed-cue port;
- transient VFX are owned tracks on the shared clock;
- opening presentation is a transaction prelude, not delayed sink binding;
- all three initial lanes are visible together with no setup slide;
- turn banners never double-flash;
- location flip and map fade are synchronized;
- remote draw and stage microanimations work during opening and later turns;
- card reveals remain readable, ordered, and snap-free;
- 23-target effects remain bounded, trace-exact, and complete in one authored
  multi-target beat;
- nested draw/play/reveal effects compose shared routines from committed Frames
  without animation callbacks or presentation-authored gameplay;
- cancellation and failure leave no leaked presentation state;
- failure never selects a fallback visual path;
- replay uses the same registry/compiler/runner;
- no old timer/transition animation path remains;
- all focused, architecture, authority, typecheck, build, and browser gates pass.

At that point the animation system is no longer a collection of routines that
try to wait for one another. It is one compiled, inspectable, deterministic
browser presentation program for each committed presentation beat.
