# Phase 1.15 — Cross-Language Protocol Validation

Status: implemented and exit-proven in the current worktree.

## Outcome

Phase 1.15 establishes one language-neutral structural contract at the
boundaries that will eventually connect the TypeScript client/runtime to a
Rust server.

The canonical source is JSON Schema 2020-12:

```text
protocol/schema-source.ts
        |
        v
protocol/schema/cruel-deal-protocol-v1.schema.json
        |
        +-- Ajv validation at TypeScript runtime boundaries
        +-- typify-generated Rust protocol types
        +-- jsonschema validation at Rust boundaries
        +-- one shared valid/invalid fixture suite
```

This phase does not introduce a Rust game engine, a second event model, or a
compatibility layer.

## Version 1 scope

The protocol validates four contracts:

1. `MATCH_BOOTSTRAP`
2. `INTENT_ENVELOPE`
3. `FRAMED_EVENT`
4. `COMMITTED_TRANSACTION`

All counters and frame/revision coordinates that cross the boundary are
bounded to JavaScript's safe-integer range. A committed `FramedEvent` begins
at frame `1`; genesis frame `0` remains state, not an event.

The schema recognizes every current `MatchEvent.type`. The four chronology
boundary events have closed payload schemas:

- `TURN_RESOLUTION_STARTED`
- `TURN_STARTED`
- `TURN_ENDED`
- `MATCH_ENDED`

Other event payloads remain open in protocol v1 while Phase 1.5 is still
stabilizing the operation, cause, and committed-reaction vocabulary. Their
type discriminants are closed, so unknown events fail now without prematurely
freezing payloads that Phase 1.5 is explicitly changing.

## Authority split

JSON Schema owns portable structural facts:

- required and optional fields
- tagged-union discriminants
- enums
- primitive types
- closed object boundaries
- safe-integer bounds
- non-empty committed transactions

The TypeScript simulation remains the sole authority for semantic facts:

- frame continuity and phase/turn legality
- transaction revision continuity
- match and seat authority
- manifest, ruleset, card, variant, and location existence
- deck construction and hashes
- gameplay legality
- reducer and reaction semantics

Rust validates the same wire structure but does not reproduce these game
rules. When the authoritative server is introduced, semantic authority moves
as an intentional engine migration rather than growing opportunistically in
this validation crate.

## Live integration

The shared validator now guards:

- bootstrap ingestion before manifest/deck semantic validation
- intent dequeue before rules resolution
- committed transactions before publication or storage
- runtime replay transaction ingestion
- engine replay framed-event ingestion and export

Structural bootstrap validation previously implemented by handwritten
TypeScript predicates has been removed. Existing semantic bootstrap errors
remain typed and specific.

## Generation and drift

`npm run protocol:schema:generate` writes the checked-in schema.

`npm run protocol:schema:check` fails if the generated artifact differs from
`protocol/schema-source.ts`.

The Rust crate uses `typify::import_types!` against that exact checked-in
schema during compilation. It therefore cannot silently compile from a
separately maintained Rust model.

Both implementations consume
`protocol/fixtures/protocol-v1-conformance.json`. Every case declares one
expected validity result; TypeScript and Rust must independently agree.

## Proof commands

```sh
npm run protocol:schema:check
npm run protocol:test:ts
npm run protocol:test:rust
```

The normal runtime, replay, Phase 0, lint, and production-build gates remain
required because schema validation is active on live paths.

## Deliberately deferred

- exhaustive closed payloads for events Phase 1.5 is changing
- a full serialized `MatchState` or replay-bundle schema
- redacted multiplayer seat projections
- compatibility adapters for unshipped protocol versions
- durable storage/checksum/CAS contracts
- Rust simulation, WASM execution, or dual-engine parity

These are separate decisions. Adding them to Phase 1.15 would either freeze
an event contract before Phase 1.5 or create the duplicate simulation
authority this phase is intended to prevent.
