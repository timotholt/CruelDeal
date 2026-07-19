# Card & Lane Query System — Design Document

## Goals

1. **Expressive** — answer any reasonable question about cards/lanes in one call
2. **Composable** — combine conditions with AND/OR/NOT
3. **Extensible** — add new filters without breaking existing callers
4. **Serializable** — can be authored in JSON (aligns with ability DSL)
5. **Typed** — full TypeScript safety
6. **Pure** — no side effects, no RNG, deterministic

## Non-Goals

- Not a replacement for the existing ability-DSL `Selector` (that operates inside effect evaluation with `EvalCtx`)
- Not an ORM — no lazy evaluation, no caching
- Not a full query language — keep it focused on game state

---

## Design: Filter Object Pattern

Chosen over fluent builder for:
- **Serializable** — fits into JSON-authored cards/effects later
- **Declarative** — reads like a specification
- **Composable** — object spread / merge works naturally
- **Matches existing DSL style** — `Predicate` type uses same pattern

Fluent wrapper can be added on top later if ergonomics demand it.

---

## Core Types

### Comparison Operators

```typescript
/** Number comparison: either exact match or structured operators. */
export type NumComparison =
  | number                                                    // shorthand: exact match
  | {
      eq?: number;
      ne?: number;
      lt?: number;
      lte?: number;
      gt?: number;
      gte?: number;
      in?: readonly number[];
      nin?: readonly number[];
      between?: readonly [number, number];                    // inclusive range
    };

/** String comparison: either exact match or structured operators. */
export type StringComparison =
  | string                                                    // shorthand: exact match
  | {
      eq?: string;
      ne?: string;
      in?: readonly string[];
      nin?: readonly string[];
      startsWith?: string;
      endsWith?: string;
      contains?: string;
    };

/** Boolean comparison: just use a boolean directly. */
```

### CardFilter (for CardInstance queries)

```typescript
export interface CardFilter {
  // ── Identity ────────────────────────────────────────────────────
  id?: StringComparison;
  defId?: StringComparison;
  version?: NumComparison;

  // ── Location ────────────────────────────────────────────────────
  zone?: CardZone | readonly CardZone[];
  lane?: LaneId | readonly LaneId[] | 'any' | 'none';
  owner?: Owner | 'any';

  // ── Stats (resolved through manifest + ongoings) ─────────────────
  cost?: NumComparison;              // manifest base cost
  basePower?: NumComparison;         // manifest base power
  power?: NumComparison;             // current projected power (base+delta+ongoings)
  storedPowerDelta?: NumComparison;  // folded permanent ledger delta

  // ── Taxonomy ────────────────────────────────────────────────────
  tribe?: StringComparison;          // matches ANY tribe
  allTribes?: readonly string[];     // card must have ALL these tribes
  noTribe?: StringComparison;        // card must NOT have this tribe

  // ── Abilities (presence checks) ─────────────────────────────────
  hasOnReveal?: boolean;
  hasOngoing?: boolean;
  hasOnMove?: boolean;
  hasOnDestroyed?: boolean;
  hasOnDiscarded?: boolean;
  hasOnEndOfTurn?: boolean;
  hasOnAnyCardPlayedHere?: boolean;
  hasActivate?: boolean;
  hasAnyAbility?: boolean;           // any trigger slot non-empty

  // ── Runtime state ───────────────────────────────────────────────
  revealed?: boolean;
  hasTag?: CardTag['kind'] | readonly CardTag['kind'][];
  noTag?: CardTag['kind'];
  hasCounter?: string;               // counter name exists
  counter?: { name: string } & NumComparison;  // counter value comparison

  // ── Provenance ──────────────────────────────────────────────────
  spawnKind?: SpawnSource['kind'] | readonly SpawnSource['kind'][];
  fromDeck?: boolean;                // spawnSource.kind === 'DECK_CREATION'
  createdInGame?: boolean;           // NOT from deck
  createdBy?: CardId;                // spawnSource.sourceCardId === this

  // ── Logical combinators ─────────────────────────────────────────
  and?: readonly CardFilter[];       // all must match
  or?: readonly CardFilter[];        // any must match
  not?: CardFilter;                  // must NOT match

  // ── Escape hatch ────────────────────────────────────────────────
  custom?: (card: CardInstance, state: MatchState, manifest: Manifest) => boolean;
}
```

### CardDefFilter (for "all cards in the game" queries)

Operates on `CardDef` from the manifest, not live `CardInstance`. Used for card creation/spawning ("pick a random 2-cost card").

```typescript
export interface CardDefFilter {
  defId?: StringComparison;
  cost?: NumComparison;
  basePower?: NumComparison;

  tribe?: StringComparison;
  allTribes?: readonly string[];
  noTribe?: StringComparison;

  hasOnReveal?: boolean;
  hasOngoing?: boolean;
  hasOnMove?: boolean;
  hasOnDestroyed?: boolean;
  hasOnDiscarded?: boolean;
  hasOnEndOfTurn?: boolean;
  hasOnAnyCardPlayedHere?: boolean;
  hasActivate?: boolean;
  hasAnyAbility?: boolean;

  frame?: StringComparison;          // common/rare/epic/legendary
  disabled?: boolean;                // in manifest.disabled.cards

  and?: readonly CardDefFilter[];
  or?: readonly CardDefFilter[];
  not?: CardDefFilter;

  custom?: (def: CardDef, manifest: Manifest) => boolean;
}
```

### LaneFilter

```typescript
export interface LaneFilter {
  idx?: LaneId | readonly LaneId[];

  // ── Capacity ────────────────────────────────────────────────────
  hasCapacity?: boolean | Owner;     // true = either side has room; Owner = that side has room
  isFull?: boolean | Owner;          // inverse of hasCapacity
  isEmpty?: boolean | Owner;         // no cards at all / no cards for owner

  // ── Cards ───────────────────────────────────────────────────────
  cardCount?: NumComparison;                      // total across both owners
  cardCountFor?: { owner: Owner } & NumComparison; // specific owner count
  containsCard?: CardFilter;                       // lane contains any card matching filter

  // ── Location ────────────────────────────────────────────────────
  locationRevealed?: boolean;
  hasLocation?: StringComparison;    // matches defId
  locationTag?: LaneTag['kind'] | readonly LaneTag['kind'][];

  // ── Logical combinators ─────────────────────────────────────────
  and?: readonly LaneFilter[];
  or?: readonly LaneFilter[];
  not?: LaneFilter;
}
```

---

## Query API

### Primary functions

```typescript
// Card queries (CardInstance)
export function findCards(state: MatchState, manifest: Manifest, filter: CardFilter): CardInstance[];
export function findCard(state: MatchState, manifest: Manifest, filter: CardFilter): CardInstance | null;
export function countCards(state: MatchState, manifest: Manifest, filter: CardFilter): number;
export function hasCards(state: MatchState, manifest: Manifest, filter: CardFilter): boolean;

// Card def queries (manifest-wide)
export function findCardDefs(manifest: Manifest, filter: CardDefFilter): CardDef[];
export function findCardDef(manifest: Manifest, filter: CardDefFilter): CardDef | null;
export function countCardDefs(manifest: Manifest, filter: CardDefFilter): number;

// Lane queries
export function findLanes(state: MatchState, manifest: Manifest, filter: LaneFilter): LaneId[];
export function findLane(state: MatchState, manifest: Manifest, filter: LaneFilter): LaneId | null;

// Predicate matching (single-item check)
export function matchesCard(card: CardInstance, filter: CardFilter, state: MatchState, manifest: Manifest): boolean;
export function matchesCardDef(def: CardDef, filter: CardDefFilter, manifest: Manifest): boolean;
export function matchesLane(idx: LaneId, filter: LaneFilter, state: MatchState, manifest: Manifest): boolean;
```

### Return ordering

- `findCards`: iteration order of `state.cards` (stable, insertion-ordered by spec)
- `findCardDefs`: iteration order of `manifest.cards` keys
- `findLanes`: ascending `LaneId` (0, 1, 2)

No RNG involved — callers that need random selection should fork an RNG and call `.pick()` on the result.

---

## Usage Examples

```typescript
// All cards in PLAYER's hand that cost 2 or less
findCards(state, manifest, {
  zone: 'HAND',
  owner: 'PLAYER',
  cost: { lte: 2 },
});

// Pick a random 3-cost card def for spawning
const cheapDefs = findCardDefs(manifest, { cost: 3 });
const spawned = rng.pick(cheapDefs);

// All on-reveal cards in the game (for "add a random on-reveal to hand")
findCardDefs(manifest, { hasOnReveal: true });

// Find a lane with capacity for PLAYER
const openLanes = findLanes(state, manifest, { hasCapacity: 'PLAYER' });

// Enemy cards with power >= 5 in lanes 0 or 2
findCards(state, manifest, {
  zone: 'LANE',
  owner: 'OPP',
  lane: [0, 2],
  power: { gte: 5 },
});

// Cards created in-game by Hex Witch
findCards(state, manifest, {
  createdInGame: true,
  createdBy: hexWitchId,
});

// Beast OR striker tribe cards in OPP hand
findCards(state, manifest, {
  zone: 'HAND',
  owner: 'OPP',
  or: [{ tribe: 'beast' }, { tribe: 'striker' }],
});

// All cards in PLAYER's graveyard that have on-destroyed abilities
findCards(state, manifest, {
  zone: 'DESTROYED',
  owner: 'PLAYER',
  hasOnDestroyed: true,
});

// Empty lanes where PLAYER has 0 cards (but OPP might)
findLanes(state, manifest, { isEmpty: 'PLAYER' });

// Lanes with FLOODED location tag and at least one card
findLanes(state, manifest, {
  locationTag: 'FLOODED',
  cardCount: { gte: 1 },
});

// Complex: cards that are either low-cost OR have ongoing, but NOT from deck
findCards(state, manifest, {
  and: [
    { not: { fromDeck: true } },
    { or: [{ cost: { lte: 1 } }, { hasOngoing: true }] },
  ],
});

// Escape hatch for weird queries
findCards(state, manifest, {
  custom: (c, s, m) => {
    const def = m.cards[c.defId];
    return def?.tribes.length === 2;  // exactly dual-tribe cards
  },
});
```

---

## Integration Points

### 1. Dune Sapper fix (simplified)

Before:
```typescript
const filtered = destLanes.filter(l => {
  if (l === card.lane) return false;
  const count = s.lanes[l].cards[card.owner].length;
  return count < manifest.constants.laneCapacity;
});
```

After:
```typescript
const filtered = findLanes(s, manifest, {
  idx: destLanes,
  hasCapacity: card.owner,
  not: { idx: card.lane },
});
```

### 2. AI planning

```typescript
// Current: manual loop through lanes
const candidates = [0, 1, 2].filter(
  idx => state.lanes[idx].cards[owner].length < cap
);

// With query system:
const candidates = findLanes(state, manifest, { hasCapacity: owner });
```

### 3. Card spawning effects

`ADD_CARD_TO_HAND` with `PoolRef: COST_RANGE` currently hand-rolls its own filter. Could become:

```typescript
const pool = findCardDefs(manifest, { cost: { between: [min, max] } });
const spawned = rng.pick(pool);
```

### 4. UI / Deck builder

Filter collection by cost, tribe, ability — same API works.

### 5. Tests

Replace verbose assertions like:
```typescript
const cards = Object.values(state.cards)
  .filter(c => c.owner === 'PLAYER' && c.zone === 'LANE' && c.lane === 0);
```

With:
```typescript
const cards = findCards(state, manifest, { owner: 'PLAYER', zone: 'LANE', lane: 0 });
```

---

## Extensibility

### Adding a new filter field

1. Add the field to `CardFilter` / `CardDefFilter` / `LaneFilter`
2. Add the evaluation branch in the matcher function
3. That's it — existing queries continue to work (fields are all optional)

### Adding a new comparison operator

Extend `NumComparison` or `StringComparison` with the new operator, add matching logic. All existing filters automatically gain the capability where the type is used.

### Adding a new entity type (e.g. `EffectFilter`)

Create a new `EntityFilter` interface following the same pattern. The matcher boilerplate is small (~50 LOC per entity).

---

## Implementation Strategy

1. **File:** `services/playgame/engine/projections/query.ts` (replaces `queries.ts`)
2. **Size:** ~500 LOC total (types + matchers + entry points)
3. **Tests:** `query.test.ts` — one section per filter field + combinator tests
4. **Docs:** JSDoc on every exported function with runnable examples

### Phasing

**Phase 1** (this task):
- Types: `NumComparison`, `StringComparison`, `CardFilter`, `CardDefFilter`, `LaneFilter`
- Matchers: `matchesCard`, `matchesCardDef`, `matchesLane`
- Entry points: `findCards`, `findCardDefs`, `findLanes` + plural/count/has variants
- Replace `queries.ts` callsites
- Test coverage for every field + combinator

**Phase 2** (future):
- Fluent wrapper class (`CardQuery`, `LaneQuery`) if ergonomics needed
- `EventFilter` for querying the match log
- `PendingEffectFilter` for pending-effect queries
- JSON schema validation so queries can come from card definitions

---

## Open Questions

1. **Power resolution:** `CardFilter.power` requires calling `getCardPower` which is O(n) per card. Should we expose a cheaper `storedPowerDelta` ledger filter for hot paths? **A:** Yes, both are in the design.

2. **Caching:** Should query results be memoized? **A:** No. Keep it pure and stateless. Callers can memoize at their layer if needed.

3. **Error handling:** Invalid filters (e.g. `cost: { between: [5, 2] }`)? **A:** Throw with descriptive message. Fail loudly during development.

4. **DSL unification:** Should this replace the effect-DSL `Predicate` type? **A:** No, they serve different contexts. Document the overlap. Consider sharing the `NumComparison` / `StringComparison` primitives.

5. **Performance:** Linear scan of all cards for every query. Acceptable for < 100 cards on board. **A:** Fine for now. Add indexing only if profiling shows a problem.
