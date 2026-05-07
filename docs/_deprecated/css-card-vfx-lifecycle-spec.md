# CSS Card VFX Lifecycle Spec

## Purpose

Define how card-local VFX are created, managed, rendered, exited, and garbage
collected.

This lifecycle belongs to the presentation layer. It must never become gameplay
state. The engine emits authoritative `MatchEvent`s; the VFX lifecycle turns
those events and projected card state into temporary or persistent visual
records.

Related specs:

- `docs/css-card-vfx-wrapper-stack-spec.md` defines how wrappers compose around
  a card.
- `docs/css-card-vfx-effect-catalog.md` defines the persistent/ongoing visual
  vocabulary.
- `docs/event-driven-renderer-spec.md` defines how `MatchEvent` reaches
  presentation.

Effect implementation rule: each visual kind lives in its own source module
under `services/vfx/card-effects/effects/`. The lifecycle registry resolves
effects through a small definition index; it does not contain per-effect visual
logic.

## One Sentence Model

```txt
MatchEvent / projected card state
  -> VFX request
  -> normalized VFX record
  -> card VFX registry
  -> CardVfxStack renders wrappers
  -> CSS animation / persistent aura
  -> exit or source removal
  -> registry cleanup
```

## Owners

### Engine

The engine owns game truth only.

It does:
- emit `MatchEvent`s;
- maintain card state, zones, tags, counters, and log;
- expose enough state for the presentation layer to derive visuals.

It does not:
- create VFX records;
- know CSS classes;
- know animation duration;
- know DOM lifecycle.

### `choreography.ts`

`choreography.ts` maps `MatchEvent` to semantic presentation intent.

It can say:
- this event wants a `power-pulse`;
- this event wants an `impact-shake`;
- this event updates persistent visuals;
- this event is dispatch-only.

It should not:
- mutate the VFX registry;
- inspect DOM;
- decide whether a card element exists.

### `eventAnimator.ts`

`eventAnimator.ts` is the bridge between event sequencing and VFX lifecycle.

It does:
- dispatch events at animation-safe moments;
- create transient VFX requests from `VfxCue`s;
- tell the VFX registry when a one-shot effect should start;
- run measured structural animations such as FLIP/deck slide;
- request persistent reconciliation after state changes that affect visual
  sources.

It should not:
- store long-lived VFX state itself;
- directly render wrapper DOM;
- allow animation failure to block gameplay dispatch.

### Card VFX Registry

The registry owns active VFX records.

It does:
- create stable record IDs;
- dedupe or aggregate same-beat effects;
- resolve `visualKind` through the card effect definition registry;
- store transient layers;
- store persistent groups;
- track lifecycle phase;
- schedule cleanup deadlines;
- notify `CardVfxStack` subscribers.

It should be the only place that answers:
- what VFX wrappers are active for this card?
- which transient layers are entering/active/exiting?
- which persistent groups should render?
- which stale records must be removed?

It should not contain a giant visual switch for fire/ice/acid/etc. Those rules
belong to the individual effect modules.

### `CardVfxStack`

`CardVfxStack` renders the active layers for one card.

It does:
- subscribe to registry records for `cardId`;
- sort layers by channel order;
- render nested DOM wrappers;
- attach `animationend` handlers where useful;
- report completion back to the registry;
- render the actual card face as the innermost child.

It should not:
- infer gameplay;
- create gameplay events;
- own persistent effect projection rules.

## Record Types

### Transient VFX Record

Transient records are one-shot effects: flashes, shakes, pulses, short glints.

```ts
type CardVfxPhase = 'entering' | 'active' | 'exiting' | 'complete';

type CardTransientVfx = {
  id: string;
  cardId: string;
  source: {
    kind: 'event';
    eventId?: string;
    eventType: string;
    sourceId?: string;
  };
  channel:
    | 'world-motion'
    | 'impact-shake'
    | 'interaction-pose'
    | 'power-pulse'
    | 'face-transform'
    | 'surface-fx';
  className: string;
  vars: Record<string, string>;
  priority: number;
  createdAtMs: number;
  startedAtMs?: number;
  durationMs: number;
  exitDurationMs: number;
  cleanupAtMs: number;
  phase: CardVfxPhase;
};
```

### Persistent VFX Group

Persistent records are state-derived effects: ongoing auras, statuses, disabled
text, copied text, protection shells.

```ts
type CardPersistentVfxGroup = {
  id: string;
  cardId: string;
  groupKind: 'ongoing' | 'status' | 'copied-text' | 'disabled-text';
  visualKind: string;
  sources: readonly {
    sourceId: string;
    visualKind: string;
    intensity: number;
    priority: number;
    palette?: string;
  }[];
  renderMode: 'single' | 'stacked' | 'aggregated' | 'prioritized';
  vars: Record<string, string>;
  phase: 'active' | 'exiting';
  createdAtMs: number;
  updatedAtMs: number;
  exitStartedAtMs?: number;
  cleanupAtMs?: number;
};
```

## Lifecycle: Transient Effects

### 1. Trigger

A transient VFX is triggered by a `MatchEvent` being animated.

Examples:
- `CARD_POWER_CHANGED` triggers `power-pulse` and/or `surface-fx`.
- `CARD_DESTROYED` triggers `impact-shake` and `surface-fx`.
- `CARD_TRANSFORMED` triggers `glitch` surface flash.
- `CARD_MOVED` may trigger `world-motion`.

Only presentation code can create the VFX request. The event is the cause, not
the VFX record itself.

### 2. Request

`eventAnimator.ts` creates a small request:

```ts
type CreateTransientVfxRequest = {
  cardId: string;
  eventType: string;
  channel: CardTransientVfx['channel'];
  effectKind: string;
  className: string;
  vars?: Record<string, string>;
  durationMs: number;
  exitDurationMs?: number;
  priority?: number;
  dedupeKey?: string;
};
```

### 3. Normalize

The registry normalizes the request:
- fills defaults;
- assigns a stable `id`;
- computes `cleanupAtMs`;
- applies channel priority;
- clamps duration and intensity to budget;
- resolves `dedupeKey`.

### 4. Dedupe / Aggregate

If several same-card effects arrive in the same event slice, the registry may:
- merge them into one stronger record;
- keep separate records if channels differ;
- drop lower-priority duplicates;
- delay lower-priority records until the current record exits, if the channel
  cannot visually support overlap.

Example:

```txt
six CARD_POWER_CHANGED buffs in one slice
  -> one power-pulse record
  -> vars: --card-fx-count: 6; --card-fx-delta-total: 8
```

### 5. Mount

`CardVfxStack` receives the active record list and renders the wrapper in the
correct channel position.

Once the wrapper is in the DOM:
- CSS keyframes start naturally;
- the component may report `startedAtMs`;
- the registry phase moves from `entering` to `active`.

If the card DOM does not exist, the registry marks the record `complete`. Missing
DOM never blocks gameplay.

### 6. Active

The record stays active until:
- `animationend` reports completion;
- the cleanup timeout expires;
- the card leaves a renderable zone;
- the match/replay/screen lifecycle clears VFX.

### 7. Exit

Some transient effects do not need exit. They can go straight to `complete` when
their animation ends.

Effects that need exit:
- long glows;
- temporary wrappers that fade out;
- lingering distortion.

Exit changes phase to `exiting` and optionally swaps to an exit class.

### 8. Cleanup

Cleanup removes the record from the registry.

`animationend` is helpful but not authoritative. The authoritative cleanup is:

```txt
cleanupAtMs = startedAtMs + durationMs + exitDurationMs + graceMs
```

The grace window should be small, such as 80-150ms.

Reasons `animationend` is not enough:
- card unmounted;
- class changed;
- browser tab throttled;
- reduced motion changed behavior;
- CSS animation was cancelled;
- component moved between render trees.

## Lifecycle: Persistent Effects

### 1. Trigger

Persistent VFX is triggered by projected card state, not by one event.

Examples:
- card has active ongoing ability;
- card has copied text;
- card text is disabled;
- card has a status tag;
- card is protected by location or aura.

Events can cause persistent state to change, but persistent VFX should be
derived from the current projected state after dispatch.

### 2. Project

A projector derives visual sources:

```ts
type ProjectPersistentVfxInput = {
  cardId: string;
  state: MatchState;
  manifest: Manifest;
};

type ProjectPersistentVfxResult = {
  sources: CardPersistentFxSource[];
};
```

Projection should be deterministic for the same state.

### 3. Group

The registry groups sources by:
- `cardId`;
- group kind, such as `ongoing` or `status`;
- visual kind, such as `fire` or `glitch`;
- compatibility rules from the effect catalog.

The group, not individual callers, decides whether N sources become:
- one aggregate wrapper;
- several stacked wrappers;
- top K prioritized wrappers plus an aggregate remainder.

The group delegates effect-specific details to the matching effect module. For
example, `fire.ts` decides how multiple fire sources aggregate, while `ice.ts`
decides how multiple ice sources aggregate.

### 4. Reconcile

Persistent groups are diffed against previous groups.

Stable group IDs should look like:

```txt
card:<cardId>:persistent:<groupKind>:<visualKind>
```

If the group still exists:
- update `sources`;
- update CSS vars;
- keep the same DOM wrapper;
- do not restart the animation unless the render mode or visual kind changes.

If a new group appears:
- create it in `active` phase;
- optionally play an application cue separately as transient `surface-fx`.

If a group disappears:
- move it to `exiting`;
- set `cleanupAtMs`;
- render an exit fade if defined.

### 5. Active

Persistent groups remain active until their projected sources disappear or the
card leaves a zone where the effect should render.

They should generally animate with slow looping keyframes or static CSS
variables. They must not restart every render.

### 6. Update

When source count or intensity changes:
- update CSS variables in place;
- avoid remounting wrappers;
- avoid restarting continuous animations;
- optionally create a separate transient application cue.

Example:

```txt
ongoing fire count 2 -> 3
  persistent group updates --card-fx-count: 3
  optional one-shot fire flare in surface-fx
```

### 7. Exit

When a persistent source disappears:
- if no sources remain in the group, begin group exit;
- if some sources remain, update the group in place;
- if the visual kind changes, exit old group and enter new group.

Exit should be short. Persistent VFX must not linger long enough to imply an
effect still exists.

### 8. Cleanup

The registry removes exiting persistent groups when:
- exit animation ends;
- cleanup timeout expires;
- card unmounts;
- match/replay/screen lifecycle clears records.

## Registry API

Initial shape:

```ts
interface CardVfxRegistry {
  createTransient(request: CreateTransientVfxRequest): string | null;
  reconcilePersistent(cardId: string, sources: CardPersistentFxSource[]): void;
  complete(recordId: string): void;
  clearCard(cardId: string, reason: VfxClearReason): void;
  clearAll(reason: VfxClearReason): void;
  getLayers(cardId: string): CardVfxRenderModel;
  subscribe(cardId: string, listener: () => void): () => void;
  tick(nowMs: number): void;
}

type VfxClearReason =
  | 'card-unmounted'
  | 'card-zone-hidden'
  | 'match-reset'
  | 'replay-entered'
  | 'screen-unmounted'
  | 'reduced-motion';
```

The registry can be implemented as Solid state, a tiny imperative store with
subscriptions, or a hybrid. The behavior above is the contract.

## Render Model

`getLayers(cardId)` should return the exact wrapper model needed by
`CardVfxStack`:

```ts
type CardVfxRenderModel = {
  transient: readonly CardTransientVfx[];
  persistent: readonly CardPersistentVfxGroup[];
};
```

`CardVfxStack` sorts this model into wrapper order:

```txt
world-motion
  impact-shake
    interaction-pose
      power-pulse
        face-transform
          surface-fx
            persistent-fx
              card-face
```

Persistent groups may render internal child wrappers inside `persistent-fx`.

## Cleanup Rules

Clear all VFX for a card when:
- the card leaves `HAND` or `LANE` and no visible pile view owns it;
- the card is destroyed/banished and its exit animation completes;
- the card element unmounts;
- replay mode starts;
- a new match starts;
- the play screen unmounts.

Do not clear persistent VFX merely because:
- the card re-renders;
- CSS variables update;
- the same source list is projected again;
- the card moves from one visible lane slot to another.

## Timing Rules

- Transient records must have bounded durations.
- Persistent groups may loop indefinitely, but only while their source state
  exists.
- Cleanup timeout is authoritative.
- `animationend` can accelerate cleanup but cannot be the only cleanup path.
- Structural animations may await completion if they gate dispatch sequencing.
- Decorative VFX should never block dispatch.

## Reduced Motion

When reduced motion is active:
- structural animations may shorten or become cross-fades;
- transient VFX may collapse to a single opacity/color flash;
- persistent VFX may become static borders/glows;
- the registry should still create/update records if doing so keeps the render
  model consistent, but durations should be near-zero and cleanup immediate for
  one-shot effects.

## Failure Modes

### Missing Card Element

If a transient VFX is requested for a card that is not mounted:
- dispatch still happens;
- the VFX record is not mounted;
- mark it complete or skip creation.

### Duplicate Event Delivery

If the same event is animated twice by mistake, `dedupeKey` should prevent
obvious duplicate one-shot effects within a short event-slice window. This is a
safety net, not permission to double-dispatch events.

### DOM Unmount Mid-Animation

If `CardVfxStack` unmounts:
- it calls `clearCard(cardId, 'card-unmounted')`;
- pending `animationend` handlers are ignored after unmount.

### Stuck Records

The registry `tick(nowMs)` must remove records whose `cleanupAtMs` is in the
past. No record with a bounded duration can live forever.

## Implementation Slices

1. Add a minimal registry with transient `surface-fx` records.
2. Add `CardVfxStack` around card faces with deterministic wrapper order.
3. Route one low-risk cue, such as power flash, through the registry.
4. Add timeout cleanup and unmount cleanup.
5. Add persistent projection for one visual kind.
6. Add persistent grouping/aggregation for N sources.
7. Move existing `Timeline` card-local effects behind the registry.

## Acceptance Criteria

- A transient effect mounts, animates, and is removed without manual component
  state in card components.
- A missing DOM target does not block the underlying event.
- Two same-frame power changes aggregate or dedupe predictably.
- A persistent effect updates CSS vars without remounting or restarting.
- Removing the persistent source starts exit and then cleans up.
- Entering replay or resetting match clears live VFX.
- No direct card component writes to `style.animation` are needed for managed
  VFX.
