# Phase 1.5 C5C — Permanent Architecture Gates

Status: implemented and exit-proven

Date: 2026-07-20

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Exit Decision

C5C is complete. Phase 1.5 now has one consolidated AST/import/source gate
covering the architecture laws that must remain true as content and engine
capabilities grow.

## Permanent Laws

The gate fails when:

- a `MatchEvent` variant is added without explicit constructor ownership or
  dormant classification;
- a mutation event is constructed outside its owning operation;
- production code imports or calls the reducer outside the publication/replay
  allowlist;
- committed reactions are collected outside the canonical rules dispatcher;
- active card/location content imports engine capabilities;
- providers, components, debug UI, or presentation code imports/calls kernel
  capabilities;
- simulation or runtime authority calls `Math.random`;
- a canonical event lacks semantic-envelope routing;
- reaction discovery can occur before semantic capture.

## Implementation

`phase15-architecture-gates.test.ts` uses the TypeScript AST for object-literal
event constructors, imports/exports, reducer calls, reaction-collector calls,
capability calls, and random calls. Semantic closure uses the authoritative
event union and canonical capture router, so adding an event requires an
explicit architecture decision.

The gate is part of `npm run test:playgame:phase15`; it is not an optional audit
script.

## Exit Evidence

- [x] consolidated architecture laws: 7/7
- [x] Phase 1.5 gate: 33 files, 277/277 tests
- [x] Phase 0 runtime/generated-match gate: 12 files, 83/83 tests
- [x] Phase 1.5 lint gate
- [x] protocol schema, TypeScript conformance, and Rust conformance gates
- [x] generated manifests current; 130 cards and 38 locations validated
- [x] production build
- [x] C5B deletion fences remain green
- [x] lifecycle, replay parity, RNG authority, and generated-match gates remain
  in the permanent verifier

## Next Slice

Run and record the complete Phase 1.5 exit verifier. Phase 1.5 is complete only
if content locality, governed mutation, historical semantics, deterministic
reaction discovery, replay purity, and the absence of legacy routes all pass
together.
