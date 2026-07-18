# Phase 1.2 Checkpoint 1 — Third-Deck Contract and Compatibility Factory

Status: implemented and focused-proof complete in the current worktree.

## Outcome

Every validated match bootstrap now requires three distinct deck snapshots:

- `P0`, tagged `kind: 'PLAYER'`
- `P1`, tagged `kind: 'PLAYER'`
- `LOCATIONS`, tagged `kind: 'LOCATION'` and `order: 'PRESERVE'`

The ordered location deck is built before runtime construction, validated,
defensively copied, deeply frozen, retained by `MatchSession`, and passed to
`MatchRuntime`. Runtime initialization consumes its first three entries rather
than enumerating the manifest.

The engine's old manifest selector remains only as a temporary CLI/test adapter
until canonical setup events replace pre-populated locations in checkpoint 3.
The live runtime no longer uses that fallback.

## Compatibility factory

`defaultLocationDeckFactory` performs the existing seeded rarity-weighted
sampling without replacement and continues until it has produced the complete
eligible permutation. Its exact ordered output becomes bootstrap input.

A 128-seed characterization corpus proves that the first three definitions
match the former initializer selection exactly.

The factory is the only place in this checkpoint that selects match location
content from the manifest. Supplied deck order remains authoritative even when
manifest insertion order changes.

## Validation

The shared Phase 1.15 schema now requires the tagged third deck. TypeScript and
Rust conformance fixtures agree on that updated contract.

Semantic bootstrap validation rejects:

- missing or undersized location decks
- unknown or disabled location definitions
- a player-card definition in the location deck
- a location definition in a player deck
- duplicate locations beyond the ruleset copy limit
- ordered content-hash mismatch

Rulesets now own `laneRules` and `locationDeck` constraints. The standard
ruleset requires three active lanes, at most three active lanes, one reserve
location, and unique location definitions.

## Remaining checkpoint seam

`createInitialMatchState` accepts the supplied location order but still embeds
the first three legacy `LocationInstance` objects directly into lanes. Phase
1.2 checkpoint 2 removes that representation in favor of stable lane IDs,
lane-owned slots, normalized location-card instances, explicit zones, face
state, reveal schedules, and seat knowledge.
