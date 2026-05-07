# Replay And Debug Spec

## Summary

The `/play` game should be internally replayable from the beginning of the match using:

- initial `seed`
- `manifest`
- authoritative append-only `MatchEvent[]`

This is already mostly true in the engine architecture. What is missing is the productized tooling to:

- reconstruct any intermediate board state
- scrub or step through the match timeline
- inspect why the board looked a certain way after a specific play
- export match history in a stable debug format

This spec defines a first-class replay and debug system built on the existing deterministic engine model.

## Status

Engine architecture already supports deterministic replay in principle.

What we do **not** yet have:

- a canonical replay utility in the app
- a timeline debugger for `/play`
- a stable exported debug snapshot format
- a dev-facing in-browser inspection API

## Goals

- Guarantee that a match can be replayed from turn 1 to the end using canonical engine inputs.
- Make every board state reconstructible after every authoritative event.
- Allow developers to inspect:
  - current engine state
  - event log
  - derived projections at any point in history
  - board state after a specific play/reveal/turn boundary
- Support both:
  - in-app developer tooling
  - exported JSON for offline debugging

## Non-Goals

- Full production spectator mode
- Server synchronization protocol
- Multiplayer transport or persistence design
- Visual animation replay fidelity
- Undo-as-replay replacement

## Current Architecture

### What already exists

The engine already has the right foundations:

- deterministic initial state via `createInitialMatchState(seed, manifest)`
- pure reducer via `apply(state, event, manifest)`
- append-only per-match event log stored in `MatchState.log`
- deterministic RNG via `rng.fork(tag)`
- deterministic headless match runner in `services/playgame/engine/cli/runMatch.ts`

Relevant files:

- [state.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/types/state.ts)
- [events.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/types/events.ts)
- [apply.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/apply.ts)
- [initState.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/cli/initState.ts)
- [runMatch.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/cli/runMatch.ts)
- [main.ts](/Users/timotholt/Projects/CruelDeal/services/playgame/engine/cli/main.ts)

### Important current caveats

- `ui.history` in `PlayGameContext` is an undo stack, not a replay timeline.
- `/play` does not expose a replay inspector.
- Some UI animation sequencing lives outside the engine and should not be treated as authoritative replay state.
- Derived state is intentionally not stored in `MatchState`; it must be recomputed by projections during replay.

## Core Principle

Replay is **event-sourced**.

Canonical reconstruction:

```ts
const state0 = createInitialMatchState(seed, manifest);
const stateN = log.reduce(
  (s, entry) => apply(s, entry.event, manifest),
  state0,
);
```

Anything that cannot be reproduced from:

- `seed`
- `manifest`
- `event log`

is not canonical match state.

## Replay Granularity

The base replay unit is **one event**.

Everything else is a bookmark or grouped view layered on top:

- after each player intent
- after each `CARD_STAGED`
- after each `CARD_FLIPPED`
- after each reveal slice
- after `TURN_ENDED`
- after `TURN_STARTED`

This matters because “after a card played” is not a single state transition. A play can expand into:

- `CARD_STAGED`
- `ENERGY_CHANGED`
- later `CARD_FLIPPED`
- `OR_WINDOW_OPEN`
- zero or more effect events
- `OR_WINDOW_CLOSE`

So the system must replay **events**, then offer higher-level navigation markers for usability.

## Canonical Replay Artifacts

### 1. Replay source

Introduce a serializable replay bundle shape:

```ts
interface ReplayBundle {
  version: 1;
  manifestVersion: number;
  protocolVersion: number;
  seed: string;
  initialState?: null;
  events: MatchEvent[];
  metadata?: {
    createdAt?: string;
    localSeat?: Seat;
    notes?: string;
  };
}
```

Notes:

- `initialState` should normally be omitted, because canonical replay should rebuild from `seed + manifest`.
- It may be added later as a non-canonical convenience snapshot for debugging only.

### 2. Replay timeline

Introduce a replay timeline helper:

```ts
interface ReplayFrame {
  index: number;
  event: MatchEvent | null;
  state: MatchState;
}

interface ReplayTimeline {
  frames: ReplayFrame[];
  finalState: MatchState;
}
```

Frame `0` is the initial state before any events.

### 3. Replay bookmarks

Introduce grouped landmarks:

```ts
interface ReplayBookmark {
  frameIndex: number;
  kind:
    | 'MATCH_START'
    | 'TURN_START'
    | 'TURN_END'
    | 'CARD_STAGED'
    | 'CARD_REVEALED'
    | 'LOCATION_REVEALED'
    | 'MATCH_END';
  label: string;
}
```

Bookmarks are UI aids only. They must be derived from the event stream and never be authoritative themselves.

## Required Engine Utilities

### 1. `replayMatch()`

Add a new engine utility module:

- `services/playgame/engine/replay.ts`

Exports:

```ts
export interface ReplayMatchOptions {
  seed: string;
  manifest: Manifest;
  events: readonly MatchEvent[];
}

export interface ReplayResult {
  initialState: MatchState;
  finalState: MatchState;
  frames: readonly ReplayFrame[];
}

export function replayMatch(opts: ReplayMatchOptions): ReplayResult;
```

Behavior:

- construct `initialState` with `createInitialMatchState(seed, manifest)`
- fold events through `apply()`
- emit every intermediate frame

### 2. `buildReplayBookmarks()`

```ts
export function buildReplayBookmarks(
  frames: readonly ReplayFrame[],
): ReplayBookmark[];
```

### 3. `exportReplayBundle()`

```ts
export function exportReplayBundle(
  state: MatchState,
  manifest: Manifest,
  extras?: ReplayBundle['metadata'],
): ReplayBundle;
```

This should export:

- `state.seed`
- `manifest.version`
- `manifest.protocolVersion`
- `state.log.map(x => x.event)`

### 4. `validateReplayBundle()`

```ts
export interface ReplayValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateReplayBundle(bundle: ReplayBundle, manifest: Manifest): ReplayValidationResult;
```

Checks:

- protocol version match
- manifest version match
- events are structurally valid
- deterministic rebuild completes without reducer error

## In-App Developer Tooling

## Dev Debug Surface

Add a dev-only `/play` debug surface with three entry points:

### 1. In-game debug drawer

Dev-only panel showing:

- current turn / phase / priority
- seed
- manifest version
- total event count
- selected frame index
- selected event JSON
- selected state summary
- lane score breakdowns

### 2. Timeline scrubber

Controls:

- jump to start
- step backward / forward one event
- jump to previous / next bookmark
- jump to turn start / turn end
- jump to latest live state

### 3. Console API

Expose a dev-only global:

```ts
window.__snapDebug = {
  getLiveState(),
  getLiveLog(),
  getReplayBundle(),
  getFrame(index),
  getReplayTimeline(),
  getLaneBreakdown(frameIndex, lane, owner),
  copyReplayJson(),
};
```

This is the lowest-friction inspection mechanism for development.

## UI Spec

### Replay panel placement

Recommended:

- collapsible right-side dev drawer in `/play`
- hidden in production builds
- keyboard shortcut optional later

### Frame display

When the user is viewing a historical frame:

- the board should render from replay frame state, not live state
- all selectors and inspectors should read that frame state
- mutation controls should be disabled

Important:

- replay mode must be visually distinct from live mode
- e.g. a top badge: `REPLAY FRAME 42 / LIVE`

### Inspector integration

All existing inspectors should work against replayed state:

- card inspector
- location inspector
- lane score breakdown

This is one of the strongest reasons to use reconstructed `MatchState` frames instead of ad hoc log parsing.

## Data Retention Rules

### Must remain authoritative

- `MatchState.seed`
- `MatchState.log`
- `Manifest.version`
- event ordering

### Must remain derived

- card power projections
- lane totals
- ongoing modifiers
- reveal multipliers

Never serialize derived score values as canonical replay truth.

## Current Match Logging Assessment

Today, every applied event is appended to `state.log` in `apply.ts`.

This is good and should remain the foundation.

However:

- the app does not currently surface `state.log`
- the app does not currently reconstruct timeline frames
- undo history is not replay history

So the answer to “do we maintain replayability?” is:

- at engine model level: mostly yes
- at developer-tooling/product level: not yet enough

## CLI Extensions

The existing CLI already supports:

- `npm run engine:cli -- --seed=x`
- `npm run engine:cli -- --seed=x --json`

Extend it with:

- `--replay <file>`
- `--export-replay <file>`
- `--frames`
- `--bookmarks`

Examples:

```bash
npm run engine:cli -- --seed=abc --export-replay=/tmp/match.json
npm run engine:cli -- --replay=/tmp/match.json --frames
npm run engine:cli -- --replay=/tmp/match.json --bookmarks
```

## Recommended Debug Formats

### Primary format: JSON bundle

Use JSON for replay bundles.

Why:

- easy to inspect
- easy to attach to bug reports
- easy to pipe through tooling
- easy to expose from browser console

### Secondary format: JSONL events

Keep JSONL event streaming in CLI for terminal workflows.

### `curl` support

Recommended only later, not first.

If added, it should be a dev-only local endpoint like:

- `GET /__debug/play/replay`
- `GET /__debug/play/state`
- `GET /__debug/play/frame/:idx`

But the first implementation should use:

- in-app panel
- `window.__snapDebug`
- JSON export

because `/play` is currently client-owned state, not server-owned state.

## Edge Cases

### Unrevealed locations with cards already played there

This must be handled explicitly.

The current engine model already supports this shape:

- `LaneState.location` may already be assigned
- `LaneState.locationRevealed` may still be `false`
- cards may already exist in `lane.cards`

Replay must preserve that exact intermediate state.

Required behavior:

- historical frames must show cards in the lane even if the location is still unrevealed
- the location tile must remain hidden if `locationRevealed === false`
- lane score calculations must still use the correct canonical engine state for that frame
- location-derived effects must only contribute if they are actually active at that frame

UI guidance:

- if a replay frame is before `LOCATION_REVEALED`, the location inspector should still treat the location as unrevealed
- if later we expose internal debug-only data, we may optionally show the bound `defId` in a dev panel, but not in the normal board presentation

### Manifest drift

Replaying old events against a different manifest can produce invalid results.

Required behavior:

- validate `manifestVersion`
- show explicit incompatibility message
- refuse canonical replay if versions differ

### Non-deterministic bugs

If replay diverges from the original live match:

- that is a determinism bug
- not a replay bug

We should treat that as a high-severity engine issue.

### UI-only transient state

Do not attempt to replay:

- FLIP animation buffers
- toast queues
- timing delays
- hover state
- temporary zoom state

Those belong to presentation, not authoritative replay.

### Future hidden-information rules

If later we add fog-of-war or hidden enemy state:

- replay system should still reconstruct full canonical state internally
- UI may need a filtered “viewer-safe” frame representation

That filtering is a separate concern from core replay.

## Testing Requirements

### Engine tests

Add tests for:

- replaying `state.log` from `seed` reproduces final state exactly
- frame `n` equals applying first `n` events
- same seed + same events => byte-identical replay states
- replay bundle validation rejects mismatched manifest version

### UI tests

Add smoke coverage for:

- opening replay drawer
- stepping event-by-event
- switching back to live mode
- inspectors working while in replay mode

## Rollout Plan

### Phase 1: Engine replay utility

- add `replay.ts`
- add replay bundle shape
- add validation
- add tests

### Phase 2: Console debug API

- add `window.__snapDebug`
- expose live state, log, replay bundle, frame helpers

### Phase 3: In-app dev replay drawer

- add replay panel in `/play`
- step through frames
- read all inspectors from replay frame state

### Phase 4: CLI export/import

- add replay import/export commands
- add bookmark printing

### Phase 5: Optional local debug endpoint

- add dev-only `curl` endpoints if still needed

## Recommendation

Proceed.

This is not speculative infrastructure. The engine is already event-sourced enough that we should formalize replay as a first-class debugging capability. That will directly help investigate issues like:

- “why didn’t Dune Sapper move?”
- “why did this lane score show 11?”
- “what exact state existed before this reveal?”

The first implementation should prioritize:

1. canonical replay utility
2. console export/introspection
3. in-app replay drawer

That gets us most of the value quickly without needing server endpoints or heavy tooling.
