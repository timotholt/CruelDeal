# Playgame Boundary-Hardening Mini-Spec

## Status

Ready for implementation. This is the next architectural phase after the
completed local runtime/UI refactor. It hardens the boundaries around the
working deterministic game; it does not rewrite that game.

## Objective

Make `services/playgame` the only active gameplay architecture, make `/play`
independent of whether match authority is local or remote, restore trustworthy
type-checking for shipped code, and give application routing one owner.

After this phase, a live TypeScript or Rust match service can attach through a
client adapter without changing play components, presentation choreography,
seat projections, or the transactional rules kernel.

## Non-Goals

- Do not change card rules, location rules, game balance, animation timing, or
  animation choreography.
- Do not rewrite the reducer, rules kernel, replay, reconciliation, projection,
  presentation director, or `PlayBoard` composition.
- Do not repair or migrate collection, deck-editor, store, or progression card
  data in this phase.
- Do not implement durable server storage, matchmaking, sockets, reconnect,
  leases, or Rust game authority.
- Do not preserve compatibility with the superseded local API or legacy game
  types. CruelDeal has no backward-compatibility requirement during active
  development.

## Required Invariants

1. The engine remains DOM-free, deterministic, seeded, and single-authority.
2. One accepted committed turn is delivered to presentation as one complete,
   ordered `SeatTransactionTimeline`; it is never streamed frame by frame by a
   transport adapter.
3. Interaction remains locked for the complete committed presentation block.
4. No canonical `MatchState`, canonical IDs, hidden card identity, or engine
   `Manifest` crosses the player-facing client boundary.
5. `LocalMatchSessionAdapter` and a future remote adapter expose the same
   player-facing contract.
6. The router is the sole owner of route selection, authentication layout,
   application chrome, and development-layout selection.
7. Active shipped code and the playgame engine have a mandatory, green
   TypeScript gate. Experimental code cannot make that gate meaningless.
8. The old game engine and mock authoritative match API are not importable from
   active application code.

## Parallel Workstreams

The four workstreams below may run concurrently after the small shared contract
in A1 lands. Each workstream owns disjoint files. Integration happens only after
its local gate passes.

### A. Match Client Port

Primary ownership:

- `services/playgame/client/**` (new)
- `services/playgame/runtime/localMatchSessionAdapter.ts`
- `contexts/MatchSessionContext.tsx`
- `contexts/PlayProviders.tsx`
- `components/screens/ClassicPlayScreen.tsx`

#### A1. Define the contract

Create a player-facing `MatchClient` interface. Its public surface is limited to:

- projected bootstrap and client content catalog
- initialization snapshot and opening transaction timeline
- current projected snapshot
- subscription to complete committed transaction timelines
- stage, unstage, undo, and end-turn commands
- player-facing stat read models
- optional development diagnostics behind a separate debug capability
- lifecycle disposal

The client content catalog contains display metadata and match constants needed
by rendering. It is not the canonical engine `Manifest`.

#### A2. Implement the local client

Make the existing local adapter implement `MatchClient`. It remains the trusted
projection bridge around `MatchSession`, but no provider or component may import
or construct `MatchSession` through the client contract.

#### A3. Invert provider construction

`MatchSessionProvider` accepts a `MatchClient`; it does not instantiate
`LocalMatchSessionAdapter`. `PlayProviders` accepts the same port.

`ClassicPlayScreen` may create the local client at the route/composition edge for
debug play. Future production route code will instead supply a remote client.

#### A gate

- Existing `/play` behavior and animation tests remain unchanged and green.
- A provider architecture fence rejects imports of `MatchSession`, canonical
  `MatchState`, canonical IDs, and engine `Manifest` below the composition edge.
- A contract test runs the same command/subscription scenario through any
  `MatchClient` implementation.
- Subscribers receive exactly one complete timeline for one committed turn.

### B. Retire the Legacy Match Architecture

Primary ownership:

- `services/api.ts`
- `services/api/matchService.ts`
- `services/engine/**`
- `services/ai.ts`, `services/planning.ts`, `services/effects.ts`
- `services/triggers.ts`, `services/statSystem.ts`, `services/mutations.ts`
- other files used exclusively by that legacy match graph
- `deprecated/legacy-game/**` (new destination)

#### B1. Remove the active API

Delete `api.match` and its imports. The current `/play` route already uses the
canonical playgame runtime and must not fall back to the old mock service.

#### B2. Quarantine the complete dependency graph

Move the old match service, old engine, and files used exclusively by it under
`deprecated/legacy-game`. Do not leave aliases, adapters, fallback reads, or
dual implementations in active source.

Do not migrate collection or meta-game consumers in this workstream. Shared
meta-game types remain where they are until a separately authorized migration.

#### B gate

- No active TypeScript file imports the retired gameplay graph.
- `api.match` no longer exists.
- `/play`, card validation, location validation, and the production build pass.
- An architecture fence rejects active imports from `deprecated/legacy-game`.

### C. Single Router and Lazy Development Surfaces

Primary ownership:

- `App.tsx`
- `router.tsx` or a new `routes/**` folder
- route-layout components introduced by this workstream

#### C1. Remove manual path routing

Delete all `window.location.pathname` route selection from `App.tsx`. `App.tsx`
owns application-wide providers and error handling only.

#### C2. Add explicit route layouts

Use router-owned layouts for:

- public/login routes
- authenticated meta-game routes
- `/play`
- development/authoring routes

Route metadata or nesting decides application chrome, navigation, authentication,
and dev-only access. Components do not infer those policies from path strings.

#### C3. Split development code

Lazy-load city-map experiments, material labs, preview screens, authoring tools,
GameText tests, and icon labs. Production startup must not eagerly import them.

#### C gate

- Every supported route has one router definition and a direct-navigation test.
- No pathname inspection remains in `App.tsx`.
- Login, `/play`, one authenticated meta route, and representative dev routes
  render with the intended providers and chrome.
- The production build contains separate lazy chunks for development surfaces;
  the main chunk decreases from the recorded 2.87 MB baseline.

### D. Trustworthy TypeScript Project Gates

Primary ownership:

- `tsconfig*.json`
- `package.json` validation scripts
- CI/check scripts required for the new projects
- source-local type fixes only when necessary to make the active gates honest

#### D1. Define projects by responsibility

Create explicit TypeScript projects for at least:

- canonical playgame engine/runtime/protocol
- shipped application
- development/authoring tools
- city-map experiments
- scripts/tests where a separate environment is required

Backups, generated scratch copies, worktrees, migrated prompt history, deprecated
code, and other non-source artifacts must not participate in active gates.

#### D2. Add one canonical verification command

Add a top-level command that checks generated artifacts, active TypeScript
projects, focused architecture tests, and the production build. Existing phase
commands may remain as implementation details, but contributors need one
trustworthy entry point.

#### D3. Restore the existing phase gate

Fix the current Phase 1.5 lint failure caused by the unused `_basePower` binding
in `revealTransaction.test.ts`; do not weaken the warning policy.

#### D gate

- Active app and canonical playgame projects type-check with zero errors.
- Experimental project failures are visible in their own gate and cannot block
  or create false confidence in the shipped-code gate.
- The canonical verification command exits nonzero on generation drift, a type
  error, an architecture-fence failure, a focused test failure, or build failure.

## Integration Order

1. Land A1 first because it defines the only shared seam.
2. Run A2/A3, B, C, and D concurrently in separate branches/worktrees.
3. Integrate B, C, and D in either order after their local gates pass.
4. Integrate A2/A3 after the contract test proves the local implementation.
5. Run the complete integration gate once on the combined tree.

Workstreams may not solve merge conflicts by weakening an invariant, restoring a
legacy import, adding a compatibility adapter, or moving authority into UI code.

## Complete Integration Gate

- Canonical verification command is green.
- Full `/play` opening, staging, undo, end-turn, opponent play, reveal,
  presentation, replay, and match-close browser smoke path succeeds.
- Existing card and location generated artifacts are current and valid.
- TypeScript and Rust protocol tests pass against the same schema artifact.
- One generated committed turn folds to the same final projected state when
  applied locally and when serialized, validated, deserialized, and reapplied.
- Production build succeeds and development surfaces are code-split.
- Active-source searches find no second route authority, second match engine,
  canonical state below the client port, or active deprecated import.

## Explicitly Deferred Follow-Up

After this mini-phase is complete, write the live-server implementation spec for
authenticated actor binding, durable atomic commit, receipts and idempotency,
snapshot-plus-tail recovery, checksums, reconnect, ownership leases, transport
backpressure, retention, and Rust authority cutover. Those concerns attach to
`MatchClient`; they do not reopen the UI or presentation architecture.
