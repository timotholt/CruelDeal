# Phase 1.2 Checkpoint 5 — Cleanup and Architecture Fences

Status: complete in the current worktree.

## Outcome

Phase 1.2 now has one clean architecture:

- a bootstrap-producing adapter selects and orders the location deck;
- every engine setup entry point requires that complete ordered third deck;
- setup and lifecycle operation modules are the only canonical location/lane
  event producers;
- the reducer is the only post-genesis writer of active topology and lane
  status;
- replay folds the resulting facts without selecting content or rerunning
  reactions.

There is no location-deck compatibility path, default, fallback read, alias,
or dual write.

## Explicit third-deck contract

`createInitialMatchState()`, `createSetupMatch()`, and `runMatch()` now require
an ordered location deck. The engine initializer no longer contains weighted
selection, manifest enumeration, or an optional location input.

Production/debug/CLI callers use `defaultLocationDeckFactory` before engine
construction. Engine tests use `orderedTestLocationDeck`, an explicitly
test-only deterministic fixture. The engine can validate and look up supplied
definitions, but it cannot silently decide which definitions belong to the
match.

## Mutation authority

The public governed location operation surface now includes:

- schedule, reveal, conceal, and private disclosure;
- move, swap, replace, remove, return, and Ruin replacement;
- add/remove location tags and change location counters;
- create/destroy lanes and destroy all other lanes.

Authored effect evaluation requests these operations. It does not construct
location mutation events itself.

## Permanent fences

`location-architecture-fences.test.ts` fails if future code:

- constructs a lifecycle, tag, counter, or lane mutation event outside
  `locationLifecycle.ts`, `locationSetup.ts`, or the event contract;
- writes `activeLaneOrder` outside genesis/reducer contracts;
- writes lane lifecycle status outside the reducer;
- enumerates `manifest.locations` anywhere except the bootstrap location-deck
  factory;
- imports runtime adapters into the simulation core;
- introduces `laneIndex` or `laneIdx` into canonical state/event contracts;
- restores an optional/default/fallback location deck in setup helpers.

These are source-architecture tests, not conventions.

## Phase 1.5 reaction seam

Phase 1.2 owns canonical mutation facts. Phase 1.5 will observe committed
events and dispatch location/card reactions through its centralized reaction
engine.

The boundary is:

1. a governed operation validates and produces canonical events;
2. runtime authority commits them and assigns frames;
3. the future reaction dispatcher observes committed events and requests more
   governed operations;
4. replay folds all recorded events and never invokes the dispatcher.

No location-specific reaction hook system was added in Phase 1.2, so Phase
1.5 retains one clear place to install it.

## Proof

- canonical engine/runtime/debug/presentation/drag/protocol Vitest gate:
  258/258;
- Phase 0 runtime/property gate: 71/71 with 200 generated cases;
- architecture fences: 6/6;
- standalone reducer, evaluator, resolver, content, location primitive, and
  replay gates: green;
- headless CLI full-match smoke test: green;
- TypeScript protocol validation: 4/4;
- Rust protocol conformance: 2/2;
- protocol schema artifact: current;
- changed-file ESLint gate with zero warnings: green;
- production Vite build: green;
- changed engine/runtime surface: no new TypeScript errors;
- `git diff --check`: green.

## Exit decision

Every Checkpoint 5 exit criterion is met. Phase 1.2 is complete. Phase 1.5 can
build folder-based location authoring and centralized reactions on the
canonical location deck, lifecycle events, and mutation authority established
here.
