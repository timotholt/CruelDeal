# Playgame Authority-Independent Testing Contract

## Status

Active architectural contract for the remote-authority refactor.

## Requirement

Changing match authority must never change which product behaviors can be
tested. One canonical test command must run the same player-facing contracts
against every registered authority implementation.

"100% of tests" has three precise categories:

1. Deterministic engine, reducer, kernel, content, protocol, and replay tests
   run once. They are authority-independent and define the mechanics every
   authority must host.
2. Every player-visible match contract and UI integration behavior runs once
   per entry in `MATCH_AUTHORITY_TEST_DRIVERS`.
3. Transport, persistence, lease, process, and adapter implementation tests may
   be authority-specific. They are additional coverage and may never replace a
   shared player-visible contract.

No test may be skipped because a selected authority lacks a capability. A new
authority either satisfies the shared contract or fails the matrix.

## Canonical test seam

`services/playgame/testing/authorityRegistry.ts` is the only authority test
registry. Each entry creates a `MatchClient` from the same `MatchBootstrap` and
declares its boundary type.

The initial matrix contains:

- direct local TypeScript authority;
- serialized asynchronous loopback TypeScript authority.

The canonical `test:engine:authorities` command currently runs the shared
match-client, opening, provider, and presentation-interleaving contracts across
that complete registry. The architecture fence rejects local authority
construction in those suites.

The loopback driver JSON-serializes every public DTO and command receipt. It
detects accidental dependence on object identity, canonical engine objects,
functions, symbols, non-JSON values, or synchronous command completion before
a real server is introduced.

A remote TypeScript server and a Rust authority must be added to this registry
before either can be considered test-complete.

## Non-negotiable gates

- Shared authority contracts iterate the registry; they do not select one
  implementation from an environment variable.
- Shared contracts cannot import `LocalMatchSessionAdapter`, `MatchSession`, or
  canonical `MatchState`.
- The matrix covers bootstrap/opening, privacy, staging, undo, end-turn atomic
  publication, projection, reconnect/correction when introduced, terminal
  behavior, and explicit developer authorization.
- UI/provider/E2E fixtures must accept a `MatchClient` factory. They cannot
  construct local authority internally.
- A new authority is incomplete until the entire matrix, engine regression
  gate, protocol tests, and authority-specific tests are green.
- There are no compatibility adapters or reduced remote-only expectations.

## Migration order

1. Establish the registry and serialized loopback proof.
2. Move existing player-facing adapter assertions into the shared conformance
   suite; retain only genuinely local internals in local adapter tests.
3. Inject registered drivers into provider and UI behavior suites.
4. Add the future network TypeScript implementation to the same matrix.
5. Run the Rust authority through the same protocol vectors and black-box
   client contracts before cutover.

## Completion gate

This testing refactor is complete when searches find no local authority
construction in shared client/provider/UI behavior suites, every registered
authority runs the same black-box contracts, and the canonical verification
command fails if any matrix member fails.
