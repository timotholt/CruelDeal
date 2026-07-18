# Phase 1.22 — Governed Card Motion and Visual Handoff

## Status

Specification ready for review.

Phase 1.22 is a presentation-architecture phase immediately after Phase 1.21.
It completes the motion boundary introduced by `PlayMotionSurface`. It does not
change simulation rules, committed events, card-transfer derivation, replay
authority, lane layout, or the exact 9:16 frame.

## Executive Decision

Temporary card surrogates remain the canonical technique for motion that
crosses persistent layout owners or begins at an unrendered zone.

The problem is not that a flyer exists. The problem is that transfer, drag,
draw, and reveal code independently implement:

```text
capture visual
hide canonical element
create temporary surrogate
animate
restore canonical element
remove surrogate
```

Phase 1.22 introduces one governed visual-handoff lifecycle beneath all of
those choreographies.

The phase is built around one invariant:

> For every visible card transition, presentation has one governed visual
> owner and one idempotent path back to the canonical rendered card.

No animation may improvise its own canonical-card visibility ownership,
surrogate cleanup, or landing handoff.

## Product Goal

Card motion must read as one continuous physical action.

The player must never see:

- a flyer land and then the card disappear and reappear
- a different-sized or differently angled card replace the flyer
- a blank frame between the temporary card and the canonical card
- two separate flights for one accepted drag
- a card remain hidden after cancellation, timeout, navigation, or remount
- a landing effect reset opacity or scale after motion is already complete

These guarantees apply to:

- local pointer drag and accepted landing
- remote face-down play
- deck-to-hand draw
- hand-to-lane and lane-to-hand transfer
- lane-to-lane movement
- generated-card entry
- discard, destroy, and banish exit
- return from a pile
- cinematic card reveal

## Core Problem

Phase 1.21 established the correct spatial architecture:

- one exact 9:16 frame
- persistent lane columns
- one non-layout VFX overlay
- registered card and zone anchors
- one frame-relative coordinate adapter

The remaining motion architecture has fragmented lifecycle ownership.

Today:

- `eventAnimator.ts` clones a source or destination, hides canonical elements,
  flies the clone, restores visibility, and then applies a second landing pop
- `useDragDrop.ts` creates and lands a pointer ghost through a separate
  lifecycle
- `slide-from-deck.ts` creates another specialized flyer and visibility swap
- `reveal-cinematic.ts` clones and manually edits card-facing classes before
  returning ownership
- `fly-face-down.ts` retains an older standalone version of the same pattern
- cancellation and timeout restoration rules differ by implementation

The visible enemy-card flash is one concrete result:

```text
flyer lands
→ flyer removed
→ canonical card shown
→ canonical card receives vfx-pop
→ vfx-pop begins at opacity: 0
→ canonical card disappears and reappears
```

Removing that pop fixes one symptom. It does not establish a contract that
prevents the same failure in draw, reveal, movement, cancellation, or future
animations.

## Scope Judgment

This is a focused presentation refactor, not a game-engine rewrite.

The following existing abstractions remain correct:

- `deriveCardTransfers(before, event, after)` is the canonical structural
  event-to-motion normalizer
- `CardTransfer` remains the semantic description of route, face, timing, and
  style
- `PlayMotionSurface` remains the only coordinate and temporary-mount boundary
- `cardRefs` remain keyed by card instance ID
- `zoneRefs` remain keyed by logical owner and stable lane ID
- committed presentation order remains authoritative
- the pointer controller remains the input owner for local drag

Phase 1.22 adds the missing lifecycle seam between motion description and
temporary DOM execution.

## Non-Negotiable Requirements

Phase 1.22 cannot close unless:

1. Every live temporary card motion uses the shared handoff lifecycle.
2. A continuous transfer uses one surrogate from motion start through
   landing.
3. An accepted pointer drag reuses its existing ghost for landing.
4. Local committed stage adoption does not replay a flight already shown
   during planning.
5. Canonical card visibility is governed by a lease owned by the active motion
   session.
6. A session restores canonical visibility on completion, rejection,
   cancellation, timeout, screen disposal, or element remount.
7. A session cleanup operation is idempotent.
8. The destination element is re-resolved by card ID at handoff; stale element
   references cannot strand a remounted card.
9. The surrogate's final center, layout dimensions, face, and resting rotation
   match the canonical destination.
10. A continuous transfer does not start a second opacity or scale animation
    on the canonical card after landing.
11. Spawn scale, flip, fade, and route styling complete on the surrogate or an
    additive VFX layer before ownership returns.
12. Additive landing VFX cannot hide, resize, reposition, or replace the
    canonical card.
13. No presentation failure changes committed match state or event order.
14. No old handoff implementation remains callable from the live play path.
15. The existing exact-9:16 and stable-lane geometry gates remain green.

## Terminology

### Canonical card

The card element rendered by Solid from the currently presented match state.
It owns:

- semantic card contents
- accessibility and interaction
- persistent slot participation
- current face and displayed values
- long-lived card-local VFX

The canonical card never becomes the authority for cross-zone animation.

### Surrogate

An absolutely positioned, non-interactive visual object mounted in the
`PlayMotionSurface` overlay. A surrogate may be:

- a clone of a visible source card
- a clone of a rendered destination card
- a synthesized face-down card for a hidden hand or deck
- a reveal wrapper containing a card clone
- the pointer ghost already created by the drag controller

The surrogate owns temporary world motion only.

### Visual handoff

The paint-safe transfer of visual ownership from a surrogate back to the
canonical destination.

### Visibility lease

An idempotent, session-owned claim that temporarily suppresses a canonical
card without losing its previous inline visibility state.

### Additive VFX

An overlay or nested effect that enhances the visible canonical card without
becoming its structural representation. Glows, particles, borders, and
brightness pulses are additive. Setting the canonical card to `opacity: 0` is
not additive.

## Visual Ownership State Machine

Every governed card motion follows this state machine:

```text
idle
  canonical card or logical source owns appearance

captured
  source geometry and appearance have been snapshotted

surrogate-active
  surrogate owns motion
  relevant canonical source/destination is leased hidden

landed
  surrogate is geometrically congruent with destination

handoff
  canonical destination is resolved and restored
  surrogate is removed in the same handoff task

complete
  canonical card is the sole persistent representation
  no visibility lease or temporary node remains
```

Terminal interruption paths are:

```text
captured | surrogate-active | landed
  ├─ cancel
  ├─ timeout
  ├─ screen disposal
  ├─ presentation generation invalidation
  └─ missing/stale destination
        ↓
      recover
        ↓
      complete
```

`recover` always:

1. releases all visibility leases owned by the session
2. re-resolves and restores the current canonical card when one should exist
3. removes the surrogate
4. clears temporary transforms, transitions, and session markers
5. settles the presentation promise exactly once

## Paint-Level Invariants

For a transfer whose destination should be visible:

- before motion: the source or source surrogate is visible
- during motion: the surrogate is visible
- after handoff: the canonical destination is visible
- after cleanup: no surrogate remains

At no sampled paint may both the surrogate and canonical destination be
absent.

The preferred handoff is synchronous inside one animation-frame task:

```text
resolve current destination
restore destination visibility
remove surrogate
release lease
```

The browser cannot paint between synchronous statements in that task.

An implementation may allow one committed paint of overlap only when required
for a proven browser behavior. During that overlap:

- both representations must be geometrically congruent
- both must show the same face
- the surrogate must not add a second visible shadow or opacity contribution
- overlap may last at most one committed paint

There is never an intentional paint with neither representation visible.

## Proposed Architecture

### Existing semantic layer

This phase does not alter the semantic pipeline:

```text
committed MatchEvent
  → deriveCardTransfers(before, event, after)
  → CardTransfer[]
  → choreography and route styling
```

### New execution layer

Structural motion executes through:

```text
CardTransfer or pointer/reveal intent
  → capture CardVisualSnapshot
  → begin CardMotionSession
  → animate surrogate
  → handoff to canonical destination
  → additive VFX
```

Recommended module boundary:

```text
services/playgame/presentation/cardMotion/
├─ types.ts
├─ captureCardVisual.ts
├─ createCardSurrogate.ts
├─ canonicalVisibility.ts
├─ cardMotionSession.ts
├─ handoff.ts
└─ diagnostics.ts
```

The exact file split may change if a smaller layout is clearer. The public
contract and lifecycle ownership may not.

### Card visual snapshot

Before a source disappears, presentation captures a DOM-independent snapshot:

```ts
interface CardVisualSnapshot {
  readonly cardId: CardId;
  readonly rect: DOMRect;
  readonly rotationDegrees: number;
  readonly face: 'faceUp' | 'faceDown';
  readonly clone: HTMLElement | null;
  readonly sourceKind:
    | 'visible-card'
    | 'hidden-hand-anchor'
    | 'deck-anchor'
    | 'zone-anchor'
    | 'generated';
}
```

Rules:

- `rect` uses viewport coordinates until converted by `PlayMotionSurface`
- `clone` is detached and sanitized
- clone descendants cannot retain duplicate DOM IDs
- clone interaction attributes and handlers are removed or inert
- a synthesized source does not pretend to expose hidden card information
- card-facing policy is explicit, not inferred from incidental CSS classes

### Canonical endpoint

A canonical endpoint is resolved lazily:

```ts
interface CanonicalCardEndpoint {
  readonly cardId: CardId;
  resolveElement(): HTMLElement | null;
  resolveRect(): DOMRect | null;
  resolveRotationDegrees(): number;
  resolveFace(): 'faceUp' | 'faceDown';
}
```

The endpoint must query the current `cardRefs` entry. A destination element
captured before a Solid update may be used for initial measurement, but it
cannot be trusted as the handoff target after an `await`.

### Card motion session

The shared session contract is conceptually:

```ts
type CardMotionPhase =
  | 'captured'
  | 'surrogate-active'
  | 'landed'
  | 'handing-off'
  | 'complete';

interface CardMotionSession {
  readonly id: string;
  readonly cardId: CardId;
  readonly surrogate: HTMLElement;
  readonly phase: CardMotionPhase;

  animateTo(
    endpoint: CanonicalCardEndpoint | LogicalZoneEndpoint,
    style: CardMotionStyle,
  ): Promise<CardMotionResult>;

  handoffTo(endpoint: CanonicalCardEndpoint): Promise<CardMotionResult>;
  finishAtLogicalZone(): Promise<CardMotionResult>;
  cancel(reason: CardMotionCancelReason): Promise<CardMotionResult>;
  dispose(): void;
}
```

The concrete API may merge methods, but it must make these states and terminal
operations explicit.

### Result contract

Presentation failure is observable without becoming gameplay authority:

```ts
type CardMotionResult =
  | { status: 'completed' }
  | { status: 'cancelled'; reason: CardMotionCancelReason }
  | { status: 'recovered'; reason: CardMotionRecoveryReason };
```

All variants leave the DOM in a canonical, non-hidden terminal state.

No variant can dispatch or roll back a gameplay event.

## Canonical Visibility Lease

Direct writes such as:

```ts
element.style.visibility = 'hidden';
```

are prohibited outside the shared visibility owner for structural card
motion.

A lease records:

- session ID
- card ID
- element identity
- previous inline visibility
- whether the lease has been released

Conceptual API:

```ts
interface CanonicalVisibilityLease {
  readonly cardId: CardId;
  readonly element: HTMLElement;
  release(): void;
}

function acquireCanonicalVisibility(
  sessionId: string,
  cardId: CardId,
  element: HTMLElement,
): CanonicalVisibilityLease;
```

Requirements:

- release is idempotent
- a stale lease never overwrites a newer session's visibility decision
- overlapping structural sessions for the same card fail in development
- cancellation releases every lease held by the session
- handoff also restores the current card ref when it differs from the leased
  element
- screen disposal releases all leases owned by that motion scope

This registry is presentation-local and ephemeral. It is not serialized,
replayed, or stored in match state.

## Surrogate Factory

All structural card surrogates are created by one factory.

The factory supports:

```ts
type SurrogateBasis =
  | { kind: 'clone'; snapshot: CardVisualSnapshot }
  | { kind: 'destination-clone'; endpoint: CanonicalCardEndpoint }
  | { kind: 'synthetic-back'; owner: Owner }
  | { kind: 'adopt-existing'; element: HTMLElement };
```

`adopt-existing` is required for pointer drag. The accepted drag ghost becomes
the motion session's surrogate; it is not discarded and replaced by a second
flyer.

Every surrogate:

- mounts only in `PlayMotionSurface.overlay`
- is absolute and non-interactive
- has no persistent grid/flex structural class
- has a unique motion-session marker
- uses the shared frame-relative coordinate conversion
- has distinct owners for world motion, resting rotation, and visual scale
- is cleaned up through the session, never by an unrelated timeout callback

## Transform Ownership

Phase 1.22 preserves the Phase 1.21 transform separation:

```text
.card-motion-surrogate     left/top or motion translate
└─ .card-resting-shell     canonical resting rotation
   └─ .card-visual         scale/flip/card-local VFX
```

The implementation may use CSS individual transforms where appropriate, but:

- world motion cannot overwrite resting rotation
- landing scale cannot overwrite drag or flight translation
- card-local hover/VFX cannot change the surrogate's endpoint geometry
- cleanup cannot remove a transform property owned by another layer

## Handoff Contract

`handoffTo(destination)` performs:

1. stop accepting new motion writes for the session
2. re-resolve the current canonical destination by card ID
3. measure its untransformed layout box
4. verify endpoint tolerance
5. verify face agreement
6. restore canonical destination visibility
7. remove the surrogate in the same handoff task
8. release visibility leases
9. clear session registration
10. settle exactly once

If the current destination is missing:

- development records a structured diagnostic
- production performs bounded recovery
- the surrogate is removed
- any old visibility lease is released
- future canonical renders are not born hidden
- committed presentation continues

The session does not wait indefinitely for DOM.

## Endpoint Contract

At the final motion frame:

```text
abs(surrogate.centerX - destination.centerX) <= 0.5 CSS px
abs(surrogate.centerY - destination.centerY) <= 0.5 CSS px
abs(surrogate.layoutWidth - destination.layoutWidth) <= 0.5 CSS px
abs(surrogate.layoutHeight - destination.layoutHeight) <= 0.5 CSS px
surrogate.restingRotation == destination.restingRotation
surrogate.face == destination.face
```

Rotated `getBoundingClientRect()` dimensions are not reused as untransformed
layout dimensions. The session uses the same card layout-box normalization
for transfer and reveal.

## Landing and Additive VFX

A continuous transfer's trajectory is its landing animation.

Therefore:

- hand-to-lane does not start a second `vfx-pop` on the canonical destination
- lane-to-lane does not start a second `vfx-pop`
- lane-to-hand does not start a second `vfx-pop`
- deck/generated/pile entry completes its scale or flip on the surrogate
- any desired impact cue runs as additive overlay VFX after handoff

Permitted additive landing cues include:

- border pulse
- glow overlay
- particles
- a shadow or brightness pulse on a nested VFX layer
- sound

Prohibited landing cues include:

- canonical root opacity beginning at zero
- canonical root visibility toggling
- canonical layout width/height animation
- a second structural clone
- a second world-motion transform
- replaying the route's arrival scale on the canonical root

Anchor-to-anchor effects may continue to pulse an anchor because they do not
perform a card-to-canonical handoff.

## Route-Specific Contracts

### Local pointer drag: hand to lane

```text
pointer down
→ threshold crossed
→ create one drag ghost
→ drag ghost follows pointer
→ command accepted
→ same ghost animates to canonical lane destination
→ governed handoff
```

There is no ghost destruction followed by a transfer flyer.

On rejection or cancellation, the same ghost returns to its source and
handoffs back to the canonical source.

### Local pending undo: lane to hand

The existing pointer ghost becomes the return surrogate. Hand reservation and
sibling FLIP may run, but neither creates a second representation of the moved
card.

### Local committed stage adoption

The private planning projection already showed and animated the local play.
Committed adoption updates authority without starting a motion session.

### Remote face-down play

The remote hand exposes only a logical anchor. The session creates a synthetic
face-down surrogate without revealing card identity, flies it to the rendered
face-down destination, and hands off without a landing pop.

This is the primary regression fixture for the reported flash.

### Deck to local hand

The deck anchor is logical. A synthetic back or destination-derived safe clone
flies to the hand. The face transition completes on the surrogate before
handoff.

Hand reservation and sibling shifting remain separate layout motion.

### Lane to lane

The source visual is captured before adoption. The destination is re-resolved
after adoption. One surrogate travels between the two endpoints; source and
destination visibility leases cannot conflict.

### Visible card to pile

The surrogate may fade or shrink into the pile anchor. Because the destination
is logical rather than a canonical card, the session terminates through
`finishAtLogicalZone()` and restores no destination element.

### Pile or generated source to visible card

The source is logical. Entry scale/fade is part of the surrogate trajectory.
The canonical destination appears only at the final handoff.

### Reveal cinematic

Reveal remains a specialized trajectory:

```text
face-down canonical card
→ face-up reveal surrogate expands to center
→ hold
→ surrogate returns to destination
→ presented frame adopts the face-up canonical card
→ governed handoff
```

Reveal choreography may choose the face shown by the surrogate, but the
canonical destination face at handoff must come from presented state. Reveal
code may not permanently repair the canonical DOM by manually stripping
classes that should be renderer-owned.

## Sequencing with Committed Presentation

The runtime commits gameplay before presentation. Phase 1.22 preserves that
authority.

For a transfer frame:

```text
capture source and affected list geometry
→ derive motion session input
→ adopt committed presented frame
→ resolve destination
→ run layout FLIP for siblings
→ run surrogate trajectory
→ handoff
→ run additive VFX/SFX
```

Some visible-source routes must create and mount their surrogate before frame
adoption removes the source. That is a capture concern, not a second gameplay
commit.

Presentation timeout or cancellation may skip to canonical state. It never
prevents or rolls back frame adoption.

## Concurrency and Session Registry

Multiple different cards may animate concurrently when choreography permits.
One card may have at most one active structural motion session.

The motion scope maintains:

```ts
Map<CardId, CardMotionSession>
```

Starting a second structural session for the same card:

- throws or emits a hard diagnostic in development
- cancels and recovers the stale session before proceeding in production

Additive card-local VFX may coexist with a structural session if it does not
mutate structural visibility or motion ownership.

## Cancellation, Timeout, and Disposal

Every session supports cancellation from:

- pointer cancellation
- rejected drop
- presentation timeout
- presentation generation invalidation
- replay mode switch
- screen unmount
- route navigation
- topology removal of a destination lane
- reduced-motion fast completion

Cancellation is not merely `surrogate.remove()`.

It must:

- stop pending animation callbacks
- invalidate late promise continuations
- release source and destination leases
- restore the current canonical ref when applicable
- remove the surrogate
- remove session-scoped CSS variables and markers
- settle the session once

Late timeouts, `transitionend`, and animation-frame callbacks from a completed
session are no-ops.

## Reduced Motion

`prefers-reduced-motion` uses the same lifecycle with near-zero trajectory
duration.

It does not bypass capture, visibility ownership, handoff, or cleanup.

This proves that lifecycle correctness is independent of animation duration.

## Diagnostics

Development diagnostics expose:

- session ID
- card ID
- route
- current phase
- presentation generation, when available
- source and destination kinds
- source and destination element identities
- endpoint deltas
- face mismatch
- lease acquisition/release
- cancellation/recovery reason

Diagnostics are presentation-only and bounded. They do not enter the match
event log or serialized replay.

Temporary DOM nodes expose:

```html
data-card-motion-session="..."
data-card-id="..."
data-motion-phase="..."
```

These markers support tests and browser inspection. They are not gameplay
selectors.

## Architecture Fences

Automated fences fail when:

1. A live structural animation module writes canonical card
   `style.visibility` outside `canonicalVisibility.ts`.
2. A live structural animation module clones a card outside the surrogate
   factory.
3. A temporary card is appended outside `PlayMotionSurface.overlay`.
4. A structural surrogate lacks a session ID and cleanup owner.
5. A continuous transfer applies `vfx-pop` to its canonical destination.
6. A landing animation begins the canonical card at `opacity: 0`.
7. An accepted pointer drag creates a second landing flyer.
8. A call site retains a live dependency on the old standalone
   `flyFaceDownToSlot` lifecycle.
9. A session holds a destination element across an `await` without
   re-resolving the current card ref before handoff.
10. A completed, cancelled, or timed-out session leaves a temporary node,
    visibility lease, transition, or session registry entry.
11. A reveal permanently changes renderer-owned facing classes outside frame
    adoption.
12. Structural motion code reads lane DOM shape instead of registered card and
    zone anchors.
13. Structural motion or cleanup changes match state.

The fences are scoped to live play structural motion. Inspector clones,
authoring tools, and unrelated navigation animations are not silently pulled
into Phase 1.22.

## Migration Plan

### Checkpoint 0 — Characterize ownership and reproduce failures

Build:

- inventory every live structural surrogate call site
- identify unused and duplicate implementations
- add a deterministic enemy hand-to-lane fixture that proves the current
  post-landing opacity flash
- add lifecycle fixtures for draw, drag, lane movement, pile exit/entry, and
  reveal
- record endpoint, face, visibility, cleanup, and cancellation behavior

Proof:

- the enemy landing fixture fails for the known `vfx-pop` handoff
- existing semantic transfer and choreography tests remain green
- each live temporary-card path is classified as retained, migrated, or
  deprecated

Stop rule:

- Checkpoint 1 cannot start until the inventory identifies one owner for every
  live structural motion path.

### Checkpoint 1 — Shared session and visibility lifecycle

Build:

- add `CardVisualSnapshot`
- add the surrogate factory
- add the canonical visibility lease
- add the card motion session registry and state machine
- add idempotent finish, cancel, timeout, and disposal
- keep `PlayMotionSurface` as the sole geometry/mount adapter

Proof:

- lifecycle unit tests cover every state and terminal path
- no sampled state contains zero visible representations for a visible
  destination
- remount-before-handoff restores the current card ref
- repeated cleanup is harmless
- reduced-motion and background-frame fallback use the same lifecycle

Stop rule:

- no live choreography migration begins until the primitive proves success,
  cancellation, timeout, and remount.

### Checkpoint 2 — Transfer animator migration

Build:

- migrate `eventAnimator.ts` to the shared session
- remove direct transfer visibility writes and clone creation
- remove post-transfer canonical `vfx-pop`
- keep anchor-to-anchor pulses
- complete route scale/fade/flip on the surrogate
- preserve `deriveCardTransfers` and transfer-style authority

Proof:

- remote face-down play has one continuous flight and no flash
- lane-to-lane and hand/lane routes meet endpoint tolerance
- pile exits and entries clean up correctly
- multi-card events produce one session per moving card
- existing runtime and replay gates remain unchanged

### Checkpoint 3 — Pointer, draw, and reveal migration

Build:

- adopt the existing pointer ghost into a motion session
- migrate deck-to-hand draw
- migrate reveal cinematic
- make reveal adoption supply the canonical face at handoff
- migrate or retire any remaining live standalone flyer

Proof:

- accepted drag creates exactly one temporary card over its full lifecycle
- rejected and cancelled drag return cleanly
- draws preserve hand reservation and sibling FLIP
- reveal lands with matching dimensions, face, and resting rotation
- cancellation at every choreography phase restores canonical visibility

### Checkpoint 4 — Deletion, fences, and browser proof

Build:

- remove old live helper exports and compatibility wrappers
- move obsolete standalone implementations to the deprecated presentation
  area when historical reference is still useful
- add architecture source fences
- add session diagnostics to the existing debug surface
- document implementation evidence

Proof:

- no live card-motion path bypasses the session
- no direct structural visibility ownership remains outside the shared module
- no temporary card remains after success, cancellation, timeout, or disposal
- browser recordings show no blank, flash, snap, or second flight
- focused presentation tests, runtime/replay gates, build, lint, and Phase 1.21
  geometry gates pass

## Verification Matrix

### Lifecycle matrix

For each live route, test:

- normal completion
- immediate cancellation after capture
- cancellation during flight
- cancellation after landing but before handoff
- timeout
- screen disposal
- destination remount
- destination missing
- reduced motion
- late callback after completion

After each case:

```text
active session count == 0
visibility lease count == 0
temporary surrogate count == 0
canonical card visible when its presented zone is visible
presentation promise settled exactly once
match state unchanged by recovery
```

### Route matrix

At minimum:

| Route | Required proof |
| --- | --- |
| hidden remote hand → lane | face-down, no information leak, no landing flash |
| local pointer hand → lane | one ghost through accepted landing |
| local pointer lane → hand | one ghost through undo landing |
| deck → local hand | one flight, face transition, reservation preserved |
| generated → hand | entry scale completes before handoff |
| generated → lane | entry scale completes before handoff |
| lane → lane | source capture and destination remount |
| lane → discard | logical-zone finish, no hidden residue |
| lane → destroyed | fade/shrink and additive destroy VFX |
| lane → banished | fade/shrink and additive banish VFX |
| pile → hand | logical source to canonical destination |
| pile → lane | logical source to canonical destination |
| reveal | face-up canonical adoption at handoff |

### Visual continuity matrix

Sample presentation on animation frames before, during, at, and after handoff.

Assert:

- one governed surrogate at most
- no blank visual sample
- no canonical opacity reset
- no second scale-in after arrival
- no angle change at handoff
- no size change at handoff
- no endpoint position snap

### Geometry preservation

Rerun Phase 1.21 rectangle invariants while:

- remote cards fly in
- local cards drag and land
- cards draw
- cards reveal
- cards move between lanes
- cards exit to piles

Header, stage, footer, lane, slot, and location geometry remain unchanged
except for already-approved lane topology motion.

### Browser proof

Use deterministic debug decks and seeds to record:

- two remote cards entering different lanes
- a remote card landing at every progressive slot position
- a local drag accepted and rejected
- a draw into each hand-size scaling threshold
- a tilted card reveal at positive and negative resting angles
- a lane-to-lane move
- a destroy and return

Review at normal speed and frame-by-frame.

Acceptance is based on both DOM/session assertions and visible recordings.
Passing a final screenshot alone is insufficient.

## Test Design

### Unit tests

- state-machine transitions reject illegal phase changes
- visibility leases restore exact previous inline values
- visibility release is idempotent
- stale lease release cannot override a newer lease
- session cleanup is idempotent
- current destination ref is re-resolved at handoff
- transform ownership composes rotation exactly once
- synthetic remote/deck surrogate reveals no protected card identity

### Component/presentation tests

- `eventAnimator` creates one session for a structural transfer
- continuous transfer does not invoke canonical `vfx-pop`
- pointer controller adopts its ghost
- local committed stage adoption creates no session
- reveal adopts the committed face before handoff
- hand reservation and sibling FLIP ordering remain unchanged

### Browser tests

- animation-frame sampling around handoff
- cancellation and route navigation during active motion
- background/throttled-frame timeout recovery
- reduced-motion behavior
- one/two/three-lane geometry stability during card motion

Tests must assert ownership and cleanup, not only elapsed time.

## Performance Requirements

- one temporary DOM card per active structural session
- no per-frame reactive match-state writes
- pointer movement remains limited to one bounded update per animation frame
- destination geometry is measured at defined capture/landing points, not in a
  continuous loop
- no permanent `will-change` allocation remains after completion
- session registry and diagnostics are bounded by active motion
- no unbounded wait for an element, animation frame, or transition event

## Security and Hidden-Information Requirement

Remote hand and deck surrogates cannot expose:

- card name
- portrait
- cost
- power
- type
- definition ID
- hidden accessibility text
- hidden DOM descendants copied from a destination before reveal policy allows
  them

Synthetic back creation is the default for hidden-information sources.
Destination cloning is allowed only after applying the viewer-facing card
projection and explicit face policy.

## Replay and Debug Requirements

Replay scrubbing remains instantaneous and does not create motion sessions.

Optional replay playback may create sessions from adjacent presented frames,
but it must use the same lifecycle and viewer-safe endpoint policy.

Debug inspection may show motion diagnostics, but diagnostics cannot:

- mutate the presentation cursor
- expose hidden card identity
- enter canonical replay data
- change animation sequencing

## Interaction with Other Phases

Phase 1.22 depends on Phase 1.21's:

- fixed play frame
- persistent card/lane anchors
- VFX overlay
- Pointer Events controller
- `PlayMotionSurface`

It does not alter Phase 1.2 lane/location lifecycle or Phase 1.5 engine
capabilities.

It should complete before broader Phase 2/3 UI-provider and presentation
migration so those phases inherit one card-motion lifecycle rather than
multiple helper-specific contracts.

## Non-Goals

Phase 1.22 does not:

- change card, location, lane, scoring, or reveal rules
- change match events or `CardTransfer` semantic mappings
- change committed transaction order
- redesign card art or animation style
- retune durations or easings except where removing the erroneous second
  landing animation necessarily changes visible timing
- implement physics, springs, or 3D card motion
- redesign the VFX effect catalog
- replace Solid rendering with an imperative card renderer
- make one persistent card DOM node travel across every zone
- adopt browser View Transitions as a required dependency
- animate replay scrubbing
- add multiplayer transport behavior

## Exit Checklist

Phase 1.22 is complete only when:

- [ ] Every live structural card animation is inventoried.
- [ ] `deriveCardTransfers` remains the canonical transfer normalizer.
- [ ] `PlayMotionSurface` remains the sole coordinate and temporary-mount
      boundary.
- [ ] One shared card-motion session owns structural surrogate lifecycle.
- [ ] One shared visibility lease owns canonical suppression and restoration.
- [ ] Surrogate creation is centralized.
- [ ] Destination refs are re-resolved at handoff.
- [ ] Cleanup is idempotent on success, cancellation, timeout, and disposal.
- [ ] Accepted pointer drag uses one ghost through landing.
- [ ] Local committed stage adoption does not replay motion.
- [ ] Remote face-down play contains no landing flash.
- [ ] Continuous transfers do not apply canonical `vfx-pop`.
- [ ] Draw completes face/scale motion before canonical handoff.
- [ ] Reveal adopts renderer-owned face state before canonical handoff.
- [ ] Every route meets endpoint geometry and resting-rotation tolerance.
- [ ] No sampled handoff frame is visually blank.
- [ ] No structural motion leaks hidden opponent information.
- [ ] No completed session leaves a surrogate, lease, transition, marker, or
      registry entry.
- [ ] Old live flyer APIs and compatibility wrappers are removed.
- [ ] Phase 1.21 exact-9:16 and stable-layout gates remain green.
- [ ] Runtime, replay, presentation, build, and lint gates remain green.
- [ ] Deterministic browser recordings pass normal-speed and frame-by-frame
      review.

## Definition of Failure

Phase 1.22 is not complete if it only removes the currently observed
`vfx-pop`.

Any of the following fails the phase:

- a second route retains its own hide/clone/restore lifecycle
- an accepted drag discards one temporary card and creates another
- a session can finish with its canonical card hidden
- timeout cleanup differs semantically from normal cleanup
- a remounted destination inherits stale hidden state
- a landing changes size, face, or angle
- a canonical destination starts another opacity/scale entrance after landing
- reveal manually patches renderer-owned facing after the shared lifecycle is
  introduced
- an old compatibility wrapper preserves two implementations
- a presentation failure changes committed state or order
- tests check only the final DOM and never sample the handoff boundary
- the fix destabilizes the exact 9:16 layout or persistent lane geometry
