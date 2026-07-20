# Phase 2 — Provider Boundary Readiness

Status: ready to implement

Date: 2026-07-20

Authority: `docs/playgame-runtime-and-ui-refactor-plan.md`, Phase 2

## Decision

Phase 2 will replace `PlayGameContext` with two contexts in one production
cutover. There will be no compatibility provider, alias hook, canonical-state
fallback, or dual publication path.

The provider boundary will consume a trusted local projection adapter. That
adapter is the only browser-side object allowed to see both `MatchSession`
authority and player-facing projected types.

## Current Census

`PlayGameContext` currently combines five responsibilities:

1. canonical `MatchState` presentation cursor;
2. runtime intent submission and local card-ID authority;
3. bootstrap participant metadata;
4. presentation state, reservations, locks, and timing;
5. replay/debug export.

Production consumers are:

- `ClassicPlayScreen` and `CityMapScreen` — provider hosts;
- `PlayBoard` — all five responsibilities;
- `BoardCard` — staged/facing presentation state;
- `LanePowerPanel` and `StatLogPanel` — canonical engine debug projections.

The existing seat projection already supplies redacted state, opaque card and
location tokens, projected animation events, and reconnect snapshots. It does
not yet supply the local presentation-frame wrapper, token-to-intent
translation, or projected power-history/detail read models required to remove
canonical state from components.

## Canonical Boundary

### Trusted local adapter

Introduce one `LocalMatchSessionAdapter`, owned by
`MatchSessionProvider`. It exposes only:

- projected bootstrap/session metadata;
- current `SeatMatchSnapshot`, including the viewer's private staged plan;
- projected opening and committed transaction timelines;
- typed commands that accept projected card tokens;
- replay/debug commands behind a development-only adapter;
- read-only performance telemetry.

Internally it may use `MatchSession`, canonical transitions, and authority-side
token lookup. Those values never cross its public type.

### MatchSessionContext

`MatchSessionContext` owns match/session data and commands:

- projected current snapshot;
- content manifest;
- match ID, mode, ruleset, viewer/other seat;
- participant ID, controller, display name, avatar ID;
- player and location deck ID, revision, name, and counts;
- transaction/resolution status;
- stage, unstage, undo-last, end-turn, and replay-export commands.

It exposes no canonical `MatchState`, `EventTransition`, reducer, kernel
operation, raw runtime, or Solid setter.

### PlayUiContext

`PlayUiContext` owns presentation state:

- presented projected snapshot and active projected timeline;
- generation-safe presented-frame cursor;
- resolution lock and presentation-busy state;
- hand reservations, inspector, portrait/pile menus, terminal prompt, and
  replay drawer;
- frame presentation timing and finish/abort/fast-forward operations.

It receives projected timelines from `MatchSessionContext` but no submit-intent
capability inside presentation hooks.

## Projected Frame Contract

Add a short-lived `SeatTransactionFrame` for local presentation:

- canonical `frame` and temporal `scope`;
- projected/redacted animation event or explicit intentional no-op;
- projected `before` and `after` states;
- transaction-local index and transaction ID.

The trusted adapter constructs these frames synchronously during runtime
publication, while the private-plan projection is available. The adapter
releases canonical transitions immediately. Live and replay presentation use
the same projected frame shape.

This is not another clock and is not stored in the replay log.

## Token Command Contract

Components submit `SeatCardToken`, never `CardId`.

The trusted adapter resolves a token against the current authority-side
working projection, verifies that it belongs to the viewer and is in a legal
source zone, then creates the runtime intent. The runtime remains responsible
for final legality and revision checks. Unknown or stale tokens return the
normal typed rejection path; they never fall back to accepting a canonical
ID.

## Read Models

Before cutting consumers over, add projected selectors/read models for:

- visible hand, lane, discard, destroyed, and banished cards;
- visible location details;
- effective card cost/power and lane power;
- staged-card identity/facing;
- visible card cost/power history;
- lane power breakdown with projected source labels.

`LanePowerPanel` and `StatLogPanel` consume those read models. They may not
import internal card records, power ledgers, or canonical engine projections
after the cutover.

## Delivery Slices

### P2A — Projected adapter contract

- add `SeatTransactionFrame`/timeline;
- add authority-side token command translation;
- add projected detail/history read models;
- prove hidden data does not cross the adapter.

No production provider changes land in P2A.

### P2B — Context cutover

- add `MatchSessionProvider` and `PlayUiProvider`;
- port the five existing provider synchronization tests to the split contract;
- mount both providers in classic and city-map play;
- migrate `PlayBoard`, `BoardCard`, and the two inspector panels;
- delete `PlayGameContext.tsx` and its old tests in the same commit.

### P2C — Ownership completion

- move remaining board-local inspector/menu/pile/replay/prompt state into
  `PlayUiContext`;
- gate replay/debug helpers behind development authority;
- add disposal/remount and stale-generation tests;
- add provider/component architecture fences.

## Non-Regression Matrix

The cutover must preserve:

- opening begins from setup projection and walks the real committed opening;
- private stage/unstage updates are immediately reactive;
- committed resolution does not snap the board ahead of presentation;
- staged cards lock before the first resolving frame paints;
- reveal order and card facing remain frame-exact;
- missing DOM anchors still complete the projected opening;
- drag/drop accepts projected tokens and keeps the existing motion handoff;
- city-map and classic play consume the same providers;
- replay export and performance telemetry remain read-only;
- provider disposal cannot publish a stale cursor update.

## Stop Conditions

Stop and redesign before merging if:

- a component still receives `MatchState`, `CardId`, or `EventTransition`;
- both old and new providers are mounted or exported;
- a projected token is accepted as a canonical ID fallback;
- presentation code can submit an intent from a frame hook;
- the adapter retains canonical transitions after projection;
- a selector recomputes game policy or location/card reactions;
- a visual/CSS redesign enters this phase.
